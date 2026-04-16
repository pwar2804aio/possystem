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

  // ── Tax rates — live sync when names/rates change ──────────────────────────
  const taxChannel = supabase
    .channel(`tax:${locationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tax_rates',
      filter: `location_id=eq.${locationId}`,
    }, async () => {
      // Re-fetch all rates for this location when any change happens
      const { data } = await supabase
        .from('tax_rates').select('*')
        .eq('location_id', locationId)
        .eq('active', true)
        .order('rate', { ascending: false });
      if (data) store.setState({ taxRates: data.map(r => ({
        id: r.id, name: r.name, code: r.code,
        rate: parseFloat(r.rate), type: r.type,
        appliesTo: r.applies_to || ['all'],
        isDefault: r.is_default, active: r.active,
      })) });
    })
    .subscribe();

  // ── Closed checks — live sync across all devices ──────────────────────────
  const checksChannel = supabase
    .channel(`checks:${locationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'closed_checks',
      filter: `location_id=eq.${locationId}`,
    }, ({ new: check }) => {
      if (!check) return;
      // Normalise and prepend to store so all devices see it immediately
      const normalised = {
        id: check.id, ref: check.ref, server: check.server, covers: check.covers,
        orderType: check.order_type, customer: check.customer,
        items: check.items || [], discounts: check.discounts || [],
        subtotal: check.subtotal, service: check.service, tip: check.tip, total: check.total,
        method: check.method,
        closedAt: check.closed_at ? new Date(check.closed_at).getTime() : null,
        status: check.status, refunds: check.refunds || [],
        tableId: check.table_id, tableLabel: check.table_label,
      };
      const current = store.getState().closedChecks || [];
      if (!current.find(c => c.id === normalised.id)) {
        store.setState({ closedChecks: [normalised, ...current] });
      }
    })
    .subscribe();

  channels = [kdsChannel, e86Channel, configChannel, taxChannel, checksChannel];

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
