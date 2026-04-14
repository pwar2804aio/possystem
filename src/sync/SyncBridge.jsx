import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { subscribeToSessions, scheduleFlush, teardown as teardownSessions } from './SessionSync';
import { initOfflineQueue } from './OfflineQueue';
import { isMock, supabase } from '../lib/supabase';

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
const SHARED_KEYS = [...OPERATIONAL_KEYS, 'tables'];

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
          delete parsed.quickScreenIds;
          delete parsed.staff;
          delete parsed.tables;
          delete parsed.sections;
          delete parsed.eightySix;
          delete parsed.tabs;          // bar tabs are session-only in real mode
          delete parsed.closedChecks;  // closed checks loaded from Supabase
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

          // Load config push (menus, layout, sections)
          const { data } = await fetchLatestConfigPush(locationId);
          if (data?.snapshot) {
            useStore.getState().setConfigUpdate(data.snapshot);
            useStore.getState().applyConfigUpdate();
          }

          // Load floor plan + active sessions atomically — never set session:null then restore
          const { supabase: sb, getLocationId } = await import('../lib/supabase.js');
          const [floorRes, itemsRes, catsRes, menusRes, sessionsRes] = await Promise.all([
            fetchFloorPlan(locationId),
            fetchMenuItems(locationId),
            fetchMenuCategories(locationId),
            fetchMenus(locationId),
            // Load active sessions in the same batch
            sb ? sb.from('active_sessions').select('table_id,session').eq('location_id', locationId) : Promise.resolve({ data: [] }),
          ]);
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
            menuName: item.menu_name ?? item.menuName ?? item.name ?? 'Item',
            receiptName: item.receipt_name ?? item.receiptName ?? item.name,
            kitchenName: item.kitchen_name ?? item.kitchenName ?? item.name,
            sortOrder: item.sort_order ?? item.sortOrder ?? 0,
            parentId: item.parent_id ?? item.parentId ?? null,
            soldAlone: item.sold_alone ?? item.soldAlone,
          }));
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
          if (Object.keys(patch).length) useStore.setState(patch);
        } catch(e) { console.warn('[SyncBridge] boot load error:', e.message); }
      })();
    }

    if (!('BroadcastChannel' in window)) return;

    // Init offline queue for durable writes
    if (!isMock) initOfflineQueue(supabase);

    // Subscribe to live session updates from other devices
    if (!isMock) {
      subscribeToSessions();
    }

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
      if (state.tables !== prev.tables) {
        scheduleFlush();
      }
    }) : () => {};

    const unsub = useStore.subscribe((state, prev) => {
      if (isApplyingRef.current) return;
      const changed = {};
      for (const k of SHARED_KEYS) {
        if (state[k] !== prev[k]) changed[k] = state[k];
      }
      if (!Object.keys(changed).length) return;

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

    return () => { clearTimeout(timer); channelInstance?.close(); channelInstance = null; unsub(); unsubSessions(); if (!isMock) teardownSessions(); };
  }, []);

  return null;
}

// Call this from Back Office to push a config snapshot to all POS terminals
export function broadcastConfigPush(snapshot) {
  if (!channelInstance) return;
  channelInstance.postMessage({ from:TAB_ID, type:'CONFIG_PUSH', snapshot });
}
