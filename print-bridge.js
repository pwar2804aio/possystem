#!/usr/bin/env node
/**
 * Restaurant OS — Print Bridge Server
 * =====================================
 * Runs on the local network (Raspberry Pi, Mac, Sunmi D3 Pro, or any Node device)
 * Accepts HTTP POST with raw ESC/POS bytes and forwards to printer via TCP port 9100.
 *
 * Works with: Sunmi NT311, Epson TM series, Star TSP series, any ESC/POS printer
 * Supports: iOS, Android, any browser — anything that can make HTTP requests
 *
 * Usage:
 *   node print-bridge.js --ip 192.168.1.100
 *   node print-bridge.js --ip 192.168.1.100 --port 3001
 *   node print-bridge.js --ip 192.168.1.100 --ip2 192.168.1.101  (multi-printer)
 *
 * Install: npm install (no dependencies — uses built-in Node modules only)
 * Start:   node print-bridge.js --ip YOUR_PRINTER_IP
 */

const http  = require('http');
const net   = require('net');
const url   = require('url');

const PORT         = parseInt(process.env.BRIDGE_PORT || '3001');
const PRINTER_PORT = 9100;
const TIMEOUT_MS   = 5000;

// Parse CLI args: --ip, --ip2, --port
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const printerIps = [];
if (getArg('ip'))  printerIps.push(getArg('ip'));
if (getArg('ip2')) printerIps.push(getArg('ip2'));
if (getArg('ip3')) printerIps.push(getArg('ip3'));

// Allow env override
if (process.env.PRINTER_IP) printerIps.push(process.env.PRINTER_IP);

// ─── Send bytes to a single printer via TCP ───────────────────────────────────
function sendToPrinter(ip, bytes) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let connected = false;

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout connecting to ${ip}:${PRINTER_PORT}`));
    }, TIMEOUT_MS);

    socket.connect(PRINTER_PORT, ip, () => {
      connected = true;
      socket.write(Buffer.from(bytes), (err) => {
        if (err) { clearTimeout(timer); socket.destroy(); reject(err); return; }
        // Give printer 100ms to receive data before closing
        setTimeout(() => { clearTimeout(timer); socket.destroy(); resolve({ ip, ok: true }); }, 100);
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`${ip}: ${err.message}`));
    });
  });
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS — allow any origin (POS runs on same LAN)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Printer-IP');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const { pathname, query: queryStr } = url.parse(req.url, true);

  // ── GET /status — health check ────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      ok: true,
      version: '1.0.0',
      bridge: 'Restaurant OS Print Bridge',
      printers: printerIps,
      port: PORT,
    }));
    return;
  }

  // ── GET /printers — list configured printers ──────────────────────────────
  if (req.method === 'GET' && pathname === '/printers') {
    res.writeHead(200);
    res.end(JSON.stringify({ printers: printerIps }));
    return;
  }

  // ── POST /print — receive ESC/POS bytes and send to printer ──────────────
  if (req.method === 'POST' && pathname === '/print') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const bytes = Buffer.concat(chunks);

      if (bytes.length === 0) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'Empty print job' }));
        return;
      }

      // Optional: target a specific printer IP via header or query param
      const targetIp = req.headers['x-printer-ip'] || queryStr.ip;
      const targets  = targetIp ? [targetIp] : printerIps;

      if (targets.length === 0) {
        res.writeHead(503);
        res.end(JSON.stringify({ ok: false, error: 'No printer IP configured. Start bridge with --ip YOUR_PRINTER_IP' }));
        return;
      }

      // Send to all targets (e.g. kitchen + receipt printer)
      const results = await Promise.allSettled(targets.map(ip => sendToPrinter(ip, bytes)));
      const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      const failures  = results.filter(r => r.status === 'rejected').map(r => r.reason?.message);

      if (successes.length > 0) {
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, sent: successes, errors: failures, bytes: bytes.length }));
      } else {
        res.writeHead(502);
        res.end(JSON.stringify({ ok: false, errors: failures }));
      }
    });
    return;
  }

  // ── POST /test — print test page ──────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/test') {
    const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
    const str  = (s) => [...s].map(c => c.charCodeAt(0));
    const bytes = Buffer.from([
      ...([ESC, 0x40]),          // init
      ...([ESC, 0x61, 0x01]),    // center
      ...([ESC, 0x21, 0x30]),    // double
      ...([ESC, 0x45, 0x01]),    // bold
      ...str('RESTAURANT OS'),   LF,
      ...([ESC, 0x21, 0x00]),    // normal
      ...([ESC, 0x45, 0x00]),
      ...str('Print Bridge Active'), LF,
      ...str('-'.repeat(42)), LF,
      ...([ESC, 0x61, 0x00]),    // left
      ...str('Bridge version: 1.0.0'), LF,
      ...str(`Printer: ${printerIps.join(', ') || 'not configured'}`), LF,
      ...str(`Time: ${new Date().toLocaleString()}`), LF,
      ...str('-'.repeat(42)), LF,
      ...str('Connection: OK'), LF,
      LF, LF, LF, LF,
      ...([GS, 0x56, 0x42, 0x00]), // partial cut
    ]);

    const chunks = [];
    req.on('data', c => chunks.push(c)); // drain body if any
    req.on('end', async () => {
      if (printerIps.length === 0) {
        res.writeHead(503);
        res.end(JSON.stringify({ ok: false, error: 'No printer configured' }));
        return;
      }
      try {
        const result = await sendToPrinter(printerIps[0], bytes);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        res.writeHead(502);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  🖨  Restaurant OS Print Bridge');
  console.log('  ──────────────────────────────────');
  console.log(`  Listening on  : http://0.0.0.0:${PORT}`);
  console.log(`  Printer IPs   : ${printerIps.length ? printerIps.join(', ') : '⚠ none set — use --ip 192.168.x.x'}`);
  console.log(`  Printer port  : ${PRINTER_PORT}`);
  console.log('');
  console.log('  Endpoints:');
  console.log(`    GET  /status   — health check`);
  console.log(`    POST /print    — send ESC/POS bytes`);
  console.log(`    POST /test     — print test page`);
  console.log('');
  if (printerIps.length === 0) {
    console.log('  ⚠  No printer IP set. Restart with:');
    console.log('     node print-bridge.js --ip 192.168.1.100');
    console.log('');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${PORT} is already in use. Try:\n    BRIDGE_PORT=3002 node print-bridge.js\n`);
  } else {
    console.error('\n  ✗ Server error:', err.message);
  }
  process.exit(1);
});
