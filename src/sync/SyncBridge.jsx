import { useEffect, useRef } from 'react';
import { useStore } from '../store';

const CHANNEL_NAME = 'rpos-sync';
const STORAGE_KEY  = 'rpos-shared-state';
const TAB_ID       = Math.random().toString(36).slice(2, 10);

const SHARED_KEYS = [
  'tables', 'kdsTickets', 'eightySixIds', 'dailyCounts',
  'closedChecks', 'orderQueue', 'tabs', 'locationSections', 'printJobs',
];

function getSharedState() {
  const s = useStore.getState();
  const r = {};
  for (const k of SHARED_KEYS) r[k] = s[k];
  return r;
}

export default function SyncBridge({ onSyncPulse }) {
  const isApplyingRef = useRef(false);
  const channelRef    = useRef(null);

  useEffect(() => {
    // Load shared state from localStorage on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        isApplyingRef.current = true;
        useStore.setState(JSON.parse(saved));
        isApplyingRef.current = false;
      }
    } catch {}

    if (!('BroadcastChannel' in window)) return;

    channelRef.current = new BroadcastChannel(CHANNEL_NAME);

    channelRef.current.onmessage = ({ data: msg }) => {
      if (msg.from === TAB_ID) return;

      if (msg.type === 'STATE_UPDATE') {
        isApplyingRef.current = true;
        useStore.setState(msg.data);
        isApplyingRef.current = false;
        onSyncPulse?.();
      }
      if (msg.type === 'PING') {
        channelRef.current.postMessage({ from:TAB_ID, type:'PONG', data:getSharedState() });
      }
      if (msg.type === 'PONG') {
        isApplyingRef.current = true;
        useStore.setState(msg.data);
        isApplyingRef.current = false;
      }
    };

    // Ask existing tabs for current state
    channelRef.current.postMessage({ from:TAB_ID, type:'PING' });

    // Subscribe to store and broadcast + persist shared key changes
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
        channelRef.current?.postMessage({ from:TAB_ID, type:'STATE_UPDATE', data:toSend });
        try {
          const cur = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...toSend }));
        } catch {}
        onSyncPulse?.();
      }, 80);
    });

    return () => { clearTimeout(timer); channelRef.current?.close(); unsub(); };
  }, []);

  return null;
}
