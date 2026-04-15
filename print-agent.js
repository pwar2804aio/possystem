#!/usr/bin/env node
/**
 * Restaurant OS — Print Agent
 * ============================
 * Lightweight agent that subscribes to Supabase for print jobs
 * and forwards them to the printer via TCP port 9100.
 *
 * NO HTTP server. NO port forwarding. NO firewall rules.
 * Only outbound connections: this machine → Supabase (WebSocket), this machine → printer (TCP)
 *
 * Works from any device: iOS, Android, browser, anywhere — jobs submitted to
 * Supabase are picked up by this agent and printed locally.
 *
 * Setup:
 *   1. npm install @supabase/supabase-js  (one-time)
 *   2. Set SUPABASE_URL and SUPABASE_KEY below or via environment
 *   3. node print-agent.js
 *
 * Run as a background service (Mac/Linux):
 *   nohup node print-agent.js &
 *
 * Or as a systemd service — see README for unit file.
 */

const net = require('net');

// Auto-load print-agent.env if present
try { const fs=require('fs'),path=require('path'),ef=path.join(__dirname,'print-agent.env'); if(fs.existsSync(ef)) { fs.readFileSync(ef,'utf8').split('
').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim();}); } } catch {}

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tbetcegmszzotrwdtqhi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
const LOCATION_ID  = process.env.LOCATION_ID  || '';  // optional — agent prints for all locations if blank
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || '9100');
const POLL_MS      = parseInt(process.env.POLL_MS || '2000');  // fallback polling interval
const TCP_TIMEOUT  = parseInt(process.env.TCP_TIMEOUT || '5000');

if (!SUPABASE_KEY) {
  console.error('\n  ✗ SUPABASE_KEY not set. Add it to your environment:\n');
  console.error('    SUPABASE_KEY=your_anon_key node print-agent.js\n');
  process.exit(1);
}

// ─── Supabase client (pure HTTP + WebSocket, no browser APIs) ─────────────────
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { timeout: 30000 },
});

// ─── Send bytes to printer via TCP ────────────────────────────────────────────
function printJob(ip, port, bytes) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP timeout connecting to ${ip}:${port}`));
    }, TCP_TIMEOUT);

    socket.connect(port, ip, () => {
      socket.write(Buffer.from(bytes), (err) => {
        if (err) { clearTimeout(timer); socket.destroy(); return reject(err); }
        setTimeout(() => { clearTimeout(timer); socket.destroy(); resolve(); }, 150);
      });
    });

    socket.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

// ─── Process a single pending job ─────────────────────────────────────────────
async function processJob(job) {
  const ip   = job.printer_ip;
  const port = job.printer_port || PRINTER_PORT;

  if (!ip) {
    console.error(`  [job ${job.id.slice(0,8)}] ✗ No printer IP — skipping`);
    await supabase.from('print_jobs').update({ status:'failed', error:'No printer IP configured', printed_at:new Date() }).eq('id', job.id);
    return;
  }

  // Decode base64 payload to bytes
  let bytes;
  try {
    bytes = Buffer.from(job.payload, 'base64');
  } catch (err) {
    await supabase.from('print_jobs').update({ status:'failed', error:'Invalid payload encoding' }).eq('id', job.id);
    return;
  }

  // Mark as printing
  await supabase.from('print_jobs').update({ status:'printing' }).eq('id', job.id);

  try {
    await printJob(ip, port, bytes);
    await supabase.from('print_jobs').update({ status:'done', printed_at: new Date() }).eq('id', job.id);
    console.log(`  [job ${job.id.slice(0,8)}] ✓ Printed ${bytes.length} bytes → ${ip}:${port} (${job.job_type})`);
  } catch (err) {
    await supabase.from('print_jobs').update({ status:'failed', error: err.message, printed_at: new Date() }).eq('id', job.id);
    console.error(`  [job ${job.id.slice(0,8)}] ✗ Print failed: ${err.message}`);
  }
}

// ─── Drain any pending jobs on startup ────────────────────────────────────────
async function drainPending() {
  let query = supabase.from('print_jobs').select('*').eq('status', 'pending').order('created_at');
  if (LOCATION_ID) query = query.eq('location_id', LOCATION_ID);
  const { data, error } = await query;
  if (error) { console.error('  Drain error:', error.message); return; }
  if (data?.length) {
    console.log(`  Found ${data.length} pending job(s) — processing...`);
    for (const job of data) await processJob(job);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n  🖨  Restaurant OS Print Agent');
  console.log('  ─────────────────────────────────────────');
  console.log(`  Supabase:   ${SUPABASE_URL}`);
  console.log(`  Location:   ${LOCATION_ID || 'all'}`);
  console.log(`  Printer port: ${PRINTER_PORT}`);
  console.log(`  Mode: realtime subscription + polling fallback (${POLL_MS}ms)`);
  console.log('\n  No HTTP server — outbound only. Safe behind any firewall.');
  console.log('  Waiting for print jobs...\n');

  // Drain on startup
  await drainPending();

  // ── Realtime subscription — instant notification when a job is inserted ──────
  const channel = supabase
    .channel('print-jobs')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'print_jobs',
      ...(LOCATION_ID ? { filter: `location_id=eq.${LOCATION_ID}` } : {}),
    }, async (payload) => {
      const job = payload.new;
      if (job.status !== 'pending') return;
      console.log(`  → Job received via realtime: ${job.id.slice(0,8)} (${job.job_type})`);
      await processJob(job);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('  ✓ Realtime channel subscribed\n');
      if (status === 'CLOSED')     console.log('  ! Realtime channel closed — falling back to polling');
    });

  // ── Polling fallback — catches jobs if realtime misses them ──────────────────
  setInterval(async () => {
    let query = supabase.from('print_jobs').select('*').eq('status','pending').order('created_at').limit(5);
    if (LOCATION_ID) query = query.eq('location_id', LOCATION_ID);
    const { data } = await query;
    if (data?.length) {
      for (const job of data) await processJob(job);
    }
  }, POLL_MS);

  // ── Reconnect realtime on disconnect ──────────────────────────────────────────
  process.on('SIGTERM', () => { supabase.removeChannel(channel); process.exit(0); });
  process.on('SIGINT',  () => { supabase.removeChannel(channel); console.log('\n  Stopped.'); process.exit(0); });
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
