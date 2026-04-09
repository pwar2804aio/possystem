import { useState } from 'react';
import { useStore } from '../store';
import { ALLERGENS, INITIAL_TABLES } from '../data/seed';

// ══════════════════════════════════════════════════════════════════════════════
// Payment Screen
// ══════════════════════════════════════════════════════════════════════════════
export function PaymentScreen({ subtotal, service, total, items, onClose, onComplete }) {
  const [step, setStep] = useState('tip');
  const [tipPct, setTipPct] = useState(12.5);
  const [customTip, setCustomTip] = useState('');
  const [method, setMethod] = useState(null);
  const [cash, setCash] = useState('');
  const [splits, setSplits] = useState(2);

  const tipAmt  = customTip !== '' ? parseFloat(customTip)||0 : subtotal * tipPct/100;
  const grand   = total + tipAmt;
  const change  = cash ? Math.max(0, parseFloat(cash) - grand) : 0;

  const S = (s) => (
    <div style={{
      padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:500,
      border:`1px solid ${step===s?'var(--acc-b)':'var(--bdr)'}`,
      background: step===s?'var(--acc-d)':'transparent',
      color: step===s?'var(--acc)':'var(--t3)',
    }} onClick={() => setStep(s)}>{s.charAt(0).toUpperCase()+s.slice(1)}</div>
  );

  return (
    <div className="modal-back">
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--bdr2)',
        borderRadius:24, width:'100%', maxWidth:460,
        maxHeight:'90vh', overflow:'auto', padding:24, boxShadow:'var(--sh3)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:600 }}>Checkout</div>
          <div style={{ display:'flex', gap:8 }}>
            {step!=='tip'&&<button className="btn btn-ghost btn-sm" onClick={()=>setStep('tip')}>← Back</button>}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </div>

        {/* Order summary line */}
        <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 14px', marginBottom:18 }}>
          <div style={{ fontSize:12, color:'var(--t3)', marginBottom:6 }}>{items.length} item{items.length!==1?'s':''}</div>
          {items.map(i => (
            <div key={i.uid} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t2)', marginBottom:2 }}>
              <span>{i.qty}× {i.name}</span><span>£{(i.price*i.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="divider"/>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t3)' }}><span>Subtotal</span><span>£{subtotal.toFixed(2)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t3)', marginTop:2 }}><span>Service 12.5%</span><span>£{service.toFixed(2)}</span></div>
        </div>

        {/* Tip step */}
        {step === 'tip' && (
          <>
            <div style={{ fontSize:14, fontWeight:500, marginBottom:14 }}>Add a tip?</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:14 }}>
              {[0,10,12.5,15,20].map(p => (
                <button key={p} onClick={() => { setTipPct(p); setCustomTip(''); }} style={{
                  padding:'10px 4px', borderRadius:10, cursor:'pointer', textAlign:'center',
                  border:`1.5px solid ${tipPct===p&&customTip===''?'var(--acc)':'var(--bdr)'}`,
                  background: tipPct===p&&customTip===''?'var(--acc-d)':'var(--bg3)',
                  transition:'all .12s', fontFamily:'inherit',
                }}>
                  <div style={{ fontSize:13, fontWeight:600, color:tipPct===p&&customTip===''?'var(--acc)':'var(--t1)' }}>{p}%</div>
                  <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>£{(subtotal*p/100).toFixed(2)}</div>
                </button>
              ))}
            </div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, color:'var(--t3)', marginBottom:6 }}>Custom amount</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:'var(--t3)', fontSize:18 }}>£</span>
                <input className="input" type="number" placeholder="0.00" value={customTip}
                  onChange={e => { setCustomTip(e.target.value); setTipPct(null); }}/>
              </div>
            </div>
            <div style={{ background:'var(--bg3)', borderRadius:10, padding:'12px 14px', marginBottom:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t3)', marginBottom:4 }}><span>Bill</span><span>£{total.toFixed(2)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t3)', marginBottom:4 }}><span>Tip</span><span>£{tipAmt.toFixed(2)}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:700, marginTop:8, paddingTop:8, borderTop:'1px solid var(--bdr)' }}><span>Grand total</span><span style={{color:'var(--acc)'}}>£{grand.toFixed(2)}</span></div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={() => setStep('split')}>Split check</button>
              <button className="btn btn-acc" style={{flex:2}} onClick={() => setStep('method')}>Choose payment →</button>
            </div>
          </>
        )}

        {/* Method step */}
        {step === 'method' && (
          <>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:4 }}>£{grand.toFixed(2)} due</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>Includes £{tipAmt.toFixed(2)} tip</div>
            {[
              { id:'card', icon:'💳', label:'Card payment', sub:'Stripe Terminal · tap, chip or swipe' },
              { id:'cash', icon:'💵', label:'Cash payment', sub:'Enter tendered amount and calculate change' },
            ].map(m => (
              <div key={m.id} style={{
                padding:16, background:'var(--bg3)', borderRadius:12, cursor:'pointer',
                border:`1px solid var(--bdr)`, display:'flex', alignItems:'center', gap:14, marginBottom:8,
                transition:'all .12s',
              }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--acc-b)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--bdr)'}
              onClick={() => setStep(m.id)}>
                <div style={{ fontSize:26 }}>{m.icon}</div>
                <div><div style={{fontWeight:500}}>{m.label}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>{m.sub}</div></div>
              </div>
            ))}
          </>
        )}

        {/* Card */}
        {step === 'card' && (
          <div style={{ textAlign:'center', padding:'32px 0' }}>
            <div style={{ fontSize:56, marginBottom:20 }}>💳</div>
            <div style={{ fontSize:24, fontWeight:700, marginBottom:8 }}>£{grand.toFixed(2)}</div>
            <div style={{ fontSize:13, color:'var(--t3)', marginBottom:32 }}>Present card to Stripe Reader S700</div>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px',
              background:'var(--acc-d)', border:'1px solid var(--acc-b)',
              borderRadius:20, fontSize:13, color:'var(--acc)', marginBottom:32,
            }}>
              <div style={{width:8,height:8,borderRadius:'50%',background:'var(--acc)',animation:'pulse 1.5s ease-in-out infinite'}}/>
              Waiting for card...
            </div>
            <br/>
            <button className="btn btn-grn btn-lg" onClick={onComplete}>Simulate payment ✓</button>
          </div>
        )}

        {/* Cash */}
        {step === 'cash' && (
          <>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:20 }}>Cash · £{grand.toFixed(2)} due</div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <span style={{ fontSize:22, color:'var(--t3)' }}>£</span>
              <input className="input" type="number" placeholder="0.00" value={cash}
                onChange={e=>setCash(e.target.value)} style={{ fontSize:20, fontWeight:600, height:52 }}/>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:18 }}>
              {[5,10,20,50,Math.ceil(grand)].map(a=>(
                <button key={a} className="btn btn-ghost btn-sm" onClick={()=>setCash(String(a))}>£{a}</button>
              ))}
            </div>
            {cash && parseFloat(cash) >= grand && (
              <div style={{
                background:'var(--grn-d)', border:'1px solid var(--grn-b)',
                borderRadius:12, padding:'14px 18px', marginBottom:18,
                display:'flex', justifyContent:'space-between', alignItems:'center',
              }}>
                <span style={{ fontSize:14, color:'var(--grn)' }}>Change due</span>
                <span style={{ fontSize:26, fontWeight:700, color:'var(--grn)' }}>£{change.toFixed(2)}</span>
              </div>
            )}
            <button className="btn btn-grn btn-full btn-lg"
              disabled={!cash || parseFloat(cash) < grand}
              onClick={onComplete}>
              Complete cash payment
            </button>
          </>
        )}

        {/* Split */}
        {step === 'split' && (
          <>
            <div style={{ fontSize:15, fontWeight:500, marginBottom:18 }}>Split check evenly</div>
            <div style={{ display:'flex', gap:6, marginBottom:18 }}>
              {[2,3,4,5,6].map(n=>(
                <button key={n} onClick={()=>setSplits(n)} style={{
                  flex:1, padding:'10px 4px', borderRadius:10, cursor:'pointer', textAlign:'center',
                  border:`1.5px solid ${splits===n?'var(--acc)':'var(--bdr)'}`,
                  background: splits===n?'var(--acc-d)':'var(--bg3)',
                  fontFamily:'inherit',
                }}>
                  <div style={{fontSize:18,fontWeight:700,color:splits===n?'var(--acc)':'var(--t1)'}}>{n}</div>
                  <div style={{fontSize:10,color:'var(--t3)',marginTop:2}}>ways</div>
                </button>
              ))}
            </div>
            <div style={{ background:'var(--bg3)', borderRadius:12, padding:'14px 18px', marginBottom:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{fontSize:13,color:'var(--t3)'}}>Total</span><span>£{total.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{fontSize:15,fontWeight:500}}>Each person pays</span>
                <span style={{fontSize:24,fontWeight:700,color:'var(--acc)'}}>£{(total/splits).toFixed(2)}</span>
              </div>
            </div>
            <button className="btn btn-grn btn-full btn-lg" onClick={onComplete}>Mark all paid ✓</button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tables Surface
// ══════════════════════════════════════════════════════════════════════════════
export function TablesSurface() {
  const { tables, updateTable, openTable, closeTable, showToast, setSurface, setTableId } = useStore();
  const [selId, setSelId] = useState(null);
  const sel = tables.find(t => t.id === selId);

  const STATUS = {
    available: { color:'var(--grn)',  label:'Available' },
    open:      { color:'var(--blu)',  label:'Open' },
    occupied:  { color:'var(--acc)',  label:'Occupied' },
    reserved:  { color:'#a855f7',  label:'Reserved' },
    cleaning:  { color:'var(--t3)',label:'Cleaning' },
  };

  const fmt = (mins) => {
    if (!mins) return '—';
    const m = parseInt(mins);
    return m >= 60 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`;
  };

  const handleAction = (action) => {
    if (!sel) return;
    switch (action) {
      case 'open':     openTable(sel.id); showToast(`${sel.label} opened`, 'success'); break;
      case 'seat':     updateTable(sel.id,{status:'occupied',seated:0}); showToast(`${sel.label} seated`,'success'); break;
      case 'close':    closeTable(sel.id); showToast(`${sel.label} closed`,'info'); setSelId(null); break;
      case 'reserve':  updateTable(sel.id,{status:'reserved',reservation:'Next available'}); showToast(`${sel.label} reserved`,'info'); break;
      case 'view':     setTableId(sel.id); setSurface('pos'); break;
      case 'print':    showToast('Check printed to pass printer','info'); break;
      case 'transfer': showToast('Select destination table to transfer','info'); break;
    }
  };

  const sections = ['main','bar','patio'];
  const secLabel = { main:'Main dining', bar:'Bar', patio:'Patio' };

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ height:52, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)', flexShrink:0 }}>
          <div><div style={{fontSize:15,fontWeight:600}}>Floor plan</div><div style={{fontSize:11,color:'var(--t3)'}}>Live view · {new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div></div>
          <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--t3)' }}>
            {Object.entries(STATUS).map(([s,{color,label}])=>(
              <span key={s}><span style={{color}}>{tables.filter(t=>t.status===s).length}</span> {label}</span>
            ))}
          </div>
        </div>

        {/* Floor canvas */}
        <div style={{ flex:1, overflow:'auto', padding:16 }}>
          {/* Section labels + tables */}
          <div style={{ position:'relative', background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:20, minHeight:320, marginBottom:16 }}>
            {sections.map(sec => (
              <div key={sec} style={{
                position:'absolute', fontSize:10, fontWeight:600, color:'var(--t3)',
                textTransform:'uppercase', letterSpacing:'.08em',
                left: sec==='main'?16: sec==='bar'?406:498,
                top: 14,
              }}>{secLabel[sec]}</div>
            ))}
            {tables.map(t => {
              const st = STATUS[t.status] || STATUS.available;
              const isSelected = selId === t.id;
              return (
                <div key={t.id} style={{
                  position:'absolute', left:t.x, top:t.y, width:t.w, height:t.h,
                  cursor:'pointer',
                }} onClick={() => setSelId(selId===t.id?null:t.id)}>
                  <div style={{
                    width:'100%', height:'100%',
                    borderRadius: t.shape==='rd'?'50%':'10px',
                    background: st.color+'14',
                    border:`2px solid ${isSelected?st.color:st.color+'44'}`,
                    boxShadow: isSelected?`0 0 0 3px ${st.color}33`:'none',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                    gap:2, transition:'all .15s',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:st.color }}>{t.label}</div>
                    <div style={{ fontSize:9, color:st.color, opacity:.7 }}>
                      {t.status==='occupied'?fmt(t.seated):
                       t.status==='reserved'?t.reservation||'—':
                       t.status==='open'?'Ordering':
                       `${t.covers}cvr`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected table detail */}
          {sel && (
            <div style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:16, padding:18, animation:'slideUp .15s ease' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:18, fontWeight:600 }}>{sel.label}</div>
                <span className={`badge badge-${sel.status==='available'?'grn':sel.status==='occupied'?'acc':sel.status==='open'?'blu':'pur'}`}>
                  {STATUS[sel.status]?.label}
                </span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
                {[['Covers',sel.covers],['Seated',fmt(sel.seated)],['Check',sel.orderTotal!=null?`£${sel.orderTotal.toFixed(2)}`:'—'],['Server',sel.server||'—']].map(([k,v])=>(
                  <div key={k} style={{ background:'var(--bg4)', borderRadius:8, padding:'9px 10px' }}>
                    <div style={{ fontSize:10, color:'var(--t3)', marginBottom:3 }}>{k}</div>
                    <div style={{ fontSize:15, fontWeight:600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {sel.status==='available' && <>
                  <button className="btn btn-grn" onClick={()=>handleAction('open')}>Open table &amp; order</button>
                  <button className="btn btn-ghost" onClick={()=>handleAction('reserve')}>Reserve</button>
                </>}
                {sel.status==='reserved' && <>
                  <button className="btn btn-acc" onClick={()=>handleAction('seat')}>Seat now</button>
                  <button className="btn btn-ghost" onClick={()=>handleAction('close')}>Cancel reservation</button>
                </>}
                {(sel.status==='open'||sel.status==='occupied') && <>
                  <button className="btn btn-acc" onClick={()=>handleAction('view')}>View &amp; add to order</button>
                  <button className="btn btn-ghost" onClick={()=>handleAction('print')}>Print check</button>
                  <button className="btn btn-ghost" onClick={()=>handleAction('transfer')}>Transfer table</button>
                  <button className="btn btn-red" onClick={()=>handleAction('close')}>Close table</button>
                </>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KDS Surface
// ══════════════════════════════════════════════════════════════════════════════
export function KDSSurface() {
  const { kdsTickets, bumpTicket, showToast } = useStore();
  const tc = (m) => m>=25?'urgent':m>=12?'warning':'ok';
  const fmt = (m) => m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m}m`;
  const tcColor = { urgent:'var(--red)', warning:'var(--acc)', ok:'var(--grn)' };

  return (
    <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:52, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)', flexShrink:0 }}>
        <div><div style={{fontSize:15,fontWeight:600}}>Kitchen display</div><div style={{fontSize:11,color:'var(--t3)'}}>{kdsTickets.length} active ticket{kdsTickets.length!==1?'s':''}</div></div>
        <div style={{ display:'flex', gap:8 }}>
          {['urgent','warning','ok'].map(s=>(
            <span key={s} style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:600, background:tcColor[s]+'18', border:`1px solid ${tcColor[s]}44`, color:tcColor[s] }}>
              {kdsTickets.filter(t=>tc(t.minutes)===s).length} {s}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:14, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12, alignContent:'start' }}>
        {kdsTickets.length===0&&(
          <div style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--t3)', padding:'80px 0', fontSize:14 }}>
            <div style={{fontSize:40,marginBottom:12}}>✓</div>Kitchen clear
          </div>
        )}
        {kdsTickets.map(ticket=>{
          const t = tc(ticket.minutes);
          const col = tcColor[t];
          return (
            <div key={ticket.id} style={{ background:'var(--bg3)', border:`1px solid ${col}44`, borderRadius:14, overflow:'hidden', transition:'border-color .2s' }}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700 }}>{ticket.table}</div>
                  <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{ticket.server} · {ticket.covers} covers</div>
                </div>
                <div style={{ padding:'3px 10px', borderRadius:10, fontSize:12, fontWeight:700, background:`${col}18`, border:`1px solid ${col}44`, color:col }}>
                  {fmt(ticket.minutes)}
                </div>
              </div>
              <div style={{ padding:'10px 14px' }}>
                {ticket.items.map((item,i)=>(
                  <div key={i} style={{ display:'flex', gap:8, padding:'5px 0', borderBottom:i<ticket.items.length-1?'1px solid var(--bdr)':'none' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--acc)', minWidth:24 }}>{item.qty}×</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div>
                      {item.mods&&<div style={{ fontSize:11, color:item.mods.includes('⚠')?'var(--red)':'var(--t3)', marginTop:2 }}>{item.mods}</div>}
                    </div>
                    <span style={{ fontSize:10, padding:'2px 6px', borderRadius:5, background:'var(--blu-d)', border:'1px solid var(--blu-b)', color:'var(--blu)', fontWeight:600, alignSelf:'flex-start', whiteSpace:'nowrap' }}>
                      {item.course===1?'C1':'C'+item.course}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding:'8px 14px', borderTop:'1px solid var(--bdr)', display:'flex', gap:6 }}>
                <button className="btn btn-grn" style={{ flex:1, height:34, fontSize:12, fontWeight:700 }}
                  onClick={()=>{ bumpTicket(ticket.id); showToast(`${ticket.table} bumped`,'success'); }}>
                  Bump ✓
                </button>
                <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Ticket recalled','info')}>Recall</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Reprinted to kitchen','info')}>Print</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Back Office Surface
// ══════════════════════════════════════════════════════════════════════════════
export function BackOfficeSurface() {
  const { staff, shift, logout, showToast } = useStore();
  const [subview, setSubview] = useState('overview');

  const views = [
    { id:'overview',  label:'Overview' },
    { id:'menu',      label:'Menu builder' },
    { id:'printers',  label:'Printers' },
    { id:'shift',     label:'Shift' },
    { id:'staff',     label:'Staff' },
  ];

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      {/* Sub-nav */}
      <div style={{ width:180, background:'var(--bg2)', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', padding:'16px 8px' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', padding:'0 8px', marginBottom:10 }}>Back office</div>
        {views.map(v=>(
          <button key={v.id} onClick={()=>setSubview(v.id)} style={{
            width:'100%', padding:'9px 12px', borderRadius:8, cursor:'pointer', textAlign:'left',
            fontSize:13, fontWeight:500, border:'none', fontFamily:'inherit',
            background: subview===v.id?'var(--acc-d)':'transparent',
            color: subview===v.id?'var(--acc)':'var(--t2)',
            marginBottom:2,
          }}>{v.label}</button>
        ))}
        <div style={{ marginTop:'auto' }}>
          <button onClick={logout} style={{ width:'100%', padding:'9px 12px', borderRadius:8, cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--red)', background:'transparent', border:'none', fontFamily:'inherit' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:24 }}>
        {subview==='overview' && <BOOverview shift={shift} staff={staff} showToast={showToast}/>}
        {subview==='menu'     && <BOMenu showToast={showToast}/>}
        {subview==='printers' && <BOPrinters showToast={showToast}/>}
        {subview==='shift'    && <BOShift shift={shift} showToast={showToast}/>}
        {subview==='staff'    && <BOStaff showToast={showToast}/>}
      </div>
    </div>
  );
}

// ── Back office sub-views ─────────────────────────────────────────────────────
function BOOverview({ shift, staff, showToast }) {
  const { PRINTERS } = require('../data/seed');
  return (
    <>
      <div style={{ fontSize:18, fontWeight:600, marginBottom:20 }}>Good evening, {staff?.name}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:28 }}>
        {[
          { label:'Sales today',   val:`£${shift.sales.toLocaleString()}`, positive:true, sub:shift.name },
          { label:'Covers',        val:shift.covers, sub:`Avg £${shift.avgCheck.toFixed(2)}` },
          { label:'Cash sales',    val:`£${shift.cashSales.toFixed(0)}`, sub:'of total' },
          { label:'Tips declared', val:`£${shift.tips.toFixed(2)}`, sub:'this shift' },
        ].map(s=>(
          <div key={s.label} style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:12, padding:16 }}>
            <div style={{ fontSize:11, color:'var(--t3)', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.positive?'var(--grn)':'var(--t1)' }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:12, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Printer status</div>
          {PRINTERS.map(p=>(
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--bdr)' }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:p.status==='online'?'var(--grn)':'var(--red)', flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{p.model} · {p.ip}</div>
              </div>
              <span className={`badge badge-${p.status==='online'?'grn':'red'}`}>{p.status}</span>
            </div>
          ))}
        </div>
        <div style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:12, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>Top items today</div>
          {[['Margherita pizza','£252.00',18],['Ribeye steak','£256.00',8],['Espresso Martini','£100.00',8],['Carbonara','£217.50',15],['House red wine','£142.50',19]].map(([n,rev,qty])=>(
            <div key={n} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--bdr)', fontSize:12 }}>
              <span style={{ color:'var(--t2)' }}>{n}</span>
              <span style={{ color:'var(--t3)' }}>×{qty}</span>
              <span style={{ color:'var(--acc)', fontWeight:600 }}>{rev}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function BOMenu({ showToast }) {
  const { MENU_ITEMS, CATEGORIES } = require('../data/seed');
  const [cat, setCat] = useState('starters');
  const [status, setStatus] = useState('draft');
  const items = MENU_ITEMS.filter(i=>i.cat===cat);
  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ fontSize:17, fontWeight:600 }}>Menu builder</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span className={`badge badge-${status==='live'?'grn':'acc'}`}>
            {status==='live'?'● Live':'● Draft'}
          </span>
          <button className="btn btn-grn btn-sm" onClick={()=>{setStatus('live');showToast('Menu published live','success');}}>
            {status==='live'?'Live — republish':'Publish live'}
          </button>
        </div>
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {CATEGORIES.filter(c=>!c.isSpecial).map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            padding:'6px 14px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500,
            border:`1px solid ${cat===c.id?'var(--acc)':'var(--bdr)'}`,
            background:cat===c.id?'var(--acc-d)':'var(--bg3)',
            color:cat===c.id?'var(--acc)':'var(--t2)', fontFamily:'inherit',
          }}>{c.label} <span style={{color:'var(--t3)'}}>({MENU_ITEMS.filter(i=>i.cat===c.id).length})</span></button>
        ))}
      </div>
      {items.map(item=>(
        <div key={item.id} style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:10, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
              £{item.price.toFixed(2)} · {item.allergens?.length?`⚠ ${item.allergens.length} allergens`:'No allergens'}
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Edit item — full editor in V2','info')}>Edit</button>
            <button className="btn btn-red btn-sm" onClick={()=>showToast(`${item.name} 86'd`,'warning')}>86</button>
          </div>
        </div>
      ))}
    </>
  );
}

function BOPrinters({ showToast }) {
  const { PRINTERS, PRODUCTION_CENTRES } = require('../data/seed');
  const [printers, setPrinters] = useState(PRINTERS);
  const testPrint = (p) => showToast(`Test print sent to ${p.name}`, 'info');
  const toggle = (id) => setPrinters(ps=>ps.map(p=>p.id===id?{...p,status:p.status==='online'?'offline':'online'}:p));

  return (
    <>
      <div style={{ fontSize:17, fontWeight:600, marginBottom:20 }}>Printer setup</div>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--t2)', marginBottom:12 }}>Production centres</div>
        {PRODUCTION_CENTRES.map(pc=>{
          const printer = printers.find(p=>p.id===pc.printerId);
          return (
            <div key={pc.id} style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:24 }}>{pc.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500 }}>{pc.name}</div>
                <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>
                  Assigned: {printer?.name || 'None'} · {pc.type}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Reassign printer — select from list','info')}>Reassign</button>
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--t2)', marginBottom:12 }}>Printers on network</div>
        {printers.map(p=>(
          <div key={p.id} style={{ background:'var(--bg3)', border:`1px solid ${p.status==='online'?'var(--grn-b)':'var(--red-b)'}`, borderRadius:12, padding:'14px 16px', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:p.status==='online'?'var(--grn)':'var(--red)', flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500 }}>{p.name}</div>
                <div style={{ fontSize:11, color:'var(--t3)', fontFamily:'monospace' }}>
                  {p.model} · {p.ip}
                </div>
              </div>
              <span className={`badge badge-${p.status==='online'?'grn':'red'}`}>{p.status}</span>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost btn-sm" onClick={()=>testPrint(p)}>Test print</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>toggle(p.id)}>
                {p.status==='online'?'Take offline':'Bring online'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Config: ESC/POS template editor — coming in V2','info')}>Configure</button>
            </div>
          </div>
        ))}
        <button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>showToast('Network scan for new printers...','info')}>
          + Scan for new printers
        </button>
      </div>
    </>
  );
}

function BOShift({ shift, showToast }) {
  const [tab, setTab] = useState('overview');
  const [denoms, setDenoms] = useState({'50':0,'20':0,'10':0,'5':0,'2':0,'1':0,'0.50':0,'0.20':0,'0.10':0,'0.05':0});
  const counted = Object.entries(denoms).reduce((s,[d,c])=>s+parseFloat(d)*c,0);
  const expected = shift.cashSales;
  const variance = counted - expected;

  return (
    <>
      <div style={{ fontSize:17, fontWeight:600, marginBottom:20 }}>Shift management</div>
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {[['overview','Overview'],['cashup','Cash up'],['close','Close shift']].map(([v,l])=>(
          <button key={v} className={`btn btn-sm ${tab===v?'btn-acc':'btn-ghost'}`} onClick={()=>setTab(v)}>{l}</button>
        ))}
      </div>

      {tab==='overview'&&(
        <>
          <div style={{ background:'var(--grn-d)', border:'1px solid var(--grn-b)', borderRadius:12, padding:16, marginBottom:16, display:'flex', gap:12, alignItems:'center' }}>
            <div style={{width:10,height:10,borderRadius:'50%',background:'var(--grn)',flexShrink:0}}/>
            <div><div style={{fontSize:15,fontWeight:600,color:'var(--grn)'}}>{shift.name}</div><div style={{fontSize:12,color:'var(--grn)',opacity:.8}}>Open since {shift.opened}</div></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginBottom:16 }}>
            {[['Gross sales',`£${shift.sales.toLocaleString()}`],['Covers',shift.covers],['Avg check',`£${shift.avgCheck.toFixed(2)}`],['Cash',`£${shift.cashSales.toFixed(2)}`],['Card',`£${shift.cardSales.toFixed(2)}`],['Tips',`£${shift.tips.toFixed(2)}`],['Voids',`${shift.voids} · £${shift.voidValue.toFixed(2)}`],['Open tables','4']].map(([k,v])=>(
              <div key={k} style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:11, color:'var(--t3)', marginBottom:3 }}>{k}</div>
                <div style={{ fontSize:16, fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab==='cashup'&&(
        <>
          <div style={{ marginBottom:16 }}>
            {Object.entries(denoms).map(([d,count])=>(
              <div key={d} style={{ display:'grid', gridTemplateColumns:'70px 1fr 80px', gap:10, alignItems:'center', marginBottom:8 }}>
                <div style={{fontSize:14,fontWeight:500}}>£{d}</div>
                <input type="number" min="0" value={count}
                  onChange={e=>setDenoms(p=>({...p,[d]:parseInt(e.target.value)||0}))}
                  style={{background:'var(--bg3)',border:'1px solid var(--bdr2)',borderRadius:6,padding:'6px 10px',color:'var(--t1)',fontSize:13,textAlign:'center',fontFamily:'monospace',outline:'none'}}/>
                <div style={{fontSize:13,color:'var(--acc)',textAlign:'right',fontWeight:600}}>£{(parseFloat(d)*count).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--bg3)', borderRadius:12, padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}><span style={{fontSize:13,color:'var(--t3)'}}>Counted</span><span style={{fontWeight:600}}>£{counted.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}><span style={{fontSize:13,color:'var(--t3)'}}>Expected</span><span>£{expected.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--bdr)' }}>
              <span style={{fontSize:14,fontWeight:500}}>Variance</span>
              <span style={{fontSize:18,fontWeight:700,color:Math.abs(variance)<0.01?'var(--grn)':variance<0?'var(--red)':'var(--acc)'}}>
                {variance>=0?'+':''}£{variance.toFixed(2)}
              </span>
            </div>
          </div>
          <button className="btn btn-acc" onClick={()=>{showToast('Cash up recorded','success');setTab('overview');}}>Confirm cash up</button>
        </>
      )}

      {tab==='close'&&(
        <>
          <div style={{ background:'var(--red-d)', border:'1px solid var(--red-b)', borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{fontSize:14,fontWeight:600,color:'var(--red)',marginBottom:4}}>Close shift</div>
            <div style={{fontSize:12,color:'var(--red)',opacity:.8}}>This will lock the shift, generate the final EOD report, and prepare for the next trading day.</div>
          </div>
          <div style={{ marginBottom:16 }}>
            {[['Cash up complete — £0.00 variance',true],['All card batches settled',true],['1 open check — Banquette (transfer required)',false]].map(([t,ok],i)=>(
              <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--bdr)', fontSize:13 }}>
                <span style={{color:ok?'var(--grn)':'var(--acc)'}}>{ok?'✓':'⚠'}</span>
                <span style={{color:ok?'var(--t2)':'var(--acc)'}}>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{fontSize:11,color:'var(--t3)',marginBottom:6}}>Manager sign-off PIN</div>
            <input type="password" maxLength={4} placeholder="Enter PIN to confirm"
              className="input" style={{textAlign:'center',fontSize:22,letterSpacing:10,fontFamily:'monospace'}}/>
          </div>
          <button className="btn btn-red btn-lg btn-full" onClick={()=>showToast('Shift closed — EOD report generated','success')}>
            Close shift &amp; generate report
          </button>
        </>
      )}
    </>
  );
}

function BOStaff({ showToast }) {
  const { STAFF } = require('../data/seed');
  return (
    <>
      <div style={{ fontSize:17, fontWeight:600, marginBottom:20 }}>Staff management</div>
      {STAFF.map(s=>(
        <div key={s.id} style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:12, padding:'14px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:40,height:40,borderRadius:'50%',background:s.color+'22',border:`2px solid ${s.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:600,color:s.color,flexShrink:0 }}>{s.initials}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500 }}>{s.name}</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>{s.role} · PIN: ****</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Edit staff — coming in V2','info')}>Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>showToast(`Clock out ${s.name}`,'info')}>Clock out</button>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost" style={{marginTop:8}} onClick={()=>showToast('Add staff member — coming in V2','info')}>+ Add staff member</button>
    </>
  );
}
