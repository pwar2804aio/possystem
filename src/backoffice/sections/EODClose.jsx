import { useState, useMemo } from 'react';
import { useStore } from '../../store';

const DENOMS = [
  { label:'£50 notes',  value:50.00 },
  { label:'£20 notes',  value:20.00 },
  { label:'£10 notes',  value:10.00 },
  { label:'£5 notes',   value:5.00  },
  { label:'£2 coins',   value:2.00  },
  { label:'£1 coins',   value:1.00  },
  { label:'50p coins',  value:0.50  },
  { label:'20p coins',  value:0.20  },
  { label:'10p coins',  value:0.10  },
  { label:'5p coins',   value:0.05  },
  { label:'2p coins',   value:0.02  },
  { label:'1p coins',   value:0.01  },
];

const inp = { background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:9, padding:'7px 10px', color:'var(--t1)', fontSize:13, fontFamily:'var(--font-mono)', outline:'none', boxSizing:'border-box' };

export default function EODClose() {
  const { closedChecks, orderQueue, shift, showToast } = useStore();
  // v4.6.32: pull petty cash ledger for drawer reconciliation
  const pettyCashEntries = useStore(s => s.pettyCashEntries) || [];
  const addPettyCashEntry = useStore(s => s.addPettyCashEntry);
  const [counts, setCounts]   = useState(Object.fromEntries(DENOMS.map(d=>[d.value,0])));
  const [float, setFloat]     = useState('200.00');
  const [zDone, setZDone]     = useState(false);
  const [step, setStep]       = useState('declare'); // declare | review | done

  // ── Summary from today's closed checks ──────────────────────────────────
  const today = useMemo(() => {
    const sod = new Date(); sod.setHours(0,0,0,0);
    const checks = closedChecks.filter(c => new Date(c.closedAt) >= sod);
    const revenue  = checks.reduce((s,c)=>s+c.total,0);
    const cash     = checks.filter(c=>c.method==='cash').reduce((s,c)=>s+c.total,0);
    const card     = checks.filter(c=>c.method!=='cash').reduce((s,c)=>s+c.total,0);
    const tips     = checks.reduce((s,c)=>s+(c.tip||0),0);
    const refunds  = checks.reduce((s,c)=>s+(c.refunds||[]).reduce((r,rf)=>r+rf.amount,0),0);
    const covers   = checks.reduce((s,c)=>s+(c.covers||1),0);
    const takeaway = orderQueue.filter(o=>o.type==='takeaway'&&o.status==='collected').length;
    return { revenue, cash, card, tips, refunds, covers, checks:checks.length, takeaway };
  }, [closedChecks, orderQueue]);

  // v4.6.32: today's petty cash ledger activity (excluding cash_sale which is
  // already covered by today.cash, and drawer_open which is neutral).
  const pcToday = useMemo(() => {
    const sod = new Date(); sod.setHours(0,0,0,0);
    const items = (pettyCashEntries || []).filter(e => (e.timestamp || 0) >= sod.getTime());
    const sumOf = (type) => items.filter(e => e.type === type).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return {
      floats:      sumOf('float'),
      drops:       sumOf('drop'),
      expenses:    sumOf('expense'),
      adjustments: sumOf('adjustment'),
      items,
    };
  }, [pettyCashEntries]);

  const cashInDrawer  = DENOMS.reduce((s,d)=>s+(counts[d.value]||0)*d.value, 0);
  // v4.6.32: expected = opening float + cash sales + mid-service floats
  //                   − cash drops − cash expenses + manual adjustments
  const expectedCash  = parseFloat(float||0) + today.cash + pcToday.floats - pcToday.drops - pcToday.expenses + pcToday.adjustments;
  const variance      = cashInDrawer - expectedCash;
  const floatAmt      = parseFloat(float||0);

  const fmt  = n => `£${Math.abs(n).toFixed(2)}`;
  const fmtS = n => `${n>=0?'+':'−'}${fmt(n)}`;

  const setCount = (val, n) => setCounts(c=>({...c,[val]:Math.max(0,parseInt(n)||0)}));

  const doZRead = () => {
    // v4.6.32: if the counted drawer differs from expected, write an
    // 'adjustment' petty cash entry so the ledger carries the variance
    // forward. Sign of adjustment = sign of variance (drawer over expected
    // → positive, short → negative).
    if (Math.abs(variance) >= 0.01 && typeof addPettyCashEntry === 'function') {
      addPettyCashEntry({
        type: 'adjustment',
        amount: Math.abs(variance),
        reason: variance > 0
          ? `Z-read variance · drawer over by ${fmt(Math.abs(variance))}`
          : `Z-read variance · drawer short by ${fmt(Math.abs(variance))}`,
        note: `Float £${parseFloat(float||0).toFixed(2)} · counted £${cashInDrawer.toFixed(2)} · expected £${expectedCash.toFixed(2)}`,
      });
    }
    setStep('done');
    setZDone(true);
    showToast(
      Math.abs(variance) < 0.01
        ? 'Z-read complete — till cleared, drawer balanced'
        : `Z-read complete — variance ${fmtS(variance)} logged to petty cash`,
      Math.abs(variance) < 0.01 ? 'success' : 'warning'
    );
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── Left: Cash declaration ─────────────────────────── */}
      <div style={{ width:320, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>Cash declaration</div>
          <div style={{ fontSize:11, color:'var(--t3)' }}>Count the physical cash in the drawer</div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'10px 12px' }}>
          {/* Opening float */}
          <div style={{ marginBottom:12, padding:'8px 10px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>Opening float</div>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontWeight:700, color:'var(--t3)' }}>£</span>
              <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft:22, width:'100%' }} value={float} onChange={e=>setFloat(e.target.value)}/>
            </div>
          </div>

          {/* Denomination counts */}
          <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Count by denomination</div>
          {DENOMS.map(d => {
            const qty   = counts[d.value]||0;
            const total = qty * d.value;
            return (
              <div key={d.value} style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px', gap:6, alignItems:'center', marginBottom:5 }}>
                <div style={{ fontSize:12, color:'var(--t2)', fontWeight:500 }}>{d.label}</div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <button onClick={()=>setCount(d.value,qty-1)} style={{ width:24,height:24,borderRadius:5,border:'1px solid var(--bdr2)',background:'var(--bg3)',color:'var(--t2)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
                  <input type="number" min="0" style={{ ...inp, width:44, padding:'4px 6px', textAlign:'center', fontSize:13 }} value={qty||''} placeholder="0" onChange={e=>setCount(d.value,e.target.value)}/>
                  <button onClick={()=>setCount(d.value,qty+1)} style={{ width:24,height:24,borderRadius:5,border:'1px solid var(--bdr2)',background:'var(--bg3)',color:'var(--t2)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:total>0?'var(--acc)':'var(--t4)', textAlign:'right', fontFamily:'var(--font-mono)' }}>
                  {total>0?fmt(total):'-'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cash total */}
        <div style={{ padding:'10px 14px', borderTop:'1px solid var(--bdr)', background:'var(--bg2)', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:12, color:'var(--t3)' }}>Cash in drawer</span>
            <span style={{ fontSize:18, fontWeight:900, color:'var(--t1)', fontFamily:'var(--font-mono)' }}>{fmt(cashInDrawer)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:11, color:'var(--t4)' }}>Expected (float + cash sales)</span>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--t3)', fontFamily:'var(--font-mono)' }}>{fmt(expectedCash)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', borderRadius:8, background:Math.abs(variance)<0.01?'var(--grn-d)':variance>0?'var(--acc-d)':'var(--red-d)', border:`1px solid ${Math.abs(variance)<0.01?'var(--grn-b)':variance>0?'var(--acc-b)':'var(--red-b)'}` }}>
            <span style={{ fontSize:11, fontWeight:700, color:Math.abs(variance)<0.01?'var(--grn)':variance>0?'var(--acc)':'var(--red)' }}>Variance</span>
            <span style={{ fontSize:14, fontWeight:900, fontFamily:'var(--font-mono)', color:Math.abs(variance)<0.01?'var(--grn)':variance>0?'var(--acc)':'var(--red)' }}>
              {Math.abs(variance)<0.01 ? '✓ Balanced' : `${variance>0?'Over':'Short'} ${fmt(variance)}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Right: Z-Read summary ──────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:1 }}>End of Day — Z-Read</div>
            <div style={{ fontSize:11, color:'var(--t3)' }}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
          {!zDone && (
            <button onClick={doZRead} style={{ padding:'8px 18px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', background:'var(--red)', border:'none', color:'#fff', fontSize:13, fontWeight:800 }}>
              🔒 Run Z-Read & Close
            </button>
          )}
          {zDone && <div style={{ padding:'8px 16px', borderRadius:10, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)', fontSize:13, fontWeight:800 }}>✓ Z-Read complete</div>}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
          {/* Revenue summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'Total revenue',  value:fmt(today.revenue),   color:'var(--acc)', icon:'💰' },
              { label:'Cash',           value:fmt(today.cash),      color:'var(--grn)', icon:'💵' },
              { label:'Card / other',   value:fmt(today.card),      color:'#3b82f6',    icon:'💳' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ padding:'12px 14px', background:'var(--bg2)', borderRadius:12, border:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{icon} {label}</div>
                <div style={{ fontSize:20, fontWeight:900, color, fontFamily:'var(--font-mono)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Detail table */}
          <div style={{ background:'var(--bg1)', borderRadius:12, border:'1px solid var(--bdr)', overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', fontSize:11, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', background:'var(--bg2)' }}>Sales breakdown</div>
            {[
              ['Checks processed',   today.checks.toString()],
              ['Covers served',      today.covers.toString()],
              ['Takeaway orders',    today.takeaway.toString()],
              ['Average check',      today.checks>0 ? fmt(today.revenue/today.checks) : '—'],
              ['Average per cover',  today.covers>0 ? fmt(today.revenue/today.covers) : '—'],
              ['Tips collected',     fmt(today.tips)],
              ['Refunds issued',     fmt(today.refunds)],
              ['Net revenue',        fmt(today.revenue - today.refunds)],
            ].map(([label, value], i) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 14px', borderBottom:i<7?'1px solid var(--bdr)':'none', background:i%2===0?'transparent':'var(--bg2)' }}>
                <span style={{ fontSize:12, color:'var(--t3)' }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)', fontFamily:'var(--font-mono)' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Cash reconciliation */}
          <div style={{ background:'var(--bg1)', borderRadius:12, border:'1px solid var(--bdr)', overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', fontSize:11, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', background:'var(--bg2)' }}>Cash reconciliation</div>
            {[
              ['Opening float',      fmt(floatAmt)],
              ['Cash sales today',   fmt(today.cash)],
              ['Extra floats (+)',   pcToday.floats      > 0 ? fmt(pcToday.floats)      : '—'],
              ['Cash drops (−)',     pcToday.drops       > 0 ? fmt(pcToday.drops)       : '—'],
              ['Cash expenses (−)',  pcToday.expenses    > 0 ? fmt(pcToday.expenses)    : '—'],
              ['Adjustments',        pcToday.adjustments !== 0 ? fmtS(pcToday.adjustments) : '—'],
              ['Expected in drawer', fmt(expectedCash)],
              ['Counted cash',       fmt(cashInDrawer)],
              ['Variance',           Math.abs(variance)<0.01 ? '✓ Balanced' : fmtS(variance)],
              ['Banking (drawer − new float)', cashInDrawer>floatAmt ? fmt(cashInDrawer-floatAmt) : '—'],
            ].map(([label, value], i) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'9px 14px', borderBottom:i<9?'1px solid var(--bdr)':'none', background:i%2===0?'transparent':'var(--bg2)' }}>
                <span style={{ fontSize:12, color:'var(--t3)' }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:700, color:label==='Variance'?(Math.abs(variance)<0.01?'var(--grn)':variance>0?'var(--acc)':'var(--red)'):'var(--t1)', fontFamily:'var(--font-mono)' }}>{value}</span>
              </div>
            ))}
          </div>

          {zDone && (
            <div style={{ padding:'14px 16px', background:'var(--grn-d)', borderRadius:12, border:'1px solid var(--grn-b)', textAlign:'center' }}>
              <div style={{ fontSize:20, marginBottom:6 }}>✓</div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--grn)', marginBottom:4 }}>Z-Read complete</div>
              <div style={{ fontSize:11, color:'var(--grn)', opacity:.8 }}>Till cleared · Totals reset for next trading day</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
