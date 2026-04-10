import { useState, useEffect } from 'react';
import { ALLERGENS } from '../data/seed';

// ─── Tip selector ─────────────────────────────────────────────────────────────
function TipPicker({ total, onSelect }) {
  const [custom, setCustom] = useState('');
  const presets = [0, 10, 12.5, 15, 20];
  const [active, setActive] = useState(12.5);

  const tipAmt = custom !== '' ? (parseFloat(custom)||0) : total * active / 100;

  const pick = (pct) => { setActive(pct); setCustom(''); };

  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Add gratuity</div>

      {/* Preset grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:5, marginBottom:12 }}>
        {presets.map(p=>(
          <button key={p} onClick={()=>pick(p)} style={{
            padding:'9px 4px', borderRadius:9, cursor:'pointer', textAlign:'center', fontFamily:'inherit',
            border:`1.5px solid ${active===p&&custom===''?'var(--acc)':'var(--bdr)'}`,
            background:active===p&&custom===''?'var(--acc-d)':'var(--bg3)',
          }}>
            <div style={{ fontSize:13, fontWeight:700, color:active===p&&custom===''?'var(--acc)':'var(--t1)' }}>{p===0?'None':`${p}%`}</div>
            {p>0&&<div style={{ fontSize:10, color:'var(--t3)', marginTop:1 }}>£{(total*p/100).toFixed(2)}</div>}
          </button>
        ))}
      </div>

      {/* Custom */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <span style={{ fontSize:15, color:'var(--t3)', fontWeight:600 }}>£</span>
        <input type="number" value={custom} onChange={e=>{setCustom(e.target.value);setActive(null);}} placeholder="Custom amount" className="input" style={{ fontSize:15 }}/>
      </div>

      {/* Summary row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg3)', borderRadius:10, marginBottom:14 }}>
        <span style={{ fontSize:13, color:'var(--t3)' }}>Tip</span>
        <span style={{ fontSize:15, fontWeight:700, color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>+£{tipAmt.toFixed(2)}</span>
      </div>

      <button className="btn btn-acc btn-full" style={{ height:46 }}
        onClick={()=>onSelect(tipAmt)}>
        Confirm · total £{(total+tipAmt).toFixed(2)} →
      </button>
    </div>
  );
}

// ─── Card terminal screen ─────────────────────────────────────────────────────
function CardTerminal({ grand, onComplete, onBack }) {
  const [state, setState] = useState('waiting');  // waiting | approved

  useEffect(()=>{
    if(state==='approved'){
      const t = setTimeout(onComplete, 800);
      return ()=>clearTimeout(t);
    }
  },[state]);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'24px 0 8px' }}>
      {state==='waiting'&&(
        <>
          <div style={{ position:'relative', width:100, height:100, marginBottom:20 }}>
            <div style={{ width:100, height:100, borderRadius:'50%', border:'3px solid var(--bdr2)', position:'absolute' }}/>
            <div style={{ width:100, height:100, borderRadius:'50%', border:'3px solid transparent', borderTopColor:'var(--acc)', position:'absolute', animation:'spin 1s linear infinite' }}/>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>💳</div>
          </div>
          <div style={{ fontSize:34, fontWeight:800, color:'var(--t1)', fontFamily:'DM Mono,monospace', marginBottom:6 }}>£{grand.toFixed(2)}</div>
          <div style={{ fontSize:14, color:'var(--t3)', marginBottom:6 }}>Present card to Stripe Reader S700</div>
          <div style={{ fontSize:12, color:'var(--t4)', marginBottom:28 }}>Tap · Chip · Contactless · Apple Pay · Google Pay</div>

          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', background:'var(--acc-d)', border:'1px solid var(--acc-b)', borderRadius:20, fontSize:12, color:'var(--acc)', marginBottom:28 }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:'var(--acc)',animation:'pulse 1.5s ease-in-out infinite'}}/>
            Waiting for card…
          </div>

          <div style={{ display:'flex', gap:8, width:'100%' }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onBack}>← Back</button>
            <button className="btn btn-grn" style={{ flex:2, height:46 }} onClick={()=>setState('approved')}>
              Simulate payment ✓
            </button>
          </div>
        </>
      )}

      {state==='approved'&&(
        <>
          <div style={{ width:80,height:80,borderRadius:'50%',background:'var(--grn-d)',border:'2px solid var(--grn)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,marginBottom:16 }}>✓</div>
          <div style={{ fontSize:26, fontWeight:800, color:'var(--grn)', marginBottom:6 }}>Approved</div>
          <div style={{ fontSize:14, color:'var(--t3)' }}>£{grand.toFixed(2)} charged</div>
        </>
      )}
    </div>
  );
}

// ─── Cash transaction screen ──────────────────────────────────────────────────
function CashTransaction({ grand, onComplete, onBack }) {
  const [entered, setEntered] = useState('');

  const tendered = parseFloat(entered) || 0;
  const change   = Math.max(0, tendered - grand);
  const isValid  = tendered >= grand;

  // Numpad
  const press = (d) => {
    if (d === '⌫') { setEntered(p => p.slice(0,-1)); return; }
    if (d === '.' && entered.includes('.')) return;
    if (entered.includes('.') && entered.split('.')[1]?.length >= 2) return;
    setEntered(p => p + d);
  };

  // Quick cash — round up to next note + exact
  const quickAmounts = [
    ...([5,10,20,50].filter(n => n >= grand)),
    Math.ceil(grand),
    Math.ceil(grand/5)*5,
  ].filter((v,i,a) => a.indexOf(v)===i).sort((a,b)=>a-b).slice(0,5);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Due amount */}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        <div style={{ fontSize:12, color:'var(--t3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Amount due</div>
        <div style={{ fontSize:40, fontWeight:800, color:'var(--t1)', fontFamily:'DM Mono,monospace' }}>£{grand.toFixed(2)}</div>
      </div>

      {/* Change display */}
      <div style={{
        height:72, borderRadius:14, marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px',
        background: isValid ? 'var(--grn-d)' : entered ? 'var(--red-d)' : 'var(--bg3)',
        border: `1.5px solid ${isValid ? 'var(--grn-b)' : entered ? 'var(--red-b)' : 'var(--bdr)'}`,
        transition: 'all .2s',
      }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:isValid?'var(--grn)':entered?'var(--red)':'var(--t3)' }}>
            {isValid ? 'Change due' : entered ? 'Short by' : 'Cash tendered'}
          </div>
          <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>
            {entered ? `£${tendered.toFixed(2)} tendered` : 'Enter amount or tap quick cash'}
          </div>
        </div>
        <div style={{ fontSize:32, fontWeight:800, fontFamily:'DM Mono,monospace', color:isValid?'var(--grn)':entered?'var(--red)':'var(--t4)' }}>
          {isValid ? `£${change.toFixed(2)}` : entered ? `£${(grand-tendered).toFixed(2)}` : '—'}
        </div>
      </div>

      {/* Quick cash buttons */}
      <div style={{ display:'flex', gap:5, marginBottom:12 }}>
        {quickAmounts.map(a=>(
          <button key={a} onClick={()=>setEntered(String(a))} style={{
            flex:1, padding:'7px 4px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
            background: entered===String(a) ? 'var(--acc-d)' : 'var(--bg3)',
            border: `1px solid ${entered===String(a)?'var(--acc)':'var(--bdr2)'}`,
            color: entered===String(a)?'var(--acc)':'var(--t2)',
            fontSize:12, fontWeight:700,
          }}>£{Number.isInteger(a)?a:a.toFixed(2)}</button>
        ))}
        <button onClick={()=>setEntered(grand.toFixed(2))} style={{
          flex:1.2, padding:'7px 4px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
          background: entered===grand.toFixed(2)?'var(--acc-d)':'var(--bg3)',
          border: `1px solid ${entered===grand.toFixed(2)?'var(--acc)':'var(--bdr2)'}`,
          color: entered===grand.toFixed(2)?'var(--acc)':'var(--t2)',
          fontSize:11, fontWeight:700,
        }}>Exact</button>
      </div>

      {/* Numpad */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:12 }}>
        {[7,8,9,4,5,6,1,2,3,'.',0,'⌫'].map((d,i)=>(
          <button key={i} onClick={()=>press(String(d))} style={{
            height:52, borderRadius:10, cursor:'pointer', fontFamily:'inherit',
            background: d==='⌫'?'var(--red-d)':'var(--bg3)',
            border: `1px solid ${d==='⌫'?'var(--red-b)':'var(--bdr2)'}`,
            color: d==='⌫'?'var(--red)':'var(--t1)',
            fontSize: d==='⌫'?18:20, fontWeight:700,
          }}>{d}</button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={onBack}>← Back</button>
        <button className="btn btn-grn" style={{ flex:2, height:46 }}
          disabled={!isValid}
          onClick={()=>onComplete(tendered)}>
          {isValid ? `Complete · change £${change.toFixed(2)}` : 'Enter cash amount'}
        </button>
      </div>
    </div>
  );
}

// ─── Split check screen ───────────────────────────────────────────────────────
function SplitCheck({ grand, covers, onComplete, onBack }) {
  const [splits, setSplits] = useState(Math.max(2, covers));
  const each = grand / splits;

  return (
    <div>
      <div style={{ fontSize:13, color:'var(--t3)', marginBottom:14 }}>Split £{grand.toFixed(2)} between:</div>
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {[2,3,4,5,6,7,8].map(n=>(
          <button key={n} onClick={()=>setSplits(n)} style={{
            flex:1, padding:'10px 4px', borderRadius:9, cursor:'pointer', textAlign:'center', fontFamily:'inherit',
            border:`1.5px solid ${splits===n?'var(--acc)':'var(--bdr)'}`,
            background:splits===n?'var(--acc-d)':'var(--bg3)',
          }}>
            <div style={{ fontSize:16, fontWeight:700, color:splits===n?'var(--acc)':'var(--t1)' }}>{n}</div>
          </button>
        ))}
      </div>
      <div style={{ background:'var(--bg3)', borderRadius:12, padding:'14px 18px', marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13, color:'var(--t3)' }}>
          <span>Total</span><span>£{grand.toFixed(2)}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:500 }}>Each person pays</span>
          <span style={{ fontSize:28, fontWeight:800, color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>£{each.toFixed(2)}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-ghost" style={{ flex:1 }} onClick={onBack}>← Back</button>
        <button className="btn btn-grn" style={{ flex:2, height:44 }} onClick={()=>onComplete()}>Mark all paid ✓</button>
      </div>
    </div>
  );
}

// ─── Main CheckoutModal ───────────────────────────────────────────────────────
export default function CheckoutModal({ items, subtotal, service, total, orderType, covers, tableId, tabName, onClose, onComplete }) {
  const [screen, setScreen] = useState('review'); // review|card_tip|card_terminal|cash|split
  const [tipAmt, setTipAmt] = useState(0);
  const [payMethod, setPayMethod] = useState('card');

  const isBarTab = orderType==='bar-tab';
  // Bar tabs and takeaway: no tip prompt on card, go straight to terminal
  const skipTip  = isBarTab || orderType==='takeaway' || orderType==='collection';

  const grand = total + tipAmt;

  const complete = (method, tip=tipAmt, tendered=null) => {
    onComplete({ method: method||payMethod, tip, grand: total+tip, tendered });
  };

  const handleCardPress = () => {
    setPayMethod('card');
    if (skipTip) setScreen('card_terminal');
    else setScreen('card_tip');
  };

  const handleCashPress = () => {
    setPayMethod('cash');
    setScreen('cash');
  };

  const handleTipConfirm = (tip) => {
    setTipAmt(tip);
    setScreen('card_terminal');
  };

  const handleCashComplete = (tendered) => {
    complete('cash', 0, tendered);
  };

  const nonVoided = items.filter(i=>!i.voided);

  return (
    <div className="modal-back">
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:24,
        width:'100%', maxWidth:520, maxHeight:'94vh',
        display:'flex', flexDirection:'column',
        boxShadow:'var(--sh3)', overflow:'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding:'16px 22px 12px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--t1)' }}>
              {screen==='review'?'Checkout'
              :screen==='card_tip'?'Add tip'
              :screen==='card_terminal'?'Card payment'
              :screen==='cash'?'Cash payment'
              :'Split check'}
            </div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>
              {isBarTab ? `Bar tab · ${tabName}`
               : tableId ? `Table ${tableId.replace(/^[tbp]/,'')} · ${orderType}${covers>1?` · ${covers} covers`:''}`
               : orderType}
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {screen!=='review'&&<button className="btn btn-ghost btn-sm" onClick={()=>setScreen('review')}>← Back</button>}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>

          {/* ══ REVIEW ══════════════════════════════════════════════ */}
          {screen==='review'&&(
            <>
              {/* Bill items */}
              <div style={{ marginBottom:16 }}>
                {nonVoided.map(item=>{
                  const disc = item.discount;
                  const price = disc
                    ? (disc.type==='percent' ? item.price*(1-disc.value/100) : Math.max(0,item.price-disc.value/item.qty))
                    : item.price;
                  return(
                    <div key={item.uid} style={{ display:'flex', justifyContent:'space-between', gap:8, paddingBottom:9, marginBottom:9, borderBottom:'1px solid var(--bdr)' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:500, color:'var(--t1)' }}>{item.qty>1?`${item.qty}× `:''}{item.name}</div>
                        {item.mods?.map((m,i)=><div key={i} style={{ fontSize:11, color:'var(--t3)', display:'flex', justifyContent:'space-between', marginTop:1 }}><span>{m.groupLabel?`${m.groupLabel}: ${m.label}`:m.label}</span>{m.price>0&&<span>+£{m.price.toFixed(2)}</span>}</div>)}
                        {item.notes&&<div style={{ fontSize:11, color:'#f97316', marginTop:2 }}>📝 {item.notes}</div>}
                        {disc&&<div style={{ fontSize:11, color:'var(--grn)', marginTop:2 }}>🏷 {disc.label}</div>}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>£{(price*item.qty).toFixed(2)}</div>
                        {disc&&<div style={{ fontSize:11, color:'var(--t4)', textDecoration:'line-through', fontFamily:'DM Mono,monospace' }}>£{(item.price*item.qty).toFixed(2)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div style={{ background:'var(--bg3)', borderRadius:14, padding:'14px 16px', marginBottom:22 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--t3)', marginBottom:4 }}><span>Subtotal</span><span style={{ fontFamily:'DM Mono,monospace' }}>£{subtotal.toFixed(2)}</span></div>
                {service>0
                  ? <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--t3)', marginBottom:4 }}><span>Service charge (12.5%)</span><span style={{ fontFamily:'DM Mono,monospace' }}>£{service.toFixed(2)}</span></div>
                  : <div style={{ fontSize:12, color:'var(--grn)', marginBottom:4 }}>No service charge · {isBarTab?'bar tab':orderType}</div>
                }
                <div style={{ height:1, background:'var(--bdr)', margin:'10px 0' }}/>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:22, fontWeight:800 }}>
                  <span>Total</span>
                  <span style={{ color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>£{total.toFixed(2)}</span>
                </div>
              </div>

              {/* ── PRIMARY PAYMENT BUTTONS ── */}
              <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                {/* CARD */}
                <button onClick={handleCardPress} style={{
                  flex:1, padding:'20px 14px', borderRadius:16, cursor:'pointer', fontFamily:'inherit',
                  background:'linear-gradient(135deg,#1a2744,#0f1a35)',
                  border:'1px solid rgba(100,140,255,.3)',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                  transition:'all .15s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(60,100,255,.2)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                  <div style={{ fontSize:34 }}>💳</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#e8f0ff' }}>Card</div>
                  <div style={{ fontSize:11, color:'rgba(200,210,255,.6)' }}>Tap, chip or contactless</div>
                  {!skipTip&&<div style={{ fontSize:10, color:'rgba(200,210,255,.4)', marginTop:2 }}>Includes tip step</div>}
                </button>

                {/* CASH */}
                <button onClick={handleCashPress} style={{
                  flex:1, padding:'20px 14px', borderRadius:16, cursor:'pointer', fontFamily:'inherit',
                  background:'linear-gradient(135deg,#162a1a,#0d1f10)',
                  border:'1px solid rgba(60,180,80,.3)',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                  transition:'all .15s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(40,160,60,.2)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
                  <div style={{ fontSize:34 }}>💵</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#d4f0d8' }}>Cash</div>
                  <div style={{ fontSize:11, color:'rgba(160,210,170,.6)' }}>Change calculated</div>
                  <div style={{ fontSize:10, color:'rgba(160,210,170,.4)', marginTop:2 }}>Instant, no tip</div>
                </button>
              </div>

              {/* Split — secondary */}
              <button onClick={()=>setScreen('split')} style={{
                width:'100%', padding:'12px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                background:'transparent', border:'1px solid var(--bdr2)',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10, color:'var(--t3)', fontSize:13, fontWeight:500,
              }}>
                <span>⚖</span> Split check between {covers} {covers===1?'guest':'guests'}
              </button>
            </>
          )}

          {/* ══ CARD TIP ══════════════════════════════════════════== */}
          {screen==='card_tip'&&(
            <TipPicker total={total} onSelect={handleTipConfirm}/>
          )}

          {/* ══ CARD TERMINAL ═════════════════════════════════════== */}
          {screen==='card_terminal'&&(
            <CardTerminal
              grand={grand}
              onComplete={()=>complete('card')}
              onBack={()=>setScreen(skipTip?'review':'card_tip')}
            />
          )}

          {/* ══ CASH ════════════════════════════════════════════════ */}
          {screen==='cash'&&(
            <CashTransaction
              grand={total}
              onComplete={handleCashComplete}
              onBack={()=>setScreen('review')}
            />
          )}

          {/* ══ SPLIT ═══════════════════════════════════════════════ */}
          {screen==='split'&&(
            <SplitCheck
              grand={total}
              covers={covers}
              onComplete={()=>complete('split')}
              onBack={()=>setScreen('review')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
