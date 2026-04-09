import { useState } from 'react';
import { useStore } from '../store';
import { CATEGORIES, MENU_ITEMS, ALLERGENS, QUICK_IDS, getDaypart } from '../data/seed';
import { AllergenModal, ModifierModal } from '../components/Modals';
import PizzaBuilder from '../components/PizzaBuilder';
import { PaymentScreen } from './OtherSurfaces';

export default function POSSurface() {
  const { staff, allergens, toggleAllergen, clearAllergens, order, addToOrder,
          removeFromOrder, updateQty, sendToKitchen, clearOrder, getOrderTotals,
          tableId, showToast, pendingItem, setPendingItem, clearPendingItem } = useStore();

  const [cat, setCat] = useState('quick');
  const [modItem, setModItem] = useState(null);
  const [pizzaItem, setPizzaItem] = useState(null);
  const [showPay, setShowPay] = useState(false);

  const daypart = getDaypart();
  const displayItems = cat === 'quick'
    ? QUICK_IDS.map(id => MENU_ITEMS.find(i => i.id === id)).filter(Boolean)
    : MENU_ITEMS.filter(i => i.cat === cat);

  const heatRank = (id) => QUICK_IDS.indexOf(id);

  const handleItemTap = (item) => {
    const flagged = allergens.some(a => item.allergens?.includes(a));
    if (flagged) { setPendingItem(item); return; }
    if (item.isPizza) { setPizzaItem(item); return; }
    if (item.mods) { setModItem(item); return; }
    addToOrder(item);
    showToast(`${item.name} added`, 'success');
  };

  const handleAllergenConfirm = () => {
    const item = pendingItem;
    clearPendingItem();
    if (item.isPizza) { setPizzaItem(item); return; }
    if (item.mods) { setModItem(item); return; }
    addToOrder(item);
    showToast(`${item.name} added — allergen confirmed`, 'warning');
  };

  const { subtotal, service, total } = getOrderTotals();
  const items = order?.items || [];

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>

      {/* ── Menu area ─────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Header */}
        <div style={{
          height:52, display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 20px', borderBottom:'1px solid var(--bdr)', background:'var(--c-surf)', flexShrink:0,
        }}>
          <div>
            <div style={{ fontSize:15, fontWeight:600 }}>
              {tableId ? `Table ${tableId.replace(/^t/,'').toUpperCase()}` : 'Walk-in order'}
            </div>
            <div style={{ fontSize:11, color:'var(--c-text3)', marginTop:1 }}>
              {cat === 'quick' ? `Quick screen · ${daypart}` : CATEGORIES.find(c=>c.id===cat)?.label}
            </div>
          </div>
          {allergens.length > 0 && (
            <button onClick={clearAllergens} className="badge badge-red" style={{ cursor:'pointer', fontWeight:600 }}>
              ⚠ {allergens.length} allergen{allergens.length>1?'s':''} active · clear
            </button>
          )}
        </div>

        {/* Allergen filter bar */}
        <div style={{
          display:'flex', gap:5, padding:'8px 16px', overflowX:'auto',
          borderBottom:'1px solid var(--bdr)', background:'var(--c-surf)', flexShrink:0,
        }}>
          {ALLERGENS.map(a => {
            const on = allergens.includes(a.id);
            return (
              <button key={a.id} onClick={() => toggleAllergen(a.id)} style={{
                display:'inline-flex', alignItems:'center', gap:4,
                padding:'3px 9px', borderRadius:20, whiteSpace:'nowrap',
                fontSize:11, fontWeight:500, cursor:'pointer', transition:'all .12s',
                border:`1px solid ${on?'var(--c-red-bdr)':'var(--bdr)'}`,
                background: on?'var(--c-red-dim)':'transparent',
                color: on?'var(--c-red)':'var(--c-text3)',
                fontFamily:'inherit',
              }}>
                <span style={{
                  width:15, height:15, borderRadius:4, flexShrink:0,
                  background: on?'var(--c-red)':'var(--c-raised)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:8, fontWeight:700, color: on?'#fff':'var(--c-text3)',
                }}>{a.icon}</span>
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Category nav */}
        <div style={{
          display:'flex', gap:4, padding:'10px 16px 0', overflowX:'auto',
          borderBottom:'1px solid var(--bdr)', flexShrink:0,
        }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500,
              whiteSpace:'nowrap', cursor:'pointer', marginBottom:10, transition:'all .12s',
              border:'1px solid transparent', fontFamily:'inherit',
              background: cat===c.id?'var(--c-acc)':'transparent',
              color: cat===c.id?'var(--c-inverse)':cat===c.id?'inherit':'var(--c-text3)',
            }}>{c.label}</button>
          ))}
        </div>

        {/* Item grid */}
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {cat === 'quick' && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--c-text2)' }}>AI-curated · {daypart}</div>
              <div className="badge badge-acc">Updated nightly</div>
            </div>
          )}
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))',
            gap:8,
          }}>
            {displayItems.map(item => {
              const flagged   = allergens.some(a => item.allergens?.includes(a));
              const mayContain = allergens.some(a => (item.may_contain||[]).includes(a));
              const rank       = heatRank(item.id);
              const heatColor  = rank === -1 ? null : rank < 3 ? 'var(--c-red)' : rank < 6 ? 'var(--c-acc)' : 'var(--c-grn)';
              return (
                <button key={item.id} onClick={() => handleItemTap(item)} style={{
                  display:'block', padding:'12px 10px', textAlign:'left',
                  background: flagged?'var(--c-red-dim)': mayContain?'var(--c-acc-dim)':'var(--c-raised)',
                  border:`1px solid ${flagged?'var(--c-red-bdr)':mayContain?'var(--c-acc-bdr)':'var(--bdr)'}`,
                  borderRadius:var_rl, cursor:'pointer', position:'relative',
                  transition:'all .12s', fontFamily:'inherit',
                }}>
                  {heatColor && cat==='quick' && (
                    <div style={{ position:'absolute', top:8, right:8, width:6, height:6, borderRadius:'50%', background:heatColor }}/>
                  )}
                  {flagged && (
                    <div style={{ position:'absolute', top:8, right:8, fontSize:12 }}>⚠</div>
                  )}
                  <div style={{ fontSize:12, fontWeight:500, lineHeight:1.3, marginBottom:6, color: flagged?'var(--c-red)':'var(--c-text)' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--c-acc)' }}>
                    £{item.price.toFixed(2)}
                  </div>
                  {cat==='quick'&&rank>=0&&(
                    <div style={{ fontSize:10, color:'var(--c-text3)', marginTop:3 }}>{item.sales} sold</div>
                  )}
                  {item.isPizza && (
                    <div style={{ fontSize:10, color:'var(--c-pur)', marginTop:3 }}>🍕 builder</div>
                  )}
                  {flagged&&allergens.length>0&&(
                    <div style={{ fontSize:10, color:'var(--c-red)', marginTop:4, lineHeight:1.4 }}>
                      {item.allergens.filter(a=>allergens.includes(a)).map(a=>ALLERGENS.find(x=>x.id===a)?.short).join(' · ')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Order panel ───────────────────────────────────────────────── */}
      <div style={{
        width: 'var(--order-w)', background:'var(--c-surf)',
        borderLeft:'1px solid var(--bdr)', display:'flex', flexDirection:'column', flexShrink:0,
      }}>
        {/* Order header */}
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>
              {tableId ? `Table ${tableId.replace(/^t/,'').toUpperCase()}` : 'Order'}
            </div>
            <div style={{ fontSize:11, color:'var(--c-text3)', marginTop:1 }}>{staff?.name}</div>
          </div>
          {items.length>0 && (
            <button onClick={clearOrder} style={{ fontSize:11, color:'var(--c-text3)', cursor:'pointer', background:'none', border:'none', fontFamily:'inherit' }}>
              Clear all
            </button>
          )}
        </div>

        {/* Order items */}
        <div style={{ flex:1, overflowY:'auto', padding:12 }}>
          {items.length === 0 && (
            <div style={{ textAlign:'center', color:'var(--c-text3)', padding:'48px 0', fontSize:13 }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🍽</div>
              Tap menu items to add
            </div>
          )}
          {items.map(item => (
            <div key={item.uid} style={{
              background:'var(--c-raised)', border:'1px solid var(--bdr)',
              borderRadius:10, padding:10, marginBottom:6,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:item.mods?.length||item.allergens?.length?6:0 }}>
                <div style={{ fontSize:13, fontWeight:500, lineHeight:1.3, flex:1 }}>{item.name}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--c-acc)', whiteSpace:'nowrap' }}>
                  £{(item.price * item.qty).toFixed(2)}
                </div>
              </div>
              {item.mods?.length > 0 && (
                <div style={{ fontSize:11, color:'var(--c-text3)', marginBottom:4 }}>
                  {item.mods.map(m=>m.label).join(' · ')}
                </div>
              )}
              {item.allergens?.length > 0 && (
                <div style={{ fontSize:10, color:'var(--c-red)', marginBottom:6 }}>
                  ⚠ {item.allergens.map(a=>ALLERGENS.find(x=>x.id===a)?.short).join(' · ')}
                </div>
              )}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => updateQty(item.uid, -1)} style={{
                    width:24, height:24, borderRadius:'50%', border:'1px solid var(--bdr2)',
                    background:'transparent', color:'var(--c-text2)', fontSize:16,
                    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                  }}>−</button>
                  <span style={{ fontSize:13, fontWeight:600, minWidth:16, textAlign:'center' }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.uid, 1)} style={{
                    width:24, height:24, borderRadius:'50%', border:'1px solid var(--bdr2)',
                    background:'transparent', color:'var(--c-text2)', fontSize:16,
                    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                  }}>+</button>
                </div>
                <button onClick={() => removeFromOrder(item.uid)} style={{
                  marginLeft:'auto', fontSize:11, color:'var(--c-red)', cursor:'pointer',
                  background:'none', border:'none', fontFamily:'inherit',
                }}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        {/* Order footer */}
        {items.length > 0 && (
          <div style={{ padding:12, borderTop:'1px solid var(--bdr)' }}>
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--c-text3)', marginBottom:3 }}>
                <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--c-text3)', marginBottom:3 }}>
                <span>Service (12.5%)</span><span>£{service.toFixed(2)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:17, fontWeight:700, marginTop:8, paddingTop:8, borderTop:'1px solid var(--bdr)' }}>
                <span>Total</span><span style={{ color:'var(--c-acc)' }}>£{total.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { sendToKitchen(); showToast('Sent to kitchen','success'); }}>
                Send →
              </button>
              <button className="btn btn-acc" style={{ flex:1 }} onClick={() => setShowPay(true)}>
                Pay
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {pendingItem && (
        <AllergenModal
          item={pendingItem} activeAllergens={allergens}
          onConfirm={handleAllergenConfirm}
          onCancel={clearPendingItem}
        />
      )}
      {modItem && (
        <ModifierModal
          item={modItem}
          onConfirm={(mods) => { addToOrder(modItem, mods); setModItem(null); showToast(`${modItem.name} added`,'success'); }}
          onCancel={() => setModItem(null)}
        />
      )}
      {pizzaItem && (
        <PizzaBuilder
          item={pizzaItem}
          onConfirm={(item, mods, cfg) => { addToOrder(item, mods, cfg); setPizzaItem(null); showToast('Pizza added','success'); }}
          onCancel={() => setPizzaItem(null)}
        />
      )}
      {showPay && (
        <PaymentScreen
          subtotal={subtotal} service={service} total={total} items={items}
          onClose={() => setShowPay(false)}
          onComplete={() => { setShowPay(false); clearOrder(); showToast('Payment complete','success'); }}
        />
      )}
    </div>
  );
}

// CSS variable helper for inline styles
const var_rl = 'var(--r-lg)';
