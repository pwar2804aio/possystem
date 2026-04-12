import { useState, useMemo, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { CATEGORIES, MENU_ITEMS as SEED_MENU_ITEMS, ALLERGENS, QUICK_IDS, getDaypart, CAT_META } from '../data/seed';
import ProductModal, { AllergenModal } from '../components/ProductModal';
import InlineItemFlow from '../components/InlineItemFlow';
import CheckoutModal from './CheckoutModal';
import CustomerModal from '../components/CustomerModal';
import VoidModal from '../components/VoidModal';
import DiscountModal from '../components/DiscountModal';
import { ReceiptModal, ReprintModal } from '../components/ReceiptModal';
import CheckHistory from '../components/CheckHistory';
import ItemInfoModal from '../components/ItemInfoModal';
import OrderReviewModal from '../components/OrderReviewModal';
import OrderTypeModal from '../components/OrderTypeModal';
import AllergenCheckoutModal from '../components/AllergenCheckoutModal';
import TableActionsModal from '../components/TableActionsModal';

const COURSE_COLORS = {
  0:{label:'Immediate',color:'#22d3ee',bg:'rgba(34,211,238,.1)'},
  1:{label:'Course 1', color:'#22c55e',bg:'rgba(34,197,94,.1)'},
  2:{label:'Course 2', color:'#3b82f6',bg:'rgba(59,130,246,.1)'},
  3:{label:'Course 3', color:'#e8a020',bg:'rgba(232,160,32,.1)'},
};

export default function POSSurface() {
  const {
    staff, allergens, toggleAllergen, clearAllergens,
    addItem, addCustomItem, removeItem, updateItemQty, updateItemNote,
    updateItemSeat, updateItemCourse, setOrderNote,
    sendToKitchen, fireCourse,
    getPOSItems, getPOSTotals, getPOSOrderNote,
    activeTableId, tables, clearTable, clearWalkIn, setActiveTableId, recordWalkInClosed,
    orderType, setOrderType, customer, setCustomer, clearCustomer,
    orderQueue, updateQueueStatus, removeFromQueue, showToast,
    pendingItem, setPendingItem, clearPendingItem,
    eightySixIds, toggle86,
    dailyCounts, setDailyCount, clearDailyCount,
    setSurface,
    seatTableWithItems, mergeItemsToTable, splitTableCheck,
    voidItem, voidCheck,
    addCheckDiscount, removeCheckDiscount, addWalkInDiscount, removeWalkInDiscount,
    addItemDiscount, removeItemDiscount,
    deviceConfig,
    menuItems: storeMenuItems,
    menuCategories,
    quickScreenIds,
    modifierGroupDefs,
  } = useStore();

  // Use store's editable menu — prefer menuName for display, fall back to name
  // IMPORTANT: useMemo keeps object references stable so modalItem doesn't change
  // identity on re-renders (which would remount ProductModal and reset selections state)
  const rawItems = storeMenuItems || SEED_MENU_ITEMS;
  const { getItemPrice } = useStore.getState();
  // SoldAlone modifier options as virtual POS menu items
  const soldAloneItems = useMemo(() => {
    const items = [];
    (modifierGroupDefs||[]).forEach(group => {
      (group.options||[]).forEach(opt => {
        if (opt.soldAlone && opt.soldAloneCat) {
          items.push({
            id: `solo-${opt.id}`,
            name: opt.name,
            menuName: opt.name,
            receiptName: opt.name,
            kitchenName: opt.name,
            type: 'simple',
            cat: opt.soldAloneCat,
            cats: [],
            price: opt.price||0,
            pricing: { base: opt.price||0 },
            allergens: [],
            assignedModifierGroups: [],
            assignedInstructionGroups: [],
            sortOrder: 999,
            _soldAlone: true,
            _fromGroup: group.name,
          });
        }
      });
    });
    return items;
  }, [modifierGroupDefs]);

  const MENU_ITEMS = useMemo(() => [...rawItems, ...soldAloneItems].map(i => ({
    ...i,
    name: i.menuName || i.name,
    price: getItemPrice ? getItemPrice(i, orderType) : (i.pricing?.base ?? i.price ?? 0),
  })), [rawItems, soldAloneItems, orderType]);

  // Order types this terminal is allowed to show (from device profile)
  const allowedOrderTypes = deviceConfig?.enabledOrderTypes || ['dine-in', 'takeaway', 'collection'];
  const ALL_ORDER_TYPES = [['dine-in','🍽','Dine in'],['takeaway','🥡','Takeaway'],['collection','📦','Collect']];
  const visibleOrderTypes = ALL_ORDER_TYPES.filter(([t]) => allowedOrderTypes.includes(t));

  const [cat, setCat]             = useState('quick');
  const [subCat, setSubCat]       = useState(null);
  const [modalItem, setModalItem] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [search, setSearch]       = useState('');
  const [showAllergens, setShowAllergens] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [pendingOrderType, setPendingOrderType] = useState(null);
  const [rightTab, setRightTab] = useState('menu');  // 'menu' | 'orders'
  const [voidTarget, setVoidTarget]   = useState(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showReceipt, setShowReceipt]   = useState(false);
  const [showReprint, setShowReprint]   = useState(false);
  const [infoItem, setInfoItem]         = useState(null);  // long-press item info
  const [showReview, setShowReview]     = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showAllergenGate, setShowAllergenGate] = useState(false);
  const [showTableActions, setShowTableActions] = useState(false);
  const [lastAddedUid, setLastAddedUid] = useState(null);
  const longPressTimer = useRef(null);

  const activeTable = activeTableId ? tables.find(t=>t.id===activeTableId) : null;
  const session = activeTable?.session;
  const items = getPOSItems();
  const { subtotal, service, total, itemCount, checkDiscount, discountedSub } = getPOSTotals();
  const orderNote = getPOSOrderNote();
  const firedCourses = session?.firedCourses || [];
  const covers = session?.covers || 2;
  const hasSent = !!session?.sentAt;
  const daypart = getDaypart();
  const catMeta = CAT_META[cat] || CAT_META.quick;
  const activeQueueCount = orderQueue.filter(o=>o.status!=='collected').length;

  // Smart quick screen: filter to assigned section, exclude 86'd, show available items
  // For bar terminal (assignedSection='bar'), show bar/drinks items first
  const assignedSection = deviceConfig?.assignedSection;
  const quickItems = useMemo(() => {
    const ids = quickScreenIds && quickScreenIds.length ? quickScreenIds : QUICK_IDS;
    const available = MENU_ITEMS.filter(i => !i.archived && i.type !== 'subitem' && !i.parentId);
    const fromIds = ids.map(id => MENU_ITEMS.find(i => i.id === id)).filter(i => i && !eightySixIds.includes(i.id) && !i.archived);
    if (fromIds.length >= 12) return fromIds.slice(0, 16);
    const pad = available.filter(i => !ids.includes(i.id) && !eightySixIds.includes(i.id)).slice(0, 16 - fromIds.length);
    return [...fromIds, ...pad];
  }, [quickScreenIds, MENU_ITEMS, eightySixIds]);

  // When the main category changes, reset the subcategory selection
  useEffect(() => { setSubCat(null); }, [cat]);

  // Find subcategories of the active category
  const subCategories = useMemo(() =>
    menuCategories.filter(c => c.parentId === cat).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0)),
  [cat, menuCategories]);

  const catItems = useMemo(() => {
    if (cat === 'quick') return quickItems;
    if (cat === 'extras') return soldAloneItems;
    const base = MENU_ITEMS.filter(i => !i.archived && i.type !== 'subitem' && !i.parentId)
      .slice().sort((a,b) => (a.sortOrder??999) - (b.sortOrder??999));
    const inCat = (i, id) => i.cat === id || (i.cats||[]).includes(id);
    if (subCat) return base.filter(i => inCat(i, subCat));
    if (subCategories.length > 0) {
      const subIds = subCategories.map(s => s.id);
      return base.filter(i => inCat(i, cat) || subIds.some(sid => inCat(i, sid)));
    }
    return base.filter(i => inCat(i, cat));
  }, [cat, subCat, subCategories, MENU_ITEMS, quickItems]);

  const displayItems = useMemo(() => {
    if (!search.trim()) return catItems;
    const q = search.toLowerCase();
    return MENU_ITEMS.filter(i =>
      !i.archived && i.type !== 'subitem' && !i.parentId &&
      ((i.menuName||i.name||'').toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
    );
  }, [cat, search, catItems, MENU_ITEMS]);

  const byCourse = useMemo(()=>{
    const g = {};
    items.forEach(item => { const c=item.course??1; if(!g[c])g[c]=[]; g[c].push(item); });
    return g;
  },[items]);
  const courseNums = Object.keys(byCourse).map(Number).sort();
  const nextToFire = courseNums.find(c=>c>1&&!firedCourses.includes(c)&&(firedCourses.includes(c-1)||firedCourses.includes(1)));

  const handleTypeChange = (t) => {
    if (t!=='dine-in') { setPendingOrderType(t); setShowCustomerModal(true); }
    else { setOrderType('dine-in'); clearCustomer(); }
  };

  const handleItemTap = (item) => {
    if (eightySixIds.includes(item.id)) { showToast(`${item.name} is 86'd`,'error'); return; }
    if (allergens.some(a=>(item.allergens||[]).includes(a))) { setPendingItem(item); return; }
    openFlow(item);
  };
  const openFlow = (item) => {
    if (item.type === 'subitem') return;

    // Variant parent: detected by type OR by having linked children
    const variantChildren = MENU_ITEMS
      .filter(i => i.parentId === item.id && !i.archived && !eightySixIds.includes(i.id))
      .sort((a,b) => (a.sortOrder??999) - (b.sortOrder??999));
    if (item.type === 'variants' || variantChildren.length > 0) {
      if (variantChildren.length > 0) {
        setModalItem({
          ...item,
          type: 'variants',
          variantLabel: item.variantLabel || 'Size',
          variants: variantChildren.map(c => ({
            id: c.id,
            label: c.menuName || c.name,
            price: c.pricing?.base ?? c.price ?? 0,
            _childItem: c,
          })),
        });
        return;
      }
    }

    const needsModal = item.assignedModifierGroups?.length > 0
      || item.assignedInstructionGroups?.length > 0
      || item.modifierGroups?.length > 0
      || ['modifiable','modifiers','pizza'].includes(item.type);

    if (!needsModal) {
      addItem(item, [], null, { displayName: item.menuName || item.name, qty: 1, linePrice: item.pricing?.base ?? item.price ?? 0 });
      showToast(`${item.menuName || item.name} added`, 'success');
      setLastAddedUid(item.id);
      setTimeout(() => setLastAddedUid(null), 300);
      return;
    }
    setModalItem(item);
  };

  const handleSend = () => {
    if (!items.length) { showToast('No items on order', 'error'); return; }

    if (activeTableId) {
      // Send to kitchen, then clear POS so it's ready for the next order
      const label = activeTable?.label || activeTableId;
      setShowCheckout(false);
      sendToKitchen();
      // Deselect the table — it stays occupied in the floor plan
      // POS resets to walk-in mode, ready for the next order
      setActiveTableId(null);
      showToast(`${label} — sent to kitchen`, 'success');
      return;
    }

    // No table → ask what type this order is
    setShowSendModal(true);
  };

  const handlePayComplete = (paymentInfo = {}) => {
    setShowCheckout(false);
    if (activeTableId) {
      clearTable(activeTableId, paymentInfo);
      showToast('Payment complete — table cleared','success');
      setSurface('tables');
    } else {
      recordWalkInClosed(useStore.getState().walkInOrder, orderType, customer, paymentInfo);
      clearWalkIn();
      showToast('Payment complete','success');
    }
  };

  const seatList = useMemo(()=>{ const a=['shared']; for(let i=1;i<=covers;i++)a.push(i); return a; },[covers]);

  return (
    <div style={{display:'flex',flex:1,overflow:'hidden',minWidth:0}}>

      {/* ══ ORDER PANEL ════════════════════════════════════════ */}
      <div style={{width:'var(--ord)',flexShrink:0,display:'flex',flexDirection:'column',background:'var(--bg1)',borderRight:'1px solid var(--bdr)',overflow:'hidden'}}>

        {/* Context header */}
        <div style={{padding:'10px 12px 8px',borderBottom:'1px solid var(--bdr)',flexShrink:0}}>
          {activeTable ? (
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div onClick={()=>setShowTableActions(true)} style={{width:40,height:40,borderRadius:activeTable.shape==='rd'?'50%':10,background:'var(--acc-d)',border:'1.5px solid var(--acc-b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:activeTable.parentId?9:11,fontWeight:800,color:'var(--acc)',flexShrink:0,letterSpacing:'-.01em',textAlign:'center',lineHeight:1.1,cursor:'pointer'}}>
                {activeTable.label}
              </div>
              <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setShowTableActions(true)}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--t1)',letterSpacing:'-.01em',display:'flex',alignItems:'center',gap:6}}>
                  {activeTable.label}
                  {activeTable.parentId && (
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20,background:'var(--acc)',color:'#0b0c10'}}>Check 2</span>
                  )}
                  <span style={{fontSize:10,color:'var(--t4)'}}>✎</span>
                </div>
                <div style={{fontSize:11,color:'var(--t3)',marginTop:1}}>
                  {session?.covers} covers · {session?.server}
                  {session?.seatedAt?<span style={{color:'var(--t4)'}}> · {Math.floor((Date.now()-session.seatedAt)/60000)}m</span>:''}
                </div>
              </div>
              <button onClick={()=>setSurface('tables')} style={{fontSize:12,fontWeight:700,color:'var(--t4)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:'4px 0',flexShrink:0}}>← Floor</button>
            </div>
          ) : (
            <>
              <div style={{display:'flex',gap:4,marginBottom:orderType==='dine-in'?0:8}}>
                {visibleOrderTypes.map(([t,ic,l])=>(
                  <button key={t} onClick={()=>handleTypeChange(t)} style={{flex:1,padding:'7px 3px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',border:`1.5px solid ${orderType===t?'var(--acc-b)':'var(--bdr)'}`,background:orderType===t?'var(--acc-d)':'transparent',color:orderType===t?'var(--acc)':'var(--t3)',fontSize:10,fontWeight:800,display:'flex',flexDirection:'column',alignItems:'center',gap:1,letterSpacing:.01,transition:'all .14s'}}>
                    <span style={{fontSize:16}}>{ic}</span><span>{l}</span>
                  </button>
                ))}
              </div>
              {/* Named order: show customer name even on dine-in type */}
              {customer&&(
                <div style={{background:'var(--bg3)',borderRadius:10,padding:'8px 12px',marginTop:8,display:'flex',alignItems:'center',gap:10,border:'1px solid var(--bdr)'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'var(--acc-d)',border:'1.5px solid var(--acc-b)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'var(--acc)',flexShrink:0}}>{customer.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{customer.name}</div>
                    <div style={{fontSize:11,color:'var(--t3)'}}>{customer.phone}{orderType==='collection'?` · ${customer.isASAP?'⚡ ASAP':`🕐 ${customer.collectionTime}`}`:orderType==='dine-in'?' · Named order':''}</div>
                  </div>
                  <button onClick={()=>{setShowCustomerModal(true);setPendingOrderType(orderType);}} style={{fontSize:11,fontWeight:700,color:'var(--acc)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0,flexShrink:0}}>Edit</button>
                </div>
              )}
              {orderType!=='dine-in'&&!customer&&(
                <button onClick={()=>{setShowCustomerModal(true);setPendingOrderType(orderType);}} style={{width:'100%',padding:'9px 12px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',background:'var(--bg3)',border:'1.5px dashed var(--bdr2)',color:'var(--t3)',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:8,justifyContent:'center',marginTop:8,transition:'all .14s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--acc-b)';e.currentTarget.style.color='var(--acc)';}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr2)';e.currentTarget.style.color='var(--t3)';}}>
                  <span>👤</span> Add customer details
                </button>
              )}
            </>
          )}
        </div>

        {/* Order label row */}
        <div style={{padding:'6px 12px 3px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:10,fontWeight:800,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.08em'}}>
            {activeTable?`${activeTable.label}`:orderType} · {staff?.name}
          </span>
          {items.length>0&&(
            <button onClick={()=>activeTableId?clearTable(activeTableId):clearWalkIn()} style={{fontSize:11,fontWeight:700,color:'var(--t4)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit',padding:0,transition:'color .12s'}}
              onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
              onMouseLeave={e=>e.currentTarget.style.color='var(--t4)'}>Clear</button>
          )}
        </div>

        {/* Items by course */}
        <div style={{flex:1,overflowY:'auto',padding:'4px 10px'}}>

          {/* Empty state */}
          {items.length===0&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'52px 20px',textAlign:'center'}}>
              <div style={{width:56,height:56,borderRadius:16,background:'var(--bg3)',border:'1px solid var(--bdr)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,marginBottom:14,opacity:.6}}>🧾</div>
              <div style={{fontSize:14,fontWeight:700,color:'var(--t3)',marginBottom:4}}>Order is empty</div>
              <div style={{fontSize:12,color:'var(--t4)'}}>Tap items from the menu →</div>
            </div>
          )}

          {courseNums.map(courseNum=>{
            const cc=COURSE_COLORS[courseNum]||COURSE_COLORS[1];
            const isFired=firedCourses.includes(courseNum)||courseNum===0;
            const canFire=hasSent&&!isFired&&courseNum>1&&(firedCourses.includes(courseNum-1)||firedCourses.includes(1));
            return(
              <div key={courseNum} style={{marginBottom:8}}>
                {courseNums.length>1&&(
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5,marginTop:3}}>
                    <div style={{height:1,flex:1,background:'var(--bdr)'}}/>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:20,background:isFired?'var(--grn-d)':cc.bg,border:`1px solid ${isFired?'var(--grn-b)':cc.color+'44'}`,color:isFired?'var(--grn)':cc.color,letterSpacing:.03}}>{isFired?'✓ ':''}{cc.label}</span>
                      {canFire&&<button onClick={()=>fireCourse(courseNum)} style={{fontSize:10,fontWeight:800,padding:'2px 10px',borderRadius:20,background:'var(--acc)',color:'#0b0c10',border:'none',cursor:'pointer',fontFamily:'inherit'}}>🔥 Fire</button>}
                    </div>
                    <div style={{height:1,flex:1,background:'var(--bdr)'}}/>
                  </div>
                )}
                {byCourse[courseNum].map(item=>(
                  <OrderItem key={item.uid} item={item} covers={covers} orderType={orderType} seatList={seatList}
                    onQty={d=>updateItemQty(item.uid,d)}
                    onRemove={()=>removeItem(item.uid)}
                    onNote={n=>updateItemNote(item.uid,n)}
                    onSeat={s=>updateItemSeat(item.uid,s)}
                    onCourse={c=>updateItemCourse(item.uid,c)}
                    onVoid={()=>setVoidTarget({type:'item',item})}
                    onDiscount={()=>setDiscountTarget({scope:'item',item})}
                    onRemoveDiscount={()=>removeItemDiscount(activeTableId,item.uid)}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Order note */}
        {items.length>0&&(
          <div style={{padding:'5px 10px 0',flexShrink:0}}>
            <textarea value={orderNote} onChange={e=>setOrderNote(e.target.value)} placeholder="Order note for kitchen…" rows={orderNote?2:1}
              style={{width:'100%',background:'var(--bg3)',border:'1.5px solid var(--bdr)',borderRadius:10,padding:'7px 11px',color:'var(--t1)',fontSize:12,fontFamily:'inherit',resize:'none',outline:'none',lineHeight:1.5,display:'block',transition:'border-color .15s'}}
              onFocus={e=>e.target.style.borderColor='var(--acc-b)'}
              onBlur={e=>e.target.style.borderColor='var(--bdr)'}/>
          </div>
        )}

        {/* Footer — totals + actions */}
        <div style={{flexShrink:0,borderTop:'1px solid var(--bdr)',background:'var(--bg2)'}}>
          {items.length>0&&(
            <>
              {/* Totals */}
              <div style={{padding:'10px 12px 6px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--t3)',marginBottom:3}}>
                  <span>{itemCount} item{itemCount!==1?'s':''}</span>
                  <span style={{fontFamily:'var(--font-mono)'}}>£{subtotal.toFixed(2)}</span>
                </div>
                {checkDiscount>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--grn)',marginBottom:3}}>
                  <span>Discount</span><span style={{fontFamily:'var(--font-mono)'}}>−£{checkDiscount.toFixed(2)}</span>
                </div>}
                {service>0
                  ? <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--t3)',marginBottom:3}}>
                      <span>Service ({useStore.getState().locations?.find(l=>l.id===useStore.getState().currentLocationId)?.serviceCharge??12.5}%)</span><span style={{fontFamily:'var(--font-mono)'}}>£{service.toFixed(2)}</span>
                    </div>
                  : <div style={{fontSize:11,color:'var(--grn)',marginBottom:3,fontWeight:600}}>No service charge</div>
                }
                <div style={{display:'flex',justifyContent:'space-between',fontSize:22,fontWeight:800,marginTop:8,paddingTop:8,borderTop:'1px solid var(--bdr)'}}>
                  <span>Total</span>
                  <span style={{color:'var(--acc)',fontFamily:'var(--font-mono)',letterSpacing:'-.01em'}}>£{total.toFixed(2)}</span>
                </div>
              </div>

              {/* Check discounts */}
              {(()=>{
                const checkDiscounts=activeTableId?(tables.find(t=>t.id===activeTableId)?.session?.discounts||[]):(useStore.getState().walkInOrder?.discounts||[]);
                return checkDiscounts.length>0?(
                  <div style={{padding:'0 12px 4px'}}>
                    {checkDiscounts.map(d=>(
                      <div key={d.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,color:'var(--grn)',marginBottom:2}}>
                        <span>🏷 {d.label}</span>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontFamily:'var(--font-mono)'}}>−£{d.amount.toFixed(2)}</span>
                          <button onClick={()=>activeTableId?removeCheckDiscount(activeTableId,d.id):removeWalkInDiscount(d.id)} style={{fontSize:11,color:'var(--t4)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ):null;
              })()}

              {/* Fire course banner */}
              {hasSent&&nextToFire&&(
                <div style={{margin:'4px 10px 0',padding:'8px 12px',background:'rgba(232,160,32,.1)',border:'1px solid rgba(232,160,32,.25)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:12,color:'var(--acc)',fontWeight:700}}>{COURSE_COLORS[nextToFire]?.label} ready to fire</span>
                  <button onClick={()=>fireCourse(nextToFire)} style={{fontSize:12,fontWeight:800,padding:'4px 12px',borderRadius:8,background:'var(--acc)',color:'#0b0c10',border:'none',cursor:'pointer',fontFamily:'inherit'}}>🔥 Fire</button>
                </div>
              )}

              {/* Action row */}
              <div style={{padding:'6px 10px 4px',display:'flex',gap:4,flexWrap:'wrap'}}>
                <button onClick={()=>setShowReview(true)} style={{flex:1,height:32,borderRadius:9,cursor:'pointer',fontFamily:'inherit',background:'var(--bg3)',border:'1px solid var(--bdr)',color:'var(--t3)',fontSize:11,fontWeight:700,minWidth:60}}>📋 Review</button>
                <button onClick={()=>setShowDiscount(true)} style={{flex:1,height:32,borderRadius:9,cursor:'pointer',fontFamily:'inherit',background:'var(--bg3)',border:'1px solid var(--bdr)',color:'var(--t3)',fontSize:11,fontWeight:700,minWidth:60}}>🏷 Discount</button>
                <button onClick={()=>setShowReceipt(true)} style={{flex:1,height:32,borderRadius:9,cursor:'pointer',fontFamily:'inherit',background:'var(--bg3)',border:'1px solid var(--bdr)',color:'var(--t3)',fontSize:11,fontWeight:700,minWidth:60}}>🖨 Print</button>
                {hasSent&&<button onClick={()=>setShowReprint(true)} style={{flex:1,height:32,borderRadius:9,cursor:'pointer',fontFamily:'inherit',background:'var(--bg3)',border:'1px solid var(--bdr)',color:'var(--t3)',fontSize:11,fontWeight:700,minWidth:60}}>↻ Reprint</button>}
                {activeTableId&&hasSent&&<button onClick={()=>setVoidTarget({type:'check',items:items.filter(i=>!i.voided)})} style={{flex:1,height:32,borderRadius:9,cursor:'pointer',fontFamily:'inherit',background:'var(--red-d)',border:'1px solid var(--red-b)',color:'var(--red)',fontSize:11,fontWeight:700,minWidth:60}}>⊘ Void</button>}
              </div>
            </>
          )}

          {/* Send / Pay */}
          <div style={{padding:'6px 10px 12px',display:'flex',gap:6}}>
            <button onClick={()=>setShowCustom(true)} title="Custom item" style={{width:40,height:40,borderRadius:11,border:'1px solid var(--bdr2)',background:'var(--bg3)',color:'var(--t3)',cursor:'pointer',fontFamily:'inherit',fontSize:20,flexShrink:0,transition:'all .14s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--bdr3)';e.currentTarget.style.color='var(--t2)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr2)';e.currentTarget.style.color='var(--t3)';}}>+</button>
            <button className="btn btn-ghost" style={{flex:1,height:40,opacity:items.length===0?.3:1,fontSize:13,fontWeight:700,letterSpacing:.01}} onClick={handleSend}>Send →</button>
            <button className="btn btn-acc" style={{flex:1.4,height:40,opacity:items.length===0?.3:1,fontSize:14,fontWeight:800,letterSpacing:.01}} onClick={()=>{
              if (!items.length) return;
              const hasAllergens = items.some(i=>!i.voided&&i.allergens?.length);
              if (hasAllergens) setShowAllergenGate(true);
              else setShowCheckout(true);
            }}>
              {items.length>0?`Pay £${total.toFixed(2)}`:'Pay'}
            </button>
          </div>
        </div>
      </div>

      {/* ══ CATEGORY NAV ══════════════════════════════════════════ */}
      <div style={{width:'var(--cat)',flexShrink:0,background:'var(--bg1)',borderRight:'1px solid var(--bdr)',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'12px 10px 8px',borderBottom:'1px solid var(--bdr)',flexShrink:0}}>
          <div style={{fontSize:9,fontWeight:800,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.12em',paddingLeft:2}}>Menu</div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'6px 7px'}}>
          {/* Quick screen always first */}
          {[{ id:'quick', label:'Quick', icon:'⚡', color:'var(--acc)' }, ...(soldAloneItems.length>0?[{ id:'extras', label:'Extras', icon:'⊕', color:'#8b5cf6' }]:[])].concat(
            menuCategories.filter(c => !c.parentId && !c.isSpecial).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0))
          ).map(c => {
            const isActive = cat === c.id && !search;
            const color = c.color || 'var(--acc)';
            const subIds = menuCategories.filter(s => s.parentId === c.id).map(s => s.id);
            const count = c.id === 'quick'
              ? quickItems.length
              : c.id === 'extras'
              ? soldAloneItems.length
              : MENU_ITEMS.filter(i => !i.archived && i.type !== 'subitem' && !i.parentId && (i.cat === c.id || subIds.includes(i.cat))).length;
            const hasSubcats = subIds.length > 0;
            return (
              <button key={c.id} onClick={() => { setCat(c.id); setSearch(''); }} className="cat-btn" style={{
                marginBottom:3,
                background:isActive?`${color}15`:'transparent',
                borderColor:isActive?`${color}40`:'transparent',
              }}>
                <div style={{width:3,height:32,borderRadius:2,background:isActive?color:'var(--bg5)',flexShrink:0,transition:'all .14s'}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:1}}>
                    <span style={{fontSize:20,lineHeight:1,flexShrink:0}}>{c.icon||'•'}</span>
                    <span style={{fontSize:12,fontWeight:700,color:isActive?color:'var(--t2)',letterSpacing:.01,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.label}</span>
                    {hasSubcats && <span style={{fontSize:8,color:'var(--t4)',flexShrink:0}}>▾</span>}
                  </div>
                  <div style={{fontSize:9,color:'var(--t4)',paddingLeft:26}}>{count} items</div>
                </div>
                {isActive && <div style={{width:5,height:5,borderRadius:'50%',background:color,flexShrink:0,boxShadow:`0 0 6px ${color}`}}/>}
              </button>
            );
          })}
        </div>
        <div style={{padding:'8px 7px 10px',borderTop:'1px solid var(--bdr)'}}>
          <button onClick={()=>setShowAllergens(s=>!s)} style={{
            width:'100%',padding:'9px 10px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
            display:'flex',alignItems:'center',gap:7,
            background:allergens.length>0?'var(--red-d)':'var(--bg3)',
            border:`1.5px solid ${allergens.length>0?'var(--red-b)':'var(--bdr)'}`,
            color:allergens.length>0?'var(--red)':'var(--t3)',fontSize:11,fontWeight:700,
            transition:'all .14s',
          }}>
            <span style={{fontSize:14}}>⚠</span>
            <span style={{flex:1,textAlign:'left'}}>
              {allergens.length>0?`${allergens.length} filter${allergens.length>1?'s':''} active`:'Allergen filter'}
            </span>
            {allergens.length>0&&<div style={{width:7,height:7,borderRadius:'50%',background:'var(--red)',animation:'pulse 1.5s ease-in-out infinite'}}/>}
          </button>
        </div>
      </div>

      {/* ══ PRODUCT GRID / ORDERS HUB ═════════════════════════════ */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>

        {/* Tab bar */}
        <div style={{padding:'0 14px',borderBottom:'1px solid var(--bdr)',background:'var(--bg1)',flexShrink:0,display:'flex',alignItems:'center',gap:0}}>
          {[['menu','Menu'],['history','History']].map(([t,l])=>{
            const isActive = rightTab===t;
            const badge = t==='orders' ? orderQueue.filter(o=>o.status!=='collected').length : 0;
            return (
              <button key={t} onClick={()=>setRightTab(t)} style={{
                padding:'11px 16px',cursor:'pointer',fontFamily:'inherit',border:'none',
                borderBottom:`2px solid ${isActive?'var(--acc)':'transparent'}`,
                background:'transparent',
                color:isActive?'var(--acc)':'var(--t3)',
                fontSize:13,fontWeight:isActive?700:500,
                display:'flex',alignItems:'center',gap:6,
                transition:'all .12s',
              }}>
                {l}
                {badge>0&&<span style={{background:'var(--acc)',color:'#0e0f14',borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:800}}>{badge}</span>}
              </button>
            );
          })}
          {/* Send / Pay always in tab bar */}
          <div style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center',padding:'6px 0'}}>
            {rightTab==='menu'&&(
              <div style={{position:'relative',maxWidth:200}}>
                <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--t3)',fontSize:13}}>🔍</span>
                <input className="input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:32,height:32,fontSize:12,width:180}}/>
                {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:9,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:15,lineHeight:1}}>×</button>}
              </div>
            )}
          </div>
        </div>

        {/* ── Menu tab ── */}
        {/* InlineItemFlow: variants/modifiers shown inline. Pizza uses modal overlay instead. */}
        {modalItem && modalItem.type !== 'pizza' && rightTab==='menu' && (
          <div style={{flex:1, overflow:'hidden'}}>
            <InlineItemFlow
              key={modalItem.id}
              item={modalItem}
              menuItems={MENU_ITEMS}
              activeAllergens={allergens}
              onConfirm={(item,mods,cfg,opts)=>{ addItem(item,mods,cfg,opts); setModalItem(null); showToast(`${opts.displayName||item.name} added`,'success'); }}
              onCancel={()=>setModalItem(null)}
            />
          </div>
        )}
        {(!modalItem || modalItem.type === 'pizza') && rightTab==='menu'&&(
          <>
            {showAllergens&&(
              <div style={{padding:'8px 14px',borderBottom:'1px solid var(--bdr)',background:'var(--bg1)',flexShrink:0}}>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {allergens.length>0&&<button onClick={clearAllergens} style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:600,background:'var(--bg3)',border:'1px solid var(--bdr2)',color:'var(--t2)',cursor:'pointer',fontFamily:'inherit'}}>Clear all</button>}
                  {ALLERGENS.map(a=>{const on=allergens.includes(a.id);return(<button key={a.id} onClick={()=>toggleAllergen(a.id)} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${on?'var(--red-b)':'var(--bdr)'}`,background:on?'var(--red-d)':'transparent',color:on?'var(--red)':'var(--t3)'}}><span style={{width:13,height:13,borderRadius:3,background:on?'var(--red)':'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:on?'#fff':'var(--t3)',flexShrink:0}}>{a.icon}</span>{a.label}</button>);})}
                </div>
              </div>
            )}
            <div style={{flex:1,overflowY:'auto',padding:'10px 12px'}}>
              {!search&&cat==='quick'&&(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:10,borderBottom:'1px solid var(--bdr)'}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--t1)'}}>Quick picks</div>
                    <div style={{fontSize:11,color:'var(--t3)',marginTop:1}}>AI-curated · {daypart}</div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'var(--acc-d)',border:'1px solid var(--acc-b)',color:'var(--acc)'}}>✦ Live</span>
                </div>
              )}
              {search&&displayItems.length>0&&(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,paddingBottom:8,borderBottom:'1px solid var(--bdr)'}}>
                  <div style={{fontSize:12,color:'var(--t3)'}}>
                    <span style={{fontWeight:700,color:'var(--t1)'}}>{displayItems.length}</span> result{displayItems.length!==1?'s':''} for <span style={{color:'var(--acc)',fontWeight:600}}>"{search}"</span>
                  </div>
                  <button onClick={()=>setSearch('')} style={{fontSize:11,color:'var(--t4)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:600,padding:0}}>✕ Clear</button>
                </div>
              )}
            {/* Subcategory pills */}
            {!search && cat !== 'quick' && subCategories.length > 0 && (
              <div style={{ display:'flex', gap:4, padding:'6px 0 10px', flexWrap:'wrap' }}>
                <button onClick={() => setSubCat(null)} style={{ padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:!subCat?800:500, border:'none', background:!subCat?'var(--acc)':'var(--bg3)', color:!subCat?'#0b0c10':'var(--t3)' }}>All</button>
                {subCategories.map(sc => {
                  const a = subCat === sc.id, cl = sc.color||'var(--acc)';
                  return (<button key={sc.id} onClick={() => setSubCat(sc.id)} style={{ padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:a?800:500, border:`1.5px solid ${a?cl:'var(--bdr)'}`, background:a?`${cl}20`:'var(--bg3)', color:a?cl:'var(--t3)' }}>{sc.icon&&<span style={{marginRight:4}}>{sc.icon}</span>}{sc.label}</button>);
                })}
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
                {displayItems.map(item=>{
                  // Resolve category colour/icon from store (Menu Manager categories)
                  const storeCat = menuCategories.find(c => c.id === item.cat);
                  const legacyMeta = CAT_META[item.cat] || CAT_META.quick;
                  const catColor = storeCat?.color || legacyMeta.color || 'var(--acc)';
                  const catIcon  = storeCat?.icon  || legacyMeta.icon  || '🍽';
                  const flagged=allergens.some(a=>item.allergens?.includes(a));
                  const is86=eightySixIds.includes(item.id);
                  const rank=cat==='quick'?QUICK_IDS.indexOf(item.id):-1;
                  const isHot=rank>=0&&rank<3;
                  const variantKids=MENU_ITEMS.filter(c=>c.parentId===item.id&&!c.archived);
                  const isVariantParent=variantKids.length>0||item.type==='variants';
                  const fromPrice=isVariantParent&&variantKids.length>0
                    ? Math.min(...variantKids.map(c=>c.pricing?.base??c.price??0))
                    : (item.pricing?.base??item.price??0);
                  const hasOptions=(item.assignedModifierGroups?.length>0)||(item.assignedInstructionGroups?.length>0)||(item.modifierGroups?.length>0);
                  const accentColor = is86?'var(--t4)':flagged?'var(--red)':catColor;
                  const count = dailyCounts[item.id];
                  const isLow = count && count.remaining <= 3 && count.remaining > 0;
                  const displayName = item.menuName || item.name || 'Item';

                  // Long-press handlers — 600ms hold opens item info sheet
                  const handlePressStart = (e) => {
                    e.preventDefault();
                    longPressTimer.current = setTimeout(() => {
                      setInfoItem(item);
                    }, 600);
                  };
                  const handlePressEnd = () => {
                    clearTimeout(longPressTimer.current);
                  };

                  return(
                    <button key={item.id}
                      onClick={()=>handleItemTap(item)}
                      onMouseDown={handlePressStart}
                      onMouseUp={handlePressEnd}
                      onMouseLeave={handlePressEnd}
                      onTouchStart={handlePressStart}
                      onTouchEnd={handlePressEnd}
                      className={`prod-card${is86?' prod-card--disabled':''}${lastAddedUid===item.id?' add-pulse':''}`}
                      style={{minHeight:108}}>
                      {/* Left colour bar */}
                      <div style={{
                        position:'absolute',left:0,top:0,bottom:0,width:4,
                        background:is86?'var(--bg5)':flagged?'var(--red)':isHot?catColor:`${catColor}60`,
                        borderRadius:'14px 0 0 14px',
                      }}/>
                      <div style={{padding:'12px 12px 11px 16px',flex:1,display:'flex',flexDirection:'column'}}>
                        {/* Top row: emoji + badges */}
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{fontSize:24,lineHeight:1}}>{is86?'🚫':flagged?'⚠️':catIcon}</span>
                          <div style={{display:'flex',gap:3,flexDirection:'column',alignItems:'flex-end'}}>
                            {/* Daily count badge */}
                            {count&&!is86&&(
                              <span style={{fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:4,
                                background:isLow?'rgba(232,160,32,.2)':'rgba(34,197,94,.15)',
                                color:isLow?'var(--acc)':'var(--grn)',
                                border:`1px solid ${isLow?'rgba(232,160,32,.4)':'rgba(34,197,94,.3)'}`,
                              }}>
                                {count.remaining} left
                              </span>
                            )}
                            {isHot&&!is86&&!flagged&&!count&&(
                              <span style={{fontSize:9,fontWeight:800,padding:'2px 5px',borderRadius:4,background:`${catColor}25`,color:catColor,letterSpacing:.02}}>#{rank+1}</span>
                            )}
                            {flagged&&<span style={{fontSize:9,fontWeight:800,padding:'2px 5px',borderRadius:4,background:'var(--red-d)',color:'var(--red)'}}>⚠ allergen</span>}
                            {is86&&<span style={{fontSize:9,fontWeight:800,padding:'2px 5px',borderRadius:4,background:'var(--red-d)',color:'var(--red)',border:'1px solid var(--red-b)'}}>86'd</span>}
                          </div>
                        </div>
                        {/* Name */}
                        <div style={{fontSize:13,fontWeight:700,color:is86?'var(--t4)':flagged?'var(--red)':'var(--t1)',lineHeight:1.3,flex:1,marginBottom:8}}>{item.name}</div>
                        {/* Bottom: price + type + 86 button */}
                        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:4}}>
                          <div style={{fontSize:18,fontWeight:800,color:accentColor,fontFamily:'var(--font-mono)',letterSpacing:'-.01em'}}>
                            {item.type==='variants'?`from £${fromPrice.toFixed(2)}`:`£${fromPrice.toFixed(2)}`}
                          </div>
                          <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
                            {item.type!=='simple'&&<span style={{fontSize:9,fontWeight:700,padding:'2px 5px',borderRadius:5,background:'var(--bg4)',color:'var(--t3)',letterSpacing:.02}}>
                              {item.type==='variants'?'▾ sizes':item.type==='modifiers'?'⊕ opts':'⊕ opts'}
                            </span>}
                            <button
                              onClick={e=>{e.stopPropagation();toggle86(item.id);showToast(is86?`${item.name} un-86'd`:`${item.name} 86'd`,'warning');}}
                              style={{width:22,height:22,borderRadius:5,border:`1px solid ${is86?'var(--red-b)':'var(--bdr)'}`,background:is86?'var(--red-d)':'var(--bg4)',color:is86?'var(--red)':'var(--t4)',cursor:'pointer',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',flexShrink:0}}
                            >{is86?'✕':'86'}</button>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {displayItems.length===0&&(
                <div style={{textAlign:'center',padding:'80px 0',color:'var(--t3)'}}>
                  <div style={{fontSize:40,marginBottom:12,opacity:.4}}>🔍</div>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--t2)',marginBottom:6}}>No items found</div>
                  <button onClick={()=>setSearch('')} style={{fontSize:13,color:'var(--acc)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Clear search →</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Orders hub tab ── */}

        {/* ── History tab ── */}
        {rightTab==='history'&&<CheckHistory/>}
      </div>

      {/* Modals */}
      {pendingItem&&<AllergenModal item={pendingItem} activeAllergens={allergens} onConfirm={()=>{const i=pendingItem;clearPendingItem();openFlow(i);}} onCancel={clearPendingItem}/>}
      {modalItem&&modalItem.type==='pizza'&&<ProductModal key={modalItem.id} item={modalItem} activeAllergens={allergens} onConfirm={(item,mods,cfg,opts)=>{addItem(item,mods,cfg,opts);setModalItem(null);showToast(`${opts.displayName||item.name} added`,'success');}} onCancel={()=>setModalItem(null)}/>}
      {showCheckout&&<CheckoutModal items={items} subtotal={subtotal} service={service} total={total} orderType={orderType} covers={covers} tableId={activeTableId} seatList={seatList} customer={customer} onClose={()=>setShowCheckout(false)} onComplete={handlePayComplete}/>}
      {showCustomerModal&&<CustomerModal orderType={pendingOrderType||orderType} onConfirm={c=>{setShowCustomerModal(false);setCustomer(c);setOrderType(pendingOrderType);setPendingOrderType(null);showToast(`${c.name} — ${pendingOrderType} order started`,'success');}} onCancel={()=>{setShowCustomerModal(false);if(!customer)setOrderType('dine-in');}}/>}

      {/* Void modal */}
      {voidTarget&&(
        <VoidModal
          type={voidTarget.type}
          items={voidTarget.type==='item'?[voidTarget.item]:items.filter(i=>!i.voided)}
          totalValue={voidTarget.type==='item'?voidTarget.item.price*voidTarget.item.qty:subtotal}
          onConfirm={(opts)=>{
            if (voidTarget.type==='item') voidItem(activeTableId, voidTarget.item.uid, opts);
            else voidCheck(activeTableId, opts);
            setVoidTarget(null);
          }}
          onCancel={()=>setVoidTarget(null)}
        />
      )}

      {/* Discount modal */}
      {showDiscount&&(
        <DiscountModal
          items={items}
          subtotal={subtotal}
          onConfirm={(disc)=>{
            if (disc.scope==='check') {
              if (activeTableId) addCheckDiscount(activeTableId, disc);
              else addWalkInDiscount(disc);
            } else {
              // Item-level: apply to each selected item
              disc.itemUids?.forEach(uid => {
                const item = items.find(i=>i.uid===uid);
                if (item) addItemDiscount(activeTableId, uid, { id:`disc-${uid}`, label:disc.label, type:disc.type, value:disc.value });
              });
            }
            showToast(`${disc.label} applied`, 'success');
            setShowDiscount(false);
          }}
          onCancel={()=>setShowDiscount(false)}
        />
      )}

      {/* Receipt modal */}
      {showReceipt&&(
        <ReceiptModal
          items={items} subtotal={subtotal} service={service} total={total}
          checkDiscount={checkDiscount}
          orderType={orderType}
          tableLabel={activeTable?.label}
          server={session?.server || staff?.name}
          covers={covers}
          customer={customer}
          onClose={()=>setShowReceipt(false)}
        />
      )}

      {/* Reprint modal */}
      {showReprint&&(
        <ReprintModal
          items={items.filter(i=>i.status==='sent')}
          tableLabel={activeTable?.label || orderType}
          onClose={()=>setShowReprint(false)}
          onReprint={(uids)=>showToast(`Reprinted ${uids.length} ticket${uids.length!==1?'s':''} to kitchen`, 'success')}
        />
      )}
      {showCustom&&(
        <div className="modal-back"><div className="modal-box" style={{maxWidth:360}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:16,color:'var(--t1)'}}>Custom item</div>
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,color:'var(--t2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Item name</label><input className="input" placeholder="Today's special, Staff meal…" value={customName} onChange={e=>setCustomName(e.target.value)} autoFocus/></div>
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,color:'var(--t2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Price (£)</label><input className="input" type="number" placeholder="0.00" value={customPrice} onChange={e=>setCustomPrice(e.target.value)}/></div>
          <div style={{marginBottom:20}}><label style={{display:'block',fontSize:11,color:'var(--t2)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Kitchen note</label><input className="input" placeholder="Allergy note, special request…" value={customNote} onChange={e=>setCustomNote(e.target.value)}/></div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{setShowCustom(false);setCustomName('');setCustomPrice('');setCustomNote('');}}>Cancel</button>
            <button className="btn btn-acc" style={{flex:1}} disabled={!customName.trim()||!customPrice} onClick={()=>{addCustomItem(customName.trim(),customPrice,customNote);showToast(`${customName} added`,'success');setShowCustom(false);setCustomName('');setCustomPrice('');setCustomNote('');}}>Add to order</button>
          </div>
        </div></div>
      )}

      {/* Allergen confirmation gate before checkout */}
      {showAllergenGate && (
        <AllergenCheckoutModal
          items={items}
          onConfirm={()=>{ setShowAllergenGate(false); setShowCheckout(true); }}
          onCancel={()=>setShowAllergenGate(false)}
        />
      )}

      {/* Table actions — covers edit + transfer */}
      {showTableActions && activeTable && (
        <TableActionsModal
          table={activeTable}
          onClose={()=>setShowTableActions(false)}
        />
      )}

      {/* Order type / send modal */}
      {showSendModal && (
        <OrderTypeModal
          items={items}
          onClose={() => setShowSendModal(false)}
          onComplete={(result) => {
            // Always close modals first
            setShowSendModal(false);
            setShowCheckout(false);

            // Use store directly for all actions to avoid async state timing issues
            const store = useStore.getState();

            if (result.type === 'counter') {
              store.setCustomer({ name: result.name, isASAP: true, isNamedDineIn: true, channel: 'counter' });
              store.setOrderType('dine-in');
              store.sendToKitchen();
              store.clearWalkIn();
              showToast(result.name ? `${result.name} — sent to kitchen` : 'Sent to kitchen', 'success');

            } else if (result.type === 'takeaway' || result.type === 'collection') {
              store.setCustomer({ name: result.name, phone: result.phone, collectionTime: result.time, isASAP: result.isASAP });
              store.setOrderType(result.type);
              store.sendToKitchen();
              store.clearWalkIn();
              showToast(`${result.name} — ${result.type} sent`, 'success');

            } else if (result.type === 'delivery') {
              store.setCustomer({ name: result.name, phone: result.phone, address: result.address, isASAP: false });
              store.setOrderType('delivery');
              store.sendToKitchen();
              store.clearWalkIn();
              showToast(`Delivery for ${result.name} sent`, 'success');

            } else if (result.type === 'dine-in' && result.action === 'new') {
              // Seat items at a free table, then immediately send to kitchen
              store.seatTableWithItems(result.tableId, items, { server: store.staff?.name, covers: 1 });
              // seatTableWithItems sets the active table — send to kitchen right away
              store.sendToKitchen();
              store.clearWalkIn();
              store.setActiveTableId(null);
              setSurface('tables');
              showToast(`${result.tableLabel} — seated & sent to kitchen`, 'success');

            } else if (result.type === 'dine-in' && result.action === 'merge') {
              // Add items to an occupied table's existing check, then send to kitchen
              store.mergeItemsToTable(result.tableId, items);
              // mergeItemsToTable sets activeTableId to the target table
              store.sendToKitchen();
              store.clearWalkIn();
              store.setActiveTableId(null);
              setSurface('tables');
              showToast(`Added to ${result.tableLabel} — sent to kitchen`, 'success');

            } else if (result.type === 'dine-in' && result.action === 'split') {
              // Create a new separate check on the same table (T1.2)
              store.splitTableCheck(result.tableId, items, store.staff?.name);
              // splitTableCheck sets activeTableId to the new child — send to kitchen now
              store.sendToKitchen();
              store.clearWalkIn();
              setActiveTableId(null);
              setSurface('tables');
              showToast(`New check at ${result.tableLabel} — sent to kitchen`, 'success');

            } else if (result.type === 'bar' && result.action === 'new') {
              const tab = store.openTab({ name: result.tabName });
              store.addRoundToTab(tab.id, items);
              store.setCustomer({ name: result.tabName });
              store.setOrderType('dine-in');
              store.sendToKitchen();
              store.clearWalkIn();
              setSurface('bar');
              showToast(`Bar tab "${result.tabName}" opened`, 'success');

            } else if (result.type === 'bar' && result.action === 'add') {
              store.addRoundToTab(result.tabId, items);
              store.setCustomer({ name: result.tabName });
              store.setOrderType('dine-in');
              store.sendToKitchen();
              store.clearWalkIn();
              setSurface('bar');
              showToast(`Added to "${result.tabName}"`, 'success');
            }
          }}
        />
      )}

      {/* Item info modal — long press */}
      {infoItem&&(
        <ItemInfoModal
          item={infoItem}
          onClose={()=>setInfoItem(null)}
          onAddToOrder={()=>{ setInfoItem(null); handleItemTap(infoItem); }}
        />
      )}

      {/* Order review modal */}
      {showReview&&(
        <OrderReviewModal
          items={items}
          subtotal={subtotal}
          service={service}
          total={total}
          checkDiscount={checkDiscount}
          orderType={orderType}
          tableLabel={activeTable?.label}
          server={session?.server||staff?.name}
          covers={covers}
          customer={customer}
          onClose={()=>setShowReview(false)}
          onCheckout={()=>{ setShowReview(false); if(items.length>0) setShowCheckout(true); }}
          onPrint={()=>{ setShowReview(false); setShowReceipt(true); }}
        />
      )}
    </div>
  );
}

function OrderItem({ item, covers, orderType, seatList, onQty, onRemove, onNote, onSeat, onCourse, onVoid, onDiscount, onRemoveDiscount }) {
  const [showMenu, setShowMenu] = useState(false);
  const [editNote, setEditNote] = useState(false);
  const [noteVal, setNoteVal]   = useState(item.notes||'');

  const isCommitted = item.status === 'sent';
  const isVoided    = item.voided || item.status === 'voided';

  const discountedPrice = item.discount
    ? (item.discount.type==='percent'
        ? item.price * (1 - item.discount.value/100)
        : Math.max(0, item.price - item.discount.value/item.qty))
    : item.price;
  const lineTotal = discountedPrice * item.qty;

  return (
    <div style={{
      background: isVoided ? 'rgba(239,68,68,.04)' : isCommitted ? 'var(--bg2)' : 'var(--bg2)',
      border:`1.5px solid ${isVoided?'var(--red-b)':isCommitted?'rgba(34,197,94,.2)':'var(--bdr)'}`,
      borderRadius:12,
      marginBottom:5,
      opacity: isVoided ? .55 : 1,
      overflow:'hidden',
      position:'relative',
    }}>
      {/* Left status bar */}
      <div style={{
        position:'absolute',left:0,top:0,bottom:0,width:3,
        background:isVoided?'var(--red)':isCommitted?'var(--grn)':'var(--bg5)',
        borderRadius:'12px 0 0 12px',
      }}/>

      <div style={{padding:'9px 10px 9px 14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}}>
          <div style={{flex:1}}>
            <div style={{
              fontSize:13, fontWeight:700, lineHeight:1.3,
              color: isVoided ? 'var(--red)' : 'var(--t1)',
              textDecoration: isVoided ? 'line-through' : 'none',
              display:'flex',alignItems:'center',gap:6,
            }}>
              {item.name}
              {isVoided && <span style={{fontSize:9,fontWeight:800,padding:'1px 5px',borderRadius:4,background:'var(--red-d)',color:'var(--red)',letterSpacing:.04}}>VOIDED</span>}
            </div>
            {item.mods?.map((m,i)=>(
              <div key={i} style={{fontSize:11,color:'var(--t4)',marginTop:1,display:'flex',justifyContent:'space-between'}}>
                <span>{m.groupLabel?`${m.groupLabel}: ${m.label}`:m.label}</span>
                {m.price>0&&<span style={{color:'var(--acc)',fontFamily:'var(--font-mono)'}}>+£{m.price.toFixed(2)}</span>}
              </div>
            ))}

            {/* Item discount */}
            {item.discount && !isVoided && (
              <div style={{display:'flex',alignItems:'center',gap:5,marginTop:3}}>
                <span style={{fontSize:11,color:'var(--grn)',fontWeight:600}}>🏷 {item.discount.label}</span>
                <span style={{fontSize:11,color:'var(--grn)',fontFamily:'var(--font-mono)'}}>−£{(item.price*item.qty - lineTotal).toFixed(2)}</span>
                <button onClick={onRemoveDiscount} style={{fontSize:11,color:'var(--t4)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',lineHeight:1}}>✕</button>
              </div>
            )}

            {/* Inline note editor */}
            {!isVoided && (editNote ? (
              <div style={{marginTop:6}}>
                <input autoFocus value={noteVal} onChange={e=>setNoteVal(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'){onNote(noteVal);setEditNote(false);}if(e.key==='Escape'){setNoteVal(item.notes||'');setEditNote(false);}}}
                  placeholder="No ice, well done, allergy note…"
                  style={{width:'100%',background:'var(--bg4)',border:'1.5px solid var(--acc-b)',borderRadius:7,padding:'5px 9px',color:'var(--t1)',fontSize:12,fontFamily:'inherit',outline:'none'}}/>
                <div style={{display:'flex',gap:5,marginTop:4}}>
                  <button onClick={()=>{onNote(noteVal);setEditNote(false);}} style={{flex:1,height:26,borderRadius:6,cursor:'pointer',fontFamily:'inherit',background:'var(--acc)',border:'none',color:'#0b0c10',fontSize:11,fontWeight:800}}>Save</button>
                  <button onClick={()=>{setNoteVal(item.notes||'');setEditNote(false);}} style={{flex:1,height:26,borderRadius:6,cursor:'pointer',fontFamily:'inherit',background:'var(--bg4)',border:'1px solid var(--bdr)',color:'var(--t3)',fontSize:11}}>Cancel</button>
                </div>
              </div>
            ) : (
              <div onClick={()=>{setNoteVal(item.notes||'');setEditNote(true);}} style={{marginTop:5,padding:'4px 8px',borderRadius:7,cursor:'pointer',border:`1px dashed ${item.notes?'rgba(249,115,22,.4)':'var(--bdr)'}`,fontSize:11,display:'flex',alignItems:'center',gap:5,color:item.notes?'#f97316':'var(--t4)',transition:'all .12s'}}>
                <span style={{fontSize:12}}>📝</span>
                <span style={{fontStyle:item.notes?'italic':'normal'}}>{item.notes||'Add note…'}</span>
              </div>
            ))}

            {item.allergens?.length>0&&!isVoided&&(
              <div style={{fontSize:10,color:'var(--red)',marginTop:3,fontWeight:600}}>⚠ {item.allergens.map(a=>ALLERGENS.find(x=>x.id===a)?.label).filter(Boolean).join(' · ')}</div>
            )}

            {/* Tags row */}
            {!isVoided && (
              <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                {orderType==='dine-in'&&covers>1&&(
                  <button onClick={()=>setShowMenu(s=>!s)} style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:'var(--acc-d)',border:'1px solid var(--acc-b)',color:'var(--acc)',cursor:'pointer',fontFamily:'inherit'}}>
                    {item.seat==='shared'?'Shared':`Seat ${item.seat}`}
                  </button>
                )}
                {item.course>0&&(
                  <button onClick={()=>setShowMenu(s=>!s)} style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:COURSE_COLORS[item.course]?.bg||'var(--bg3)',border:`1px solid ${(COURSE_COLORS[item.course]?.color||'var(--t3)')+'44'}`,color:COURSE_COLORS[item.course]?.color||'var(--t3)',cursor:'pointer',fontFamily:'inherit'}}>
                    {COURSE_COLORS[item.course]?.label}
                  </button>
                )}
                {isCommitted&&<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,background:'var(--grn-d)',border:'1px solid var(--grn-b)',color:'var(--grn)'}}>✓ Sent</span>}
              </div>
            )}
          </div>

          {/* Price column */}
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontSize:15,fontWeight:800,color:isVoided?'var(--red)':item.discount?'var(--grn)':'var(--t1)',fontFamily:'var(--font-mono)',textDecoration:isVoided?'line-through':'none'}}>
              £{lineTotal.toFixed(2)}
            </div>
            {item.discount&&!isVoided&&<div style={{fontSize:10,color:'var(--t4)',textDecoration:'line-through',fontFamily:'var(--font-mono)'}}>£{(item.price*item.qty).toFixed(2)}</div>}
            {item.qty>1&&!item.discount&&!isVoided&&<div style={{fontSize:10,color:'var(--t4)',fontFamily:'var(--font-mono)'}}>£{item.price.toFixed(2)} ea</div>}
          </div>
        </div>

        {/* Seat/course drawer */}
        {showMenu&&!isVoided&&(
          <div style={{marginTop:8,padding:'10px',background:'var(--bg3)',borderRadius:10,border:'1px solid var(--bdr)'}}>
            {orderType==='dine-in'&&covers>1&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:9,fontWeight:800,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Move to seat</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {seatList.map(s=>(
                    <button key={s} onClick={()=>{onSeat(s);setShowMenu(false);}} style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,background:item.seat===s?'var(--acc-d)':'var(--bg4)',border:`1.5px solid ${item.seat===s?'var(--acc)':'var(--bdr)'}`,color:item.seat===s?'var(--acc)':'var(--t3)'}}>
                      {s==='shared'?'Shared':`S${s}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div style={{fontSize:9,fontWeight:800,color:'var(--t4)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Move to course</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {Object.entries(COURSE_COLORS).map(([c,cc])=>(
                  <button key={c} onClick={()=>{onCourse(parseInt(c));setShowMenu(false);}} style={{padding:'4px 10px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,background:item.course===parseInt(c)?cc.bg:'var(--bg4)',border:`1.5px solid ${item.course===parseInt(c)?cc.color:'var(--bdr)'}`,color:item.course===parseInt(c)?cc.color:'var(--t3)'}}>
                    {cc.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={()=>setShowMenu(false)} style={{marginTop:8,fontSize:11,color:'var(--t4)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Done</button>
          </div>
        )}

        {/* Bottom controls */}
        {!isVoided && (
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
            {/* Qty stepper — bigger touch targets */}
            <div style={{display:'flex',alignItems:'center',background:'var(--bg3)',border:'1px solid var(--bdr)',borderRadius:9,overflow:'hidden'}}>
              <button onClick={()=>onQty(-1)} style={{width:30,height:28,background:'transparent',border:'none',color:'var(--t2)',fontSize:16,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg4)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>−</button>
              <div style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'var(--t1)',fontFamily:'var(--font-mono)'}}>{item.qty}</div>
              <button onClick={()=>onQty(1)} style={{width:30,height:28,background:'transparent',border:'none',color:'var(--t2)',fontSize:16,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',transition:'background .1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg4)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>+</button>
            </div>

            <div style={{marginLeft:'auto',display:'flex',gap:6}}>
              {/* Pending: Remove. Committed: Void (requires PIN) */}
              {isCommitted ? (
                <button onClick={onVoid} style={{height:28,padding:'0 10px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,background:'var(--red-d)',border:'1px solid var(--red-b)',color:'var(--red)'}}>Void</button>
              ) : (
                <button onClick={onRemove} style={{height:28,padding:'0 10px',borderRadius:7,cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,background:'var(--bg4)',border:'1px solid var(--bdr)',color:'var(--t3)'}}>Remove</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline Orders Hub ─────────────────────────────────────────────────────────
const ORDER_STATUS = {
  received: { label:'Received',  color:'#3b82f6', bg:'rgba(59,130,246,.1)',  next:'Start prep',  icon:'📥' },
  prep:     { label:'In prep',   color:'#f97316', bg:'rgba(249,115,22,.1)',   next:'Mark ready',  icon:'👨‍🍳' },
  ready:    { label:'Ready',     color:'#22c55e', bg:'rgba(34,197,94,.1)',    next:'Collected',   icon:'✅' },
  collected:{ label:'Collected', color:'#5c5a64', bg:'rgba(92,90,100,.1)',    next:null,          icon:'👋' },
};

function OrdersHub({ orderQueue, updateQueueStatus, removeFromQueue, showToast }) {
  const [filter, setFilter] = useState('active');
  const now = new Date();

  const filtered = [...(orderQueue||[])].filter(o =>
    filter==='active' ? o.status!=='collected' :
    filter==='collected' ? o.status==='collected' : true
  );

  const counts = {
    received: orderQueue.filter(o=>o.status==='received').length,
    prep:     orderQueue.filter(o=>o.status==='prep').length,
    ready:    orderQueue.filter(o=>o.status==='ready').length,
  };

  const advance = (o) => {
    const flow = ['received','prep','ready','collected'];
    const idx = flow.indexOf(o.status);
    if (idx < flow.length-1) {
      const next = flow[idx+1];
      updateQueueStatus(o.ref, next);
      if (next==='ready') showToast(`${o.ref} ready for ${o.customer?.name}`, 'success');
      else if (next==='collected') { showToast(`${o.ref} collected`, 'info'); setTimeout(()=>removeFromQueue(o.ref), 5000); }
      else showToast(`${o.ref} in prep`, 'info');
    }
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Summary pills */}
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--bdr)',background:'var(--bg1)',flexShrink:0}}>
        <div style={{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap'}}>
          {Object.entries(ORDER_STATUS).filter(([k])=>k!=='collected').map(([s,m])=>(
            <div key={s} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,background:m.bg,border:`1px solid ${m.color}44`}}>
              <span style={{fontSize:13}}>{m.icon}</span>
              <span style={{fontSize:11,fontWeight:600,color:m.color}}>{m.label}</span>
              <span style={{fontSize:13,fontWeight:800,color:m.color}}>{counts[s]||0}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:4}}>
          {[['active','Active'],['collected','Completed'],['all','All']].map(([f,l])=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:'4px 12px',borderRadius:20,cursor:'pointer',fontFamily:'inherit',background:filter===f?'var(--acc-d)':'transparent',border:`1px solid ${filter===f?'var(--acc-b)':'var(--bdr)'}`,color:filter===f?'var(--acc)':'var(--t3)',fontSize:12,fontWeight:600}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div style={{flex:1,overflowY:'auto',padding:'10px 14px'}}>
        {filtered.length===0&&(
          <div style={{textAlign:'center',padding:'60px 0',color:'var(--t3)'}}>
            <div style={{fontSize:40,marginBottom:12,opacity:.4}}>📦</div>
            <div style={{fontSize:14,fontWeight:600,color:'var(--t2)',marginBottom:6}}>No orders</div>
            <div style={{fontSize:12,lineHeight:1.6}}>Takeaway and collection orders appear here after Send</div>
          </div>
        )}
        {filtered.map(order=>{
          const sm = ORDER_STATUS[order.status] || ORDER_STATUS.received;
          const isOverdue = order.status!=='collected' && !order.isASAP && order.collectionTime && false; // placeholder
          return (
            <div key={order.ref} style={{background:'var(--bg2)',border:'1px solid var(--bdr)',borderRadius:12,marginBottom:10,overflow:'hidden',opacity:order.status==='collected'?.55:1}}>
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderBottom:'1px solid var(--bdr)'}}>
                <span style={{fontSize:18}}>{order.type==='collection'?'📦':'🥡'}</span>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                    <span style={{fontSize:13,fontWeight:800,color:'var(--t1)',fontFamily:'DM Mono,monospace'}}>{order.ref}</span>
                    <span style={{fontSize:13,fontWeight:600,color:'var(--t2)'}}>{order.customer?.name}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:1}}>{order.customer?.phone}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--acc)',fontFamily:'DM Mono,monospace'}}>£{(order.total||0).toFixed(2)}</div>
                  <div style={{fontSize:10,color:'var(--t3)',textTransform:'capitalize'}}>{order.type}</div>
                </div>
              </div>

              {/* Body */}
              <div style={{padding:'8px 12px',display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:sm.bg,color:sm.color}}>{sm.icon} {sm.label}</span>
                    {order.type==='collection'&&(
                      <span style={{fontSize:12,fontWeight:700,color:order.isASAP?'var(--acc)':'var(--t2)'}}>
                        {order.isASAP ? '⚡ ASAP' : `🕐 ${order.collectionTime||'—'}`}
                      </span>
                    )}
                    <span style={{fontSize:10,color:'var(--t4)'}}>by {order.staff}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--t3)',lineHeight:1.6}}>
                    {(order.items||[]).slice(0,4).map((i,idx)=>(
                      <span key={idx}>{i.qty>1?`${i.qty}× `:''}{i.name}{idx<Math.min((order.items||[]).length,4)-1?', ':''}</span>
                    ))}
                    {(order.items||[]).length>4&&<span style={{color:'var(--t4)'}}> +{(order.items||[]).length-4} more</span>}
                  </div>
                  {order.customer?.notes&&<div style={{fontSize:11,color:'#f97316',marginTop:4,fontStyle:'italic'}}>📝 {order.customer.notes}</div>}
                </div>
                {sm.next&&(
                  <button onClick={()=>advance(order)} style={{padding:'7px 14px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',fontSize:12,fontWeight:700,background:order.status==='prep'?'var(--grn-d)':'var(--bg3)',border:`1px solid ${order.status==='prep'?'var(--grn-b)':'var(--bdr2)'}`,color:order.status==='prep'?'var(--grn)':'var(--t2)'}}>
                    {sm.next} →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
