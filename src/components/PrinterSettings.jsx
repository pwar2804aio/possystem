import { useState } from 'react';
import { printService } from '../lib/printer';

export default function PrinterSettings() {
  const [config, setConfig] = useState(printService.getConfig?.() || { autoCut:true, cashDrawer:false, charWidth:42 });

  const save = (patch) => {
    const next = { ...config, ...patch };
    setConfig(next);
    try { localStorage.setItem('rpos-printer-config', JSON.stringify(next)); } catch {}
  };

  return (
    <div style={{ maxWidth:520 }}>
      <div style={{ fontSize:16, fontWeight:700, color:'var(--t1)', marginBottom:4 }}>Printer settings</div>
      <div style={{ fontSize:12, color:'var(--t3)', marginBottom:20, lineHeight:1.7 }}>
        Printing uses a Supabase queue — no HTTP bridge or port forwarding needed.<br/>
        Run <code style={{ background:'var(--bg3)', padding:'1px 6px', borderRadius:4, fontFamily:'DM Mono,monospace' }}>node print-agent.js</code> on any machine on the same LAN as your printer.
      </div>

      <div style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:14, padding:'14px 16px', marginBottom:16 }}>
        {[
          { key:'autoCut',    label:'Auto cut',        desc:'Cut paper after each print job' },
          { key:'cashDrawer', label:'Open cash drawer', desc:'Trigger drawer on cash payment' },
        ].map(opt=>(
          <div key={opt.key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:10, marginBottom:10, borderBottom:'1px solid var(--bdr)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--t1)' }}>{opt.label}</div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>{opt.desc}</div>
            </div>
            <div onClick={()=>save({[opt.key]:!config[opt.key]})} style={{ width:42, height:24, borderRadius:12, cursor:'pointer', position:'relative', background:config[opt.key]?'var(--acc)':'var(--bg4)', border:`1px solid ${config[opt.key]?'var(--acc)':'var(--bdr2)'}`, transition:'all .2s' }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:config[opt.key]?20:2, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}/>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div><div style={{ fontSize:13, fontWeight:500, color:'var(--t1)' }}>Paper width</div><div style={{ fontSize:11, color:'var(--t3)' }}>NT311 uses 80mm</div></div>
          <div style={{ display:'flex', gap:4 }}>
            {[[42,'80mm'],[30,'58mm']].map(([w,l])=>(
              <button key={w} onClick={()=>save({charWidth:w})} style={{ padding:'4px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:config.charWidth===w?'var(--acc-d)':'var(--bg4)', border:`1px solid ${config.charWidth===w?'var(--acc-b)':'var(--bdr2)'}`, color:config.charWidth===w?'var(--acc)':'var(--t3)', fontSize:12, fontWeight:600 }}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
