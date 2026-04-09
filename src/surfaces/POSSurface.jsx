import { useState } from 'react';
import { useStore } from '../store';
import { CATEGORIES, MENU_ITEMS, ALLERGENS, QUICK_IDS, getDaypart } from '../data/seed';
import ProductModal, { AllergenModal } from '../components/ProductModal';
import CheckoutModal from './CheckoutModal';

export default function POSSurface() {
  const { staff, allergens, toggleAllergen, clearAllergens, order, addToOrder, removeFromOrder, updateQty, sendToKitchen, clearOrder, getOrderTotals, tableId, orderType, setOrderType, covers, setCovers, showToast, pendingItem, setPendingItem, clearPendingItem } = useStore();
  const [cat, setCat] = useState('quick');
  const [modalItem, setModalItem] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const daypart = getDaypart();
  const displayItems = cat==='quick' ? QUICK_IDS.map(id=>MENU_ITEMS.find(i=>i.id===id)).filter(Boolean) : MENU_ITEMS.filter(i=>i.cat===cat);
  const heatRank = (id) => QUICK_IDS.indexOf(id);
  const { subtotal, service, total, itemCount } = getOrderTotals();
  const items = order?.items || [];

  const handleItemTap = (item) => {
    const flagged = (item.allergens||[]).some(a=>allergens.includes(a));
    if (flagged) { setPendingItem(item); return; }
    openFlow(item);
  };

  const openFlow = (item) => {
    if (item.type==='simple') { addToOrder(item,[],null,{displayName:item.name,qty:1,linePrice:item.price}); showToast(`${item.name} added`,'success'); }
    else setModalItem(item);
  };

  return (
    <div style={{display:'flex',flex:1,overflow:'hidden',minWidth:0}}>
      {/* Menu */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
        <div style={{height:52,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',borderBottom:'1px solid var(--bdr)',background:'var(--c-surf)',flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:600}}>{tableId?`Table ${tableId.replace(/^[tbp]/,'').toUpperCase()||tableId}`:'Walk-in order'}</div>
            <div style={{fontSize:11,color:'var(--c-text3)'}}>{cat==='quick'?`Quick screen · ${daypart}`:CATEGORIES.find(c=>c.id===cat)?.label}</div>
          </div>
          {allergens.length>0&&<button onClick={clearAllergens} style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:600,background:'var(--c-red-dim)',border:'1px solid var(--c-red-bdr)',color:'var(--c-red)',cursor:'pointer',fontFamily:'inherit'}}>⚠ {allergens.length} allergen{allergens.length>1?'s':''} · clear</button>}
        </div>

        {/* Allergen bar */}
        <div style={{display:'flex',gap:4,padding:'7px 14px',overflowX:'auto',borderBottom:'1px solid var(--bdr)',background:'var(--c-surf)',flexShrink:0}}>
          {ALLERGENS.map(a=>{
            const on=allergens.includes(a.id);
            return <button key={a.id} onClick={()=>toggleAllergen(a.id)} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:20,whiteSpace:'nowrap',fontSize:11,fontWeight:500,cursor:'pointer',border:`1px solid ${on?'var(--c-red-bdr)':'var(--bdr)'}`,background:on?'var(--c-red-dim)':'transparent',color:on?'var(--c-red)':'var(--c-text3)',fontFamily:'inherit'}}>
              <span style={{width:14,height:14,borderRadius:3,background:on?'var(--c-red)':'var(--c-raised)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:on?'#fff':'var(--c-text3)',flexShrink:0}}>{a.icon}</span>
              {a.label}
            </button>;
          })}
        </div>

        {/* Cat pills */}
        <div style={{display:'flex',gap:4,padding:'9px 14px 0',overflowX:'auto',borderBottom:'1px solid var(--bdr)',flexShrink:0}}>
          {CATEGORIES.map(c=><button key={c.id} onClick={()=>setCat(c.id)} style={{padding:'5px 13px',borderRadius:20,fontSize:12,fontWeight:500,whiteSpace:'nowrap',cursor:'pointer',marginBottom:9,border:'1px solid transparent',fontFamily:'inherit',background:cat===c.id?'var(--c-acc)':'transparent',color:cat===c.id?'var(--c-inverse)':'var(--c-text3)'}}>{c.label}</button>)}
        </div>

        {/* Grid */}
        <div style={{flex:1,overflowY:'auto',padding:14}}>
          {cat==='quick'&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:13,fontWeight:500,color:'var(--c-text2)'}}>AI-curated · {daypart}</div><span style={{padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600,background:'var(--c-acc-dim)',border:'1px solid var(--c-acc-bdr)',color:'var(--c-acc)'}}>Updated nightly</span></div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(115px,1fr))',gap:8}}>
            {displayItems.map(item=>{
              const flagged=allergens.some(a=>item.allergens?.includes(a));
              const rank=heatRank(item.id);
              const hc=rank<0?null:rank<3?'var(--c-red)':rank<6?'var(--c-acc)':'var(--c-grn)';
              const tl=item.type==='variants'?'▼ sizes':item.type==='modifiers'?'⊕ options':item.type==='pizza'?'🍕 builder':null;
              return <button key={item.id} onClick={()=>handleItemTap(item)} style={{display:'block',padding:'11px 10px',textAlign:'left',background:flagged?'var(--c-red-dim)':'var(--c-raised)',border:`1px solid ${flagged?'var(--c-red-bdr)':'var(--bdr)'}`,borderRadius:12,cursor:'pointer',position:'relative',fontFamily:'inherit',transition:'all .12s'}}>
                {hc&&cat==='quick'&&!flagged&&<div style={{position:'absolute',top:8,right:8,width:6,height:6,borderRadius:'50%',background:hc}}/>}
                {flagged&&<div style={{position:'absolute',top:7,right:7,fontSize:12}}>⚠</div>}
                <div style={{fontSize:12,fontWeight:600,lineHeight:1.3,marginBottom:5,color:flagged?'var(--c-red)':'var(--c-text)',paddingRight:flagged||hc?14:0}}>{item.name}</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--c-acc)'}}>{item.type==='variants'?`from £${Math.min(...item.variants.map(v=>v.price)).toFixed(2)}`:`£${item.price.toFixed(2)}`}</div>
                {tl&&<div style={{fontSize:10,color:'var(--c-text3)',marginTop:4}}>{tl}</div>}
                {cat==='quick'&&rank>=0&&<div style={{fontSize:10,color:'var(--c-text3)',marginTop:2}}>{item.sales} sold</div>}
                {flagged&&allergens.length>0&&<div style={{fontSize:10,color:'var(--c-red)',marginTop:4,lineHeight:1.4}}>{item.allergens.filter(a=>allergens.includes(a)).map(a=>ALLERGENS.find(x=>x.id===a)?.label).join(', ')}</div>}
              </button>;
            })}
          </div>
        </div>
      </div>

      {/* Order panel */}
      <div style={{width:'var(--order-w)',background:'var(--c-surf)',borderLeft:'1px solid var(--bdr)',display:'flex',flexDirection:'column',flexShrink:0}}>
        {/* Order type */}
        <div style={{padding:'10px 12px',borderBottom:'1px solid var(--bdr)',flexShrink:0}}>
          <div style={{display:'flex',gap:4,marginBottom:orderType==='dine-in'?10:0}}>
            {[['dine-in','🍽 Dine in'],['takeaway','🥡 Takeaway'],['collection','📦 Collect']].map(([t,l])=>(
              <button key={t} onClick={()=>setOrderType(t)} style={{flex:1,padding:'6px 4px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600,border:`1.5px solid ${orderType===t?'var(--c-acc)':'var(--bdr)'}`,background:orderType===t?'var(--c-acc-dim)':'transparent',color:orderType===t?'var(--c-acc)':'var(--c-text3)',fontFamily:'inherit'}}>{l}</button>
            ))}
          </div>
          {orderType==='dine-in'&&<div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'var(--c-text3)'}}>Covers</span>
            <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto'}}>
              <button onClick={()=>setCovers(c=>Math.max(1,c-1))} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--bdr2)',background:'transparent',color:'var(--c-text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>−</button>
              <span style={{fontSize:14,fontWeight:700,minWidth:20,textAlign:'center'}}>{covers}</span>
              <button onClick={()=>setCovers(c=>c+1)} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--bdr2)',background:'transparent',color:'var(--c-text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>+</button>
            </div>
          </div>}
        </div>

        <div style={{padding:'8px 12px 0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:600,color:'var(--c-text3)',textTransform:'uppercase',letterSpacing:'.06em'}}>{tableId?`Table ${tableId.replace(/^[tbp]/,'')}`:orderType} · {staff?.name}</span>
          {items.length>0&&<button onClick={clearOrder} style={{fontSize:11,color:'var(--c-text3)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit'}}>Clear</button>}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:10}}>
          {!items.length&&<div style={{textAlign:'center',color:'var(--c-text3)',padding:'40px 0',fontSize:13}}><div style={{fontSize:34,marginBottom:10}}>🍽</div>Tap items to add</div>}
          {items.map(item=>(
            <div key={item.uid} style={{background:'var(--c-raised)',border:'1px solid var(--bdr)',borderRadius:10,padding:10,marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                <div style={{fontSize:13,fontWeight:600,flex:1,lineHeight:1.3}}>{item.name}</div>
                <div style={{fontSize:13,fontWeight:700,color:'var(--c-acc)',whiteSpace:'nowrap'}}>£{(item.price*item.qty).toFixed(2)}</div>
              </div>
              {item.mods?.map((m,i)=>(
                <div key={i} style={{fontSize:11,color:'var(--c-text3)',marginTop:2,display:'flex',justifyContent:'space-between'}}>
                  <span>{m.groupLabel?`${m.groupLabel}: ${m.label}`:m.label}</span>
                  {m.price>0&&<span style={{color:'var(--c-acc)'}}>+£{m.price.toFixed(2)}</span>}
                </div>
              ))}
              {item.notes&&<div style={{fontSize:11,color:'#f97316',marginTop:3,fontStyle:'italic'}}>📝 {item.notes}</div>}
              {item.allergens?.length>0&&<div style={{fontSize:10,color:'var(--c-red)',marginTop:3}}>⚠ {item.allergens.map(a=>ALLERGENS.find(x=>x.id===a)?.label).filter(Boolean).join(' · ')}</div>}
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:7}}>
                <div style={{display:'flex',alignItems:'center',gap:7}}>
                  <button onClick={()=>updateQty(item.uid,-1)} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--bdr2)',background:'transparent',color:'var(--c-text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>−</button>
                  <span style={{fontSize:13,fontWeight:700,minWidth:16,textAlign:'center'}}>{item.qty}</span>
                  <button onClick={()=>updateQty(item.uid,1)} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--bdr2)',background:'transparent',color:'var(--c-text)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>+</button>
                </div>
                {item.qty>1&&<span style={{fontSize:11,color:'var(--c-text3)'}}>£{item.price.toFixed(2)} ea</span>}
                <button onClick={()=>removeFromOrder(item.uid)} style={{marginLeft:'auto',fontSize:11,color:'var(--c-red)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit'}}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        {items.length>0&&(
          <div style={{padding:12,borderTop:'1px solid var(--bdr)',flexShrink:0}}>
            <div style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--c-text3)',marginBottom:3}}><span>Subtotal ({itemCount} item{itemCount!==1?'s':''})</span><span>£{subtotal.toFixed(2)}</span></div>
              {orderType==='dine-in'&&<div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--c-text3)',marginBottom:3}}><span>Service (12.5%)</span><span>£{service.toFixed(2)}</span></div>}
              {orderType!=='dine-in'&&<div style={{fontSize:11,color:'var(--c-grn)',marginBottom:3}}>No service charge · {orderType}</div>}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:18,fontWeight:700,marginTop:8,paddingTop:8,borderTop:'1px solid var(--bdr)'}}><span>Total</span><span style={{color:'var(--c-acc)'}}>£{total.toFixed(2)}</span></div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{sendToKitchen();showToast('Sent to kitchen','success');}}>Send →</button>
              <button className="btn btn-acc" style={{flex:1}} onClick={()=>setShowCheckout(true)}>Pay £{total.toFixed(2)}</button>
            </div>
          </div>
        )}
      </div>

      {pendingItem&&<AllergenModal item={pendingItem} activeAllergens={allergens} onConfirm={()=>{const i=pendingItem;clearPendingItem();openFlow(i);}} onCancel={clearPendingItem}/>}
      {modalItem&&<ProductModal item={modalItem} activeAllergens={allergens} onConfirm={(item,mods,cfg,opts)=>{addToOrder(item,mods,cfg,opts);setModalItem(null);showToast(`${opts.displayName||item.name} added`,'success');}} onCancel={()=>setModalItem(null)}/>}
      {showCheckout&&<CheckoutModal items={items} subtotal={subtotal} service={service} total={total} orderType={orderType} covers={covers} tableId={tableId} onClose={()=>setShowCheckout(false)} onComplete={()=>{setShowCheckout(false);clearOrder();showToast('Payment complete','success');}}/>}
    </div>
  );
}
