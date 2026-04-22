// v4.6.15: Back Office Reports \u2014 rebuilt shell.
// The shell owns:
//   - period + custom range picker
//   - server + order-type filter
//   - range fetch (current period) + prev-range fetch (for compare chips)
//   - tab routing between reports
// Each report is a pure component that receives filtered checks and renders.
//
// Wave 1 ships Sales summary / Exceptions / Payments / Daypart as new tabs.
// Legacy Product mix / By server / Tax / Open orders are preserved inline
// and will be upgraded in Wave 2 (Menu engineering, Server scorecard, Tax breakdown).

import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../../store';
import { isMock, getLocationId } from '../../lib/supabase';
import { fetchClosedChecksRange } from '../../lib/db';
import { calculateOrderTax } from '../../lib/tax';
import { PERIODS, getPeriodRange, periodLabel, applyFilters, uniqueServers, uniqueOrderTypes } from './reports/_filters';
import SalesSummary from './reports/SalesSummary';
import Exceptions   from './reports/Exceptions';
import Payments     from './reports/Payments';
import Daypart      from './reports/Daypart';

const fmt  = n => `\u00A3${(n || 0).toFixed(2)}`;
const fmtN = n => (n || 0).toLocaleString();

export default function BOReports() {
  const { tables, taxRates, closedChecks: storeChecks } = useStore();

  const [view, setView]               = useState('summary');
  const [period, setPeriod]           = useState('today');
  const [customRange, setCustomRange] = useState({ from:null, to:null });
  const [serverFilter, setServerFilter]       = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [locationFilter] = useState('all'); // Reserved for Wave 4 multi-location picker

  const [rangeChecks, setRangeChecks] = useState(null);
  const [prevChecks, setPrevChecks]   = useState(null);
  const [loadingRange, setLoadingRange] = useState(false);

  const range = useMemo(() => getPeriodRange(period, customRange), [period, customRange]);

  // Derive active sessions for the Open orders tab
  const activeSessions = useMemo(() =>
    Object.fromEntries(tables.filter(t => t.session).map(t => [t.id, t.session]))
  , [tables]);

  // Fetch current period + previous period in parallel (prev period powers compare chips)
  useEffect(() => {
    if (isMock) { setRangeChecks([]); setPrevChecks([]); return; }
    if (period === 'custom' && (!customRange.from || !customRange.to)) {
      // Wait for the user to pick both ends before fetching
      setRangeChecks([]); setPrevChecks([]); return;
    }
    setLoadingRange(true);
    (async () => {
      try {
        // Resolve location id from user_profiles \u2192 device config fallback
        let locId = await getLocationId().catch(() => null);
        if (!locId) {
          try {
            const snap = JSON.parse(localStorage.getItem('rpos-config-snapshot') || '{}');
            const dev  = JSON.parse(localStorage.getItem('rpos-device') || '{}');
            locId = dev.locationId || snap.locationId || null;
          } catch {}
        }
        if (!locId) {
          // No locId: fall back to local store (captures today's checks on this device only)
          const localSlice = (storeChecks || []).filter(c => c.closedAt && new Date(c.closedAt) >= range.from && new Date(c.closedAt) <= range.to);
          setRangeChecks(localSlice); setPrevChecks([]);
          setLoadingRange(false);
          return;
        }
        const [cur, prev] = await Promise.all([
          fetchClosedChecksRange(locId, range.from,     range.to,     5000),
          fetchClosedChecksRange(locId, range.prevFrom, range.prevTo, 5000),
        ]);
        setRangeChecks(cur.data  || []);
        setPrevChecks (prev.data || []);
      } catch (err) {
        console.error('[BOReports] fetch failed', err);
        setRangeChecks([]); setPrevChecks([]);
      }
      setLoadingRange(false);
    })();
  }, [period, customRange.from, customRange.to, locationFilter]);

  const allChecks = rangeChecks || [];
  const allPrev   = prevChecks  || [];

  // Apply global filters (server + order type). Custom filters live per-report.
  const filtered     = useMemo(() => applyFilters(allChecks, { server: serverFilter, orderType: orderTypeFilter }), [allChecks, serverFilter, orderTypeFilter]);
  const filteredPrev = useMemo(() => applyFilters(allPrev,   { server: serverFilter, orderType: orderTypeFilter }), [allPrev,   serverFilter, orderTypeFilter]);

  const servers    = useMemo(() => uniqueServers(allChecks),    [allChecks]);
  const orderTypes = useMemo(() => uniqueOrderTypes(allChecks), [allChecks]);

  // Open orders \u2014 unchanged logic from pre-4.6.15
  const openOrders = useMemo(() => (
    Object.entries(activeSessions || {})
      .filter(([, s]) => s?.items?.length > 0)
      .map(([tableId, session]) => {
        const table = tables.find(t => t.id === tableId);
        const subtotal = session.items.reduce((s, i) => s + (i.price || 0) * (i.qty || 1), 0);
        return { tableId, tableLabel: table?.label || tableId, covers: session.covers || 1, itemCount: session.items.length, subtotal, openedAt: session.openedAt || null };
      })
      .sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0))
  ), [activeSessions, tables]);

  // Legacy stats for Product mix + By server tabs. Wave 2 replaces these tabs.
  const legacyStats = useMemo(() => {
    const itemMap = {};
    filtered.forEach(c => {
      (c.items || []).forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { name:i.name, qty:0, rev:0 };
        itemMap[i.name].qty += i.qty || 1;
        itemMap[i.name].rev += (i.price || 0) * (i.qty || 1);
      });
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.rev - a.rev).slice(0, 50);
    const serverMap = {};
    filtered.forEach(c => {
      const s = c.server || c.staff || 'Unknown';
      if (!serverMap[s]) serverMap[s] = { name:s, checks:0, revenue:0, covers:0 };
      serverMap[s].checks++;
      serverMap[s].revenue += c.total || 0;
      serverMap[s].covers  += c.covers || 1;
    });
    const byServer = Object.values(serverMap).sort((a, b) => b.revenue - a.revenue);
    const revenue = filtered.reduce((s, c) => s + (c.total || 0), 0);
    return { topItems, byServer, revenue };
  }, [filtered]);

  const tabs = [
    { id:'summary',    label:'Sales summary', icon:'\uD83D\uDCC8', badge:'new' },
    { id:'exceptions', label:'Exceptions',    icon:'\uD83D\uDEE1', badge:'new' },
    { id:'payments',   label:'Payments',      icon:'\uD83D\uDCB3', badge:'new' },
    { id:'daypart',    label:'Daypart',       icon:'\uD83D\uDD53', badge:'new' },
    { id:'items',      label:'Product mix' },
    { id:'servers',    label:'By server'   },
    { id:'tax',        label:'Tax' },
    { id:'open',       label:`Open orders${openOrders.length ? ` (${openOrders.length})` : ''}` },
  ];

  const needsCustomPick = period === 'custom' && (!customRange.from || !customRange.to);

  return (
    <div style={{ padding:'20px 24px', maxWidth:1100 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:11, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:700 }}>Reports</div>
          <div style={{ fontSize:22, fontWeight:800, color:'var(--t1)', marginTop:2, letterSpacing:'-.01em' }}>
            {PERIODS.find(p => p.id === period)?.label}
            <span style={{ color:'var(--t4)', fontWeight:400, fontSize:14, marginLeft:10 }}>{periodLabel(period, customRange, range)}</span>
          </div>
          <div style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>
            {filtered.length} checks \u00B7 {fmt(legacyStats.revenue)} revenue
            {(serverFilter !== 'all' || orderTypeFilter !== 'all') && (
              <span style={{ color:'var(--acc)', marginLeft:6 }}>\u00B7 filtered</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter row */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4, background:'var(--bg3)', padding:3, borderRadius:10, flexWrap:'wrap' }}>
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)} style={{
              padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:'none',
              background: period === p.id ? 'var(--bg1)' : 'transparent',
              color:      period === p.id ? 'var(--t1)'  : 'var(--t3)',
              fontSize:12, fontWeight: period === p.id ? 700 : 400,
              boxShadow:  period === p.id ? '0 1px 3px rgba(0,0,0,.15)' : 'none',
            }}>{p.label}</button>
          ))}
        </div>
        {period === 'custom' && (
          <>
            <input type="date" value={customRange.from || ''} onChange={e => setCustomRange(r => ({ ...r, from: e.target.value }))} style={inputSt}/>
            <span style={{ color:'var(--t4)' }}>\u2192</span>
            <input type="date" value={customRange.to   || ''} onChange={e => setCustomRange(r => ({ ...r, to:   e.target.value }))} style={inputSt}/>
          </>
        )}
        {servers.length > 1 && (
          <select value={serverFilter} onChange={e => setServerFilter(e.target.value)} style={selectSt}>
            <option value="all">All servers</option>
            {servers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {orderTypes.length > 1 && (
          <select value={orderTypeFilter} onChange={e => setOrderTypeFilter(e.target.value)} style={selectSt}>
            <option value="all">All order types</option>
            {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--bdr)', marginBottom:20, overflowX:'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding:'8px 14px', cursor:'pointer', fontFamily:'inherit', border:'none', whiteSpace:'nowrap',
            borderBottom:`2px solid ${view === t.id ? 'var(--acc)' : 'transparent'}`,
            background:'transparent', color: view === t.id ? 'var(--acc)' : 'var(--t3)',
            fontSize:12, fontWeight: view === t.id ? 700 : 400, marginBottom:-1,
            display:'flex', alignItems:'center', gap:6,
          }}>
            {t.icon && <span style={{ fontSize:13 }}>{t.icon}</span>}
            {t.label}
            {t.badge && <span style={{ padding:'1px 6px', fontSize:9, fontWeight:800, background:'var(--acc)', color:'#0b0c10', borderRadius:4, letterSpacing:'.05em', textTransform:'uppercase' }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {needsCustomPick ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>
          Pick a start and end date to load the custom range.
        </div>
      ) : loadingRange ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>Loading \u2026</div>
      ) : (
        <>
          {view === 'summary'    && <SalesSummary checks={filtered} prevChecks={filteredPrev} fmt={fmt} fmtN={fmtN}/>}
          {view === 'exceptions' && <Exceptions   checks={filtered} fmt={fmt}/>}
          {view === 'payments'   && <Payments     checks={filtered} fmt={fmt} fmtN={fmtN}/>}
          {view === 'daypart'    && <Daypart      checks={filtered} fmt={fmt}/>}
          {view === 'items'      && <LegacyPMix   stats={legacyStats} fmt={fmt}/>}
          {view === 'servers'    && <LegacyServers stats={legacyStats} fmt={fmt}/>}
          {view === 'tax'        && <LegacyTax    checks={filtered} taxRates={taxRates} fmt={fmt}/>}
          {view === 'open'       && <LegacyOpen   openOrders={openOrders} fmt={fmt}/>}
        </>
      )}
    </div>
  );
}

const selectSt = { padding:'6px 10px', borderRadius:8, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:12, cursor:'pointer', fontFamily:'inherit' };
const inputSt  = { padding:'5px 10px', borderRadius:8, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:12, fontFamily:'inherit' };
const tileSt   = { padding:'14px 16px', background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12 };
const lblSt    = { fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 };

// ------------------------------------------------------------------
// Legacy views \u2014 preserved intact from pre-4.6.15. Wave 2 replaces
// Product mix / By server / Tax with richer versions.
// ------------------------------------------------------------------

function LegacyPMix({ stats, fmt }) {
  if (stats.topItems.length === 0) {
    return <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>No sales data yet</div>;
  }
  return (
    <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--bdr)', background:'var(--bg3)' }}>
            {['#','Item','Qty sold','Revenue','Share'].map(h => (
              <th key={h} style={{ padding:'9px 14px', fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', textAlign: h === 'Item' ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.topItems.map((item, i) => {
            const share = stats.revenue > 0 ? (item.rev / stats.revenue) * 100 : 0;
            return (
              <tr key={item.name} style={{ borderBottom:'1px solid var(--bdr)', background: i % 2 === 0 ? 'transparent' : 'var(--bg2)' }}>
                <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t4)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{i + 1}</td>
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
          })}
        </tbody>
      </table>
    </div>
  );
}

function LegacyServers({ stats, fmt }) {
  if (stats.byServer.length === 0) {
    return <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>No server data yet</div>;
  }
  return (
    <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--bdr)', background:'var(--bg3)' }}>
            {['Server','Checks','Covers','Revenue','Avg check'].map(h => (
              <th key={h} style={{ padding:'9px 14px', fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', textAlign: h === 'Server' ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.byServer.map((s, i) => (
            <tr key={s.name} style={{ borderBottom:'1px solid var(--bdr)', background: i % 2 === 0 ? 'transparent' : 'var(--bg2)' }}>
              <td style={{ padding:'9px 14px', fontSize:13, fontWeight:600, color:'var(--t1)' }}>{s.name}</td>
              <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{s.checks}</td>
              <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{s.covers}</td>
              <td style={{ padding:'9px 14px', fontSize:13, fontWeight:700, color:'var(--acc)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{fmt(s.revenue)}</td>
              <td style={{ padding:'9px 14px', fontSize:12, color:'var(--t2)', textAlign:'right', fontFamily:'var(--font-mono)' }}>{fmt(s.checks > 0 ? s.revenue / s.checks : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LegacyTax({ checks, taxRates, fmt }) {
  if (!taxRates?.length) {
    return (
      <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>
        <div style={{ fontSize:36, marginBottom:10 }}>%</div>
        No tax rates configured. Go to <strong style={{ color:'var(--t2)' }}>Tax &amp; VAT</strong> to set up rates.
      </div>
    );
  }
  const taxSummary = {};
  let totalGross = 0, totalTax = 0, totalNet = 0;
  checks.forEach(check => {
    const orderType = check.orderType || 'dine-in';
    const breakdown = calculateOrderTax(check.items || [], taxRates, orderType);
    totalGross += breakdown.total;
    totalTax   += breakdown.totalTax;
    totalNet   += breakdown.subtotal;
    breakdown.breakdown.forEach(b => {
      const key = b.rate.id;
      if (!taxSummary[key]) taxSummary[key] = { rate:b.rate, tax:0, net:0, gross:0, checks:0 };
      taxSummary[key].tax   += b.tax;
      taxSummary[key].net   += b.net;
      taxSummary[key].gross += b.gross;
      taxSummary[key].checks++;
    });
  });
  const rows = Object.values(taxSummary).sort((a, b) => b.rate.rate - a.rate.rate);

  const exportCSV = () => {
    const lines = ['Rate,Code,Type,Net Sales,Tax,Gross Sales'];
    rows.forEach(r => {
      const pct = (r.rate.rate * 100).toFixed(1).replace('.0', '');
      lines.push(`"${r.rate.name} (${pct}%)","${r.rate.code || ''}","${r.rate.type}","\u00A3${r.net.toFixed(2)}","\u00A3${r.tax.toFixed(2)}","\u00A3${r.gross.toFixed(2)}"`);
    });
    lines.push(`"Total","","","\u00A3${totalNet.toFixed(2)}","\u00A3${totalTax.toFixed(2)}","\u00A3${totalGross.toFixed(2)}"`);
    const blob = new Blob([lines.join('\n')], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `tax-report-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:13, color:'var(--t4)' }}>{checks.length} checks</div>
        <button onClick={exportCSV} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t2)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Export CSV</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
        <div style={tileSt}><div style={lblSt}>Gross sales</div><div style={{ fontSize:22, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>{fmt(totalGross)}</div></div>
        <div style={tileSt}><div style={lblSt}>Net sales</div>  <div style={{ fontSize:22, fontWeight:800, color:'var(--t1)',  fontFamily:'var(--font-mono)' }}>{fmt(totalNet)}</div></div>
        <div style={tileSt}><div style={lblSt}>Total tax</div>  <div style={{ fontSize:22, fontWeight:800, color:'var(--red)', fontFamily:'var(--font-mono)' }}>{fmt(totalTax)}</div></div>
      </div>
      {rows.length === 0 ? (
        <div style={{ textAlign:'center', padding:'32px 0', color:'var(--t4)', fontSize:13 }}>No tax data for this period.</div>
      ) : (
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'10px 16px', background:'var(--bg3)', borderBottom:'1px solid var(--bdr)', fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.06em' }}>
            <span>Rate</span><span style={{ textAlign:'right' }}>Net</span><span style={{ textAlign:'right' }}>Tax</span><span style={{ textAlign:'right' }}>Gross</span>
          </div>
          {rows.map(r => {
            const pct = (r.rate.rate * 100).toFixed(1).replace('.0', '');
            return (
              <div key={r.rate.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', padding:'12px 16px', borderBottom:'1px solid var(--bdr)', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{r.rate.name}</div>
                  <div style={{ fontSize:11, color:'var(--t4)' }}>{pct}% \u00B7 {r.rate.code} \u00B7 {r.rate.type}</div>
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
    </div>
  );
}

function LegacyOpen({ openOrders, fmt }) {
  if (openOrders.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)', fontSize:13 }}>
        <div style={{ fontSize:36, marginBottom:10 }}>\u22DA</div>
        No open orders right now
      </div>
    );
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {openOrders.map(o => (
        <div key={o.tableId} style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 16px', background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'var(--acc-d)', border:'1px solid var(--acc-b)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:'var(--acc)', flexShrink:0 }}>{o.tableLabel}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:2 }}>Table {o.tableLabel}</div>
            <div style={{ fontSize:11, color:'var(--t4)' }}>{o.itemCount} item{o.itemCount !== 1 ? 's' : ''} \u00B7 {o.covers} cover{o.covers !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>{fmt(o.subtotal)}</div>
            <div style={{ fontSize:10, color:'var(--t4)' }}>not yet paid</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop:8, padding:'10px 14px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', fontSize:12, color:'var(--t4)' }}>
        \u24D8 Open orders are excluded from revenue figures until payment is taken.
      </div>
    </div>
  );
}
