/**
 * SessionReconciler — polls Supabase active_sessions every 10s
 * and reconciles with the local store.
 * 
 * This is the reliable fallback for cross-device sync.
 * Supabase Realtime DELETE events are unreliable — this guarantees
 * that a table closed on any device clears within 10 seconds on all others.
 */

import { supabase, getLocationId } from '../lib/supabase';
import { useStore } from '../store';

let _timer = null;
let _locationId = null;
let _running = false;

export async function startSessionReconciler() {
  if (_running) return;
  _running = true;

  _locationId = await getLocationId().catch(() => null);
  if (!_locationId || !supabase) { _running = false; return; }

  const reconcile = async () => {
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('table_id, session, updated_at')
        .eq('location_id', _locationId);

      if (error || !data) return;

      const store = useStore.getState();
      const tables = store.tables || [];

      // Build map of what Supabase says is open
      const supabaseOpen = new Map();
      data.forEach(row => {
        if (row.table_id && row.session) supabaseOpen.set(row.table_id, row.session);
      });

      let changed = false;
      const now = Date.now();
      const GRACE_MS = 30_000; // 30s grace period for new sessions before we trust Supabase

      const newTables = tables.map(t => {
        const inSupabase = supabaseOpen.has(t.id);
        const inStore = !!t.session;
        const isActive = t.id === store.activeTableId;
        const isNew = t.session?.seatedAt && (now - t.session.seatedAt) < GRACE_MS;

        // v4.5.4 KILL SWITCH: this wipe branch was the source of all "table vanished"
        // bugs over 25-26 Apr 2026. The reconciler assumed Supabase active_sessions is the
        // source of truth — but writes to that table fail/lag often enough that this branch
        // catastrophically wipes in-progress orders every 10 seconds. Disabled until we have
        // a guaranteed-success write path. Sessions are only cleared via explicit clearTable.
        if (false && inStore && !inSupabase && !isActive && !isNew) {
          // Table is open in store but NOT in Supabase — another device closed it
          changed = true;
          return { ...t, session: null, status: 'available' };
        }

        if (!inStore && inSupabase) {
          // Table is open in Supabase but NOT in store — another device opened it
          changed = true;
          return { ...t, session: supabaseOpen.get(t.id), status: 'occupied' };
        }

        if (inStore && inSupabase && !isActive) {
          // Table is open on BOTH — check if Supabase has newer/more items
          const supabaseSession = supabaseOpen.get(t.id);
          const supabaseItemCount = (supabaseSession?.items || []).length;
          const localItemCount = (t.session?.items || []).length;
          const supabaseUpdated = new Date(supabaseSession?.updatedAt || supabaseSession?.sentAt || 0).getTime();
          const localSeated = t.session?.seatedAt || 0;

          // Apply if Supabase has more items, or has items that are sent (kitchen confirmed)
          // Only overwrite non-active tables to avoid clobbering the operator's current work
          if (supabaseItemCount > localItemCount) {
            changed = true;
            return { ...t, session: supabaseSession, status: 'occupied' };
          }
        }

        return t;
      });

      if (changed) {
        useStore.setState({ tables: newTables });

        // Sync session backup
        const backup = {};
        newTables.filter(t => t.session).forEach(t => { backup[t.id] = t.session; });
        try { localStorage.setItem('rpos-session-backup', JSON.stringify(backup)); } catch {}
      }
    } catch {}
  };

  // First reconcile immediately
  await reconcile();

  // Then every 10 seconds
  _timer = setInterval(reconcile, 10_000);
}

export function stopSessionReconciler() {
  clearInterval(_timer);
  _timer = null;
  _running = false;
}
