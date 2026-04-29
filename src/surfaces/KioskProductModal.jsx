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
    const picked = selections[g.id] || [];
    for (const optId of picked) {
      const opt = (g.options || []).find(o => o.id === optId);
      if (!opt) continue;
      mods.push({
        label: opt.name,
        price: typeof opt.price === 'number' ? opt.price : 0,
        groupLabel: g.name,
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
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selections, setSelections] = useState({}); // { groupId: [optionId, ...] }
  const [qty, setQty] = useState(1);
  const [showError, setShowError] = useState(false);

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
              if (!g) return null;
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

      if (alive) {
        setGroups(result);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [item, allItems]);

  const validation = useMemo(() => validateSelections(groups, selections), [groups, selections]);
  const isValid = validation === null;
  // For variants-type items, the base price is the SELECTED variant's price (or cheapest if none selected).
  // For other items, basePrice is the item's resolved price.
  const variantGroup = groups.find(g => g.__isVariantGroup);
  let effectiveBase = basePrice || 0;
  if (variantGroup) {
    const pickedVariantId = (selections[variantGroup.id] || [])[0];
    const pickedOpt = pickedVariantId ? variantGroup.options.find(o => o.id === pickedVariantId) : null;
    effectiveBase = pickedOpt ? pickedOpt.__absolutePrice : variantGroup.__cheapestPrice;
  }
  // priceDelta should NOT count the variant group (that's the base, not a delta)
  const nonVariantGroups = groups.filter(g => !g.__isVariantGroup);
  const totalPriceEach = effectiveBase + priceDelta(nonVariantGroups, selections);
  const totalPrice = totalPriceEach * qty;

  // For single-select: tap toggles between [] and [optId].
  // For multi-select: tap ADDS one occurrence (up to max). Use decOption to subtract.
  const incOption = (group, optId) => {
    setShowError(false);
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

  const decOption = (group, optId) => {
    setShowError(false);
    setSelections(prev => {
      const current = prev[group.id] || [];
      const idx = current.lastIndexOf(optId);
      if (idx < 0) return prev;
      const next = [...current.slice(0, idx), ...current.slice(idx + 1)];
      return { ...prev, [group.id]: next };
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
    onAdd({
      qty,
      selections,
      mods: buildModsArray(groups, selections),
      summary: summarizeForDisplay(groups, selections),
      priceEach: totalPriceEach,
    });
  };

  // ─── Render ───
  if (loading) {
    return (
      <div style={overlayStyle()}>
        <div style={{ color: '#fff', fontSize: 18 }}>Loading options…</div>
      </div>
    );
  }

  return (
    <div style={overlayStyle()}>
      {/* Top bar — image + back */}
      <div style={{ position: 'relative', width: '100%', height: '32vh', background: 'linear-gradient(135deg, ' + brandColor + ', ' + (brandAccent || brandColor) + ')', display: 'grid', placeItems: 'center', fontSize: 120, flexShrink: 0, overflow: 'hidden' }}>
        {item?.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '\ud83c\udf7d\ufe0f'}
        <button onClick={onCancel} style={{ position: 'absolute', top: 18, left: 18, width: 48, height: 48, borderRadius: 14, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', fontSize: 22, color: '#fff', border: 0, cursor: 'pointer' }}>←</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 16px' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>{item?.name}</div>
        {item?.description && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 14 }}>{item.description}</div>
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
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{g.name}</div>
                {picked.length > 0 && remaining > 0 && !g._isSingle && (
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>{picked.length} / {g._max}</div>
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
                      color: '#fff',
                    }}>
                      <button onClick={() => incOption(g, opt.id)} disabled={!isSelected && atCap} style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 14,
                        background: 'transparent', border: 0, padding: 0,
                        cursor: (atCap && !isSelected) ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: 'inherit', textAlign: 'left',
                        opacity: (atCap && !isSelected) ? 0.4 : 1,
                      }}>
                        <span style={{
                          flexShrink: 0,
                          width: 28, height: 28,
                          borderRadius: g._isSingle ? '50%' : 7,
                          border: '2px solid ' + (isSelected ? brandColor : 'rgba(255,255,255,0.3)'),
                          display: 'grid', placeItems: 'center',
                          background: isSelected ? brandColor : 'transparent',
                          color: '#fff', fontSize: 14, fontWeight: 800,
                        }}>{isSelected ? (g._isSingle ? '✓' : optCount) : ''}</span>
                        <span style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{opt.name}</span>
                        {priceLabel && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>{priceLabel}</span>}
                      </button>
                      {showStepper && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); decOption(g, opt.id); }} style={{
                            width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
                            border: 0, color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}>−</button>
                          <button onClick={(e) => { e.stopPropagation(); incOption(g, opt.id); }} disabled={atCap} style={{
                            width: 36, height: 36, borderRadius: '50%', background: atCap ? 'rgba(255,255,255,0.04)' : brandColor,
                            border: 0, color: '#fff', fontSize: 18, fontWeight: 700, cursor: atCap ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
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

      {/* Bottom CTA bar */}
      <div style={{ padding: '14px 22px 22px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 100, padding: 4 }}>
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
    background: '#0e0e10',
    color: '#fff',
    display: 'flex', flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };
}
function qtyBtn() {
  return { width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#fff', border: 0, fontSize: 20, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
}
