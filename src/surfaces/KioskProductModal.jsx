/**
* KioskProductModal — v5.3.0
*
* Touch-friendly product configurator. Replaces the simple ScreenItemDetail
* when an item has modifier groups, requiring guided selection before adding to cart.
*
* Loads modifier groups from `modifier_groups` table by id (assigned_modifier_groups
* on the item is an array of group ids).
*
* Modifier group shape:
*   { id, name, min, max, selection_type ('single'|'multiple'), options: [{id, name, price}] }
*
* Selection state shape:
*   { [groupId]: [optionId, ...] }   // always an array even for single-select
*
* Validation rules:
*   - For each group, count selected options
*   - Must satisfy: min <= count <= max
*   - 'single' groups have implicit max=1
*
* v5.3.0 SCOPE: handles single + multi-select with min/max. Does NOT yet handle:
*   - Variants (sub-items / parent_id) — landing in v5.3.1
*   - Nested modifiers (an option that drills into another item) — v5.3.2
*/

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store';

// ============================================================
// VALIDATION HELPERS (pure)
// ============================================================

// Normalize a group's effective min/max from the various legacy fields the schema has.
// Some rows use min/max, some min_select/max_select, some both. We pick the most
// constrained values to be safe.
function normalizeGroup(group) {
  const isSingle = group.selection_type === 'single';
  // Effective min: max of (min, min_select) — prefer the higher 'minimum' to enforce required
  const min = Math.max(group.min ?? 0, group.min_select ?? 0, 0);
  // Effective max: prefer 'max' if set, else 'max_select', else 1 for single, unlimited for multi
  const rawMax = group.max ?? group.max_select ?? null;
  const max = rawMax != null ? rawMax : (isSingle ? 1 : (group.options?.length || 99));
  return { ...group, _min: min, _max: max, _isSingle: isSingle };
}

// Returns null if valid, or a string describing the first violation.
function validateSelections(groups, selections) {
  for (const g of groups) {
    const picked = selections[g.id] || [];
    if (picked.length < g._min) {
      return g._min === 1 ? 'Pick a ' + g.name : 'Pick at least ' + g._min + ' from ' + g.name;
    }
    if (picked.length > g._max) {
      return 'Too many in ' + g.name + ' (max ' + g._max + ')';
    }
  }
  return null;
}

// Sum the price delta from selected modifier options.
function priceDelta(groups, selections) {
  let delta = 0;
  for (const g of groups) {
    const picked = selections[g.id] || [];
    for (const optId of picked) {
      const opt = (g.options || []).find(o => o.id === optId);
      if (opt && typeof opt.price === 'number') delta += opt.price;
    }
  }
  return delta;
}

// Build the POS-compatible mods array. Each entry is { label, price, groupLabel }.
// Duplicate option picks (e.g., 3x Biscoff Donut) appear as duplicate entries.
function buildModsArray(groups, selections) {
  const mods = [];
  for (const g of groups) {
    if (g.__isVariantGroup) continue;
    const isInstrGroup = g.__isInstructionGroup;
    const picked = selections[g.id] || [];
    for (const optId of picked) {
      const opt = (g.options || []).find(o => o.id === optId);
      if (!opt) continue;
      mods.push({
        label: opt.name,
        price: typeof opt.price === 'number' ? opt.price : 0,
        groupLabel: g.name,
        ...(isInstrGroup ? { _instruction: true } : {}),
      });
    }
  }
  return mods;
}

// Build a human-readable string for the kiosk's own cart-line display.
function summarizeForDisplay(groups, selections) {
  const parts = [];
  for (const g of groups) {
    const picked = selections[g.id] || [];
    if (picked.length === 0) continue;
    const counts = {};
    for (const id of picked) counts[id] = (counts[id] || 0) + 1;
    const labels = Object.entries(counts).map(([id, n]) => {
      const name = (g.options || []).find(o => o.id === id)?.name;
      if (!name) return null;
      return n > 1 ? (name + ' ×' + n) : name;
    }).filter(Boolean);
    if (labels.length > 0) parts.push(labels.join(', '));
  }
  return parts.join(' · ');
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function KioskProductModal({ item, allItems = [], brandColor, brandAccent, basePrice, addLabel, onAdd, onCancel }) {
  const allInstructionDefs = useStore(s => s.instructionGroupDefs) || [];
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selections, setSelections] = useState({}); // { groupId: [optionId, ...] }
  const [qty, setQty] = useState(1);
  const [showError, setShowError] = useState(false);

  // v5.3.5: nested modifiers
  // childContext: { groupId, optionId, item } — when set, render a child modal for that item.
  const [childContext, setChildContext] = useState(null);
  // nestedSelections: { 'groupId:optionId:occurrenceIdx': { mods, summary, priceEach, selections } }
  // Keyed by occurrenceIdx so picking the same option twice gets independent configs.
  const [nestedSelections, setNestedSelections] = useState({});
  // v5.4.0: special instructions / notes
  const [instructions, setInstructions] = useState('');

  // Resolve a referenced item from an option ID. Options reference items by either:
  //  - option.id is the item's id directly (e.g. 'm-1776...')
  //  - option.id has a trailing item id (e.g. 'opt-xxx-m-1776...')
  const resolveLinkedItem = (optionId) => {
    if (!optionId || !Array.isArray(allItems)) return null;
    // Direct match
    let it = allItems.find(i => i.id === optionId);
    if (it) return it;
    // Trailing m-... pattern
    const m = optionId.match(/(m-[\w-]+)$/);
    if (m) it = allItems.find(i => i.id === m[1]);
    return it || null;
  };

  // v5.4.2: nested if option has subGroupId (POS pattern) OR linked item has own mods
  const isOptionNestedByOpt = (option) => {
    if (!option) return false;
    if (option.subGroupId) return true;
    const linked = resolveLinkedItem(option.id);
    return !!(linked && Array.isArray(linked.assigned_modifier_groups) && linked.assigned_modifier_groups.length > 0);
  };
  const isOptionNested = (optionId) => {
    const opt = groups.flatMap(g => g.options || []).find(o => o.id === optionId);
    return isOptionNestedByOpt(opt);
  };

  // Load modifier groups + synthesize a Size group from variants
  useEffect(() => {
    let alive = true;
    (async () => {
      const result = [];

      // ── Synthesize 'Size' group for variants-type items ──
      if (item?.type === 'variants') {
        const children = (allItems || [])
          .filter(i => i.parent_id === item.id && i.archived !== true)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        if (children.length > 0) {
          const cheapestPrice = Math.min(...children.map(c => c.pricing?.base ?? c.price ?? 0));
          result.push(normalizeGroup({
            id: '__variants__',
            name: 'Size',
            selection_type: 'single',
            min: 1, max: 1, min_select: 1, max_select: 1,
            __isVariantGroup: true,
            __cheapestPrice: cheapestPrice,
            options: children.map(c => ({
              id: c.id,
              name: c.name,
              // Show price DELTA from cheapest, not absolute price (so the cheapest shows as base, others as +X)
              price: ((c.pricing?.base ?? c.price ?? 0) - cheapestPrice),
              // Stash the absolute price for later
              __absolutePrice: c.pricing?.base ?? c.price ?? 0,
            })),
          }));
        }
      }

      // ── Load assigned_modifier_groups ──
      // Real shape: array of objects { groupId, min, max } (per-item overrides)
      // Fallback shape (older data): array of plain ids
      const assignments = item?.assigned_modifier_groups;
      if (Array.isArray(assignments) && assignments.length > 0) {
        const idsAndOverrides = assignments.map(a => {
          if (typeof a === 'string') return { id: a, min: null, max: null };
          return { id: a.groupId || a.id, min: a.min ?? null, max: a.max ?? null };
        }).filter(x => x.id);
        const ids = idsAndOverrides.map(x => x.id);
        try {
          const { data, error } = await supabase
            .from('modifier_groups')
            .select('*')
            .in('id', ids);
          if (error) throw error;
          if (!alive) return;
          // Preserve order, apply per-item min/max overrides if present
          const ordered = idsAndOverrides
            .map(({ id, min, max }) => {
              const g = (data || []).find(x => x.id === id);
              if (!g) {
                console.warn('[kiosk] modifier group not found:', id, '(referenced by item ' + (item?.name || item?.id) + ')');
                return null;
              }
              const merged = { ...g };
              if (min !== null && min !== undefined) merged.min = min;
              if (max !== null && max !== undefined) merged.max = max;
              return normalizeGroup(merged);
            })
            .filter(Boolean);
          result.push(...ordered);
        } catch (e) {
          if (alive) setError(e?.message || 'Failed to load options');
        }
      }

      const instrAssignments = item?.assigned_instruction_groups;
      if (Array.isArray(instrAssignments) && instrAssignments.length > 0) {
        for (const a of instrAssignments) {
          const igId = typeof a === 'string' ? a : (a.groupId || a.id);
          const minOverride = (typeof a === 'object' && a.min !== undefined) ? a.min : null;
          const def = allInstructionDefs.find(g => g.id === igId);
          if (!def) { console.warn('[kiosk] instruction group not found:', igId); continue; }
          result.push(normalizeGroup({
            id: '__instr__' + def.id,
            name: def.name,
            selection_type: 'single',
            min: minOverride !== null ? minOverride : 1,
            max: 1,
            __isInstructionGroup: true,
            options: (def.options || []).map((label, idx) => ({
              id: 'instr-' + def.id + '-' + idx,
              name: label,
              price: 0,
            })),
          }));
        }
      }

      if (alive) {
        setGroups(result);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [item, allItems]);

  const validation = useMemo(() => validateSelections(groups, selections), [groups, selections]);
  const isValid = validation === null;
  const variantGroup = groups.find(g => g.__isVariantGroup);
  let effectiveBase = basePrice || 0;
  if (variantGroup) {
    const pickedVariantId = (selections[variantGroup.id] || [])[0];
    const pickedOpt = pickedVariantId ? variantGroup.options.find(o => o.id === pickedVariantId) : null;
    effectiveBase = pickedOpt ? pickedOpt.__absolutePrice : variantGroup.__cheapestPrice;
  }
  const nonVariantGroups = groups.filter(g => !g.__isVariantGroup);
  // Sum nested children's priceEach contributions
  const nestedTotal = Object.values(nestedSelections).reduce((sum, n) => sum + (n?.priceEach || 0), 0);
  const totalPriceEach = effectiveBase + priceDelta(nonVariantGroups, selections) + nestedTotal;
  const totalPrice = totalPriceEach * qty;

  // For single-select: tap toggles between [] and [optId].
  // For multi-select: tap ADDS one occurrence (up to max). Use decOption to subtract.
  // For NESTED options: open the child modal instead of toggling. The actual selection commits when child returns.
  const incOption = (group, optId) => {
    setShowError(false);
    const opt = (group.options || []).find(o => o.id === optId);
    if (isOptionNestedByOpt(opt)) {
      const current = selections[group.id] || [];
      if (!group._isSingle && current.length >= group._max) return;
      let childItem;
      if (opt.subGroupId) {
        childItem = {
          id: '__nested__' + opt.id,
          name: opt.name,
          description: '',
          allergens: [],
          assigned_modifier_groups: [{ groupId: opt.subGroupId, min: 1, max: 1 }],
          assigned_instruction_groups: [],
          pricing: { base: 0 },
        };
      } else {
        childItem = resolveLinkedItem(optId);
      }
      setChildContext({ groupId: group.id, optionId: optId, optionName: opt?.name, item: childItem });
      return;
    }
    setSelections(prev => {
      const current = prev[group.id] || [];
      let next;
      if (group._isSingle) {
        next = current.length === 1 && current[0] === optId ? [] : [optId];
      } else {
        if (current.length >= group._max) return prev;
        next = [...current, optId];
      }
      return { ...prev, [group.id]: next };
    });
  };

  // Called when child modal returns with the nested selections.
  const commitChild = (childResult) => {
    if (!childContext) return;
    const { groupId, optionId } = childContext;
    // Add the option to the parent selection (count up by 1)
    setSelections(prev => {
      const current = prev[groupId] || [];
      const group = groups.find(g => g.id === groupId);
      let next;
      if (group?._isSingle) {
        next = [optionId];
      } else {
        next = [...current, optionId];
      }
      return { ...prev, [groupId]: next };
    });
    // Stash the child config so summary/mods/priceDelta know about it
    setNestedSelections(prev => {
      const occurrenceIdx = ((selections[groupId] || []).filter(id => id === optionId).length);
      const key = groupId + ':' + optionId + ':' + occurrenceIdx;
      return { ...prev, [key]: childResult };
    });
    setChildContext(null);
  };

  const decOption = (group, optId) => {
    setShowError(false);
    setSelections(prev => {
      const current = prev[group.id] || [];
      const idx = current.lastIndexOf(optId);
      if (idx < 0) return prev;
      const next = [...current.slice(0, idx), ...current.slice(idx + 1)];
      return { ...prev, [group.id]: next };
    });
    // Also drop the LAST nested selection entry for this option (if any)
    setNestedSelections(prev => {
      const current = selections[group.id] || [];
      const lastIdx = current.filter(id => id === optId).length - 1;
      if (lastIdx < 0) return prev;
      const key = group.id + ':' + optId + ':' + lastIdx;
      if (!prev[key]) return prev;
      const out = { ...prev };
      delete out[key];
      return out;
    });
  };

  const toggleOption = (group, optId) => incOption(group, optId);

  const tryAdd = () => {
    if (!isValid) {
      setShowError(true);
      // Auto-scroll to first invalid group
      const firstBad = groups.find(g => {
        const picked = (selections[g.id] || []).length;
        return picked < g._min || picked > g._max;
      });
      if (firstBad) {
        const el = document.querySelector('[data-mod-group="' + firstBad.id + '"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    // Combine parent + nested mods. Annotate nested with a 'via' field so kitchen sees the parent option.
    const baseMods = buildModsArray(groups, selections);
    const nestedMods = [];
    Object.entries(nestedSelections).forEach(([key, child]) => {
      const [, optionId] = key.split(':');
      const parentOptName = groups.flatMap(g => g.options || []).find(o => o.id === optionId)?.name;
      (child?.mods || []).forEach(m => nestedMods.push({ ...m, groupLabel: (parentOptName ? parentOptName + ' → ' : '') + (m.groupLabel || '') }));
    });
    const allMods = [...baseMods, ...nestedMods];
    // Combine display summaries
    const baseSummary = summarizeForDisplay(groups, selections);
    const nestedSummaries = Object.values(nestedSelections).map(n => n?.summary).filter(Boolean);
    const fullSummary = [baseSummary, ...nestedSummaries].filter(Boolean).join(' · ');
    onAdd({
      qty,
      selections,
      mods: allMods,
      summary: fullSummary,
      priceEach: totalPriceEach,
      instructions: instructions.trim(),
    });
  };

  // ─── Render ───
  // If a nested modal is active, render it on top.
  if (childContext) {
    return (
      <KioskProductModal
        item={childContext.item}
        allItems={allItems}
        brandColor={brandColor}
        brandAccent={brandAccent}
        addLabel={addLabel}
        basePrice={childContext.item?.pricing?.base ?? childContext.item?.price ?? 0}
        onAdd={commitChild}
        onCancel={() => setChildContext(null)}
      />
    );
  }

  if (loading) {
    return (
      <div style={overlayStyle()}>
        <div style={{ color: 'var(--kFg, #fff)', fontSize: 18 }}>Loading options…</div>
      </div>
    );
  }

  return (
    <div style={overlayStyle()}>
      {/* Top bar — image + back */}
      <div style={{ position: 'relative', width: '100%', height: '32vh', background: 'linear-gradient(135deg, ' + brandColor + ', ' + (brandAccent || brandColor) + ')', display: 'grid', placeItems: 'center', fontSize: 120, flexShrink: 0, overflow: 'hidden' }}>
        {item?.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '\ud83c\udf7d\ufe0f'}
        <button onClick={onCancel} style={{ position: 'absolute', top: 18, left: 18, width: 48, height: 48, borderRadius: 14, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', fontSize: 22, color: 'var(--kFg, #fff)', border: 0, cursor: 'pointer' }}>←</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 16px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>{item?.name}</div>
        {item?.description && (
          <div style={{ fontSize: 14, color: 'var(--kFgMuted, rgba(255,255,255,0.7))', lineHeight: 1.5, marginBottom: 14 }}>{item.description}</div>
        )}

        {Array.isArray(item?.allergens) && item.allergens.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
            {item.allergens.map(a => (
              <div key={a} style={{ padding: '5px 10px', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, fontSize: 11, color: '#ddc270', fontWeight: 600, textTransform: 'capitalize' }}>⚠ {a}</div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{error}</div>
        )}

        {/* Modifier groups */}
        {groups.map(g => {
          const picked = selections[g.id] || [];
          const remaining = g._max - picked.length;
          const isInvalid = showError && (picked.length < g._min || picked.length > g._max);
          let hint;
          if (g._min === 0 && g._max === 1) hint = 'Optional · pick one';
          else if (g._min === g._max && g._min === 1) hint = 'Required · pick one';
          else if (g._min === g._max) hint = 'Required · pick ' + g._min;
          else if (g._min > 0) hint = 'Required · pick ' + g._min + (g._max > g._min ? '–' + g._max : '');
          else hint = 'Optional · up to ' + g._max;
          return (
            <div key={g.id} data-mod-group={g.id} style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--kFg, #fff)' }}>{g.name}</div>
                {picked.length > 0 && remaining > 0 && !g._isSingle && (
                  <div style={{ fontSize: 11.5, color: 'var(--kFgMuted, rgba(255,255,255,0.5))' }}>{picked.length} / {g._max}</div>
                )}
              </div>
              <div style={{ fontSize: 12, color: isInvalid ? '#fca5a5' : 'rgba(255,255,255,0.55)', marginBottom: 12, fontWeight: isInvalid ? 700 : 400 }}>
                {hint}{isInvalid && picked.length < g._min ? ' — you must select ' + (g._min - picked.length) + ' more' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(g.options || []).map(opt => {
                  const optCount = picked.filter(id => id === opt.id).length;
                  const isSelected = optCount > 0;
                  const priceLabel = (opt.price && opt.price > 0) ? '+£' + Number(opt.price).toFixed(2) : (opt.price && opt.price < 0) ? '-£' + Math.abs(opt.price).toFixed(2) : '';
                  const atCap = picked.length >= g._max && !g._isSingle;
                  const showStepper = !g._isSingle && optCount > 0;
                  return (
                    <div key={opt.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px',
                      background: isSelected ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                      border: '2px solid ' + (isSelected ? brandColor : (isInvalid ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)')),
                      borderRadius: 14,
                      color: 'var(--kFg, #fff)',
                    }}>
                      <button onClick={() => incOption(g, opt.id)} disabled={!isSelected && atCap} style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 14,
                        background: 'transparent', border: 0, padding: 0,
                        cursor: (atCap && !isSelected) ? 'not-allowed' : 'pointer', color: 'var(--kFg, #fff)', fontFamily: 'inherit', textAlign: 'left',
                        opacity: (atCap && !isSelected) ? 0.4 : 1,
                      }}>
                        <span style={{
                          flexShrink: 0,
                          width: 28, height: 28,
                          borderRadius: g._isSingle ? '50%' : 7,
                          border: '2px solid ' + (isSelected ? brandColor : 'rgba(255,255,255,0.3)'),
                          display: 'grid', placeItems: 'center',
                          background: isSelected ? brandColor : 'transparent',
                          color: 'var(--kFg, #fff)', fontSize: 14, fontWeight: 800,
                        }}>{isSelected ? (g._isSingle ? '✓' : optCount) : ''}</span>
                        <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{opt.name}</span>
                        {priceLabel && <span style={{ fontSize: 13, color: 'var(--kFgMuted, rgba(255,255,255,0.6))', fontVariantNumeric: 'tabular-nums' }}>{priceLabel}</span>}
                        {isOptionNested(opt.id) && (
                          <span style={{ fontSize: 11, color: brandColor, fontWeight: 700, marginLeft: 4 }}>Configure ›</span>
                        )}
                      </button>
                      {showStepper && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); decOption(g, opt.id); }} style={{
                            width: 36, height: 36, borderRadius: '50%', background: 'var(--kSurface2, rgba(255,255,255,0.08))',
                            border: 0, color: 'var(--kFg, #fff)', fontSize: 18, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}>−</button>
                          <button onClick={(e) => { e.stopPropagation(); incOption(g, opt.id); }} disabled={atCap} style={{
                            width: 36, height: 36, borderRadius: '50%', background: atCap ? 'rgba(255,255,255,0.04)' : brandColor,
                            border: 0, color: 'var(--kFg, #fff)', fontSize: 18, fontWeight: 700, cursor: atCap ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            opacity: atCap ? 0.4 : 1,
                          }}>+</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* v5.4.0: special instructions text */}
      <div style={{ padding: '0 24px 16px' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--kFgMuted, rgba(255,255,255,0.55))', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Anything else?</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="e.g. no ice, light sauce, allergy notes…"
          maxLength={140}
          rows={2}
          style={{ width: '100%', background: 'var(--kSurface1, rgba(255,255,255,0.04))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', color: 'var(--kFg, #fff)', fontFamily: 'inherit', fontSize: 14, outline: 'none', resize: 'none' }}
        />
      </div>

      {/* Bottom CTA bar */}
      <div style={{ padding: '14px 22px 22px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--kSurface1, rgba(255,255,255,0.06))', borderRadius: 100, padding: 4 }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={qtyBtn()}>−</button>
          <div style={{ fontSize: 18, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{qty}</div>
          <button onClick={() => setQty(q => q + 1)} style={qtyBtn()}>+</button>
        </div>
        <button onClick={tryAdd} style={{
          flex: 1,
          background: isValid ? brandColor : 'rgba(255,255,255,0.1)',
          color: isValid ? '#fff' : 'rgba(255,255,255,0.5)',
          padding: '16px 20px',
          borderRadius: 100,
          fontSize: 16, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: isValid ? '0 8px 20px rgba(0,0,0,0.25)' : 'none',
        }}>
          <span>{isValid ? (addLabel || 'Add to order') : (validation || (addLabel || 'Add to order'))}</span>
          {isValid && <span>£{totalPrice.toFixed(2)}</span>}
        </button>
      </div>
    </div>
  );
}

// ─── Style helpers ───
function overlayStyle() {
  return {
    position: 'absolute', inset: 0,
    background: 'var(--kSurfaceShell, #0e0e10)',
    color: 'var(--kFg, #fff)',
    display: 'flex', flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };
}
function qtyBtn() {
  return { width: 44, height: 44, borderRadius: '50%', background: 'var(--kSurface2, rgba(255,255,255,0.08))', color: 'var(--kFg, #fff)', border: 0, fontSize: 20, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
}
