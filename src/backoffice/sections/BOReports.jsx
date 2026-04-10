import { useState, useMemo } from 'react';
import { useStore } from '../../store';

const PERIODS = [
  { id:'today',   label:'Today' },
  { id:'week',    label:'This week' },
  { id:'month',   label:'This month' },
  { id:'all',     label:'All time' },
];

export default function BOReports() {
  const { closedChecks, shift } = useStore();
  const [period, setPeriod] = useState('today');
  const [expandCheck, setExpandCheck] = useState(null);

  const filtered = useMemo(() => {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sow = new Date(sod); sow.setDate(sod.getDate() - sod.getDay());
    const som = new Date(now.getFullYear(), now.getMonth(), 1);
    return closedChecks.filter(c => {
      const d = new Date(c.closedAt);
      if (period === 'today') return d >= sod;
      if (period === 'week')  return d >= sow;
      if (period === 'month') return d >= som;
      return true;
    });
  }, [closedChecks, period]);

  const stats = useMemo(() => {
    const revenue  = filtered.reduce((s,c) => s + c.total, 0);
    const covers   = filtered.reduce((s,c) => s + (c.covers || 1), 0);
    const tips     = filtered.reduce((s,c) => s + (c.tip || 0), 0);
    const refunds  = filtered.reduce((s,c) => s + c.refunds.reduce((r,rf)=>r+rf.amount,0), 0);
    const card     = filtered.filter(c=>c.method!=='cash').reduce((s,c)=>s+c.total,0);
    const cash     = filtered.filter(c=>c.method==='cash').reduce((s,c)=>s+c.total,0);
    const avgCheck = filtered.length ? revenue/filtered.length : 0;
    const avgCover = covers ? revenue/covers : 0;

    // Top items
    const itemMap = {};
    filtered.forEach(c => c.items?.forEach(i => {
      const name = i.name || i.item;
      if (!name) return;
      if (!itemMap[name]) itemMap[name] = { name, qty:0, rev:0 };
      itemMap[name].qty += i.qty || 1;
      itemMap[name].rev += (i.price || 0) * (i.qty || 1);
    }));
    const topItems = Object.values(itemMap).sort((a,b)=>b.rev-a.rev).slice(0,8);

    // By hour
    const byHour = {};
    filtered.forEach(c => {
      const h = new Date(c.closedAt).getHours();
      if (!byHour[h]) byHour[h] = { checks:0, revenue:0 };
      byHour[h].checks++;
      byHour[h].revenue += c.total;
    });
    const maxHourRev = Math.max(1, ...Object.values(byHour).map(h=>h.revenue));

    return { revenue, covers, tips, refunds, card, cash, avgCheck, avgCover, topItems, byHour, maxHourRev };
  }, [filtered]);

  const fmt = v => `£${v.toFixed(2)}`;

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>

      {/* Period selector */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>Reports</div>
        <div style={{ display:'flex', gap:4, background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:10, padding:3 }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
              padding:'5px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              background: period===p.id ? 'var(--bg1)' : 'transparent',
              border: period===p.id ? '1px solid var(--bdr2)' : '1px solid transparent',
              color: period===p.id ? 'var(--t1)' : 'var(--t3)',
              fontSize:12, fontWeight: period===p.id ? 700 : 500,
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Net revenue',  value:fmt(stats.revenue - stats.refunds), sub:`${filtered.length} checks`, color:'var(--acc)' },
          { label:'Avg check',    value:fmt(stats.avgCheck), sub:'per check' },
          { label:'Covers',       value:stats.covers, sub:`${fmt(stats.avgCover)}/head` },
          { label:'Tips',         value:fmt(stats.tips), sub:'total', color:'var(--grn)' },
          { label:'Card',         value:fmt(stats.card), sub:`${stats.revenue > 0 ? Math.round(stats.card/stats.revenue*100) : 0}%` },
          { label:'Cash',         value:fmt(stats.cash), sub:`${stats.revenue > 0 ? Math.round(stats.cash/stats.revenue*100) : 0}%` },
          { label:'Refunds',      value:fmt(stats.refunds), sub:'total', color: stats.refunds>0 ? 'var(--red)' : undefined },
          { label:'Gross revenue',value:fmt(stats.revenue), sub:'before refunds', color:'var(--t2)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color||'var(--t1)', fontFamily:'var(--font-mono)', letterSpacing:'-.01em' }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column: top items + hourly bars */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>

        {/* Top items */}
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--t2)', marginBottom:14 }}>Top items</div>
          {stats.topItems.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--t4)', textAlign:'center', padding:'20px 0' }}>No data for this period</div>
          ) : stats.topItems.map((item, i) => {
            const pct = stats.topItems[0].rev > 0 ? (item.rev / stats.topItems[0].rev) * 100 : 0;
            return (
              <div key={item.name} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span style={{ fontWeight:600, color:'var(--t1)' }}>{item.name}</span>
                  <span style={{ color:'var(--t3)', fontFamily:'var(--font-mono)' }}>{fmt(item.rev)} · {item.qty}x</span>
                </div>
                <div style={{ height:4, background:'var(--bg3)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:`hsl(${180 - i*16},60%,45%)`, borderRadius:2, transition:'width .4s' }}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hourly breakdown */}
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--t2)', marginBottom:14 }}>Revenue by hour</div>
          {Object.keys(stats.byHour).length === 0 ? (
            <div style={{ fontSize:12, color:'var(--t4)', textAlign:'center', padding:'20px 0' }}>No data for this period</div>
          ) : (
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:100 }}>
              {Array.from({length:24}, (_,h) => {
                const d = stats.byHour[h];
                const pct = d ? (d.revenue / stats.maxHourRev) * 100 : 0;
                if (!d && !Object.keys(stats.byHour).some(k => Math.abs(k-h)<=2)) return null;
                return (
                  <div key={h} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }} title={d ? `${h}:00 — ${fmt(d.revenue)}, ${d.checks} checks` : undefined}>
                    <div style={{ width:'100%', background: pct>0 ? 'var(--acc)' : 'var(--bg3)', borderRadius:3, height:`${Math.max(2,pct)}%`, opacity: pct>0?1:.4, transition:'height .3s' }}/>
                    <span style={{ fontSize:8, color:'var(--t4)', textAlign:'center' }}>{h}</span>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          )}
        </div>
      </div>

      {/* Check log */}
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--t2)' }}>Check log</div>
          <div style={{ fontSize:11, color:'var(--t4)' }}>{filtered.length} checks</div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:'var(--t3)' }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:.3 }}>📋</div>
            <div style={{ fontSize:13 }}>No closed checks in this period</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg2)' }}>
                {['Time','Table / type','Server','Covers','Items','Total','Method'].map(h => (
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--bdr)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice().reverse().map((c, i) => (
                <>
                  <tr key={c.id} onClick={()=>setExpandCheck(expandCheck===c.id ? null : c.id)} style={{ borderBottom:'1px solid var(--bdr)', background:i%2===0?'var(--bg)':'var(--bg1)', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'var(--bg)':'var(--bg1)'}>
                    <td style={{ padding:'9px 14px', fontSize:11, color:'var(--t3)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>{new Date(c.closedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, fontWeight:600, color:'var(--t1)' }}>{c.tableLabel || c.orderType || 'Walk-in'}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)' }}>{c.server}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'center' }}>{c.covers}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'center' }}>{c.items?.length || '—'}</td>
                    <td style={{ padding:'9px 14px', fontSize:13, fontWeight:700, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>{fmt(c.total)}</td>
                    <td style={{ padding:'9px 14px' }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t3)' }}>{c.method}</span>
                    </td>
                  </tr>
                  {expandCheck === c.id && (
                    <tr key={`${c.id}-detail`} style={{ background:'var(--bg2)' }}>
                      <td colSpan={7} style={{ padding:'10px 14px 14px' }}>
                        <div style={{ fontSize:11, color:'var(--t4)', marginBottom:6 }}>Items ordered</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {(c.items||[]).map((item,j) => (
                            <span key={j} style={{ fontSize:11, padding:'3px 9px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)' }}>
                              {item.qty > 1 ? `${item.qty}× ` : ''}{item.name || item.item}
                            </span>
                          ))}
                          {!c.items?.length && <span style={{ color:'var(--t4)' }}>No item detail recorded</span>}
                        </div>
                        {c.tip > 0 && <div style={{ marginTop:6, fontSize:11, color:'var(--grn)' }}>Tip: {fmt(c.tip)}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
