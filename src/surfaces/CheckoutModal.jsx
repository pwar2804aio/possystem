import { useState } from 'react';
import { ALLERGENS } from '../data/seed';

export default function CheckoutModal({ items, subtotal, service, total, orderType, covers, tableId, onClose, onComplete }) {
  const [step, setStep]       = useState('review');   // review | tip | method | card | cash | split
  const [tipPct, setTipPct]   = useState(orderType==='dine-in' ? 12.5 : 0);
  const [customTip, setCustomTip] = useState('');
  const [cash, setCash]       = useState('');
  const [splits, setSplits]   = useState(2);

  const tipAmt  = customTip !== '' ? (parseFloat(customTip)||0) : subtotal * tipPct / 100;
  const grand   = total + tipAmt;
  const change  = cash ? Math.max(0, parseFloat(cash) - grand) : 0;

  const STEPS = { review:'Review', tip:'Tip', method:'Payment', card:'Card', cash:'Cash', split:'Split' };

  return (
    <div className="modal-back">
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:24,
        width:'100%', maxWidth:480, maxHeight:'92vh', overflow:'auto',
        boxShadow:'var(--sh3)',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700 }}>Checkout</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>
              {tableId ? `Table ${tableId.replace(/^[tbp]/,'')} · ` : ''}{orderType} {orderType==='dine-in'&&covers>1?`· ${covers} covers`:''}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {step!=='review' && <button className="btn btn-ghost btn-sm" onClick={()=>setStep('review')}>← Back</button>}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </div>

        {/* Step tabs */}
        <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--bdr)', overflowX:'auto' }}>
          {['review','tip','method'].map((s,i) => (
            <div key={s} style={{
              flex:1, padding:'10px 8px', textAlign:'center', fontSize:12, fontWeight:500,
              color: step===s?'var(--acc)':'var(--t3)',
              borderBottom: step===s?'2px solid var(--acc)':'2px solid transparent',
              cursor: i===0||step!=='review' ? 'pointer':'default',
            }} onClick={() => (i===0||step!=='review')&&setStep(s)}>
              {i+1}. {STEPS[s]}
            </div>
          ))}
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* ── REVIEW ── */}
          {step==='review' && (
            <>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Order items</div>
                {items.map(item => (
                  <div key={item.uid} style={{ borderBottom:'1px solid var(--bdr)', paddingBottom:10, marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:500 }}>{item.qty>1?`${item.qty}× `:''}{item.name}</div>
                        {item.mods?.map((m,i) => (
                          <div key={i} style={{ fontSize:12, color:'var(--t3)', marginTop:2, display:'flex', justifyContent:'space-between' }}>
                            <span>{m.groupLabel?`${m.groupLabel}: ${m.label}`:m.label}</span>
                            {m.price>0&&<span>+£{m.price.toFixed(2)}</span>}
                          </div>
                        ))}
                        {item.notes && <div style={{ fontSize:11, color:'#f97316', marginTop:2 }}>📝 {item.notes}</div>}
                        {item.allergens?.length>0 && (
                          <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>
                            ⚠ {item.allergens.map(a=>ALLERGENS.find(x=>x.id===a)?.label).filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--acc)', whiteSpace:'nowrap' }}>
                        £{(item.price * item.qty).toFixed(2)}
                      </div>
                    </div>
                    {item.qty>1 && <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>£{item.price.toFixed(2)} each</div>}
                  </div>
                ))}
              </div>

              <div style={{ background:'var(--bg3)', borderRadius:12, padding:'12px 16px', marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--t3)', marginBottom:4 }}>
                  <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
                </div>
                {service>0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--t3)', marginBottom:4 }}>
                    <span>Service charge (12.5%)</span><span>£{service.toFixed(2)}</span>
                  </div>
                )}
                {service===0 && (
                  <div style={{ fontSize:12, color:'var(--grn)', marginBottom:4 }}>No service charge · {orderType}</div>
                )}
                <div style={{ height:1, background:'var(--bdr)', margin:'8px 0' }}/>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:17, fontWeight:700 }}>
                  <span>Total</span><span style={{ color:'var(--acc)' }}>£{total.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { setSplits(2); setStep('split'); }}>Split check</button>
                <button className="btn btn-acc" style={{ flex:2 }} onClick={() => setStep('tip')}>Add tip →</button>
              </div>
            </>
          )}

          {/* ── TIP ── */}
          {step==='tip' && (
            <>
              <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Add a tip?</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:16 }}>
                {[0,10,12.5,15,20].map(p => (
                  <button key={p} onClick={() => { setTipPct(p); setCustomTip(''); }} style={{
                    padding:'10px 4px', borderRadius:10, cursor:'pointer', textAlign:'center', fontFamily:'inherit',
                    border:`1.5px solid ${tipPct===p&&customTip===''?'var(--acc)':'var(--bdr)'}`,
                    background:tipPct===p&&customTip===''?'var(--acc-d)':'var(--bg3)',
                  }}>
                    <div style={{ fontSize:13, fontWeight:700, color:tipPct===p&&customTip===''?'var(--acc)':'var(--t1)' }}>{p}%</div>
                    <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>£{(subtotal*p/100).toFixed(2)}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:11, color:'var(--t3)', marginBottom:6 }}>Custom amount</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20, color:'var(--t3)' }}>£</span>
                  <input className="input" type="number" placeholder="0.00" value={customTip}
                    onChange={e=>{ setCustomTip(e.target.value); setTipPct(null); }} style={{ fontSize:18 }}/>
                </div>
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:12, padding:'12px 16px', marginBottom:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--t3)', marginBottom:4 }}><span>Bill</span><span>£{total.toFixed(2)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--t3)', marginBottom:4 }}><span>Tip ({tipPct!==null?`${tipPct}%`:'custom'})</span><span>£{tipAmt.toFixed(2)}</span></div>
                <div style={{ height:1, background:'var(--bdr)', margin:'8px 0' }}/>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:700 }}><span>Grand total</span><span style={{color:'var(--acc)'}}>£{grand.toFixed(2)}</span></div>
              </div>
              <button className="btn btn-acc btn-full btn-lg" onClick={() => setStep('method')}>Choose payment →</button>
            </>
          )}

          {/* ── METHOD ── */}
          {step==='method' && (
            <>
              <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>£{grand.toFixed(2)}</div>
              <div style={{ fontSize:13, color:'var(--t3)', marginBottom:20 }}>Tip included: £{tipAmt.toFixed(2)}</div>
              {[
                { id:'card',  icon:'💳', label:'Card payment',     sub:'Stripe Terminal S700 · tap, chip or swipe' },
                { id:'cash',  icon:'💵', label:'Cash payment',     sub:'Enter amount tendered and calculate change' },
                { id:'split', icon:'⚖', label:'Split by covers',  sub:`${covers} covers · £${(grand/Math.max(covers,1)).toFixed(2)} each` },
              ].map(m => (
                <div key={m.id} style={{ padding:16, background:'var(--bg3)', borderRadius:12, cursor:'pointer', border:'1px solid var(--bdr)', display:'flex', alignItems:'center', gap:14, marginBottom:8, transition:'all .12s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--acc-b)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--bdr)'}
                  onClick={() => setStep(m.id)}>
                  <div style={{ fontSize:28 }}>{m.icon}</div>
                  <div><div style={{ fontWeight:500, fontSize:14 }}>{m.label}</div><div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>{m.sub}</div></div>
                </div>
              ))}
            </>
          )}

          {/* ── CARD ── */}
          {step==='card' && (
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ fontSize:56, marginBottom:16 }}>💳</div>
              <div style={{ fontSize:26, fontWeight:700, marginBottom:8 }}>£{grand.toFixed(2)}</div>
              <div style={{ fontSize:14, color:'var(--t3)', marginBottom:32 }}>Present card to Stripe Reader S700</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', background:'var(--acc-d)', border:'1px solid var(--acc-b)', borderRadius:20, fontSize:13, color:'var(--acc)', marginBottom:32 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--acc)', animation:'pulse 1.5s ease-in-out infinite' }}/>
                Waiting for card...
              </div>
              <br/>
              <button className="btn btn-grn btn-lg" onClick={onComplete}>Simulate payment ✓</button>
            </div>
          )}

          {/* ── CASH ── */}
          {step==='cash' && (
            <>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:20 }}>Cash · £{grand.toFixed(2)} due</div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ fontSize:24, color:'var(--t3)' }}>£</span>
                <input className="input" type="number" placeholder="0.00" value={cash} onChange={e=>setCash(e.target.value)} style={{ fontSize:22, fontWeight:700, height:56 }}/>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
                {[5,10,20,50,Math.ceil(grand)].map(a=>(
                  <button key={a} className="btn btn-ghost btn-sm" onClick={()=>setCash(String(a))}>£{a}</button>
                ))}
              </div>
              {cash && parseFloat(cash) >= grand && (
                <div style={{ background:'var(--grn-d)', border:'1px solid var(--grn-b)', borderRadius:14, padding:'16px 20px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:15, color:'var(--grn)', fontWeight:500 }}>Change due</span>
                  <span style={{ fontSize:28, fontWeight:700, color:'var(--grn)' }}>£{change.toFixed(2)}</span>
                </div>
              )}
              <button className="btn btn-grn btn-full btn-lg"
                disabled={!cash || parseFloat(cash) < grand}
                onClick={onComplete}>
                Complete cash payment
              </button>
            </>
          )}

          {/* ── SPLIT ── */}
          {step==='split' && (
            <>
              <div style={{ fontSize:15, fontWeight:600, marginBottom:18 }}>Split check</div>
              <div style={{ display:'flex', gap:6, marginBottom:20 }}>
                {[2,3,4,5,6].map(n=>(
                  <button key={n} onClick={()=>setSplits(n)} style={{
                    flex:1, padding:'12px 4px', borderRadius:10, cursor:'pointer', textAlign:'center', fontFamily:'inherit',
                    border:`1.5px solid ${splits===n?'var(--acc)':'var(--bdr)'}`,
                    background:splits===n?'var(--acc-d)':'var(--bg3)',
                  }}>
                    <div style={{ fontSize:18, fontWeight:700, color:splits===n?'var(--acc)':'var(--t1)' }}>{n}</div>
                    <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>ways</div>
                  </button>
                ))}
              </div>
              <div style={{ background:'var(--bg3)', borderRadius:12, padding:'14px 18px', marginBottom:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ color:'var(--t3)' }}>Total</span><span>£{total.toFixed(2)}</span></div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:15, fontWeight:500 }}>Each person pays</span>
                  <span style={{ fontSize:26, fontWeight:700, color:'var(--acc)' }}>£{(total/splits).toFixed(2)}</span>
                </div>
              </div>
              {Array.from({length:splits}).map((_,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'var(--bg3)', borderRadius:8, marginBottom:6 }}>
                  <span style={{ fontSize:13, color:'var(--t2)' }}>Guest {i+1}</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>£{(total/splits).toFixed(2)}</span>
                  <button className="btn btn-ghost btn-sm">Charge card</button>
                </div>
              ))}
              <button className="btn btn-grn btn-full btn-lg" style={{ marginTop:12 }} onClick={onComplete}>Mark all paid ✓</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
