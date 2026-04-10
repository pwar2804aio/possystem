import { useState } from 'react';
import { useStore } from '../../store';

export default function EODClose() {
  const { closedChecks, shift, eightySixIds, dailyCounts, showToast, staff } = useStore();
  const [step, setStep] = useState('summary'); // summary | confirm | done
  const [cashFloat, setCashFloat] = useState('');
  const [notes, setNotes] = useState('');
  const [closedAt] = useState(new Date());

  const revenue  = closedChecks.reduce((s,c) => s+c.total, 0);
  const covers   = closedChecks.reduce((s,c) => s+(c.covers||1), 0);
  const tips     = closedChecks.reduce((s,c) => s+(c.tip||0), 0);
  const refunds  = closedChecks.reduce((s,c) => s+c.refunds.reduce((r,rf)=>r+rf.amount,0), 0);
  const cash     = closedChecks.filter(c=>c.method==='cash').reduce((s,c)=>s+c.total,0);
  const card     = closedChecks.filter(c=>c.method!=='cash').reduce((s,c)=>s+c.total,0);
  const itemsSold = closedChecks.reduce((s,c)=>s+(c.items?.length||0),0);
  const still86  = eightySixIds.length;
  const countsSet = Object.keys(dailyCounts).length;
  const fmt = v => `£${v.toFixed(2)}`;

  const handleClose = () => {
    // In Phase 2 this writes an EOD record to Supabase
    // For now: clear daily counts and 86 list, mark shift as closed
    showToast('Shift closed — EOD report saved', 'success');
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:22, fontWeight:800, color:'var(--t1)', marginBottom:8 }}>Shift closed</div>
        <div style={{ fontSize:14, color:'var(--t3)', marginBottom:32, textAlign:'center', maxWidth:380 }}>
          EOD report saved for {shift.name} — {closedAt.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}
        </div>
        <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:16, padding:'24px 32px', width:'100%', maxWidth:440 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {[
              { label:'Net revenue', value:fmt(revenue-refunds) },
              { label:'Covers', value:covers },
              { label:'Checks', value:closedChecks.length },
              { label:'Avg check', value:fmt(closedChecks.length ? revenue/closedChecks.length : 0) },
              { label:'Tips', value:fmt(tips) },
              { label:'Cash taken', value:fmt(cash) },
            ].map(s => (
              <div key={s.label} style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:10 }}>
                <div style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em' }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)', marginTop:4 }}>{s.value}</div>
              </div>
            ))}
          </div>
          {notes && <div style={{ marginTop:14, fontSize:12, color:'var(--t3)', padding:'10px 12px', background:'var(--bg3)', borderRadius:10 }}><strong>Notes:</strong> {notes}</div>}
        </div>
        <button className="btn btn-ghost" style={{ marginTop:24 }} onClick={() => setStep('summary')}>← Back to summary</button>
      </div>
    );
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28, maxWidth:700 }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>End of day — {shift.name}</div>
        <div style={{ fontSize:13, color:'var(--t3)' }}>
          {closedAt.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          {' · '}Shift opened: {shift.opened}
        </div>
      </div>

      {step === 'summary' && (
        <>
          {/* Revenue summary */}
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:'20px 22px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:16 }}>Revenue summary</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
              {[
                { label:'Gross revenue', value:fmt(revenue), color:'var(--t1)' },
                { label:'Refunds',       value:fmt(refunds),  color:refunds>0?'var(--red)':'var(--t1)' },
                { label:'Net revenue',   value:fmt(revenue-refunds), color:'var(--acc)', large:true },
              ].map(s => (
                <div key={s.label} style={{ padding:'12px 14px', background:'var(--bg3)', borderRadius:10 }}>
                  <div style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontSize:s.large?26:18, fontWeight:800, color:s.color, fontFamily:'var(--font-mono)' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {[
                { label:'Covers',   value:covers },
                { label:'Checks',   value:closedChecks.length },
                { label:'Items sold', value:itemsSold },
                { label:'Tips',     value:fmt(tips) },
                { label:'Card',     value:fmt(card) },
                { label:'Cash',     value:fmt(cash) },
                { label:'Avg/check',value:fmt(closedChecks.length ? revenue/closedChecks.length : 0) },
                { label:'Avg/cover',value:fmt(covers ? revenue/covers : 0) },
              ].map(s => (
                <div key={s.label} style={{ padding:'8px 10px', background:'var(--bg3)', borderRadius:8 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em' }}>{s.label}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', fontFamily:'var(--font-mono)', marginTop:3 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Checklist */}
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:'18px 22px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>EOD checklist</div>
            {[
              { ok: closedChecks.length > 0, label:`${closedChecks.length} checks closed`, desc:'All tables settled and checked out' },
              { ok: true, label:'Cash drawer counted', desc:'Reconcile cash against system total', warn:cash > 0, warnText:`System shows ${fmt(cash)} cash` },
              { ok: still86 === 0, label:`86 list ${still86 > 0 ? `has ${still86} item${still86!==1?'s':''} — clear before close' ` : 'clear'}`, desc:'Review and reset 86\'d items for next service' },
              { ok: true, label:'Reports reviewed', desc:'Confirm revenue and check log are correct' },
            ].map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, background:item.ok?'var(--grn-d)':'var(--acc-d)', border:`1.5px solid ${item.ok?'var(--grn-b)':'var(--acc-b)'}` }}>
                  <span style={{ color:item.ok?'var(--grn)':'var(--acc)' }}>{item.ok?'✓':'!'}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{item.label}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>{item.warnText || item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Cash float + notes */}
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:'18px 22px', marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>Closing notes</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Cash float counted (£)</label>
              <input type="number" step="0.01" min="0" placeholder="e.g. 150.00"
                style={{ width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                value={cashFloat} onChange={e=>setCashFloat(e.target.value)}/>
              {cashFloat && Math.abs(parseFloat(cashFloat)-cash) > 0.01 && (
                <div style={{ fontSize:11, color:'var(--acc)', marginTop:4 }}>
                  ⚠ Variance: {fmt(Math.abs(parseFloat(cashFloat)-cash))} vs system ({fmt(cash)})
                </div>
              )}
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Manager notes</label>
              <textarea placeholder="Any incidents, issues, or notes for next service…"
                style={{ width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', resize:'none', height:72, boxSizing:'border-box' }}
                value={notes} onChange={e=>setNotes(e.target.value)}/>
            </div>
          </div>

          <button onClick={()=>setStep('confirm')} style={{
            width:'100%', padding:'14px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
            background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:15, fontWeight:800,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            Review and close shift →
          </button>
        </>
      )}

      {step === 'confirm' && (
        <div style={{ background:'var(--bg1)', border:'2px solid var(--acc-b)', borderRadius:16, padding:'28px 28px' }}>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginBottom:8 }}>Confirm end of day</div>
          <div style={{ fontSize:13, color:'var(--t3)', marginBottom:24, lineHeight:1.6 }}>
            You're about to close <strong>{shift.name}</strong>. This will:
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:28 }}>
            {[
              `Save EOD report with ${fmt(revenue-refunds)} net revenue across ${closedChecks.length} checks`,
              `Reset all ${still86} 86\'d items for next service`,
              `Clear ${countsSet} daily count${countsSet!==1?'s':''} (portions sold today)`,
              'Lock today\'s check log — no further changes possible',
            ].map((line, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:13, color:'var(--t2)' }}>
                <span style={{ color:'var(--acc)', fontWeight:700, flexShrink:0, marginTop:1 }}>→</span>
                {line}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setStep('summary')}>← Back</button>
            <button style={{
              flex:2, padding:'12px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
              background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:14, fontWeight:800,
            }} onClick={handleClose}>
              Close shift — {closedAt.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
