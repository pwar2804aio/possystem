import { useState } from 'react';
import { useStore } from '../store';
import { ALLERGENS, PIZZA_TOPPINGS, PIZZA_BASES, PIZZA_CRUSTS, PIZZA_SIZES } from '../data/seed';

// ── Main product modal dispatcher ─────────────────────────────────────────────
export default function ProductModal({ item, activeAllergens = [], onConfirm, onCancel }) {
  if (!item) return null;
  if (item.type === 'pizza')      return <PizzaModal     item={item} activeAllergens={activeAllergens} onConfirm={onConfirm} onCancel={onCancel} />;
  if (item.type === 'variants')   return <VariantsModal  item={item} activeAllergens={activeAllergens} onConfirm={onConfirm} onCancel={onCancel} />;
  // Both 'modifiers' (legacy) and 'modifiable' (new auto type) show the ModifiersModal
  if (item.type === 'modifiers' || item.type === 'modifiable') return <ModifiersModal item={item} activeAllergens={activeAllergens} onConfirm={onConfirm} onCancel={onCancel} />;
  return null;
}

// ── Shared shell ──────────────────────────────────────────────────────────────
function ModalShell({ item, price, children, onAdd, canAdd, onCancel, addLabel = 'Add to order' }) {
  const flagged = (item.allergens || []).filter(a => activeAllergens.includes(a));

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:24,
        width:'100%', maxWidth:500, maxHeight:'90vh', overflow:'auto',
        boxShadow:'var(--sh3)', display:'flex', flexDirection:'column',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:19, fontWeight:700, lineHeight:1.2, marginBottom:4 }}>{item.name}</div>
              {item.description && <div style={{ fontSize:13, color:'var(--t2)', lineHeight:1.5 }}>{item.description}</div>}
            </div>
            <button onClick={onCancel} style={{ fontSize:20, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', lineHeight:1, padding:0, flexShrink:0 }}>×</button>
          </div>

          {/* Allergen flags */}
          {item.allergens?.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:10 }}>
              {item.allergens.map(a => {
                const al = ALLERGENS.find(x => x.id === a);
                const isFlagged = activeAllergens.includes(a);
                return (
                  <span key={a} style={{
                    fontSize:11, padding:'2px 7px', borderRadius:6, fontWeight:500,
                    background: isFlagged ? 'var(--red-d)' : 'var(--bg3)',
                    border: `1px solid ${isFlagged ? 'var(--red-b)' : 'var(--bdr)'}`,
                    color: isFlagged ? 'var(--red)' : 'var(--t3)',
                  }}>{al?.icon} {al?.label}</span>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>{children}</div>

        {/* Footer */}
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className="btn btn-ghost" onClick={onCancel} style={{ minWidth:80 }}>Cancel</button>
            <button
              className="btn btn-acc"
              style={{ flex:1, fontSize:15, height:48, borderRadius:12, opacity: canAdd ? 1 : 0.4 }}
              disabled={!canAdd}
              onClick={canAdd ? onAdd : undefined}
            >
              {addLabel} · <strong>£{price.toFixed(2)}</strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Need to pass activeAllergens through to ModalShell
function ModalShellWrapper({ item, price, children, onAdd, canAdd, onCancel, addLabel, activeAllergens }) {
  const flagged = (item.allergens || []).filter(a => activeAllergens.includes(a));

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:24,
        width:'100%', maxWidth:500, maxHeight:'92vh', overflow:'auto',
        boxShadow:'var(--sh3)', display:'flex', flexDirection:'column',
      }}>
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:19, fontWeight:700, lineHeight:1.2, marginBottom:4 }}>{item.name}</div>
              {item.description && <div style={{ fontSize:13, color:'var(--t2)', lineHeight:1.5 }}>{item.description}</div>}
            </div>
            <button onClick={onCancel} style={{ fontSize:22, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', lineHeight:1, padding:0, flexShrink:0 }}>×</button>
          </div>
          {item.allergens?.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:10 }}>
              {item.allergens.map(a => {
                const al = ALLERGENS.find(x => x.id === a);
                const isActive = activeAllergens.includes(a);
                return (
                  <span key={a} style={{
                    fontSize:11, padding:'2px 7px', borderRadius:6, fontWeight:500,
                    background: isActive ? 'var(--red-d)' : 'var(--bg3)',
                    border: `1px solid ${isActive ? 'var(--red-b)' : 'var(--bdr)'}`,
                    color: isActive ? 'var(--red)' : 'var(--t3)',
                  }}>{al?.icon} {al?.label}</span>
                );
              })}
            </div>
          )}
          {flagged.length > 0 && (
            <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'var(--red-d)', border:'1px solid var(--red-b)', fontSize:12, color:'var(--red)' }}>
              ⚠ Contains active guest allergen — confirm before adding
            </div>
          )}
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>{children}</div>
        <div style={{ padding:'16px 24px', borderTop:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" onClick={onCancel} style={{ minWidth:80 }}>Cancel</button>
            <button
              className="btn btn-acc"
              style={{ flex:1, fontSize:15, height:48, borderRadius:12, opacity: canAdd ? 1 : 0.4 }}
              disabled={!canAdd}
              onClick={canAdd ? onAdd : undefined}
            >
              {addLabel || 'Add to order'} · <strong>£{price.toFixed(2)}</strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Variants modal (e.g. wine sizes) ─────────────────────────────────────────
function VariantsModal({ item, activeAllergens, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const price = selected ? selected.price * qty : item.price * qty;
  const canAdd = !!selected;

  const handleAdd = () => {
    // If variant has a _childItem (linked-children system), add the child item directly
    if (selected._childItem) {
      const child = selected._childItem;
      onConfirm(child, [], null, {
        notes: notes.trim(),
        qty,
        linePrice: selected.price * qty,
        displayName: `${child.menuName || child.name}`,
      });
    } else {
      onConfirm(item, [], null, {
        variant: selected,
        notes: notes.trim(),
        qty,
        linePrice: price,
        displayName: `${item.menuName || item.name} — ${selected.label}`,
      });
    }
  };

  return (
    <ModalShellWrapper item={item} price={price} canAdd={canAdd} onAdd={handleAdd} onCancel={onCancel} activeAllergens={activeAllergens}>
      <div className="label-xs" style={{ marginBottom:10 }}>Choose option</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
        {item.variants.map(v => (
          <button key={v.id} onClick={() => setSelected(v)} style={{
            padding:'12px 16px', borderRadius:12, cursor:'pointer', textAlign:'left',
            border:`1.5px solid ${selected?.id === v.id ? 'var(--acc)' : 'var(--bdr)'}`,
            background: selected?.id === v.id ? 'var(--acc-d)' : 'var(--bg3)',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            transition:'all .12s', fontFamily:'inherit',
          }}>
            <div style={{ fontSize:14, fontWeight:500, color: selected?.id === v.id ? 'var(--acc)' : 'var(--t1)' }}>
              {v.label}
            </div>
            <div style={{ fontSize:15, fontWeight:700, color: selected?.id === v.id ? 'var(--acc)' : 'var(--t2)' }}>
              £{v.price.toFixed(2)}
            </div>
          </button>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
        <div className="label-xs">Quantity</div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginLeft:'auto' }}>
          <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--bdr2)', background:'transparent', color:'var(--t1)', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>−</button>
          <span style={{ fontSize:18, fontWeight:600, minWidth:24, textAlign:'center' }}>{qty}</span>
          <button onClick={() => setQty(q => q+1)} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--bdr2)', background:'transparent', color:'var(--t1)', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>+</button>
        </div>
      </div>

      <div>
        <div className="label-xs" style={{ marginBottom:6 }}>Notes for kitchen (optional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. No ice" rows={2}
          style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'8px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', resize:'none', outline:'none' }}/>
      </div>
    </ModalShellWrapper>
  );
}

// ── Modifiers modal (steak cooking, cocktail base, etc.) ──────────────────────
function ModifiersModal({ item, activeAllergens, onConfirm, onCancel }) {
  const { modifierLibrary, menuItems } = useStore.getState();
  const [selections, setSelections] = useState({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  // Resolve options for a group — supports both old inline options and new modifierIds system
  const resolveOptions = (group) => {
    // New system: modifierIds array referencing subitems or library
    if (group.modifierIds?.length) {
      return group.modifierIds.map(id => {
        const subitem = menuItems.find(i => i.id === id && i.type === 'subitem');
        if (subitem) return { id: subitem.id, label: subitem.menuName || subitem.name, price: subitem.pricing?.base ?? subitem.price ?? 0 };
        const libMod = modifierLibrary.find(m => m.id === id);
        if (libMod) return { id: libMod.id, label: libMod.name, price: libMod.price || 0 };
        return null;
      }).filter(Boolean);
    }
    // Old system: inline options array
    return group.options || [];
  };

  // Determine selection type: new system uses selectionType, old uses group.multi/required
  const getSelType = (group) => group.selectionType || (group.multi ? 'multiple' : 'single');
  const isRequired = (group) => group.min > 0 || group.required;

  const toggleSingle = (groupId, opt) => setSelections(s => ({ ...s, [groupId]: s[groupId]?.id === opt.id ? null : opt }));
  const toggleMulti  = (groupId, opt) => setSelections(s => {
    const cur = s[groupId] || [];
    const has = cur.find(o => o.id === opt.id);
    const group = (item.modifierGroups || []).find(g => g.id === groupId);
    const maxSel = group?.max || 99;
    if (!has && cur.length >= maxSel) return s; // at max
    return { ...s, [groupId]: has ? cur.filter(o => o.id !== opt.id) : [...cur, opt] };
  });

  const allRequired = (item.modifierGroups || [])
    .filter(g => isRequired(g))
    .every(g => {
      const selType = getSelType(g);
      if (selType === 'single') return !!selections[g.id];
      return (selections[g.id]?.length || 0) >= (g.min || 1);
    });

  const extraCost = Object.values(selections).flat().filter(Boolean).reduce((s, m) => s + (m?.price || 0), 0);
  const basePrice = item.pricing?.base ?? item.price ?? 0;
  const price = (basePrice + extraCost) * qty;

  const buildDisplayName = () => {
    const parts = Object.values(selections).flat().filter(Boolean).map(m => m.label);
    return parts.length ? `${item.menuName || item.name} — ${parts.join(', ')}` : (item.menuName || item.name);
  };

  const handleAdd = () => {
    const mods = Object.entries(selections).flatMap(([gid, val]) => {
      if (!val) return [];
      const group = (item.modifierGroups || []).find(g => g.id === gid);
      const arr = Array.isArray(val) ? val : [val];
      return arr.filter(Boolean).map(m => ({ groupLabel: group?.label, label: m.label, price: m.price || 0 }));
    });
    onConfirm(item, mods, null, {
      notes: notes.trim(), qty, linePrice: price,
      displayName: buildDisplayName(),
    });
  };

  return (
    <ModalShellWrapper item={item} price={price} canAdd={allRequired} onAdd={handleAdd} onCancel={onCancel} activeAllergens={activeAllergens}>
      {(item.modifierGroups || []).map(group => {
        const options = resolveOptions(group);
        const selType = getSelType(group);
        const required = isRequired(group);
        const maxSel = group.max || (selType === 'single' ? 1 : 99);
        const cur = selections[group.id];
        const selectedCount = Array.isArray(cur) ? cur.length : (cur ? 1 : 0);

        return (
          <div key={group.id} style={{ marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span className="label-xs">{group.label}</span>
              {required && <span style={{ fontSize:11, color:'var(--red)', fontWeight:600 }}>Required</span>}
              {!required && <span style={{ fontSize:11, color:'var(--t4)' }}>Optional</span>}
              {selType !== 'single' && <span style={{ fontSize:11, color:'var(--t3)' }}>Pick up to {maxSel}</span>}
              {selType !== 'single' && selectedCount > 0 && <span style={{ fontSize:11, color:'var(--acc)', fontWeight:700 }}>{selectedCount} selected</span>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {options.map(opt => {
                const isSelected = selType === 'single'
                  ? cur?.id === opt.id
                  : !!(cur || []).find(o => o.id === opt.id);
                const atMax = selType !== 'single' && !isSelected && selectedCount >= maxSel;
                return (
                  <button key={opt.id}
                    onClick={() => {
                      if (atMax) return;
                      selType === 'single' ? toggleSingle(group.id, opt) : toggleMulti(group.id, opt);
                    }}
                    style={{
                      padding:'11px 14px', borderRadius:10, cursor: atMax ? 'not-allowed' : 'pointer',
                      border:`1.5px solid ${isSelected ? 'var(--acc)' : 'var(--bdr)'}`,
                      background: isSelected ? 'var(--acc-d)' : atMax ? 'var(--bg2)' : 'var(--bg3)',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      transition:'all .12s', fontFamily:'inherit', opacity: atMax ? .5 : 1,
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{
                        width:18, height:18,
                        borderRadius: selType === 'single' ? '50%' : 4,
                        border:`2px solid ${isSelected ? 'var(--acc)' : 'var(--bdr2)'}`,
                        background: isSelected ? 'var(--acc)' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                      }}>
                        {isSelected && <div style={{ width:6, height:6, borderRadius: selType === 'single' ? '50%' : 1, background:'#0e0f14' }}/>}
                      </div>
                      <span style={{ fontSize:14, fontWeight:500, color: isSelected ? 'var(--acc)' : 'var(--t1)' }}>{opt.label}</span>
                    </div>
                    {opt.price > 0 && (
                      <span style={{ fontSize:13, fontWeight:600, color: isSelected ? 'var(--acc)' : 'var(--t3)' }}>+£{opt.price.toFixed(2)}</span>
                    )}
                    {opt.price === 0 && isSelected && (
                      <span style={{ fontSize:12, color:'var(--acc)' }}>✓</span>
                    )}
                  </button>
                );
              })}
              {options.length === 0 && (
                <div style={{ fontSize:12, color:'var(--t4)', padding:'8px 12px', background:'var(--bg3)', borderRadius:8 }}>
                  No options configured — add sub items to this modifier group in the Menu Manager
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ display:'flex', alignItems:'center', gap:16, paddingTop:4, marginBottom:16 }}>
        <div className="label-xs">Quantity</div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginLeft:'auto' }}>
          <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--bdr2)', background:'transparent', color:'var(--t1)', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>−</button>
          <span style={{ fontSize:18, fontWeight:600, minWidth:24, textAlign:'center' }}>{qty}</span>
          <button onClick={() => setQty(q => q+1)} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--bdr2)', background:'transparent', color:'var(--t1)', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>+</button>
        </div>
      </div>

      <div>
        <div className="label-xs" style={{ marginBottom:6 }}>Notes (optional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Allergy note, special request..." rows={2}
          style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'8px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', resize:'none', outline:'none' }}/>
      </div>
    </ModalShellWrapper>
  );
}

// ── Pizza modal (half & half builder) ─────────────────────────────────────────
function PizzaModal({ item, activeAllergens, onConfirm, onCancel }) {
  const [size,  setSize]  = useState(PIZZA_SIZES[1]);
  const [base,  setBase]  = useState(PIZZA_BASES[0]);
  const [crust, setCrust] = useState(PIZZA_CRUSTS[0]);
  const [split, setSplit] = useState('whole');
  const [side,  setSide]  = useState('whole');
  const [left,  setLeft]  = useState(item.defaultToppings ? PIZZA_TOPPINGS.filter(t => (item.defaultToppings||[]).includes(t.id)) : []);
  const [right, setRight] = useState([]);
  const [notes, setNotes] = useState('');

  const toppingCost =
    left.filter(t => !right.find(r => r.id === t.id)).reduce((s,t) => s + t.price * .5, 0) +
    right.filter(t => !left.find(l => l.id === t.id)).reduce((s,t) => s + t.price * .5, 0) +
    left.filter(t =>  right.find(r => r.id === t.id)).reduce((s,t) => s + t.price, 0);
  const total = size.basePrice + (crust.extra || 0) + toppingCost;

  const toggleTop = (top) => {
    if (split === 'whole') {
      const inL = !!left.find(t => t.id === top.id);
      if (inL) { setLeft(l => l.filter(t => t.id !== top.id)); setRight(r => r.filter(t => t.id !== top.id)); }
      else      { setLeft(l => [...l, top]); setRight(r => [...r, top]); }
    } else if (side === 'left') {
      setLeft(l => l.find(t => t.id === top.id) ? l.filter(t => t.id !== top.id) : [...l, top]);
    } else {
      setRight(r => r.find(t => t.id === top.id) ? r.filter(t => t.id !== top.id) : [...r, top]);
    }
  };

  const toppingState = (top) => {
    const inL = !!left.find(t => t.id === top.id);
    const inR = !!right.find(t => t.id === top.id);
    if (inL && inR) return 'both';
    if (inL)        return 'left';
    if (inR)        return 'right';
    return 'off';
  };

  const SC = { left:'#3b82f6', right:'#22c55e', both:'#a855f7', whole:'#f0a500' };

  const handleAdd = () => {
    const cfg = { size, base, crust, split, toppings:{ left, right } };
    const allTops = split==='whole' ? left : [...new Map([...left,...right].map(t=>[t.id,t])).values()];
    const topAllergens = allTops.flatMap(t => t.allergens || []);
    const allAllergens = [...new Set([...(item.allergens||[]), ...(base.allergens||[]), ...(crust.allergens||[]), ...topAllergens])];
    const displayName = split==='whole'
      ? `${item.name} — ${size.name}`
      : `${item.name} — Half & half (${size.name})`;
    const modsArr = [];
    if (split==='half') {
      if (left.length)  modsArr.push({ label: `Left: ${left.map(t=>t.name).join(', ')}` });
      if (right.length) modsArr.push({ label: `Right: ${right.map(t=>t.name).join(', ')}` });
    } else {
      if (left.length) modsArr.push({ label: left.map(t=>t.name).join(', ') });
    }
    modsArr.push({ label: `${base.name} base · ${crust.name}` });
    if (notes.trim()) modsArr.push({ label: notes.trim() });
    onConfirm({ ...item, allergens: allAllergens, price: total }, modsArr, cfg, { displayName, qty: 1, linePrice: total, notes });
  };

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:24, width:'100%', maxWidth:620, maxHeight:'92vh', overflow:'auto', boxShadow:'var(--sh3)' }}>
        {/* Header */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:18, fontWeight:700 }}>{item.name}</div>
          <button onClick={onCancel} style={{ fontSize:22, color:'var(--t3)', background:'none', border:'none', cursor:'pointer' }}>×</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 188px' }}>
          {/* Builder */}
          <div style={{ padding:'18px 20px', borderRight:'1px solid var(--bdr)', overflowY:'auto', maxHeight:'70vh' }}>

            {/* Size */}
            <div style={{ marginBottom:16 }}>
              <div className="label-xs" style={{ marginBottom:8 }}>Size</div>
              <div style={{ display:'flex', gap:6 }}>
                {PIZZA_SIZES.map(s => (
                  <button key={s.id} onClick={() => setSize(s)} style={{
                    flex:1, padding:'9px 6px', borderRadius:9, cursor:'pointer', textAlign:'center',
                    border:`1.5px solid ${size.id===s.id?'var(--acc)':'var(--bdr)'}`,
                    background:size.id===s.id?'var(--acc-d)':'var(--bg3)', transition:'all .12s', fontFamily:'inherit',
                  }}>
                    <div style={{ fontSize:12, fontWeight:500, color:size.id===s.id?'var(--acc)':'var(--t1)' }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'var(--t3)' }}>£{s.basePrice}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Base */}
            <div style={{ marginBottom:16 }}>
              <div className="label-xs" style={{ marginBottom:8 }}>Base</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {PIZZA_BASES.map(b => (
                  <button key={b.id} onClick={() => setBase(b)} style={{
                    padding:'6px 11px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:500,
                    border:`1.5px solid ${base.id===b.id?'var(--acc)':'var(--bdr)'}`,
                    background:base.id===b.id?'var(--acc-d)':'var(--bg3)',
                    color:base.id===b.id?'var(--acc)':'var(--t2)', fontFamily:'inherit',
                  }}>{b.name}</button>
                ))}
              </div>
            </div>

            {/* Crust */}
            <div style={{ marginBottom:16 }}>
              <div className="label-xs" style={{ marginBottom:8 }}>Crust</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {PIZZA_CRUSTS.map(c => (
                  <button key={c.id} onClick={() => setCrust(c)} style={{
                    padding:'6px 11px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:500,
                    border:`1.5px solid ${crust.id===c.id?'var(--acc)':'var(--bdr)'}`,
                    background:crust.id===c.id?'var(--acc-d)':'var(--bg3)',
                    color:crust.id===c.id?'var(--acc)':'var(--t2)', fontFamily:'inherit',
                  }}>{c.name}{c.extra?` +£${c.extra}`:''}</button>
                ))}
              </div>
            </div>

            {/* Split */}
            <div style={{ marginBottom:16 }}>
              <div className="label-xs" style={{ marginBottom:8 }}>Style</div>
              <div style={{ display:'flex', border:'1px solid var(--bdr)', borderRadius:9, overflow:'hidden' }}>
                {[['whole','Whole pizza'],['half','Half & half']].map(([v,l]) => (
                  <button key={v} onClick={() => { setSplit(v); setSide(v==='whole'?'whole':'left'); }} style={{
                    flex:1, padding:'8px', cursor:'pointer', fontSize:12, fontWeight:600,
                    background:split===v?'var(--acc)':'transparent',
                    color:split===v?'#0e0f14':'var(--t3)',
                    border:'none', fontFamily:'inherit', transition:'all .15s',
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* Half selector */}
            {split === 'half' && (
              <div style={{ marginBottom:16 }}>
                <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                  {['left','right'].map(s => {
                    const count = (s==='left'?left:right).length;
                    const col = SC[s];
                    return (
                      <button key={s} onClick={() => setSide(s)} style={{
                        flex:1, padding:'9px 8px', borderRadius:9, cursor:'pointer', textAlign:'center',
                        border:`1.5px solid ${side===s?col:'var(--bdr)'}`,
                        background:side===s?(s==='left'?'rgba(59,130,246,.1)':'rgba(34,197,94,.1)'):'var(--bg3)',
                        fontFamily:'inherit',
                      }}>
                        <div style={{ fontSize:12, fontWeight:600, color:side===s?col:'var(--t2)' }}>{s==='left'?'Left':'Right'} half</div>
                        <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>{count} topping{count!==1?'s':''}</div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding:'6px 10px', borderRadius:7, fontSize:12, background:side==='left'?'rgba(59,130,246,.08)':'rgba(34,197,94,.08)', color:side==='left'?SC.left:SC.right }}>
                  Tapping toppings adds to <strong>{side}</strong> half
                </div>
              </div>
            )}

            {/* Toppings */}
            <div className="label-xs" style={{ marginBottom:8 }}>Toppings</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
              {PIZZA_TOPPINGS.map(top => {
                const st = toppingState(top);
                const col = SC[st] || SC.whole;
                const active = st !== 'off';
                return (
                  <button key={top.id} onClick={() => toggleTop(top)} style={{
                    padding:'8px 5px', borderRadius:8, cursor:'pointer', textAlign:'center',
                    border:`1.5px solid ${active?col+'88':'var(--bdr)'}`,
                    background:active?col+'14':'var(--bg3)', transition:'all .12s', fontFamily:'inherit',
                  }}>
                    <div style={{ width:9, height:9, borderRadius:'50%', background:top.color, margin:'0 auto 4px' }}/>
                    <div style={{ fontSize:10, fontWeight:500, color:active?col:'var(--t2)', lineHeight:1.2 }}>{top.name}</div>
                    {top.price>0&&<div style={{ fontSize:9, color:'var(--t3)' }}>+£{top.price}</div>}
                    {active&&st!=='both'&&st!=='whole'&&<div style={{ fontSize:9, fontWeight:700, color:col, textTransform:'uppercase' }}>{st}</div>}
                    {st==='both'&&<div style={{ fontSize:9, fontWeight:700, color:col }}>both</div>}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop:14 }}>
              <div className="label-xs" style={{ marginBottom:6 }}>Notes</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Extra crispy, well done, etc." rows={2}
                style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'8px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', resize:'none', outline:'none' }}/>
            </div>
          </div>

          {/* Summary panel */}
          <div style={{ padding:'18px 16px', display:'flex', flexDirection:'column' }}>
            <div className="label-xs" style={{ marginBottom:10 }}>Your pizza</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginBottom:4 }}>{size.name} · {crust.name}</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12 }}>{base.name} base</div>

            {split==='half' ? (
              <>
                <div style={{ background:'rgba(59,130,246,.08)', borderRadius:8, padding:'8px 10px', marginBottom:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:SC.left, marginBottom:4 }}>LEFT HALF</div>
                  {left.length ? left.map(t=><div key={t.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--t2)',marginBottom:2}}><div style={{width:7,height:7,borderRadius:'50%',background:t.color}}/>{t.name}</div>) : <div style={{fontSize:11,color:'var(--t3)',fontStyle:'italic'}}>No toppings</div>}
                </div>
                <div style={{ background:'rgba(34,197,94,.08)', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:SC.right, marginBottom:4 }}>RIGHT HALF</div>
                  {right.length ? right.map(t=><div key={t.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--t2)',marginBottom:2}}><div style={{width:7,height:7,borderRadius:'50%',background:t.color}}/>{t.name}</div>) : <div style={{fontSize:11,color:'var(--t3)',fontStyle:'italic'}}>No toppings</div>}
                </div>
              </>
            ) : (
              <div style={{ background:'rgba(240,165,0,.08)', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--acc)', marginBottom:4 }}>WHOLE PIZZA</div>
                {left.length ? left.map(t=><div key={t.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--t2)',marginBottom:2}}><div style={{width:7,height:7,borderRadius:'50%',background:t.color}}/>{t.name}</div>) : <div style={{fontSize:11,color:'var(--t3)',fontStyle:'italic'}}>Cheese only</div>}
              </div>
            )}

            <div style={{ borderTop:'1px solid var(--bdr)', paddingTop:10, marginTop:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', marginBottom:2 }}><span>Base</span><span>£{size.basePrice.toFixed(2)}</span></div>
              {crust.extra>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', marginBottom:2 }}><span>Crust</span><span>+£{crust.extra.toFixed(2)}</span></div>}
              {toppingCost>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', marginBottom:2 }}><span>Toppings</span><span>+£{toppingCost.toFixed(2)}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:700, marginTop:6, color:'var(--acc)' }}><span>Total</span><span>£{total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid var(--bdr)' }}>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" onClick={onCancel} style={{ minWidth:80 }}>Cancel</button>
            <button className="btn btn-acc" onClick={handleAdd} style={{ flex:1, height:46, fontSize:15, borderRadius:12 }}>
              Add pizza · <strong>£{total.toFixed(2)}</strong>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Allergen warning modal ────────────────────────────────────────────────────
export function AllergenModal({ item, activeAllergens, onConfirm, onCancel }) {
  const flagged = (item.allergens || []).filter(a => activeAllergens.includes(a));
  return (
    <div className="modal-back">
      <div className="modal-box" style={{ maxWidth:380 }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:'var(--red-d)', border:'2px solid var(--red-b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, margin:'0 auto 16px' }}>⚠</div>
        <div style={{ fontSize:18, fontWeight:600, textAlign:'center', marginBottom:4 }}>Allergen warning</div>
        <div style={{ fontSize:13, color:'var(--t2)', textAlign:'center', marginBottom:20 }}>This item contains an active guest allergen filter</div>
        <div style={{ fontSize:15, fontWeight:500, marginBottom:10 }}>{item.name}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:16 }}>
          {flagged.map(a => {
            const al = ALLERGENS.find(x => x.id === a);
            return <span key={a} style={{ padding:'3px 9px', borderRadius:20, fontSize:12, fontWeight:600, background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)' }}>{al?.icon} {al?.label}</span>;
          })}
        </div>
        <div style={{ background:'var(--red-d)', border:'1px solid var(--red-b)', borderRadius:10, padding:'10px 14px', marginBottom:20, fontSize:12, color:'var(--red)', lineHeight:1.6 }}>
          Confirming adds this item and creates an allergen audit record. Ensure the guest has been informed.
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onCancel}>Remove item</button>
          <button className="btn btn-red" style={{ flex:1 }} onClick={onConfirm}>Confirm — add anyway</button>
        </div>
      </div>
    </div>
  );
}
