/**
* KioskApp — v5.1
*
* The full customer-facing kiosk experience. 8 screens + tip + table-number flow.
*
* Driven by:
*   - device + device_profile (kiosk_brand_*, kiosk_table_mode, kiosk_tip_presets, etc.)
*   - active menu (resolved from device_profile.menu_id, or schedule resolver)
*   - menu_items, menu_categories, menu_category_links
*
* Persists to:
*   - closed_checks (with source='kiosk', kiosk_id, customer_name, customer_phone, tip_amount, kiosk_table_number)
*   - kds_tickets (so the kitchen sees the order immediately)
*
* Idle timeout: 60s no input → 'still there?' overlay 10s countdown → reset to attract
*
* Layout: portrait. Designed for 27" touchscreen tablets in portrait orientation.
* Responsive: scales by viewport width; min target sizes 60x60px for touch.
*/

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase, getLocationId } from '../lib/supabase';
import { useStore } from '../store';
import KioskProductModal from './KioskProductModal';
import { t, setLang, useKioskLang, LANGUAGES, getLanguageMeta } from '../lib/i18n';

// ============================================================
// HOOKS
// ============================================================

// Loads the kiosk's device row + its device_profile row.
function useKioskProfile(kioskId) {
  const [device, setDevice] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!kioskId) { setLoading(false); return; }
      try {
        const { data: dev, error: e1 } = await supabase
          .from('devices').select('*').eq('id', kioskId).maybeSingle();
        if (e1) throw e1;
        if (!alive) return;
        setDevice(dev);
        if (dev?.profile_id) {
          const { data: prof, error: e2 } = await supabase
            .from('device_profiles').select('*').eq('id', dev.profile_id).maybeSingle();
          if (e2) throw e2;
          if (alive) setProfile(prof);
        }
      } catch (e) {
        if (alive) setError(e?.message || 'Failed to load kiosk profile');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [kioskId]);

  return { device, profile, loading, error };
}

// Loads menu data scoped to this location. Returns items, categories, links, menus.
// Uses the active-menu resolver (matching POS) so timed menus work.
function useKioskMenu(profile, locationId) {
  const [data, setData] = useState({ items: [], categories: [], menus: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  // 60-second tick for active-menu re-resolution (timed menus auto-switch)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!locationId) { setLoading(false); return; }
      try {
        const [iRes, cRes, mRes, lRes] = await Promise.all([
          supabase.from('menu_items').select('*').eq('location_id', locationId).eq('archived', false).order('sort_order'),
          supabase.from('menu_categories').select('*').eq('location_id', locationId).order('sort_order'),
          supabase.from('menus').select('*').eq('location_id', locationId).eq('is_active', true),
          supabase.from('menu_category_links').select('*'),
        ]);
        if (!alive) return;
        setData({
          items: iRes.data || [],
          categories: cRes.data || [],
          menus: mRes.data || [],
          links: lRes.data || [],
        });
      } catch (e) {
        if (alive) setError(e?.message || 'Failed to load menu');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [locationId]);

  // Resolve active menu — same logic as POSSurface v4.6.5
  const activeMenuId = useMemo(() => {
    const now = new Date();
    const day = now.getDay() || 7;
    const time = now.getHours() * 60 + now.getMinutes();
    const isActive = (m) => {
      if (!m.schedule) return true;
      const s = m.schedule;
      if (s.days && Array.isArray(s.days) && !s.days.includes(day)) return false;
      if (s.from && s.to) {
        const [fh, fm] = s.from.split(':').map(Number);
        const [th, tm] = s.to.split(':').map(Number);
        const fromMin = fh * 60 + fm;
        const toMin = th * 60 + tm;
        if (fromMin <= toMin) return time >= fromMin && time <= toMin;
        return time >= fromMin || time <= toMin;
      }
      return true;
    };
    const allMenus = data.menus;
    const activeNow = allMenus.filter(isActive);
    const preferred = profile?.menu_id;
    if (preferred && activeNow.some(m => m.id === preferred)) return preferred;
    if (activeNow.length > 0) return activeNow.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0))[0].id;
    const def = allMenus.find(m => m.is_default);
    if (def) return def.id;
    if (preferred) return preferred;
    return null;
  }, [data.menus, profile?.menu_id, tick]);

  return { ...data, activeMenuId, loading, error };
}

// ============================================================
// PRICING
// ============================================================

// Same resolver shape as store.getItemPrice. menu+channel → menu.all → channel → base.
function resolvePrice(item, orderType, menuId) {
  const p = item?.pricing;
  if (!p) return item?.price || 0;
  const KEY_MAP = { 'dine-in': 'dineIn', dineIn: 'dineIn', takeaway: 'takeaway', collection: 'collection', delivery: 'delivery' };
  const key = KEY_MAP[orderType] || 'dineIn';
  if (menuId && p.menus && p.menus[menuId]) {
    const tier = p.menus[menuId];
    if (tier[key] !== null && tier[key] !== undefined) return tier[key];
    if (tier.all !== null && tier.all !== undefined) return tier.all;
  }
  return (p[key] !== null && p[key] !== undefined) ? p[key] : (p.base || 0);
}

// ============================================================
// MAIN ORCHESTRATOR
// ============================================================

export default function KioskApp({ kioskId, onUnpair }) {
  // Profile + menu data
  const { device, profile, loading: profLoading, error: profError } = useKioskProfile(kioskId);
  const [locationId, setLocationId] = useState(null);
  useEffect(() => { getLocationId().then(setLocationId).catch(() => {}); }, []);
  const { items, categories, menus, links, activeMenuId, loading: menuLoading, error: menuError } = useKioskMenu(profile, locationId);

  // ─── Cart + flow state ───
  const [screen, setScreen] = useState('attract');
  const [orderType, setOrderType] = useState(null); // 'dineIn' | 'takeaway'
  // v5.4.0: allergen filter
  const [allergenFilter, setAllergenFilter] = useState(new Set());
  const [showAllergenPicker, setShowAllergenPicker] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [cart, setCart] = useState([]); // [{ key, item, qty, mods, linePrice, lineTotal, name }]
  const [tip, setTip] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // v5.5.18: kiosk language (i18n). Subscribes via useKioskLang() so any
  // setLang() call from the picker re-renders this component + children.
  const lang = useKioskLang();
  const [showLangPicker, setShowLangPicker] = useState(false);

  // ─── Branding (from profile, fallbacks) ───
  const brandName = profile?.kiosk_brand_name || device?.name || 'Order here';
  const brandColor = profile?.kiosk_brand_color || '#f97316';
  const brandAccent = profile?.kiosk_brand_accent_color || '#fbbf24';
  const brandBg = profile?.kiosk_brand_bg_color || '#0e0e10';
  const brandLogoUrl = profile?.kiosk_brand_logo_url;
  const attractVideoUrl = profile?.kiosk_attract_video_url;
  const banners = Array.isArray(profile?.kiosk_banners) ? profile.kiosk_banners : [];
  const tipPresets = profile?.kiosk_tip_presets || [10, 12.5, 15];
  const tableMode = profile?.kiosk_table_mode || 'either';
  const loyaltyEnabled = profile?.kiosk_loyalty_enabled !== false;
  const idleTimeoutSec = profile?.kiosk_idle_timeout_sec || 60;
  const avgWaitMinutes = profile?.kiosk_avg_wait_minutes || 8;
  const bannerFor = (screen) => banners.find(b => b.screen === screen && b.imageUrl);
  // v5.3.4: theme is dominant. brand_bg_color only takes effect if it visually matches the theme
  // (avoids the bug where saving a dark bg via the picker AND switching to light theme leaves a dark bg).
  const themeMode = profile?.kiosk_theme_mode === 'light' ? 'light' : 'dark';
  const isLight = themeMode === 'light';
  const themeDefaultBg = isLight ? '#fafafa' : '#0e0e10';
  const customBg = profile?.kiosk_brand_bg_color;
  // Decide if the saved bg color is compatible with the chosen theme. If it's not (e.g. dark hex on light theme), fall back to theme default.
  const looksLight = (hex) => {
    if (!hex || !hex.startsWith('#')) return false;
    const n = parseInt(hex.slice(1), 16);
    if (isNaN(n)) return false;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (r * 0.299 + g * 0.587 + b * 0.114) > 180;
  };
  const customMatchesTheme = customBg && (isLight ? looksLight(customBg) : !looksLight(customBg));
  const effectiveBg = customMatchesTheme ? customBg : themeDefaultBg;
  // v5.5.0: fg/fgMuted/surfaceCard removed — these now live in globals.css under
  // [data-kiosk-theme="light|dark"]. Use var(--kFg)/var(--kFgMuted)/var(--kSurface1) etc.
  const labelTapToOrder = profile?.kiosk_label_tap_to_order || 'TAP TO ORDER';
  const labelAddToOrder = profile?.kiosk_label_add_to_order || 'Add to order';
  const labelPlaceOrder = profile?.kiosk_label_place_order || 'Place order';
  // Debug log so we can verify what's loaded
  if (typeof window !== 'undefined' && !window.__kioskLogged) {
    window.__kioskLogged = true;
    console.log('[kiosk] profile loaded', { themeMode, effectiveBg, labelTapToOrder, labelAddToOrder, labelPlaceOrder, brandColor: profile?.kiosk_brand_color });
  }

  // ─── Filtered menu (cats + items belonging to active menu) ───
  const visibleCategories = useMemo(() => {
    const linkedIds = new Set(links.filter(l => l.menu_id === activeMenuId).map(l => l.category_id));
    // v5.3.1: include sub-categories (Coffee under Drinks, etc). Only filter out is_special.
    return categories
      .filter(c => !c.is_special)
      .filter(c => !activeMenuId || c.menu_id === activeMenuId || linkedIds.has(c.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [categories, links, activeMenuId]);

  const visibleItems = useMemo(() => {
    if (!selectedCategoryId) return [];
    return items
      // v5.3.1: hide variant children — kiosk shows parent, modal handles size selection
      .filter(i => !i.parent_id)
      .filter(i => (i.visibility?.kiosk !== false))
      .filter(i => i.cat === selectedCategoryId || (Array.isArray(i.cats) && i.cats.includes(selectedCategoryId)))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [items, selectedCategoryId]);

  // Auto-pick first cat when menu loads
  useEffect(() => {
    if (!selectedCategoryId && visibleCategories.length > 0) {
      setSelectedCategoryId(visibleCategories[0].id);
    }
  }, [visibleCategories, selectedCategoryId]);

  // ─── Cart totals ───
  const subtotal = useMemo(() => cart.reduce((a, l) => a + l.lineTotal, 0), [cart]);
  const total = useMemo(() => subtotal + tip, [subtotal, tip]);
  const cartItemCount = useMemo(() => cart.reduce((a, l) => a + l.qty, 0), [cart]);

  // ─── Idle timer ───
  const lastActivityRef = useRef(Date.now());
  const [idleWarning, setIdleWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(10);
  const resetIdle = useCallback(() => { lastActivityRef.current = Date.now(); setIdleWarning(false); setWarningCountdown(10); }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const idle = (Date.now() - lastActivityRef.current) / 1000;
      // Don't show idle warning on attract screen — that's its resting state
      if (screen === 'attract') return;
      if (!idleWarning && idle > idleTimeoutSec) {
        setIdleWarning(true); setWarningCountdown(10);
      } else if (idleWarning) {
        setWarningCountdown(c => {
          if (c <= 1) {
            // Reset session
            resetSession();
            return 10;
          }
          return c - 1;
        });
      }
    }, 1000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, idleWarning, idleTimeoutSec]);

  const resetSession = useCallback(() => {
    setScreen('attract');
    setOrderType(null);
    setTableNumber('');
    setCart([]);
    setTip(0);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedItem(null);
    setSelectedCategoryId(null);
    setAllergenFilter(new Set());
    setShowAllergenPicker(false);
    setOrderNumber(null);
    setSubmitError(null);
    setIdleWarning(false);
    setWarningCountdown(10);
    lastActivityRef.current = Date.now();
  }, []);

  // ─── Cart actions ───
  const addToCart = useCallback((item, qty = 1, selectedMods = {}, summaryOverride = null, priceEachOverride = null, modsArrayOverride = null, instructions = '') => {
    const linePrice = priceEachOverride ?? resolvePrice(item, orderType, activeMenuId);
    const modSummary = summaryOverride ?? Object.entries(selectedMods)
      .filter(([, v]) => v)
      .map(([k, v]) => Array.isArray(v) ? v.join(', ') : v)
      .join(' · ');
    let modsArray = Array.isArray(modsArrayOverride) ? [...modsArrayOverride] : [];
    // v5.4.0: append instructions as a special mod entry so POS / kitchen sees it
    if (instructions && instructions.trim()) {
      modsArray.push({ label: instructions.trim(), price: 0, groupLabel: 'Note', _instruction: true });
    }
    const key = item.id + ':' + JSON.stringify(selectedMods);
    setCart(prev => {
      const existing = prev.find(l => l.key === key);
      if (existing) {
        return prev.map(l => l.key === key
          ? { ...l, qty: l.qty + qty, lineTotal: (l.qty + qty) * l.linePrice }
          : l
        );
      }
      return [...prev, {
        key,
        item,
        name: item.name,
        qty,
        mods: modSummary + ((instructions && instructions.trim()) ? ((modSummary ? ' · ' : '') + 'Note: ' + instructions.trim()) : ''),
        modsArray,
        instructions: instructions || '',
        linePrice,
        lineTotal: qty * linePrice,
      }];
    });
    resetIdle();
  }, [orderType, activeMenuId, resetIdle]);

  const updateCartQty = useCallback((key, delta) => {
    setCart(prev => prev
      .map(l => l.key === key ? { ...l, qty: Math.max(0, l.qty + delta), lineTotal: Math.max(0, l.qty + delta) * l.linePrice } : l)
      .filter(l => l.qty > 0)
    );
    resetIdle();
  }, [resetIdle]);

  // ─── Order submission ───
  // On 'simulate paid' → write closed_checks + kds_tickets row, set orderNumber, advance.
  const submitOrder = useCallback(async (nameOverride, phoneOverride) => {
    if (submitting) return;
    console.log('[kiosk] submitOrder called', { nameOverride, phoneOverride, customerName, customerPhone });
    setSubmitting(true);
    setSubmitError(null);
    try {
      const checkId = (crypto.randomUUID ? crypto.randomUUID() : 'cc-' + Date.now());
      // v5.5.8: use atomic per-location counter instead of (Date.now() % 1000).
      // Old approach collided every ~1 second (millis-of-current-second wraps fast)
      // and gave 3-digit numbers that customers found confusing. New format: R1-R99
      // cycle, single source of truth across kiosk + POS + bar at this location.
      const { getNextOrderRef } = await import('../lib/db');
      const num = (await getNextOrderRef(locationId)) || ('R' + (Date.now() % 99 + 1));
      const orderTypeOut = orderType === 'dineIn' ? 'dine-in' : 'takeaway';
      const itemsPayload = cart.map(l => ({
        id: l.item.id,
        name: l.name,
        qty: l.qty,
        price: l.linePrice,
        // POS expects mods as array of { label, price, groupLabel }
        mods: Array.isArray(l.modsArray) ? l.modsArray : [],
        cat: l.item.cat,
      }));
      // 1. closed_checks
      const { error: e1 } = await supabase.from('closed_checks').insert({
        id: checkId,
        location_id: locationId,
        ref: num,
        items: itemsPayload,
        subtotal: subtotal,
        tip: tip,
        tax: 0,
        total: total,
        order_type: orderTypeOut,
        status: 'paid',
        payment_method: 'card-external',
        method: 'card',
        closed_at: new Date().toISOString(),
        source: 'kiosk',
        kiosk_id: kioskId,
        customer: (nameOverride ?? customerName) || null,
        customer_phone: (phoneOverride ?? customerPhone) || null,
        kiosk_table_number: tableNumber || null,
        covers: 1,
      });
      if (e1) throw e1;
      // 2. v5.5.5: customer attribution — kiosks were missing this path, so a customer
      // who ordered at the kiosk was stamped on the closed_check (customer name + phone)
      // but never made it into the customers table, customer_locations junction, or
      // customer_orders. The same phone at another location (same org) wouldn't dedupe
      // either — the existing customer record stayed un-updated, and no per-location
      // visit row was added. POS close paths (recordClosedCheck, recordWalkInClosedCheck,
      // recordWalkInClosed) already do this; kiosk now matches behaviour.
      const finalName = (nameOverride ?? customerName) || null;
      const finalPhone = (phoneOverride ?? customerPhone) || null;
      if (finalPhone) {
        try {
          const orderRecord = {
            id: checkId,
            ref: num,
            total: total,
            tip: tip,
            subtotal: subtotal,
            items: itemsPayload,
            method: 'card',
            order_type: orderTypeOut,
            location_id: locationId,
            closedAt: Date.now(),
            source: 'kiosk',
          };
          // Fire-and-forget — a CRM blip should never block order completion.
          useStore.getState().attributeOrderToCustomer({
            customer: { name: finalName || 'Customer', phone: finalPhone },
            orderRecord,
          }).catch(err => console.warn('[kiosk] attributeOrderToCustomer failed:', err?.message || err));
        } catch (e) {
          console.warn('[kiosk] customer attribution dispatch failed:', e?.message || e);
        }
      }
      // 3. kds_tickets — fire to kitchen
      const ticketId = (crypto.randomUUID ? crypto.randomUUID() : 'tk-' + Date.now());
      const { error: e2 } = await supabase.from('kds_tickets').insert({
        id: ticketId,
        location_id: locationId,
        course: 1,
        all_courses: [1],
        fired_courses: [1],
        items: itemsPayload,
        status: 'fired',
        sent_at: new Date().toISOString(),
        table_id: null,
        table_label: tableNumber ? ('T' + tableNumber) : ('Kiosk ' + num),
        server: (nameOverride ?? customerName) || ('Kiosk ' + num),
        covers: 1,
      });
      if (e2) console.warn('[kiosk] kds insert failed:', e2);
      // 4. Heartbeat
      await supabase.from('devices').update({ last_seen: new Date().toISOString() }).eq('id', kioskId);
      setOrderNumber(num);
      setScreen('done');
      // Auto-reset to attract after 30s on done screen
      setTimeout(() => resetSession(), 30000);
    } catch (e) {
      console.error('[kiosk] submit failed', e);
      setSubmitError(e?.message || 'Order submission failed. Please ask staff for help.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, kioskId, locationId, cart, subtotal, total, tip, orderType, customerName, customerPhone, tableNumber, resetSession]);

  // ─── Loading + error gates ───
  if (profLoading || menuLoading) {
    return <div style={pageStyle()}><div style={{ color: 'var(--kFg)', fontSize: 18 }}>Loading…</div></div>;
  }
  if (profError || menuError || !device || !profile) {
    return <div style={pageStyle()}>
      <div style={{ color: 'var(--kFg)', textAlign: 'center', padding: 40, maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Kiosk not configured</div>
        <div style={{ fontSize: 14, color: 'var(--kFgMuted)', marginBottom: 24 }}>{profError || menuError || 'Profile not found. Please ask staff.'}</div>
        <button onClick={onUnpair} style={btnGhostLight()}>Unpair</button>
      </div>
    </div>;
  }

  // ─── Render ───
  return (
    <div onPointerDown={resetIdle} data-kiosk-theme={isLight ? "light" : "dark"} style={kioskShell(brandColor, effectiveBg, brandAccent)}>
      {screen === 'attract' && <ScreenAttract brandName={brandName} brandColor={brandColor} brandAccent={brandAccent} brandLogoUrl={brandLogoUrl} attractVideoUrl={attractVideoUrl} avgWaitMinutes={avgWaitMinutes} banner={bannerFor('attract')} ctaLabel={labelTapToOrder} onStart={() => { resetIdle(); setScreen('orderType'); }} />}
      {screen === 'orderType' && <ScreenOrderType brandColor={brandColor} brandLogoUrl={brandLogoUrl} brandName={brandName} tableMode={tableMode} lang={lang} onOpenLanguagePicker={() => setShowLangPicker(true)} onPick={(t) => {
        setOrderType(t);
        if (t === 'dineIn' && (tableMode === 'enter' || tableMode === 'either')) setScreen('tableNumber');
        else setScreen('menu');
      }} onBack={() => setScreen('attract')} />}
      {screen === 'tableNumber' && <ScreenTableNumber brandColor={brandColor} value={tableNumber} onChange={setTableNumber} onContinue={() => setScreen('menu')} onBack={() => setScreen('orderType')} />}
      {screen === 'menu' && <ScreenMenu brandColor={brandColor} brandAccent={brandAccent} categories={visibleCategories} items={visibleItems} selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} onSelectItem={(item) => { setSelectedItem(item); setScreen('item'); }} cartItemCount={cartItemCount} subtotal={subtotal} onCart={() => setScreen('cart')} orderType={orderType} activeMenuId={activeMenuId} banner={bannerFor('menu')} allergenFilter={allergenFilter} onShowAllergenPicker={() => setShowAllergenPicker(true)} onBack={() => setScreen('orderType')} />}
      {screen === 'item' && selectedItem && (
        <KioskProductModal
          item={selectedItem}
          allItems={items}
          brandColor={brandColor}
          brandAccent={brandAccent}
          addLabel={labelAddToOrder}
          basePrice={resolvePrice(selectedItem, orderType, activeMenuId)}
          onAdd={({ qty, selections, summary, priceEach, mods, instructions }) => {
            addToCart(selectedItem, qty, selections, summary, priceEach, mods, instructions);
            setScreen('menu');
          }}
          onCancel={() => setScreen('menu')}
        />
      )}
      {screen === 'cart' && <ScreenCart brandColor={brandColor} cart={cart} subtotal={subtotal} onUpdate={updateCartQty} onAddMore={() => setScreen('menu')} onContinue={() => setScreen('tip')} onBack={() => setScreen('menu')} />}
      {screen === 'tip' && <ScreenTip brandColor={brandColor} subtotal={subtotal} tipPresets={tipPresets} tip={tip} onSetTip={setTip} onContinue={() => setScreen('pay')} onBack={() => setScreen('cart')} />}
      {screen === 'pay' && <ScreenPay brandColor={brandColor} total={total} submitting={submitting} error={submitError} onSimulatePaid={() => { if (loyaltyEnabled) setScreen('loyalty'); else submitOrder('', ''); }} onBack={() => setScreen('tip')} />}
      {screen === 'loyalty' && <ScreenLoyalty brandColor={brandColor} customerName={customerName} customerPhone={customerPhone} onName={setCustomerName} onPhone={setCustomerPhone} onContinue={(n, p) => submitOrder(n, p)} onSkip={(n, p) => submitOrder(n, p)} submitting={submitting} placeOrderLabel={labelPlaceOrder} />}
      {screen === 'done' && <ScreenDone brandColor={brandColor} customerName={customerName} customerPhone={customerPhone} orderNumber={orderNumber} orderType={orderType} tableNumber={tableNumber} avgWaitMinutes={avgWaitMinutes} banner={bannerFor('done')} onDone={resetSession} />}

      {/* v5.4.0: Allergen picker overlay */}
      {showAllergenPicker && (
        <AllergenPickerOverlay
          brandColor={brandColor}
          allergens={Array.from(new Set(items.flatMap(i => Array.isArray(i.allergens) ? i.allergens : [])))}
          selected={allergenFilter}
          onChange={setAllergenFilter}
          onClose={() => setShowAllergenPicker(false)}
        />
      )}

      {/* v5.5.18: Language picker overlay */}
      {showLangPicker && (
        <ScreenLanguagePicker
          brandColor={brandColor}
          currentLang={lang}
          onPick={(code) => { setLang(code); setShowLangPicker(false); }}
          onClose={() => setShowLangPicker(false)}
        />
      )}

      {/* Idle warning overlay */}
      {idleWarning && screen !== 'attract' && screen !== 'done' && (
        <div onClick={resetIdle} style={{ position: 'fixed', inset: 0, background: 'var(--kOverlay)', display: 'grid', placeItems: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ background: 'var(--kSurfaceRaised)', border: '2px solid ' + brandColor, borderRadius: 24, padding: '40px 36px', maxWidth: 400, textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--kFg)', marginBottom: 8 }}>Still there?</div>
            <div style={{ fontSize: 14, color: 'var(--kFgMuted)', marginBottom: 24 }}>This order will reset in {warningCountdown}s</div>
            <div style={{ background: brandColor, color: 'var(--kFg)', padding: '14px 28px', borderRadius: 100, fontSize: 16, fontWeight: 700 }}>Tap to continue</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARED STYLES
// ============================================================

// v5.5.0: theme vars now live in globals.css under [data-kiosk-theme="light|dark"].
// kioskShell only sets the brand colors (which are per-org, not theme-bound) and
// the background — light/dark fg/surfaces/borders flip via CSS.
function kioskShell(brandColor, brandBg, brandAccent) {
  return {
    position: 'fixed',
    inset: 0,
    background: brandBg || 'var(--kSurfaceShell)',
    color: 'var(--kFg)',
    '--kBrand': brandColor || '#ff7070',
    '--kBrandAccent': brandAccent || brandColor || '#ff7070',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    overflow: 'hidden',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };
}
function pageStyle() {
  return {
    position: 'fixed', inset: 0,
    background: 'var(--kSurfaceShell)',
    color: 'var(--kFg)',
    display: 'grid',
    placeItems: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  };
}
function btnGhostLight() {
  return { background: 'transparent', border: '1px solid var(--kBorder2)', color: 'var(--kFgMuted)', padding: '10px 22px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
}

// ============================================================
// SCREEN: ATTRACT
// ============================================================
function ScreenAttract({ brandName, brandColor, brandAccent, brandLogoUrl, attractVideoUrl, avgWaitMinutes, banner, ctaLabel, onStart }) {
  const accentEnd = brandAccent || shade(brandColor, -20);
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = attractVideoUrl && !videoFailed;
  const useBannerAsBackground = (!attractVideoUrl || videoFailed) && banner && banner.imageUrl;
  return (
    <div onClick={onStart} style={{ position: 'absolute', inset: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(135deg, ' + brandColor + ' 0%, ' + accentEnd + ' 100%)' }}>
      {showVideo ? (
        <video src={attractVideoUrl} autoPlay loop muted playsInline
          onError={(e) => { console.warn('[kiosk] attract video failed to load (browser may not support format — try MP4):', attractVideoUrl, e); setVideoFailed(true); }}
          onLoadedData={() => console.log('[kiosk] attract video loaded')}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : useBannerAsBackground ? (
        <img src={banner.imageUrl} alt={banner.label || brandName} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
      <div style={{ position: 'absolute', inset: 0, background: (attractVideoUrl || useBannerAsBackground) ? 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)' : 'radial-gradient(circle at 70% 30%, var(--kBorder2), transparent 60%)' }} />
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5vw', zIndex: 1 }}>
        {brandLogoUrl ? (
          <img src={brandLogoUrl} alt={brandName} style={{ maxWidth: '50%', maxHeight: '20vh', marginBottom: '3vh', objectFit: 'contain' }} />
        ) : null}
        <div style={{ fontSize: 'clamp(48px, 9vw, 96px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', textAlign: 'center', lineHeight: 1, marginBottom: '2vh', textShadow: '0 4px 30px rgba(0,0,0,0.3)' }}>{brandName}</div>
        {/* v5.4.0: subtitle removed */}
        {avgWaitMinutes ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', borderRadius: 100, fontSize: 'clamp(13px, 1.8vw, 18px)', fontWeight: 600, color: '#fff', marginBottom: '6vh' }}>⏱ ~{avgWaitMinutes} min wait</div>
        ) : null}
        <div style={{ background: '#fff', color: shade(brandColor, -30), padding: 'clamp(18px, 3vh, 28px) clamp(40px, 8vw, 100px)', borderRadius: 100, fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, boxShadow: '0 10px 40px rgba(0,0,0,0.25)', animation: 'kioskPulse 2s infinite', letterSpacing: '-0.02em' }}>{ctaLabel || 'TAP TO ORDER'}</div>
      </div>
      <div style={{ position: 'relative', padding: '0 30px 30px', fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', zIndex: 1 }}>Tap anywhere to begin</div>
      <style>{'@keyframes kioskPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }'}</style>
    </div>
  );
}
function shade(hex, percent) {
  // simple hex-shade helper
  if (!hex || !hex.startsWith('#')) return hex;
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + Math.round(255 * percent / 100);
  let g = ((num >> 8) & 0xff) + Math.round(255 * percent / 100);
  let b = (num & 0xff) + Math.round(255 * percent / 100);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ============================================================
// SCREEN: ORDER TYPE  (v5.5.18 redesign)
// Light surface, brand logo at top, outline cards with line-art
// SVG icons in brand color, language picker pill at the bottom.
// ============================================================
function ScreenOrderType({ brandColor, brandLogoUrl, brandName, tableMode, lang, onOpenLanguagePicker, onPick, onBack }) {
  const dineInAvailable = tableMode !== 'none';
  const langMeta = getLanguageMeta(lang);
  // Force re-render of t() strings when lang changes (parent already
  // subscribes via useKioskLang, but listing lang in deps for clarity).
  const title = t('orderType.title');
  return (
    <div style={fullScreen()}>
      {/* Subtle back button, top-left corner */}
      <div style={{ padding: '20px 22px 0', flexShrink: 0 }}>
        <button onClick={onBack} aria-label={t('common.back')} style={iconBtn()}>←</button>
      </div>

      {/* Logo */}
      <div style={{ padding: '12px 24px 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        {brandLogoUrl ? (
          <img
            src={brandLogoUrl}
            alt={brandName || 'Brand logo'}
            style={{ maxWidth: '70%', maxHeight: '14vh', minHeight: 60, objectFit: 'contain' }}
          />
        ) : (
          <div style={{ fontSize: 'clamp(28px, 4.2vw, 44px)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--kFg)' }}>
            {brandName || 'Order here'}
          </div>
        )}
      </div>

      {/* Title */}
      <div style={{ padding: '4vh 6vw 3vh', textAlign: 'center', flexShrink: 0 }}>
        <div style={{
          fontSize: 'clamp(30px, 5vw, 48px)',
          fontWeight: 800,
          letterSpacing: '-0.01em',
          color: brandColor,
          lineHeight: 1.15,
        }}>{title}</div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, padding: '0 6vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: dineInAvailable ? '1fr 1fr' : '1fr',
          gap: 'clamp(14px, 2.5vw, 24px)',
          width: '100%',
          maxWidth: 720,
        }}>
          {dineInAvailable && (
            <button onClick={() => onPick('dineIn')} style={otOutlineCard(brandColor)} aria-label={t('orderType.eatIn')}>
              <div style={otIconWrap()}>
                <EatInIcon color={brandColor} />
              </div>
              <div style={otCardLabel(brandColor)}>{t('orderType.eatIn')}</div>
            </button>
          )}
          <button onClick={() => onPick('takeaway')} style={otOutlineCard(brandColor)} aria-label={t('orderType.takeaway')}>
            <div style={otIconWrap()}>
              <TakeawayIcon color={brandColor} />
            </div>
            <div style={otCardLabel(brandColor)}>{t('orderType.takeaway')}</div>
          </button>
        </div>
      </div>

      {/* Language pill */}
      <div style={{ padding: '3vh 6vw 4vh', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <button onClick={onOpenLanguagePicker} style={otLanguagePill(brandColor)} aria-label="Choose language">
          <span style={{ fontSize: 22, lineHeight: 1 }}>{langMeta.flag}</span>
          <span style={{ fontSize: 'clamp(15px, 1.8vw, 18px)', fontWeight: 700, color: brandColor }}>
            {langMeta.nativeName}
          </span>
        </button>
      </div>
    </div>
  );
}

// ----- ScreenOrderType styles + icon components -----

function otOutlineCard(brandColor) {
  return {
    background: 'var(--kSurfaceRaised)',
    border: '1.5px solid var(--kBorder3)',
    borderRadius: 28,
    padding: 'clamp(18px, 2.5vw, 28px)',
    // Grid with fixed rows so icon area and label area align identically
    // across both cards. Row 1 takes all available space and centers the
    // icon; row 2 is auto-sized for the label and sits at a consistent
    // vertical position regardless of icon dimensions.
    display: 'grid',
    gridTemplateRows: '1fr auto',
    rowGap: 'clamp(10px, 1.6vw, 18px)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    aspectRatio: '4/5',
    minHeight: '28vh',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
    color: brandColor,
  };
}

function otIconWrap() {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    width: '100%',
  };
}

function otCardLabel(brandColor) {
  return {
    fontSize: 'clamp(20px, 3.2vw, 30px)',
    fontWeight: 700,
    color: brandColor,
    letterSpacing: '-0.01em',
    textAlign: 'center',
    lineHeight: 1.1,
  };
}

function otLanguagePill(brandColor) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    background: 'var(--kSurfaceRaised)',
    border: '1.5px solid var(--kBorder2)',
    borderRadius: 100,
    padding: '14px 28px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: brandColor,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };
}

function EatInIcon({ color = 'currentColor', size }) {
  // Line-art fork + knife in a 100x100 square viewBox so this renders
  // at the same visual dimensions as TakeawayIcon.
  return (
    <svg
      viewBox="0 0 100 100"
      width={size || 'min(60%, 140px)'}
      height={size || 'min(60%, 140px)'}
      style={{ display: 'block' }}
      fill="none"
      stroke={color}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Fork: 3 tines, head bowl, tapered handle, centered around x=34 */}
      <path d="M24 14 V38" />
      <path d="M34 14 V38" />
      <path d="M44 14 V38" />
      <path d="M24 38 H44 Q44 48 34 48 Q24 48 24 38 Z" />
      <path d="M34 48 V90" />
      {/* Knife: leaf blade + handle, centered around x=70 */}
      <path d="M70 14 Q62 28 65 50 L75 50 Q78 28 70 14 Z" />
      <path d="M70 50 V90" />
    </svg>
  );
}

function TakeawayIcon({ color = 'currentColor', size }) {
  // Classic takeout container with wire handle in a 100x100 square viewBox.
  return (
    <svg
      viewBox="0 0 100 100"
      width={size || 'min(60%, 140px)'}
      height={size || 'min(60%, 140px)'}
      style={{ display: 'block' }}
      fill="none"
      stroke={color}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Wire handle */}
      <path d="M28 26 Q50 8 72 26" strokeWidth="3.5" />
      {/* Top fold-over flap */}
      <path d="M22 32 H78" />
      <path d="M32 32 L50 40 L68 32" />
      {/* Container body */}
      <path d="M26 32 L34 88 H66 L74 32" />
      {/* Floor of box */}
      <path d="M34 88 H66" />
    </svg>
  );
}

// ============================================================
// SCREEN: LANGUAGE PICKER  (v5.5.18)
// ============================================================
function ScreenLanguagePicker({ brandColor, currentLang, onPick, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'var(--kOverlay)', display: 'grid', placeItems: 'center', zIndex: 250, padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--kSurfaceRaised)',
          border: '1.5px solid var(--kBorder2)',
          borderRadius: 24,
          padding: 'clamp(20px, 3vw, 32px)',
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontSize: 'clamp(20px, 3vw, 26px)', fontWeight: 800, color: brandColor, marginBottom: 18, textAlign: 'center' }}>
          {t('language.choose')}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {LANGUAGES.map(L => {
            const selected = L.code === currentLang;
            return (
              <button
                key={L.code}
                onClick={() => onPick(L.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                  background: selected ? brandColor : 'var(--kSurface1)',
                  color: selected ? '#fff' : 'var(--kFg)',
                  border: '1.5px solid ' + (selected ? brandColor : 'var(--kBorder2)'),
                  borderRadius: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 17,
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 26, lineHeight: 1 }}>{L.flag}</span>
                <span style={{ flex: 1 }}>{L.nativeName}</span>
                <span style={{ fontSize: 13, opacity: 0.75 }}>{L.name}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '14px',
            background: 'transparent',
            color: 'var(--kFgMuted)',
            border: '1.5px solid var(--kBorder2)',
            borderRadius: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {t('language.close')}
        </button>
      </div>
    </div>
  );
}


// ============================================================
// SCREEN: TABLE NUMBER
// ============================================================
function ScreenTableNumber({ brandColor, value, onChange, onContinue, onBack }) {
  const [val, setVal] = useState(value || '');
  const press = (k) => setVal(v => k === '⌫' ? v.slice(0, -1) : (v.length < 4 ? v + k : v));
  const submit = () => { if (val.trim()) { onChange(val.trim()); onContinue(); } };
  return (
    <div style={fullScreen()}>
      <ScreenHeader title="Your table number" subtitle="Find the number on your table and enter it below" onBack={onBack} brandColor={brandColor} />
      <div style={{ flex: 1, padding: '4vh 5vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: '3vh' }}>
        <div style={{ fontSize: 'clamp(70px, 14vw, 140px)', fontWeight: 900, letterSpacing: '-0.04em', color: brandColor, fontFamily: 'ui-monospace, monospace', minHeight: '1.2em' }}>{val || '—'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2vh', width: '100%', maxWidth: 520 }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            k === '' ? <div key={i} /> :
            <button key={i} onClick={() => press(k)} style={kpadKey()}>{k}</button>
          ))}
        </div>
        <button onClick={submit} disabled={!val.trim()} style={{ ...primaryCta(brandColor), opacity: val.trim() ? 1 : 0.4, marginTop: '2vh' }}>
          Continue →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN: MENU
// ============================================================
function ScreenMenu({ brandColor, brandAccent, categories, items, selectedCategoryId, onSelectCategory, onSelectItem, cartItemCount, subtotal, onCart, orderType, activeMenuId, banner, allergenFilter, onShowAllergenPicker, onBack }) {
  return (
    <div style={fullScreen()}>
      {/* top bar */}
      <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--kSurface2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={onBack} style={iconBtn()}>←</button>
          <button onClick={onCart} disabled={cartItemCount === 0} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: cartItemCount > 0 ? brandColor : 'var(--kBorder1)',
            color: cartItemCount > 0 ? '#fff' : 'var(--kFgFaint)',
            padding: '10px 18px', borderRadius: 100, fontWeight: 700, fontSize: 14,
            border: 0, fontFamily: 'inherit', cursor: cartItemCount > 0 ? 'pointer' : 'default',
          }}>
            🛒 Cart · {cartItemCount} · £{subtotal.toFixed(2)}
          </button>
        </div>
        {banner && banner.imageUrl && (
          <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 12, aspectRatio: '5/2', background: 'var(--kSurface1)' }}>
            <img src={banner.imageUrl} alt={banner.label || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        {/* v5.4.0: interactive allergen filter */}
        <button onClick={onShowAllergenPicker} style={{
          background: 'var(--kAllergen-bg)',
          border: '1px solid var(--kAllergen-border)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <div style={{ fontSize: 18 }}>⚠️</div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--kAllergen-fg)', fontWeight: 600 }}>
            {(allergenFilter && allergenFilter.size > 0)
              ? 'Avoiding: ' + Array.from(allergenFilter).join(', ') + ' — unsafe items shown faded'
              : 'Have allergies? Tap to filter the menu'}
          </div>
          <div style={{ fontSize: 16, color: 'var(--kAllergen-fg)', fontWeight: 700 }}>{(allergenFilter && allergenFilter.size > 0) ? 'Edit ›' : '›'}</div>
        </button>
        {/* category strip */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {categories.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, color: 'var(--kFgMuted)' }}>No categories on this menu yet.</div>
          ) : categories.map(c => {
            const active = c.id === selectedCategoryId;
            return (
              <button key={c.id} onClick={() => onSelectCategory(c.id)} style={{
                padding: '10px 18px',
                background: active ? brandColor : 'var(--kSurface2)',
                color: active ? '#fff' : 'var(--kFgMuted)',
                borderRadius: 100, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
                border: 0, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit',
              }}>{c.label}</button>
            );
          })}
        </div>
      </div>
      {/* item grid */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, alignContent: 'start' }}>
        {items.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 60, textAlign: 'center', color: 'var(--kFgMuted)' }}>No items in this category.</div>
        ) : items.map(it => {
          const price = resolvePrice(it, orderType, activeMenuId);
          // v5.4.0: check if item contains any flagged allergen
          const itemAllergens = Array.isArray(it.allergens) ? it.allergens.map(a => String(a).toLowerCase()) : [];
          const flagged = allergenFilter && Array.from(allergenFilter).some(a => itemAllergens.includes(String(a).toLowerCase()));
          return (
            <button key={it.id} onClick={() => onSelectItem(it)} style={{
              background: 'var(--kSurface1)',
              border: '1px solid ' + (flagged ? 'rgba(239,68,68,0.5)' : 'var(--kBorder1)'),
              borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left', padding: 0, color: 'var(--kFg)',
              opacity: flagged ? 0.45 : 1,
              position: 'relative',
              display: 'flex', flexDirection: 'column',
              minHeight: 290,
            }}>
              {flagged && (
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: '#ef4444', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>UNSAFE</div>
              )}
              <div style={{ width: '100%', height: 170, flexShrink: 0, background: 'var(--kImageBg)', display: 'grid', placeItems: 'center', fontSize: 60, overflow: 'hidden' }}>
                {it.image ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🍽️'}
              </div>
              <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, lineHeight: 1.25, letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.name}</div>
                <div style={{ fontSize: 13, color: 'var(--kFgMuted)', lineHeight: 1.35, marginBottom: 10, minHeight: 35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.description || ''}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: brandColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>£{Number(price).toFixed(2)}</div>
                  {Array.isArray(it.allergens) && it.allergens.length > 0 && (
                    <div style={{ fontSize: 10, padding: '3px 7px', borderRadius: 5, background: 'var(--kAllergen-bg)', color: 'var(--kAllergen-fg)', fontWeight: 700, letterSpacing: '0.05em' }}>{it.allergens.slice(0, 2).map(a => a[0].toUpperCase()).join(' ')}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// ============================================================
// SCREEN: CART
// ============================================================
function ScreenCart({ brandColor, cart, subtotal, onUpdate, onAddMore, onContinue, onBack }) {
  return (
    <div style={fullScreen()}>
      <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--kSurface2)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={iconBtn()}>←</button>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', flex: 1 }}>Your order</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 22px' }}>
        {cart.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--kFgMuted)' }}>Your cart is empty</div>
        ) : cart.map(l => (
          <div key={l.key} style={{ padding: '14px 0', borderBottom: '1px solid var(--kSurface1)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
              <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{l.name}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: brandColor, fontVariantNumeric: 'tabular-nums' }}>£{l.lineTotal.toFixed(2)}</div>
            </div>
            {l.mods && <div style={{ fontSize: 12, color: 'var(--kFgMuted)', marginBottom: 8 }}>{l.mods}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--kSurface1)', borderRadius: 100, padding: 3 }}>
                <button onClick={() => onUpdate(l.key, -1)} style={miniQtyBtn()}>−</button>
                <div style={{ fontSize: 14, fontWeight: 600, minWidth: 14, textAlign: 'center' }}>{l.qty}</div>
                <button onClick={() => onUpdate(l.key, +1)} style={miniQtyBtn()}>+</button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={onAddMore} style={{ display: 'block', width: '100%', textAlign: 'center', padding: 14, fontSize: 14, color: 'var(--kFgMuted)', background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add more items</button>
      </div>
      <div style={{ padding: '16px 22px', borderTop: '1px solid var(--kSurface2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, marginBottom: 0 }}>
          <span>Subtotal</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>£{subtotal.toFixed(2)}</span>
        </div>
      </div>
      <div style={{ padding: '14px 22px 22px', flexShrink: 0 }}>
        <button disabled={cart.length === 0} onClick={onContinue} style={{ ...primaryCta(brandColor), width: '100%', opacity: cart.length === 0 ? 0.4 : 1 }}>
          Continue →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN: TIP
// ============================================================
function ScreenTip({ brandColor, subtotal, tipPresets, tip, onSetTip, onContinue, onBack }) {
  const [customMode, setCustomMode] = useState(false);
  const [customStr, setCustomStr] = useState(tip > 0 ? tip.toFixed(2) : '');
  const pickPercent = (pct) => { onSetTip(+(subtotal * pct / 100).toFixed(2)); setCustomMode(false); };
  const pickNone = () => { onSetTip(0); setCustomMode(false); setCustomStr(''); };
  const setCustomFromInput = (s) => {
    setCustomStr(s);
    const v = parseFloat(s);
    onSetTip(isNaN(v) ? 0 : v);
  };
  const isPctActive = (pct) => Math.abs(tip - subtotal * pct / 100) < 0.01;
  return (
    <div style={fullScreen()}>
      <ScreenHeader title="Add a tip?" subtitle="Tips go directly to the team. Thank you!" onBack={onBack} brandColor={brandColor} />
      <div style={{ flex: 1, padding: '4vh 5vw', display: 'flex', flexDirection: 'column', gap: '2vh' }}>
        {tipPresets.map(pct => (
          <button key={pct} onClick={() => pickPercent(pct)} style={{
            ...bigCard(brandColor),
            borderColor: isPctActive(pct) ? brandColor : 'transparent',
            background: isPctActive(pct) ? 'rgba(249,115,22,0.06)' : 'var(--kSurface1)',
          }}>
            <div style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, color: brandColor, minWidth: '4ch' }}>{pct}%</div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 'clamp(13px, 1.7vw, 16px)', color: 'var(--kFgMuted)' }}>Tip amount</div>
              <div style={{ fontSize: 'clamp(20px, 2.8vw, 26px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>£{(subtotal * pct / 100).toFixed(2)}</div>
            </div>
          </button>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={pickNone} style={{ ...smallCard(brandColor), borderColor: tip === 0 ? brandColor : 'transparent', background: tip === 0 ? 'rgba(249,115,22,0.06)' : 'var(--kSurface1)' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>No tip</div>
          </button>
          <button onClick={() => setCustomMode(true)} style={{ ...smallCard(brandColor), borderColor: customMode ? brandColor : 'transparent', background: customMode ? 'rgba(249,115,22,0.06)' : 'var(--kSurface1)' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Custom amount</div>
          </button>
        </div>
        {customMode && (
          <div style={{ background: 'var(--kSurface1)', border: '1px solid var(--kSurface2)', borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--kFgMuted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Custom tip (£)</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 22, color: 'var(--kFgFaint)', fontFamily: 'ui-monospace, monospace' }}>£</span>
              <input type="number" step="0.01" min="0" value={customStr} onChange={e => setCustomFromInput(e.target.value)}
                placeholder="0.00" autoFocus
                style={{ width: '100%', padding: '14px 14px 14px 36px', background: 'var(--kSurface2)', border: '1px solid var(--kBorder1)', borderRadius: 10, color: 'var(--kFg)', fontSize: 22, fontFamily: 'ui-monospace, monospace', fontWeight: 700, outline: 'none' }} />
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 22px 22px', flexShrink: 0 }}>
        <button onClick={onContinue} style={{ ...primaryCta(brandColor), width: '100%' }}>
          Continue · £{(subtotal + tip).toFixed(2)} →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN: PAY
// ============================================================
function ScreenPay({ brandColor, total, submitting, error, onSimulatePaid, onBack }) {
  return (
    <div style={fullScreen()}>
      <ScreenHeader title="Tap or insert your card" subtitle="Use the card reader on the side of the kiosk" onBack={onBack} brandColor={brandColor} />
      <div style={{ flex: 1, padding: '6vh 5vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--kFgMuted)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Amount due</div>
          <div style={{ fontSize: 'clamp(60px, 12vw, 110px)', fontWeight: 900, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: 'var(--kFg)' }}>£{total.toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 'clamp(48px, 8vw, 72px)', color: brandColor, animation: 'kioskPoint 1.5s infinite' }}>→</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--kFgMuted)' }}>Card reader on the side</div>
        </div>
        <style>{'@keyframes kioskPoint { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(8px); } }'}</style>
        {error && (
          <div style={{ background: 'var(--kError-bg)', border: '1px solid var(--kError-border)', color: 'var(--kError-fg)', padding: '12px 16px', borderRadius: 10, fontSize: 13, maxWidth: 400, textAlign: 'center' }}>{error}</div>
        )}
      </div>
      <div style={{ padding: '14px 22px 22px', flexShrink: 0 }}>
        <button disabled={submitting} onClick={onSimulatePaid} style={{ ...primaryCta(brandColor), width: '100%', opacity: submitting ? 0.5 : 1 }}>
          {submitting ? 'Submitting…' : '✅ Simulate paid (demo) →'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--kFgFaint)' }}>Real card reader integration in v5.2</div>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN: LOYALTY (single-screen name + phone)
// ============================================================
function ScreenLoyalty({ brandColor, customerName, customerPhone, onName, onPhone, onContinue, onSkip, submitting, placeOrderLabel }) {
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState(customerPhone);
  const submit = () => {
    const n = name.trim();
    const p = phone.trim();
    onName(n);
    onPhone(p);
    onContinue(n, p);
  };
  const skip = () => { onName(''); onPhone(''); onSkip('', ''); };
  return (
    <div style={fullScreen()}>
      <ScreenHeader title="Almost done" subtitle="Add your details to receive your receipt" brandColor={brandColor} />
      <div style={{ flex: 1, padding: '4vh 5vw', display: 'flex', flexDirection: 'column', gap: '2vh' }}>
        <div>
          <label style={fieldLabel()}>Your name <span style={{ color: brandColor }}>*</span></label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Sarah"
            style={{ width: '100%', padding: '18px 20px', background: 'var(--kSurface1)', border: '2px solid var(--kBorder1)', borderRadius: 14, color: 'var(--kFg)', fontSize: 22, fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ fontSize: 11, color: 'var(--kFgMuted)', marginTop: 6 }}>Used to call you when your order is ready</div>
        </div>
        <div>
          <label style={fieldLabel()}>Mobile number <span style={{ color: 'var(--kFgFaint)' }}>(optional)</span></label>
          <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9 +]/g, ''))} placeholder="07*** *** ***" type="tel" inputMode="tel"
            style={{ width: '100%', padding: '18px 20px', background: 'var(--kSurface1)', border: '2px solid var(--kBorder1)', borderRadius: 14, color: 'var(--kFg)', fontSize: 22, fontFamily: 'ui-monospace, monospace', outline: 'none', letterSpacing: '0.04em' }} />
          <div style={{ fontSize: 11, color: 'var(--kFgMuted)', marginTop: 6 }}>We will text your receipt and a £5 voucher — no spam</div>
        </div>
      </div>
      <div style={{ padding: '14px 22px 22px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={submit} disabled={!name.trim() || submitting} style={{ ...primaryCta(brandColor), width: '100%', opacity: !name.trim() || submitting ? 0.4 : 1 }}>
          {submitting ? 'Placing order…' : ((placeOrderLabel || 'Place order') + ' →')}
        </button>
        <button onClick={skip} disabled={submitting} style={{ background: 'transparent', color: 'var(--kFgMuted)', padding: 12, borderRadius: 10, fontSize: 13, border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          Skip and place anonymously
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN: DONE (order number reveal)
// ============================================================
function ScreenDone({ brandColor, customerName, customerPhone, orderNumber, orderType, tableNumber, avgWaitMinutes, banner, onDone }) {
  const phoneMasked = customerPhone ? customerPhone.replace(/^(.{3}).+(.{3})$/, '$1*** *** $2') : null;
  // The Done screen uses a fixed celebration-green gradient regardless of kiosk theme,
  // so text must be white-on-dark in both light and dark modes.
  const W = '#fff';
  const Wm = 'rgba(255,255,255,0.72)';
  const Wf = 'rgba(255,255,255,0.42)';
  return (
    <div style={{ ...fullScreen(), background: 'linear-gradient(180deg, #1a4d2e 0%, #0d3520 100%)', color: W }}>
      {banner && banner.imageUrl && (
        <div style={{ width: '100%', maxHeight: '22vh', overflow: 'hidden', flexShrink: 0 }}>
          <img src={banner.imageUrl} alt={banner.label || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '6vw' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', fontSize: 60, color: W, marginBottom: 30, boxShadow: '0 0 80px rgba(34,197,94,0.5)' }}>✓</div>
        <div style={{ fontSize: 'clamp(22px, 3.6vw, 32px)', fontWeight: 700, marginBottom: 4, color: W }}>{customerName ? 'Thank you, ' + customerName + '!' : 'Thank you!'}</div>
        <div style={{ fontSize: 13, color: Wm, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 40, marginBottom: 12 }}>Your order number</div>
        <div style={{ fontSize: 'clamp(120px, 22vw, 220px)', fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.9, marginBottom: 20, fontVariantNumeric: 'tabular-nums', color: W }}>{orderNumber || '—'}</div>
        <div style={{ fontSize: 16, color: Wm, maxWidth: 360, lineHeight: 1.5, marginBottom: 8 }}>
          {orderType === 'dineIn' && tableNumber ? 'Your order will be brought to table ' + tableNumber + '.' : 'We will call your number when ready.'}
        </div>
        <div style={{ fontSize: 13, color: Wm, marginBottom: 40 }}>Average wait: {avgWaitMinutes || 8} mins</div>
        {phoneMasked && (
          <div style={{ fontSize: 13, color: Wm, marginBottom: 30 }}>📱 Receipt sent to {phoneMasked}</div>
        )}
        <button onClick={onDone} style={{ background: 'transparent', border: '1px solid ' + Wf, color: Wm, padding: '10px 24px', borderRadius: 100, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
      </div>
    </div>
  );
}

// ============================================================
// SHARED SCREEN HEADER
// ============================================================
function ScreenHeader({ title, subtitle, onBack, brandColor }) {
  return (
    <div style={{ padding: '24px 22px 16px', flexShrink: 0 }}>
      {onBack && <button onClick={onBack} style={iconBtn()}>←</button>}
      <div style={{ marginTop: onBack ? 16 : 0 }}>
        <div style={{ fontSize: 'clamp(28px, 4.8vw, 42px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 'clamp(13px, 1.8vw, 16px)', color: 'var(--kFgMuted)' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ============================================================
// ALLERGEN PICKER (v5.4.0)
// ============================================================
function AllergenPickerOverlay({ brandColor, allergens, selected, onChange, onClose }) {
  const COMMON = [
    { key: 'gluten', label: 'Gluten', icon: '🌾' },
    { key: 'dairy', label: 'Dairy', icon: '🥛' },
    { key: 'nuts', label: 'Nuts', icon: '🦜' },
    { key: 'peanuts', label: 'Peanuts', icon: '🥜' },
    { key: 'soy', label: 'Soy', icon: '🌱' },
    { key: 'egg', label: 'Egg', icon: '🥚' },
    { key: 'fish', label: 'Fish', icon: '🐟' },
    { key: 'shellfish', label: 'Shellfish', icon: '🦐' },
    { key: 'sesame', label: 'Sesame', icon: '🪴' },
    { key: 'mustard', label: 'Mustard', icon: '🌶' },
    { key: 'celery', label: 'Celery', icon: '🥬' },
    { key: 'sulphites', label: 'Sulphites', icon: '🍷' },
  ];
  const presentSet = new Set(allergens.map(a => String(a).toLowerCase()));
  const list = [
    ...COMMON.filter(a => presentSet.has(a.key) || presentSet.size === 0),
    ...allergens.filter(a => !COMMON.find(c => c.key === String(a).toLowerCase())).map(a => ({ key: String(a).toLowerCase(), label: String(a), icon: '⚠' })),
  ];
  const finalList = list.length > 0 ? list : COMMON;
  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(next);
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--kOverlay)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--kSurfaceRaised)', color: 'var(--kFg)', border: '1px solid var(--kBorder1)', borderRadius: 24, padding: 28, maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>Any allergies?</div>
        <div style={{ fontSize: 13, color: 'var(--kFgMuted)', marginBottom: 22 }}>Tap to flag what you can't have. Items containing flagged allergens will be marked.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
          {finalList.map(a => {
            const isSel = selected.has(a.key);
            return (
              <button key={a.key} onClick={() => toggle(a.key)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: isSel ? 'rgba(239,68,68,0.15)' : 'var(--kSurface1)',
                border: '2px solid ' + (isSel ? '#ef4444' : 'transparent'),
                borderRadius: 14, cursor: 'pointer', color: 'var(--kFg)', fontFamily: 'inherit', textAlign: 'left',
              }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a.label}</span>
                {isSel && <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>AVOID</span>}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {selected.size > 0 && (
            <button onClick={() => onChange(new Set())} style={{ flex: 1, background: 'var(--kSurface2)', color: 'var(--kFg)', border: 0, padding: '14px', borderRadius: 100, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Clear all</button>
          )}
          <button onClick={onClose} style={{ flex: 2, background: brandColor, color: '#fff', border: 0, padding: '14px', borderRadius: 100, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>{selected.size > 0 ? 'Show me what I can have' : 'Done'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STYLE HELPERS
// ============================================================
function fullScreen() { return { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }; }
function iconBtn() { return { width: 44, height: 44, borderRadius: 14, background: 'var(--kSurface2)', display: 'grid', placeItems: 'center', fontSize: 20, color: 'var(--kFg)', border: 0, cursor: 'pointer', fontFamily: 'inherit' }; }
function bigCard(brandColor) {
  return {
    background: 'var(--kSurface1)',
    border: '2px solid transparent',
    borderRadius: 22,
    padding: 'clamp(20px, 3vh, 32px)',
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(16px, 3vw, 24px)',
    cursor: 'pointer',
    color: 'var(--kFg)',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'all 0.15s',
  };
}
function smallCard(brandColor) {
  return {
    background: 'var(--kSurface1)',
    border: '2px solid transparent',
    borderRadius: 14,
    padding: '18px',
    cursor: 'pointer',
    color: 'var(--kFg)',
    fontFamily: 'inherit',
  };
}
function primaryCta(brandColor) {
  return {
    background: brandColor,
    color: '#fff',
    border: 0,
    padding: 'clamp(18px, 2.5vh, 22px) 32px',
    borderRadius: 16,
    fontSize: 'clamp(16px, 2.2vw, 20px)',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
  };
}
function miniQtyBtn() { return { width: 32, height: 32, borderRadius: '50%', background: 'var(--kSurface1)', color: 'var(--kFg)', border: 0, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }; }
function kpadKey() { return { padding: '20px', borderRadius: 16, background: 'var(--kSurface1)', color: 'var(--kFg)', fontSize: 26, fontWeight: 600, border: 0, cursor: 'pointer', fontFamily: 'inherit' }; }
function fieldLabel() { return { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--kFgMuted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }; }
