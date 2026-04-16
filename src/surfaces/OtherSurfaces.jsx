import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { ALLERGENS, INITIAL_TABLES, MENU_ITEMS, PRINTERS, PRODUCTION_CENTRES, STAFF } from '../data/seed';
import { VERSION } from '../lib/version';
import { supabase, isMock } from '../lib/supabase';
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
// ══════════════════════════════════════════════════════════════════════════════
// KDS Surface — redesigned
// ══════════════════════════════════════════════════════════════════════════════
export function KDSSurface() {
  const { kdsTickets: storeTickets, bumpTicket, showToast, deviceConfig } = useStore();

  // Read device info from localStorage
  const pairedDevice = (() => { try { return JSON.parse(localStorage.getItem('rpos-device') || 'null'); } catch { return null; } })();
  const localDeviceConfig = (() => { try { return JSON.parse(localStorage.getItem('rpos-device-config') || 'null'); } catch { return null; } })();
  const kdsName = pairedDevice?.name || localDeviceConfig?.profileName || 'Kitchen display';
  const centreName = localDeviceConfig?.centreName || null;
  const locationId = pairedDevice?.locationId || null;
  const centreId = localDeviceConfig?.centreId || pairedDevice?.centreId || null;

  // Heartbeat — update last_seen every 60s so Status drawer shows correct KDS online state
  useEffect(() => {
    if (!pairedDevice?.id || isMock) return;
    const beat = async () => {
      try {
        const { updateDeviceHeartbeat } = await import('../lib/db.js');
        updateDeviceHeartbeat(pairedDevice.id);
      } catch {}
    };
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, [pairedDevice?.id]);

  // Local tickets state — loaded from Supabase + synced via realtime
  const [liveTickets, setLiveTickets] = useState(null); // null = loading
  const [, setTick] = useState(0);

  // Filter: default to this device's assigned centre
  const [filter, setFilter] = useState(centreId || 'all');

  // Load tickets from Supabase and subscribe to realtime
  useEffect(() => {
    if (isMock || !locationId) {
      setLiveTickets(null); // fall back to store tickets
      return;
    }

    // Initial fetch
    const load = async () => {
      try {
        let q = supabase.from('kds_tickets').select('*').eq('location_id', locationId).eq('status', 'pending').order('sent_at', { ascending: true });
        // Filter by centre_id if this KDS is assigned to a specific center
        if (centreId) q = q.eq('centre_id', centreId);
        const { data } = await q;
        if (data) setLiveTickets(data.map(mapRow));
      } catch(e) { setLiveTickets(null); }
    };
    load();

    // Realtime subscription — picks up new tickets from any POS terminal
    const channel = supabase
      .channel(`kds-tickets-${locationId}${centreId ? `-${centreId}` : ''}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kds_tickets',
        filter: `location_id=eq.${locationId}`,
      }, (payload) => {
        const ticket = mapRow(payload.new);
        // Filter by centre if this KDS is assigned to one
        if (centreId && ticket.centreId !== centreId) return;
        setLiveTickets(prev => prev ? [...prev, ticket] : [ticket]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'kds_tickets',
        filter: `location_id=eq.${locationId}`,
      }, (payload) => {
        if (payload.new.status === 'bumped') {
          setLiveTickets(prev => prev ? prev.filter(t => t.id !== payload.new.id) : prev);
        } else {
          // fired_courses updated — re-render ticket with new fired state
          setLiveTickets(prev => prev ? prev.map(t => t.id === payload.new.id ? mapRow(payload.new) : t) : prev);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [locationId, centreId]);

  // Map Supabase snake_case row to display format
  const mapRow = (row) => ({
    id: row.id,
    table: row.table_label || row.table || '',
    server: row.server || '',
    covers: row.covers || 1,
    centreId: row.centre_id || row.centreId || null,
    sentAt: row.sent_at ? new Date(row.sent_at).getTime() : Date.now(),
    minutes: 0,
    firedCourses: row.fired_courses || row.firedCourses || [0, 1],
    allCourses: row.all_courses || row.allCourses || [],
    items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
  });

  // Bump a ticket — update Supabase + remove from local state
  const handleBump = async (ticketId) => {
    if (liveTickets !== null) {
      setLiveTickets(prev => prev.filter(t => t.id !== ticketId));
      if (!isMock) {
        await supabase.from('kds_tickets').update({ status: 'bumped', bumped_at: new Date().toISOString() }).eq('id', ticketId);
      }
    } else {
      bumpTicket(ticketId);
    }
    showToast('Ticket bumped', 'success');
  };

  // Use live Supabase tickets if available, fall back to store
  const tickets = liveTickets !== null ? liveTickets : storeTickets;

  // Tick every 30s to update live timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const urgency = (m) => m>=25?'urgent':m>=12?'warning':'ok';
  const fmt = (m) => m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m}m`;
  const URG = {
    urgent:  { color:'var(--red)',  bg:'rgba(239,68,68,.08)',  border:'rgba(239,68,68,.25)',  pulse:true },
    warning: { color:'var(--acc)',  bg:'rgba(232,160,32,.08)', border:'rgba(232,160,32,.25)', pulse:false },
    ok:      { color:'var(--grn)',  bg:'transparent',          border:'var(--bdr)',            pulse:false },
  };

  function getLiveMinutes(ticket) {
    if (!ticket.sentAt) return ticket.minutes||0;
    const ts = ticket.sentAt instanceof Date ? ticket.sentAt.getTime() : typeof ticket.sentAt === 'string' ? new Date(ticket.sentAt).getTime() : Number(ticket.sentAt);
    return Math.max(0, Math.floor((Date.now() - ts) / 60000));
  }

  const stations = ['all', ...new Set(tickets.map(t=>t.centreId||t.station||'pc1').filter(Boolean))];
  const displayed = tickets.filter(t => filter==='all' || (t.centreId||t.station||'pc1')===filter);
  const counts = {
    urgent:  displayed.filter(t=>urgency(getLiveMinutes(t))==='urgent').length,
    warning: displayed.filter(t=>urgency(getLiveMinutes(t))==='warning').length,
    ok:      displayed.filter(t=>urgency(getLiveMinutes(t))==='ok').length,
  };

  return (
    <div style={{ display:'flex', flex:1, flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>

      {/* Header */}
      <div style={{ height:52, display:'flex', alignItems:'center', gap:14, padding:'0 18px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em' }}>{kdsName}</div>
          <div style={{ fontSize:10, color:'var(--t3)', fontWeight:600 }}>
            {centreName && <span style={{ marginRight:6 }}>{centreName} ·</span>}
            {displayed.length} ticket{displayed.length!==1?'s':''} · live · <span style={{ fontFamily:'monospace' }}>v{VERSION}</span>
          </div>
        </div>

        {/* Urgency badges */}
        <div style={{ display:'flex', gap:6 }}>
          {counts.urgent>0&&<span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)' }}>{counts.urgent} urgent</span>}
          {counts.warning>0&&<span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, background:'var(--acc-d)', border:'1px solid var(--acc-b)', color:'var(--acc)' }}>{counts.warning} warn</span>}
          {counts.ok>0&&<span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)' }}>{counts.ok} ok</span>}
        </div>

        {/* Station filter */}
        {stations.length>1&&(
          <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
            {stations.map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{
                padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit',
                background:filter===s?'var(--acc-d)':'transparent',
                border:`1px solid ${filter===s?'var(--acc-b)':'var(--bdr)'}`,
                color:filter===s?'var(--acc)':'var(--t3)',
                fontSize:11, fontWeight:700,
              }}>{s==='all' ? 'All stations' : ((() => { try { const r = JSON.parse(localStorage.getItem('rpos-print-routing')||'null'); return r?.centres?.find(c=>c.id===s)?.name; } catch{} })() || s)}</button>
            ))}
          </div>
        )}
      </div>

      {/* Tickets grid */}
      <div style={{ flex:1, overflowY:'auto', padding:14, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12, alignContent:'start' }}>
        {displayed.length===0&&(
          <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 0', color:'var(--t3)' }}>
            <div style={{ width:64, height:64, borderRadius:18, background:'var(--grn-d)', border:'2px solid var(--grn-b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, marginBottom:16 }}>✓</div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t2)', marginBottom:4 }}>Kitchen clear</div>
            <div style={{ fontSize:12 }}>All orders bumped</div>
          </div>
        )}
        {displayed.map(ticket=>{
          const liveMin = ticket.sentAt ? Math.floor((Date.now()-(ticket.sentAt instanceof Date ? ticket.sentAt.getTime() : Number(ticket.sentAt)))/60000) : (ticket.minutes||0);
          const urg = urgency(liveMin);
          const u   = URG[urg];
          const stationLabel = (() => { try { const r = JSON.parse(localStorage.getItem('rpos-print-routing')||'null'); return r?.centres?.find(c=>c.id===(ticket.centreId||ticket.station))?.name; } catch{} })() || ticket.station || 'Kitchen';
          return (
            <div key={ticket.id} style={{
              background:u.bg, border:`1.5px solid ${u.border}`,
              borderRadius:16, overflow:'hidden',
              boxShadow: urg==='urgent'?`0 0 20px ${u.color}22`:'none',
            }}>
              {/* Ticket header */}
              <div style={{ padding:'11px 14px', borderBottom:`1px solid ${u.border}`, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em' }}>{ticket.table}</div>
                  <div style={{ fontSize:10, color:'var(--t3)', marginTop:1, fontWeight:600 }}>
                    {ticket.server}{ticket.covers?` · ${ticket.covers} covers`:''} · <span style={{color:u.color}}>{stationLabel}</span>
                  </div>
                </div>
                {/* Live timer */}
                <div style={{
                  padding:'5px 12px', borderRadius:20,
                  background:urg==='urgent'?'var(--red-d)':urg==='warning'?'var(--acc-d)':'var(--grn-d)',
                  border:`1px solid ${u.color}55`,
                  display:'flex', alignItems:'center', gap:5,
                }}>
                  {urg==='urgent'&&<div style={{ width:6,height:6,borderRadius:'50%',background:'var(--red)',animation:'pulse 1s ease-in-out infinite' }}/>}
                  <span style={{ fontSize:13, fontWeight:800, color:u.color, fontFamily:'var(--font-mono)' }}>{fmt(liveMin)}</span>
                </div>
              </div>

              {/* Items — grouped by course */}
              <div style={{ padding:'10px 14px' }}>
                {(() => {
                  const firedCourses = ticket.firedCourses || [0, 1];
                  const items = ticket.items || [];
                  const fired = items.filter(i => firedCourses.includes(i.course ?? 1));
                  const pending = items.filter(i => !firedCourses.includes(i.course ?? 1));

                  // Group fired items by course
                  const firedByCourse = {};
                  fired.forEach(i => {
                    const c = i.course ?? 1;
                    if (!firedByCourse[c]) firedByCourse[c] = [];
                    firedByCourse[c].push(i);
                  });

                  const COURSE_LABEL = { 0:'Immediate', 1:'Course 1', 2:'Course 2', 3:'Course 3' };

                  return (
                    <>
                      {/* Fired courses — active */}
                      {Object.entries(firedByCourse).sort(([a],[b])=>a-b).map(([course, cItems]) => (
                        <div key={course}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, paddingBottom:4, borderBottom:`1px solid ${u.border}` }}>
                            <span style={{ fontSize:11, fontWeight:800, color:u.color }}>🔥 {COURSE_LABEL[course] || `Course ${course}`}</span>
                          </div>
                          {cItems.map((item,i) => (
                            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, paddingBottom:8, marginBottom:i<cItems.length-1?8:12 }}>
                              <div style={{ width:26, height:26, borderRadius:7, background:u.color+'22', border:`1.5px solid ${u.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:u.color, flexShrink:0, fontFamily:'var(--font-mono)' }}>
                                {item.qty}
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', lineHeight:1.3 }}>{item.name}</div>
                                {item.mods && <div style={{ fontSize:11, color:item.mods.includes('⚠')?'var(--red)':'var(--t4)', marginTop:2, lineHeight:1.4 }}>{item.mods}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}

                      {/* Pending courses — shown clearly, not fired yet */}
                      {pending.length > 0 && (() => {
                        const pendingByCourse = {};
                        pending.forEach(i => {
                          const c = i.course ?? 1;
                          if (!pendingByCourse[c]) pendingByCourse[c] = [];
                          pendingByCourse[c].push(i);
                        });
                        return (
                          <div style={{ marginTop:4, paddingTop:10, borderTop:`1px solid ${u.border}` }}>
                            {Object.entries(pendingByCourse).sort(([a],[b])=>a-b).map(([course, cItems]) => (
                              <div key={course}>
                                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, paddingBottom:4, borderBottom:`1px solid ${u.border}` }}>
                                  <span style={{ fontSize:11, fontWeight:800, color:'var(--t3)' }}>⏳ {COURSE_LABEL[course] || `Course ${course}`}</span>
                                  <span style={{ fontSize:9, color:'var(--t4)', fontWeight:600 }}>PENDING — fire from POS</span>
                                </div>
                                {cItems.map((item,i) => (
                                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, paddingBottom:8, marginBottom:i<cItems.length-1?8:12 }}>
                                    <div style={{ width:26, height:26, borderRadius:7, background:'var(--bg4)', border:`1.5px solid var(--bdr)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'var(--t3)', flexShrink:0, fontFamily:'var(--font-mono)' }}>
                                      {item.qty}
                                    </div>
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontSize:13, fontWeight:700, color:'var(--t2)', lineHeight:1.3 }}>{item.name}</div>
                                      {item.mods && <div style={{ fontSize:11, color:'var(--t4)', marginTop:2, lineHeight:1.4 }}>{item.mods}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>

              {/* Actions */}
              <div style={{ padding:'10px 14px', borderTop:`1px solid ${u.border}`, display:'flex', gap:6 }}>
                <button style={{
                  flex:1, height:38, borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                  background:'var(--grn)', border:'none', color:'#fff', fontSize:13, fontWeight:800,
                  transition:'all .12s',
                }}
                onClick={()=>handleBump(ticket.id)}
                onMouseEnter={e=>e.currentTarget.style.background='#16a34a'}
                onMouseLeave={e=>e.currentTarget.style.background='var(--grn)'}>
                  Bump ✓
                </button>
                <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Recalled to queue','info')}>Recall</button>
                <button className="btn btn-ghost btn-sm" onClick={()=>showToast('Reprinted to kitchen printer','info')}>🖨</button>
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
// ══════════════════════════════════════════════════════════════════════════════
// Back Office Surface — with real reporting
// ══════════════════════════════════════════════════════════════════════════════
export function BackOfficeSurface() {
  const { staff, shift, logout, showToast, closedChecks , menuCategories } = useStore();
  const [subview, setSubview] = useState('reports');

  const views = [
    { id:'reports',   label:'Reports',        icon:'📊' },
    { id:'ai',        label:'AI Assistant',   icon:'✦'  },
    { id:'menu',      label:'Menu',           icon:'🍽' },
    { id:'printers',  label:'Printer setup',       icon:'🖨' },
    { id:'shift',     label:'Shift',          icon:'🕐' },
    { id:'staff',     label:'Staff',          icon:'👥' },
  ];

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      {/* Sub-nav */}
      <div style={{ width:190, background:'var(--bg1)', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', padding:'14px 8px', flexShrink:0 }}>
        <div style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', padding:'0 10px', marginBottom:12 }}>Back office</div>
        {views.map(v=>(
          <button key={v.id} onClick={()=>setSubview(v.id)} style={{
            width:'100%', padding:'9px 12px', borderRadius:10, cursor:'pointer', textAlign:'left',
            fontSize:13, fontWeight:subview===v.id?700:500, border:'none', fontFamily:'inherit',
            background:subview===v.id?'var(--acc-d)':'transparent',
            color:subview===v.id?'var(--acc)':'var(--t2)',
            marginBottom:2, display:'flex', alignItems:'center', gap:8,
            borderLeft:`2px solid ${subview===v.id?'var(--acc)':'transparent'}`,
            transition:'all .12s',
          }}>
            <span style={{ fontSize:v.id==='ai'?14:15, color:v.id==='ai'&&subview===v.id?'var(--acc)':undefined }}>{v.icon}</span>
            {v.label}
          </button>
        ))}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid var(--bdr)' }}>
          <button onClick={logout} style={{ width:'100%', padding:'9px 12px', borderRadius:10, cursor:'pointer', textAlign:'left', fontSize:13, color:'var(--red)', background:'transparent', border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}>
            <span>⏻</span> Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {subview==='reports'   && <div style={{flex:1,overflowY:'auto'}}><BOReports closedChecks={closedChecks} shift={shift} staff={staff}/></div>}
        {subview==='ai'        && <BOAIAssistant closedChecks={closedChecks} shift={shift} staff={staff}/>}
        {subview==='menu'      && <div style={{flex:1,overflowY:'auto',padding:24}}><BOMenu showToast={showToast}/></div>}
        {subview==='printers'  && <div style={{flex:1,overflowY:'auto',padding:24}}><BOPrinters showToast={showToast}/></div>}
        {subview==='shift'     && <div style={{flex:1,overflowY:'auto',padding:24}}><BOShift shift={shift} showToast={showToast}/></div>}
        {subview==='staff'     && <div style={{flex:1,overflowY:'auto',padding:24}}><BOStaff showToast={showToast}/></div>}
      </div>
    </div>
  );
}

// ── AI Shift Assistant ────────────────────────────────────────────────────────
function BOAIAssistant({ closedChecks, shift, staff }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}${staff?.name ? `, ${staff.name}` : ''}. I'm your shift assistant. I can help you analyse today's service, spot trends, suggest upsells, flag concerns, or just answer questions about the shift. What would you like to know?`,
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useState(null);
  const inputRef = useState(null);

  const QUICK_PROMPTS = [
    'How is the shift going?',
    'Which tables are performing best?',
    'What should I 86 soon?',
    'Suggest upsells for tonight',
    'Any concerns I should know about?',
    'What are our top selling items?',
  ];

  // Build a concise shift context for Claude
  const buildContext = () => {
    const now = new Date();
    const revenue = closedChecks.reduce((s,c)=>s+c.total,0);
    const covers  = closedChecks.reduce((s,c)=>s+(c.covers||1),0);
    const avg     = closedChecks.length > 0 ? revenue/closedChecks.length : 0;
    const tips    = closedChecks.reduce((s,c)=>s+(c.tip||0),0);
    const refunds = closedChecks.reduce((s,c)=>s+c.refunds.reduce((r,rf)=>r+rf.amount,0),0);

    // Top items
    const itemMap = {};
    closedChecks.forEach(c=>c.items.forEach(i=>{
      itemMap[i.name] = (itemMap[i.name]||0) + i.qty;
    }));
    const topItems = Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,q])=>`${n} (×${q})`).join(', ');

    // By server
    const serverMap = {};
    closedChecks.forEach(c=>{ const s=c.server||'Unknown'; serverMap[s]=(serverMap[s]||0)+c.total; });
    const byServer = Object.entries(serverMap).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`${n}: £${v.toFixed(0)}`).join(', ');

    return `You are a restaurant shift assistant AI for RestaurantOS. Be concise, practical, and direct. Use £ for currency.

CURRENT TIME: ${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} — ${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
SHIFT: ${shift.name} (open since ${shift.opened})
STAFF: ${staff?.name || 'Unknown'} (${staff?.role || 'Server'})

SHIFT PERFORMANCE (from ${closedChecks.length} closed checks):
- Revenue: £${revenue.toFixed(2)} | Covers: ${covers} | Avg check: £${avg.toFixed(2)}
- Tips collected: £${tips.toFixed(2)} | Refunds issued: £${refunds.toFixed(2)}
- Card: £${closedChecks.filter(c=>c.method==='card').reduce((s,c)=>s+c.total,0).toFixed(2)} | Cash: £${closedChecks.filter(c=>c.method==='cash').reduce((s,c)=>s+c.total,0).toFixed(2)}
- Top items: ${topItems || 'No data yet'}
- By server: ${byServer || 'No data yet'}

Respond helpfully and briefly. If there's no data yet, acknowledge it and still give useful advice.`;
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role:'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: buildContext(),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || 'Sorry, I couldn\'t get a response.';
      setMessages(m => [...m, { role:'assistant', content: reply }]);
    } catch (err) {
      setMessages(m => [...m, { role:'assistant', content: 'Connection error — check your network and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 24px 12px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'var(--acc-d)', border:'1px solid var(--acc-b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✦</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>AI Shift Assistant</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>Powered by Claude · Has full context of today's shift</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:'var(--grn-d)', border:'1px solid var(--grn-b)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--grn)' }}/>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--grn)' }}>Live</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display:'flex', gap:10, marginBottom:16,
            justifyContent: m.role==='user' ? 'flex-end' : 'flex-start',
          }}>
            {m.role==='assistant' && (
              <div style={{ width:28, height:28, borderRadius:8, background:'var(--acc-d)', border:'1px solid var(--acc-b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, marginTop:2 }}>✦</div>
            )}
            <div style={{
              maxWidth:'78%',
              padding:'10px 14px',
              borderRadius: m.role==='user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
              background: m.role==='user' ? 'var(--acc)' : 'var(--bg3)',
              border: m.role==='user' ? 'none' : '1px solid var(--bdr)',
              color: m.role==='user' ? '#0b0c10' : 'var(--t1)',
              fontSize: 13,
              lineHeight: 1.6,
              fontWeight: m.role==='user' ? 600 : 400,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
            {m.role==='user' && (
              <div style={{ width:28, height:28, borderRadius:'50%', background:staff?.color+'22', border:`2px solid ${staff?.color||'var(--acc)'}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:staff?.color||'var(--acc)', flexShrink:0, marginTop:2 }}>
                {staff?.initials || '?'}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'var(--acc-d)', border:'1px solid var(--acc-b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✦</div>
            <div style={{ padding:'12px 16px', borderRadius:'4px 16px 16px 16px', background:'var(--bg3)', border:'1px solid var(--bdr)', display:'flex', gap:5, alignItems:'center' }}>
              {[0,1,2].map(i=>(
                <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--acc)', animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite` }}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div style={{ padding:'0 24px 10px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {QUICK_PROMPTS.map(p=>(
            <button key={p} onClick={()=>send(p)} disabled={loading} style={{
              padding:'5px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit',
              background:'var(--bg3)', border:'1px solid var(--bdr)',
              color:'var(--t3)', fontSize:11, fontWeight:600, transition:'all .12s',
              opacity: loading ? .4 : 1,
            }}
            onMouseEnter={e=>{if(!loading){e.currentTarget.style.borderColor='var(--acc-b)';e.currentTarget.style.color='var(--acc)';}}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr)';e.currentTarget.style.color='var(--t3)';}}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding:'0 24px 18px', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:14, padding:'6px 6px 6px 14px', transition:'border-color .15s' }}
          onFocusCapture={e=>e.currentTarget.style.borderColor='var(--acc-b)'}
          onBlurCapture={e=>e.currentTarget.style.borderColor='var(--bdr2)'}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
            placeholder="Ask anything about the shift…"
            disabled={loading}
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'var(--t1)', fontSize:13, fontFamily:'inherit' }}
          />
          <button onClick={()=>send()} disabled={!input.trim()||loading} style={{
            width:36, height:36, borderRadius:10, cursor:'pointer', fontFamily:'inherit',
            background: input.trim()&&!loading ? 'var(--acc)' : 'var(--bg4)',
            border: 'none', color: input.trim()&&!loading ? '#0b0c10' : 'var(--t4)',
            fontSize:16, display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all .12s', flexShrink:0,
          }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ── Reporting ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, color, mono }) {
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color:color||'var(--t1)', fontFamily:mono?'var(--font-mono)':'inherit', letterSpacing:'-.01em' }}>{value}</div>
      {sub&&<div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max>0 ? Math.min(100,(value/max)*100) : 0;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
        <span style={{ color:'var(--t2)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{label}</span>
        <span style={{ color:'var(--acc)', fontWeight:700, fontFamily:'var(--font-mono)', flexShrink:0, marginLeft:10 }}>£{value.toFixed(2)}</span>
      </div>
      <div style={{ height:6, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color||'var(--acc)', borderRadius:3, transition:'width .4s' }}/>
      </div>
    </div>
  );
}

function BOReports({ closedChecks, shift, staff }) {
  const [period, setPeriod] = useState('today');
  const [tab, setTab] = useState('overview');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const startOfWeek = new Date(startOfDay.getTime()-startOfDay.getDay()*86400000);

  const filtered = closedChecks.filter(c => {
    const d = new Date(c.closedAt);
    if (period==='today') return d >= startOfDay;
    if (period==='week')  return d >= startOfWeek;
    return true;
  });

  // Core metrics
  const revenue      = filtered.reduce((s,c)=>s+c.total,0);
  const refunded     = filtered.reduce((s,c)=>s+c.refunds.reduce((r,rf)=>r+rf.amount,0),0);
  const netRevenue   = revenue - refunded;
  const totalCovers  = filtered.reduce((s,c)=>s+(c.covers||1),0);
  const avgCheck     = filtered.length>0 ? revenue/filtered.length : 0;
  const totalTips    = filtered.reduce((s,c)=>s+(c.tip||0),0);
  const cardSales    = filtered.filter(c=>c.method==='card').reduce((s,c)=>s+c.total,0);
  const cashSales    = filtered.filter(c=>c.method==='cash').reduce((s,c)=>s+c.total,0);
  const splitSales   = filtered.filter(c=>c.method==='split').reduce((s,c)=>s+c.total,0);

  // Top items from all checks
  const itemMap = {};
  filtered.forEach(c => {
    c.items.forEach(item => {
      if (!itemMap[item.name]) itemMap[item.name] = { name:item.name, qty:0, revenue:0 };
      itemMap[item.name].qty    += item.qty;
      itemMap[item.name].revenue += item.price * item.qty;
    });
  });
  const topItems = Object.values(itemMap).sort((a,b)=>b.revenue-a.revenue).slice(0,8);
  const maxItemRevenue = topItems[0]?.revenue || 1;

  // By server
  const serverMap = {};
  filtered.forEach(c => {
    const s = c.server||'Unknown';
    if (!serverMap[s]) serverMap[s] = { name:s, checks:0, revenue:0, covers:0, tips:0 };
    serverMap[s].checks++;
    serverMap[s].revenue += c.total;
    serverMap[s].covers  += c.covers||1;
    serverMap[s].tips    += c.tip||0;
  });
  const byServer = Object.values(serverMap).sort((a,b)=>b.revenue-a.revenue);
  const maxServerRev = byServer[0]?.revenue || 1;

  // By order type
  const typeMap = {};
  filtered.forEach(c => {
    const t = c.orderType||'dine-in';
    if (!typeMap[t]) typeMap[t] = 0;
    typeMap[t] += c.total;
  });

  // Hourly breakdown
  const hourMap = {};
  for (let h=11;h<=23;h++) hourMap[h]=0;
  filtered.forEach(c => {
    const h = new Date(c.closedAt).getHours();
    hourMap[h] = (hourMap[h]||0) + c.total;
  });
  const maxHourRevenue = Math.max(...Object.values(hourMap),1);
  const hours = Object.entries(hourMap).map(([h,v])=>({h:parseInt(h),v}));

  // Payment split pct
  const cardPct  = revenue>0?Math.round(cardSales/revenue*100):0;
  const cashPct  = revenue>0?Math.round(cashSales/revenue*100):0;
  const splitPct = revenue>0?Math.round(splitSales/revenue*100):0;

  const TABS = [['overview','Overview'],['items','Top items'],['servers','By server'],['hourly','Hourly']];

  return (
    <div style={{ padding:24 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em' }}>Reports</div>
          <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>Live from {filtered.length} closed check{filtered.length!==1?'s':''}</div>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {[['today','Today'],['week','This week'],['all','All time']].map(([p,l])=>(
            <button key={p} onClick={()=>setPeriod(p)} style={{
              padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit',
              background:period===p?'var(--acc-d)':'var(--bg3)',
              border:`1.5px solid ${period===p?'var(--acc-b)':'var(--bdr)'}`,
              color:period===p?'var(--acc)':'var(--t3)',
              fontSize:12, fontWeight:700, transition:'all .12s',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        <Stat label="Net revenue"   value={`£${netRevenue.toFixed(2)}`}  color="var(--acc)" mono/>
        <Stat label="Checks"        value={filtered.length}               sub={`Avg £${avgCheck.toFixed(2)}`}/>
        <Stat label="Covers"        value={totalCovers}                   sub={totalCovers>0?`£${(netRevenue/totalCovers).toFixed(2)} per head`:''}/>
        <Stat label="Tips"          value={`£${totalTips.toFixed(2)}`}    color="var(--grn)" mono sub={refunded>0?`−£${refunded.toFixed(2)} refunded`:''}/>
      </div>

      {/* Payment method split */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px', marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>Payment methods</div>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {[
            { label:'💳 Card',  val:cardSales,  pct:cardPct,  color:'#3b82f6' },
            { label:'💵 Cash',  val:cashSales,  pct:cashPct,  color:'var(--grn)' },
            { label:'⚖ Split', val:splitSales, pct:splitPct, color:'var(--pur)' },
          ].map(m=>(
            <div key={m.label} style={{ flex:1, padding:'10px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
              <div style={{ fontSize:12, color:'var(--t3)', marginBottom:5 }}>{m.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:m.color, fontFamily:'var(--font-mono)' }}>£{m.val.toFixed(2)}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{m.pct}% of sales</div>
            </div>
          ))}
        </div>
        {/* Bar */}
        <div style={{ height:8, borderRadius:4, overflow:'hidden', display:'flex', gap:2 }}>
          {cardPct>0&&<div style={{ width:`${cardPct}%`, background:'#3b82f6', borderRadius:4, transition:'width .4s' }}/>}
          {cashPct>0&&<div style={{ width:`${cashPct}%`, background:'var(--grn)', borderRadius:4, transition:'width .4s' }}/>}
          {splitPct>0&&<div style={{ width:`${splitPct}%`, background:'var(--pur)', borderRadius:4, transition:'width .4s' }}/>}
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--bdr)', marginBottom:20 }}>
        {TABS.map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'9px 18px', cursor:'pointer', fontFamily:'inherit', border:'none',
            borderBottom:`2.5px solid ${tab===t?'var(--acc)':'transparent'}`,
            background:'transparent', color:tab===t?'var(--acc)':'var(--t3)',
            fontSize:13, fontWeight:tab===t?800:500, transition:'all .12s',
          }}>{l}</button>
        ))}
      </div>

      {/* Overview */}
      {tab==='overview'&&(
        <>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {/* Order types */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>Order types</div>
              {Object.entries(typeMap).length===0&&<div style={{color:'var(--t4)',fontSize:12}}>No data yet</div>}
              {Object.entries(typeMap).map(([type,val])=>(
                <MiniBar key={type} label={type.charAt(0).toUpperCase()+type.slice(1)} value={val} max={revenue} color="var(--acc)"/>
              ))}
            </div>
            {/* Refunds */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:14 }}>Refunds &amp; adjustments</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8 }}>{filtered.filter(c=>c.refunds.length>0).length} checks with refunds</div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--bdr)', fontSize:13 }}>
                <span style={{color:'var(--t2)'}}>Gross revenue</span>
                <span style={{fontFamily:'var(--font-mono)',fontWeight:700}}>£{revenue.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--bdr)', fontSize:13 }}>
                <span style={{color:'var(--red)'}}>Total refunded</span>
                <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--red)'}}>−£{refunded.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:14, fontWeight:800 }}>
                <span>Net revenue</span>
                <span style={{fontFamily:'var(--font-mono)',color:'var(--acc)'}}>£{netRevenue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Top items */}
      {tab==='items'&&(
        <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:16 }}>Top items by revenue</div>
          {topItems.length===0&&<div style={{color:'var(--t4)',fontSize:12}}>No items data yet</div>}
          {topItems.map((item,i)=>(
            <div key={item.name} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, fontWeight:800, width:18, height:18, borderRadius:5, background:'var(--acc-d)', color:'var(--acc)', display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</span>
                  <span style={{color:'var(--t1)',fontWeight:600}}>{item.name}</span>
                </div>
                <div style={{ display:'flex', gap:14, flexShrink:0 }}>
                  <span style={{color:'var(--t3)'}}>×{item.qty}</span>
                  <span style={{color:'var(--acc)',fontWeight:700,fontFamily:'var(--font-mono)'}}>£{item.revenue.toFixed(2)}</span>
                </div>
              </div>
              <div style={{ height:5, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(item.revenue/maxItemRevenue)*100}%`, background:'var(--acc)', borderRadius:3 }}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By server */}
      {tab==='servers'&&(
        <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:16 }}>Server performance</div>
          {byServer.length===0&&<div style={{color:'var(--t4)',fontSize:12}}>No server data yet</div>}
          {byServer.map(srv=>(
            <div key={srv.name} style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid var(--bdr)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{srv.name}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{srv.checks} checks · {srv.covers} covers</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>£{srv.revenue.toFixed(2)}</div>
                  <div style={{ fontSize:11, color:'var(--t3)' }}>avg £{srv.checks>0?(srv.revenue/srv.checks).toFixed(2):'0'} · tips £{srv.tips.toFixed(2)}</div>
                </div>
              </div>
              <div style={{ height:5, background:'var(--bg4)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(srv.revenue/maxServerRev)*100}%`, background:'var(--blu)', borderRadius:3 }}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hourly */}
      {tab==='hourly'&&(
        <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:20 }}>Revenue by hour</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:140 }}>
            {hours.map(({h,v})=>{
              const pct = v>0?(v/maxHourRevenue)*100:0;
              const label = h<12?`${h}am`:h===12?'12pm':h===0?'12am':`${h-12}pm`;
              return (
                <div key={h} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, height:'100%', justifyContent:'flex-end' }}>
                  <div style={{ fontSize:9, color:'var(--t4)', fontFamily:'var(--font-mono)', marginBottom:2 }}>{v>0?`£${v.toFixed(0)}`:''}</div>
                  <div style={{ width:'100%', background:pct>0?'var(--acc)':'var(--bg4)', borderRadius:'4px 4px 0 0', height:`${Math.max(pct,v>0?4:2)}%`, transition:'height .4s', minHeight:v>0?4:2 }}/>
                  <div style={{ fontSize:9, color:'var(--t4)', whiteSpace:'nowrap' }}>{label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:14, display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', borderTop:'1px solid var(--bdr)', paddingTop:10 }}>
            <span>Peak hour: {hours.reduce((p,h)=>h.v>p.v?h:p,hours[0])?.h}:00</span>
            <span>Total: £{revenue.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BOOverview({ shift, staff, showToast }) {
  // Kept for any legacy refs — now replaced by BOReports
  return <BOReports closedChecks={[]} shift={shift} staff={staff}/>;
}
function BOMenu({ showToast }) {
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
        {(menuCategories||[]).filter(c=>!c.isSpecial&&!c.parentId).map(c=>(
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
  // Lazy-import PrinterSettings to keep the bundle clean
  const [Comp, setComp] = useState(null);
  useEffect(() => {
    import('../components/PrinterSettings').then(m => setComp(() => m.default));
  }, []);
  if (!Comp) return <div style={{ color:'var(--t3)', padding:24 }}>Loading printer settings…</div>;
  return <Comp />;
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
