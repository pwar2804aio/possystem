/**
 * db.js — Supabase data layer
 *
 * Each function wraps a Supabase query and returns { data, error }.
 * Called by store actions and React components.
 * When supabase is null (mock mode), returns { data: null, error }.
 *
 * All queries are scoped to a location_id for multi-tenancy.
 */

import { supabase, isMock, getLocationId } from './supabase';

// ── Menu ──────────────────────────────────────────────────────────────────────
export const fetchMenus = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId) locationId = await getLocationId();
  if (!locationId) return { data: null, error: new Error('No location') };
  return supabase.from('menus').select('*').eq('location_id', locationId).order('sort_order');
};

export const fetchMenuCategories = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId) locationId = await getLocationId();
  if (!locationId) return { data: null, error: new Error('No location') };
  return supabase.from('menu_categories').select('*').eq('location_id', locationId).order('sort_order');
};


export const fetchMenuItems = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId) locationId = await getLocationId();
  if (!locationId) return { data: null, error: new Error('No location') };
  return supabase
    .from('menu_items')
    .select('*')
    .eq('location_id', locationId)
    .eq('archived', false)
    .order('sort_order');
};

export const upsertMenuItem = async (item, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  if (!locationId) locationId = await getLocationId();
  if (!locationId) return { data: null, error: new Error('No location') };
  const result = await supabase.from('menu_items').upsert({ ...item, location_id: locationId, updated_at: new Date().toISOString() });
  if (result.error) console.error('[DB] menu_items upsert failed:', result.error.message, 'item:', item.id, 'location:', locationId);
  return result;
};

export const archiveMenuItem = async (id) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('menu_items').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', id);
};

// ── Floor plan ────────────────────────────────────────────────────────────────
export const fetchFloorPlan = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId) locationId = await getLocationId();
  if (!locationId) return { data: null, error: new Error('No location') };
  const [tables, sections] = await Promise.all([
    supabase.from('floor_tables').select('*').eq('location_id', locationId).order('sort_order'),
    supabase.from('sections').select('*').eq('location_id', locationId).order('sort_order'),
  ]);
  return { data: { tables: tables.data, sections: sections.data }, error: tables.error || sections.error };
};

export const upsertFloorTable = async (table, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  if (!locationId) locationId = await getLocationId();
  if (!locationId) return { data: null, error: new Error('No location') };
  const result = await supabase.from('floor_tables').upsert({ ...table, location_id: locationId });
  if (result.error) console.error('[DB] floor_tables upsert failed:', result.error.message, 'table:', table.id, 'location:', locationId);
  return result;
};

export const deleteFloorTable = async (id) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('floor_tables').delete().eq('id', id);
};

// ── 86 list ───────────────────────────────────────────────────────────────────
export const fetch86List = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('eighty_six').select('item_id').eq('location_id', locationId);
};

export const toggle86DB = async (itemId, is86, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  if (is86) {
    return supabase.from('eighty_six').delete().eq('location_id', locationId).eq('item_id', itemId);
  }
  return supabase.from('eighty_six').insert({ location_id: locationId, item_id: itemId });
};

// ── KDS ───────────────────────────────────────────────────────────────────────
export const fetchKDSTickets = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  return supabase
    .from('kds_tickets')
    .select('*')
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .order('sent_at', { ascending: true });
};

export const insertKDSTicket = async (ticket, locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId) locationId = await getLocationId();
  if (!locationId) return { data: null, error: new Error('No location') };
  // Map camelCase store ticket to snake_case DB columns
  const row = {
    id: ticket.id,
    location_id: locationId,
    table_label: ticket.table || ticket.tableLabel || '',
    table_id: ticket.tableId || null,
    server: ticket.server || null,
    covers: ticket.covers || 1,
    centre_id: ticket.centreId || null,
    items: ticket.items || [],
    status: 'pending',
    fired_courses: ticket.firedCourses || [0, 1],
    all_courses: ticket.allCourses || [],
    sent_at: ticket.sentAt ? new Date(ticket.sentAt).toISOString() : new Date().toISOString(),
  };
  return supabase.from('kds_tickets').insert(row);
};

export const bumpKDSTicket = async (id) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('kds_tickets').update({ status: 'bumped', bumped_at: new Date().toISOString() }).eq('id', id);
};

// ── Closed checks ─────────────────────────────────────────────────────────────
export const insertClosedCheck = async (check, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  const row = {
    id:           check.id,
    location_id:  locationId,
    ref:          check.ref,
    server:       check.server,
    covers:       check.covers,
    order_type:   check.orderType,
    customer:     check.customer,
    items:        check.items,
    discounts:    check.discounts,
    subtotal:     check.subtotal,
    service:      check.service,
    tip:          check.tip,
    total:        check.total,
    method:       check.method,
    closed_at:    check.closedAt ? new Date(check.closedAt).toISOString() : new Date().toISOString(),
    status:       check.status || 'paid',
    refunds:      check.refunds || [],
    table_id:     check.tableId || null,
    table_label:  check.tableLabel || null,
  };
  const result = await supabase.from('closed_checks').insert(row);
  if (result.error) console.error('[DB] closed_checks insert failed:', result.error.message);
  return result;
};

export const fetchClosedChecks = async (locationId = LOCATION_ID, limit = 500, sinceDate = null) => {
  if (isMock) return { data: null, error: null };
  // Default: load today's checks only (since midnight local time)
  const since = sinceDate || (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const result = await supabase
    .from('closed_checks')
    .select('*')
    .eq('location_id', locationId)
    .gte('closed_at', since.toISOString())
    .order('closed_at', { ascending: false })
    .limit(limit);
  if (result.data) {
    result.data = result.data.map(c => ({
      id: c.id, ref: c.ref, server: c.server, covers: c.covers,
      orderType: c.order_type, customer: c.customer,
      items: c.items || [], discounts: c.discounts || [],
      subtotal: c.subtotal, service: c.service, tip: c.tip, total: c.total,
      method: c.method,
      closedAt: c.closed_at ? new Date(c.closed_at).getTime() : null,
      status: c.status, refunds: c.refunds || [],
      tableId: c.table_id, tableLabel: c.table_label,
    }));
  }
  return result;
};

// For reports — fetch checks across any date range
export const fetchClosedChecksRange = async (locationId = LOCATION_ID, fromDate, toDate, limit = 1000) => {
  if (isMock) return { data: null, error: null };
  let query = supabase
    .from('closed_checks')
    .select('*')
    .eq('location_id', locationId)
    .order('closed_at', { ascending: false })
    .limit(limit);
  if (fromDate) query = query.gte('closed_at', fromDate.toISOString());
  if (toDate)   query = query.lte('closed_at', toDate.toISOString());
  const result = await query;
  if (result.data) {
    result.data = result.data.map(c => ({
      id: c.id, ref: c.ref, server: c.server, covers: c.covers,
      orderType: c.order_type, customer: c.customer,
      items: c.items || [], discounts: c.discounts || [],
      subtotal: c.subtotal, service: c.service, tip: c.tip, total: c.total,
      method: c.method,
      closedAt: c.closed_at ? new Date(c.closed_at).getTime() : null,
      status: c.status, refunds: c.refunds || [],
      tableId: c.table_id, tableLabel: c.table_label,
    }));
  }
  return result;
};

// ── Config pushes ─────────────────────────────────────────────────────────────
export const insertConfigPush = async (push, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  const result = await supabase.from('config_pushes').insert({ ...push, location_id: locationId });
  if (result.error) console.error('[DB] config_pushes insert failed:', result.error.message);
  return result;
};

export const fetchLatestConfigPush = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  return supabase
    .from('config_pushes')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
};

// ── Staff ─────────────────────────────────────────────────────────────────────
export const fetchStaff = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  return supabase
    .from('staff_locations')
    .select('staff(*)')
    .eq('location_id', locationId);
};

// ── Devices ───────────────────────────────────────────────────────────────────
export const updateDeviceHeartbeat = async (deviceId) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('devices').update({ status: 'online', last_seen: new Date().toISOString() }).eq('id', deviceId);
};

export const fetchDevices = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('devices').select('*, device_profiles(*)').eq('location_id', locationId);
};
