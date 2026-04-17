import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { subscribeToSessions, scheduleFlush, teardown as teardownSessions } from './SessionSync';
import { initOfflineQueue } from './OfflineQueue';
import { isMock, supabase } from '../lib/supabase';
import { startSessionReconciler, stopSessionReconciler } from './SessionReconciler';
import { getShowItemImages } from '../lib/locationTime';

export const CHANNEL_NAME = 'rpos-sync';
export const STORAGE_KEY  = 'rpos-shared-state';
export const TAB_ID       = Math.random().toString(36).slice(2, 10);

// Operational state — syncs in real-time across all terminals
const OPERATIONAL_KEYS = [
  'kdsTickets', 'eightySixIds', 'dailyCounts',
  'closedChecks', 'orderQueue', 'tabs', 'printJobs',
];

// Table status/session sync (operational part only — layout comes via CONFIG_PUSH)
// We sync the whole tables array but the POS only applies non-layout fields from broadcasts
// Layout (x,y,w,h,label,section,shape) only changes via CONFIG_PUSH
const SHARED_KEYS = [...OPERATIONAL_KEYS, 'tables', 'showItemImages'];

let channelInstance = null;
export function getChannel() { return channelInstance; }

function getSharedState() {
  const s = useStore.getState();
  const r = {};
  for (const k of SHARED_KEYS) r[k] = s[k];
  return r;
}

export default function SyncBridge({ onSyncPulse }) {
  const isApplyingRef = useRef(false);

  useEffect(() => {
    // Load persisted operational state on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        isApplyingRef.current = true;
        const parsed = JSON.parse(saved);
        // In real Supabase mode, strip menu/product data — loaded from DB instead
        if (!isMock) {
          delete parsed.menus;
          delete parsed.menuCategories;
          delete parsed.menuItems;
          delete parsed.modifierGroups;
          delete parsed.modifierOptions;
          delete parsed.itemVariants;
          delete parsed.staff;
          delete parsed.tables;
          delete parsed.sections;
          delete parsed.eightySix;
          delete parsed.tabs;          // bar tabs are session-only in real mode
          // NOTE: quickScreenIds is kept — it's config pushed from back office
          // NOTE: closedChecks are kept from localStorage as fast fallback
        }
        useStore.setState(parsed);
        isApplyingRef.current = false;
      }
    } catch {}

    // Apply config snapshot on mount
    // In mock mode: read from localStorage snapshot
    // In real mode: fetch latest push from Supabase for this location
    if (isMock) {
      try {
        const snap = localStorage.getItem('rpos-config-snapshot');
        if (snap) {
          const parsed = JSON.parse(snap);
          useStore.getState().setConfigUpdate(parsed);
          useStore.getState().applyConfigUpdate();
        }
      } catch {}
    } else {
      // Load latest config push from Supabase for this location
      (async () => {
        try {
          const paired = JSON.parse(localStorage.getItem('rpos-device') || 'null');
          const locationId = paired?.locationId;
          if (!locationId) return;
          const { fetchLatestConfigPush, fetchFloorPlan, fetchMenuItems, fetchMenuCategories, fetchMenus } = await import('../lib/db.js');
          const { supabase: sb2 } = await import('../lib/supabase.js');

          // Load config push (menus, layout, sections)
          const { data } = await fetchLatestConfigPush(locationId);
          if (data?.snapshot) {
            useStore.getState().setConfigUpdate(data.snapshot);
            useStore.getState().applyConfigUpdate();
          }

          // Load floor plan + active sessions atomically — never set session:null then restore
          const { supabase: sb, getLocationId } = await import('../lib/supabase.js');
          const [floorRes, itemsRes, catsRes, menusRes, sessionsRes, profilesRes, modGroupsRes] = await Promise.all([
            fetchFloorPlan(locationId),
            fetchMenuItems(locationId),
            fetchMenuCategories(locationId),
            fetchMenus(locationId),
            sb ? sb.from('active_sessions').select('table_id,session').eq('location_id', locationId) : Promise.resolve({ data: [] }),
            sb2 ? sb2.from('device_profiles').select('*').eq('location_id', locationId) : Promise.resolve({ data: [] }),
            sb ? sb.from('modifier_groups').select('*').eq('location_id', locationId).order('sort_order') : Promise.resolve({ data: [] }),
          ]);
          // Cache profiles to localStorage so they survive offline
          if (profilesRes?.data?.length) {
            const mapped = profilesRes.data.map(p => ({
              id: p.id, name: p.name, color: p.color,
              defaultSurface: p.default_surface, enabledOrderTypes: p.enabled_order_types || ['dine-in'],
              assignedSection: p.assigned_section, hiddenFeatures: p.hidden_features || [],
              tableServiceEnabled: p.table_service_enabled !== false,
              quickScreenEnabled: p.quick_screen_enabled !== false,
              menuId: p.menu_id,
              serviceCharge: p.service_charge || null,
            }));
            try { localStorage.setItem('rpos-device-profiles', JSON.stringify(mapped)); } catch {}
          }
          const patch = {};
          if (floorRes.data?.tables?.length) {
            // Build a session map from Supabase active_sessions
            const sessionMap = {};
            (sessionsRes?.data || []).forEach(row => {
              if (row.table_id && row.session) sessionMap[row.table_id] = row.session;
            });
            // Also check localStorage backup for any sessions not yet written to Supabase
            try {
              const lsBackup = JSON.parse(localStorage.getItem('rpos-session-backup') || '{}');
              Object.entries(lsBackup).forEach(([tid, sess]) => {
                if (!sessionMap[tid]) sessionMap[tid] = sess;
              });
            } catch {}
            // Build tables with sessions already applied — never flash as empty
            const tables = floorRes.data.tables.map(t => {
              const session = sessionMap[t.id] || null;
              return { ...t, status: session ? 'occupied' : 'available', session, firedCourses: session?.firedCourses || [], sentAt: session?.sentAt || null };
            });
            patch.tables = tables;
          }
          if (itemsRes.data?.length) patch.menuItems = itemsRes.data.map(item => ({
            ...item,
            price: item.pricing?.base ?? item.price ?? 0,
            menuName: item.menu_name ?? item.menuName ?? item.name ?? 'Item',
            receiptName: item.receipt_name ?? item.receiptName ?? item.name,
            kitchenName: item.kitchen_name ?? item.kitchenName ?? item.name,
            sortOrder: item.sort_order ?? item.sortOrder ?? 0,
            parentId: item.parent_id ?? item.parentId ?? null,
            soldAlone: item.sold_alone ?? item.soldAlone,
            centreId: item.centre_id ?? item.centreId ?? null,
            taxRateId: item.tax_rate_id ?? item.taxRateId ?? null,
            taxOverrides: item.tax_overrides ?? item.taxOverrides ?? {},
            // Must map snake_case → camelCase for modifier and instruction groups
            assignedModifierGroups: item.assigned_modifier_groups ?? item.assignedModifierGroups ?? [],
            assignedInstructionGroups: item.assigned_instruction_groups ?? item.assignedInstructionGroups ?? [],
            image: item.image ?? null,
          }));

          // Sync any local-only items that failed to save previously (e.g. before schema was ready)
          // This ensures items created offline or before column fixes are never lost
          if (sb && locationId && itemsRes.data?.length) {
            try {
              const { upsertMenuItem } = await import('../lib/db.js');
              const remoteIds = new Set(itemsRes.data.map(i => i.id));
              const localItems = useStore.getState().menuItems || [];
              const localOnly = localItems.filter(i =>
                !remoteIds.has(i.id) && !i.archived && i.id && !i.id.startsWith('demo-')
              );
              if (localOnly.length > 0) {
                console.log(`[SyncBridge] Syncing ${localOnly.length} local-only items to Supabase`);
                localOnly.forEach(item => upsertMenuItem({ ...item, location_id: locationId }));
              }
            } catch (e) { console.warn('[SyncBridge] local-only sync failed', e); }
          }

          // Load tax rates directly from Supabase (source of truth)
          if (sb && locationId) {
            try {
              const { data: taxData } = await sb.from('tax_rates').select('*').eq('location_id', locationId).eq('active', true).order('rate', { ascending: false });
              if (taxData?.length) patch.taxRates = taxData.map(r => ({
                id: r.id, name: r.name, code: r.code,
                rate: parseFloat(r.rate), type: r.type,
                appliesTo: r.applies_to || ['all'],
                isDefault: r.is_default, active: r.active,
              }));
            } catch {}
          }
          if (catsRes.data?.length) patch.menuCategories = catsRes.data.map(cat => ({
            ...cat,
            parentId: cat.parent_id ?? cat.parentId ?? null,
            menuId: cat.menu_id ?? cat.menuId,
            sortOrder: cat.sort_order ?? cat.sortOrder ?? 0,
            accountingGroup: cat.accounting_group ?? cat.accountingGroup ?? '',
            label: cat.label ?? cat.name ?? 'Category',
            icon: cat.icon ?? '🍽',
            color: cat.color ?? '#3b82f6',
          }));
          if (menusRes.data?.length) patch.menus = menusRes.data;
          if (modGroupsRes.data?.length) patch.modifierGroupDefs = modGroupsRes.data.map(g => ({
            id: g.id, name: g.name,
            min: g.min ?? 0, max: g.max ?? 1,
            selectionType: g.selection_type ?? 'single',
            options: g.options ?? [],
            sortOrder: g.sort_order ?? 0,
          }));

          // Load today's closed checks from Supabase — CRITICAL for sales history
          try {
            const { fetchClosedChecks } = await import('../lib/db.js');
            const checksRes = await fetchClosedChecks(locationId, 500);
            if (checksRes.data?.length) {
              // Merge with any localStorage checks not yet written to Supabase
              const supabaseIds = new Set(checksRes.data.map(c => c.id));
              const lsChecks = (() => {
                try {
                  const s = JSON.parse(localStorage.getItem('rpos-shared-state') || '{}');
                  return (s.closedChecks || []).filter(c => !supabaseIds.has(c.id));
                } catch { return []; }
              })();
              patch.closedChecks = [...checksRes.data, ...lsChecks]
                .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
            }
          } catch(e) { console.warn('[SyncBridge] closed checks load error:', e.message); }

          if (Object.keys(patch).length) useStore.setState(patch);

          // Reconcile any pending checks that didn't make it to Supabase
          // (e.g. payment taken while offline, page reloaded before sync)
          try {
            const { reconcilePendingChecks } = await import('./DataSafe.js');
            await reconcilePendingChecks();
          } catch {}

        } catch(e) { console.warn('[SyncBridge] boot load error:', e.message); }
      })();
    }

    if (!('BroadcastChannel' in window)) return;

    // Init offline queue for durable writes
    if (!isMock) initOfflineQueue(supabase);

    // Session reconciler — polls active_sessions every 10s
    // This is the reliable fix for cross-device close sync
    // Realtime DELETE events are unreliable; polling guarantees consistency
    if (!isMock) startSessionReconciler();

    // Load global image display setting
    if (!isMock) {
      (async () => {
        try {
          const { getLocationId } = await import('../lib/supabase.js');
          const locId = await getLocationId().catch(() => null);
          if (locId && supabase) {
            const show = await getShowItemImages(supabase, locId);
            useStore.getState().setShowItemImages(show);
          }
        } catch {}
      })();
    }

    // On reconnect — replay pending data
    if (!isMock) {
      window.addEventListener('online', async () => {
        try {
          const { onReconnect } = await import('./DataSafe.js');
          await onReconnect();
        } catch {}
      });
    }

    // Periodic background sync every 60s — catch any missed writes
    if (!isMock) {
      const periodicTimer = setInterval(async () => {
        try {
          const { periodicSync } = await import('./DataSafe.js');
          await periodicSync();
        } catch {}
      }, 60_000);
      // Store timer for cleanup
      window._rposPeriodicTimer = periodicTimer;
    }

    // Note: active_sessions realtime is handled by startRealtime() in realtime.js (sessionsChannel)
    // which has INSERT/UPDATE/DELETE with REPLICA IDENTITY FULL for correct cross-device sync

    channelInstance = new BroadcastChannel(CHANNEL_NAME);

    channelInstance.onmessage = ({ data: msg }) => {
      if (msg.from === TAB_ID) return;

      if (msg.type === 'STATE_UPDATE') {
        // Real-time operational sync
        isApplyingRef.current = true;
        useStore.setState(msg.data);
        isApplyingRef.current = false;
        onSyncPulse?.();
      }

      if (msg.type === 'CONFIG_PUSH') {
        // Back Office pushed a config update — store snapshot, show banner on POS
        useStore.getState().setConfigUpdate(msg.snapshot);
        onSyncPulse?.();
      }

      if (msg.type === 'PING') {
        channelInstance.postMessage({ from:TAB_ID, type:'PONG', data:getSharedState() });
      }
      if (msg.type === 'PONG') {
        isApplyingRef.current = true;
        useStore.setState(msg.data);
        isApplyingRef.current = false;
      }
    };

    channelInstance.postMessage({ from:TAB_ID, type:'PING' });

    let timer = null;
    let pending = {};

    // Write table session changes to Supabase for cross-device sync
    const unsubSessions = !isMock ? useStore.subscribe((state, prev) => {
      if (state.tables === prev.tables) return;
      const meaningful = state.tables.some((t, i) => {
        const p = prev.tables[i];
        if (!p) return true;
        if ((t.session == null) !== (p.session == null)) return true; // open/close
        if (t.session?.covers !== p.session?.covers) return true;     // covers
        // Item count changed (add or remove) — must sync so other devices see it
        const tCount = (t.session?.items || []).length;
        const pCount = (p.session?.items || []).length;
        if (tCount !== pCount) return true;
        // Item sent to kitchen (status pending→sent)
        const tSent = (t.session?.items || []).filter(i => i.status === 'sent').length;
        const pSent = (p.session?.items || []).filter(i => i.status === 'sent').length;
        if (tSent !== pSent) return true;
        return false;
      });
      if (meaningful) scheduleFlush();
    }) : () => {};

    const unsub = useStore.subscribe((state, prev) => {
      if (isApplyingRef.current) return;
      const changed = {};
      for (const k of SHARED_KEYS) {
        if (state[k] !== prev[k]) changed[k] = state[k];
      }
      if (!Object.keys(changed).length) return;

      // If the only change is tables and it's qty-only (no item count change, no session open/close)
      // skip localStorage write and BroadcastChannel — it's just a local UI update
      const onlyTables = Object.keys(changed).length === 1 && changed.tables;
      if (onlyTables) {
        const qtyOnly = !state.tables.some((t, i) => {
          const p = prev.tables[i];
          if (!p) return true;
          if ((t.session == null) !== (p.session == null)) return true;
          const tCount = (t.session?.items || []).filter(i => !i.voided).length;
          const pCount = (p.session?.items || []).filter(i => !i.voided).length;
          if (tCount !== pCount) return true;
          return false;
        });
        if (qtyOnly) return; // skip broadcast for qty changes — no cross-device value
      }

      pending = { ...pending, ...changed };
      clearTimeout(timer);
      timer = setTimeout(() => {
        const toSend = pending;
        pending = {};
        channelInstance?.postMessage({ from:TAB_ID, type:'STATE_UPDATE', data:toSend });
        try {
          const cur = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...toSend }));
        } catch {}
        onSyncPulse?.();
      }, 80);
    });

    return () => { clearTimeout(timer); channelInstance?.close(); channelInstance = null; unsub(); unsubSessions(); stopSessionReconciler(); if (!isMock) teardownSessions(); };
  }, []);

  return null;
}

// Call this from Back Office to push a config snapshot to all POS terminals
export function broadcastConfigPush(snapshot) {
  if (!channelInstance) return;
  channelInstance.postMessage({ from:TAB_ID, type:'CONFIG_PUSH', snapshot });
}
