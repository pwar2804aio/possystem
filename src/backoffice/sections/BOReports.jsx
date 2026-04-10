import { useState, useMemo } from 'react';
import { useStore } from '../../store';

const PERIODS = [
  { id:'today',  label:'Today'      },
  { id:'week',   label:'This week'  },
  { id:'month',  label:'This month' },
  { id:'all',    label:'All time'   },
];

const fmt  = n => `£${(n||0).toFixed(2)}`;
const fmtN = n => (n||0).toLocaleString();

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ padding:'14px 16px', background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
        {icon && <span>{icon}</span>}{label}
      </div>
      <div style={{ fontSize:22, fontWeight:900, color:color||'var(--t1)', fontFamily:'var(--font-mono)', letterSpacing:'-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--t4)', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

export default function BOReports() {
  const { closedChecks } = useStore();
  const [period, setPeriod]   = useState('today');
  const [view, setView]       = useState('overview');

  const filtered = useMemo(() => {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sow = new Date(sod); sow.setDate(sod.getDate() - sod.getDay());
    const som = new Date(now.getFullYear(), now.getMonth(), 1);
    return closedChecks.filter(c => {
      const d = new Date(c.closedAt);
      if (period==='today') return d >= sod;
      if (period==='week')  return d >= sow;
      if (period==='month') return d >= som;
      return true;
    });
  }, [closedChecks, period]);

  const stats = useMemo(() => {
    const revenue   = filtered.reduce((s,c) => s + c.total, 0);
    const covers    = filtered.reduce((s,c) => s + (c.covers||1), 0);
    const tips      = filtered.reduce((s,c) => s + (c.tip||0), 0);
    const refunds   = filtered.reduce((s,c) => s + c.refunds?.reduce((r,rf)=>r+rf.amount,0)||0, 0);
    const card      = filtered.filter(c=>c.method!=='cash').reduce((s,c)=>s+c.total,0);
    const cash      = filtered.filter(c=>c.method==='cash').reduce((s,c)=>s+c.total,0);
    const avgCheck  = filtered.length ? revenue/filtered.length : 0;
    const avgCover  = covers ? revenue/covers : 0;

    // Product mix
    const itemMap = {};
    filtered.forEach(c => {
      (c.items||[]).forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { name:i.name, qty:0, rev:0 };
        itemMap[i.name].qty += i.qty||1;
        itemMap[i.name].rev += (i.price||0)*(i.qty||1);
      });
    });
    const topItems = Object.values(itemMap).sort((a,b)=>b.rev-a.rev).slice(0,10);

    // Hourly breakdown (0-23)
    const byHour = Array(24).fill(0);
    filtered.forEach(c => { const h = new Date(c.closedAt).getHours(); byHour[h] += c.total; });
    const maxHour = Math.max(...byHour, 1);

    // By server
    const serverMap = {};
    filtered.forEach(c => {
      const s = c.server || c.staff || 'Unknown';
      if (!serverMap[s]) serverMap[s] = { name:s, checks:0, revenue:0, covers:0 };
      serverMap[s].checks++;
      serverMap[s].revenue += c.total;
      serverMap[s].covers  += c.covers||1;
    });
    const byServer = Object.values(serverMap).sort((a,b)=>b.revenue-a.revenue);

    // By order type
    const typeMap = {};
    filtered.forEach(c => {
      const t = c.orderType || 'dine-in';
      if (!typeMap[t]) typeMap[t] = { type:t, checks:0, revenue:0 };
      typeMap[t].checks++;
      typeMap[t].revenue += c.total;
    });
    const byType = Object.values(typeMap).sort((a,b)=>b.revenue-a.revenue);

    return { revenue, covers, tips, refunds, card, cash, avgCheck, avgCover, topItems, byHour, maxHour, byServer, byType, checkCount: filtered.length };
  }, [filtered]);

  const tabs = [
    { id:'overview', label:'Overview' },
    { id:'items',    label:'Product mix' },
    { id:'servers',  label:'By server' },
    { id:'hourly',   label:'Hourly' },
  ];

  const typeIcons = { 'dine-in':'⬚', takeaway:'🥡', collection:'📦', delivery:'🛵', bar:'🍸', counter:'🏷' };

  return (
    <div style={{ padding:'20px 24px', maxWidth:960 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>Reports</div>
          <div style={{ fontSize:12, color:'var(--t3)' }}>{filtered.length} checks · {fmt(stats.revenue)} revenue</div>
        </div>
        {/* Period selector */}
        <div style={{ display:'flex', gap:4, background:'var(--bg3)', padding:3, borderRadius:10 }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:'none',
              background:period===p.id?'var(--bg1)':'transparent',
              color:period===p.id?'var(--t1)':'var(--t3)',
              fontSize:12, fontWeight:period===p.id?700:400,
              boxShadow:period===p.id?'0 1px 3px rgba(0,0,0,.15)':'none',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* View tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--bdr)', marginBottom:20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding:'8px 16px', cursor:'pointer', fontFamily:'inherit', border:'none',
            borderBottom:`2px solid ${view===t.id?'var(--acc)':'transparent'}`,
            background:'transparent', color:view===t.id?'var(--acc)':'var(--t3)',
            fontSize:12, fontWeight:view===t.id?700:400, marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {view === 'overview' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
            <StatCard label="Revenue"   value={fmt(stats.revenue)}   sub={`${stats.checkCount} checks`}       color="var(--acc)" icon="💰"/>
            <StatCard label="Covers"    value={fmtN(stats.covers)}   sub={`${fmt(stats.avgCover)} per cover`} color="var(--t1)"  icon="🧑"/>
            <StatCard label="Avg check" value={fmt(stats.avgCheck)}  sub="per check"                          color="var(--t1)"  icon="📋"/>
            <StatCard label="Tips"      value={fmt(stats.tips)}       sub={`${fmt(stats.refunds)} refunded`}  color="var(--grn)" icon="🙏"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            {/* Payment split */}
            <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Payment method</div>
              {[['💳 Card', stats.card, '#3b82f6'], ['💵 Cash', stats.cash, '#22c55e']].map(([label, val, color]) => {
                const pct = stats.revenue > 0 ? (val/stats.revenue)*100 : 0;
                return (
                  <div key={label} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'var(--t2)' }}>{label}</span>
                      <span style={{ fontSize:12, fontWeight:700, color, fontFamily:'var(--font-mono)' }}>{fmt(val)}</span>
                    </div>
                    <div style={{ height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width .4s' }}/>
                    </div>
                    <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
            {/* Order type split */}
            <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>By order type</div>
              {stats.byType.length === 0
                ? <div style={{ fontSize:12, color:'var(--t4)' }}>No data yet</div>
                : stats.byType.map(t => {
                  const pct = stats.revenue > 0 ? (t.revenue/stats.revenue)*100 : 0;
                  return (
                    <div key={t.type} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:14, width:20 }}>{typeIcons[t.type]||'⊞'}</span>
                      <span style={{ fontSize:12, color:'var(--t2)', flex:1, textTransform:'capitalize' }}>{t.type}</span>
                      <span style={{ fontSize:11, color:'var(--t4)', width:50, textAlign:'right' }}>{t.checks} checks</span>
                      <span style={{ fontSize:12, fontWeight:700, color:'var(--acc)', fontFamily:'var(--font-mono)', width:70, textAlign:'right' }}>{fmt(t.revenue)}</span>
                    </div>
                  );
                })
              }
            </div>
          </div>
          {/* Top items preview */}
          {stats.topItems.length > 0 && (
            <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>Top items</div>
              {stats.topItems.slice(0,5).map((item, i) => {
                const pct = stats.topItems[0]?.rev > 0 ? (item.rev/stats.topItems[0].rev)*100 : 0;
                return (
                  <div key={item.name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:11, color:'var(--t4)', fontFamily:'var(--font-mono)', width:16 }}>#{i+1}</span>
                    <span style={{ fontSize:12, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</span>
                    <span style={{ fontSize:11, color:'var(--t4)', width:40, textAlign:'right' }}>{item.qty}×</span>
                    <div style={{ width:80, height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:'var(--acc)', borderRadius:3 }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:'var(--acc)', fontFamily:'var(--font-mono)', width:64, textAlign:'right' }}>{fmt(item.rev)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Product mix */}
      {view === 'items' && (
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--bdr)', background:'var(--bg2)' }}>
                {['#','Item','Qty sold','Revenue','Share'].map(h => (
                  <th key={h} style={{ padding:'9px 14px', fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', textAlign:h==='#'||h==='Qty sold'||h==='Revenue'||h==='Share'?'right':'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.topItems.length === 0
                ? <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:'var(--t4)', fontSize:12 }}>No sales data yet</td></tr>
                : stats.topItems.map((item, i) => {
                  const share = stats.revenue > 0 ? (item.rev/stats.revenue)*100 : 0;
                  return (
                    <tr key={item.name} style={{ borderBottom:'1px solid var(--bdr)', background:i%2===0?'transparent':'var(--bg2)' }}>
                      <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t4)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{i+1}</td>
                      <td style={{ padding:'9px 14px', fontSize:13, color:'var(--t1)', fontWeight:600 }}>{item.name}</td>
                      <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{item.qty}</td>
                      <td style={{ padding:'9px 14px', fontSize:13, fontWeight:700, color:'var(--acc)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{fmt(item.rev)}</td>
                      <td style={{ padding:'9px 14px', textAlign:'right' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                          <div style={{ width:60, height:5, background:'var(--bg3)', borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${share}%`, background:'var(--acc)', borderRadius:3 }}/>
                          </div>
                          <span style={{ fontSize:11, color:'var(--t4)', fontFamily:'var(--font-mono)', width:36, textAlign:'right' }}>{share.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      )}

      {/* By server */}
      {view === 'servers' && (
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--bdr)', background:'var(--bg2)' }}>
                {['Server','Checks','Covers','Revenue','Avg check'].map(h => (
                  <th key={h} style={{ padding:'9px 14px', fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', textAlign:h==='Server'?'left':'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.byServer.length === 0
                ? <tr><td colSpan={5} style={{ padding:32, textAlign:'center', color:'var(--t4)', fontSize:12 }}>No server data yet</td></tr>
                : stats.byServer.map((s, i) => (
                  <tr key={s.name} style={{ borderBottom:'1px solid var(--bdr)', background:i%2===0?'transparent':'var(--bg2)' }}>
                    <td style={{ padding:'9px 14px', fontSize:13, fontWeight:600, color:'var(--t1)' }}>{s.name}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{s.checks}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{s.covers}</td>
                    <td style={{ padding:'9px 14px', fontSize:13, fontWeight:700, color:'var(--acc)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{fmt(s.revenue)}</td>
                    <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{fmt(s.checks>0?s.revenue/s.checks:0)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Hourly */}
      {view === 'hourly' && (
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, padding:'16px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:16 }}>Revenue by hour</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:140 }}>
            {stats.byHour.map((val, h) => {
              const pct = stats.maxHour > 0 ? (val/stats.maxHour)*100 : 0;
              const isNow = new Date().getHours() === h;
              return (
                <div key={h} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <div style={{ fontSize:9, color:'var(--t4)', fontFamily:'var(--font-mono)' }}>{val>0?`£${Math.round(val)}`:''}</div>
                  <div style={{
                    width:'100%', background:isNow?'var(--acc)':val>0?'var(--acc-d)':'var(--bg3)',
                    borderRadius:'3px 3px 0 0', transition:'height .3s',
                    height:`${Math.max(pct, val>0?4:0)}%`,
                    border:isNow?'1px solid var(--acc-b)':'1px solid var(--bdr)',
                  }}/>
                  <div style={{ fontSize:8, color:isNow?'var(--acc)':'var(--t4)', fontWeight:isNow?700:400 }}>{h}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {[
              ['Peak hour', stats.byHour.indexOf(Math.max(...stats.byHour)) + ':00', 'var(--t2)'],
              ['Busiest revenue', fmt(Math.max(...stats.byHour)), 'var(--acc)'],
              ['Total checks', stats.checkCount, 'var(--t2)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background:'var(--bg3)', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:10, color:'var(--t4)', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:15, fontWeight:800, color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
