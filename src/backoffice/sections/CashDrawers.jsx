import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { supabase, isMock, getLocationId } from '../../lib/supabase';

/**
 * Cash Drawers registry (v4.6.35).
 *
 * First-class drawer entity. Each drawer has:
 *   - a name (e.g. "Bar", "Counter 1")
 *   - a printer that physically ejects it (ESC p pulse)
 *   - (optionally) a POS device assigned — strict 1:1, so only that device
 *     can ring cash into the drawer
 *
 * Legacy "cashDrawerAttached" flag on printers is the pre-4.6.35 mechanism.
 * We leave it alone so restaurants who haven't migrated still work; on first
 * use of v4.6.35, a synthetic Drawer 1 is created bound to the flagged printer.
 */
const EMPTY = { id: '', name: '', printerId: '', deviceId: '' };

const STATUS_META = {
  idle:     { label: 'Idle',     color: 'var(--t3)',      bg: 'var(--bg3)' },
  open:     { label: 'Open',     color: 'var(--grn)',     bg: 'var(--grn-d)' },
  counting: { label: 'Counting', color: 'var(--amb,#e8a020)', bg: 'rgba(232,160,32,.12)' },
};

export default function CashDrawers() {
  const cashDrawers  = useStore(s => s.cashDrawers) || [];
  const printers     = useStore(s => s.printers)    || [];
  const deviceProfiles = useStore(s => s.deviceProfiles) || [];
  const createCashDrawer = useStore(s => s.createCashDrawer);
  const updateCashDrawer = useStore(s => s.updateCashDrawer);
  const deleteCashDrawer = useStore(s => s.deleteCashDrawer);
  const loadCashDrawers  = useStore(s => s.loadCashDrawers);

  const [selId, setSelId]   = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [isNew, setIsNew]   = useState(false);

  useEffect(() => {
    loadCashDrawers?.();
  }, [loadCashDrawers]);

  const sel = useMemo(() => cashDrawers.find(d => d.id === selId) || null, [cashDrawers, selId]);

  const startNew = () => {
    setForm({ ...EMPTY, id: `drw-${Date.now()}`, name: `Drawer ${cashDrawers.length + 1}` });
    setSelId(null);
    setIsNew(true);
  };

  const startEdit = (d) => {
    setForm({ id: d.id, name: d.name, printerId: d.printerId || '', deviceId: d.deviceId || '' });
    setSelId(d.id);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (isNew) {
      await createCashDrawer?.({ ...form, name: form.name.trim() });
    } else {
      await updateCashDrawer?.(form.id, { name: form.name.trim(), printerId: form.printerId || null, deviceId: form.deviceId || null });
    }
    setSelId(form.id);
    setIsNew(false);
    loadCashDrawers?.();
  };

  const handleDelete = async () => {
    if (!sel) return;
    if (!confirm(`Delete drawer "${sel.name}"? This doesn't delete movement history, but unassigns the drawer from any device or printer.`)) return;
    await deleteCashDrawer?.(sel.id);
    setSelId(null);
    setIsNew(false);
    loadCashDrawers?.();
  };

  // Which devices + printers are already taken so we can warn on reassign
  const takenDevices = new Set(cashDrawers.filter(d => d.id !== form.id && d.deviceId).map(d => d.deviceId));
  const takenPrinters = new Set(); // printers can be shared across drawers (unusual but allowed)

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left: list of drawers */}
      <div style={{ width:320, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', flexShrink:0, background:'var(--bg1)' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)' }}>Cash drawers</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{cashDrawers.length} configured</div>
          </div>
          <button onClick={startNew}
            style={{ padding:'7px 12px', borderRadius:8, background:'var(--acc)', border:'none', color:'#fff', fontWeight:700, fontFamily:'inherit', cursor:'pointer', fontSize:12 }}>
            + Add
          </button>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          {cashDrawers.length === 0 && !isNew && (
            <div style={{ padding:'28px 20px', textAlign:'center', color:'var(--t4)' }}>
              <div style={{ fontSize:30, marginBottom:8, opacity:.35 }}>💰</div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--t3)' }}>No drawers yet</div>
              <div style={{ fontSize:11, marginTop:4, lineHeight:1.4 }}>Click + Add to define your first cash drawer, then bind it to a printer and a POS device.</div>
            </div>
          )}
          {cashDrawers.map(d => {
            const active = selId === d.id;
            const status = STATUS_META[d.status || 'idle'];
            const printer = printers.find(p => p.id === d.printerId);
            return (
              <div key={d.id} onClick={() => startEdit(d)}
                style={{
                  padding:'12px 16px', borderBottom:'1px solid var(--bdr)', cursor:'pointer',
                  background: active ? 'var(--acc-d)' : 'transparent',
                  borderLeft: active ? '3px solid var(--acc)' : '3px solid transparent',
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{d.name}</div>
                  <div style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:status.bg, color:status.color }}>{status.label}</div>
                </div>
                <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.4 }}>
                  {printer ? `🖨  ${printer.name}` : '⚠ no printer'}
                  {d.deviceId ? ` · 📟 ${d.deviceId.slice(0, 12)}` : ' · unassigned'}
                </div>
                {Number(d.currentFloat) !== 0 && (
                  <div style={{ fontSize:11, color:'var(--t4)', marginTop:3, fontFamily:'var(--font-mono)' }}>Float: £{Number(d.currentFloat || 0).toFixed(2)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: edit panel */}
      <div style={{ flex:1, overflowY:'auto', padding:'22px 28px' }}>
        {(!sel && !isNew) ? (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--t4)' }}>
            <div style={{ fontSize:46, marginBottom:10, opacity:.25 }}>💰</div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--t3)' }}>Select a drawer to edit</div>
            <div style={{ fontSize:12, marginTop:4 }}>Or click + Add to create a new one.</div>
          </div>
        ) : (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>
              {isNew ? 'New cash drawer' : sel?.name}
            </div>
            <div style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>
              {isNew ? 'Give this drawer a name, then bind it to a printer that ejects it and (optionally) a POS device that will manage it.'
                     : 'Change assignments or rename. History and current float are preserved.'}
            </div>

            {/* Name */}
            <Field label="Drawer name" hint="Shown on the POS header button and in reports. Keep it short — Bar, Counter, Upstairs.">
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bar drawer"
                style={inputStyle}/>
            </Field>

            {/* Printer */}
            <Field label="Printer (ejects this drawer)" hint="The printer with the physical drawer cable. The ESC p pulse will fire at this printer for every cash sale on this drawer.">
              <select value={form.printerId} onChange={e => setForm(f => ({ ...f, printerId: e.target.value }))}
                style={inputStyle}>
                <option value="">— Select printer —</option>
                {printers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.roles?.includes('receipt') ? '(receipt)' : ''}</option>
                ))}
              </select>
            </Field>

            {/* Device */}
            <Field label="POS device (manages this drawer)" hint="Strict — only this device can ring cash into this drawer. Leave blank to allow assignment at runtime. Each device can only own one drawer.">
              <select value={form.deviceId} onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}
                style={inputStyle}>
                <option value="">— Unassigned (any device) —</option>
                {deviceProfiles.map(dp => {
                  const taken = takenDevices.has(dp.id);
                  return (
                    <option key={dp.id} value={dp.id} disabled={taken}>
                      {dp.name || dp.id}{taken ? ' (already assigned)' : ''}
                    </option>
                  );
                })}
              </select>
            </Field>

            {/* Current state (read-only) */}
            {!isNew && sel && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:10, padding:'12px 14px', marginBottom:20 }}>
                <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Current state</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12 }}>
                  <div>
                    <div style={{ color:'var(--t4)' }}>Status</div>
                    <div style={{ color:'var(--t1)', fontWeight:700, marginTop:2 }}>{(STATUS_META[sel.status] || STATUS_META.idle).label}</div>
                  </div>
                  <div>
                    <div style={{ color:'var(--t4)' }}>Float</div>
                    <div style={{ color:'var(--t1)', fontWeight:700, marginTop:2, fontFamily:'var(--font-mono)' }}>£{Number(sel.currentFloat || 0).toFixed(2)}</div>
                  </div>
                  {sel.openedAt && (
                    <div style={{ gridColumn:'1 / -1' }}>
                      <div style={{ color:'var(--t4)' }}>Opened</div>
                      <div style={{ color:'var(--t1)', marginTop:2 }}>{new Date(sel.openedAt).toLocaleString('en-GB')}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              {!isNew && (
                <button onClick={handleDelete}
                  style={{ padding:'10px 14px', borderRadius:8, background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontWeight:700, fontFamily:'inherit', cursor:'pointer', fontSize:13 }}>
                  Delete
                </button>
              )}
              <div style={{ flex:1 }}/>
              <button onClick={() => { setSelId(null); setIsNew(false); }}
                style={{ padding:'10px 16px', borderRadius:8, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontWeight:600, fontFamily:'inherit', cursor:'pointer', fontSize:13 }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={!form.name.trim()}
                style={{
                  padding:'10px 18px', borderRadius:8, border:'none',
                  background: form.name.trim() ? 'var(--acc)' : 'var(--bg4)',
                  color: form.name.trim() ? '#fff' : 'var(--t4)',
                  fontWeight:700, fontFamily:'inherit', cursor: form.name.trim() ? 'pointer' : 'not-allowed', fontSize:13,
                }}>
                {isNew ? 'Create drawer' : 'Save changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:'1.5px solid var(--bdr)', background:'var(--bg2)', color:'var(--t1)',
  fontFamily:'inherit', fontSize:14,
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:11, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', display:'block', marginBottom:6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--t4)', marginTop:5, lineHeight:1.45 }}>{hint}</div>}
    </div>
  );
}
