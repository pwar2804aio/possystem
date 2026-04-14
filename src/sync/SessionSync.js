/**
 * SessionSync — writes active table sessions to Supabase in real-time
 * so ALL devices (Sunmi, browser, etc.) always see the same open orders.
 *
 * Architecture:
 * - On every meaningful table state change → debounced upsert to active_sessions
 * - On boot → load all active_sessions for this location and apply to store
 * - Supabase Realtime subscription → apply incoming changes from other devices instantly
 */

import { supabase, getLocationId } from '../lib/supabase';
import { queueWrite, isOnline } from './OfflineQueue';
import { useStore } from '../store';

let _locationId = null;
let _debounceTimer = null;
let _realtimeChannel = null;
let _lastSent = {}; // table_id → JSON string, avoid redundant writes

// ── Write ─────────────────────────────────────────────────────────────────────
export async function flushSessions() {
  if (!_locationId) _locationId = await getLocationId().catch(() => null);
  if (!_locationId) return;

  const tables = useStore.getState().tables;
  const occupied = tables.filter(t => t.session && t.status !== 'available');

  // Upsert each occupied table
  for (const t of occupied) {
    const payload = JSON.stringify(t.session);
    if (_lastSent[t.id] === payload) continue; // no change
    _lastSent[t.id] = payload;

    // Write to localStorage backup immediately (instant, never fails)
    try {
      const backup = JSON.parse(localStorage.getItem('rpos-session-backup') || '{}');
      backup[t.id] = t.session;
      localStorage.setItem('rpos-session-backup', JSON.stringify(backup));
    } catch {}

    // Queue write — works offline, replays when back online
    queueWrite({
      type: 'upsert',
      table: 'active_sessions',
      payload: {
        location_id: _locationId,
        table_id: t.id,
        session: t.session,
        updated_at: new Date().toISOString(),
      },
      onConflict: 'location_id,table_id',
    }).then(() => {
      // If online, also write directly for immediate sync
      if (isOnline()) {
        supabase.from('active_sessions').upsert({
          location_id: _locationId,
          table_id: t.id,
          session: t.session,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'location_id,table_id' }).catch(e => console.warn('[SessionSync]', e.message));
      }
    });
  }

  // Clear sessions for tables that are now available (order complete/cleared)
  const availableIds = tables
    .filter(t => t.status === 'available' || !t.session)
    .map(t => t.id);

  for (const tid of availableIds) {
    if (_lastSent[tid] !== 'cleared') {
      _lastSent[tid] = 'cleared';
      // Remove from localStorage backup too
      try {
        const backup = JSON.parse(localStorage.getItem('rpos-session-backup') || '{}');
        delete backup[tid];
        localStorage.setItem('rpos-session-backup', JSON.stringify(backup));
      } catch {}

      queueWrite({
        type: 'delete',
        table: 'active_sessions',
        match: { location_id: _locationId, table_id: tid },
      });
      if (isOnline()) {
        supabase.from('active_sessions')
          .delete().eq('location_id', _locationId).eq('table_id', tid)
          .catch(e => console.warn('[SessionSync] delete error:', e.message));
      }
    }
  }
}

// Debounce writes — don't hammer Supabase on every keystroke
export function scheduleFlush() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(flushSessions, 600);
}

// ── Load on boot ──────────────────────────────────────────────────────────────
export async function loadSessions() {
  if (!_locationId) _locationId = await getLocationId().catch(() => null);
  if (!_locationId) return;

  const { data, error } = await supabase
    .from('active_sessions')
    .select('table_id, session, updated_at')
    .eq('location_id', _locationId);

  if (error || !data?.length) return;

  const store = useStore.getState();
  const tables = [...store.tables];
  let changed = false;

  for (const row of data) {
    const idx = tables.findIndex(t => t.id === row.table_id);
    if (idx === -1) continue;
    // Only apply if the session is newer than what we have
    const existing = tables[idx].session;
    const incomingTime = new Date(row.updated_at).getTime();
    const existingTime = existing?.seatedAt || 0;
    if (!existing || incomingTime > existingTime) {
      tables[idx] = { ...tables[idx], session: row.session, status: 'occupied' };
      _lastSent[row.table_id] = JSON.stringify(row.session);
      changed = true;
    }
  }

  if (changed) {
    useStore.setState({ tables });
    console.log(`[SessionSync] Loaded ${data.length} active session(s) from Supabase`);
  }
}

// ── Realtime subscription ──────────────────────────────────────────────────────
export async function subscribeToSessions() {
  if (!_locationId) _locationId = await getLocationId().catch(() => null);
  if (!_locationId) return;
  if (_realtimeChannel) return; // already subscribed

  _realtimeChannel = supabase
    .channel('active-sessions-sync')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'active_sessions',
      filter: `location_id=eq.${_locationId}`,
    }, (payload) => {
      const store = useStore.getState();
      const tables = [...store.tables];

      if (payload.eventType === 'DELETE') {
        const tid = payload.old?.table_id;
        if (!tid) return;
        const idx = tables.findIndex(t => t.id === tid);
        if (idx === -1) return;
        // Only clear if we didn't originate this (avoid clearing our own active order)
        if (_lastSent[tid] === 'cleared') return;
        tables[idx] = { ...tables[idx], session: null, status: 'available' };
        useStore.setState({ tables });
      } else {
        // INSERT or UPDATE
        const { table_id, session } = payload.new;
        if (!table_id || !session) return;
        const idx = tables.findIndex(t => t.id === table_id);
        if (idx === -1) return;
        // Don't overwrite our own writes
        if (_lastSent[table_id] === JSON.stringify(session)) return;
        tables[idx] = { ...tables[idx], session, status: 'occupied' };
        _lastSent[table_id] = JSON.stringify(session);
        useStore.setState({ tables });
        console.log(`[SessionSync] Received live update for table ${table_id}`);
      }
    })
    .subscribe();
}

export function teardown() {
  clearTimeout(_debounceTimer);
  if (_realtimeChannel) { supabase.removeChannel(_realtimeChannel); _realtimeChannel = null; }
  _lastSent = {};
  _locationId = null;
}
