import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { ALLERGENS } from '../data/seed';

// ══════════════════════════════════════════════════════════════════════════════
// InlineItemFlow — replaces ProductModal for POS
// Shows variants as big tap-buttons in the center panel, then modifiers below
// Animates between steps with a slide transition
// ══════════════════════════════════════════════════════════════════════════════

export default function InlineItemFlow({ item, menuItems, activeAllergens = [], onConfirm, onCancel }) {
  const { modifierGroupDefs, instructionGroupDefs } = useStore.getState();

  // ── Resolve variant children from menuItems ──────────────────────────────
  const variantChildren = useMemo(() =>
    (menuItems || []).filter(v => v.parentId === item.id && !v.archived),
    [item.id, menuItems]
  );
  const isVariant = item.type === 'variants' || variantChildren.length > 0;

  // ── Modifier groups resolution ────────────────────────────────────────────
  const buildModGroups = (targetItem) => {
    const all = [];
    if (targetItem?.assignedModifierGroups?.length) {
      targetItem.assignedModifierGroups.forEach(ag => {
        const def = modifierGroupDefs?.find(d => d.id === ag.groupId);
        if (def) all.push({ ...def, min: ag.min ?? def.min ?? 0, max: ag.max ?? def.max ?? 1,
          required: (ag.min ?? def.min ?? 0) > 0 });
      });
    }
    if (targetItem?.modifierGroups?.length) {
      targetItem.modifierGroups.forEach(g => {
        if (g.options?.length) all.push({ ...g, label: g.name || g.label });
      });
    }
    return all;
  };

  const buildInstGroups = (targetItem) =>
    (targetItem?.assignedInstructionGroups || [])
      .map(gid => instructionGroupDefs?.find(g => g.id === gid))
      .filter(Boolean);

  // ── State ─────────────────────────────────────────────────────────────────
  const [step, setStep]               = useState(isVariant ? 'variant' : 'modifiers');
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selections, setSelections]   = useState({});    // modifierId → option/[options]
  const [instSelections, setInstSel]  = useState({});    // instructionGroupId → string
  const [qty, setQty]                 = useState(1);
  const [notes, setNotes]             = useState('');
  const [animDir, setAnimDir]         = useState('in');  // 'in' | 'out'
  const prevStep = useRef(null);

  // When variant is picked, transition to modifiers step
  const pickVariant = (variant) => {
    setAnimDir('out');
    setTimeout(() => {
      setSelectedVariant(variant);
      setSelections({});
      setInstSel({});
      const targetItem = variant._childItem || variant;
      const hasMods = buildModGroups(targetItem).length > 0 || buildInstGroups(targetItem).length > 0;
      if (!hasMods) {
        // No modifiers after variant — confirm directly
        const displayName = `${item.menuName || item.name} — ${variant.menuName || variant.name || variant.label}`;
        onConfirm(variant._childItem || item, [], null, {
          notes: '', qty, linePrice: (variant.pricing?.base ?? variant.price ?? 0) * qty, displayName
        });
        return;
      }
      setStep('modifiers');
      setAnimDir('in');
    }, 180);
  };

  // Active item for modifier resolution (child item if variant was picked, else parent)
  const activeItem = selectedVariant?._childItem || (step === 'modifiers' && !isVariant ? item : null);
  const modGroups  = useMemo(() => buildModGroups(activeItem || item), [activeItem, item, modifierGroupDefs]);
  const instGroups = useMemo(() => buildInstGroups(activeItem || item), [activeItem, item, instructionGroupDefs]);

  const allRequired = modGroups
    .filter(g => g.required || (g.min || 0) > 0)
    .every(g => {
      const sel = selections[g.id];
      if (Array.isArray(sel)) return sel.length >= (g.min || 1);
      return !!sel;
    });

  const canAdd = step === 'variant' ? false : allRequired;

  const extraCost = Object.values(selections).flat().filter(Boolean)
    .reduce((s, m) => s + (m?.price || 0), 0);
  const basePrice = selectedVariant
    ? (selectedVariant.pricing?.base ?? selectedVariant.price ?? 0)
    : (item.pricing?.base ?? item.price ?? 0);
  const total = (basePrice + extraCost) * qty;

  const handleAdd = () => {
    if (!canAdd) return;
    const mods = Object.entries(selections).flatMap(([gid, val]) => {
      if (!val) return [];
      const group = modGroups.find(g => g.id === gid);
      const arr = Array.isArray(val) ? val : [val];
      return arr.filter(Boolean).map(m => ({
        groupLabel: group?.name || group?.label,
        label: m.name || m.label || '',
        price: m.price || 0,
      }));
    });
    Object.entries(instSelections).forEach(([gid, val]) => {
      if (val) {
        const g = instGroups.find(ig => ig.id === gid);
        mods.push({ groupLabel: g?.name, label: val, price: 0, _instruction: true });
      }
    });
    const instParts = Object.values(instSelections).filter(Boolean);
    const variantPart = selectedVariant
      ? ` — ${selectedVariant.menuName || selectedVariant.name || selectedVariant.label}`
      : '';
    const nameSuffix = instParts.length ? ` · ${instParts.join(', ')}` : '';
    const displayName = `${item.menuName || item.name}${variantPart}${nameSuffix}`;
    const targetItem = selectedVariant?._childItem || item;
    onConfirm(targetItem, mods, null, { notes: notes.trim(), qty, linePrice: total, displayName });
  };

  const toggleSingle = (gid, opt) =>
    setSelections(s => ({ ...s, [gid]: s[gid]?.id === opt.id ? null : opt }));
  const addMulti    = (gid, opt, max) =>
    setSelections(s => { const cur = s[gid] || []; return cur.length >= max ? s : { ...s, [gid]: [...cur, { ...opt, _uid: Date.now() + Math.random() }] }; });
  const removeMulti = (gid, uid) =>
    setSelections(s => ({ ...s, [gid]: (s[gid] || []).filter(o => o._uid !== uid) }));
  const toggleInst  = (gid, val) =>
    setInstSel(s => ({ ...s, [gid]: s[gid] === val ? null : val }));

  const flagged = (item.allergens || []).filter(a => activeAllergens.includes(a));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding:'14px 18px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <button onClick={onCancel} style={{ width:34, height:34, borderRadius:10, border:'1px solid var(--bdr2)', background:'var(--bg3)', color:'var(--t2)', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>←</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:17, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em' }}>{item.menuName || item.name}</div>
            {item.description && <div style={{ fontSize:12, color:'var(--t3)', marginTop:2, lineHeight:1.4 }}>{item.description}</div>}
          </div>
          {step === 'modifiers' && (
            <div style={{ fontFamily:'var(--font-mono)', fontSize:16, fontWeight:800, color:'var(--acc)', flexShrink:0 }}>
              £{total.toFixed(2)}
            </div>
          )}
        </div>

        {/* Allergen flags */}
        {(item.allergens?.length > 0 || flagged.length > 0) && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8 }}>
            {(item.allergens || []).map(a => {
              const al = ALLERGENS.find(x => x.id === a);
              const isActive = activeAllergens.includes(a);
              return (
                <span key={a} style={{ fontSize:10, padding:'2px 7px', borderRadius:6, fontWeight:500,
                  background: isActive ? 'var(--red-d)' : 'var(--bg3)',
                  border: `1px solid ${isActive ? 'var(--red-b)' : 'var(--bdr)'}`,
                  color: isActive ? 'var(--red)' : 'var(--t4)' }}>
                  {al?.icon} {al?.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Step breadcrumb */}
        {isVariant && step === 'modifiers' && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
            <button onClick={() => { setAnimDir('out'); setTimeout(() => { setStep('variant'); setSelectedVariant(null); setSelections({}); setInstSel({}); setAnimDir('in'); }, 180); }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg3)', cursor:'pointer', fontFamily:'inherit' }}>
              <span style={{ fontSize:11, color:'var(--t4)' }}>←</span>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--grn)' }}>
                {selectedVariant?.menuName || selectedVariant?.name || selectedVariant?.label}
              </span>
            </button>
            <span style={{ fontSize:11, color:'var(--t4)' }}>→ Choose options</span>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
        {step === 'variant' && (
          <VariantStep
            item={item}
            variantChildren={variantChildren}
            onPick={pickVariant}
          />
        )}
        {step === 'modifiers' && (
          <ModifierStep
            modGroups={modGroups}
            instGroups={instGroups}
            allModDefs={modifierGroupDefs}
            selections={selections}
            instSelections={instSelections}
            qty={qty}
            notes={notes}
            onToggleSingle={toggleSingle}
            onAddMulti={addMulti}
            onRemoveMulti={removeMulti}
            onToggleInst={toggleInst}
            onQty={setQty}
            onNotes={setNotes}
          />
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {step === 'modifiers' && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:12, color:'var(--t3)' }}>Qty</span>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:'auto' }}>
              <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--bdr2)', background:'transparent', color:'var(--t2)', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
              <span style={{ fontSize:16, fontWeight:700, minWidth:24, textAlign:'center' }}>{qty}</span>
              <button onClick={() => setQty(q => q+1)} style={{ width:32, height:32, borderRadius:'50%', border:'1px solid var(--bdr2)', background:'transparent', color:'var(--t2)', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canAdd}
            className="btn btn-acc"
            style={{ width:'100%', height:52, fontSize:16, fontWeight:800, borderRadius:14, opacity: canAdd ? 1 : 0.4 }}>
            Add to order · £{total.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Variant step: large tap-friendly buttons ──────────────────────────────────
function VariantStep({ item, variantChildren, onPick }) {
  const label = item.variantLabel || 'Size';
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>
        Choose {label}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
        {variantChildren.map(v => {
          const price = v.pricing?.base ?? v.price ?? 0;
          return (
            <button key={v.id} onClick={() => onPick(v)}
              style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', padding:'16px 16px 14px',
                borderRadius:16, border:'2px solid var(--bdr)', background:'var(--bg2)',
                cursor:'pointer', fontFamily:'inherit', transition:'all .12s',
                minHeight:90, position:'relative', overflow:'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--acc)'; e.currentTarget.style.background='var(--acc-d)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--bdr)'; e.currentTarget.style.background='var(--bg2)'; }}
            >
              <div style={{ fontSize:15, fontWeight:700, color:'var(--t1)', marginBottom:6 }}>
                {v.menuName || v.name}
              </div>
              <div style={{ fontSize:18, fontWeight:900, color:'var(--acc)', fontFamily:'var(--font-mono)', marginTop:'auto' }}>
                £{price.toFixed(2)}
              </div>
              {v.allergens?.length > 0 && (
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:4 }}>
                  ⚠ {v.allergens.join(', ')}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Modifier step: sequential groups ─────────────────────────────────────────
function ModifierStep({ modGroups, instGroups, allModDefs, selections, instSelections, qty, notes, onToggleSingle, onAddMulti, onRemoveMulti, onToggleInst, onQty, onNotes }) {
  const hasContent = modGroups.length > 0 || instGroups.length > 0;
  if (!hasContent) {
    return (
      <div style={{ textAlign:'center', padding:'32px 0', color:'var(--t3)', fontSize:13 }}>
        No options for this item — use the Add to order button below.
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {modGroups.map(group => {
        const isRequired  = group.required || (group.min || 0) > 0;
        const max         = group.max >= 99 || !group.max ? 999 : group.max;
        const isMulti     = max > 1;
        const cur         = selections[group.id];
        const selectedCount = Array.isArray(cur) ? cur.length : (cur ? 1 : 0);

        return (
          <div key={group.id}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--t1)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                {group.name || group.label}
              </span>
              {isRequired ? (
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)' }}>Required</span>
              ) : (
                <span style={{ fontSize:10, color:'var(--t4)' }}>Optional</span>
              )}
              {isMulti && max < 99 && <span style={{ fontSize:10, color:'var(--t4)' }}>· pick up to {max}</span>}
              {selectedCount > 0 && <span style={{ fontSize:10, fontWeight:700, color:'var(--grn)', marginLeft:'auto' }}>✓ {selectedCount} selected</span>}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
              {(group.options || []).map(opt => {
                const id = opt.id || opt.label || opt.name;
                const isSel = isMulti
                  ? (cur || []).some(o => (o.id || o.label) === id)
                  : cur?.id === id || cur?.label === id;
                const atMax = isMulti && selectedCount >= max;

                return (
                  <button key={id}
                    onClick={() => {
                      if (isMulti) {
                        if (isSel) removeMulti(group.id, (cur || []).find(o => (o.id || o.label) === id)?._uid);
                        else if (!atMax) addMulti(group.id, { ...opt, id: id, label: opt.name || opt.label || id }, max);
                      } else {
                        onToggleSingle(group.id, { ...opt, id: id, label: opt.name || opt.label || id });
                      }
                    }}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'12px 14px', borderRadius:12, cursor: atMax && !isSel ? 'not-allowed' : 'pointer',
                      fontFamily:'inherit', textAlign:'left', transition:'all .1s',
                      border:`2px solid ${isSel ? 'var(--acc)' : 'var(--bdr)'}`,
                      background: isSel ? 'var(--acc-d)' : 'var(--bg2)',
                      opacity: atMax && !isSel ? 0.4 : 1,
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:18, height:18, borderRadius: isMulti ? 4 : '50%', border:`2px solid ${isSel ? 'var(--acc)' : 'var(--bdr2)'}`, background: isSel ? 'var(--acc)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {isSel && <div style={{ width:6, height:6, borderRadius: isMulti ? 2 : '50%', background:'#0b0c10' }}/>}
                      </div>
                      <span style={{ fontSize:13, fontWeight: isSel ? 700 : 400, color: isSel ? 'var(--acc)' : 'var(--t1)' }}>
                        {opt.name || opt.label}
                      </span>
                    </div>
                    {(opt.price || 0) > 0 && (
                      <span style={{ fontSize:12, fontWeight:700, color: isSel ? 'var(--acc)' : 'var(--t3)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
                        +£{opt.price.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Multi-select removes */}
            {isMulti && Array.isArray(cur) && cur.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8 }}>
                {cur.map(o => (
                  <span key={o._uid} onClick={() => removeMulti(group.id, o._uid)} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12, background:'var(--acc)', color:'#0b0c10', cursor:'pointer' }}>
                    {o.name || o.label} ×
                  </span>
                ))}
              </div>
            )}
            {/* Nested modifier: if selected option has subGroupId, show linked group */}
            {(() => {
              const selOpt = !isMulti ? cur : null;
              if (!selOpt?.subGroupId) return null;
              const subDef = allModDefs?.find(d => d.id === selOpt.subGroupId);
              if (!subDef) return null;
              return (
                <SubModifierGroup key={subDef.id} group={subDef}
                  selections={selections} onToggleSingle={onToggleSingle}
                  onAddMulti={onAddMulti} onRemoveMulti={onRemoveMulti}/>
              );
            })()}
          </div>
        );
      })}

      {/* Instruction groups */}
      {instGroups.map(g => {
        const sel = instSelections[g.id];
        return (
          <div key={g.id}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <span style={{ fontSize:12, fontWeight:800, color:'var(--t1)', textTransform:'uppercase', letterSpacing:'.06em' }}>{g.name}</span>
              <span style={{ fontSize:10, color:'var(--t4)' }}>Preparation · no charge</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
              {(g.options || []).map(opt => (
                <button key={opt} onClick={() => onToggleInst(g.id, opt)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all .1s',
                    border:`2px solid ${sel===opt ? 'var(--grn)' : 'var(--bdr)'}`,
                    background: sel===opt ? 'var(--grn-d)' : 'var(--bg2)' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${sel===opt ? 'var(--grn)' : 'var(--bdr2)'}`, background: sel===opt ? 'var(--grn)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {sel===opt && <div style={{ width:6, height:6, borderRadius:'50%', background:'#0b0c10' }}/>}
                  </div>
                  <span style={{ fontSize:13, fontWeight: sel===opt ? 700 : 400, color: sel===opt ? 'var(--grn)' : 'var(--t1)' }}>{opt}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Notes */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Note (optional)</div>
        <input value={notes} onChange={e => onNotes(e.target.value)} placeholder="Allergy note, special request…" className="input" style={{ width:'100%', fontSize:13, boxSizing:'border-box' }}/>
      </div>
    </div>
  );
}

// ── SubModifierGroup: nested modifier group shown inline ─────────────────────
function SubModifierGroup({ group, selections, onToggleSingle, onAddMulti, onRemoveMulti }) {
  const cur = selections[group.id];
  const max = group.max >= 99 || !group.max ? 999 : group.max;
  const isMulti = max > 1;
  return (
    <div style={{ marginTop:8, padding:'10px 12px', background:'var(--bg3)', borderRadius:10,
      border:'1px solid var(--bdr)', borderLeft:'3px solid var(--acc)' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--acc)', textTransform:'uppercase',
        letterSpacing:'.07em', marginBottom:8 }}>↳ {group.name || group.label}</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {(group.options||[]).map(opt => {
          const id = opt.id || opt.name;
          const isSel = isMulti
            ? (cur||[]).some(o => (o.id||o.name||o.label) === id)
            : cur?.id === id || cur?.name === id || cur?.label === id;
          return (
            <button key={id} onClick={() => {
              if (isMulti) {
                if (isSel) onRemoveMulti(group.id, (cur||[]).find(o=>(o.id||o.name)===id)?._uid);
                else onAddMulti(group.id, {...opt, id}, max);
              } else {
                onToggleSingle(group.id, {...opt, id, label: opt.name||opt.label||id});
              }
            }} style={{ padding:'7px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12,
              border:`1.5px solid ${isSel?'var(--acc)':'var(--bdr)'}`,
              background:isSel?'var(--acc-d)':'var(--bg2)',
              color:isSel?'var(--acc)':'var(--t1)', fontWeight:isSel?700:400 }}>
              {opt.name||opt.label}
              {(opt.price||0) > 0 && <span style={{ color:'var(--t4)', marginLeft:4 }}>+£{opt.price.toFixed(2)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
