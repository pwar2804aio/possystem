import { useState } from 'react';
import { useStore } from '../../store';
import { PRINTERS, PRODUCTION_CENTRES } from '../../data/seed';

export default function PrintRouting() {
  const { printJobs, showToast } = useStore();
  const [printers, setPrinters] = useState(PRINTERS);
  const toggle = id => setPrinters(ps => ps.map(p => p.id===id ? { ...p, status:p.status==='online'?'offline':'online' } : p));
  const recentJobs = printJobs.slice(0,20);

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      {recentJobs.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:12 }}>Recent print jobs</div>
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
            {recentJobs.map((job,i) => (
              <div key={job.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 16px', borderBottom:i<recentJobs.length-1?'1px solid var(--bdr)':'none', fontSize:12 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--grn)', flexShrink:0 }}/>
                <span style={{ fontWeight:600, color:'var(--t1)', minWidth:80 }}>{job.tableLabel}</span>
                <span style={{ color:'var(--t3)', flex:1 }}>{job.printerName}</span>
                <span style={{ color:'var(--t4)', fontFamily:'var(--font-mono)' }}>{new Date(job.sentAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)' }}>sent</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:12 }}>Production centre routing</div>
        {PRODUCTION_CENTRES.map(pc => {
          const printer = printers.find(p => p.id === pc.printerId);
          return (
            <div key={pc.id} style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:24 }}>{pc.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{pc.name}</div>
                <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>→ {printer?.name || 'No printer assigned'} · {pc.type}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {printer && <div style={{ width:8, height:8, borderRadius:'50%', background:printer.status==='online'?'var(--grn)':'var(--red)' }}/>}
                <button className="btn btn-ghost btn-sm" onClick={() => showToast('Reassign — coming in Phase 2','info')}>Reassign</button>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:12 }}>Printers on network</div>
        {printers.map(p => (
          <div key={p.id} style={{ background:'var(--bg1)', border:`1px solid ${p.status==='online'?'var(--grn-b)':'var(--red-b)'}`, borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:p.status==='online'?'var(--grn)':'var(--red)', flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'var(--t3)', fontFamily:'monospace' }}>{p.model} · {p.ip}</div>
              </div>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:p.status==='online'?'var(--grn-d)':'var(--red-d)', border:`1px solid ${p.status==='online'?'var(--grn-b)':'var(--red-b)'}`, color:p.status==='online'?'var(--grn)':'var(--red)' }}>{p.status}</span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => showToast(`Test print sent to ${p.name}`,'info')}>🖨 Test print</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggle(p.id)}>{p.status==='online'?'Take offline':'Bring online'}</button>
            </div>
          </div>
        ))}
        <button className="btn btn-ghost" style={{ marginTop:8 }} onClick={() => showToast('Scanning for Sunmi NT311 printers…','info')}>+ Scan for printers</button>
      </div>
    </div>
  );
}
