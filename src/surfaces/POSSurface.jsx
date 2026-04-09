import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { CATEGORIES, MENU_ITEMS, ALLERGENS, QUICK_IDS, getDaypart } from '../data/seed';
import ProductModal, { AllergenModal } from '../components/ProductModal';
import CheckoutModal from './CheckoutModal';

// Category colours — each category gets a distinct accent
const CAT_META = {
  quick:     { icon:'⚡', color:'#e8a020', bg:'rgba(232,160,32,.12)' },
  starters:  { icon:'🥗', color:'#1db954', bg:'rgba(29,185,84,.1)'  },
  mains:     { icon:'🍽', color:'#3b7ef6', bg:'rgba(59,126,246,.1)' },
  pizza:     { icon:'🍕', color:'#f07020', bg:'rgba(240,112,32,.1)' },
  sides:     { icon:'🍟', color:'#a855f7', bg:'rgba(168,85,247,.1)' },
  desserts:  { icon:'🍮', color:'#e84066', bg:'rgba(232,64,102,.1)' },
  drinks:    { icon:'🍷', color:'#e84040', bg:'rgba(232,64,64,.1)'  },
  cocktails: { icon:'🍸', color:'#22d3ee', bg:'rgba(34,211,238,.1)' },
};

export default function POSSurface() {
  const {
    staff, allergens, toggleAllergen, clearAllergens,
    order, addToOrder, removeFromOrder, updateQty,
    sendToKitchen, clearOrder, getOrderTotals,
    tableId, orderType, setOrderType, covers, setCovers,
    showToast, pendingItem, setPendingItem, clearPendingItem,
  } = useStore();

  const [cat, setCat]           = useState('quick');
  const [modalItem, setModalItem] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [search, setSearch]     = useState('');
  const [showAllergenBar, setShowAllergenBar] = useState(false);

  const daypart = getDaypart();
  const catMeta = CAT_META[cat] || CAT_META.quick;

  const rawItems = cat === 'quick'
    ? QUICK_IDS.map(id => MENU_ITEMS.find(i => i.id === id)).filter(Boolean)
    : MENU_ITEMS.filter(i => i.cat === cat);

  const displayItems = useMemo(() => {
    if (!search.trim()) return rawItems;
    const q = search.toLowerCase();
    return MENU_ITEMS.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
  }, [cat, search, rawItems]);

  const { subtotal, service, total, itemCount } = getOrderTotals();
  const items = order?.items || [];
  const heatRank = (id) => QUICK_IDS.indexOf(id);

  const handleItemTap = (item) => {
    if (allergens.some(a => (item.allergens || []).includes(a))) {
      setPendingItem(item); return;
    }
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

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>

      {/* ══ LEFT — ORDER PANEL ═══════════════════════════════════════════ */}
      <OrderPanel
        items={items} subtotal={subtotal} service={service} total={total} itemCount={itemCount}
        orderType={orderType} setOrderType={setOrderType}
        covers={covers} setCovers={setCovers}
        tableId={tableId} staff={staff}
        updateQty={updateQty} removeFromOrder={removeFromOrder}
        clearOrder={clearOrder} sendToKitchen={sendToKitchen} showToast={showToast}
        onPay={() => setShowCheckout(true)}
      />

      {/* ══ CENTRE — CATEGORY NAV ════════════════════════════════════════ */}
      <div style={{
        width:'var(--cat)', flexShrink:0,
        background:'var(--bg1)', borderLeft:'1px solid var(--bdr)', borderRight:'1px solid var(--bdr)',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        <div style={{ padding:'14px 10px 10px', borderBottom:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:2, paddingLeft:4 }}>Menu</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
          {CATEGORIES.map(c => {
            const m = CAT_META[c.id] || {};
            const isActive = cat === c.id && !search;
            const count = c.id === 'quick' ? QUICK_IDS.length : MENU_ITEMS.filter(i => i.cat === c.id).length;
            return (
              <button key={c.id} onClick={() => { setCat(c.id); setSearch(''); }} style={{
                width:'100%', padding:'10px 10px', borderRadius:'var(--r10)', cursor:'pointer',
                display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2,
                background: isActive ? m.bg || 'var(--acc-d)' : 'transparent',
                border:`1px solid ${isActive ? (m.color+'44') : 'transparent'}`,
                marginBottom:4, transition:'all .15s', fontFamily:'inherit', textAlign:'left',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, width:'100%' }}>
                  <span style={{ fontSize:18, lineHeight:1 }}>{m.icon || '•'}</span>
                  <span style={{ fontSize:13, fontWeight:600, color: isActive ? m.color : 'var(--t2)', flex:1 }}>{c.label}</span>
                </div>
                <div style={{ fontSize:10, color:'var(--t3)', paddingLeft:26 }}>{count} items</div>
              </button>
            );
          })}
        </div>

        {/* Allergen toggle */}
        <div style={{ padding:'10px 8px', borderTop:'1px solid var(--bdr)' }}>
          <button onClick={() => setShowAllergenBar(s => !s)} style={{
            width:'100%', padding:'8px 10px', borderRadius:'var(--r8)', cursor:'pointer',
            background: allergens.length > 0 ? 'var(--red-d)' : 'var(--bg3)',
            border:`1px solid ${allergens.length > 0 ? 'var(--red-b)' : 'var(--bdr)'}`,
            color: allergens.length > 0 ? 'var(--red)' : 'var(--t3)',
            fontSize:11, fontWeight:600, fontFamily:'inherit', textAlign:'left',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span>⚠</span>
            <span>{allergens.length > 0 ? `${allergens.length} allergen${allergens.length>1?'s':''} active` : 'Allergen filter'}</span>
          </button>
        </div>
      </div>

      {/* ══ RIGHT — PRODUCT GRID ═════════════════════════════════════════ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0, background:'var(--bg)' }}>

        {/* Top bar — search + category title */}
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ position:'relative', flex:1, maxWidth:320 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--t3)', fontSize:14 }}>🔍</span>
            <input
              className="input"
              placeholder="Search menu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft:36, height:38, fontSize:13 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:22 }}>{search ? '🔍' : catMeta.icon}</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color: search ? 'var(--t1)' : catMeta.color, lineHeight:1.2 }}>
                {search ? `"${search}"` : CATEGORIES.find(c => c.id === cat)?.label}
              </div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>
                {displayItems.length} item{displayItems.length !== 1 ? 's' : ''}{cat==='quick'&&!search?` · ${daypart}`:''}
              </div>
            </div>
          </div>
        </div>

        {/* Allergen bar — slide in */}
        {showAllergenBar && (
          <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0, animation:'slideUp .15s ease' }}>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {allergens.length > 0 && (
                <button onClick={clearAllergens} style={{ padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', cursor:'pointer', fontFamily:'inherit' }}>
                  Clear all
                </button>
              )}
              {ALLERGENS.map(a => {
                const on = allergens.includes(a.id);
                return (
                  <button key={a.id} onClick={() => toggleAllergen(a.id)} style={{
                    display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px',
                    borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer',
                    border:`1px solid ${on ? 'var(--red-b)' : 'var(--bdr)'}`,
                    background: on ? 'var(--red-d)' : 'transparent',
                    color: on ? 'var(--red)' : 'var(--t3)', fontFamily:'inherit',
                  }}>
                    <span style={{ width:14, height:14, borderRadius:3, background:on?'var(--red)':'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:on?'#fff':'var(--t3)', flexShrink:0 }}>{a.icon}</span>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Product grid */}
        <div style={{ flex:1, overflowY:'auto', padding:14 }}>
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',
            gap:10,
          }}>
            {displayItems.map((item, idx) => {
              const m = CAT_META[item.cat] || CAT_META.quick;
              const flagged = allergens.some(a => item.allergens?.includes(a));
              const rank = cat === 'quick' ? heatRank(item.id) : -1;
              const isHot = rank >= 0 && rank < 3;
              const fromPrice = item.type === 'variants'
                ? Math.min(...item.variants.map(v => v.price))
                : item.price;

              return (
                <button key={item.id} onClick={() => handleItemTap(item)} style={{
                  display:'flex', flexDirection:'column', padding:0, overflow:'hidden',
                  background: flagged ? 'rgba(232,64,64,.08)' : 'var(--bg2)',
                  border:`1px solid ${flagged ? 'var(--red-b)' : isHot ? m.color+'33' : 'var(--bdr)'}`,
                  borderRadius:'var(--r12)', cursor:'pointer', textAlign:'left',
                  transition:'all .15s', fontFamily:'inherit',
                  animation: `fadeIn .2s ease ${Math.min(idx,12)*0.03}s both`,
                }}>
                  {/* Colour bar */}
                  <div style={{ height:3, background: flagged ? 'var(--red)' : isHot ? m.color : m.color+'44', width:'100%', flexShrink:0 }}/>

                  <div style={{ padding:'12px 12px 11px', flex:1, display:'flex', flexDirection:'column' }}>
                    {/* Icon + heat badge */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ fontSize:26, lineHeight:1 }}>{flagged ? '⚠️' : m.icon}</div>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
                        {isHot && !flagged && (
                          <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:20, background: m.color+'22', color:m.color, border:`1px solid ${m.color}44` }}>
                            #{rank+1} today
                          </span>
                        )}
                        {flagged && (
                          <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:20, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)' }}>
                            allergen
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Name */}
                    <div style={{ fontSize:13, fontWeight:700, color: flagged ? 'var(--red)' : 'var(--t1)', lineHeight:1.3, marginBottom:4, flex:1 }}>
                      {item.name}
                    </div>

                    {/* Description */}
                    {item.description && (
                      <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.4, marginBottom:6,
                        display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                        {item.description}
                      </div>
                    )}

                    {/* Price + type */}
                    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginTop:'auto', paddingTop:4 }}>
                      <div style={{ fontSize:16, fontWeight:800, color: flagged ? 'var(--red)' : m.color, fontFamily:'DM Mono,monospace' }}>
                        {item.type === 'variants' ? `from £${fromPrice.toFixed(2)}` : `£${fromPrice.toFixed(2)}`}
                      </div>
                      {item.type !== 'simple' && (
                        <div style={{ fontSize:9, fontWeight:600, padding:'2px 5px', borderRadius:4, background:'var(--bg4)', color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                          {item.type === 'variants' ? 'sizes' : item.type === 'modifiers' ? 'options' : 'builder'}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {displayItems.length === 0 && (
            <div style={{ textAlign:'center', padding:'80px 0', color:'var(--t3)' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>No items found</div>
              <div style={{ fontSize:13 }}>Try a different search or category</div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {pendingItem && (
        <AllergenModal item={pendingItem} activeAllergens={allergens}
          onConfirm={() => { const i = pendingItem; clearPendingItem(); openFlow(i); }}
          onCancel={clearPendingItem}/>
      )}
      {modalItem && (
        <ProductModal item={modalItem} activeAllergens={allergens}
          onConfirm={(item, mods, cfg, opts) => { addToOrder(item, mods, cfg, opts); setModalItem(null); showToast(`${opts.displayName || item.name} added`, 'success'); }}
          onCancel={() => setModalItem(null)}/>
      )}
      {showCheckout && (
        <CheckoutModal items={items} subtotal={subtotal} service={service} total={total}
          orderType={orderType} covers={covers} tableId={tableId}
          onClose={() => setShowCheckout(false)}
          onComplete={() => { setShowCheckout(false); clearOrder(); showToast('Payment complete — table cleared', 'success'); }}/>
      )}
    </div>
  );
}

// ── Order Panel Component ─────────────────────────────────────────────────────
function OrderPanel({ items, subtotal, service, total, itemCount, orderType, setOrderType, covers, setCovers, tableId, staff, updateQty, removeFromOrder, clearOrder, sendToKitchen, showToast, onPay }) {

  const TYPE_OPTS = [
    { id:'dine-in',    label:'Dine in',   icon:'🍽' },
    { id:'takeaway',   label:'Takeaway',  icon:'🥡' },
    { id:'collection', label:'Collect',   icon:'📦' },
  ];

  return (
    <div style={{
      width:'var(--ord)', flexShrink:0, display:'flex', flexDirection:'column',
      background:'var(--bg1)', borderRight:'1px solid var(--bdr)', overflow:'hidden',
    }}>

      {/* Order type header */}
      <div style={{ padding:'14px 14px 12px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:4, marginBottom:10 }}>
          {TYPE_OPTS.map(t => (
            <button key={t.id} onClick={() => setOrderType(t.id)} style={{
              flex:1, padding:'7px 4px', borderRadius:'var(--r8)', cursor:'pointer',
              border:`1.5px solid ${orderType===t.id ? 'var(--acc-b)' : 'var(--bdr)'}`,
              background:orderType===t.id ? 'var(--acc-d)' : 'transparent',
              color:orderType===t.id ? 'var(--acc)' : 'var(--t3)',
              fontSize:11, fontWeight:700, fontFamily:'inherit',
              display:'flex', flexDirection:'column', alignItems:'center', gap:1,
            }}>
              <span style={{ fontSize:16 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {orderType === 'dine-in' && (
          <div style={{ display:'flex', alignItems:'center', gap:0, background:'var(--bg3)', borderRadius:'var(--r8)', border:'1px solid var(--bdr)', overflow:'hidden' }}>
            <button onClick={() => setCovers(c => Math.max(1, c-1))} style={{ width:36, height:34, background:'transparent', border:'none', color:'var(--t2)', fontSize:18, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <div style={{ flex:1, textAlign:'center', fontSize:13, fontWeight:700 }}>{covers} cover{covers!==1?'s':''}</div>
            <button onClick={() => setCovers(c => c+1)} style={{ width:36, height:34, background:'transparent', border:'none', color:'var(--t2)', fontSize:18, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        )}
      </div>

      {/* Order info strip */}
      <div style={{ padding:'8px 14px 6px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em' }}>
          {tableId ? `Table ${tableId.replace(/^[tbp]/,'').toUpperCase() || tableId}` : orderType} · {staff?.name}
        </div>
        {items.length > 0 && (
          <button onClick={clearOrder} style={{ fontSize:11, color:'var(--t3)', cursor:'pointer', background:'none', border:'none', fontFamily:'inherit' }}>
            Clear
          </button>
        )}
      </div>

      {/* Items list */}
      <div style={{ flex:1, overflowY:'auto', padding:'4px 12px' }}>
        {items.length === 0 && (
          <div style={{ textAlign:'center', padding:'56px 16px', color:'var(--t3)' }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:.5 }}>🧾</div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--t3)', marginBottom:4 }}>Order is empty</div>
            <div style={{ fontSize:12 }}>Tap items from the menu</div>
          </div>
        )}

        {items.map((item, idx) => (
          <div key={item.uid} style={{
            borderBottom:'1px solid var(--bdr)', paddingBottom:10, marginBottom:10,
            animation:`slideUp .15s ease ${idx*0.04}s both`,
          }}>
            <div style={{ display:'flex', gap:8, marginBottom:item.mods?.length||item.notes||item.allergens?.length ? 5 : 0 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, lineHeight:1.3, color:'var(--t1)' }}>{item.name}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--acc)', whiteSpace:'nowrap', fontFamily:'DM Mono,monospace' }}>
                £{(item.price * item.qty).toFixed(2)}
              </div>
            </div>

            {item.mods?.length > 0 && (
              <div style={{ marginBottom:3 }}>
                {item.mods.map((m, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', lineHeight:1.4 }}>
                    <span>{m.groupLabel ? `${m.groupLabel}: ${m.label}` : m.label}</span>
                    {m.price > 0 && <span style={{ color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>+£{m.price.toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            )}

            {item.notes && (
              <div style={{ fontSize:11, color:'var(--orn)', marginBottom:3, fontStyle:'italic' }}>📝 {item.notes}</div>
            )}

            {item.allergens?.length > 0 && (
              <div style={{ fontSize:10, color:'var(--red)', marginBottom:4 }}>
                ⚠ {item.allergens.map(a => ALLERGENS.find(x=>x.id===a)?.label).filter(Boolean).join(' · ')}
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:1, background:'var(--bg3)', borderRadius:'var(--r8)', border:'1px solid var(--bdr)', overflow:'hidden' }}>
                <button onClick={() => updateQty(item.uid, -1)} style={{ width:28, height:26, background:'transparent', border:'none', color:'var(--t2)', fontSize:16, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                <div style={{ width:28, height:26, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'var(--t1)' }}>{item.qty}</div>
                <button onClick={() => updateQty(item.uid, 1)} style={{ width:28, height:26, background:'transparent', border:'none', color:'var(--t2)', fontSize:16, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
              </div>
              {item.qty > 1 && (
                <span style={{ fontSize:11, color:'var(--t3)', fontFamily:'DM Mono,monospace' }}>£{item.price.toFixed(2)} ea</span>
              )}
              <button onClick={() => removeFromOrder(item.uid)} style={{ marginLeft:'auto', fontSize:11, color:'var(--red)', cursor:'pointer', background:'none', border:'none', fontFamily:'inherit', opacity:.7 }}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals + actions */}
      <div style={{ flexShrink:0, borderTop:'1px solid var(--bdr)', background:'var(--bg2)' }}>
        {items.length > 0 && (
          <>
            <div style={{ padding:'12px 14px 0' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t3)', marginBottom:3 }}>
                <span>Subtotal · {itemCount} item{itemCount!==1?'s':''}</span>
                <span style={{ fontFamily:'DM Mono,monospace' }}>£{subtotal.toFixed(2)}</span>
              </div>
              {service > 0
                ? <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--t3)', marginBottom:3 }}>
                    <span>Service charge (12.5%)</span>
                    <span style={{ fontFamily:'DM Mono,monospace' }}>£{service.toFixed(2)}</span>
                  </div>
                : <div style={{ fontSize:11, color:'var(--grn)', marginBottom:3 }}>No service charge · {orderType}</div>
              }
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:20, fontWeight:800, marginTop:10, paddingTop:10, borderTop:'1px solid var(--bdr3)', marginBottom:10 }}>
                <span>Total</span>
                <span style={{ color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>£{total.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ padding:'0 14px 14px', display:'flex', gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }}
                onClick={() => { sendToKitchen(); showToast('Sent to kitchen', 'success'); }}>
                Send →
              </button>
              <button className="btn btn-acc" style={{ flex:1, height:44, fontSize:14 }}
                onClick={onPay}>
                Pay £{total.toFixed(2)}
              </button>
            </div>
          </>
        )}
        {items.length === 0 && <div style={{ height:14 }}/>}
      </div>
    </div>
  );
}
