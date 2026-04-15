import { useState, useEffect } from 'react';
import { supabase, isMock, getLocationId } from '../../lib/supabase';
import { printService } from '../../lib/printer';

const MODELS = [
  { id:'sunmi-nt311', label:'Sunmi NT311', icon:'🖨', desc:'80mm cloud printer — WiFi/LAN/BT/USB' },
  { id:'sunmi-nt310', label:'Sunmi NT310', icon:'🖨', desc:'58mm cloud printer — WiFi/LAN/BT' },
  { id:'epson-tm88',  label:'Epson TM-T88', icon:'🖨', desc:'80mm receipt printer — USB/LAN/BT' },
  { id:'epson-tm20',  label:'Epson TM-T20', icon:'🖨', desc:'80mm receipt printer — USB/LAN' },
  { id:'star-tsp100', label:'Star TSP100', icon:'🖨', desc:'80mm receipt printer — USB/LAN/BT' },
  { id:'generic',     label:'Generic ESC/POS', icon:'🖨', desc:'Any ESC/POS compatible printer' },
];

const CONN_TYPES = [
  { id:'network', label:'WiFi / Ethernet', icon:'🌐', placeholder:'192.168.1.100' },
  { id:'bluetooth', label:'Bluetooth', icon:'🔵', placeholder:'e.g. AA:BB:CC:DD:EE:FF' },
  { id:'usb', label:'USB', icon:'🔌', placeholder:'Auto-detected' },
];

const ROLES = [
  { id:'receipt',    label:'Customer receipts', icon:'🧾' },
  { id:'kitchen',    label:'Kitchen / production', icon:'🍽' },
  { id:'bar',        label:'Bar tickets', icon:'🍸' },
  { id:'label',      label:'Label printer', icon:'🏷' },
  { id:'general',    label:'General purpose', icon:'🖨' },
];

const PAPER = [
  { id:80, label:'80mm' },
  { id:58, label:'58mm' },
];

const EMPTY = { name:'', model:'sunmi-nt311', connectionType:'network', address:'', paperWidth:80, roles:['receipt'], location:'' };

function loadPrinters() {
  try { return JSON.parse(localStorage.getItem('rpos-printers') || '[]'); } catch { return []; }
}
function savePrinters(list) {
  localStorage.setItem('rpos-printers', JSON.stringify(list));
  // Fire a storage event so other components (PrintRouting, DeviceRegistry) pick it up
  window.dispatchEvent(new Event('rpos-printers-updated'));
}

const S = {
  page: { padding:'32px 40px', maxWidth:900 },
  h1: { fontSize:22, fontWeight:800, marginBottom:4, color:'var(--t1)' },
  sub: { fontSize:13, color:'var(--t3)', marginBottom:32 },
  card: { background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:22, marginBottom:14 },
  label: { fontSize:12, fontWeight:600, color:'var(--t3)', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.04em' },
  input: { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg)', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 },
  btn: { padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' },
};

function statusDot(status) {
  const c = status === 'online' ? 'var(--grn)' : status === 'offline' ? 'var(--red)' : 'var(--t4)';
  return <div style={{ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }}/>;
}

function PrinterForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const model = MODELS.find(m => m.id === form.model) || MODELS[0];
  const conn  = CONN_TYPES.find(c => c.id === form.connectionType) || CONN_TYPES[0];

  const toggleRole = (rid) => {
    f('roles', form.roles?.includes(rid) ? form.roles.filter(r => r !== rid) : [...(form.roles || []), rid]);
  };

  return (
    <div style={S.card}>
      <div style={{ fontSize:15, fontWeight:700, color:'var(--t1)', marginBottom:18 }}>
        {initial?.id ? 'Edit printer' : 'Add printer'}
      </div>

      <div style={S.row}>
        <div>
          <label style={S.label}>Printer name *</label>
          <input style={S.input} value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Kitchen Printer, Bar Receipt"/>
        </div>
        <div>
          <label style={S.label}>Location / area</label>
          <input style={S.input} value={form.location} onChange={e=>f('location',e.target.value)} placeholder="e.g. Main kitchen, Bar"/>
        </div>
      </div>

      {/* Model picker */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Printer model</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {MODELS.map(m => (
            <button key={m.id} onClick={() => f('model', m.id)} style={{
              padding:'7px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
              background: form.model === m.id ? 'var(--acc-d)' : 'var(--bg3)',
              border: `1.5px solid ${form.model === m.id ? 'var(--acc)' : 'var(--bdr)'}`,
              color: form.model === m.id ? 'var(--acc)' : 'var(--t2)',
            }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, color:'var(--t3)', marginTop:5 }}>{model.desc}</div>
      </div>

      {/* Connection type */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Connection</label>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {CONN_TYPES.map(c => (
            <button key={c.id} onClick={() => f('connectionType', c.id)} style={{
              padding:'7px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
              background: form.connectionType === c.id ? 'var(--acc-d)' : 'var(--bg3)',
              border: `1.5px solid ${form.connectionType === c.id ? 'var(--acc)' : 'var(--bdr)'}`,
              color: form.connectionType === c.id ? 'var(--acc)' : 'var(--t2)',
            }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {form.connectionType !== 'usb' && (
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>{form.connectionType === 'bluetooth' ? 'Bluetooth address' : 'IP address'}</label>
            <input style={S.input} value={form.address} onChange={e=>f('address',e.target.value)} placeholder={conn.placeholder}/>
            {form.connectionType === 'network' && (
              <div style={{ fontSize:11, color:'var(--t4)', marginTop:4 }}>Standard ESC/POS port 9100 is used automatically</div>
            )}
          </div>
        )}
      </div>

      {/* Paper width */}
      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Paper width</label>
        <div style={{ display:'flex', gap:6 }}>
          {PAPER.map(p => (
            <button key={p.id} onClick={() => f('paperWidth', p.id)} style={{
              padding:'7px 16px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
              background: form.paperWidth === p.id ? 'var(--acc-d)' : 'var(--bg3)',
              border: `1.5px solid ${form.paperWidth === p.id ? 'var(--acc)' : 'var(--bdr)'}`,
              color: form.paperWidth === p.id ? 'var(--acc)' : 'var(--t2)',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div style={{ marginBottom:20 }}>
        <label style={S.label}>Used for</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {ROLES.map(r => {
            const on = form.roles?.includes(r.id);
            return (
              <button key={r.id} onClick={() => toggleRole(r.id)} style={{
                padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600,
                background: on ? 'var(--acc-d)' : 'var(--bg3)',
                border: `1.5px solid ${on ? 'var(--acc)' : 'var(--bdr)'}`,
                color: on ? 'var(--acc)' : 'var(--t3)',
              }}>{r.icon} {r.label}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onCancel} style={{ ...S.btn, background:'var(--bg3)', color:'var(--t2)', border:'1px solid var(--bdr)' }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={!form.name.trim()} style={{ ...S.btn, background: form.name.trim() ? 'var(--acc)' : 'var(--bg4)', color: form.name.trim() ? '#fff' : 'var(--t4)', opacity: form.name.trim() ? 1 : .5 }}>
          {initial?.id ? 'Save changes' : 'Add printer'}
        </button>
      </div>
    </div>
  );
}

export default function PrinterRegistry() {
  const [printers, setPrinters] = useState(loadPrinters);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [testing, setTesting] = useState({});
  const [testResult, setTestResult] = useState({});

  const persist = (list) => { setPrinters(list); savePrinters(list); };

  const handleSave = (form) => {
    if (form.id) {
      persist(printers.map(p => p.id === form.id ? { ...form, port: 9100 } : p));
    } else {
      persist([...printers, { ...form, port: 9100, id: `prn-${Date.now()}`, status: 'unknown', addedAt: Date.now() }]);
    }
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = (id) => {
    if (!confirm('Remove this printer?')) return;
    persist(printers.filter(p => p.id !== id));
  };

  const handleTest = async (printer) => {
    setTesting(t => ({ ...t, [printer.id]: true }));
    setTestResult(r => ({ ...r, [printer.id]: null }));
    try {
      await printService.printTestPage(printer);
      persist(printers.map(p => p.id === printer.id ? { ...p, status: 'online', lastSeen: Date.now() } : p));
      setTestResult(r => ({ ...r, [printer.id]: 'online' }));
    } catch (err) {
      persist(printers.map(p => p.id === printer.id ? { ...p, status: 'offline' } : p));
      setTestResult(r => ({ ...r, [printer.id]: 'error' }));
    }
    setTesting(t => ({ ...t, [printer.id]: false }));
  };

  const editing = editId ? printers.find(p => p.id === editId) : null;

  return (
    <div style={S.page}>
      <div style={S.h1}>Printers</div>
      <div style={S.sub}>Add and manage physical printers — then assign them to production centres and devices</div>

      {/* Printer list */}
      {printers.length === 0 && !showForm && (
        <div style={{ background:'var(--bg1)', border:'1px dashed var(--bdr2)', borderRadius:16, padding:'48px 32px', textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🖨</div>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--t2)', marginBottom:6 }}>No printers added yet</div>
          <div style={{ fontSize:13, color:'var(--t3)', marginBottom:20, lineHeight:1.7 }}>
            Add your Sunmi NT311 or other ESC/POS printers here.<br/>
            Once added, you can assign them to production centres and devices.
          </div>
          <button onClick={() => setShowForm(true)} style={{ ...S.btn, background:'var(--acc)', color:'#fff', padding:'10px 24px' }}>+ Add first printer</button>
        </div>
      )}

      {printers.map(printer => {
        const model = MODELS.find(m => m.id === printer.model) || MODELS[0];
        const conn  = CONN_TYPES.find(c => c.id === printer.connectionType) || CONN_TYPES[0];
        const isEditing = editId === printer.id;
        const result = testResult[printer.id];

        if (isEditing) {
          return <PrinterForm key={printer.id} initial={printer} onSave={handleSave} onCancel={() => setEditId(null)}/>;
        }

        return (
          <div key={printer.id} style={S.card}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🖨</div>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:3 }}>
                    {statusDot(printer.status)}
                    <span style={{ fontSize:15, fontWeight:700, color:'var(--t1)' }}>{printer.name}</span>
                    {printer.location && <span style={{ fontSize:11, color:'var(--t3)', padding:'2px 8px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--bdr)' }}>{printer.location}</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--t3)', lineHeight:1.8 }}>
                    <span>{model.label}</span>
                    <span style={{ margin:'0 6px', opacity:.4 }}>·</span>
                    <span>{conn.icon} {printer.address || 'USB'}{printer.connectionType === 'network' && printer.port !== 9100 ? `:${printer.port}` : ''}</span>
                    <span style={{ margin:'0 6px', opacity:.4 }}>·</span>
                    <span>{printer.paperWidth || 80}mm</span>
                  </div>
                  {printer.roles?.length > 0 && (
                    <div style={{ display:'flex', gap:4, marginTop:5 }}>
                      {printer.roles.map(rid => {
                        const r = ROLES.find(x => x.id === rid);
                        return r ? <span key={rid} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--acc-d)', color:'var(--acc)', border:'1px solid var(--acc-b)', fontWeight:600 }}>{r.icon} {r.label}</span> : null;
                      })}
                    </div>
                  )}
                  {result && (
                    <div style={{ fontSize:11, marginTop:5, color: result === 'online' ? 'var(--grn)' : 'var(--red)', fontWeight:600 }}>
                      {result === 'online' ? '✓ Test job queued — check printer for output' : '✗ Failed to queue job — is the agent running?'}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={() => handleTest(printer)} disabled={testing[printer.id] || printer.connectionType === 'usb'} style={{ ...S.btn, background:'var(--bg3)', color:'var(--t2)', border:'1px solid var(--bdr)', fontSize:12 }}>
                  {testing[printer.id] ? '…' : '🖨 Test'}
                </button>
                <button onClick={() => setEditId(printer.id)} style={{ ...S.btn, background:'var(--bg3)', color:'var(--t2)', border:'1px solid var(--bdr)', fontSize:12 }}>Edit</button>
                <button onClick={() => handleDelete(printer.id)} style={{ ...S.btn, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)', fontSize:12 }}>Remove</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add form */}
      {showForm && !editId && (
        <PrinterForm onSave={handleSave} onCancel={() => setShowForm(false)}/>
      )}

      {/* Add button */}
      {!showForm && !editId && printers.length > 0 && (
        <button onClick={() => setShowForm(true)} style={{ ...S.btn, background:'var(--acc)', color:'#fff', padding:'10px 20px', marginTop:4 }}>+ Add printer</button>
      )}

      {/* Info banner */}
      {printers.length > 0 && (
        <div style={{ marginTop:24, background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 18px', fontSize:12, color:'var(--t3)', lineHeight:1.8 }}>
          <strong style={{ color:'var(--t2)' }}>Next steps:</strong> Go to <strong style={{ color:'var(--t2)' }}>Production printing</strong> to assign these printers to kitchen and bar production centres, or go to <strong style={{ color:'var(--t2)' }}>Devices</strong> to assign a receipt printer to a specific terminal.
        </div>
      )}
    </div>
  );
}

// Helper exported so other sections can read printers
export { loadPrinters, savePrinters };
