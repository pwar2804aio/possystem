import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { isMock } from '../lib/supabase';

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

    // Apply config snapshot on every mount — only in mock mode
    // In real mode, config comes from Supabase
    if (!isMock) return;
    try {
      const snap = localStorage.getItem('rpos-config-snapshot');
      if (snap) {
        const parsed = JSON.parse(snap);
        // Always apply — store just reset to seed, snapshot has the live config
        useStore.getState().applyConfigUpdate();
        // Pre-load so applyConfigUpdate can find it
        useStore.getState().setConfigUpdate(parsed);
        useStore.getState().applyConfigUpdate();
      }
    } catch {}

    if (!('BroadcastChannel' in window)) return;

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

    return () => { clearTimeout(timer); channelInstance?.close(); channelInstance = null; unsub(); };
  }, []);

  return null;
}

// Call this from Back Office to push a config snapshot to all POS terminals
export function broadcastConfigPush(snapshot) {
  if (!channelInstance) return;
  channelInstance.postMessage({ from:TAB_ID, type:'CONFIG_PUSH', snapshot });
}
