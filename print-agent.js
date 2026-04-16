#!/usr/bin/env node
/**
 * Restaurant OS — Print Agent v2
 * ================================
 * Subscribes to Supabase for print jobs, forwards to printer via TCP.
 * Also writes:
 *   - printer_agents heartbeat every 30s (so dashboard knows agent is alive)
 *   - printer_health after each job (persistent per-printer status)
 *
 * NO HTTP server. NO port forwarding. NO firewall rules.
 * Only outbound: this machine → Supabase (WSS), this machine → printer (TCP 9100)
 *
 * Setup:
 *   1. npm install @supabase/supabase-js  (one-time)
 *   2. Copy print-agent.env.example → print-agent.env, fill in keys
 *   3. node print-agent.js
 */

const net  = require('net');
const os   = require('os');
const { randomUUID } = require('crypto');

// Auto-load print-agent.env
try {
  const fs = require('fs'), path = require('path');
  const ef = path.join(__dirname, 'print-agent.env');
  if (fs.existsSync(ef)) {
    fs.readFileSync(ef, 'utf8').split('\n').forEach(l => {
      const m = l.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    });
  }
} catch {}

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://tbetcegmszzotrwdtqhi.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
const LOCATION_ID   = process.env.LOCATION_ID  || '';
const PRINTER_PORT  = parseInt(process.env.PRINTER_PORT || '9100');
const POLL_MS       = parseInt(process.env.POLL_MS      || '3000');
const TCP_TIMEOUT   = parseInt(process.env.TCP_TIMEOUT  || '5000');
const HEARTBEAT_MS  = parseInt(process.env.HEARTBEAT_MS || '30000');
const AGENT_VERSION = '2.0.0';

if (!SUPABASE_KEY) {
  console.error('\n  ✗ SUPABASE_KEY not set.\n');
  process.exit(1);
}

// ─── Supabase client ──────────────────────────────────────────────────────────
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { timeout: 30000 },
});

// ─── Agent identity (regenerated each start) ──────────────────────────────────
const AGENT_ID = randomUUID();
const HOSTNAME  = os.hostname();

// Track which printers this agent has touched
const knownPrinterIds = new Set();

// ─── Heartbeat ────────────────────────────────────────────────────────────────
async function sendHeartbeat() {
  if (!LOCATION_ID) return;
  try {
    await supabase.from('printer_agents').upsert({
      id:          AGENT_ID,
      location_id: LOCATION_ID,
      hostname:    HOSTNAME,
      version:     AGENT_VERSION,
      last_seen:   new Date().toISOString(),
      printer_ids: [...knownPrinterIds],
      status:      'online',
    }, { onConflict: 'id' });
  } catch(e) { /* non-fatal */ }
}

async function markAgentOffline() {
  if (!LOCATION_ID) return;
  try {
    await supabase.from('printer_agents').upsert({
      id: AGENT_ID, location_id: LOCATION_ID, status: 'offline',
      last_seen: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch {}
}

// ─── Printer health ───────────────────────────────────────────────────────────
async function updatePrinterHealth(printerId, status, error = null) {
  if (!LOCATION_ID || !printerId) return;
  try {
    const now = new Date().toISOString();
    const patch = {
      printer_id:  printerId,
      location_id: LOCATION_ID,
      status,
      last_job_at: now,
      updated_at:  now,
    };
    if (status === 'online') {
      patch.last_success_at  = now;
      patch.consecutive_failures = 0;
    } else {
      patch.last_error_at = now;
      patch.last_error    = error || 'Unknown error';
      // Increment failures — read current first
      const { data: cur } = await supabase
        .from('printer_health')
        .select('consecutive_failures')
        .eq('printer_id', printerId)
        .single()
        .catch(() => ({ data: null }));
      patch.consecutive_failures = (cur?.consecutive_failures || 0) + 1;
    }
    await supabase.from('printer_health').upsert(patch, { onConflict: 'printer_id' });
  } catch(e) { /* non-fatal */ }
}

// ─── TCP print ────────────────────────────────────────────────────────────────
function printTCP(ip, port, bytes) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer  = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP timeout (${TCP_TIMEOUT}ms) connecting to ${ip}:${port} — is the printer on and connected?`));
    }, TCP_TIMEOUT);

    socket.connect(port, ip, () => {
      socket.write(Buffer.from(bytes), err => {
        if (err) { clearTimeout(timer); socket.destroy(); return reject(err); }
        // Wait briefly for printer to accept all data before closing
        setTimeout(() => { clearTimeout(timer); socket.destroy(); resolve(); }, 200);
      });
    });

    socket.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// ─── Process a job ────────────────────────────────────────────────────────────
async function processJob(job) {
  const ip       = job.printer_ip;
  const port     = job.printer_port || PRINTER_PORT;
  const printerId = job.printer_id;
  const shortId  = job.id.slice(0, 8);

  if (printerId) knownPrinterIds.add(printerId);

  if (!ip) {
    console.error(`  [${shortId}] ✗ No printer IP — skipping`);
    await supabase.from('print_jobs').update({
      status: 'failed',
      error_message: 'No printer IP configured',
      processed_at: new Date(),
      agent_id: AGENT_ID,
    }).eq('id', job.id);
    await updatePrinterHealth(printerId, 'error', 'No printer IP configured');
    return;
  }

  let bytes;
  try {
    bytes = Buffer.from(job.payload, 'base64');
  } catch {
    await supabase.from('print_jobs').update({
      status: 'failed', error_message: 'Invalid payload', agent_id: AGENT_ID, processed_at: new Date(),
    }).eq('id', job.id);
    await updatePrinterHealth(printerId, 'error', 'Invalid payload');
    return;
  }

  // Mark as processing
  await supabase.from('print_jobs').update({ status: 'printing', agent_id: AGENT_ID }).eq('id', job.id);

  try {
    await printTCP(ip, port, bytes);
    await supabase.from('print_jobs').update({
      status: 'done',
      processed_at: new Date(),
      agent_id: AGENT_ID,
    }).eq('id', job.id);
    await updatePrinterHealth(printerId, 'online');
    console.log(`  [${shortId}] ✓ ${bytes.length} bytes → ${ip}:${port} (${job.job_type})`);
  } catch (err) {
    const msg = err.message;
    await supabase.from('print_jobs').update({
      status: 'failed',
      error_message: msg,
      processed_at: new Date(),
      agent_id: AGENT_ID,
    }).eq('id', job.id);
    await updatePrinterHealth(printerId, 'error', msg);
    console.error(`  [${shortId}] ✗ ${msg}`);
  }
}

// ─── Drain pending on startup ─────────────────────────────────────────────────
async function drainPending() {
  let q = supabase.from('print_jobs').select('*').in('status', ['pending','printing']).order('created_at');
  if (LOCATION_ID) q = q.eq('location_id', LOCATION_ID);
  const { data, error } = await q;
  if (error) { console.error('  Drain error:', error.message); return; }
  if (data?.length) {
    console.log(`  Found ${data.length} pending job(s) — processing...`);
    for (const job of data) await processJob(job);
  } else {
    console.log('  No pending jobs.\n');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n  🖨  Restaurant OS Print Agent v2');
  console.log('  ─────────────────────────────────────');
  console.log(`  Supabase:  ${SUPABASE_URL}`);
  console.log(`  Location:  ${LOCATION_ID || 'all locations'}`);
  console.log(`  Agent ID:  ${AGENT_ID.slice(0, 8)}…`);
  console.log(`  Hostname:  ${HOSTNAME}`);
  console.log(`  Heartbeat: every ${HEARTBEAT_MS / 1000}s`);
  console.log('\n  Outbound only — safe behind any firewall.');
  console.log('  Waiting for jobs...\n');

  // Send first heartbeat immediately
  await sendHeartbeat();
  console.log('  ✓ Heartbeat sent — agent visible in dashboard\n');

  // Drain any jobs waiting since agent was offline
  await drainPending();

  // ── Realtime — instant notification ──────────────────────────────────────────
  const channel = supabase
    .channel('print-jobs-agent')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'print_jobs',
      ...(LOCATION_ID ? { filter: `location_id=eq.${LOCATION_ID}` } : {}),
    }, async payload => {
      const job = payload.new;
      if (job.status !== 'pending') return;
      console.log(`  → Realtime job: ${job.id.slice(0,8)} (${job.job_type})`);
      await processJob(job);
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('  ✓ Realtime subscribed\n');
      if (status === 'CLOSED')     console.log('  ! Realtime closed — polling active');
    });

  // ── Polling fallback ──────────────────────────────────────────────────────────
  setInterval(async () => {
    let q = supabase.from('print_jobs').select('*').eq('status', 'pending').order('created_at').limit(10);
    if (LOCATION_ID) q = q.eq('location_id', LOCATION_ID);
    const { data } = await q;
    if (data?.length) {
      console.log(`  [poll] ${data.length} pending job(s)`);
      for (const job of data) await processJob(job);
    }
  }, POLL_MS);

  // ── Heartbeat ────────────────────────────────────────────────────────────────
  setInterval(sendHeartbeat, HEARTBEAT_MS);

  // ── Shutdown ─────────────────────────────────────────────────────────────────
  const shutdown = async (sig) => {
    console.log(`\n  ${sig} received — shutting down cleanly...`);
    await markAgentOffline();
    supabase.removeChannel(channel);
    console.log('  Agent marked offline. Goodbye.\n');
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
