import { useState } from 'react';
import { useStore } from '../../store';

export default function BOReports() {
  const { closedChecks, shift, staff } = useStore();
  return (
    <div style={{ flex:1, overflowY:'auto', padding:24 }}>
      <ReportsContent closedChecks={closedChecks} shift={shift} staff={staff} />
    </div>
  );
}

function ReportsContent({ closedChecks, shift, staff }) {
  const [period, setPeriod] = useState('today');
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(),now.getMonth(),now.getDate());

  const filtered = closedChecks.filter(c => {
    if (period === 'today') return new Date(c.closedAt) >= startOfDay;
    if (period === 'week') return new Date(c.closedAt) >= new Date(startOfDay.getTime() - startOfDay.getDay()*86400000);
    return true;
  });

  const revenue = filtered.reduce((s,c)=>s+c.total,0);
  const covers  = filtered.reduce((s,c)=>s+(c.covers||1),0);
  const tips    = filtered.reduce((s,c)=>s+(c.tip||0),0);
  const refunds = filtered.reduce((s,c)=>s+c.refunds.reduce((r,rf)=>r+rf.amount,0),0);

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800 }}>Reports</div>
        <div style={{ display:'flex', gap:4 }}>
          {[['today','Today'],['week','Week'],['all','All time']].map(([p,l]) => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', background:period===p?'var(--acc-d)':'var(--bg3)', border:`1.5px solid ${period===p?'var(--acc-b)':'var(--bdr)'}`, color:period===p?'var(--acc)':'var(--t3)', fontSize:12, fontWeight:700 }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Net revenue', value:`£${(revenue-refunds).toFixed(2)}`, color:'var(--acc)' },
          { label:'Checks', value:filtered.length, sub:`Avg £${filtered.length>0?(revenue/filtered.length).toFixed(2):'0'}` },
          { label:'Covers', value:covers, sub:`£${covers>0?(revenue/covers).toFixed(2):'—'}/head` },
          { label:'Tips', value:`£${tips.toFixed(2)}`, color:'var(--grn)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color||'var(--t1)', fontFamily:'var(--font-mono)' }}>{s.value}</div>
            {s.sub && <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--t3)' }}>
          <div style={{ fontSize:32, marginBottom:12, opacity:.3 }}>📊</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)' }}>No closed checks in this period</div>
          <div style={{ fontSize:13, marginTop:4 }}>Complete a checkout to see data here</div>
        </div>
      ) : (
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                {['Time','Table/type','Server','Covers','Total','Method'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--bdr)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice().reverse().map((c,i) => (
                <tr key={c.id} style={{ borderBottom:'1px solid var(--bdr)', background:i%2===0?'var(--bg)':'var(--bg1)' }}>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--t3)', fontFamily:'var(--font-mono)' }}>{new Date(c.closedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600, color:'var(--t1)' }}>{c.tableLabel || c.orderType}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--t2)' }}>{c.server}</td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--t2)' }}>{c.covers}</td>
                  <td style={{ padding:'10px 14px', fontSize:13, fontWeight:700, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>£{c.total.toFixed(2)}</td>
                  <td style={{ padding:'10px 14px', fontSize:11 }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t3)', fontWeight:600 }}>{c.method}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
