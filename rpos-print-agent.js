#!/usr/bin/env node
/**
 * Restaurant OS — Standalone Print Agent
 * 
 * Zero dependencies. Just run: node rpos-print-agent.js
 * 
 * This script:
 *   1. Polls Supabase every 2 seconds for pending print jobs
 *   2. Sends ESC/POS bytes to the printer via TCP port 9100
 *   3. Marks jobs complete in Supabase
 * 
 * Requirements: Node.js 18+ (for built-in fetch)
 * No npm install needed.
 */

'use strict';
const net = require('net');

// ─── Config (pre-filled for your restaurant) ──────────────────────────────────
const SUPABASE_URL  = 'https://tbetcegmszzotrwdtqhi.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXRjZWdtc3p6b3Ryd2R0cWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMzI0MTgsImV4cCI6MjA5MTYwODQxOH0.Iy5pz4V7OFLujSa-4Hh8whWCA0-8RoXypDKS1mMtbX8';
const LOCATION_ID   = '7218c716-eeb4-4f96-b284-f3500823595c';
const POLL_MS       = 2000;  // check for jobs every 2 seconds

// ─── Send bytes to printer via TCP ───────────────────────────────────────────
function sendToPrinter(ip, port, bytes) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timer  = setTimeout(() => { socket.destroy(); reject(new Error('Timeout')); }, 8000);

    socket.connect(port || 9100, ip, () => {
      socket.write(Buffer.from(bytes), err => {
        if (err) { clearTimeout(timer); socket.destroy(); reject(err); return; }
        setTimeout(() => { clearTimeout(timer); socket.destroy(); resolve(); }, 200);
      });
    });
    socket.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// ─── Supabase helpers (using native fetch, no SDK) ───────────────────────────
const headers = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=minimal',
};

async function getPendingJobs() {
  let url = `${SUPABASE_URL}/rest/v1/print_jobs?status=eq.pending&order=created_at.asc&limit=5`;
  if (LOCATION_ID) url += `&location_id=eq.${LOCATION_ID}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json();
}

async function updateJob(id, status, error) {
  const body = { status };
  if (error)            body.error      = String(error).slice(0, 500);
  if (status === 'done') body.printed_at = new Date().toISOString();

  await fetch(`${SUPABASE_URL}/rest/v1/print_jobs?id=eq.${id}`, {
    method:  'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body:    JSON.stringify(body),
  });
}

// ─── Process a single job ─────────────────────────────────────────────────────
async function processJob(job) {
  const { id, printer_ip, printer_port, payload, job_type } = job;
  console.log(`  → Job ${id.slice(0,8)}… [${job_type}] to ${printer_ip}`);

  if (!printer_ip) {
    await updateJob(id, 'failed', 'No printer IP on job');
    console.log('    ✗ No printer IP');
    return;
  }

  try {
    await updateJob(id, 'printing');
    const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
    await sendToPrinter(printer_ip, printer_port || 9100, bytes);
    await updateJob(id, 'done');
    console.log('    ✓ Printed');
  } catch (err) {
    await updateJob(id, 'failed', err.message);
    console.log(`    ✗ Failed: ${err.message}`);
  }
}

// ─── Main poll loop ───────────────────────────────────────────────────────────
let running = false;

async function poll() {
  if (running) return;
  running = true;
  try {
    const jobs = await getPendingJobs();
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error(`  Poll error: ${err.message}`);
  }
  running = false;
}

console.log('');
console.log('  🖨  Restaurant OS Print Agent (standalone)');
console.log('  ──────────────────────────────────────────');
console.log(`  Project:    ${SUPABASE_URL.split('//')[1].split('.')[0]}`);
console.log(`  Location:   ${LOCATION_ID}`);
console.log(`  Polling:    every ${POLL_MS / 1000}s`);
console.log('');
console.log('  Waiting for print jobs... (Ctrl+C to stop)');
console.log('');

poll(); // immediate first poll
setInterval(poll, POLL_MS);
