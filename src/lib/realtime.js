/**
 * realtime.js — Supabase Realtime subscriptions
 *
 * In mock mode (no Supabase configured): does nothing, BroadcastChannel handles sync.
 * In production: subscribes to Postgres changes and updates the Zustand store.
 *
 * One subscription per table, scoped to the current location_id.
 * Each change event calls the appropriate store action to update state.
 */

import { supabase, isMock, LOCATION_ID } from './supabase';

let channels = [];

export function startRealtime(store, locationId = LOCATION_ID) {
  if (isMock || !supabase) {
    console.info('[Realtime] Mock mode — using BroadcastChannel only');
    return () => {};
  }

  console.info('[Realtime] Connecting to location:', locationId);

  // ── KDS tickets ────────────────────────────────────────────────────────────
  const kdsChannel = supabase
    .channel(`kds:${locationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'kds_tickets',
      filter: `location_id=eq.${locationId}`,
    }, ({ new: ticket }) => {
      store.setState(s => ({
        kdsTickets: [ticket, ...s.kdsTickets.filter(t => t.id !== ticket.id)],
      }));
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'kds_tickets',
      filter: `location_id=eq.${locationId}`,
    }, ({ new: ticket }) => {
      store.setState(s => ({
        kdsTickets: ticket.status === 'bumped'
          ? s.kdsTickets.filter(t => t.id !== ticket.id)
          : s.kdsTickets.map(t => t.id === ticket.id ? ticket : t),
      }));
    })
    .subscribe();

  // ── 86 list ────────────────────────────────────────────────────────────────
  const e86Channel = supabase
    .channel(`eighty_six:${locationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'eighty_six',
      filter: `location_id=eq.${locationId}`,
    }, ({ new: row }) => {
      store.setState(s => ({
        eightySixIds: [...new Set([...s.eightySixIds, row.item_id])],
      }));
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'eighty_six',
    }, ({ old: row }) => {
      store.setState(s => ({
        eightySixIds: s.eightySixIds.filter(id => id !== row.item_id),
      }));
    })
    .subscribe();

  // ── Config pushes ──────────────────────────────────────────────────────────
  const configChannel = supabase
    .channel(`config:${locationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'config_pushes',
      filter: `location_id=eq.${locationId}`,
    }, ({ new: push }) => {
      if (push.snapshot) {
        store.getState().setConfigUpdate(push.snapshot);
      }
    })
    .subscribe();

  channels = [kdsChannel, e86Channel, configChannel];

  return () => {
    channels.forEach(ch => supabase.removeChannel(ch));
    channels = [];
  };
}

export function stopRealtime() {
  if (!supabase) return;
  channels.forEach(ch => supabase.removeChannel(ch));
  channels = [];
}
