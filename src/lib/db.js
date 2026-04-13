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
  return supabase.from('menu_items').upsert({ ...item, location_id: locationId, updated_at: new Date().toISOString() });
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
  return supabase.from('floor_tables').upsert({ ...table, location_id: locationId });
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

export const insertKDSTicket = async (ticket, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('kds_tickets').insert({ ...ticket, location_id: locationId });
};

export const bumpKDSTicket = async (id) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('kds_tickets').update({ status: 'bumped', bumped_at: new Date().toISOString() }).eq('id', id);
};

// ── Closed checks ─────────────────────────────────────────────────────────────
export const insertClosedCheck = async (check, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('closed_checks').insert({ ...check, location_id: locationId });
};

export const fetchClosedChecks = async (locationId = LOCATION_ID, limit = 200) => {
  if (isMock) return { data: null, error: null };
  return supabase
    .from('closed_checks')
    .select('*')
    .eq('location_id', locationId)
    .order('closed_at', { ascending: false })
    .limit(limit);
};

// ── Config pushes ─────────────────────────────────────────────────────────────
export const insertConfigPush = async (push, locationId = LOCATION_ID) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('config_pushes').insert({ ...push, location_id: locationId });
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
