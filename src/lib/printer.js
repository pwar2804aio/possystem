/**
 * PrintService — Supabase-queued ESC/POS printing
 *
 * Architecture:
 *   POS (any device, any platform) → Supabase print_jobs table → print-agent.js (LAN) → TCP 9100 → Printer
 *
 * No HTTP bridge server. No port forwarding. No CORS.
 * The agent runs on any machine on the same LAN as the printer.
 * Only outbound connections needed: agent → Supabase, agent → printer.
 *
 * Fallback: window.print() always available if Supabase is down.
 */

import { supabase, getLocationId } from './supabase';

// ─── ESC/POS builder ──────────────────────────────────────────────────────────
const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

class EscPosBuilder {
  constructor(charWidth = 42) { this.bytes = []; this.charWidth = charWidth; }

  _push(...args) {
    for (const a of args) {
      if (Array.isArray(a)) this.bytes.push(...a);
      else if (typeof a === 'string') { for (let i = 0; i < a.length; i++) this.bytes.push(a.charCodeAt(i) & 0xff); }
      else this.bytes.push(a);
    }
    return this;
  }

  init()             { return this._push([ESC,0x40]); }
  cut()              { return this._push([GS,0x56,0x42,0x00]); }
  cashDrawer()       { return this._push([ESC,0x70,0x00,0x19,0x19]); }
  lf(n=1)            { for(let i=0;i<n;i++) this._push(LF); return this; }
  bold(on=true)      { return this._push([ESC,0x45,on?1:0]); }
  center()           { return this._push([ESC,0x61,0x01]); }
  left()             { return this._push([ESC,0x61,0x00]); }
  doubleHeight()     { return this._push([ESC,0x21,0x10]); }
  doubleBoth()       { return this._push([ESC,0x21,0x30]); }
  normal()           { return this._push([ESC,0x21,0x00],[ESC,0x45,0x00],[ESC,0x61,0x00]); }
  underline(on)      { return this._push([ESC,0x2d,on?1:0]); }
  fontB()            { return this._push([ESC,0x4d,0x01]); }
  fontA()            { return this._push([ESC,0x4d,0x00]); }

  text(str) { return this._push((str||'').replace(/[^\x00-\xff]/g,'?')); }
  line(str='') { return this.text(str).lf(); }
  divider(c='-') { return this.line(c.repeat(this.charWidth)); }

  twoCol(left, right) {
    const l=String(left||''), r=String(right||'');
    const pad=Math.max(1, this.charWidth-l.length-r.length);
    return this.line(l+' '.repeat(pad)+r);
  }

  centeredLine(str) {
    const s=String(str||'');
    const pad=Math.max(0,Math.floor((this.charWidth-s.length)/2));
    return this.line(' '.repeat(pad)+s);
  }

  toBytes() { return new Uint8Array(this.bytes); }
  toBase64() { return btoa(String.fromCharCode(...this.bytes)); }
}

// ─── Receipt templates ────────────────────────────────────────────────────────
export function buildCustomerReceipt({ location, check, items, totals }) {
  const b = new EscPosBuilder(42);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  const dateStr = now.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});

  b.init().center().bold(true).doubleBoth().text(location?.name||'Restaurant').lf()
   .normal().center()
   .line(location?.address||'').lf()
   .divider()
   .left()
   .twoCol(`Ref: ${check?.ref||''}`, `${dateStr} ${timeStr}`)
   .twoCol(`Server: ${check?.server||''}`, check?.covers>1?`${check.covers} covers`:'')
   .twoCol(`${check?.tableLabel||check?.orderType||''}`, '')
   .divider()
   .bold(true).line('ITEMS').bold(false);

  (items||[]).filter(i=>!i.voided).forEach(item=>{
    const linePrice=`\xA3${(item.price*item.qty).toFixed(2)}`;
    const nameStr=item.qty>1?`${item.qty}x ${item.name}`:item.name;
    b.twoCol(nameStr.substring(0,42-linePrice.length-1), linePrice);
    item.mods?.forEach(m=>b.fontB().line(`  ${m.label}`).fontA());
    if(item.notes) b.fontB().line(`  Note: ${item.notes}`).fontA();
  });

  b.divider();
  if(totals.subtotal!==totals.grand) b.twoCol('Subtotal',`\xA3${totals.subtotal.toFixed(2)}`);
  if(totals.service>0) b.twoCol('Service (12.5%)',`\xA3${totals.service.toFixed(2)}`);
  if(totals.tip>0) b.twoCol('Tip',`\xA3${totals.tip.toFixed(2)}`);

  b.bold(true).doubleBoth()
   .twoCol('TOTAL',`\xA3${totals.grand.toFixed(2)}`)
   .normal();

  if(check?.method) b.divider().twoCol('Payment',check.method.toUpperCase()).twoCol('Status','PAID');

  b.lf().center()
   .line(location?.receiptFooter||'Thank you for dining with us!')
   .fontB().line('Powered by Restaurant OS').fontA()
   .lf(4).cut();

  return b.toBytes();
}

export function buildKitchenTicket({ table, server, covers, course, centreName, items, sentAt }) {
  const b = new EscPosBuilder(42);
  const time = new Date(sentAt||Date.now()).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

  b.init().center().bold(true).doubleBoth().text(centreName||'Kitchen').lf()
   .normal().center().line(time).divider('=')
   .left().bold(true).doubleBoth();

  if(table) b.centeredLine(`TABLE ${table}`);
  else b.centeredLine('WALK-IN');

  b.normal();
  if(server) b.fontB().line(`Server: ${server}`).fontA();
  if(covers>1) b.fontB().line(`Covers: ${covers}`).fontA();
  if(course) b.fontB().bold(true).line(`COURSE ${course}`).bold(false).fontA();
  b.divider().bold(true).lf();

  (items||[]).forEach(item=>{
    b.doubleBoth();
    const qty=item.qty>1?`${item.qty}x `:'';
    b.text(qty+item.name.toUpperCase().substring(0,18)).lf();
    b.normal();
    if(item.seat) b.fontB().line(`  Seat ${item.seat}`).fontA();
    item.mods?.forEach(m=>b.bold(true).line(`  >> ${m.label}`).bold(false));
    if(item.notes) b.underline(true).bold(true).line(`  !! ${item.notes}`).bold(false).underline(false);
    b.lf();
  });

  b.divider('=').lf(3).cut();
  return b.toBytes();
}

export function buildTestPage() {
  const b = new EscPosBuilder(42);
  b.init()
   .center().bold(true).doubleBoth().text('RESTAURANT OS').lf()
   .normal().center().line('Print agent connected').divider()
   .left().bold(true).line('ESC/POS test:').bold(false)
   .line('Normal text')
   .bold(true).line('Bold text').bold(false)
   .doubleBoth().line('Large').normal()
   .divider()
   .twoCol('Subtotal', '\xA312.50')
   .twoCol('Service',  '\xA3 1.56')
   .bold(true).doubleBoth().twoCol('TOTAL','\xA314.06').normal()
   .divider()
   .center().bold(true).line('Connection OK \u2713').bold(false)
   .fontB().line(new Date().toLocaleString()).fontA()
   .lf(4).cut();
  return b.toBytes();
}

// ─── HTML fallback builders ───────────────────────────────────────────────────
function buildReceiptHtml({ location, check, items, totals }) {
  const now = new Date();
  const rows = (items||[]).filter(i=>!i.voided).map(item=>`
    <div class="row"><span>${item.qty>1?`${item.qty}\xD7 `:''}${item.name}</span><span>\xA3${(item.price*item.qty).toFixed(2)}</span></div>
    ${item.mods?.map(m=>`<div style="padding-left:8px;font-size:10px">${m.label}</div>`).join('')||''}
  `).join('');
  return `
    <div class="center bold big">${location?.name||'Restaurant'}</div>
    <div class="center">${location?.address||''}</div>
    <div class="divider"></div>
    <div class="row"><span>${check?.ref}</span><span>${now.toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'})}</span></div>
    <div class="row"><span>Server: ${check?.server}</span><span>${check?.tableLabel||check?.orderType}</span></div>
    <div class="divider"></div>${rows}
    <div class="divider"></div>
    ${totals.service>0?`<div class="row"><span>Subtotal</span><span>\xA3${totals.subtotal?.toFixed(2)}</span></div>`:''}
    ${totals.service>0?`<div class="row"><span>Service</span><span>\xA3${totals.service?.toFixed(2)}</span></div>`:''}
    ${totals.tip>0?`<div class="row"><span>Tip</span><span>\xA3${totals.tip?.toFixed(2)}</span></div>`:''}
    <div class="row bold big"><span>TOTAL</span><span>\xA3${totals.grand?.toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="center">${location?.receiptFooter||'Thank you for dining with us!'}</div>
  `;
}

function browserPrint(html) {
  const w = window.open('','_blank','width=400,height=600');
  w.document.write(`<html><head><style>
    body{font-family:monospace;font-size:12px;width:72mm;margin:0;padding:4mm;color:#000;background:#fff}
    .center{text-align:center}.bold{font-weight:bold}.big{font-size:16px}
    .divider{border-top:1px dashed #000;margin:4px 0}.row{display:flex;justify-content:space-between}
    @media print{@page{margin:0;size:80mm auto}}
  </style></head><body>${html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
  w.document.close();
}

// ─── Print Service ────────────────────────────────────────────────────────────
class PrintService {
  constructor() {
    this._printers = this._loadPrinters();
  }

  _loadPrinters() {
    try { return JSON.parse(localStorage.getItem('rpos-printers')||'[]'); } catch { return []; }
  }

  _refreshPrinters() {
    this._printers = this._loadPrinters();
  }

  // Find which printer to use for a given role ('receipt' | 'kitchen' | 'bar')
  _printerForRole(role, printerId = null) {
    this._refreshPrinters();
    if (printerId) return this._printers.find(p => p.id === printerId) || null;
    return this._printers.find(p => p.roles?.includes(role)) || this._printers[0] || null;
  }

  // Submit a job to Supabase — the print agent picks it up instantly via realtime
  async _submitJob(printer, jobType, bytes) {
    if (!supabase) throw new Error('Supabase not connected');

    const locationId = await getLocationId();
    if (!locationId) throw new Error('No location ID');

    const payload = btoa(String.fromCharCode(...bytes));

    const { error, data } = await supabase.from('print_jobs').insert({
      location_id: locationId,
      printer_id:  printer.id,
      printer_ip:  printer.address,
      printer_port: printer.port || 9100,
      job_type:    jobType,
      payload,
      status:      'pending',
    }).select('id');

    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
    // Return jobId so callers can watch the job's outcome
    return { ok: true, transport: 'supabase', printer: printer.name, jobId: data?.[0]?.id };
  }

  // Public API
  async printReceipt({ location, check, items, totals }, printerId = null) {
    const printer = this._printerForRole('receipt', printerId);
    if (printer?.address) {
      const bytes = buildCustomerReceipt({ location, check, items, totals });
      return this._submitJob(printer, 'receipt', bytes);
    }
    // Fallback: browser print
    browserPrint(buildReceiptHtml({ location, check, items, totals }));
    return { ok: true, transport: 'browser' };
  }

  async printKitchenTicket(ticketData, printerId = null) {
    const printer = this._printerForRole('kitchen', printerId);
    if (printer?.address) {
      const bytes = buildKitchenTicket(ticketData);
      return this._submitJob(printer, 'kitchen', bytes);
    }
    return { ok: false, error: 'No kitchen printer configured' };
  }

  async printTestPage(printer) {
    if (!printer?.address) throw new Error('No printer address');
    const bytes = buildTestPage();
    return this._submitJob(printer, 'test', bytes);
  }

  async openCashDrawer(printerId = null) {
    const printer = this._printerForRole('receipt', printerId);
    if (!printer?.address) throw new Error('No printer configured');
    const b = new EscPosBuilder();
    b.init().cashDrawer();
    return this._submitJob(printer, 'cash_drawer', b.toBytes());
  }

  // Watch a job's status in Supabase (for feedback in the UI)
  watchJob(jobId, onUpdate) {
    if (!supabase) return () => {};
    const channel = supabase
      .channel(`job-${jobId}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'print_jobs', filter:`id=eq.${jobId}` },
        payload => onUpdate(payload.new))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }
}

export const printService = new PrintService();
export { EscPosBuilder };
