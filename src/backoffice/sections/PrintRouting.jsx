import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { PRINTERS, PRODUCTION_CENTRES } from '../../data/seed';
import { isMock, supabase, getLocationId } from '../../lib/supabase';

export default function PrintRouting() {
  const { printJobs, showToast } = useStore();
  const [printers, setPrinters] = useState(isMock ? PRINTERS : []);
  const [kdsDevices, setKdsDevices] = useState([]);
  const [routing, setRouting] = useState(() => {
    const m = {};
    PRODUCTION_CENTRES.forEach(pc => { m[pc.id] = pc.printerId || null; });
    return m;
  });
  const [reassigning, setReassigning] = useState(null);

  useEffect(() => {
    if (isMock) return;
    (async () => {
      const locId = await getLocationId();
      if (!locId) return;
      const { data } = await supabase.from('devices').select('id, name, centre_id, status').eq('location_id', locId).eq('type', 'kds');
      if (data) setKdsDevices(data);
    })();
  }, []);

  const toggle = id => setPrinters(ps => ps.map(p => p.id === id ? { ...p, status: p.status === 'online' ? 'offline' : 'online' } : p));
  const recentJobs = printJobs.slice(0, 20);

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>

      {/* Live job log */}
      {recentJobs.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:12 }}>Recent print jobs</div>
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
            {recentJobs.map((job, i) => (
              <div key={job.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 16px', borderBottom: i < recentJobs.length - 1 ? '1px solid var(--bdr)' : 'none', fontSize:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--grn)', flexShrink:0 }}/>
                <span style={{ fontWeight:600, color:'var(--t1)', minWidth:80 }}>{job.tableLabel}</span>
                <span style={{ color:'var(--t3)', flex:1 }}>{job.printerName}</span>
                <span style={{ color:'var(--t4)', fontFamily:'var(--font-mono)' }}>
                  {new Date(job.sentAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                </span>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)' }}>sent</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production centre routing */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:4 }}>Production centre routing</div>
        <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12 }}>Each production centre routes tickets to one printer. Change assignment at any time.</div>
        {PRODUCTION_CENTRES.map(pc => {
          const assignedId = routing[pc.id];
          const printer = printers.find(p => p.id === assignedId);
          const isOnline = printer?.status === 'online';
          return (
            <div key={pc.id} style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ fontSize:24, flexShrink:0 }}>{pc.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--t1)' }}>{pc.name}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                  {/* KDS device for this centre */}
                  {kdsDevices.filter(k => k.centre_id === pc.id).map(kds => (
                    <span key={kds.id} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)', color:'#818cf8', marginRight:6 }}>
                      📺 {kds.name}
                    </span>
                  ))}
                  {printer ? (
                    <>
                      <div style={{ width:7, height:7, borderRadius:'50%', background: isOnline ? 'var(--grn)' : 'var(--red)', flexShrink:0 }}/>
                      <span style={{ fontSize:12, color:'var(--t3)' }}>→ {printer.name}</span>
                      <span style={{ fontSize:11, color:'var(--t4)', fontFamily:'monospace' }}>{printer.ip}</span>
                    </>
                  ) : (
                    <span style={{ fontSize:12, color:'var(--red)' }}>⚠ No printer assigned</span>
                  )}
                </div>
              </div>
              <button onClick={() => setReassigning(pc.id)} style={{
                padding:'6px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600,
              }}>Reassign</button>
            </div>
          );
        })}
      </div>

      {/* Printers on network */}
      <div>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:12 }}>Printers on network</div>
        {printers.map(p => (
          <div key={p.id} style={{ background:'var(--bg1)', border:`1px solid ${p.status === 'online' ? 'var(--grn-b)' : 'var(--red-b)'}`, borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background: p.status === 'online' ? 'var(--grn)' : 'var(--red)', flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'var(--t3)', fontFamily:'monospace' }}>{p.model} · {p.ip}</div>
              </div>
              <span style={{
                fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20,
                background: p.status === 'online' ? 'var(--grn-d)' : 'var(--red-d)',
                border:`1px solid ${p.status === 'online' ? 'var(--grn-b)' : 'var(--red-b)'}`,
                color: p.status === 'online' ? 'var(--grn)' : 'var(--red)',
              }}>{p.status}</span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => showToast(`Test print sent to ${p.name}`, 'info')}>🖨 Test print</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggle(p.id)}>{p.status === 'online' ? 'Take offline' : 'Bring online'}</button>
            </div>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ marginTop:8 }} onClick={() => showToast('Scanning for Sunmi NT311 printers…', 'info')}>+ Scan for printers</button>
      </div>

      {/* Reassign modal */}
      {reassigning && (
        <div className="modal-back" onClick={e => e.target === e.currentTarget && setReassigning(null)}>
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:380, boxShadow:'var(--sh3)', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:15, fontWeight:800 }}>Assign printer — {PRODUCTION_CENTRES.find(pc => pc.id === reassigning)?.name}</div>
              <button onClick={() => setReassigning(null)} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
            </div>
            <div style={{ padding:'16px 20px' }}>
              <div style={{ fontSize:12, color:'var(--t3)', marginBottom:14 }}>Select which printer receives tickets from this station.</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                {printers.map(p => {
                  const selected = routing[reassigning] === p.id;
                  return (
                    <button key={p.id} onClick={() => setRouting(r => ({ ...r, [reassigning]: p.id }))} style={{
                      padding:'12px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                      textAlign:'left', display:'flex', alignItems:'center', gap:12,
                      background: selected ? 'var(--acc-d)' : 'var(--bg3)',
                      border:`1.5px solid ${selected ? 'var(--acc)' : 'var(--bdr)'}`,
                      transition:'all .1s',
                    }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background: p.status === 'online' ? 'var(--grn)' : 'var(--red)', flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color: selected ? 'var(--acc)' : 'var(--t1)' }}>{p.name}</div>
                        <div style={{ fontSize:11, color:'var(--t4)', fontFamily:'monospace' }}>{p.model} · {p.ip}</div>
                      </div>
                      {selected && <span style={{ fontSize:12, fontWeight:800, color:'var(--acc)' }}>✓</span>}
                    </button>
                  );
                })}
                <button onClick={() => setRouting(r => ({ ...r, [reassigning]: null }))} style={{
                  padding:'10px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                  background: !routing[reassigning] ? 'var(--red-d)' : 'var(--bg3)',
                  border:`1.5px solid ${!routing[reassigning] ? 'var(--red)' : 'var(--bdr)'}`,
                  color: !routing[reassigning] ? 'var(--red)' : 'var(--t3)',
                  fontSize:12, fontWeight:600, textAlign:'left',
                }}>No printer (tickets not printed)</button>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setReassigning(null)}>Cancel</button>
                <button className="btn btn-acc" style={{ flex:2, height:40 }} onClick={() => {
                  const p = printers.find(x => x.id === routing[reassigning]);
                  showToast(p ? `${PRODUCTION_CENTRES.find(pc=>pc.id===reassigning)?.name} → ${p.name}` : 'Printer unassigned', 'success');
                  setReassigning(null);
                }}>Save routing</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}