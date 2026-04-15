/**
 * PrintService — universal ESC/POS printer integration
 * NT311 + any ESC/POS printer, any device including iOS Safari
 *
 * Transport priority:
 *   1. WiFi Bridge  — HTTP POST to local bridge server → TCP 9100 (works everywhere)
 *   2. Web Bluetooth — Chrome/Edge/Android only (no iOS)
 *   3. Sunmi native  — Sunmi D3 Pro with JS bridge
 *   4. Browser print — window.print() fallback (always works, no cut/cash drawer)
 */

// ─── ESC/POS command constants ────────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;
const CR  = 0x0d;

const CMD = {
  INIT:           [ESC, 0x40],              // ESC @ — reset printer
  CUT_FULL:       [GS,  0x56, 0x00],        // GS V 0 — full cut
  CUT_PARTIAL:    [GS,  0x56, 0x42, 0x00],  // GS V B 0 — partial cut
  CASH_DRAWER:    [ESC, 0x70, 0x00, 0x19, 0x19], // ESC p — open drawer
  BOLD_ON:        [ESC, 0x45, 0x01],
  BOLD_OFF:       [ESC, 0x45, 0x00],
  ALIGN_LEFT:     [ESC, 0x61, 0x00],
  ALIGN_CENTER:   [ESC, 0x61, 0x01],
  ALIGN_RIGHT:    [ESC, 0x61, 0x02],
  DOUBLE_HEIGHT:  [ESC, 0x21, 0x10],
  DOUBLE_BOTH:    [ESC, 0x21, 0x30],        // double width + height
  NORMAL_SIZE:    [ESC, 0x21, 0x00],
  UNDERLINE_ON:   [ESC, 0x2d, 0x01],
  UNDERLINE_OFF:  [ESC, 0x2d, 0x00],
  FONT_A:         [ESC, 0x4d, 0x00],        // normal font
  FONT_B:         [ESC, 0x4d, 0x01],        // smaller condensed font
  FEED_1:         [LF],
  FEED_3:         [LF, LF, LF],
  FEED_5:         [LF, LF, LF, LF, LF],
};

// ─── ESC/POS byte builder ─────────────────────────────────────────────────────
class EscPosBuilder {
  constructor(charWidth = 42) {
    this.bytes = [];
    this.charWidth = charWidth; // 42 chars for 80mm, 30 for 58mm
  }

  _push(...args) {
    for (const a of args) {
      if (Array.isArray(a)) this.bytes.push(...a);
      else if (typeof a === 'string') {
        for (let i = 0; i < a.length; i++) this.bytes.push(a.charCodeAt(i) & 0xff);
      } else {
        this.bytes.push(a);
      }
    }
    return this;
  }

  init()          { return this._push(CMD.INIT); }
  cut()           { return this._push(CMD.CUT_PARTIAL); }
  cutFull()       { return this._push(CMD.CUT_FULL); }
  cashDrawer()    { return this._push(CMD.CASH_DRAWER); }
  lf(n = 1)      { for (let i = 0; i < n; i++) this._push(LF); return this; }
  bold(on = true) { return this._push(on ? CMD.BOLD_ON : CMD.BOLD_OFF); }
  center()        { return this._push(CMD.ALIGN_CENTER); }
  left()          { return this._push(CMD.ALIGN_LEFT); }
  right()         { return this._push(CMD.ALIGN_RIGHT); }
  doubleHeight()  { return this._push(CMD.DOUBLE_HEIGHT); }
  doubleBoth()    { return this._push(CMD.DOUBLE_BOTH); }
  normal()        { return this._push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT); }
  underline(on)   { return this._push(on ? CMD.UNDERLINE_ON : CMD.UNDERLINE_OFF); }
  fontB()         { return this._push(CMD.FONT_B); }
  fontA()         { return this._push(CMD.FONT_A); }

  text(str) {
    // Basic Latin-1 safe encoding
    const safe = (str || '').replace(/[^\x00-\xff]/g, '?');
    return this._push(safe);
  }

  line(str = '') {
    return this.text(str).lf();
  }

  divider(char = '-') {
    return this.line(char.repeat(this.charWidth));
  }

  // Two-column line: left text, right text, padded to charWidth
  twoCol(left, right) {
    const l = String(left || '');
    const r = String(right || '');
    const pad = this.charWidth - l.length - r.length;
    const spaces = pad > 0 ? ' '.repeat(pad) : ' ';
    return this.line(l + spaces + r);
  }

  // Centered text, padded
  centeredLine(str) {
    const s = String(str || '');
    const pad = Math.max(0, Math.floor((this.charWidth - s.length) / 2));
    return this.line(' '.repeat(pad) + s);
  }

  toBytes() {
    return new Uint8Array(this.bytes);
  }
}

// ─── Receipt templates ────────────────────────────────────────────────────────
export function buildCustomerReceipt({ location, check, items, totals }) {
  const w = 42;
  const b = new EscPosBuilder(w);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  b.init()
   .center().bold(true).doubleBoth()
   .text(location?.name || 'Restaurant').lf()
   .normal()
   .center()
   .line(location?.address || '')
   .lf()
   .divider()
   .left()
   .twoCol(`Ref: ${check?.ref || ''}`, `${dateStr} ${timeStr}`)
   .twoCol(`Server: ${check?.server || ''}`, check?.covers > 1 ? `${check.covers} covers` : '')
   .twoCol(`Table: ${check?.tableLabel || check?.orderType || ''}`, '')
   .divider()
   .bold(true).line('ITEMS').bold(false);

  items.filter(i => !i.voided).forEach(item => {
    const linePrice = `£${(item.price * item.qty).toFixed(2)}`;
    const nameStr = item.qty > 1 ? `${item.qty}x ${item.name}` : item.name;
    b.twoCol(nameStr.substring(0, w - linePrice.length - 1), linePrice);
    if (item.mods?.length) {
      item.mods.forEach(m => b.fontB().line(`  ${m.label}`).fontA());
    }
    if (item.notes) b.fontB().line(`  Note: ${item.notes}`).fontA();
    if (item.discount) b.fontB().line(`  Discount: ${item.discount.label}`).fontA();
  });

  b.divider();

  if (totals.subtotal !== totals.total) {
    b.twoCol('Subtotal', `£${totals.subtotal.toFixed(2)}`);
  }
  if (totals.service > 0) {
    b.twoCol('Service charge (12.5%)', `£${totals.service.toFixed(2)}`);
  }
  if (totals.tip > 0) {
    b.twoCol('Tip', `£${totals.tip.toFixed(2)}`);
  }

  b.bold(true).doubleBoth()
   .twoCol('TOTAL', `£${totals.grand.toFixed(2)}`)
   .normal();

  if (check?.method) {
    b.divider()
     .twoCol('Payment', check.method.toUpperCase())
     .twoCol('Status', 'PAID');
  }

  b.lf()
   .center()
   .line(location?.receiptFooter || 'Thank you for dining with us!')
   .lf()
   .fontB().line('Powered by Restaurant OS').fontA()
   .lf(4)
   .cut();

  return b.toBytes();
}

export function buildKitchenTicket({ table, server, covers, course, centreId, centreName, items, sentAt }) {
  const w = 42;
  const b = new EscPosBuilder(w);
  const time = new Date(sentAt || Date.now());
  const timeStr = time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  b.init()
   .center().bold(true).doubleBoth()
   .text(centreName || 'Kitchen').lf()
   .normal().center()
   .line(`${timeStr}`)
   .divider('=')
   .left().bold(true).doubleBoth();

  // Table / order header
  if (table) {
    b.centeredLine(`TABLE ${table}`);
  } else {
    b.centeredLine('WALK-IN');
  }

  b.normal();

  if (server) b.fontB().line(`Server: ${server}`).fontA();
  if (covers > 1) b.fontB().line(`Covers: ${covers}`).fontA();
  if (course) b.fontB().bold(true).line(`COURSE ${course}`).bold(false).fontA();

  b.divider().bold(true).lf();

  items.forEach(item => {
    // Item name large
    b.doubleBoth();
    const qty = item.qty > 1 ? `${item.qty}x ` : '';
    b.text(qty + item.name.toUpperCase().substring(0, 18)).lf();
    b.normal();

    // Seat
    if (item.seat) b.fontB().line(`  Seat ${item.seat}`).fontA();

    // Mods
    if (item.mods?.length) {
      item.mods.forEach(m => b.bold(true).line(`  >> ${m.label}`).bold(false));
    }

    // Notes — underlined
    if (item.notes) {
      b.underline(true).bold(true).line(`  !! ${item.notes}`).bold(false).underline(false);
    }

    b.lf();
  });

  b.divider('=').lf(3).cut();

  return b.toBytes();
}

// ─── Transports ───────────────────────────────────────────────────────────────

// 1. WiFi Bridge — HTTP POST to local bridge, works on ALL devices incl iOS
async function transportWifiBridge(bytes, bridgeUrl) {
  const res = await fetch(bridgeUrl + '/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Bridge error: ${res.status}`);
  return true;
}

// 2. Web Bluetooth (Chrome/Android only — NOT iOS)
let _btDevice = null;
let _btChar   = null;

async function transportBluetooth(bytes) {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported');

  if (!_btDevice || !_btDevice.gatt.connected) {
    _btDevice = await navigator.bluetooth.requestDevice({
      filters: [
        { namePrefix: 'SUNMI' },
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // ESC/POS BLE service
      ],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
    });
    const server  = await _btDevice.gatt.connect();
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    _btChar = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
  }

  // Send in 512-byte chunks (BLE MTU)
  const CHUNK = 512;
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    const chunk = bytes.slice(offset, offset + CHUNK);
    await _btChar.writeValueWithoutResponse(chunk);
    await new Promise(r => setTimeout(r, 20)); // small delay between chunks
  }
  return true;
}

// 3. Sunmi native JS bridge (runs on Sunmi Android devices)
async function transportSunmiNative(bytes) {
  const bridge = window.SunmiPrint || window.sunmi?.printerService;
  if (!bridge) throw new Error('Sunmi native bridge not available');
  // Convert to base64 for the bridge
  const b64 = btoa(String.fromCharCode(...bytes));
  await new Promise((res, rej) => {
    bridge.printRawBase64(b64, () => res(), (err) => rej(new Error(err)));
  });
  return true;
}

// 4. Browser window.print() fallback — always works, no ESC/POS
function transportBrowserPrint(htmlContent) {
  const w = window.open('', '_blank', 'width=400,height=600');
  w.document.write(`
    <html><head>
    <style>
      body { font-family: monospace; font-size: 12px; width: 72mm; margin: 0; padding: 4mm; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .big { font-size: 16px; }
      .divider { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; }
      @media print { @page { margin: 0; size: 80mm auto; } }
    </style>
    </head><body>${htmlContent}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>
  `);
  w.document.close();
  return true;
}

// ─── Print Service ─────────────────────────────────────────────────────────────
class PrintService {
  constructor() {
    this.config = this._loadConfig();
  }

  _loadConfig() {
    try {
      return JSON.parse(localStorage.getItem('rpos-printer-config') || 'null') || {
        transport: 'bridge',     // bridge | bluetooth | sunmi | browser
        bridgeUrl: 'http://localhost:3001',
        printerIp: '',
        printerPort: 9100,
        charWidth: 42,
        autoCut: true,
        cashDrawer: false,
      };
    } catch { return { transport: 'bridge', bridgeUrl: 'http://localhost:3001', charWidth: 42, autoCut: true, cashDrawer: false }; }
  }

  saveConfig(config) {
    this.config = { ...this.config, ...config };
    localStorage.setItem('rpos-printer-config', JSON.stringify(this.config));
  }

  getConfig() { return this.config; }

  // Auto-detect best available transport
  async detectTransport() {
    if (window.SunmiPrint || window.sunmi?.printerService) return 'sunmi';
    if (navigator.bluetooth) return 'bluetooth';
    return 'bridge';
  }

  // Test connection to bridge
  async testBridge(url) {
    const target = url || this.config.bridgeUrl;
    const res = await fetch(target + '/status', { method: 'GET', signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data;
  }

  // Core send — tries configured transport, falls back
  async send(bytes, options = {}) {
    const { transport = this.config.transport, fallback = true, htmlFallback = null } = options;

    const tryTransport = async (t) => {
      switch (t) {
        case 'bridge':    return await transportWifiBridge(bytes, this.config.bridgeUrl);
        case 'bluetooth': return await transportBluetooth(bytes);
        case 'sunmi':     return await transportSunmiNative(bytes);
        case 'browser':   return transportBrowserPrint(htmlFallback || '<p>Print job</p>');
        default: throw new Error(`Unknown transport: ${t}`);
      }
    };

    // Try primary transport
    try {
      await tryTransport(transport);
      return { ok: true, transport };
    } catch (err) {
      if (!fallback) throw err;
      console.warn(`[PrintService] ${transport} failed: ${err.message}, falling back`);
    }

    // Try browser print as final fallback
    if (htmlFallback && transport !== 'browser') {
      try {
        transportBrowserPrint(htmlFallback);
        return { ok: true, transport: 'browser', degraded: true };
      } catch (err2) {}
    }

    throw new Error('All print transports failed');
  }

  // ── High-level print methods ────────────────────────────────────────────────

  async printReceipt({ location, check, items, totals }) {
    const bytes = buildCustomerReceipt({ location, check, items, totals });
    const html  = buildReceiptHtml({ location, check, items, totals });
    return this.send(bytes, { htmlFallback: html });
  }

  async printKitchenTicket(ticketData) {
    const bytes = buildKitchenTicket(ticketData);
    const html  = buildKitchenHtml(ticketData);
    return this.send(bytes, { htmlFallback: html });
  }

  async openCashDrawer() {
    const b = new EscPosBuilder();
    b.init().cashDrawer();
    return this.send(b.toBytes(), { fallback: false });
  }

  async printTestPage() {
    const b = new EscPosBuilder(42);
    b.init()
     .center().bold(true).doubleBoth().text('RESTAURANT OS').lf()
     .normal().center().line('Print test page').divider()
     .left().bold(true).line('Text styles:').bold(false)
     .line('Normal text (Font A)')
     .bold(true).line('Bold text').bold(false)
     .doubleBoth().line('Large text').normal()
     .fontB().line('Font B condensed').fontA()
     .underline(true).line('Underlined text').underline(false)
     .divider()
     .bold(true).line('Column layout:').bold(false)
     .twoCol('Item name', '£12.50')
     .twoCol('Another item', '£8.75')
     .twoCol('Third item', '£22.00')
     .divider()
     .center().bold(true).line('Connection OK').bold(false)
     .fontB().line(new Date().toLocaleString()).fontA()
     .lf(4).cut();
    return this.send(b.toBytes(), { htmlFallback: '<h2>Test OK</h2>' });
  }
}

// ─── HTML fallback builders ───────────────────────────────────────────────────
function buildReceiptHtml({ location, check, items, totals }) {
  const now = new Date();
  const rows = items.filter(i => !i.voided).map(item => `
    <div class="row">
      <span>${item.qty > 1 ? `${item.qty}× ` : ''}${item.name}</span>
      <span>£${(item.price * item.qty).toFixed(2)}</span>
    </div>
    ${item.mods?.map(m => `<div style="padding-left:8px;font-size:10px">${m.label}</div>`).join('') || ''}
  `).join('');

  return `
    <div class="center bold big">${location?.name || 'Restaurant'}</div>
    <div class="center">${location?.address || ''}</div>
    <div class="divider"></div>
    <div class="row"><span>${check?.ref}</span><span>${now.toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'})}</span></div>
    <div class="row"><span>Server: ${check?.server}</span><span>${check?.tableLabel || check?.orderType}</span></div>
    <div class="divider"></div>
    ${rows}
    <div class="divider"></div>
    ${totals.service > 0 ? `<div class="row"><span>Subtotal</span><span>£${totals.subtotal?.toFixed(2)}</span></div>` : ''}
    ${totals.service > 0 ? `<div class="row"><span>Service (12.5%)</span><span>£${totals.service?.toFixed(2)}</span></div>` : ''}
    ${totals.tip > 0 ? `<div class="row"><span>Tip</span><span>£${totals.tip?.toFixed(2)}</span></div>` : ''}
    <div class="row bold big"><span>TOTAL</span><span>£${totals.grand?.toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="center">${location?.receiptFooter || 'Thank you for dining with us!'}</div>
  `;
}

function buildKitchenHtml({ table, server, covers, course, centreName, items, sentAt }) {
  const time = new Date(sentAt || Date.now()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const rows = items.map(item => `
    <div class="bold big">${item.qty > 1 ? `${item.qty}× ` : ''}${item.name}</div>
    ${item.seat ? `<div>Seat ${item.seat}</div>` : ''}
    ${item.mods?.map(m => `<div>» ${m.label}</div>`).join('') || ''}
    ${item.notes ? `<div class="bold">!! ${item.notes}</div>` : ''}
    <br/>
  `).join('');

  return `
    <div class="center bold big">${centreName || 'Kitchen'}</div>
    <div class="center">${time}</div>
    <div class="divider"></div>
    <div class="center bold big">${table ? `TABLE ${table}` : 'WALK-IN'}</div>
    ${server ? `<div>Server: ${server}</div>` : ''}
    ${covers > 1 ? `<div>Covers: ${covers}</div>` : ''}
    ${course ? `<div class="bold">COURSE ${course}</div>` : ''}
    <div class="divider"></div>
    ${rows}
    <div class="divider"></div>
  `;
}

// ─── Singleton export ─────────────────────────────────────────────────────────
export const printService = new PrintService();
export { EscPosBuilder, buildReceiptHtml, buildKitchenHtml };
