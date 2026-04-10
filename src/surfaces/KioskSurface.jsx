import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { CATEGORIES, MENU_ITEMS as SEED_ITEMS, CAT_META, ALLERGENS } from '../data/seed';

export default function KioskSurface() {
  const { eightySixIds, addItem, getPOSItems, getPOSTotals, clearWalkIn, sendToKitchen, showToast, menuItems: storeItems } = useStore();
  const MENU_ITEMS = storeItems || SEED_ITEMS;

  const [cat, setCat]         = useState('quick');
  const [search, setSearch]   = useState('');
  const [orderType, setOrderType] = useState('dine-in');
  const [step, setStep]       = useState('browse'); // browse | review | confirm | done
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedMods, setSelectedMods] = useState({});

  const items = getPOSItems();
  const totals = getPOSTotals();

  const displayItems = useMemo(() => {
    const available = MENU_ITEMS.filter(i => !eightySixIds.includes(i.id) && !i.archived);
    if (search) return available.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    if (cat === 'quick') return available.slice(0, 16);
    return available.filter(i => i.cat === cat);
  }, [cat, search, MENU_ITEMS, eightySixIds]);

  const cats = CATEGORIES.filter(c => !c.isSpecial);

  const handleAdd = (item) => {
    if (item.modifierGroups?.length) {
      setSelectedItem(item); setSelectedMods({});
    } else {
      addItem(item);
      showToast(`${item.name} added`, 'success');
    }
  };

  const confirmMods = () => {
    if (!selectedItem) return;
    const requiredGroups = selectedItem.modifierGroups?.filter(g => g.required) || [];
    const missing = requiredGroups.find(g => !selectedMods[g.id]);
    if (missing) { showToast(`Please select ${missing.label}`, 'error'); return; }
    addItem(selectedItem, selectedMods);
    setSelectedItem(null); setSelectedMods({});
    showToast(`${selectedItem.name} added`, 'success');
  };

  const handleOrder = () => {
    if (items.length === 0) return;
    sendToKitchen(null, `Kiosk — ${orderType}`);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'var(--bg)', gap:16 }}>
        <div style={{ fontSize:72 }}>✅</div>
        <div style={{ fontSize:28, fontWeight:800, color:'var(--t1)' }}>Order placed!</div>
        <div style={{ fontSize:16, color:'var(--t3)', textAlign:'center', maxWidth:320 }}>
          Your order has been sent to the kitchen. We'll bring it to you shortly.
        </div>
        <div style={{ fontSize:32, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)', marginTop:8 }}>
          #{Math.floor(Math.random()*100)+1}
        </div>
        <div style={{ fontSize:13, color:'var(--t4)' }}>Order number</div>
        <button onClick={() => { clearWalkIn(); setStep('browse'); }} style={{
          marginTop:24, padding:'14px 40px', borderRadius:14, cursor:'pointer',
          fontFamily:'inherit', background:'var(--acc)', border:'none',
          color:'#0b0c10', fontSize:16, fontWeight:800,
        }}>Start new order</button>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Left: menu browser ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px 0', background:'var(--bg1)', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
            <div style={{ fontSize:22, fontWeight:900, color:'var(--acc)', letterSpacing:'-.02em' }}>R</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>Order here</div>
              <div style={{ fontSize:12, color:'var(--t3)' }}>Browse our menu and add items to your order</div>
            </div>
            {/* Order type */}
            <div style={{ display:'flex', gap:6 }}>
              {[['dine-in','🍽 Dine in'], ['takeaway','🥡 Takeaway']].map(([t, l]) => (
                <button key={t} onClick={()=>setOrderType(t)} style={{
                  padding:'8px 16px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                  background: orderType===t?'var(--acc-d)':'var(--bg3)',
                  border:`1.5px solid ${orderType===t?'var(--acc-b)':'var(--bdr)'}`,
                  color: orderType===t?'var(--acc)':'var(--t3)', fontSize:13, fontWeight:700,
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div style={{ position:'relative', marginBottom:14 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:16 }}>🔍</span>
            <input style={{ width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:12, padding:'10px 12px 10px 38px', color:'var(--t1)', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              placeholder="Search menu…" value={search} onChange={e=>{setSearch(e.target.value);if(e.target.value)setCat('');}}/>
          </div>

          {/* Category tabs */}
          {!search && (
            <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:12 }}>
              {[{id:'quick',label:'Popular',icon:'⭐'},...cats].map(c => {
                const m = CAT_META[c.id]||{};
                const active = cat===c.id;
                return (
                  <button key={c.id} onClick={()=>setCat(c.id)} style={{
                    padding:'8px 16px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
                    background: active?'var(--acc)':'var(--bg3)',
                    border:`1px solid ${active?'var(--acc)':'var(--bdr)'}`,
                    color: active?'#0b0c10':'var(--t2)', fontSize:13, fontWeight: active?700:400, flexShrink:0,
                  }}>{m.icon||c.icon} {c.label}</button>
                );
              })}
            </div>
          )}
        </div>

        {/* Items grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:14 }}>
            {displayItems.map(item => {
              const fromPrice = item.type==='variants' ? Math.min(...item.variants.map(v=>v.price)) : item.price;
              const hasOpts = item.modifierGroups?.length > 0;
              return (
                <button key={item.id} onClick={()=>handleAdd(item)} style={{
                  padding:'16px', borderRadius:14, cursor:'pointer', fontFamily:'inherit',
                  background:'var(--bg1)', border:'1.5px solid var(--bdr)',
                  textAlign:'left', transition:'all .15s',
                }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--acc-b)';e.currentTarget.style.background='var(--acc-d)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr)';e.currentTarget.style.background='var(--bg1)';}}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:5, lineHeight:1.3 }}>{item.name}</div>
                  <div style={{ fontSize:11, color:'var(--t4)', marginBottom:10, lineHeight:1.4, minHeight:32, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{item.description}</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:15, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>
                      {item.type==='variants'?`from £${fromPrice.toFixed(2)}`:`£${fromPrice.toFixed(2)}`}
                    </span>
                    {hasOpts && <span style={{ fontSize:10, color:'var(--t4)' }}>▾ choices</span>}
                  </div>
                </button>
              );
            })}
          </div>
          {displayItems.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 0', color:'var(--t3)' }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:.3 }}>🔍</div>
              <div style={{ fontSize:15, fontWeight:600 }}>No items found</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: cart ── */}
      <div style={{ width:340, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>Your order</div>
          {items.length > 0 && <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>{items.length} item{items.length!==1?'s':''}</div>}
        </div>

        {items.length === 0 ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--t4)' }}>
            <div style={{ fontSize:36, opacity:.3 }}>🛒</div>
            <div style={{ fontSize:13 }}>Your cart is empty</div>
          </div>
        ) : (
          <>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
              {items.map(item => (
                <div key={item.uid} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'10px 0', borderBottom:'1px solid var(--bdr)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{item.qty > 1 && <span style={{ color:'var(--acc)', marginRight:4 }}>{item.qty}×</span>}{item.name}</div>
                    {item.mods && Object.values(item.mods).flat().map((m,i) => (
                      <div key={i} style={{ fontSize:11, color:'var(--t4)', marginTop:1 }}>+ {m}</div>
                    ))}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--acc)', fontFamily:'var(--font-mono)', marginLeft:10 }}>£{((item.price||0)*item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ padding:'16px 20px', borderTop:'1px solid var(--bdr)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12, color:'var(--t3)' }}>
                <span>Subtotal</span><span style={{ fontFamily:'var(--font-mono)' }}>£{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.discountTotal > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12, color:'var(--grn)' }}>
                  <span>Discount</span><span style={{ fontFamily:'var(--font-mono)' }}>−£{totals.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16, fontSize:16, fontWeight:800, color:'var(--t1)' }}>
                <span>Total</span><span style={{ fontFamily:'var(--font-mono)', color:'var(--acc)' }}>£{totals.total.toFixed(2)}</span>
              </div>
              <button onClick={handleOrder} style={{
                width:'100%', padding:'14px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:15, fontWeight:800,
              }}>Place order →</button>
              <div style={{ textAlign:'center', marginTop:8, fontSize:11, color:'var(--t4)' }}>
                Payment at the counter
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modifier picker modal ── */}
      {selectedItem && (
        <div className="modal-back" onClick={e=>e.target===e.currentTarget&&setSelectedItem(null)}>
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:440, maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'var(--sh3)' }}>
            <div style={{ padding:'20px 22px 16px', borderBottom:'1px solid var(--bdr)' }}>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>{selectedItem.name}</div>
              <div style={{ fontSize:13, color:'var(--t3)' }}>{selectedItem.description}</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 22px' }}>
              {(selectedItem.modifierGroups||[]).map(g => (
                <div key={g.id} style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'var(--t1)' }}>{g.label}</span>
                    {g.required && <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, background:'var(--acc-d)', border:'1px solid var(--acc-b)', color:'var(--acc)' }}>REQUIRED</span>}
                    {!g.required && <span style={{ fontSize:10, color:'var(--t4)' }}>Optional</span>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {g.options.map(opt => {
                      const sel = g.multi
                        ? (selectedMods[g.id]||[]).includes(opt.label)
                        : selectedMods[g.id] === opt.label;
                      return (
                        <button key={opt.id} onClick={()=>{
                          if (g.multi) {
                            const cur = selectedMods[g.id]||[];
                            setSelectedMods({...selectedMods,[g.id]:sel?cur.filter(x=>x!==opt.label):[...cur,opt.label]});
                          } else {
                            setSelectedMods({...selectedMods,[g.id]:opt.label});
                          }
                        }} style={{
                          padding:'10px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                          textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center',
                          background: sel?'var(--acc-d)':'var(--bg3)',
                          border:`1.5px solid ${sel?'var(--acc)':'var(--bdr)'}`,
                          transition:'all .1s',
                        }}>
                          <span style={{ fontSize:13, fontWeight: sel?700:400, color:sel?'var(--acc)':'var(--t1)' }}>{opt.label}</span>
                          <span style={{ fontSize:12, color:sel?'var(--acc)':'var(--t3)', fontFamily:'var(--font-mono)' }}>
                            {opt.price>0?`+£${opt.price.toFixed(2)}`:''}
                            {sel&&<span style={{ marginLeft:6 }}>✓</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setSelectedItem(null)}>Cancel</button>
              <button className="btn btn-acc" style={{ flex:2, height:44 }} onClick={confirmMods}>Add to order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
