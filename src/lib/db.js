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
import { getTodayStartFallback } from './locationTime';

// ── Menu ──────────────────────────────────────────────────────────────────────
export const fetchMenus = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };
  return supabase.from('menus').select('*').eq('location_id', locationId).order('sort_order');
};

export const fetchMenuCategories = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };
  return supabase.from('menu_categories').select('*').eq('location_id', locationId).order('sort_order');
};

export const upsertMenuCategory = async (cat, locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };
  const result = await supabase.from('menu_categories').upsert({
    ...cat,
    location_id: locationId,
    parent_id: cat.parentId ?? cat.parent_id ?? null,
    menu_id: cat.menuId ?? cat.menu_id ?? null,
    sort_order: cat.sortOrder ?? cat.sort_order ?? 0,
    default_course: cat.defaultCourse ?? cat.default_course ?? 1,
    spacer_slots: cat.spacerSlots ?? cat.spacer_slots ?? [],
    updated_at: new Date().toISOString(),
  });
  if (result.error) console.error('[DB] menu_categories upsert failed:', result.error.message);
  return result;
};


export const fetchMenuItems = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };
  return supabase
    .from('menu_items')
    .select('*')
    .eq('location_id', locationId)
    .eq('archived', false)
    .order('sort_order');
};

export const upsertMenuItem = async (item, locationId = null) => {
  if (isMock) return { data: null, error: null };
  // Always resolve real location — 'loc-demo' is the mock fallback, not a real location
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };

  // Build pricing jsonb — preserve existing or derive from scalar price
  const pricing = item.pricing || { base: item.price || 0 };

  const dbItem = {
    id:           item.id,
    location_id:  locationId,
    name:         item.name || 'Item',
    menu_name:    item.menuName    || item.menu_name    || item.name || 'Item',
    receipt_name: item.receiptName || item.receipt_name || item.name || 'Item',
    kitchen_name: item.kitchenName || item.kitchen_name || item.name || 'Item',
    description:  item.description || '',
    type:         item.type        || 'simple',
    cat:          item.cat         || null,
    cats:         item.cats        || [],
    parent_id:    item.parentId !== undefined ? item.parentId : (item.parent_id !== undefined ? item.parent_id : null),
    sort_order:   item.sortOrder   ?? item.sort_order   ?? 0,
    pricing,
    allergens:    item.allergens   || [],
    assigned_modifier_groups:    item.assignedModifierGroups    || item.assigned_modifier_groups    || [],
    assigned_instruction_groups: item.assignedInstructionGroups || item.assigned_instruction_groups || [],
    visibility:   item.visibility  || { pos: true, kiosk: true, online: true },
    sold_alone:   item.soldAlone   ?? item.sold_alone   ?? true,
    archived:     item.archived    ?? false,
    centre_id:    item.centreId    || item.centre_id    || null,
    tax_rate_id:  item.taxRateId   || item.tax_rate_id  || null,
    tax_overrides: item.taxOverrides || item.tax_overrides || {},
    image:        item.image || null,
    // v4.6.3: ownership / sharing fields (added by v4.6.0 schema migration)
    scope:           item.scope          || item.ownership_scope || 'local',
    org_id:          item.orgId          ?? item.org_id          ?? null,
    master_id:       item.masterId       ?? item.master_id       ?? null,
    lock_pricing:    item.lockPricing    ?? item.lock_pricing    ?? false,
    locked_fields:   item.lockedFields   ?? item.locked_fields   ?? [],
    updated_at:   new Date().toISOString(),
  };

  const result = await supabase.from('menu_items').upsert(dbItem, { onConflict: 'id' });
  if (result.error) console.error('[DB] menu_items upsert failed:', result.error.message, 'item:', item.id);
  return result;
};

export const archiveMenuItem = async (id) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('menu_items').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', id);
};

// ── Floor plan ────────────────────────────────────────────────────────────────
export const fetchFloorPlan = async (locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };
  const [tables, sections] = await Promise.all([
    supabase.from('floor_tables').select('*').eq('location_id', locationId).order('sort_order'),
    supabase.from('sections').select('*').eq('location_id', locationId).order('sort_order'),
  ]);
  return { data: { tables: tables.data, sections: sections.data }, error: tables.error || sections.error };
};

export const upsertFloorTable = async (table, locationId = null) => {
  if (isMock) return { data: null, error: null };
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };
  // v4.6.5 Bug 6: floor_tables columns are (id, location_id, label, x, y, w, h, shape,
  // max_covers, section, sort_order). Client state carries camelCase (maxCovers) plus
  // runtime-only fields (status, session, firedCourses, sentAt, reservation). PostgREST
  // rejects unknown columns, so every add/update was silently failing and the floor plan
  // never persisted (B8 was a pre-existing row). Pick only real columns and rename.
  const row = {
    id: table.id,
    location_id: locationId,
    label: table.label,
    x: table.x ?? 0,
    y: table.y ?? 0,
    w: table.w ?? 80,
    h: table.h ?? 80,
    shape: table.shape ?? 'rect',
    max_covers: table.max_covers ?? table.maxCovers ?? 4,
    section: table.section ?? null,
    sort_order: table.sort_order ?? table.sortOrder ?? 0,
  };
  const result = await supabase.from('floor_tables').upsert(row, { onConflict: 'id' });
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

export const toggle86DB = async (itemId, is86, locationId = null) => {
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
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return { data: null, error: new Error('No location') };
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

  // v4.3 — durable send: if the network/Supabase fails, queue the write to
  // IndexedDB so it replays when the device comes back online. No lost tickets.
  const handleFailure = async (err) => {
    try {
      const { queueWrite } = await import('../sync/OfflineQueue');
      await queueWrite({ type: 'upsert', table: 'kds_tickets', payload: row, onConflict: 'id' });
      console.warn('[KDS] Send failed, queued for retry:', err?.message || err);
    } catch (qe) {
      console.error('[KDS] CRITICAL: send failed AND queueing failed:', qe?.message || qe);
    }
  };

  try {
    const res = await supabase.from('kds_tickets').insert(row);
    if (res?.error) await handleFailure(res.error);
    return res;
  } catch (err) {
    await handleFailure(err);
    return { data: null, error: err };
  }
};

export const bumpKDSTicket = async (id) => {
  if (isMock) return { data: null, error: null };
  return supabase.from('kds_tickets').update({ status: 'bumped', bumped_at: new Date().toISOString() }).eq('id', id);
};

// v4.6.20 — historical fetch for the KDS performance report. Returns both
// pending and bumped tickets so we can compute bump time (bumped_at - sent_at).
export const fetchKDSTicketsRange = async (locationId = null, fromDate, toDate, limit = 2000) => {
  if (isMock) return { data: null, error: null };
  let query = supabase
    .from('kds_tickets')
    .select('*')
    .eq('location_id', locationId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (fromDate) query = query.gte('sent_at', fromDate.toISOString());
  if (toDate)   query = query.lte('sent_at', toDate.toISOString());
  const result = await query;
  if (result.data) {
    result.data = result.data.map(t => ({
      id: t.id,
      tableLabel: t.table_label,
      tableId: t.table_id,
      server: t.server,
      covers: t.covers,
      centreId: t.centre_id,
      items: t.items || [],
      status: t.status,
      firedCourses: t.fired_courses || [],
      sentAt:   t.sent_at   ? new Date(t.sent_at).getTime()   : null,
      bumpedAt: t.bumped_at ? new Date(t.bumped_at).getTime() : null,
    }));
  }
  return result;
};

// ── Closed checks ─────────────────────────────────────────────────────────────
export const insertClosedCheck = async (check, locationId = null) => {
  if (isMock) return { data: null, error: null };
  // Always resolve real location — NEVER fall back to LOCATION_ID ('loc-demo')
  if (!locationId || locationId === 'loc-demo') {
    locationId = await getLocationId().catch(() => null);
  }
  if (!locationId || locationId === 'loc-demo') {
    // Last resort: read from paired device in localStorage
    try {
      const dev = JSON.parse(localStorage.getItem('rpos-device') || '{}');
      locationId = dev.locationId || null;
    } catch {}
  }
  if (!locationId) {
    console.error('[DB] insertClosedCheck: could not resolve locationId — check will be lost');
    return { data: null, error: new Error('No locationId') };
  }

  const row = {
    id:           check.id,
    location_id:  locationId,
    ref:          check.ref,
    server:       check.server,
    staff_id:     check.staffId   || null,   // v4.6.19 — FK to staff_members.id
    covers:       check.covers,
    order_type:   check.orderType,
    customer:     check.customer,
    items:        check.items,
    discounts:    check.discounts,
    subtotal:     check.subtotal,
    service:      check.service,
    tip:          check.tip,
    tax_amount:   check.taxAmount != null ? check.taxAmount : null,  // v4.6.19 — stored explicitly
    total:        check.total,
    method:       check.method,
    drawer_id:    check.drawerId || null,   // v4.6.37
    shift_id:     check.shiftId  || null,   // v4.6.37
    closed_at:    check.closedAt ? new Date(check.closedAt).toISOString() : new Date().toISOString(),
    status:       check.status || 'paid',
    refunds:      check.refunds || [],
    table_id:     check.tableId || null,
    table_label:  check.tableLabel || null,
  };

  // Use DataSafe triple-write: localStorage → Supabase (queued if offline)
  const { safeInsertClosedCheck } = await import('../sync/DataSafe.js');
  return safeInsertClosedCheck(check, row);
};

export const fetchClosedChecks = async (locationId = null, limit = 500, sinceDate = null) => {
  if (isMock) return { data: null, error: null };
  // Use provided date or fall back to today's start (will be refined by locationTime once config loads)
  const since = sinceDate || getTodayStartFallback();
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
      staffId: c.staff_id,
      orderType: c.order_type, customer: c.customer,
      items: c.items || [], discounts: c.discounts || [],
      subtotal: c.subtotal, service: c.service, tip: c.tip, total: c.total,
      taxAmount: c.tax_amount,
      method: c.method,
      closedAt: c.closed_at ? new Date(c.closed_at).getTime() : null,
      status: c.status, refunds: c.refunds || [],
      tableId: c.table_id, tableLabel: c.table_label,
    }));
  }
  return result;
};

// For reports — fetch checks across any date range
export const fetchClosedChecksRange = async (locationId = null, fromDate, toDate, limit = 1000) => {
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
      staffId: c.staff_id,
      orderType: c.order_type, customer: c.customer,
      items: c.items || [], discounts: c.discounts || [],
      subtotal: c.subtotal, service: c.service, tip: c.tip, total: c.total,
      taxAmount: c.tax_amount,
      method: c.method,
      closedAt: c.closed_at ? new Date(c.closed_at).getTime() : null,
      status: c.status, refunds: c.refunds || [],
      tableId: c.table_id, tableLabel: c.table_label,
    }));
  }
  return result;
};

// ── Config pushes ─────────────────────────────────────────────────────────────
export const insertConfigPush = async (push, locationId = null) => {
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

// ── Product images ─────────────────────────────────────────────────────────────
const BUCKET = 'product-images';

export const uploadProductImage = async (itemId, locationId, file) => {
  if (!supabase || isMock) return { url: null, error: new Error('Not connected') };
  // Deterministic path: location/item.ext — re-upload always replaces
  const ext = file.name.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
  const path = `${locationId}/${itemId}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: '3600',
  });
  if (upErr) return { url: null, error: upErr };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Bust CDN cache with timestamp
  const url = `${data.publicUrl}?t=${Date.now()}`;
  return { url, error: null };
};

export const deleteProductImage = async (itemId, locationId) => {
  if (!supabase || isMock) return;
  // Try both jpg and webp/png
  const exts = ['jpg', 'png', 'webp', 'jpeg'];
  for (const ext of exts) {
    await supabase.storage.from(BUCKET).remove([`${locationId}/${itemId}.${ext}`]);
  }
};

// v3.9.0 — image field in upsert

// ── Quick Screen ───────────────────────────────────────────────────────────────
export const saveQuickScreenIds = async (ids, locationId = null) => {
  if (isMock) return;
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return;
  await supabase.from('locations').update({ quick_screen_ids: ids }).eq('id', locationId);
};

export const loadQuickScreenIds = async (locationId = null) => {
  if (isMock) return [];
  if (!locationId || locationId === 'loc-demo') locationId = await getLocationId();
  if (!locationId || locationId === 'loc-demo') return [];
  const { data } = await supabase.from('locations').select('quick_screen_ids').eq('id', locationId).single();
  return data?.quick_screen_ids || [];
};

// ── Multi-location (v4.6.22) ──────────────────────────────────────────────────
// Returns every location the currently-authenticated user has access to.
// Prefers the new user_locations junction; falls back to user_profiles.location_id
// for pre-migration environments so nothing breaks if the SQL isn't run yet.
export const fetchAccessibleLocations = async () => {
  if (isMock) {
    return { data: [{ id: 'loc-demo', name: 'Demo Location', role: 'manager' }], error: null };
  }
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { data: [], error: new Error('No authenticated user') };

  // Try the junction table first (v4.6.22+)
  const junction = await supabase
    .from('user_locations')
    .select('role, location_id, locations(id, name, timezone)')
    .eq('user_id', userId);

  if (!junction.error && junction.data?.length) {
    return {
      data: junction.data
        .filter(r => r.locations)
        .map(r => ({
          id: r.locations.id,
          name: r.locations.name,
          timezone: r.locations.timezone,
          role: r.role,
        })),
      error: null,
    };
  }

  // Fallback for pre-v4.6.22 schemas OR users not yet seeded: read single
  // location from user_profiles.
  const profile = await supabase
    .from('user_profiles')
    .select('location_id, locations(id, name, timezone)')
    .eq('id', userId)
    .single();

  if (profile.data?.locations) {
    return {
      data: [{
        id: profile.data.locations.id,
        name: profile.data.locations.name,
        timezone: profile.data.locations.timezone,
        role: 'manager',
      }],
      error: null,
    };
  }
  return { data: [], error: null };
};

// Fetch closed checks across multiple locations in parallel. Each row is tagged
// with its source locationId so the Location compare report can group by site.
export const fetchClosedChecksMultiRange = async (locationIds = [], fromDate, toDate, limit = 2000) => {
  if (!locationIds?.length) return { data: [], error: null };
  if (isMock) return { data: [], error: null };
  try {
    const results = await Promise.all(locationIds.map(id =>
      fetchClosedChecksRange(id, fromDate, toDate, limit).then(r => ({
        id,
        checks: (r.data || []).map(c => ({ ...c, locationId: id })),
      }))
    ));
    return { data: results.flatMap(r => r.checks), error: null };
  } catch (err) {
    return { data: [], error: err };
  }
};
