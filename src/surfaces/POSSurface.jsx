import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { CATEGORIES, MENU_ITEMS, ALLERGENS, QUICK_IDS, getDaypart } from '../data/seed';
import ProductModal, { AllergenModal } from '../components/ProductModal';
import CheckoutModal from './CheckoutModal';
import CustomerModal from '../components/CustomerModal';
import CollectionQueue from '../components/CollectionQueue';

const CAT_META = {
  quick:     { icon:'⚡', color:'#e8a020' },
  starters:  { icon:'🥗', color:'#22c55e' },
  mains:     { icon:'🍽', color:'#3b82f6' },
  pizza:     { icon:'🍕', color:'#f07020' },
  sides:     { icon:'🍟', color:'#a855f7' },
  desserts:  { icon:'🍮', color:'#e84066' },
  drinks:    { icon:'🍷', color:'#e84040' },
  cocktails: { icon:'🍸', color:'#22d3ee' },
};
const COURSE_COLORS = {
  0: { label:'Immediate', color:'#22d3ee', bg:'rgba(34,211,238,.1)' },
  1: { label:'Course 1',  color:'#22c55e', bg:'rgba(34,197,94,.1)' },
  2: { label:'Course 2',  color:'#3b82f6', bg:'rgba(59,130,246,.1)' },
  3: { label:'Course 3',  color:'#e8a020', bg:'rgba(232,160,32,.1)' },
};

export default function POSSurface() {
  const store = useStore();
  const {
    staff, allergens, toggleAllergen, clearAllergens,
    order, addToOrder, addCustomItem, removeFromOrder, updateQty,
    updateItemSeat, updateItemCourse, sendToKitchen, fireCourse, clearOrder,
    getOrderTotals, tableId, orderType, setOrderType, covers, setCovers,
    activeSeat, setActiveSeat, showToast,
    pendingItem, setPendingItem, clearPendingItem,
    eightySixIds, toggle86,
    customer, setCustomer, clearCustomer,
    orderQueue, orderNote, setOrderNote,
  } = store;

  const [cat, setCat]               = useState('quick');
  const [modalItem, setModalItem]   = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [search, setSearch]         = useState('');
  const [showAllergens, setShowAllergens] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [pendingOrderType, setPendingOrderType] = useState(null);
  const [showQueue, setShowQueue]   = useState(false);

  const daypart = getDaypart();
  const catMeta = CAT_META[cat] || CAT_META.quick;
  const items = order?.items || [];
  const { subtotal, service, total, itemCount } = getOrderTotals();
  const firedCourses = order?.firedCourses || [];
  const activeQueueCount = orderQueue.filter(o => o.status !== 'collected').length;

  const rawItems = cat === 'quick'
    ? QUICK_IDS.map(id => MENU_ITEMS.find(i => i.id === id)).filter(Boolean)
    : MENU_ITEMS.filter(i => i.cat === cat);

  const displayItems = useMemo(() => {
    if (!search.trim()) return rawItems;
    const q = search.toLowerCase();
    return MENU_ITEMS.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
  }, [cat, search]);

  // When switching to takeaway/collection, prompt for customer info
  const handleTypeChange = (newType) => {
    if (newType !== 'dine-in') {
      setPendingOrderType(newType);
      setShowCustomerModal(true);
    } else {
      setOrderType('dine-in');
      clearCustomer();
    }
  };

  const handleCustomerConfirm = (c) => {
    setShowCustomerModal(false);
    setCustomer(c);
    setOrderType(pendingOrderType);
    setPendingOrderType(null);
    showToast(`${c.name} — ${pendingOrderType} order started`, 'success');
  };

  const handleItemTap = (item) => {
    if (eightySixIds.includes(item.id)) { showToast(`${item.name} is 86'd`, 'error'); return; }
    if (allergens.some(a => (item.allergens||[]).includes(a))) { setPendingItem(item); return; }
    openFlow(item);
  };

  const openFlow = (item) => {
    if (item.type === 'simple') {
      addToOrder(item, [], null, { displayName: item.name, qty: 1, linePrice: item.price });
      showToast(`${item.name} added`, 'success');
    } else {
      setModalItem(item);
    }
  };

  const handleSend = () => {
    if (!items.length) { showToast('No items to send', 'error'); return; }
    // For takeaway/collection without customer info, prompt first
    if (orderType !== 'dine-in' && !customer) {
      setPendingOrderType(orderType); setShowCustomerModal(true); return;
    }
    sendToKitchen();
    showToast(orderType === 'dine-in' ? 'Sent to kitchen' : `Order for ${customer?.name} sent to kitchen`, 'success');
  };

  const byCourse = useMemo(() => {
    const groups = {};
    items.forEach(item => { const c = item.course ?? 1; if (!groups[c]) groups[c] = []; groups[c].push(item); });
    return groups;
  }, [items]);

  const courseNums = Object.keys(byCourse).map(Number).sort();
  const hasSentOrder = !!order?.sentAt;
  const nextCourseToFire = courseNums.find(c => c > 0 && !firedCourses.includes(c) && c > 1 && firedCourses.includes(c-1 < 1 ? 1 : c-1));
  const seatList = useMemo(() => { const a=['shared']; for(let i=1;i<=covers;i++)a.push(i); return a; }, [covers]);

  // Order type labels
  const TYPE_OPTS = [
    { id:'dine-in',    label:'Dine in',  icon:'🍽' },
    { id:'takeaway',   label:'Takeaway', icon:'🥡' },
    { id:'collection', label:'Collect',  icon:'📦' },
  ];

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>

      {/* ══ ORDER PANEL (LEFT) ════════════════════════════════════ */}
      <div style={{ width:'var(--ord)', flexShrink:0, display:'flex', flexDirection:'column', background:'var(--bg1)', borderRight:'1px solid var(--bdr2)', overflow:'hidden' }}>

        {/* Order type selector */}
        <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', gap:4, marginBottom: orderType==='dine-in' ? 10 : (customer ? 10 : 0) }}>
            {TYPE_OPTS.map(t => (
              <button key={t.id} onClick={() => handleTypeChange(t.id)} style={{
                flex:1, padding:'7px 3px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                border:`1.5px solid ${orderType===t.id?'var(--acc-b)':'var(--bdr)'}`,
                background:orderType===t.id?'var(--acc-d)':'transparent',
                color:orderType===t.id?'var(--acc)':'var(--t3)',
                fontSize:11, fontWeight:700,
                display:'flex', flexDirection:'column', alignItems:'center', gap:1,
              }}>
                <span style={{ fontSize:15 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Dine-in: covers */}
          {orderType === 'dine-in' && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, color:'var(--t3)', fontWeight:600 }}>Covers</span>
              <div style={{ display:'flex', alignItems:'center', gap:1, marginLeft:'auto', background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:8, overflow:'hidden' }}>
                <button onClick={() => setCovers(covers-1)} style={{ width:30,height:26,background:'transparent',border:'none',color:'var(--t2)',fontSize:16,cursor:'pointer',fontFamily:'inherit' }}>−</button>
                <div style={{ width:30,height:26,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'var(--t1)' }}>{covers}</div>
                <button onClick={() => setCovers(covers+1)} style={{ width:30,height:26,background:'transparent',border:'none',color:'var(--t2)',fontSize:16,cursor:'pointer',fontFamily:'inherit' }}>+</button>
              </div>
            </div>
          )}

          {/* Takeaway/collection: customer info card */}
          {orderType !== 'dine-in' && customer && (
            <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px', position:'relative' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ width:36,height:36,borderRadius:'50%',background:'var(--acc-d)',border:'1px solid var(--acc-b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'var(--acc)',flexShrink:0 }}>
                  {customer.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', marginBottom:2 }}>{customer.name}</div>
                  <div style={{ fontSize:11, color:'var(--t3)' }}>{customer.phone}</div>
                  {orderType === 'collection' && (
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--acc)', marginTop:4 }}>
                      {customer.isASAP ? '⚡ ASAP collection' : `🕐 Collection at ${customer.collectionTime}`}
                    </div>
                  )}
                  {customer.notes && <div style={{ fontSize:11, color:'#f97316', marginTop:3, fontStyle:'italic' }}>📝 {customer.notes}</div>}
                </div>
                <button onClick={() => { setShowCustomerModal(true); setPendingOrderType(orderType); }} style={{ fontSize:11,color:'var(--acc)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0,flexShrink:0 }}>Edit</button>
              </div>
            </div>
          )}

          {/* No customer yet for takeaway/collection */}
          {orderType !== 'dine-in' && !customer && (
            <button onClick={() => { setShowCustomerModal(true); setPendingOrderType(orderType); }} style={{
              width:'100%', padding:'10px 12px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
              background:'var(--bg3)', border:'1px dashed var(--bdr2)', color:'var(--t3)',
              fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:8, justifyContent:'center',
            }}>
              <span>👤</span> Add customer details
            </button>
          )}
        </div>

        {/* Seat selector (dine-in only) */}
        {orderType === 'dine-in' && covers > 1 && (
          <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>Adding to seat</div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {seatList.map(s => {
                const active = activeSeat === s;
                const count = items.filter(i => i.seat === s).length;
                return (
                  <button key={s} onClick={() => setActiveSeat(s)} style={{
                    padding:'4px 10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit',
                    border:`1.5px solid ${active?'var(--acc)':'var(--bdr)'}`,
                    background:active?'var(--acc-d)':'var(--bg3)',
                    color:active?'var(--acc)':'var(--t3)', fontSize:11, fontWeight:700,
                  }}>
                    {s==='shared'?'Shared':`S${s}`}
                    {count>0&&<span style={{marginLeft:3,opacity:.7}}>·{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Order header row */}
        <div style={{ padding:'7px 12px 3px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em' }}>
            {orderType==='dine-in' && tableId ? `T${tableId.replace(/^[tbp]/,'')}` : orderType}
            {' · '}{staff?.name}
          </span>
          {items.length>0&&<button onClick={clearOrder} style={{ fontSize:11,color:'var(--t3)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit' }}>Clear</button>}
        </div>

        {/* Items */}
        <div style={{ flex:1, overflowY:'auto', padding:'3px 10px' }}>
          {items.length===0&&(
            <div style={{ textAlign:'center', padding:'44px 0', color:'var(--t3)' }}>
              <div style={{ fontSize:34,marginBottom:8,opacity:.4 }}>🧾</div>
              <div style={{ fontSize:13,fontWeight:600,color:'var(--t3)',marginBottom:3 }}>Order is empty</div>
              <div style={{ fontSize:12 }}>Tap items from the menu</div>
            </div>
          )}

          {courseNums.map(courseNum => {
            const courseItems = byCourse[courseNum];
            const cc = COURSE_COLORS[courseNum] || COURSE_COLORS[1];
            const isFired = firedCourses.includes(courseNum) || courseNum===0;
            const canFire = hasSentOrder && !isFired && courseNum>1 && (firedCourses.includes(courseNum-1)||firedCourses.includes(1));
            return (
              <div key={courseNum} style={{ marginBottom:8 }}>
                {courseNums.length>1&&(
                  <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:5,marginTop:3 }}>
                    <div style={{ height:1,flex:1,background:'var(--bdr)' }}/>
                    <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                      <span style={{ fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:isFired?'var(--grn-d)':cc.bg,border:`1px solid ${isFired?'var(--grn-b)':cc.color+'44'}`,color:isFired?'var(--grn)':cc.color }}>
                        {isFired?'✓ ':''}{cc.label}
                      </span>
                      {canFire&&<button onClick={()=>fireCourse(courseNum)} style={{ fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:'var(--acc)',color:'#0e0f14',border:'none',cursor:'pointer',fontFamily:'inherit' }}>🔥 Fire</button>}
                    </div>
                    <div style={{ height:1,flex:1,background:'var(--bdr)' }}/>
                  </div>
                )}
                {courseItems.map(item => (
                  <OrderItem key={item.uid} item={item} covers={covers} orderType={orderType}
                    onQty={d=>updateQty(item.uid,d)} onRemove={()=>removeFromOrder(item.uid)}
                    onSeat={s=>updateItemSeat(item.uid,s)} onCourse={c=>updateItemCourse(item.uid,c)}
                    seatList={seatList}/>
                ))}
              </div>
            );
          })}
        </div>

        {/* Totals + actions */}
        {/* Order note */}
        {items.length > 0 && (
          <div style={{ padding:'6px 12px 0', flexShrink:0 }}>
            <textarea
              value={orderNote} onChange={e => setOrderNote(e.target.value)}
              placeholder="Order note for kitchen (allergies, preferences…)"
              rows={orderNote ? 2 : 1}
              style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:8, padding:'7px 10px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.5, display:'block' }}/>
          </div>
        )}

        <div style={{ flexShrink:0, borderTop:'1px solid var(--bdr)', background:'var(--bg2)' }}>
          {items.length>0&&(
            <>
              <div style={{ padding:'10px 12px 0' }}>
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--t3)',marginBottom:3 }}>
                  <span>Subtotal · {itemCount} item{itemCount!==1?'s':''}</span>
                  <span style={{ fontFamily:'DM Mono,monospace' }}>£{subtotal.toFixed(2)}</span>
                </div>
                {service>0
                  ? <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--t3)',marginBottom:3 }}><span>Service (12.5%)</span><span style={{ fontFamily:'DM Mono,monospace' }}>£{service.toFixed(2)}</span></div>
                  : <div style={{ fontSize:11,color:'var(--grn)',marginBottom:3 }}>No service charge · {orderType}</div>
                }
                <div style={{ display:'flex',justifyContent:'space-between',fontSize:20,fontWeight:800,marginTop:8,paddingTop:8,borderTop:'1px solid var(--bdr3)',marginBottom:2 }}>
                  <span>Total</span>
                  <span style={{ color:'var(--acc)',fontFamily:'DM Mono,monospace' }}>£{total.toFixed(2)}</span>
                </div>
              </div>
              {hasSentOrder&&nextCourseToFire&&(
                <div style={{ margin:'6px 12px 0',padding:'7px 12px',background:'rgba(232,160,32,.1)',border:'1px solid rgba(232,160,32,.25)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <span style={{ fontSize:12,color:'var(--acc)',fontWeight:600 }}>{COURSE_COLORS[nextCourseToFire]?.label} ready to fire</span>
                  <button onClick={()=>fireCourse(nextCourseToFire)} style={{ fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:8,background:'var(--acc)',color:'#0e0f14',border:'none',cursor:'pointer',fontFamily:'inherit' }}>🔥 Fire</button>
                </div>
              )}
              <div style={{ padding:'7px 12px 12px',display:'flex',gap:6 }}>
                <button onClick={()=>setShowCustom(true)} title="Add custom item" style={{ width:34,height:34,borderRadius:8,border:'1px solid var(--bdr2)',background:'transparent',color:'var(--t3)',cursor:'pointer',fontFamily:'inherit',fontSize:18,flexShrink:0 }}>+</button>
                <button className="btn btn-ghost" style={{ flex:1,height:34 }} onClick={handleSend}>
                  {hasSentOrder?'Add →':'Send →'}
                </button>
                <button className="btn btn-acc" style={{ flex:1,height:34 }} onClick={()=>setShowCheckout(true)}>
                  Pay £{total.toFixed(2)}
                </button>
              </div>
            </>
          )}
          {/* Collection queue button — always visible */}
          {(orderType!=='dine-in'||activeQueueCount>0) && (
            <div style={{ padding: items.length>0?'0 12px 10px':'10px 12px' }}>
              <button onClick={()=>setShowQueue(true)} style={{
                width:'100%', padding:'9px 12px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                background:'var(--bg3)', border:`1px solid ${activeQueueCount>0?'var(--acc-b)':'var(--bdr)'}`,
                color: activeQueueCount>0?'var(--acc)':'var(--t2)',
                fontSize:13, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <span>📦 Collection queue</span>
                {activeQueueCount>0&&<span style={{ background:'var(--acc)',color:'#0e0f14',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:800 }}>{activeQueueCount}</span>}
              </button>
            </div>
          )}
          {items.length===0&&orderType==='dine-in'&&<div style={{ height:10 }}/>}
        </div>
      </div>

      {/* ══ CATEGORY NAV (CENTRE) ═════════════════════════════════ */}
      <div style={{ width:'var(--cat)',flexShrink:0,background:'var(--bg1)',borderRight:'1px solid var(--bdr2)',display:'flex',flexDirection:'column',overflow:'hidden' }}>
        <div style={{ padding:'14px 10px 10px',borderBottom:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:10,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.1em',paddingLeft:4 }}>Menu</div>
        </div>
        <div style={{ flex:1,overflowY:'auto',padding:'8px 8px' }}>
          {CATEGORIES.map(c=>{
            const m=CAT_META[c.id]||{};
            const isActive=cat===c.id&&!search;
            const count=c.id==='quick'?QUICK_IDS.length:MENU_ITEMS.filter(i=>i.cat===c.id).length;
            const e86=MENU_ITEMS.filter(i=>i.cat===c.id&&eightySixIds.includes(i.id)).length;
            return(
              <button key={c.id} onClick={()=>{setCat(c.id);setSearch('');}} style={{ width:'100%',padding:'10px',borderRadius:10,cursor:'pointer',marginBottom:4,display:'flex',flexDirection:'column',alignItems:'flex-start',gap:2,background:isActive?(m.color+'18'):'transparent',border:`1px solid ${isActive?(m.color+'44'):'transparent'}`,transition:'all .15s',fontFamily:'inherit',textAlign:'left' }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,width:'100%' }}>
                  <span style={{ fontSize:18,lineHeight:1 }}>{m.icon||'•'}</span>
                  <span style={{ fontSize:13,fontWeight:600,color:isActive?m.color:'var(--t2)',flex:1 }}>{c.label}</span>
                </div>
                <div style={{ fontSize:10,color:'var(--t3)',paddingLeft:26 }}>
                  {count} items{e86>0&&<span style={{ color:'var(--red)',marginLeft:4 }}>· {e86} 86'd</span>}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ padding:'10px 8px',borderTop:'1px solid var(--bdr)' }}>
          <button onClick={()=>setShowAllergens(s=>!s)} style={{ width:'100%',padding:'8px 10px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:6,background:allergens.length>0?'var(--red-d)':'var(--bg3)',border:`1px solid ${allergens.length>0?'var(--red-b)':'var(--bdr)'}`,color:allergens.length>0?'var(--red)':'var(--t3)',fontSize:11,fontWeight:600 }}>
            <span>⚠</span>
            <span>{allergens.length>0?`${allergens.length} allergen filter${allergens.length>1?'s':''}`:'Allergen filter'}</span>
          </button>
        </div>
      </div>

      {/* ══ PRODUCT GRID (RIGHT) ══════════════════════════════════ */}
      <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0 }}>
        {/* Search / header */}
        <div style={{ padding:'10px 14px',borderBottom:'1px solid var(--bdr)',background:'var(--bg1)',flexShrink:0,display:'flex',alignItems:'center',gap:12 }}>
          <div style={{ position:'relative',flex:1,maxWidth:300 }}>
            <span style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--t3)',fontSize:14 }}>🔍</span>
            <input className="input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ paddingLeft:34,height:36,fontSize:13 }}/>
            {search&&<button onClick={()=>setSearch('')} style={{ position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:16,lineHeight:1 }}>×</button>}
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontSize:20 }}>{search?'🔍':catMeta.icon}</span>
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:search?'var(--t1)':catMeta.color,lineHeight:1.2 }}>{search?`"${search}"`:CATEGORIES.find(c=>c.id===cat)?.label}</div>
              <div style={{ fontSize:11,color:'var(--t3)',marginTop:1 }}>{displayItems.length} items{cat==='quick'&&!search?` · ${daypart}`:''}</div>
            </div>
          </div>
        </div>

        {/* Allergen bar */}
        {showAllergens&&(
          <div style={{ padding:'8px 14px',borderBottom:'1px solid var(--bdr)',background:'var(--bg1)',flexShrink:0 }}>
            <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
              {allergens.length>0&&<button onClick={clearAllergens} style={{ padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:'var(--bg3)',border:'1px solid var(--bdr2)',color:'var(--t2)',cursor:'pointer',fontFamily:'inherit' }}>Clear all</button>}
              {ALLERGENS.map(a=>{
                const on=allergens.includes(a.id);
                return(<button key={a.id} onClick={()=>toggleAllergen(a.id)} style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${on?'var(--red-b)':'var(--bdr)'}`,background:on?'var(--red-d)':'transparent',color:on?'var(--red)':'var(--t3)' }}>
                  <span style={{ width:13,height:13,borderRadius:3,background:on?'var(--red)':'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:on?'#fff':'var(--t3)',flexShrink:0 }}>{a.icon}</span>
                  {a.label}
                </button>);
              })}
            </div>
          </div>
        )}

        {/* Item grid */}
        <div style={{ flex:1,overflowY:'auto',padding:12 }}>
          {cat==='quick'&&!search&&(
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <div style={{ fontSize:13,fontWeight:600,color:'var(--t2)' }}>AI-curated · {daypart}</div>
              <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,background:'var(--acc-d)',border:'1px solid var(--acc-b)',color:'var(--acc)' }}>Updated nightly</span>
            </div>
          )}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:9 }}>
            {displayItems.map((item)=>{
              const m=CAT_META[item.cat]||CAT_META.quick;
              const flagged=allergens.some(a=>item.allergens?.includes(a));
              const is86=eightySixIds.includes(item.id);
              const rank=cat==='quick'?QUICK_IDS.indexOf(item.id):-1;
              const isHot=rank>=0&&rank<3;
              const fromPrice=item.type==='variants'?Math.min(...item.variants.map(v=>v.price)):item.price;
              return(
                <button key={item.id} onClick={()=>handleItemTap(item)} style={{ display:'flex',flexDirection:'column',padding:0,overflow:'hidden',background:is86?'var(--bg3)':flagged?'rgba(232,64,64,.08)':'var(--bg2)',border:`1px solid ${is86?'var(--bdr)':flagged?'var(--red-b)':isHot?m.color+'33':'var(--bdr)'}`,borderRadius:12,cursor:is86?'not-allowed':'pointer',textAlign:'left',opacity:is86?.45:1,transition:'all .15s',fontFamily:'inherit',position:'relative' }}>
                  <div style={{ height:3,background:is86?'var(--bg5)':flagged?'var(--red)':isHot?m.color:m.color+'44',width:'100%',flexShrink:0 }}/>
                  <div style={{ padding:'11px 10px 10px',flex:1,display:'flex',flexDirection:'column' }}>
                    <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:7 }}>
                      <span style={{ fontSize:22,lineHeight:1 }}>{flagged?'⚠️':is86?'🚫':m.icon}</span>
                      <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2 }}>
                        {is86&&<span style={{ fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:4,background:'var(--red-d)',color:'var(--red)',border:'1px solid var(--red-b)' }}>86'd</span>}
                        {isHot&&!is86&&!flagged&&<span style={{ fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:4,background:m.color+'22',color:m.color }}>#{rank+1}</span>}
                        {flagged&&<span style={{ fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:4,background:'var(--red-d)',color:'var(--red)' }}>allergen</span>}
                      </div>
                    </div>
                    <div style={{ fontSize:12,fontWeight:700,color:is86?'var(--t3)':flagged?'var(--red)':'var(--t1)',lineHeight:1.3,marginBottom:4,flex:1 }}>{item.name}</div>
                    {item.description&&<div style={{ fontSize:11,color:'var(--t3)',lineHeight:1.3,marginBottom:5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden' }}>{item.description}</div>}
                    <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',marginTop:'auto' }}>
                      <div style={{ fontSize:15,fontWeight:800,color:is86?'var(--t3)':flagged?'var(--red)':m.color,fontFamily:'DM Mono,monospace' }}>
                        {item.type==='variants'?`from £${fromPrice.toFixed(2)}`:`£${fromPrice.toFixed(2)}`}
                      </div>
                      <div style={{ display:'flex',gap:3,alignItems:'center' }}>
                        {item.type!=='simple'&&<span style={{ fontSize:9,fontWeight:600,padding:'1px 4px',borderRadius:3,background:'var(--bg4)',color:'var(--t3)' }}>{item.type==='variants'?'sizes':item.type==='modifiers'?'opts':'build'}</span>}
                        <button onClick={e=>{e.stopPropagation();toggle86(item.id);showToast(is86?`${item.name} un-86'd`:`${item.name} 86'd`,'warning');}} style={{ width:18,height:18,borderRadius:4,border:`1px solid ${is86?'var(--red-b)':'var(--bdr2)'}`,background:is86?'var(--red-d)':'transparent',color:is86?'var(--red)':'var(--t4)',cursor:'pointer',fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }} title={is86?`Un-86 ${item.name}`:`86 ${item.name}`}>{is86?'✕':'86'}</button>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {displayItems.length===0&&<div style={{ textAlign:'center',padding:'80px 0',color:'var(--t3)' }}><div style={{ fontSize:40,marginBottom:12 }}>🔍</div><div style={{ fontSize:15,fontWeight:600,color:'var(--t2)',marginBottom:6 }}>No items found</div><button onClick={()=>setSearch('')} style={{ fontSize:13,color:'var(--acc)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit' }}>Clear search</button></div>}
        </div>
      </div>

      {/* ══ MODALS ════════════════════════════════════════════════ */}
      {pendingItem&&<AllergenModal item={pendingItem} activeAllergens={allergens} onConfirm={()=>{const i=pendingItem;clearPendingItem();openFlow(i);}} onCancel={clearPendingItem}/>}
      {modalItem&&<ProductModal item={modalItem} activeAllergens={allergens} onConfirm={(item,mods,cfg,opts)=>{addToOrder(item,mods,cfg,opts);setModalItem(null);showToast(`${opts.displayName||item.name} added`,'success');}} onCancel={()=>setModalItem(null)}/>}
      {showCheckout&&<CheckoutModal items={items} subtotal={subtotal} service={service} total={total} orderType={orderType} covers={covers} tableId={tableId} seatList={seatList} customer={customer} onClose={()=>setShowCheckout(false)} onComplete={()=>{setShowCheckout(false);clearOrder();showToast('Payment complete','success');}}/>}

      {showCustomerModal&&<CustomerModal orderType={pendingOrderType||orderType} onConfirm={handleCustomerConfirm} onCancel={()=>{setShowCustomerModal(false);if(!customer)setOrderType('dine-in');}}/>}
      {showQueue&&<CollectionQueue onClose={()=>setShowQueue(false)}/>}

      {showCustom&&(
        <div className="modal-back">
          <div className="modal-box" style={{ maxWidth:360 }}>
            <div style={{ fontSize:16,fontWeight:600,marginBottom:16,color:'var(--t1)' }}>Custom item</div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11,color:'var(--t2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6 }}>Item name</div>
              <input className="input" placeholder="e.g. Today's special, Staff meal..." value={customName} onChange={e=>setCustomName(e.target.value)} autoFocus/>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11,color:'var(--t2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6 }}>Price (£)</div>
              <input className="input" type="number" placeholder="0.00" value={customPrice} onChange={e=>setCustomPrice(e.target.value)}/>
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11,color:'var(--t2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6 }}>Kitchen note (optional)</div>
              <input className="input" placeholder="Allergy note, special request..." value={customNote} onChange={e=>setCustomNote(e.target.value)}/>
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>{setShowCustom(false);setCustomName('');setCustomPrice('');setCustomNote('');}}>Cancel</button>
              <button className="btn btn-acc" style={{ flex:1 }} disabled={!customName.trim()||!customPrice} onClick={()=>{addCustomItem(customName.trim(),customPrice,customNote);showToast(`${customName} added`,'success');setShowCustom(false);setCustomName('');setCustomPrice('');setCustomNote('');}}>Add to order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderItem({ item, covers, orderType, onQty, onRemove, onSeat, onCourse, seatList }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div style={{ background:'var(--bg2)',border:'1px solid var(--bdr)',borderRadius:10,padding:'9px 10px',marginBottom:6 }}>
      <div style={{ display:'flex',justifyContent:'space-between',gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13,fontWeight:600,lineHeight:1.3,color:'var(--t1)' }}>{item.name}</div>
          {item.mods?.map((m,i)=><div key={i} style={{ fontSize:11,color:'var(--t3)',display:'flex',justifyContent:'space-between',marginTop:1 }}><span>{m.groupLabel?`${m.groupLabel}: ${m.label}`:m.label}</span>{m.price>0&&<span style={{ color:'var(--acc)',fontFamily:'DM Mono,monospace' }}>+£{m.price.toFixed(2)}</span>}</div>)}
          {item.notes&&<div style={{ fontSize:11,color:'#f97316',marginTop:2,fontStyle:'italic' }}>📝 {item.notes}</div>}
          {item.allergens?.length>0&&<div style={{ fontSize:10,color:'var(--red)',marginTop:2 }}>⚠ {item.allergens.map(a=>ALLERGENS.find(x=>x.id===a)?.label).filter(Boolean).join(' · ')}</div>}
          <div style={{ display:'flex',gap:4,marginTop:5,flexWrap:'wrap' }}>
            {orderType==='dine-in'&&covers>1&&<span onClick={()=>setShowMenu(s=>!s)} style={{ fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:4,background:'var(--acc-d)',border:'1px solid var(--acc-b)',color:'var(--acc)',cursor:'pointer' }}>{item.seat==='shared'?'Shared':`Seat ${item.seat}`}</span>}
            {item.course>0&&<span onClick={()=>setShowMenu(s=>!s)} style={{ fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:4,background:COURSE_COLORS[item.course]?.bg||'var(--bg3)',border:`1px solid ${(COURSE_COLORS[item.course]?.color||'var(--t3)')+'44'}`,color:COURSE_COLORS[item.course]?.color||'var(--t3)',cursor:'pointer' }}>{COURSE_COLORS[item.course]?.label}</span>}
            {item.status==='sent'&&<span style={{ fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:4,background:'var(--grn-d)',border:'1px solid var(--grn-b)',color:'var(--grn)' }}>Sent</span>}
          </div>
        </div>
        <div style={{ fontSize:14,fontWeight:800,color:'var(--acc)',whiteSpace:'nowrap',fontFamily:'DM Mono,monospace' }}>£{(item.price*item.qty).toFixed(2)}</div>
      </div>
      {showMenu&&(
        <div style={{ marginTop:8,padding:'8px 10px',background:'var(--bg3)',borderRadius:8,border:'1px solid var(--bdr2)' }}>
          {orderType==='dine-in'&&covers>1&&(
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5 }}>Move to seat</div>
              <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
                {seatList.map(s=><button key={s} onClick={()=>{onSeat(s);setShowMenu(false);}} style={{ padding:'3px 9px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:600,background:item.seat===s?'var(--acc-d)':'var(--bg4)',border:`1px solid ${item.seat===s?'var(--acc-b)':'var(--bdr)'}`,color:item.seat===s?'var(--acc)':'var(--t3)' }}>{s==='shared'?'Shared':`S${s}`}</button>)}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize:10,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5 }}>Move to course</div>
            <div style={{ display:'flex',gap:4,flexWrap:'wrap' }}>
              {Object.entries(COURSE_COLORS).map(([c,cc])=><button key={c} onClick={()=>{onCourse(parseInt(c));setShowMenu(false);}} style={{ padding:'3px 9px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:600,background:item.course===parseInt(c)?cc.bg:'var(--bg4)',border:`1px solid ${item.course===parseInt(c)?cc.color+'55':'var(--bdr)'}`,color:item.course===parseInt(c)?cc.color:'var(--t3)' }}>{cc.label}</button>)}
            </div>
          </div>
          <button onClick={()=>setShowMenu(false)} style={{ marginTop:7,fontSize:11,color:'var(--t3)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit' }}>Done</button>
        </div>
      )}
      <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:7 }}>
        <div style={{ display:'flex',alignItems:'center',gap:1,background:'var(--bg3)',border:'1px solid var(--bdr)',borderRadius:8,overflow:'hidden' }}>
          <button onClick={()=>onQty(-1)} style={{ width:26,height:24,background:'transparent',border:'none',color:'var(--t2)',fontSize:16,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
          <div style={{ width:26,height:24,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'var(--t1)' }}>{item.qty}</div>
          <button onClick={()=>onQty(1)} style={{ width:26,height:24,background:'transparent',border:'none',color:'var(--t2)',fontSize:16,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
        </div>
        {item.qty>1&&<span style={{ fontSize:11,color:'var(--t3)',fontFamily:'DM Mono,monospace' }}>£{item.price.toFixed(2)} ea</span>}
        <button onClick={onRemove} style={{ marginLeft:'auto',fontSize:11,color:'var(--red)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit',opacity:.7 }}>Remove</button>
      </div>
    </div>
  );
}
