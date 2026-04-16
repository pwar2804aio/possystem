import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { supabase, isMock, getLocationId } from '../../lib/supabase';
import { fetchClosedChecksRange } from '../../lib/db';
import { calculateOrderTax } from '../../lib/tax';

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
  const { closedChecks: todayChecks, activeSessions, tables, menuItems, taxRates } = useStore();
  const [period, setPeriod]           = useState('today');
  const [view, setView]               = useState('overview');
  const [rangeChecks, setRangeChecks] = useState(null);
  const [loadingRange, setLoadingRange] = useState(false);
  const [locationFilter, setLocationFilter] = useState('all');
  const locations = []; // Multi-location filter reserved for future

  // When period changes to non-today, fetch from Supabase
  useEffect(() => {
    if (isMock || period === 'today') { setRangeChecks(null); return; }
    setLoadingRange(true);
    (async () => {
      try {
        const now = new Date();
        let fromDate = null;
        if (period === 'week')  { fromDate = new Date(now); fromDate.setDate(now.getDate() - now.getDay()); fromDate.setHours(0,0,0,0); }
        if (period === 'month') { fromDate = new Date(now.getFullYear(), now.getMonth(), 1); }
        const { data } = await fetchClosedChecksRange(await getLocationId(), fromDate, null, 2000);
        setRangeChecks(data || []);
      } catch { setRangeChecks([]); }
      setLoadingRange(false);
    })();
  }, [period]);

  // Open orders are computed above from activeSessions

  // Use today's store data for "today", fetched range data for other periods
  const filtered = useMemo(() => {
    return period === 'today' ? todayChecks : (rangeChecks || []);
  }, [period, todayChecks, rangeChecks]);

  // Open orders — active sessions with items, not yet paid
  const openOrders = useMemo(() => {
    return Object.entries(activeSessions || {})
      .filter(([, s]) => s?.items?.length > 0)
      .map(([tableId, session]) => {
        const table = tables.find(t => t.id === tableId);
        const subtotal = session.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
        return {
          tableId,
          tableLabel: table?.label || tableId,
          covers: session.covers || 1,
          itemCount: session.items.length,
          subtotal,
          openedAt: session.openedAt || null,
        };
      })
      .sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0));
  }, [activeSessions, tables]);

  const stats = useMemo(() => {
    const revenue   = filtered.reduce((s,c) => s + c.total, 0);
    const covers    = filtered.reduce((s,c) => s + (c.covers||1), 0);
    const tips      = filtered.reduce((s,c) => s + (c.tip||0), 0);
    const refunds   = filtered.reduce((s,c) => s + c.refunds?.reduce((r,rf)=>r+rf.amount,0)||0, 0);
    const card      = filtered.filter(c=>c.method!=='cash').reduce((s,c)=>s+c.total,0);
    const cash      = filtered.filter(c=>c.method==='cash').reduce((s,c)=>s+c.total,0);
    const avgCheck  = filtered.length ? revenue/filtered.length : 0;
    const avgCover  = covers ? revenue/covers : 0;

    const itemMap = {};
    filtered.forEach(c => {
      (c.items||[]).forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { name:i.name, qty:0, rev:0 };
        itemMap[i.name].qty += i.qty||1;
        itemMap[i.name].rev += (i.price||0)*(i.qty||1);
      });
    });
    const topItems = Object.values(itemMap).sort((a,b)=>b.rev-a.rev).slice(0,10);

    const byHour = Array(24).fill(0);
    filtered.forEach(c => { const h = new Date(c.closedAt).getHours(); byHour[h] += c.total; });
    const maxHour = Math.max(...byHour, 1);

    const serverMap = {};
    filtered.forEach(c => {
      const s = c.server || c.staff || 'Unknown';
      if (!serverMap[s]) serverMap[s] = { name:s, checks:0, revenue:0, covers:0 };
      serverMap[s].checks++;
      serverMap[s].revenue += c.total;
      serverMap[s].covers  += c.covers||1;
    });
    const byServer = Object.values(serverMap).sort((a,b)=>b.revenue-a.revenue);

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
    { id:'overview',    label:'Overview' },
    { id:'open',        label:`Open orders${openOrders.length ? ` (${openOrders.length})` : ''}` },
    { id:'tax',         label:'Tax' },
    { id:'items',       label:'Product mix' },
    { id:'servers',     label:'By server' },
    { id:'hourly',      label:'Hourly' },
  ];

  const typeIcons = { 'dine-in':'⬚', takeaway:'🥡', collection:'📦', delivery:'🛵', bar:'🍸', counter:'🏷' };

  const activeLoc = locations.find(l => l.id === locationFilter);

  return (
    <div style={{ padding:'20px 24px', maxWidth:960 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:120 }}>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>Reports</div>
          <div style={{ fontSize:12, color:'var(--t3)' }}>
            {filtered.length} checks · {fmt(stats.revenue)} revenue
            {activeLoc && <span style={{ marginLeft:6, color:'var(--acc)', fontWeight:600 }}>· {activeLoc.name}</span>}
          </div>
        </div>

        {/* Location filter — only shown if user has multiple locations */}
        {locations.length > 0 && (
          <div style={{ display:'flex', gap:4, background:'var(--bg3)', padding:3, borderRadius:10 }}>
            <button onClick={() => setLocationFilter('all')} style={{
              padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:'none',
              background:locationFilter==='all'?'var(--bg1)':'transparent',
              color:locationFilter==='all'?'var(--t1)':'var(--t3)',
              fontSize:12, fontWeight:locationFilter==='all'?700:400,
              boxShadow:locationFilter==='all'?'0 1px 3px rgba(0,0,0,.15)':'none',
            }}>All locations</button>
            {locations.map(l => (
              <button key={l.id} onClick={() => setLocationFilter(l.id)} style={{
                padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:'none',
                background:locationFilter===l.id?'var(--bg1)':'transparent',
                color:locationFilter===l.id?'var(--t1)':'var(--t3)',
                fontSize:12, fontWeight:locationFilter===l.id?700:400,
                boxShadow:locationFilter===l.id?'0 1px 3px rgba(0,0,0,.15)':'none',
              }}>{l.name}</button>
            ))}
          </div>
        )}

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

      {/* ── Open orders ── */}
      {view === 'open' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            <StatCard label="Open tables"   value={openOrders.length}                                                     color="var(--acc)" icon="⬚"/>
            <StatCard label="Open covers"   value={openOrders.reduce((s,o)=>s+o.covers,0)}                                color="var(--t1)"  icon="🧑"/>
            <StatCard label="Revenue on floor" value={fmt(openOrders.reduce((s,o)=>s+o.subtotal,0))} sub="not yet paid"  color="var(--acc)" icon="💰"/>
          </div>
          {openOrders.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>⬚</div>
              No open orders right now
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {openOrders.map(o => (
                <div key={o.tableId} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 16px', background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12 }}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'var(--acc-d)', border:'1px solid var(--acc-b)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'var(--acc)', flexShrink:0 }}>
                    {o.tableLabel}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:2 }}>Table {o.tableLabel}</div>
                    <div style={{ fontSize:11, color:'var(--t4)' }}>{o.itemCount} item{o.itemCount!==1?'s':''} · {o.covers} cover{o.covers!==1?'s':''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:15, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>{fmt(o.subtotal)}</div>
                    <div style={{ fontSize:10, color:'var(--t4)' }}>not yet paid</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:8, padding:'10px 14px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', fontSize:12, color:'var(--t4)' }}>
                ⓘ Open orders are excluded from revenue figures until payment is taken.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tax report ── */}
      {view === 'tax' && (() => {
        if (!taxRates?.length) return (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>
            <div style={{ fontSize:36, marginBottom:10 }}>%</div>
            No tax rates configured. Go to <strong style={{ color:'var(--t2)' }}>Tax & VAT</strong> to set up rates.
          </div>
        );

        // Build tax summary across all filtered checks
        const taxSummary = {};
        let totalGross = 0, totalTax = 0, totalNet = 0;

        filtered.forEach(check => {
          const orderType = check.orderType || 'dine-in';
          const breakdown = calculateOrderTax(check.items || [], taxRates, orderType);
          totalGross += breakdown.total;
          totalTax   += breakdown.totalTax;
          totalNet   += breakdown.subtotal;
          breakdown.breakdown.forEach(b => {
            const key = b.rate.id;
            if (!taxSummary[key]) taxSummary[key] = { rate: b.rate, tax: 0, net: 0, gross: 0, checks: 0 };
            taxSummary[key].tax   += b.tax;
            taxSummary[key].net   += b.net;
            taxSummary[key].gross += b.gross;
            taxSummary[key].checks++;
          });
        });

        const rows = Object.values(taxSummary).sort((a,b) => b.rate.rate - a.rate.rate);
        const hasExclusive = rows.some(r => r.rate.type === 'exclusive');

        const exportCSV = () => {
          const lines = ['Rate,Code,Type,Net Sales,Tax,Gross Sales'];
          rows.forEach(r => {
            const pct = (r.rate.rate*100).toFixed(1).replace('.0','');
            lines.push(`"${r.rate.name} (${pct}%)","${r.rate.code||''}","${r.rate.type}","£${r.net.toFixed(2)}","£${r.tax.toFixed(2)}","£${r.gross.toFixed(2)}"`);
          });
          lines.push(`"Total","","","£${totalNet.toFixed(2)}","£${totalTax.toFixed(2)}","£${totalGross.toFixed(2)}"`);
          const blob = new Blob([lines.join('\n')], { type:'text/csv' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `tax-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
        };

        return (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:13, color:'var(--t4)' }}>
                {hasExclusive ? 'Tax added on top of prices (exclusive)' : 'Tax included in prices (inclusive / VAT)'}
                {' · '}{filtered.length} checks
              </div>
              <button onClick={exportCSV} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t2)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                Export CSV
              </button>
            </div>

            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
              <StatCard label="Gross sales"      value={fmt(totalGross)} sub="inc. tax"   color="var(--acc)" icon="💰"/>
              <StatCard label="Net sales"         value={fmt(totalNet)}  sub="ex. tax"    color="var(--t1)"  icon="📋"/>
              <StatCard label="Total tax"         value={fmt(totalTax)}  sub={`${filtered.length} checks`} color="var(--red)" icon="%"/>
            </div>

            {/* Breakdown table */}
            {rows.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--t4)', fontSize:13 }}>
                No tax data for this period — check that tax rates are assigned to menu items.
              </div>
            ) : (
              <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'10px 16px', background:'var(--bg3)', borderBottom:'1px solid var(--bdr)', fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                  <span>Rate</span><span style={{ textAlign:'right' }}>Net sales</span><span style={{ textAlign:'right' }}>Tax</span><span style={{ textAlign:'right' }}>Gross</span>
                </div>
                {rows.map(r => {
                  const pct = (r.rate.rate*100).toFixed(1).replace('.0','');
                  return (
                    <div key={r.rate.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'12px 16px', borderBottom:'1px solid var(--bdr)', alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{r.rate.name}</div>
                        <div style={{ fontSize:11, color:'var(--t4)' }}>{pct}% · {r.rate.code} · {r.rate.type}</div>
                      </div>
                      <div style={{ textAlign:'right', fontSize:13, fontFamily:'var(--font-mono)', color:'var(--t2)' }}>{fmt(r.net)}</div>
                      <div style={{ textAlign:'right', fontSize:13, fontFamily:'var(--font-mono)', color:'var(--red)', fontWeight:600 }}>{fmt(r.tax)}</div>
                      <div style={{ textAlign:'right', fontSize:13, fontFamily:'var(--font-mono)', color:'var(--t1)', fontWeight:700 }}>{fmt(r.gross)}</div>
                    </div>
                  );
                })}
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'12px 16px', background:'var(--bg3)' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>Total</div>
                  <div style={{ textAlign:'right', fontSize:13, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--t1)' }}>{fmt(totalNet)}</div>
                  <div style={{ textAlign:'right', fontSize:13, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--red)' }}>{fmt(totalTax)}</div>
                  <div style={{ textAlign:'right', fontSize:13, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--acc)' }}>{fmt(totalGross)}</div>
                </div>
              </div>
            )}

            <div style={{ marginTop:16, padding:'12px 16px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', fontSize:11, color:'var(--t4)', lineHeight:1.8 }}>
              <strong style={{ color:'var(--t2)' }}>For VAT returns:</strong> Net sales = taxable turnover. 
              Switch periods above to see weekly/monthly figures for filing.
              Use Export CSV to send to your accountant.
            </div>
          </div>
        );
      })()}

      {/* Loading overlay for range queries */}
      {loadingRange && (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>
          Loading {period} data…
        </div>
      )}
    </div>
  );
}
