/**
 * KioskProductModal — v5.5.1
 *
 * Touch-friendly product configurator. Single-screen flow — variants, modifier
 * groups, instruction groups, and NESTED modifiers all render inline within
 * one scrollable surface. The Add-to-order CTA stays sticky at the bottom so
 * the customer always sees price + total + qty.
 *
 * What changed in v5.5.1:
 *   - Nested modifiers (option.subGroupId) now expand INLINE under the parent
 *     option instead of pushing the customer to a new screen. Sub-groups are
 *     pre-fetched on mount so there's no loading flicker on tap.
 *   - Typography sized for kiosk distance (name 38, options 18, etc).
 *   - All colors via [data-kiosk-theme] CSS vars from globals.css.
 *   - Single-flow even for items without modifiers — same shell, just no
 *     groups render, qty + add CTA sit immediately under the description.
 *
 * Modifier group shape (from Supabase):
 *   { id, name, min, max, selection_type ('single'|'multiple'),
 *     options: [{id, name, price, subGroupId?}] }
 *
 * Selection state shape:
 *   selections:        { [groupId]: [optionId, ...] }   // always array
 *   nestedSelections:  { 'groupId:optionId:occurrenceIdx':
 *                          { [subGroupId]: [optionId, ...] } }
 *
 * Validation:
 *   - Each top-level group: min <= count <= max
 *   - Single groups have implicit max=1
 *   - For each selected occurrence of a parent option with subGroupId,
 *     the resolved sub-group must also satisfy its own min/max
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store';

// ============================================================
// VALIDATION HELPERS (pure)
// ============================================================

function normalizeGroup(group) {
  const isSingle = group.selection_type === 'single';
  const min = Math.max(group.min ?? 0, group.min_select ?? 0, 0);
  const rawMax = group.max ?? group.max_select ?? null;
  const max = rawMax != null ? rawMax : (isSingle ? 1 : (group.options?.length || 99));
  return { ...group, _min: min, _max: max, _isSingle: isSingle };
}

// Walks all selected occurrences of options-with-subGroupId and returns
// the parent option occurrences that need a nested pick.
function collectNestedOccurrences(groups, selections) {
  const out = [];
  for (const g of groups) {
    if (g.__isVariantGroup) continue;
    const picked = selections[g.id] || [];
    const occCounts = {};
    picked.forEach(optId => {
      const opt = (g.options || []).find(o => o.id === optId);
      if (!opt || !opt.subGroupId) return;
      const idx = occCounts[optId] || 0;
      occCounts[optId] = idx + 1;
      out.push({ groupId: g.id, optionId: optId, occurrenceIdx: idx, option: opt, parentGroup: g });
    });
  }
  return out;
}

function validateSelections(groups, selections, nestedSelections, subGroupsCache) {
  // Top-level group min/max
  for (const g of groups) {
    const picked = selections[g.id] || [];
    if (picked.length < g._min) {
      return g._min === 1 ? 'Pick a ' + g.name : 'Pick at least ' + g._min + ' from ' + g.name;
    }
    if (picked.length > g._max) {
      return 'Too many in ' + g.name + ' (max ' + g._max + ')';
    }
  }
  // Nested sub-group min/max for each occurrence of an option with subGroupId
  const nested = collectNestedOccurrences(groups, selections);
  for (const n of nested) {
    const sub = subGroupsCache[n.option.subGroupId];
    if (!sub) continue; // sub-group not loaded — soft skip
    const key = n.groupId + ':' + n.optionId + ':' + n.occurrenceIdx;
    const subSel = (nestedSelections[key] && nestedSelections[key][sub.id]) || [];
    if (subSel.length < sub._min) {
      return sub._min === 1 ? 'Pick a ' + sub.name + ' for ' + n.option.name : 'Pick ' + sub._min + ' from ' + sub.name;
    }
    if (subSel.length > sub._max) {
      return 'Too many in ' + sub.name + ' (max ' + sub._max + ')';
    }
  }
  return null;
}

function priceDelta(groups, selections, nestedSelections, subGroupsCache) {
  let delta = 0;
  for (const g of groups) {
    if (g.__isVariantGroup) continue;
    const picked = selections[g.id] || [];
    for (const optId of picked) {
      const opt = (g.options || []).find(o => o.id === optId);
      if (opt && typeof opt.price === 'number') delta += opt.price;
    }
  }
  // Nested option prices
  const nested = collectNestedOccurrences(groups, selections);
  for (const n of nested) {
    const sub = subGroupsCache[n.option.subGroupId];
    if (!sub) continue;
    const key = n.groupId + ':' + n.optionId + ':' + n.occurrenceIdx;
    const subSel = (nestedSelections[key] && nestedSelections[key][sub.id]) || [];
    for (const subOptId of subSel) {
      const subOpt = (sub.options || []).find(o => o.id === subOptId);
      if (subOpt && typeof subOpt.price === 'number') delta += subOpt.price;
    }
  }
  return delta;
}

function buildModsArray(groups, selections, nestedSelections, subGroupsCache) {
  const mods = [];
  for (const g of groups) {
    if (g.__isVariantGroup) continue;
    const isInstrGroup = g.__isInstructionGroup;
    const picked = selections[g.id] || [];
    const occCounts = {};
    for (const optId of picked) {
      const opt = (g.options || []).find(o => o.id === optId);
      if (!opt) continue;
      mods.push({
        label: opt.name,
        price: typeof opt.price === 'number' ? opt.price : 0,
        groupLabel: g.name,
        ...(isInstrGroup ? { _instruction: true } : {}),
      });
      // If this option has nested config, emit the nested picks tagged with parent
      if (opt.subGroupId) {
        const idx = occCounts[optId] || 0;
        occCounts[optId] = idx + 1;
        const sub = subGroupsCache[opt.subGroupId];
        if (sub) {
          const key = g.id + ':' + optId + ':' + idx;
          const subSel = (nestedSelections[key] && nestedSelections[key][sub.id]) || [];
          for (const subOptId of subSel) {
            const subOpt = (sub.options || []).find(o => o.id === subOptId);
            if (!subOpt) continue;
            mods.push({
              label: subOpt.name,
              price: typeof subOpt.price === 'number' ? subOpt.price : 0,
              groupLabel: opt.name + ' → ' + sub.name,
            });
          }
        }
      }
    }
  }
  return mods;
}

function summarizeForDisplay(groups, selections, nestedSelections, subGroupsCache) {
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
  // Append nested labels
  const nested = collectNestedOccurrences(groups, selections);
  for (const n of nested) {
    const sub = subGroupsCache[n.option.subGroupId];
    if (!sub) continue;
    const key = n.groupId + ':' + n.optionId + ':' + n.occurrenceIdx;
    const subSel = (nestedSelections[key] && nestedSelections[key][sub.id]) || [];
    const subNames = subSel.map(id => (sub.options || []).find(o => o.id === id)?.name).filter(Boolean);
    if (subNames.length > 0) parts.push(n.option.name + ': ' + subNames.join(', '));
  }
  return parts.join(' · ');
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function KioskProductModal({ item, allItems = [], brandColor, brandAccent, basePrice, addLabel, onAdd, onCancel }) {
  const allInstructionDefs = useStore(s => s.instructionGroupDefs) || [];
  const [groups, setGroups] = useState([]);
  const [subGroupsCache, setSubGroupsCache] = useState({}); // { [subGroupId]: normalizedGroup }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selections, setSelections] = useState({}); // { groupId: [optionId, ...] }
  const [nestedSelections, setNestedSelections] = useState({}); // { 'gid:oid:idx': { subGroupId: [...] } }
  const [qty, setQty] = useState(1);
  const [showError, setShowError] = useState(false);
  const [instructions, setInstructions] = useState('');

  // Load top-level groups + variants, then pre-fetch any sub-groups referenced by option.subGroupId
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
              price: ((c.pricing?.base ?? c.price ?? 0) - cheapestPrice),
              __absolutePrice: c.pricing?.base ?? c.price ?? 0,
            })),
          }));
        }
      }

      // ── Load assigned_modifier_groups ──
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

      // ── Instruction groups ──
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

      // ── Pre-fetch all sub-groups referenced by option.subGroupId ──
      const subGroupIds = new Set();
      for (const g of result) {
        for (const opt of (g.options || [])) {
          if (opt && opt.subGroupId) subGroupIds.add(opt.subGroupId);
        }
      }
      let subCache = {};
      if (subGroupIds.size > 0) {
        try {
          const { data, error } = await supabase
            .from('modifier_groups')
            .select('*')
            .in('id', Array.from(subGroupIds));
          if (error) throw error;
          if (!alive) return;
          for (const sg of (data || [])) {
            subCache[sg.id] = normalizeGroup(sg);
          }
        } catch (e) {
          console.warn('[kiosk] failed to pre-fetch sub-groups:', e?.message);
        }
      }

      if (alive) {
        setGroups(result);
        setSubGroupsCache(subCache);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [item, allItems]);

  // ── Derived state ──
  const validation = useMemo(
    () => validateSelections(groups, selections, nestedSelections, subGroupsCache),
    [groups, selections, nestedSelections, subGroupsCache]
  );
  const isValid = validation === null;
  const variantGroup = groups.find(g => g.__isVariantGroup);
  let effectiveBase = basePrice || 0;
  if (variantGroup) {
    const pickedVariantId = (selections[variantGroup.id] || [])[0];
    const pickedOpt = pickedVariantId ? variantGroup.options.find(o => o.id === pickedVariantId) : null;
    effectiveBase = pickedOpt ? pickedOpt.__absolutePrice : variantGroup.__cheapestPrice;
  }
  const totalPriceEach = effectiveBase + priceDelta(groups, selections, nestedSelections, subGroupsCache);
  const totalPrice = totalPriceEach * qty;

  // ── Selection mutation ──
  const incOption = (group, optId) => {
    setShowError(false);
    setSelections(prev => {
      const current = prev[group.id] || [];
      let next;
      if (group._isSingle) {
        // Toggle off if same option already picked, otherwise replace
        next = current.length === 1 && current[0] === optId ? [] : [optId];
      } else {
        if (current.length >= group._max) return prev;
        next = [...current, optId];
      }
      return { ...prev, [group.id]: next };
    });
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
    // Drop the LAST occurrence's nested selection for this option
    setNestedSelections(prev => {
      const currentList = (selections[group.id] || []).filter(id => id === optId);
      const lastIdx = currentList.length - 1;
      if (lastIdx < 0) return prev;
      const key = group.id + ':' + optId + ':' + lastIdx;
      if (!prev[key]) return prev;
      const out = { ...prev };
      delete out[key];
      return out;
    });
  };

  // ── Nested selection mutation ──
  const setNestedPick = (parentKey, sub, subOptId) => {
    setShowError(false);
    setNestedSelections(prev => {
      const cur = (prev[parentKey] && prev[parentKey][sub.id]) || [];
      let next;
      if (sub._isSingle) {
        next = cur.length === 1 && cur[0] === subOptId ? [] : [subOptId];
      } else {
        if (cur.length >= sub._max) return prev;
        next = [...cur, subOptId];
      }
      return { ...prev, [parentKey]: { ...(prev[parentKey] || {}), [sub.id]: next } };
    });
  };

  const tryAdd = () => {
    if (!isValid) {
      setShowError(true);
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
    const mods = buildModsArray(groups, selections, nestedSelections, subGroupsCache);
    const summary = summarizeForDisplay(groups, selections, nestedSelections, subGroupsCache);
    onAdd({
      qty,
      selections,
      mods,
      summary,
      priceEach: totalPriceEach,
      instructions: instructions.trim(),
    });
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div style={overlayStyle()}>
        <div style={{ color: 'var(--kFg)', fontSize: 22, padding: 60 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={overlayStyle()}>
      {/* Hero image with back button */}
      <div style={{ position: 'relative', width: '100%', height: '32vh', background: 'linear-gradient(135deg, ' + brandColor + ', ' + (brandAccent || brandColor) + ')', display: 'grid', placeItems: 'center', fontSize: 140, flexShrink: 0, overflow: 'hidden' }}>
        {item?.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍽️'}
        <button onClick={onCancel} style={{ position: 'absolute', top: 18, left: 18, width: 52, height: 52, borderRadius: 16, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', fontSize: 24, color: '#fff', border: 0, cursor: 'pointer' }}>←</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '26px 28px 16px' }}>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.1 }}>{item?.name}</div>
        {item?.description && (
          <div style={{ fontSize: 17, color: 'var(--kFgMuted)', lineHeight: 1.5, marginBottom: 18 }}>{item.description}</div>
        )}

        {Array.isArray(item?.allergens) && item.allergens.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {item.allergens.map(a => (
              <div key={a} style={{ padding: '6px 12px', background: 'var(--kAllergen-bg)', border: '1px solid var(--kAllergen-border)', borderRadius: 8, fontSize: 13, color: 'var(--kAllergen-fg)', fontWeight: 600, textTransform: 'capitalize' }}>⚠ {a}</div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--kError-bg)', border: '1px solid var(--kError-border)', color: 'var(--kError-fg)', padding: '12px 16px', borderRadius: 12, fontSize: 14, marginBottom: 16 }}>{error}</div>
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
            <div key={g.id} data-mod-group={g.id} style={{ marginBottom: 30 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--kFg)', letterSpacing: '-0.01em' }}>{g.name}</div>
                {picked.length > 0 && remaining > 0 && !g._isSingle && (
                  <div style={{ fontSize: 13, color: 'var(--kFgFaint)', fontWeight: 600 }}>{picked.length} / {g._max}</div>
                )}
              </div>
              <div style={{ fontSize: 14, color: isInvalid ? 'var(--kError-fg)' : 'var(--kFgMuted)', marginBottom: 14, fontWeight: isInvalid ? 700 : 500 }}>
                {hint}{isInvalid && picked.length < g._min ? ' — you must select ' + (g._min - picked.length) + ' more' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(g.options || []).map(opt => {
                  const optCount = picked.filter(id => id === opt.id).length;
                  const isSelected = optCount > 0;
                  const priceLabel = (opt.price && opt.price > 0) ? '+£' + Number(opt.price).toFixed(2) : (opt.price && opt.price < 0) ? '-£' + Math.abs(opt.price).toFixed(2) : '';
                  const atCap = picked.length >= g._max && !g._isSingle;
                  const showStepper = !g._isSingle && optCount > 0;
                  const sub = opt.subGroupId ? subGroupsCache[opt.subGroupId] : null;

                  return (
                    <div key={opt.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '16px 18px',
                        background: isSelected ? 'var(--kSurface2)' : 'var(--kSurface1)',
                        border: '2px solid ' + (isSelected ? brandColor : (isInvalid ? 'var(--kError-border)' : 'var(--kBorder1)')),
                        borderRadius: sub && isSelected ? '14px 14px 0 0' : 14,
                        color: 'var(--kFg)',
                        transition: 'background 0.12s, border-color 0.12s',
                      }}>
                        <button onClick={() => incOption(g, opt.id)} disabled={!isSelected && atCap} style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: 16,
                          background: 'transparent', border: 0, padding: 0,
                          cursor: (atCap && !isSelected) ? 'not-allowed' : 'pointer',
                          color: 'var(--kFg)', fontFamily: 'inherit', textAlign: 'left',
                          opacity: (atCap && !isSelected) ? 0.4 : 1,
                        }}>
                          <span style={{
                            flexShrink: 0,
                            width: 30, height: 30,
                            borderRadius: g._isSingle ? '50%' : 8,
                            border: '2px solid ' + (isSelected ? brandColor : 'var(--kBorder3)'),
                            display: 'grid', placeItems: 'center',
                            background: isSelected ? brandColor : 'transparent',
                            color: '#fff', fontSize: 15, fontWeight: 800,
                          }}>{isSelected ? (g._isSingle ? '✓' : optCount) : ''}</span>
                          <span style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{opt.name}</span>
                          {priceLabel && <span style={{ fontSize: 15, color: 'var(--kFgMuted)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{priceLabel}</span>}
                          {sub && !isSelected && (
                            <span style={{ fontSize: 12, color: brandColor, fontWeight: 700, marginLeft: 4 }}>{sub.name} ›</span>
                          )}
                        </button>
                        {showStepper && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); decOption(g, opt.id); }} style={{
                              width: 40, height: 40, borderRadius: '50%', background: 'var(--kSurface2)',
                              border: 0, color: 'var(--kFg)', fontSize: 20, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            }}>−</button>
                            <button onClick={(e) => { e.stopPropagation(); incOption(g, opt.id); }} disabled={atCap} style={{
                              width: 40, height: 40, borderRadius: '50%', background: atCap ? 'var(--kSurface1)' : brandColor,
                              border: 0, color: '#fff', fontSize: 20, fontWeight: 700, cursor: atCap ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                              opacity: atCap ? 0.4 : 1,
                            }}>+</button>
                          </div>
                        )}
                      </div>

                      {/* Inline nested sub-group expansion — one block per occurrence */}
                      {sub && isSelected && Array.from({ length: optCount }).map((_, occIdx) => {
                        const parentKey = g.id + ':' + opt.id + ':' + occIdx;
                        const subSel = (nestedSelections[parentKey] && nestedSelections[parentKey][sub.id]) || [];
                        const isLastOcc = occIdx === optCount - 1;
                        const subInvalid = showError && (subSel.length < sub._min || subSel.length > sub._max);
                        return (
                          <div key={parentKey} style={{
                            background: 'var(--kSurface1)',
                            borderLeft: '3px solid ' + brandColor,
                            borderRight: '2px solid ' + brandColor,
                            borderBottom: '2px solid ' + brandColor,
                            borderRadius: isLastOcc ? '0 0 14px 14px' : 0,
                            padding: '14px 16px 16px 22px',
                            marginBottom: isLastOcc ? 0 : 2,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--kFgMuted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                              {opt.name}{optCount > 1 ? ' #' + (occIdx + 1) : ''} · {sub.name}
                            </div>
                            <div style={{ fontSize: 13, color: subInvalid ? 'var(--kError-fg)' : 'var(--kFgFaint)', marginBottom: 10, fontWeight: subInvalid ? 700 : 500 }}>
                              {sub._min > 0 ? 'Required · pick ' + (sub._min === sub._max ? sub._min : sub._min + '–' + sub._max) : 'Optional · up to ' + sub._max}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {(sub.options || []).map(subOpt => {
                                const isSubSel = subSel.includes(subOpt.id);
                                const subPriceLabel = (subOpt.price && subOpt.price > 0) ? '+£' + Number(subOpt.price).toFixed(2) : '';
                                return (
                                  <button key={subOpt.id} onClick={() => setNestedPick(parentKey, sub, subOpt.id)} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '12px 14px',
                                    background: isSubSel ? 'var(--kSurface3)' : 'var(--kSurface2)',
                                    border: '2px solid ' + (isSubSel ? brandColor : 'transparent'),
                                    borderRadius: 12,
                                    color: 'var(--kFg)',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit', textAlign: 'left',
                                  }}>
                                    <span style={{
                                      flexShrink: 0, width: 24, height: 24,
                                      borderRadius: sub._isSingle ? '50%' : 6,
                                      border: '2px solid ' + (isSubSel ? brandColor : 'var(--kBorder3)'),
                                      display: 'grid', placeItems: 'center',
                                      background: isSubSel ? brandColor : 'transparent',
                                      color: '#fff', fontSize: 12, fontWeight: 800,
                                    }}>{isSubSel ? '✓' : ''}</span>
                                    <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{subOpt.name}</span>
                                    {subPriceLabel && <span style={{ fontSize: 14, color: 'var(--kFgMuted)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{subPriceLabel}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Special instructions */}
      <div style={{ padding: '0 28px 18px' }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--kFgMuted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Anything else?</label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="e.g. no ice, light sauce, allergy notes…"
          maxLength={140}
          rows={2}
          style={{ width: '100%', borderRadius: 14, padding: '14px 16px', fontFamily: 'inherit', fontSize: 15, outline: 'none', resize: 'none', borderWidth: 1, borderStyle: 'solid' }}
        />
      </div>

      {/* Bottom CTA bar */}
      <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--kBorder1)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--kSurface2)', borderRadius: 100, padding: 5 }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={qtyBtn()}>−</button>
          <div style={{ fontSize: 20, fontWeight: 800, minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{qty}</div>
          <button onClick={() => setQty(q => q + 1)} style={qtyBtn()}>+</button>
        </div>
        <button onClick={tryAdd} style={{
          flex: 1,
          background: isValid ? brandColor : 'var(--kSurface2)',
          color: isValid ? '#fff' : 'var(--kFgFaint)',
          padding: '18px 22px',
          borderRadius: 100,
          fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: isValid ? '0 10px 28px rgba(0,0,0,0.28)' : 'none',
        }}>
          <span>{isValid ? (addLabel || 'Add to order') : (validation || (addLabel || 'Add to order'))}</span>
          {isValid && <span style={{ fontVariantNumeric: 'tabular-nums' }}>£{totalPrice.toFixed(2)}</span>}
        </button>
      </div>
    </div>
  );
}

// ─── Style helpers ───
function overlayStyle() {
  return {
    position: 'absolute', inset: 0,
    background: 'var(--kSurfaceShell)',
    color: 'var(--kFg)',
    display: 'flex', flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };
}
function qtyBtn() {
  return { width: 48, height: 48, borderRadius: '50%', background: 'var(--kSurface3)', color: 'var(--kFg)', border: 0, fontSize: 22, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
}
