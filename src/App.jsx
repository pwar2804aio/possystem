import { useState, useCallback, useEffect } from 'react';
import './styles/globals.css';
import { useStore } from './store';
import PINScreen from './surfaces/PINScreen';
import POSSurface from './surfaces/POSSurface';
import BarSurface from './surfaces/BarSurface';
import TablesSurface from './surfaces/TablesSurface';
import { KDSSurface } from './surfaces/OtherSurfaces';
import AIChat from './components/AIChat';

function AIAssistantSurface() {
  const { staff } = useStore();
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding:'16px 24px 14px', borderBottom:'1px solid var(--bdr)', flexShrink:0, background:'var(--bg1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'var(--acc-d)', border:'1px solid var(--acc-b)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✦</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>AI Shift Assistant</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>Powered by Claude · Ask about your shift</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:'var(--grn-d)', border:'1px solid var(--grn-b)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--grn)' }}/>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--grn)' }}>Live</span>
          </div>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
          {['📊 Shift summary', '🍺 Item sales', '⏰ Busiest hour', '🪑 Open tables', '⚠️ Allergen lookup', '👤 Server stats', '🖨 Printers', '🚫 86 an item'].map(c => (
            <span key={c} style={{ fontSize:11, padding:'3px 8px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t3)', fontWeight:600 }}>{c}</span>
          ))}
        </div>
      </div>
      {/* Chat */}
      <div style={{ flex:1, overflow:'hidden' }}>
        <AIChat
          mode="foh"
          staff={staff}
          placeholder="Ask about today's shift, allergens, printer status…"
        />
      </div>
    </div>
  );
}
import BackOfficeApp from './backoffice/BackOfficeApp';
import { isMock, supabase } from './lib/supabase';
import PairingScreen from './surfaces/PairingScreen';
import ModeSelector from './surfaces/ModeSelector';
import CompanyAdminApp from './admin/CompanyAdminApp';
import DeviceSetup from './surfaces/DeviceSetup';
import StatusDrawer from './components/StatusDrawer';
import SyncBridge from './sync/SyncBridge';
import MasterOfflineModal from './components/MasterOfflineModal';
import ConfigSyncBanner from './components/ConfigSyncBanner';
import KioskSurface from './surfaces/KioskSurface';
import OrdersHub from './surfaces/OrdersHub';
import useSupabaseInit from './lib/useSupabaseInit';
import { VERSION } from './lib/version';

const CHANGELOG = [
  { version: '3.8.2', date: 'Apr 2026', label: 'Fix: archived variants now persist to Supabase', changes: ['archiveMenuItem was only updating local Zustand state — no Supabase write. Variants deleted via Archive item button appeared to be gone but reloaded on refresh because the database never changed. Now calls upsertMenuItem with archived:true immediately after updating store.'] },
  { version: '3.8.1', date: 'Apr 2026', label: 'Fix: variant/size delete now persists to Supabase', changes: ['All db.js calls in store/index.js were dynamic imports — import(...).then(...). In the bundled output these were silently failing, meaning menu item updates (archive, parent_id clear) never reached Supabase. Replaced with static top-level import. Every menu write — variant delete, price update, 86, KDS ticket, closed check — now fires reliably.'] },
  {
    version: '3.8.0', date: 'Apr 2026', label: 'AI: menu lookup fixed, always sees current data',
    changes: [
      'getStoreState was memoised with useCallback — if menu items loaded from Supabase after the AI panel opened, the snapshot was stale and the AI saw 0 items. Replaced with direct useStore.getState() call at execution time so every tool call reads live data.',
      'get_menu_items: was filtering on i.categoryId but items from Supabase use i.cat — both fields now checked. Limit raised from 30 to 50 items.',
      'add_to_order: now filters archived items out before searching, includes fallback matching in both directions, and shows available item names in the error message if not found.',
      'get_item_detail: category lookup now checks both i.cat and i.categoryId.',
    ],
  },
  { version: '3.7.9', date: 'Apr 2026', label: 'Fix: deleted variants no longer reappear on refresh', changes: ['upsertMenuItem was using || for parent_id mapping — when parentId was set to null (on variant delete), || treated null as falsy and fell through to the old parent_id from the loaded item, writing the original value back to Supabase. Fixed to use explicit undefined check so null is correctly written as null.'] },
  {
    version: '3.7.8', date: 'Apr 2026', label: 'Fix: first item no longer vanishes. History syncing.',
    changes: [
      'First item vanish: sessionsChannel INSERT echo-back guard added. When a table is opened, flushSessions writes to Supabase — the INSERT echo was arriving after items were added and overwriting them. Guard 1: skip INSERT events for the currently active table. Guard 2: skip if local session is newer than incoming echo.',
      'History sync: closed_checks added to supabase_realtime publication — INSERT events now broadcast to all devices instantly when any terminal takes payment.',
    ],
  },
  { version: '3.7.7', date: 'Apr 2026', label: 'Session reconciler: grace period + architecture review', changes: ['SessionReconciler: 30s grace period for newly opened tables before Supabase is trusted — prevents premature clearing of sessions not yet flushed', 'History and reports confirmed cross-device: closed_checks realtime broadcasts to all devices, BOReports queries Supabase directly. Scales to 20+ terminals.'] },
  {
    version: '3.7.6', date: 'Apr 2026', label: 'Session sync: polling replaces unreliable DELETE events',
    changes: [
      'SessionReconciler: polls Supabase active_sessions every 10 seconds and reconciles with local store',
      'Any table closed on another device will clear within 10s — guaranteed, no dependency on realtime DELETE events',
      'Any table opened on another device will appear within 10s',
      'Skips the currently active table (being edited) to prevent overwriting local changes',
      'Replaces the unreliable Supabase Realtime DELETE event approach that was never working consistently',
    ],
  },
  {
    version: '3.7.5', date: 'Apr 2026', label: 'Items no longer flicker. Table close syncs.',
    changes: [
      'Items flickering/disappearing on add: adding items to an order was writing to Supabase active_sessions. Supabase echoed the write back as an UPDATE event, which overwrote the local store with stale data — items appeared to vanish. Fix: item add/remove no longer triggers a session flush. Only table open/close, covers change, and send-to-kitchen trigger a flush.',
      'Echo-back blocked: sessionsChannel UPDATE handler now skips updates for the table currently being edited on this device. Cross-device updates still apply to all other tables.',
      'Table close syncs: closed_checks INSERT already fires correctly. When received on another device, it now clears the matching table from the floor AND adds to history simultaneously.',
      'VERSION used in master heartbeat.',
    ],
  },
  {
    version: '3.7.4', date: 'Apr 2026', label: 'Sync fixed, master works, qty lag gone',
    changes: [
      'Table close sync: closed_checks INSERT now ALSO clears the table from the other device floor plan — belt and suspenders alongside the DELETE event. Table will clear on any device the moment payment is taken elsewhere',
      'Master detection: Main profile set is_master=true directly in Supabase. Profile save now uses update() not upsert() — upsert was not persisting is_master correctly',
      'VERSION constant used in master heartbeat instead of hardcoded string',
      'Qty +/- lag: BroadcastChannel and localStorage writes now skipped for qty-only changes — only meaningful changes (adds, voids, sends, opens, closes) trigger cross-tab sync',
    ],
  },
  { version: VERSION, date: 'Apr 2026', label: 'Fix: master correctly identifies itself every time', changes: ['Device validation already fetches device_profiles from Supabase on every boot — now reads is_master from that and writes it into rpos-device-config', 'Master boot reads cfg.isMaster from rpos-device-config — always set correctly because validation runs before this fires', 'No more Supabase queries or localStorage guessing in boot path'] },
  { version: '3.7.2', date: 'Apr 2026', label: 'Fix: master device correctly identifies itself', changes: ['Master detection now queries Supabase devices+device_profiles directly at boot — never relies on stale localStorage cache which was missing isMaster field', 'Fallback to localStorage only if Supabase query fails'] },
  {
    version: '3.7.1', date: 'Apr 2026', label: 'Master-child: hard block, fixed false positives, device counts',
    changes: [
      'Master offline modal: removed Continue anyway — terminal is now fully locked until master responds. No escape.',
      'Master device no longer triggers offline modal on itself — isMaster=true devices only run heartbeat, never monitor',
      'Child monitor delayed 20s on startup — prevents false master-offline on boot before first heartbeat is written',
      'Device profiles: device count now fetched from Supabase devices table — shows real count of devices assigned to each profile',
    ],
  },
  {
    version: '3.7.0', date: 'Apr 2026', label: 'Fix: device profiles finally save correctly',
    changes: [
      'Root cause: DeviceProfiles.jsx only imported isMock from supabase — supabase client and getLocationId were missing from the top-level import. Dynamic imports inside resolveLocId and loadFromDB did not resolve correctly in the Vite bundle, so supabase.upsert was never called',
      'Fixed: added supabase and getLocationId to the top-level import. Removed all dynamic imports inside the component. The supabase client used in save/addProfile is now the same authenticated instance used by all other back office operations',
    ],
  },
  {
    version: '3.6.9', date: 'Apr 2026', label: 'Fix: profiles save, items no longer vanish on qty change',
    changes: [
      'Device profiles: raw fetch was returning 401 (anon key rejected for writes). Replaced with supabase client upsert which uses authenticated session — profiles now persist on refresh',
      'Qty glitch: updateItemQty was removing items when qty hit 0 — rapid tapping would overshoot and silently delete items from the order. Now clamped at minimum 1. Only explicit void removes an item',
      'Qty lag: unsubSessions now correctly skips Supabase flush for qty-only changes (item count unchanged, no sends, no covers change). Only meaningful cross-device events trigger a flush',
    ],
  },
  { version: '3.6.8', date: 'Apr 2026', label: 'Fix: device profiles now save and persist correctly', changes: ['addProfile had if (!isMock && locationId) guard — if locationId state was null (async getLocationId not yet resolved) the Supabase insert was skipped entirely. Profile appeared locally, disappeared on refresh', 'toDbRow was missing service_charge, is_master, sort_order columns — new profiles lost those fields', 'resolveLocId() helper always gets real locationId before any write — never saves with null location_id', 'Panel now closes immediately on save (optimistic) before the network request completes', 'Both save and addProfile now show correct error toast if Supabase write fails'] },
  { version: '3.6.7', date: 'Apr 2026', label: 'Fix: device profile dropdown now shows real profiles', changes: ['ProfileSelect in Devices page was calling getProfiles() statically at render time — never updated when Supabase loaded profiles into localStorage', 'Now uses useState + useEffect to fetch profiles from Supabase directly on mount, and listens for localStorage changes', 'The hardcoded DEFAULT_PROFILES fallback (Main counter / Bar terminal / Server handheld) no longer appears once real profiles are loaded'] },
  {
    version: '3.6.6', date: 'Apr 2026', label: 'Critical: realtime fixed, lag fixed',
    changes: [
      'ROOT CAUSE FIX: startRealtime was catching errors and falling back to loc-demo — every device subscribed sessions/checks channels to the wrong location UUID, so DELETE events and check INSERTs were invisible to other devices. Now retries up to 5x with 2s gap to get real locationId, final fallback from rpos-device localStorage',
      'Lag fix: scheduleFlush was firing on EVERY store change including every quantity increment. Now only flushes on meaningful events: table open/close, item sent to kitchen, item added/voided, covers changed. Quantity edits no longer trigger a Supabase write',
    ],
  },
  {
    version: '3.6.5', date: 'Apr 2026', label: 'Master-child architecture: network resilience',
    changes: [
      'Device Profiles: Master POS toggle — designate one terminal as the network master',
      'Master terminal writes a heartbeat to Supabase every 10 seconds',
      'Child terminals check the heartbeat every 15 seconds — if master not seen in 30s, a blocking error screen appears',
      'Blocking error: "Master POS not found on network" with instructions, Force Sync from cloud button, and Continue Anyway option',
      'Back office: new Network & Sync section showing all device heartbeats, online/offline status, open tables per device',
      'Force Sync button: pulls authoritative sessions and closed checks from Supabase and reconciles with local state — use when devices have drifted',
    ],
  },
  { version: '3.6.4', date: 'Apr 2026', label: 'Fix: modifiers working again on POS', changes: ['SyncBridge item load from Supabase was missing assignedModifierGroups mapping — DB uses assigned_modifier_groups (snake_case), modifier modal reads assignedModifierGroups (camelCase). Items from Supabase never had the camelCase property so modifier modal never opened', 'Also maps assignedInstructionGroups correctly'] },
  { version: '3.6.3', date: 'Apr 2026', label: 'Fix: table-close now syncs across devices', changes: ['Supabase Realtime does not support row-level filters on DELETE events — removed filter from sessionsChannel DELETE handler, now checks location_id in the handler body instead', 'With REPLICA IDENTITY FULL set, the full row including location_id and table_id is available in the DELETE payload'] },
  {
    version: '3.6.2', date: 'Apr 2026', label: 'Fix: modifiers restored, table-close sync fixed',
    changes: [
      'REGRESSION FIX: SyncBridge modifier mapping used wrong column names (type/required) — should be selectionType/selection_type. Overwrote correct snapshot data with broken objects, breaking all modifiers on boot',
      'sessionsChannel DELETE handler now includes location_id filter — with REPLICA IDENTITY FULL this correctly routes table-close events to the right devices',
      'Removed duplicate active_sessions subscription in SyncBridge — realtime.js sessionsChannel now owns all session sync (INSERT/UPDATE/DELETE)',
    ],
  },
  {
    version: '3.6.1', date: 'Apr 2026', label: 'Critical sync fix: closed checks and table clears now sync across all devices',
    changes: [
      'ROOT CAUSE: insertClosedCheck was writing location_id = loc-demo instead of the real location UUID — every check was invisible to other devices',
      'insertClosedCheck now always resolves the real locationId via getLocationId(), never falls back to the mock loc-demo value',
      'active_sessions now has a dedicated realtime subscription in realtime.js for INSERT/UPDATE/DELETE — DELETE events were silently dropped before because default Postgres replica identity only carries PK columns',
      'REQUIRED: Run ALTER TABLE active_sessions REPLICA IDENTITY FULL and ALTER TABLE closed_checks REPLICA IDENTITY FULL in Supabase SQL editor for DELETE events to carry table_id',
    ],
  },
  {
    version: '3.6.0', date: 'Apr 2026', label: 'Full system hardening — data integrity milestone',
    changes: [
      'Service charge backfill: deviceConfig always gets serviceCharge from profile on every device validation — no more stale sessions missing SC',
      'DataSafe triple-write: closed checks localStorage → Supabase, reconcile on boot and reconnect, periodic 60s sync',
      'Open orders report fixed: activeSessions derived from tables[], was always undefined',
      'Reports revenue: live Supabase fetch with locationId fallback, falls back to store if needed',
      'Modifier groups load from Supabase on POS boot — no Push to POS needed',
      'AI assistant: 9 new tools, all reporting queries hit Supabase directly for cross-device accuracy',
      'Realtime closed_checks subscription: all devices receive new payments instantly',
      'SQL editor: dedicated Restaurant OS Schema Changes snippet — no more editing wrong saved queries',
    ],
  },
  {
    version: '3.5.99', date: 'Apr 2026', label: 'Reports: revenue now shows correctly',
    changes: [
      'BOReports todayLive fetch: getLocationId() was returning null in back office context — added fallback to rpos-device localStorage and store',
      'If Supabase fetch unavailable, falls back to store closedChecks filtered to today',
    ],
  },
  {
    version: '3.5.98', date: 'Apr 2026', label: 'Data resilience: triple-write safety net',
    changes: [
      'DataSafe module: closed checks now triple-written — localStorage first (instant), then Supabase. If Supabase fails the check is queued, never lost',
      'On boot: reconcilePendingChecks() runs — any check in localStorage but not in Supabase is re-inserted automatically',
      'On reconnect: pending checks replay to Supabase immediately',
      'Periodic background sync every 60s catches any missed writes',
      'OfflineBanner now shows amber syncing state when pending checks exist',
    ],
  },
  { version: '3.5.97', date: 'Apr 2026', label: 'AI: updated UI chips and suggestions', changes: ['FOH shortcut chips updated: Shift summary, Item sales, Busiest hour, Open tables, Server stats, Allergens', 'BOH chips updated: Sales, Item lookup, Hourly, Server performance, Open tables, Payment breakdown, Menu', 'Suggestion pills updated for both modes to showcase new capabilities', 'Tool progress badges added for all 9 new tools'] },
  {
    version: '3.5.96', date: 'Apr 2026', label: 'AI assistant: massively expanded capabilities',
    changes: [
      'New tool: search_item_sales — ask how many lattes, pints, burgers sold today (partial name match)',
      'New tool: get_hourly_breakdown — busiest hour, revenue per hour, peak time analysis',
      'New tool: get_payment_breakdown — card vs cash vs split, tips, avg check per method',
      'New tool: get_server_performance — checks, covers, revenue and avg check per server',
      'New tool: get_covers_report — covers by hour and by server',
      'New tool: get_open_tables — all open tables with covers, server, items, subtotal, seated time',
      'New tool: get_shift_summary — one-call shift overview: revenue, covers, floor status, top item',
      'New tool: get_item_detail — full item info including modifiers, allergens, price',
      'New tool: remove_from_order — AI can propose removing items from active order (with confirmation)',
      'All reporting tools now query Supabase directly — accurate across all devices',
      'System prompts updated with examples of what the AI can answer',
    ],
  },
  {
    version: '3.5.95', date: 'Apr 2026', label: 'Data sync: consistent checks and open orders across all devices',
    changes: [
      'Open orders report fixed: activeSessions now derived from tables[] — was always undefined so report showed zero',
      'BOReports: today tab now fetches closed checks fresh from Supabase on mount — no longer device-local',
      'AI assistant get_sales_summary and get_top_items now query Supabase directly — correct totals on any device including Sunmi',
      'Realtime subscription added for closed_checks — all devices receive new check immediately when any device takes payment',
    ],
  },
  { version: '3.5.94', date: 'Apr 2026', label: 'Fix: modifier groups load from Supabase on boot', changes: ['SyncBridge now fetches modifier_groups from Supabase on POS boot — no longer requires a Push to POS for modifiers to work after a reload'] },
  { version: '3.5.93', date: 'Apr 2026', label: 'Service charge: floor plan panel + checkout fixed', changes: ['Floor plan table panel now computes service charge using resolveServiceCharge — respects minCovers threshold and waived flag', 'Checkout modal shows service charge correctly from getPOSTotals', 'Service charge label no longer hardcoded to 12.5%'] },
  { version: '3.5.92', date: 'Apr 2026', label: 'Fix: serviceCharge guaranteed in deviceConfig', changes: ['setDeviceConfig now auto-merges serviceCharge from rpos-device-profiles if missing — no code path can strip it', 'minConfig path also carries serviceCharge forward from existingConfig', 'Service charge on min covers now works on first load without needing re-pair'] },
  { version: '3.5.91', date: 'Apr 2026', label: 'Fix: service charge config now reaches deviceConfig', changes: ['serviceCharge was not being written to rpos-device-config or rpos-terminal-config — fixed in all 3 write locations', 'Store init now backfills serviceCharge from rpos-device-profiles if missing from cached device config', 'Service charge on min covers threshold now works correctly on the POS'] },
  { version: '3.5.90', date: 'Apr 2026', label: 'Save & Send combined into one button', changes: ['Table mode: Save and Send merged into single context-aware button — shows Save (no items), Save & Send (unsent items), or Save (all already sent)'] },
  { version: '3.5.89', date: 'Apr 2026', label: 'Remove Dev Switch device button from POS', changes: ['Dev: Switch device floating button removed from bottom left of POS — was covering the UI'] },
  { version: '3.5.88', date: 'Apr 2026', label: 'Remove Switch device mode button', changes: ['Removed Switch device mode button from back office sidebar — was covering UI'] },
  {
    version: '3.5.87', date: 'Apr 2026', label: 'Service charge per device profile',
    changes: [
      'Service charge now configured per device profile — bar/counter can have it disabled, table service terminals can have different rates',
      'Device Profile editor: enable/disable toggle, rate %, apply to all or min covers threshold',
      'Order panel: service charge only shows for dine-in table orders — never walk-in, takeaway, bar, delivery',
      'Order panel: tap service charge line to remove it for this order, tap Restore to reinstate',
      'resolveServiceCharge() utility: clean logic for all conditions — profile config, order type, covers, waived flag',
    ],
  },
  {
    version: '3.5.86', date: 'Apr 2026', label: 'Tax name changes propagate live everywhere',
    changes: [
      'TaxManager now syncs updated tax rates to Zustand store immediately after save — name/rate changes show live in item editor and order panel',
      'Realtime subscription for tax_rates table — POS receives name and rate changes automatically without page refresh',
    ],
  },
  {
    version: '3.5.85', date: 'Apr 2026', label: 'Data integrity: Supabase as source of truth',
    changes: [
      'updateMenuItem now saves the FULL item to Supabase on every edit — not just the changed patch',
      'SyncBridge now loads taxRates directly from Supabase on boot (not just from snapshot)',
      'SyncBridge maps price from pricing.base when loading items from Supabase',
      'Items edited in back office immediately persist all fields to Supabase correctly',
    ],
  },
  {
    version: '3.5.84', date: 'Apr 2026', label: 'Fix: taxRates now travel with Push to POS',
    changes: [
      'taxRates added to Push to POS snapshot — they were never included before so POS always had empty tax rates',
      'applyConfigUpdate now applies taxRates from snapshot to the store',
    ],
  },
  {
    version: '3.5.83', date: 'Apr 2026', label: 'Tax: order panel + receipt display fixed',
    changes: [
      'Order panel: tax breakdown now shows clearly below service charge, above total',
      'Receipt modal: on-screen preview now shows tax lines (of which VAT or + Sales Tax)',
      'Receipt print (HTML): tax lines now appear after total in printed receipt',
    ],
  },
  {
    version: '3.5.82', date: 'Apr 2026', label: 'Fix: Push to POS now writes menu to Supabase',
    changes: [
      'upsertMenuItem schema fixed — was sending price column which does not exist (schema uses pricing jsonb)',
      'centre_id, tax_rate_id, tax_overrides columns added to menu_items, schema cache reloaded',
      'Push to POS now writes all menu items and categories to Supabase with correct field mapping',
    ],
  },
  {
    version: '3.5.81', date: 'Apr 2026', label: 'Push to POS now writes menu to Supabase',
    changes: [
      'Root cause: Push to POS only saved a config_pushes snapshot, never wrote menu items to the menu_items table — Supabase DB was always empty',
      'Push to POS now upserts ALL menu items and categories to Supabase on every push',
      'upsertMenuItem rewritten to map every field cleanly (not spread full camelCase objects with wrong keys)',
      'upsertMenuCategory added to db.js',
      'After pushing: tax assignments, pricing, allergens — all saved properly to Supabase and queryable',
    ],
  },
  {
    version: '3.5.80', date: 'Apr 2026', label: 'Fix: tax fields now travel from menu item to order item',
    changes: [
      'Root cause found: addItem() never copied taxRateId/taxOverrides onto the order item — so calculateOrderTax had nothing to work with on every item',
      'addItem now carries taxRateId and taxOverrides from menu item into the live order item',
      'recordClosedCheck now computes and stores taxBreakdown at point of payment',
      'tax.js imported properly into store (was using require() which does not work in ES modules)',
    ],
  },
  {
    version: '3.5.79', date: 'Apr 2026', label: 'Fix: tax rates actually load in POS now',
    changes: [
      'Critical fix: supabase client was not imported in useSupabaseInit — tax rates fetch was silently skipped every boot',
      'Menu items now have taxRateId and taxOverrides mapped from snake_case on load in POS context',
    ],
  },
  {
    version: '3.5.78', date: 'Apr 2026', label: 'Tax: fix loading + order panel + receipt',
    changes: [
      'Fix: tax rates now actually load in POS (locId was declared after it was used)',
      'Order panel: shows live tax summary below total (incl. VAT 20% £X.XX for UK, + Sales Tax for US)',
      'ESC/POS receipt: UK shows of which VAT lines under total, US shows tax-exclusive breakdown',
      'Browser/HTML receipt: same tax lines added',
      'Receipt modal: passes taxBreakdown into printReceipt call',
    ],
  },
  {
    version: '3.5.77', date: 'Apr 2026', label: 'Fix: tax rates now load in back office',
    changes: ['Tax rates now load in back office context (were only loading in POS context)', 'Item mapper in back office now includes taxRateId and taxOverrides'],
  },
  {
    version: '3.5.76', date: 'Apr 2026', label: 'Tax system: UK VAT + US Sales Tax',
    changes: [
      'Tax rates table in Supabase — UK seeded: Standard 20%, Reduced 5%, Zero 0%',
      'Back office: Tax & VAT section to create, edit, and delete rates for any location',
      'Menu Manager: Tax tab per item with per-order-type overrides (e.g. takeaway = Zero Rate)',
      'Checkout: shows tax breakdown — inclusive shows VAT extracted, exclusive adds tax on top',
      'Reports: Tax tab with net/tax/gross per rate, period filter, CSV export for accountant',
      'Tax engine handles UK (price includes tax) and US (tax added on top) correctly',
    ],
  },
  {
    version: '3.5.75', date: 'Apr 2026', label: 'Location settings + reports crash fix',
    changes: [
      'Reports crash fixed: locations variable reference error resolved',
      'New Location Settings section in back office: set timezone, business day start, and named shifts',
      'Timezone dropdown with 15 IANA zones — shows live current time in selected zone',
      'Business day start: choose what time the new reporting day begins (default 06:00)',
      'Shifts editor: add/edit/remove Breakfast/Lunch/Dinner style periods with start/end times',
      'Saving clears the location config cache so changes take effect immediately',
    ],
  },
  {
    version: '3.5.74', date: 'Apr 2026', label: 'Save/Send + timezone + shift architecture',
    changes: [
      'Save button: open a table and save it with no items — seats the table and holds it on the floor plan',
      'Seated state: tables with a session but no orders show in blue (seated) vs amber (occupied with orders)',
      'Table mode: Save (always) + Send (only when items exist) — walk-in keeps Send as before',
      'Timezone per location: Platform DB locations table now has timezone, business_day_start, and shifts columns',
      'locationTime.js: business day start utility — reports use location timezone, not device local time',
      'Shift config seeded: Breakfast 07:00-11:30, Lunch 11:30-17:00, Dinner 17:00-23:00 as defaults',
    ],
  },
  {
    version: '3.5.73', date: 'Apr 2026', label: 'Reporting: today only, open orders',
    changes: [
      'Overview cards and shift getter now filter to today (since midnight) — no more historical data polluting revenue',
      'fetchClosedChecks loads only today on boot — week/month fetched fresh from Supabase when selected in reports',
      'AI assistant sales summary now reports today only, not all-time',
      'Reports: new Open Orders tab shows active tables with subtotals, excluded from revenue',
      'Open orders show table label, cover count, item count, and current subtotal with clear not-yet-paid label',
    ],
  },
  {
    version: '3.5.73', date: 'Apr 2026', label: 'AI: add to order + discounts',
    changes: [
      'AI can now view the current order (get_current_order)',
      'AI can add menu items to the active checkout — requires confirmation',
      'AI can apply order discounts — requires confirmation and reason',
      'AI always checks which table is open before adding items',
    ],
  },
  {
    version: '3.5.72', date: 'Apr 2026', label: 'AI tab added to POS nav',
    changes: ['AI Shift Assistant now accessible from the ✦ AI tab in the POS sidebar'],
  },
  {
    version: '3.5.71', date: 'Apr 2026', label: 'AI Assistant: FoH + BoH with tool use',
    changes: [
      'New BoH AI Assistant section — sales reporting, menu lookup, printer status, add items, update prices',
      'FoH Shift Assistant upgraded with full tool use — allergens, printer checks, 86 items',
      'Secure API proxy at /api/ai — Anthropic API key stays server-side, never exposed',
      'Hard constraint system: read tools execute immediately, write tools require explicit confirmation',
      'Tool-call visualization shows what the AI is doing in real time',
    ],
  },
  {
    version: '3.5.70', date: 'Apr 2026', label: 'Quick screen fix: items now push to POS correctly',
    changes: [
      'quickScreenIds now included in Push to POS snapshot',
      'SyncBridge no longer strips quickScreenIds when applying snapshot on POS',
      'Item grid rows expand to fit content instead of overlapping',
    ],
  },
  {
    version: '3.5.69', date: 'Apr 2026', label: 'Item grid fix + quick screen fix',
    changes: [
      'Item grid: rows now use minmax so long names expand the row instead of overlapping',
      'Quick screen: only shows items explicitly configured in Back Office — no more padding with random products',
      'Quick screen: shows a clear setup message when not yet configured',
    ],
  },
  {
    version: '3.5.68', date: 'Apr 2026', label: 'Print agent v2: heartbeat + health tracking',
    changes: [
      'Print agent now writes a heartbeat to Supabase every 30s — dashboard knows agent is alive',
      'Agent ID and hostname visible per location — know exactly which machine the agent is on',
      'printer_health updated after every job: online on success, error with message on failure',
      'Consecutive failure counter increments — after 2+ failures printer marked offline',
      'Agent marks itself offline on clean shutdown (SIGTERM/SIGINT)',
      'Drains stale printing jobs on startup in case agent crashed mid-job',
    ],
  },
  {
    version: '3.5.67', date: 'Apr 2026', label: 'Printer monitoring: proper health tracking',
    changes: [
      'print_jobs added to Supabase realtime — watchJob now fires correctly on job completion',
      'New printer_health table: persistent per-printer status updated on every job outcome',
      'New printer_agents table: ready for LAN print agent heartbeat (90s timeout detection)',
      'Status Drawer reads from printer_health first — accurate and persistent across sessions',
      'Test button: timeout no longer falsely marks printer offline, shows correct agent-vs-printer distinction',
      'agent-failed vs timeout vs error are now three distinct failure states with clear messages',
    ],
  },
  {
    version: '3.5.66', date: 'Apr 2026', label: 'Location switcher fix',
    changes: [
      'Regular users now correctly see their location in the switcher',
      'No longer does a failing DB lookup — reads directly from user_profiles',
      'Super admins still see all companies and locations from Platform DB',
    ],
  },
  {
    version: '3.5.65', date: 'Apr 2026', label: 'Location switcher: super admin sees all orgs',
    changes: [
      'Super admins now see all companies and all locations in the location switcher',
      'Each company shown as a section header with location count and plan badge',
      'Switching to any location updates the active context for the whole back office session',
    ],
  },
  {
    version: '3.5.64', date: 'Apr 2026', label: 'Fix auth: revert getLocationId to user_profiles',
    changes: ['Reverted getLocationId to direct user_profiles lookup — Platform DB query was breaking auth flow'],
  },
  {
    version: '3.5.63', date: 'Apr 2026', label: 'Back office fully cloud-based',
    changes: [
      'Printers: read/write Supabase printers table — survives across machines and incognito',
      'Print routing: read/write Supabase print_routing table — fully cloud-persisted',
      'Push to POS: reads routing and printers from Supabase as source of truth',
      'localStorage only used as POS cache — back office is 100% Supabase',
    ],
  },
  {
    version: '3.5.62', date: 'Apr 2026', label: 'Platform DB: separate user/company management',
    changes: [
      'New RPOS Platform DB (yhzjgyrkyjabvhblqxzu) manages companies, locations, and user access',
      'Ops DB remains clean — only POS operational data',
      'getLocationId now queries Platform DB first, falls back to ops DB for existing installs',
      'Both pwar2804@gmail.com and peter@posup.co.uk seeded in Platform DB with admin access',
    ],
  },
  {
    version: '3.5.61', date: 'Apr 2026', label: 'Auto-fire to kitchen on payment',
    changes: [
      'Walk-in orders paid without sending first now auto-fire to production printing at point of payment',
      'Same applies to table orders — unsent items fire to kitchen when payment is taken',
    ],
  },
  {
    version: '3.5.60', date: 'Apr 2026', label: 'KDS: recall, hold, and per-item bump',
    changes: [
      'History button: tap to see all bumped tickets — tap Recall on any to bring it back to the queue',
      'Hold button (⏸): parks a ticket in an On hold section without bumping it',
      'Held tickets show purple with On Hold badge — tap Back to queue or Bump from held',
      'Per-item bump: small checkbox on each item row — tap to mark individual items done',
      'When all items on a ticket are individually bumped, the whole ticket auto-bumps',
    ],
  },
  {
    version: '3.5.59', date: 'Apr 2026', label: 'Modifiers and instructions on separate lines everywhere',
    changes: [
      'POS order panel: each modifier on its own line, instructions italic, notes with pencil icon',
      'Instructions no longer baked into item name — they live only in the mods list',
      'KDS: each mod/instruction/allergen on its own red line',
      'Kitchen printer: each mod on its own red line, no >> prefix',
    ],
  },
  {
    version: '3.5.58', date: 'Apr 2026', label: 'Modifiers on separate red lines on KDS and printer',
    changes: [
      'KDS: each modifier and instruction on its own line in red',
      'Kitchen printer: each modifier on its own line printed in red ink (ESC/POS ESC r)',
      'Notes printed in red underline bold on kitchen tickets',
    ],
  },
  {
    version: '3.5.57', date: 'Apr 2026', label: 'Course badge always visible on order items',
    changes: [
      'Course badge now always shows on unsent order items (Course 1, Course 2 etc) — tap to change',
      'Fire button appears automatically once order has course 2+ items and course 1 has been sent',
      'Set default course per category in Menu Manager → Menus → edit category',
    ],
  },
  {
    version: '3.5.56', date: 'Apr 2026', label: 'KDS pending courses no longer greyed out',
    changes: ['KDS pending courses shown clearly with ⏳ header, same text weight as fired courses'],
  },
  {
    version: '3.5.55', date: 'Apr 2026', label: 'KDS: live fire course updates via realtime',
    changes: [
      'KDS now reacts to fire course in real time - ticket re-renders when POS fires next course',
      'Fired courses move from dimmed pending section to active flame section instantly',
    ],
  },
  {
    version: '3.5.54', date: 'Apr 2026', label: 'Courses: category assignment + KDS display',
    changes: [
      'Categories now have a Default course picker in the edit modal',
      'Items auto-get the right course when added from a category',
      'Send to kitchen sends all courses in one ticket',
      'KDS groups items by course with flame headers for fired, dimmed for pending',
      'Fire course updates existing KDS ticket via Supabase realtime',
    ],
  },
  {
    version: '3.5.53', date: 'Apr 2026', label: 'Modifier groups: options must come from Items list',
    changes: [
      'Modifier group options can only be added by searching existing sub-items from the Items tab',
      'Manual text entry removed — create items first in Items tab with type Sub item, then add here',
      'Clear message shown if search has no match directing user to create the item first',
    ],
  },
  {
    version: '3.5.52', date: 'Apr 2026', label: 'Modifier groups: options entered manually only',
    changes: ['Removed Search existing items from modifier group editor — options are entered manually (name + price)'],
  },
  {
    version: '3.5.51', date: 'Apr 2026', label: 'Required nested modifier validation',
    changes: [
      'Required validation now checks nested sub-groups (e.g. Coffee Temp shown after picking a milk)',
      'Nested required sub-groups show red border + Required badge when not selected',
      'Error message names the nested group: Please choose: Coffee Temp',
    ],
  },
  {
    version: '3.5.50', date: 'Apr 2026', label: 'Required modifier fix: group min overrides item min',
    changes: [
      'Required modifier validation now uses the higher of group-level min vs item-level min',
      'Previously: item stored min:0 (optional) which silently overrode group min:1 (required)',
      'Now: if a group is marked Required in Modifier groups tab, it stays required on all items',
    ],
  },
  {
    version: '3.5.49', date: 'Apr 2026', label: 'Archived items + sub-items simplified + required modifier error',
    changes: [
      'Items tab: Archived button shows all archived items with Unarchive button per item',
      'Sub items filter: simplified flat list with POS visibility toggle on each row',
      'Required modifier error: Add button turns red with message when required groups not selected',
      'Missing required groups highlighted with red border',
    ],
  },
  {
    version: '3.5.48', date: 'Apr 2026', label: 'Sub-items: proper category manager',
    changes: [
      'Sub-items view rebuilt as a two-panel category manager',
      'Left panel: create and select sub-item categories (Milks, Sauces, Proteins…)',
      'Right panel: shows items in selected category with individual POS visibility toggles',
      'Assign existing sub-items to any category using the ← Assign existing search picker',
      'POS visibility toggle on category header toggles soldAlone for all items in the group at once',
      'Rename categories inline via the ✎ pencil button',
      'Move items back to ungrouped via the ↩ button',
    ],
  },
  {
    version: '3.5.47', date: 'Apr 2026', label: 'Sub-items view + required modifier errors',
    changes: [
      'Items tab: new ⊕ Sub items filter shows dedicated grouped view for all sub-items',
      'Sub-items can be tagged with a Group label (Milks, Sauces, Proteins…) to stay organised as the list grows',
      'Add new sub-items directly within a group using the + Add button on each group header',
      'Required modifier error: Add button turns red and shows which groups need a selection — no more silently blocked orders',
      'Missing required groups highlighted with red border when user tries to add without selecting them',
    ],
  },
  {
    version: '3.5.46', date: 'Apr 2026', label: 'Production routing: subcategory inheritance fixed',
    changes: [
      'Root cause found: order line items did not carry cat or parentId — routing looked at empty fields',
      'Items now look up their category from menuItems store using itemId when routing to production centres',
      'Variant items (e.g. Small Latte) inherit routing from parent item category chain: Coffee → Hot Drinks → KDS Bar',
      'cat and parentId now stamped onto order line items at creation time',
    ],
  },
  {
    version: '3.5.46', date: 'Apr 2026', label: 'Production routing: variant sizes route via parent category',
    changes: [
      'Variant sizes (Small/Medium/Large) now route using their parent item category if their own category does not match',
      'Latte sizes now correctly appear on KDS Bar because Latte is in Coffee → Hot Drinks → assigned to KDS Bar',
      'Both table and bar tab routing paths updated',
    ],
  },
  {
    version: '3.5.46', date: 'Apr 2026', label: 'Routing: subcategory inheritance',
    changes: [
      'Production routing now includes subcategories — if Hot Drinks is assigned to KDS Bar, items in Coffee (a subcategory) also route there',
      'Latte (in Coffee, sub of Hot Drinks) now correctly routes to KDS Bar',
      'Simple product (in Cat 1, not assigned anywhere) correctly goes nowhere',
    ],
  },
  {
    version: '3.5.45', date: 'Apr 2026', label: 'Production routing fix + category rename/delete',
    changes: [
      'Production routing: items not assigned to any centre no longer fall back to KDS Bar — they go nowhere',
      'Simple product and other unrouted items will only appear on KDS if their category is explicitly assigned there',
      'Category rename/delete: ✎ and × buttons now appear inline on each category row — no more hidden bottom panel',
      'Deleting a category warns that items will become uncategorised',
      'After any category change, Push to POS propagates the update to all terminals',
    ],
  },
  {
    version: '3.5.44', date: 'Apr 2026', label: 'KDS test fix: routes to correct centre',
    changes: [
      'KDS test now sends ticket to the correct production centre — BAR KDS receives its own test ticket',
      'Fixed: test tickets had centre_id null so KDS filtered them out',
    ],
  },
  {
    version: '3.5.43', date: 'Apr 2026', label: 'KDS status: use ticket activity as online signal',
    changes: [
      'KDS online detection: 15min last_seen threshold (was 3min)',
      'KDS also shown as online if tickets were bumped within the last 10 minutes',
      'BAR KDS correctly shows online when in active use',
    ],
  },
  {
    version: '3.5.42', date: 'Apr 2026', label: 'Status drawer: KDS status + test all hardware',
    changes: [
      'KDS screens now shown in Status drawer with online/offline status based on last_seen heartbeat',
      'Test button on each printer — waits for agent confirmation, shows real outcome',
      'Test button on each KDS — sends a test ticket visible on the KDS screen',
      'KDS heartbeat: device updates last_seen every 60s while KDS surface is open',
      'Print queue shows issue count in section label when there are problems',
    ],
  },
  {
    version: '3.5.41', date: 'Apr 2026', label: 'Print queue: hide completed jobs',
    changes: ['Print queue in Status drawer only shows pending and failed jobs — completed prints are hidden'],
  },
  {
    version: '3.5.40', date: 'Apr 2026', label: 'Printer status: real hardware only',
    changes: [
      'Status drawer (⊙) now shows only real configured printers — no fake Stripe/KDS hardware',
      'Printer status derived from actual print_jobs outcomes — online if last job succeeded, offline if failed or agent not responding',
      'Live print queue in Status drawer shows all recent jobs with status, errors, and retry button',
      'Back office Test button now waits up to 20s for agent confirmation — shows timeout error if agent not running',
      'Test result is honest: queued → printed ✓ or timeout/failed with clear message',
    ],
  },
  {
    version: '3.5.40', date: 'Apr 2026', label: 'Sales data never lost',
    changes: [
      'CRITICAL: Closed checks now persist to Supabase on every payment — survive any page reload',
      'POS loads todays closed checks from Supabase on boot — history always intact',
      'localStorage used as fast fallback — any local-only checks merged in on load',
      'closed_checks table schema fixed — inserts now succeed with correct column mapping',
      'Today 2 checks (GBP21.25) recovered and saved to Supabase',
    ],
  },
  {
    version: '3.5.39', date: 'Apr 2026', label: 'Modifier groups: full backend wired',
    changes: [
      'Modifier groups now persist to Supabase — survive page refreshes and work across devices',
      'Back office loads modifier groups from Supabase on boot alongside menu items',
      'Push to POS includes modifier group definitions — POS now receives options, names, prices',
      'Creating, editing, reordering, deleting modifier groups all write to Supabase instantly',
      'Modifiers tab on parent items with variants shows a warning — assign to sizes only',
    ],
  },
  {
    version: '3.5.38', date: 'Apr 2026', label: 'Modifier groups: sub-items only search',
    changes: [
      'Search existing items now only shows items with type Sub item — no regular menu items',
      'Item names now use menuName field correctly — no more showing default New item text',
      'Clear message shown when no sub-items exist yet, with instructions to create them',
    ],
  },
  {
    version: '3.5.37', date: 'Apr 2026', label: 'Profile saves fixed + modifier item search',
    changes: [
      'Profile saves now use direct fetch — proven reliable, no more silent failures',
      'Modifier groups: Search existing items tab — click any menu item to add it as an option with its price',
      'Save error now shows a toast if the network call fails',
    ],
  },
  {
    version: '3.5.36', date: 'Apr 2026', label: 'Profile changes now reach POS instantly',
    changes: [
      'Fixed: profile saves now always reach Supabase — locationId no longer silently blocks saves',
      'Save errors now surface as a toast instead of failing silently',
      'device_profiles added to Supabase realtime — POS receives profile changes within 1 second',
      'Flow: edit profile in back office → save → POS sidebar updates immediately, no Push to POS needed',
    ],
  },
  {
    version: '3.5.35', date: 'Apr 2026', label: 'Device profiles: properly fixed',
    changes: [
      'Profiles load instantly from cache then confirm with Supabase — no blank flash on open',
      'device_profiles added to Supabase realtime — profile changes now reach POS devices live',
      'Profile edits save to Supabase and propagate via realtime subscription immediately',
    ],
  },
  {
    version: '3.5.34', date: 'Apr 2026', label: 'Device profiles: permanently fixed',
    changes: [
      'Deleted profiles now stay deleted — Supabase is the only source of truth, no localStorage or hardcoded fallbacks',
      'prof-1/2/3 ghost profiles permanently removed from database',
      'receipt_printer_id column added to devices table',
      'DeviceProfiles loads fresh from Supabase on every open, never from stale cache',
      'Back office localStorage cleared of stale profile data on next load',
    ],
  },
  {
    version: '3.5.33', date: 'Apr 2026', label: 'Device profiles fixed + printer status moved',
    changes: [
      'Hidden features now correctly hide floor plan, bar, orders nav items',
      'Deleted profiles no longer come back — hardcoded prof-1/2/3 fallbacks removed',
      'Printer status moved into Status drawer (sidebar ⊙), not shift bar',
      'Status drawer polls print bridge live, dot goes amber when offline',
    ],
  },
  {
    version: '3.5.32', date: 'Apr 2026', label: 'Printer: remove port, Push to POS sync, FOH status',
    changes: [
      'Port field removed from printer form — ESC/POS port 9100 always used automatically',
      'Printers now included in Push to POS snapshot — sync to all POS devices instantly',
      'FOH shift bar shows live 🖨 Online/Offline printer bridge status indicator',
      'Status polls bridge every 30s, green glow when online, red when bridge unreachable',
    ],
  },
  {
    version: '3.5.31', date: 'Apr 2026', label: 'Supabase print queue',
    changes: [
      'Print jobs now go via Supabase — no HTTP bridge server, no port forwarding, no CORS',
      'print-agent.js: lightweight Node script, runs on any LAN machine, outbound connections only',
      'Agent subscribes to Supabase realtime for instant job pickup, polls as fallback',
      'Works from iOS, Android, any browser — submit from anywhere, agent prints locally',
      'Test button queues a job via Supabase rather than calling localhost',
    ],
  },
  {
    version: '3.5.30', date: 'Apr 2026', label: 'Back office version fix',
    changes: [
      'Back office version number now matches POS — both read from a single source (lib/version.js)',
      'Previously the back office was stuck on v3.5.25 while the POS showed the correct version',
    ],
  },
  {
    version: '3.5.29', date: 'Apr 2026', label: 'Printer registry',
    changes: [
      'Devices → Printers: add and manage physical printers (name, model, IP, connection type, paper width, roles)',
      'Production printing: printer field is now a dropdown — choose from registered printers',
      'Devices: each terminal can be assigned a receipt printer',
      'Test button sends a test print via WiFi bridge to verify connectivity',
    ],
  },
  {
    version: '3.5.28', date: 'Apr 2026', label: 'Production printing rename',
    changes: [
      '"Print routing" renamed to "Production printing" throughout back office',
      'Sidebar nav, quick-action tiles, and section headers all updated',
    ],
  },
  {
    version: '3.5.27', date: 'Apr 2026', label: 'Sunmi NT311 printer integration',
    changes: [
      'Full ESC/POS print service — works on any device including iOS Safari',
      'WiFi bridge transport: HTTP POST to local Node server → TCP 9100 to printer (universal)',
      'Web Bluetooth transport: direct connection on Chrome/Android',
      'Sunmi native transport: AIDL bridge on Sunmi D3 Pro and other Sunmi devices',
      'Browser window.print() fallback — always available as last resort',
      'print-bridge.js: zero-dependency Node server, runs on Pi, Mac, or Sunmi device',
      'Printer settings panel in back office: transport selector, bridge URL, test connection',
      'ESC/POS builder: bold, center, double-height, two-column, auto-cut, cash drawer trigger',
      'Customer receipt template: itemised bill with mods, discounts, totals, footer',
      'Kitchen ticket template: large table number, double-width items, seat and mod callouts',
      'NT311 setup guide built into the printer settings panel',
    ],
  },
  {
    version: '3.5.26', date: 'Apr 2026', label: 'Live device profile sync',
    changes: [
      'Realtime subscription on device_profiles — profile changes apply instantly without reload',
      'Front end updates immediately when order types, features or defaults change in back office',
    ],
  },
  {
    version: '1.1.1', date: 'Apr 2026', label: 'Store-driven login, kiosk and quick screen fixes',
    changes: [
      'PIN login screen now reads from store staffMembers — staff added in Staff Manager appear on the login screen immediately.',
      'Kiosk surface now reads categories and items from the store, respects quickScreenIds for the Popular tab, filters by visibility.kiosk, and sorts by sortOrder.',
      'Kiosk Popular tab uses the Quick Screen configuration set in Menu Manager.',
      'Items hidden from kiosk via visibility settings no longer appear on the kiosk.',
    ],
  },
  {
    version: '1.1.9', date: 'Apr 2026', label: 'Modifier modal Add button fixed — ReferenceError on selected',
    changes: [
      'CRITICAL FIX: Modifier modal (Ribeye, Chicken supreme etc.) Add button silently failed — buildDisplayName referenced selected which only exists in VariantsModal not ModifiersModal, causing ReferenceError. The modal stayed open with no error visible. Fixed by removing the undefined reference — modifier-only items never have a variant selection in this context.',
    ],
  },
  {
    version: '1.1.9', date: 'Apr 2026', label: 'Modifier modal Add button fixed',
    changes: [
      'CRITICAL FIX: clicking "Add to order" on modifiable items (Ribeye, Chicken supreme etc.) did nothing — buildDisplayName in ModifiersModal referenced selected which is only defined in the variant pick step, not the modifier step. ReferenceError was swallowed by React leaving the modal open.',
      'ModifiersModal buildDisplayName now uses only item name + instruction group selections (cooking preference etc.). Modifier rows (Side choice, Sauce) display on separate lines in the order panel, not in the name.',
    ],
  },
  {
    version: '2.9.0', date: 'Apr 2026', label: 'Onboarding: Company Admin, Device Pairing, POS First Boot',
    changes: [
      'Company Admin panel — create organisations, add locations, invite restaurant owners (back office → Company Admin).',
      'Device pairing — generate a pairing code in Devices section, enter it on any POS device to register it to your location.',
      'POS first-boot screen — new unregistered devices show a pairing screen instead of going straight to PIN login.',
      'Devices section rebuilt with real Supabase integration — pairing codes stored in database, status tracked.',
    ],
  },
  {
    version: '2.8.2', date: 'Apr 2026', label: 'Fix: back office now loads after login',
    changes: ['Fixed React hooks violation — useState was declared after conditional early returns, causing the back office to render a blank page after authentication. All hooks are now declared before any conditional returns.'],
  },
  {
    version: '2.8.1', date: 'Apr 2026', label: 'Fix: back office auth gate — login screen now works',
    changes: ['Fixed ReferenceError: authUser not defined — auth state was referenced in JSX but never declared. Login screen now shows correctly when accessing the back office without a session.'],
  },
  {
    version: '2.8.0', date: 'Apr 2026', label: 'Auth: Back office login with Supabase Auth',
    changes: [
      'Back office is now gated behind email + password login via Supabase Auth.',
      'Super admin account (peter@posup.co.uk) created and linked to Restaurant OS Internal org.',
      'Multi-tenant schema live: organisations, locations, user_profiles, subscriptions, location_features, devices tables created.',
      'Sign out button added to back office sidebar.',
      'GMV-based plan calculator function deployed to Supabase.',
    ],
  },
  {
    version: '2.7.9', date: 'Apr 2026', label: 'Fix: POS crash — activeCatIds was not defined',
    changes: ['Fixed ReferenceError: activeCatIds is not defined — this variable was referenced in POSSurface but never declared, crashing the POS ordering screen on every load.'],
  },
  {
    version: '2.7.8', date: 'Apr 2026', label: 'Fix: store init crash resolved',
    changes: ['Fixed store initialization crash — _savedBO is now computed inside a single IIFE, eliminating the broken two-variable pattern that caused a white screen on load.'],
  },
  {
    version: '2.7.7', date: 'Apr 2026', label: 'Fix: app crash — reverted broken vite.config define block',
    changes: ['Reverted vite.config.js define block that was overriding import.meta.env and crashing the app at startup.'],
  },
  {
    version: '2.7.6', date: 'Apr 2026', label: 'Fix: POS no longer breaks when Supabase has no categories yet',
    changes: [
      'Fixed: store no longer boots with empty categories when localStorage was overwritten by Supabase hydration. Falls back to seed data if saved data has no entries.',
      'Fixed: Supabase hydration now updates menus and categories independently — never wipes one because the other is empty.',
    ],
  },
  {
    version: '2.7.5', date: 'Apr 2026', label: 'Supabase: menus load from database on startup',
    changes: [
      'Back office now reads menus and categories from Supabase on startup — not from localStorage seed.',
      'Menus you create persist permanently across all page reloads and devices.',
    ],
  },
  {
    version: '2.7.4', date: 'Apr 2026', label: 'Fix: Supabase menu writes — column mapping corrected',
    changes: ['Fixed menu and category upserts to Supabase — only sends columns that exist in the database schema. Previously failing silently because of unknown column names.'],
  },
  {
    version: '2.7.3', date: 'Apr 2026', label: 'Fix: Supabase env vars explicitly baked into bundle',
    changes: ['Updated vite.config.js to explicitly define all Supabase env vars at build time, bypassing Vercel build cache issues.'],
  },
  {
    version: '2.7.2', date: 'Apr 2026', label: 'Supabase: live connection active',
    changes: ['Supabase integration fully live — menus, categories persist to database instantly.'],
  },
  {
    version: '2.7.1', date: 'Apr 2026', label: 'Fix: Supabase connection — force fresh build with env vars',
    changes: [
      'Triggered fresh Vercel build so VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_USE_MOCK env vars are baked into the bundle.',
      'Fixed menu_items query — removed invalid embedded join that caused 400 errors on startup.',
    ],
  },
  {
    version: '2.7.0', date: 'Apr 2026', label: 'Supabase integration: menus and categories persist to live database',
    changes: [
      'Menus and categories now save to Supabase on every change — create a menu, it is instantly in the database.',
      'Page reloads, new devices, and multiple terminals all see the same menus without needing Push to POS.',
      'Falls back to localStorage automatically if Supabase is unreachable.',
    ],
  },
  {
    version: '2.6.4', date: 'Apr 2026', label: 'Menus persist across page reloads without needing Push to POS',
    changes: [
      'Menus and categories are now saved to localStorage instantly on every change. Page reloads no longer reset to the seed menus — your custom menus survive.',
      'Device Profiles menu selector now shows the menus you have actually built, not the default seed menus.',
    ],
  },
  {
    version: '2.6.3', date: 'Apr 2026', label: 'Menus: inline add and delete menus',
    changes: [
      'Menu Manager → Menus tab: click + to add a new menu with an inline form (type name, press Enter or click Create). No browser prompt.',
      'Each menu now has a × delete button. The default menu (Main menu ★) cannot be deleted. Deleting a menu does not delete its categories or items.',
    ],
  },
  {
    version: '2.6.2', date: 'Apr 2026', label: 'Revert: Quick Screen back to single screen',
    changes: [
      'Removed multiple Quick Screens. Back to one simple 16-slot grid. Click an item to add it, drag to reorder, × to remove.',
      'Removed Quick Screen layout selector from Device Profiles.',
      'Category filter in the picker now includes subcategories.',
    ],
  },
  {
    version: '2.6.1', date: 'Apr 2026', label: 'Fix: POS white screen crash + duplicate menu selector in device profiles',
    changes: [
      'Fixed: POS went white screen after v2.6.0 — a runtime crash caused by accessing menus before the store was ready. deviceMenuId is now safe and defaults to null (show all categories) when no menu is assigned to the device profile.',
      'Fixed: Device profiles Edit modal showed the Menu selector twice. Duplicate removed.',
    ],
  },
  {
    version: '2.6.0', date: 'Apr 2026', label: 'Menu-per-device: assign a menu to each terminal',
    changes: [
      'Device profiles now have a Menu selector. Go to Device Profiles → Edit any profile → Menu — pick which menu that terminal shows. The Bar terminal defaults to showing only the Bar menu (drinks and bar snacks).',
      'Both the Bar surface and POS surface now filter their category pills and item grids by the menu assigned to the device. A Bar terminal with the Bar menu only sees bar categories and bar items.',
      'The Menus tab in Menu Manager is where you build and manage named menus (Main menu, Bar menu, Lunch menu etc). Categories are assigned to menus via menuId.',
      'Falls back to showing all menus if no specific menu is assigned to the device profile.',
    ],
  },
  {
    version: '2.7.1', date: 'Apr 2026', label: 'Fix: Supabase connection — force fresh build with env vars',
    changes: [
      'Triggered fresh Vercel build so VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_USE_MOCK env vars are baked into the bundle.',
      'Fixed menu_items query — removed invalid embedded join that caused 400 errors on startup.',
    ],
  },
  {
    version: '2.7.0', date: 'Apr 2026', label: 'Supabase integration: menus and categories persist to live database',
    changes: [
      'Menus and categories now save to Supabase on every change — create a menu, it is instantly in the database.',
      'Page reloads, new devices, and multiple terminals all see the same menus without needing Push to POS.',
      'Falls back to localStorage automatically if Supabase is unreachable.',
    ],
  },
  {
    version: '2.6.4', date: 'Apr 2026', label: 'Menus persist across page reloads without needing Push to POS',
    changes: [
      'Menus and categories are now saved to localStorage instantly on every change. Page reloads no longer reset to the seed menus — your custom menus survive.',
      'Device Profiles menu selector now shows the menus you have actually built, not the default seed menus.',
    ],
  },
  {
    version: '2.6.3', date: 'Apr 2026', label: 'Menus: inline add and delete menus',
    changes: [
      'Menu Manager → Menus tab: click + to add a new menu with an inline form (type name, press Enter or click Create). No browser prompt.',
      'Each menu now has a × delete button. The default menu (Main menu ★) cannot be deleted. Deleting a menu does not delete its categories or items.',
    ],
  },
  {
    version: '2.6.2', date: 'Apr 2026', label: 'Revert: Quick Screen back to single screen',
    changes: [
      'Removed multiple Quick Screens. Back to one simple 16-slot grid. Click an item to add it, drag to reorder, × to remove.',
      'Removed Quick Screen layout selector from Device Profiles.',
      'Category filter in the picker now includes subcategories.',
    ],
  },
  {
    version: '2.6.1', date: 'Apr 2026', label: 'Fix: POS white screen crash + duplicate menu selector in device profiles',
    changes: [
      'Fixed: POS went white screen after v2.6.0 — a runtime crash caused by accessing menus before the store was ready. deviceMenuId is now safe and defaults to null (show all categories) when no menu is assigned to the device profile.',
      'Fixed: Device profiles Edit modal showed the Menu selector twice. Duplicate removed.',
    ],
  },
  {
    version: '2.6.0', date: 'Apr 2026', label: 'Menus: build multiple menus, assign per device profile',
    changes: [
      'Menus tab now shows a menu selector on the left — Main menu, Bar menu, Lunch menu, and a + New menu button. Click a menu to see only its categories. Categories created in a menu belong to that menu.',
      'Device Profiles → Edit any profile → new Menu section: assign which menu that terminal shows (Main menu, Bar menu, etc). The Bar terminal can now show only Bar menu categories.',
      'POS reads the device profile menu assignment and filters category pills accordingly. If no menu is assigned the default menu (Main menu) is used.',
      'Menus are included in Push to POS snapshot so all terminals receive menu assignments automatically.',
    ],
  },
  {
    version: '2.5.3', date: 'Apr 2026', label: 'Device profiles: assign Quick Screen per terminal',
    changes: [
      'Device profiles now have a Quick Screen layout selector. Go to Back Office → Device Profiles → Edit any profile → Quick Screen layout — pick which screen that terminal shows on its ⚡ Quick tab.',
      'The Bar terminal profile can now show the Bar screen (drinks only) while the main counter shows the Main screen. Each device independently reads its assigned screen.',
      'POS reads quickScreenId from the active device config, falling back to the global activeQuickScreenId if no profile screen is assigned.',
    ],
  },
  {
    version: '2.5.2', date: 'Apr 2026', label: 'Fix: quickScreens + menuCategories included in Push to POS snapshot',
    changes: [
      'Quick Screen configurations (multiple screens, column counts, item lists) are now included in the Push to POS snapshot and applied on every page load. Previously they were missing from the snapshot entirely.',
      'menuCategories is now also included in the snapshot so category changes (icons, colours, names, structure) propagate correctly to POS on push.',
    ],
  },
  {
    version: '2.5.1', date: 'Apr 2026', label: 'Fix: Quick Screen category filter includes subcategories',
    changes: ['Quick Screen picker category filter now shows items in subcategories. Selecting Drinks shows items from Draught beer, Wine, Soft drinks subcategories — not just direct Drinks items.'],
  },
  {
    version: '2.5.0', date: 'Apr 2026', label: 'Quick Screen: multiple named screens, variable grid, click-to-add',
    changes: [
      'Multiple named Quick Screens: click + Screen to add screens (Main screen, Bar screen, Lunch, etc). Each screen has its own independent item list. Double-click a tab to rename it.',
      'Variable grid columns: choose 3, 4, 5 or 6 columns per screen from the settings bar. Grid expands automatically.',
      'Click to add: click any item in the right panel to instantly add it to the next empty slot. No drag required. Drag still works for precise placement or reordering.',
      'Already-on-screen indicator: items that are already on the current screen show a green ✓ in the picker panel and cannot be added twice.',
      'Screen isolation: each screen saves its own item list. The main screen stays in sync with the POS Quick tab.',
    ],
  },
  {
    version: '2.4.2', date: 'Apr 2026', label: 'Fix: config snapshot always applied on page load',
    changes: [
      'Critical sync fix: when any page reloaded (POS, KDS, etc.), the Zustand store reset to seed data. SyncBridge was checking sessionStorage version — if it matched the snapshot version, it assumed the config was already applied and showed no banner. But the store had already reset to seed. Result: POS running on stale seed data with no way to know.',
      'Fix: always apply the config snapshot on every mount. The store always starts from seed on reload, so the snapshot must always be re-applied. This means soldAlone items, price changes, menu edits, category changes — all persist correctly across page reloads without needing to click Sync now.',
    ],
  },
  {
    version: '2.4.1', date: 'Apr 2026', label: 'Fix: soldAlone sub-items now appear correctly on POS and in Menus tab',
    changes: [
      'Root cause fixed: 4 separate filter bugs were blocking soldAlone sub-items from appearing on the POS. catItems excluded all sub-items regardless of soldAlone flag. Search results did the same. Tapping a sub-item on POS returned early before processing. Category pill counts did not include them.',
      'Menus tab grid now shows soldAlone sub-items in their assigned category — the gridItems filter was blocking all type=subitem items even when soldAlone was true.',
      'Add Items panel in Menus tab now shows soldAlone sub-items in the available-to-add list so they can be assigned to categories from there.',
      'Full end-to-end flow: Items tab → toggle sold alone on Chips → pick Starters → Push to POS → Chips appears in Starters on POS and is fully tappable and orderable.',
    ],
  },
  {
    version: '2.4.0', date: 'Apr 2026', label: 'Sold alone toggle on items, not modifier groups',
    changes: [
      'Sold alone moved to the correct place — it is now a sliding toggle on each sub-item row in the Items tab, not on modifier group options (which was wrong).',
      'How it works: go to Items tab → find any Sub item (Chips, Side salad, etc.) → a sliding toggle appears below the row labelled Also sell standalone. Flip it green → a Category dropdown appears inline → pick any category → that item now appears there on the POS exactly like a normal item.',
      'Removed: Extras category from POS — sold-alone items now appear in whichever real category you assign them to, not in a special Extras screen.',
      'Removed: soldAlone checkbox from Modifier groups tab (wrong location). The toggle lives on the product itself in the Items tab.',
      'Backend: POS now includes subitem-type items in the menu when soldAlone is true and a cat is set. The updateMenuItem store action handles soldAlone and cat fields directly.',
    ],
  },
  {
    version: '2.3.1', date: 'Apr 2026', label: 'Sold alone: backend wired correctly',
    changes: [
      'Fixed: menuCategories was missing from ModifiersTab store subscription — the category dropdown in the sold-alone checkbox was calling useStore.getState() (a static one-time snapshot) instead of the reactive hook. Now uses the live menuCategories value so the dropdown always shows current categories.',
      'Added: updateModifierGroupOption store action — a direct targeted action that patches a single option within a modifier group without rebuilding the entire options array. updOpt now calls this instead of re-mapping the full options array through updateModifierGroupDef.',
      'The soldAlone and soldAloneCat fields now persist correctly when toggled in the Modifier groups tab. Changes reflect immediately on POS (Extras screen and category items).',
    ],
  },
  {
    version: '2.3.0', date: 'Apr 2026', label: 'Sold alone: modifier options orderable as standalone POS items',
    changes: [
      'NEW: Can be sold alone — in the Modifier groups tab, each option now has a Can be sold alone checkbox. When ticked, you choose which category it appears in on the POS menu. That option then shows as a regular tappable item in that category.',
      'Example: Chips and Side salad in the Side choice group can now be ticked as sold alone → Starters. They appear directly on the Starters POS screen and can be ordered without being attached to another item.',
      'NEW: Extras category — when any soldAlone options exist, a purple ⊕ Extras category pill appears on the POS. It shows ALL soldAlone options from all modifier groups in one dedicated quick-access screen.',
      'Demo: Chips, Side salad, Sweet potato fries from the Side choice group are sold alone in Starters. They appear both in the Starters category and the Extras screen.',
    ],
  },
  {
    version: '2.2.0', date: 'Apr 2026', label: 'Menus tab: search and add existing items to categories',
    changes: [
      'Menus tab redesigned: the + Item button is replaced with + Add items. Clicking it opens a search panel that lets you find any item from the Items library and add it to the selected category.',
      'Add items panel shows: items already in this category (with Remove button), then all available items below (with + Add button). Search filters both sections live as you type.',
      'Removing an item from a category moves it to its next assigned category or clears the primary category — the item stays in the Items library, just removed from this menu category.',
      'Items tab is the right place to create new items. Menus tab is for building the menu by assigning existing items to categories.',
    ],
  },
  {
    version: '2.1.0', date: 'Apr 2026', label: 'Items tab — full item library with variants always visible',
    changes: [
      'NEW: 📋 Items tab — a flat list of every item in the system including all variant sub-items. Shows parent items with variant children always visible and indented below (Lager → └ Pint, └ Half pint). This is the central item library.',
      'Items tab features: search by name/description, filter by type (Simple / Options / Has sizes / Pizza), filter by category, + Item button creates a new item. Click any row to open the full item editor on the right (Flow / Sizes / Modifiers / Pricing / Allergens tabs).',
      '+ Add size button at the bottom of each variant group — add a new variant directly from the Items list.',
      'Menu renamed to Menus — all existing menu editing functionality unchanged.',
      'Nav order: Menus | Quick Screen | Items | Modifier groups | Instruction groups.',
    ],
  },
  {
    version: '2.0.2', date: 'Apr 2026', label: 'Category ↕ Move modal, list sub-items fix',
    changes: [
      'Category nesting redesigned: drag-to-nest removed (unreliable HTML5 drag events). Every category now has a ↕ button that opens a clean Move modal — choose Root level or any other category to nest under. Works reliably every time.',
      'Category un-nesting: click ↕ on any subcategory → select Root level → Move here. Done.',
      'Category reorder via drag still works within the same level (root-to-root or sub-to-sub).',
      'List view sub-items fix: switched from expandedIds (needed initialising per category switch) to collapsedIds (empty by default = all expanded). Variant children now always show immediately when you navigate to any category.',
    ],
  },
  {
    version: '2.0.1', date: 'Apr 2026', label: 'Fix: list view variants always visible, category drag reliable',
    changes: [
      'List view variants fix: sub-items (sizes) now always show expanded by default regardless of which category you navigate to. Root cause: expandedIds state was initialised once from the first category and never updated when you switched categories. Fixed by inverting the logic to track collapsedIds (empty by default = everything open). Click ▾ to collapse a variant group, click ▸ to expand.',
      'Category drag fix: removed DragLeave event listeners that were clearing the drop target on every mouse movement between child elements, making drops unreliable. Drop zones now stay highlighted until drag ends.',
      'Category nesting via drag: when dragging a category over another category, shows nest → badge to make clear it will become a subcategory. Same-level drag still reorders.',
      'Category un-nesting: the top drop zone is now larger (8px padding vs 3px) with clearer label. The Edit category modal parent selector also works as a reliable backup for nesting/unnesting.',
      'Root drop fix: un-nest to root now correctly sets parentId to null before looking up the target (previously a guard check was in wrong order).',
    ],
  },
  {
    version: '2.0.0', date: 'Apr 2026', label: 'Canvas removed · List view with inline variant editing',
    changes: [
      'Canvas feature removed completely — it was unreliable and did not correctly reflect changes on the POS. The Grid/Canvas toggle is now Grid/List.',
      'NEW: List view (☰ List button in category toolbar). Shows every item as a table row: drag handle · name · type badge · price · modifier count · allergen count. Drag rows to reorder — reorder reflects immediately on POS.',
      'Variants visible in List view: items with sizes show a ▾ expand arrow. Click to reveal all variant children indented below the parent, always visible by default. Each variant row shows its name (editable inline) and price (editable inline) without needing to click into an editor.',
      '+ Add size button appears at the bottom of each expanded variant group — adds a new size directly from the list without navigating anywhere.',
      'Clicking any row (parent or variant child) still opens the full item editor panel on the right for detailed editing.',
    ],
  },
  {
    version: '1.9.2', date: 'Apr 2026', label: 'Fix: canvas sortOrder scoped per category; nested modifiers reactive',
    changes: [
      'Canvas sortOrder fix: dragging items in Canvas view now only recalculates sortOrder for items in the SAME category. Previously, dragging a Starter would affect the sortOrder numbering of Mains, Drinks etc because all items were sorted globally — now scoped to the active category.',
      'InlineItemFlow now uses reactive Zustand subscription for modifierGroupDefs/instructionGroupDefs instead of a one-time getState() snapshot. This ensures nested sub-group definitions are always up-to-date when building modifier flows for variant items.',
      'Nested modifiers on variant items: after picking a size, modifier options with subGroupId correctly trigger their linked sub-group inline below. The subGroupId is preserved through the option spread when stored in selections state.',
    ],
  },
  {
    version: '1.9.1', date: 'Apr 2026', label: 'Fix: modifiers on variant items now show after picking a size',
    changes: [
      'Critical fix: when an item has sizes (variants), modifier groups assigned to the parent item now correctly appear after the customer picks a size. Root cause: after picking a variant (e.g. Pint), the flow was looking for modifier groups on the child item (Pint) instead of the parent (Stout). Child items never have their own modifier groups — they inherit from the parent. Fixed in InlineItemFlow to check parent modifiers when child has none.',
      'The hasMods check now also looks at the parent item — so if a variant item has parent modifiers, the flow correctly transitions to the modifiers step instead of immediately adding to the order.',
    ],
  },
  {
    version: '1.9.0', date: 'Apr 2026', label: 'Fix: variant order + canvas order now reflect on POS',
    changes: [
      'Variant order on POS fixed: dragging sizes to reorder in the Sizes tab or Flow tab now correctly reflects on the POS. Root cause was variantChildren were read from the store without sorting by sortOrder — fixed in both POSSurface and InlineItemFlow.',
      'Canvas drag now updates sortOrder: previously dragging items on the canvas only saved canvasPos (the visual position) but never updated sortOrder. Now when you release a drag, all items in the canvas are re-ranked by their Y position (top to bottom), and that order is what the POS uses.',
      'Canvas auto-layout also correctly updates sortOrder when items are rearranged.',
    ],
  },
  {
    version: '1.8.0', date: 'Apr 2026', label: 'Flow tab — complete customer journey in item editor',
    changes: [
      'New Flow tab is now the DEFAULT view when clicking any item — shows the complete customer ordering journey in numbered steps: ① Choose size (Pint / Half pint / Third, editable inline with prices), ② Side choice REQUIRED (Chips · Side salad…), ③ Sauce Optional, ④ Cooking preference no charge. This is the exact sequence the customer goes through on POS.',
      'Sizes are now editable directly in the Flow tab — name and price for each variant, inline. No need to switch to Sizes tab just to update a price.',
      'Modifier groups in Flow tab show all options as chips and display nested modifier indicators (↳ If "Peppercorn": also shows Sauce preference).',
      'Drag handles on modifier groups in Flow tab — drag to reorder the customer journey without switching tabs.',
      'Instruction groups shown in green numbered steps at the end of the flow.',
      'Search-to-add modifier groups available at the bottom of the Flow tab.',
      'Visual Builder (swimlane) removed — it did not match the POS and was confusing. Clean nav: Menu | Quick Screen | Modifier groups | Instruction groups.',
    ],
  },
  {
    version: '1.7.0', date: 'Apr 2026', label: 'Visual Menu Builder — swim-lane drag-and-drop + flow visualizer',
    changes: [
      'NEW: ✦ Visual Builder tab in Menu Manager — a full swim-lane canvas showing your entire menu at once. One column per category, drag items between categories to reassign, drag columns to reorder categories.',
      'Per-item flow visualization: click ▼ flow on any item card to see the complete POS ordering journey — ① Sizes ② Side choice ★ required ③ Sauce (with nested modifiers shown) ④ Cooking preference. Exactly what the customer sees, step by step.',
      'Channel assignment on each menu: toggle POS / Kiosk / Online / Delivery active state per menu directly in the builder header.',
      'Local/Shared/Global pricing scope restored in item editor — sets whether pricing is unique to this item, inherited from a shared rule, or identical across all channels.',
      'Item quick-edit panel slides in from right when clicking any item card — full Details/Pricing/Modifiers/Sizes/Allergens without leaving the visual builder.',
      'Modifier assignment in the quick-edit panel uses the same search-first pattern — all changes visible immediately on the swim-lane.',
    ],
  },
  {
    version: '1.6.0', date: 'Apr 2026', label: 'Modifier/instruction groups drag-reorder, subGroupId, canvas as view mode',
    changes: [
      'Modifier groups tab: drag handles on both groups (left list) and options (right editor). Drag groups to reorder the order they appear in search/assignment. Drag options within a group to set the order the customer sees them on POS.',
      'Nested modifiers in editor: each option now has a nested group selector (↳ Nested group dropdown). Pick any other modifier group to make it appear when that option is selected. This is the core of the conditional modifier flow.',
      'Instruction groups tab: same drag-to-reorder for both groups and individual options within each group.',
      'Canvas removed as top-level tab — now accessed per-category via the Grid/Canvas toggle button in the category toolbar. The canvas view automatically shows only items in the selected category.',
      'Reorder store actions added: reorderModifierGroupDefs and reorderInstructionGroupDefs for persistent ordering without sortOrder fields.',
    ],
  },
  {
    version: '1.5.0', date: 'Apr 2026', label: 'Full pizza builder + pizza items fixed',
    changes: [
      'Pizza items (Margherita, Pepperoni, BBQ chicken) now correctly set as type:pizza — previously they were type:modifiable so the pizza builder never appeared.',
      'Per-item pizza configuration: each pizza can now have its own sizes (with custom names and prices), available bases, available crusts, and default toppings — all independent from the global defaults.',
      'Pizza builder in Menu Manager shows: sizes list with drag-edit + add-size form; bases toggle (which are available for this pizza); crusts toggle; default toppings grid with colour-coded indicators; order flow preview showing exactly what the customer will see.',
      'PizzaModal now reads per-item config (pizzaSizes/pizzaBases/pizzaCrusts) and falls back to globals. BBQ chicken correctly defaults to BBQ base only.',
      'POS routing: pizza items use the full PizzaModal overlay (size + base + crust + half/half + toppings), other items use the new inline flow.',
      'BBQ base added to PIZZA_BASES global list.',
    ],
  },
  {
    version: '1.4.0', date: 'Apr 2026', label: 'Menu Manager rebuilt — search modifiers, proper sizes, pizza, grid canvas',
    changes: [
      'Item editor rebuilt from scratch: wider panel (420px), underline tab navigation that actually works, no more cramped horizontal buttons.',
      'Modifiers tab: search-first assignment. Type to filter hundreds of modifier groups, click to assign. Assigned groups shown as a draggable ordered list with Required/Optional toggle and Max selector — drag to reorder the flow the customer sees on POS.',
      'Sizes tab (renamed from Variants): clean list with drag reorder, inline name and price editing, POS preview showing exactly how sizes will appear.',
      'Pizza tab: per-item default toppings selector. All 14 toppings shown with colour coding. Global pizza settings (sizes/bases/crusts) still configured in Modifier groups.',
      'Canvas: grid snapping — items snap to 20px grid positions instead of arbitrary pixels. Auto-layout uses a clean column grid. Cleaner, more organised layout.',
      'Allergens: 2-column grid layout instead of single column — faster to scan and toggle.',
    ],
  },
  {
    version: '1.3.0', date: 'Apr 2026', label: 'Major UX redesign — inline flows, canvas layout, nested modifiers',
    changes: [
      'POS: Variant and modifier selection now happens inline in the center panel (not a modal overlay). Tap a variant item → large size buttons appear in the menu area. Pick a size → modifier groups flow below sequentially. Back button returns to variant step. Full allergen display throughout.',
      'Menu Manager: Variant children no longer appear as separate product cards. Tap the parent to expand inline variant buttons grouped below it. Add new variants directly from the parent card.',
      'Menu Manager: New 🗂 Canvas tab — free-form drag-anywhere layout. Move items to any position. Mouse-wheel zoom (30–200%), alt+drag or middle-click to pan. Auto-layout resets to clean grid. Item positions saved to canvasPos field.',
      'Nested modifiers: Modifier options can now link to sub-groups via subGroupId. Example: selecting Peppercorn sauce reveals a nested "Sauce preference" group (Served hot / On the side) inline below.',
      'Store: mgd-sauce-temp sub-group added as demonstration of nested modifier pattern.',
    ],
  },
  {
    version: '1.2.0', date: 'Apr 2026', label: 'Full audit pass: imports cleaned, Kiosk variants fixed',
    changes: [
      'OtherSurfaces: removed unused CATEGORIES import from seed (was replaced by live store menuCategories).',
      'Kiosk: item.variants.map() crash fixed — same root cause as the Bar fix. Now uses MENU_ITEMS.filter(i => i.parentId === item.id) to find variant children from the store.',
      'Kiosk: fromPrice now reads pricing.base correctly for variant parents.',
      'POSSurface CAT_META/CATEGORIES/QUICK_IDS remain as valid legacy fallbacks.',
    ],
  },
  {
    version: '1.1.9', date: 'Apr 2026', label: 'Modifier modal stays open bug fixed',
    changes: [
      'CRITICAL: Modifier modal selections (Side choice, Sauce etc.) were being reset to empty whenever any Zustand state update triggered a POSSurface re-render. Root cause: MENU_ITEMS was recreated via .map() on every render, giving items new object references. ProductModal saw a different prop object and remounted, losing useState selections.',
      'Fix 1: MENU_ITEMS wrapped in useMemo([rawItems, orderType]) so item references stay stable across renders.',
      'Fix 2: ProductModal given key={modalItem.id} so it only remounts when a genuinely different item is opened, never on parent re-renders with the same item open.',
      'Result: Clicking Chips then Peppercorn sauce then Add to order now works correctly — item is added with all modifiers and modal closes.',
    ],
  },
  {
    version: '1.1.8', date: 'Apr 2026', label: 'Send-to-table auto-fires kitchen, variant names, mod display',
    changes: [
      'Seat at table / Add to occupied table now automatically sends to kitchen. Previously items landed on the table but the operator had to reopen the check and click Send again. Now the send modal → choose table flow completes in one step.',
      'Variant name now shows in order panel: "Stout — Pint" instead of just "Stout". The displayName is built as "ItemName — VariantLabel" so the selected size/serving is always visible on the order line.',
      'Modifiers no longer appear on the item name line. Previously mods were concatenated into the name ("Ribeye — Chips, Peppercorn") AND also shown as separate rows below — double display. Now the name shows only the variant label, and modifiers show exclusively on their own rows underneath.',
      'Instruction group selections (e.g. cooking preference) are still included in the name when relevant, since they have no separate display row in the order panel.',
    ],
  },
  {
    version: '1.1.7', date: 'Apr 2026', label: 'Bar variants fixed, parent-only items in menu',
    changes: [
      'Bar menu: variant child items (Stout Pint, Half pint etc.) were appearing alongside the parent Stout item. Fixed ITEMS filter to exclude items with a parentId.',
      'Bar variants: clicking a variant item (Stout, Lager) crashed because QuickItemBuilder called item.variants.map() — no such array exists. Variants are stored as child items in the store. Fixed to look up children via menuItems.filter(i => i.parentId === item.id).',
      'Bar modifiers: QuickItemBuilder now resolves modifier groups from modifierGroupDefs store state instead of the defunct item.modifierGroups format.',
      'Bar fromPrice: item card price calculation now uses variant children from ITEMS instead of item.variants array.',
    ],
  },
  {
    version: '1.1.6', date: 'Apr 2026', label: 'Bar crash fix: toFixed on undefined total',
    changes: [
      'Bar crash fixed: tab.total, activeTab.total, round.subtotal and item prices guarded with ||0 fallback before .toFixed() calls — old localStorage state from previous sessions had tabs without a total field.',
      'openedAt and all action timestamps (closedAt, timestamp, createdAt) changed from new Date() to Date.now() throughout the store for consistent numeric timestamp storage.',
      'Bar fromPrice guard: item.variants checked for existence before Math.min spread.',
    ],
  },
  {
    version: '1.1.5', date: 'Apr 2026', label: 'Bar items fix, seed refs cleaned up across surfaces',
    changes: [
      'Bar surface: category default was cocktails (nonexistent) — changed to all so items always show on load.',
      'Bar surface: CAT_META and QUICK_IDS replaced with live store data (menuCategories, quickScreenIds) so category colours, icons and quick screen reflect Menu Manager edits.',
      'Bar surface: unused CATEGORIES and QUICK_IDS seed imports removed.',
      'OtherSurfaces (Status): CATEGORIES replaced with store menuCategories so category filter reflects live menu.',
      'Inventory: CATEGORIES replaced with store menuCategories, category labels now live.',
      'All surfaces now read category data from store rather than static seed constants.',
    ],
  },
  {
    version: '1.1.4', date: 'Apr 2026', label: 'KDS crash fixed, NaN time fixed, variant labels',
    changes: [
      'CRITICAL: KDS crashed entire app on click — getLiveMinutes was a const arrow function but was referenced before its declaration in the minified bundle. Changed to a hoisted function declaration.',
      'KDS tick timer (setInterval/useEffect) was missing — timers now update every 30 seconds.',
      'Floor plan "Order sent: NaNh NaNm ago" fixed — sentAt was stored as Date object which serialised to string, then Date.now()-string = NaN. All sentAt values now stored as numeric timestamps.',
      'Variant picker label changed from "Choose option" to "Choose size/serving" — default variantLabel changed from Option to Size.',
      'Lager/Stout get variantLabel: Size, House white/red get variantLabel: Serving in seed data.',
      'Demo table sentAt timestamps fixed to plain numbers (no Date objects).',
    ],
  },
  {
    version: '1.1.3', date: 'Apr 2026', label: 'POS white screen fixed — missing computed values restored',
    changes: [
      'CRITICAL FIX: subCategories, catItems and displayItems useMemos were accidentally deleted from POSSurface during a Python string replacement. POS rendered with undefined references causing a white screen.',
      'All three computed values restored: subCategories (pills strip), catItems (items in selected category), displayItems (search results or category items).',
    ],
  },
  {
    version: '1.1.2', date: 'Apr 2026', label: 'Login screen fixed — staff cards clickable, demo bypass',
    changes: [
      'Staff without a PIN set can now tap their card to log straight in (no PIN required).',
      'Staff with a PIN set show a 🔐 indicator and open the numpad when tapped.',
      'If no staff are configured (Back Office not set up yet), a "Enter as Demo" bypass button appears.',
      'Back button on PIN entry returns to staff selection.',
      'Staff card colour from store used for selection highlight.',
    ],
  },
  {
    version: '1.1.1', date: 'Apr 2026', label: 'Black screen fix: QUICK_IDS missing import',
    changes: [
      'CRITICAL FIX: store referenced QUICK_IDS but it was never imported from seed — ReferenceError crashed the entire app at module load before React could mount (black screen).',
      'PINScreen now reads from store.staffMembers — staff added in Staff Manager appear on the login screen.',
      'Kiosk surface now reads categories and items from store, respects quickScreenIds, filters by visibility.kiosk, sorts by sortOrder.',
    ],
  },
  {
    version: '1.1.0', date: 'Apr 2026', label: 'Quick Screen manager, Staff manager, EOD Z-read',
    changes: [
      'Quick Screen manager (⚡ tab in Menu Manager): 4×4 drag-and-drop grid — drag items from the picker panel onto slots. Reorder by dragging within the grid. Remove with ✕. Auto-fill and Clear all buttons. Changes reflect on POS ⚡ tab instantly.',
      'Staff Manager rebuilt: list + editor layout. Add staff with role, colour, 4-digit PIN (numpad). Set per-staff permissions (void, discount, refund, cash up, reports, EOD, manage staff). Reset to role defaults button. All data persists to store.',
      'EOD Z-read rebuilt: cash declaration with denomination counts (+/- buttons per note/coin type), opening float, variance calculation (over/short), banking amount. Z-Read summary with full revenue breakdown, cash reconciliation, and net totals.',
      'Store: quickScreenIds state + setQuickScreenIds action. staffMembers state with add/update/remove. Reads from seed data as initial state.',
    ],
  },
  {
    version: '1.0.9', date: 'Apr 2026', label: 'Variants: modifiers work after variant pick, better labels, POS preview',
    changes: [
      'Variants tab in item editor now shows modifier groups — assign once to the parent and they appear after every variant is picked (Step 1: size → Step 2: options).',
      'Instruction groups also assignable from Variants tab.',
      'variantLabel is now prominent — preset buttons (Size, Type, Cut, Style, Strength, Format, Serving, Portion, Blend, Roast) plus free-text custom label.',
      'POS variant picker: item name shown prominently, "Choose size/type/cut" heading uses the real label. Step indicator only appears when modifiers follow.',
      'Step 2 (modifier step) shows selected variant with a green tick badge for clarity.',
      'POS preview in Variants tab shows how the picker will look, and confirms which modifier groups follow.',
    ],
  },
  {
    version: '1.0.8', date: 'Apr 2026', label: 'Modifier options no longer show undefined',
    changes: [
      'Modifier options store name as opt.name (new format) but POS ordering modal was reading opt.label — all option labels showed as undefined.',
      'Fix: opt.label||opt.name throughout ProductModal — display, buildDisplayName, handleAdd all updated.',
      'Options now also have label aliased from name at build-groups time so both old and new format options work.',
      'selectionType now reads stored value first (single/multiple), falling back to max-based detection.',
    ],
  },
  {
    version: '1.0.7', date: 'Apr 2026', label: 'Menu Manager — complete rethink matching Toast/Square model',
    changes: [
      'Items panel is now a GRID matching the POS — same card style, same colour bars, same proportions. Drag cards to reorder, order reflects on POS instantly.',
      'Variants managed inside the item editor (Variants tab) — type a name and price, click Add variant. No more dragging items onto each other. Works like Square/Toast.',
      'Sub items removed from the main menu flow. Modifier group options are now plain name+price pairs typed directly in the Modifier groups tab — no separate sub-item records needed.',
      'Category drag: same-level drag reorders, cross-level drag nests as subcategory. Drop indicator line shows insert position.',
      'Search across all items from the item grid toolbar — find anything without leaving the current category view.',
      'Item editor: Details / Variants / Modifiers / Pricing / Allergens all in one slide-in panel.',
      'Modifier group option editor: add options with name+price inline — no sub-item picker step required.',
    ],
  },
  {
    version: '1.0.6', date: 'Apr 2026', label: 'POS now reflects Menu Manager changes instantly',
    changes: [
      'POS item grid now sorts by sortOrder on every render — drag-to-reorder in Menu Manager is reflected immediately on the POS without a page reload.',
      'catItems useMemo adds .sort((a,b) => (a.sortOrder??999)-(b.sortOrder??999)) so new order is picked up as soon as store updates.',
      'Both POS and Menu Manager share the same Zustand store — changes are reactive with no manual "Push to POS" required for menu edits.',
    ],
  },
  {
    version: '1.0.5', date: 'Apr 2026', label: 'Menu Manager drag-and-drop actually works',
    changes: [
      'Category drag: same-level drag now REORDERS (updates sortOrder) — not just nests. Dragging onto a different-level category nests it. Blue indicator line shows insert position.',
      'Seed items now get sequential sortOrder (0,1,2…) at store init — previously all had undefined, so reordering never changed display order.',
      'Item drag indicator: blue line appears between items showing exactly where the item will land.',
      'POS catItems sort uses sortOrder correctly — changes made in Menu Manager reflect immediately on POS item grid.',
    ],
  },
  {
    version: '1.0.4', date: 'Apr 2026', label: 'Menu Manager complete redesign — 3-panel contextual layout',
    changes: [
      'Menu Manager rebuilt from scratch. Was: 5 disconnected tabs (Categories, Items, Modifiers, Instructions, Builder). Now: 3 tabs — Menu, Modifier groups, Instruction groups.',
      'Menu tab: 3-panel layout — Category tree (left) | Items in selected category (centre) | Item editor (right). Click a category → see its items. Click an item → edit everything in one place.',
      'Item editor has 4 sub-sections: Details (names, type, category, visibility), Pricing (per-channel prices), Modifiers (assign modifier+instruction groups with required/max controls), Allergens.',
      'No more separate Builder tab — modifier and instruction group assignment is in the item editor.',
      'Category tree: drag ⣿ to reorder, drag onto another to nest as subcategory, drop on root zone to un-nest. Click Edit cat to change icon/colour/name. Inline add category form.',
      'Items panel: items in the selected category only. Drag ⣿ to reorder (updates sortOrder, reflects on POS). Shows allergen count, modifier group count inline.',
      'Modifier groups and Instruction groups are now library tabs — create/edit groups there, assign from inside item editor.',
    ],
  },
  {
    version: '1.0.3', date: 'Apr 2026', label: 'Items tab filters + richer item info',
    changes: [
      'Items tab: 5 filter pills — All, Items only, Sub items, Variants, With modifiers. Category filter dropdown. Clear all button. Live item count.',
      'Search now searches description as well as name.',
      'Each item row now shows: category icon+name, allergen count (⚠ N), modifier group count (⊕ N mods), instruction group count (📝 N).',
      'Items in multiple categories show "+N" next to the primary category label.',
    ],
  },
  {
    version: '1.0.2', date: 'Apr 2026', label: 'Drag-and-drop fixed across Menu Manager',
    changes: [
      'Item reorder: drop target moved to full row (was only the 12px handle icon — undroppable). Dragging ⣿ handle now correctly reorders items, re-indexing sortOrder sequentially.',
      'onDragEnd added to all draggable elements in Categories and Items tabs — prevents stuck drag state when drag is cancelled or dropped on invalid target.',
      'Category drag-to-subcategory: onDragEnd added so dragId resets properly after every drag operation.',
      'Variant drag (drag item onto item): still works via row body drag. Handle drag and row drag now cleanly separated.',
    ],
  },
  {
    version: '1.0.1', date: 'Apr 2026', label: 'Modifier UX, multi-category, drag reorder, bug fixes',
    changes: [
      'Modifier groups: single-choice shows radio UI, multi-choice shows +/- qty buttons — allows adding multiple of the same option (e.g. 2× Truffle oil). Unlimited option sets no cap.',
      'selectionType field (single/multiple) wired to store and respected in POS ordering modal.',
      'Items can now belong to multiple categories — primary category dropdown + additional category toggles in Item Editor. Items appear in all assigned categories on POS.',
      'Menu Manager Items tab: ⣿ drag handle reorders items (updates sortOrder, reflects on POS). Body drag still creates variants.',
      'Checkout modal groups items by course (Course 1 / Course 2 headers) when order spans multiple courses.',
      'Split check (T1.2) now sends to kitchen immediately on creation — no longer left as pending.',
      'Split check floor plan icon clears correctly when all checks for a table are settled.',
      'Duplicate subcategory pill strip removed from POS (was rendering twice).',
      'Modifier group title fallback: group.label || group.name — titles no longer blank.',
    ],
  },
  {
    version: '1.0.0', date: 'Apr 2026', label: 'v1.0 — send flow fixed, checkout by course, split check fixes',
    changes: [
      'Split check now sends to kitchen immediately after creation.',
      'Checkout modal now groups items by course.',
      'Split check icon on floor plan clears properly after settling both checks.',
      'Duplicate subcategory nav strip removed.',
      'Modifier group titles fixed — no longer blank.',
    ],
  },
  {
    version: '0.9.9', date: 'Apr 2026', label: 'POS blank screen root cause fixed',
    changes: [
      'useEffect was missing from React import in POSSurface — caused ReferenceError on every render, blank screen.',
      'One line fix: added useEffect to import { useState, useMemo, useRef, useEffect }.',
    ],
  },
  {
    version: '0.9.8', date: 'Apr 2026', label: 'Anchor demo data, Reports, variant pricing fix',
    changes: [
      'Demo floor plan tables updated to use real Anchor menu items (Ribeye, Salmon, House white).',
      'Demo bar tabs updated to use real Anchor items (Lager pints, Stout, House wine).',
      'Variant parent cards now show correct "from £X.XX" using child item lookup — no longer crashes on item.variants.map.',
      'Reports rebuilt: Overview (KPIs + payment split + order type + top 5), Product mix table with share bars, By server table, Hourly bar chart with peak hour callout.',
    ],
  },
  {
    version: '0.9.7', date: 'Apr 2026', label: 'POS fixed after blank screen regression',
    changes: [
      'Removed stale inline OrdersHub render from POS right panel — was causing crash before anything could render.',
      'Subcategory pills consolidated to single clean render.',
      'Dynamic category nav from store confirmed working.',
    ],
  },
  {
    version: '0.9.6', date: 'Apr 2026', label: 'Menu Manager ↔ POS bridge + The Anchor menu',
    changes: [
      'POS category nav now reads from store (Menu Manager) — not static seed data. Categories you create appear on POS immediately.',
      'Subcategories on POS: tapping Mains reveals Grills / Fish / Vegetarian sub-tabs. Tapping Drinks reveals Draught / Wine / Soft drinks. Pill strip appears above item grid.',
      'Variants wired end-to-end: dragging an item under another in Items tab auto-sets parent type to "variants". POS detects variant parents via child lookup, not just type field. Lager → Pint/Half pint picker works.',
      'Modifier groups: options must be sub items only. Three-panel editor: groups list, group editor, sub item picker (search + one-click add). Options show sub item name and price.',
      'Force/Unforce controls: Optional/Required toggle buttons. Max = 1 (pick one) / Unlimited / Custom number.',
      'Parent type auto-reverts to "simple" when last variant child is unlinked.',
      'The Anchor seed menu: 29 orderable items across 6 categories, 5 subcategories, 4 variant parents (Lager, Stout, House White, House Red), 10 modifiable items (steaks, chicken, pizza, coffee), 15 sub items, 4 modifier groups, 4 instruction groups.',
    ],
  },
  {
    version: '0.9.5', date: 'Apr 2026', label: 'Unified Orders screen',
    changes: [
      'Orders tab restored to sidebar: Bar → Floor → POS → Orders → KDS.',
      'Three clear sections: Tables, Bar tabs, Walk-in/Queue — each collapsible.',
      'Filter tabs by type + 👤 My orders + search + show completed.',
    ],
  },
  {
    version: '0.9.4', date: 'Apr 2026', label: 'Send flow fixes & split check restored',
    changes: [
      'Send always clears the order — removed async setTimeout, now uses direct store calls so customer/orderType are set before sendToKitchen reads them.',
      'Occupied table: both "Add to existing check" and "New separate check (T1.2)" options restored.',
      'Split check creates a child table (T1.2) with its own independent session and bill.',
      'Full CHANGELOG updated from v0.7.0.',
    ],
  },
  {
    version: '0.9.3', date: 'Apr 2026', label: 'Modifier & instruction groups end-to-end',
    changes: [
      'Modifier groups and instruction groups from the Product Builder are now fully wired into the POS ordering modal.',
      'Instruction groups (cooking temp, bread, spice level etc.) show with green radio UI, no price shown — printed on kitchen ticket.',
      'Modifier groups (paid options: sauce, extras) show with radio/checkbox UI enforcing min/max.',
      'POS openFlow now triggers modal for items with assignedModifierGroups or assignedInstructionGroups.',
      'All send paths (table, counter, takeaway, collection, delivery, bar) close checkout on send.',
    ],
  },
  {
    version: '0.9.2', date: 'Apr 2026', label: 'Nav restructure & Orders Hub in shift bar',
    changes: [
      'Orders Hub removed from sidebar nav — now lives as 📋 Orders button in the top shift bar, always visible with live active order count badge.',
      'Bar moved above Floor in sidebar nav: Bar → Floor → POS → KDS.',
      'Checkout modal closes on send in all paths.',
    ],
  },
  {
    version: '0.9.1', date: 'Apr 2026', label: 'Menu Manager complete rebuild',
    changes: [
      'Five focused screens: Categories, Items, Modifier groups, Instruction groups, Product builder.',
      'Categories: drag one category onto another to nest it as a subcategory. Items in subcategory also count in the parent.',
      'Items: all items and sub items in one list. Drag an item onto another to link it as a variant child. The parent becomes a picker button on POS.',
      'Modifier groups: define reusable paid option groups (options that change price). Set min/max per group.',
      'Instruction groups: preparation instructions with no price change (cooking temp, bread preference, spice level etc.).',
      'Product builder: assign modifier groups and instruction groups to any item. Set per-item min/max overrides.',
      'Store: modifierGroupDefs and instructionGroupDefs state added.',
    ],
  },
  {
    version: '0.9.0', date: 'Apr 2026', label: 'Multi-location & Stripe Terminal scaffold',
    changes: [
      'Multi-location Back Office section: manage locations, switch active location, configure per-location VAT/currency/timezone/service charge.',
      'Locations store state: currentLocationId, locations[], setCurrentLocation, addLocation, updateLocation.',
      'Stripe Terminal scaffold (src/lib/stripe.js): initStripeTerminal, discoverReaders, connectReader, collectPayment, cancelPayment — mock mode simulates card tap with 5% decline rate.',
    ],
  },
  {
    version: '0.8.9', date: 'Apr 2026', label: 'OrderTypeModal — complete send flow redesign',
    changes: [
      'Send button with no table assigned now shows OrderTypeModal — six clear paths: Counter/named, Seat at table, Bar tab, Takeaway, Collection, Delivery.',
      'Counter/named: enter optional name, sends to kitchen immediately, appears in Orders Hub, POS clears.',
      'Seat at table: picks available table from floor plan, seats items, navigates to floor plan.',
      'Bar tab: open a new named tab or add to an existing open tab.',
      'Takeaway/Collection: name + phone + time (or ASAP), sends to kitchen + order queue.',
      'Delivery: name + phone + address, sends to queue.',
    ],
  },
  {
    version: '0.8.8', date: 'Apr 2026', label: 'Orders Hub rebuild + live badge',
    changes: [
      'Orders Hub rebuilt with live elapsed timers, channel filter tabs (All / Tables / Bar / Dine-in / Takeaway / Collection / Delivery), colour-coded status strips.',
      'My orders filter: tap "👤 My orders" to see only the current server\'s active orders.',
      'Orders Hub shows table sessions, bar tabs, and walk-in queue orders unified.',
      'Active order count badge on Orders button in shift bar.',
    ],
  },
  {
    version: '0.8.7', date: 'Apr 2026', label: 'Orders Hub + walk-in routing fix + menu type system',
    changes: [
      'Orders Hub added as a full-screen surface: unified view of all active orders across tables, bar tabs, and walk-in queue.',
      'Walk-in order routing fixed: all orders sent without a table (including named dine-in) now always appear in the Orders Hub.',
      'Sub item type: first-class item type, hidden from POS/kiosk/online, used only as options within modifier groups.',
      'Modifiable type: auto-set the moment modifier groups are added to an item, reverts to Simple when all groups are removed.',
      'Variants: parent item with children linked via parentId. Each child is a full item with its own price.',
      'Combo (renamed from Bundle).',
    ],
  },
  {
    version: '0.8.6', date: 'Apr 2026', label: 'Menu Manager v2: order-type pricing, modifier library, builder',
    changes: [
      'Pricing changed from per-menu to per-order-type: Base, Dine-in, Takeaway, Collection, Delivery.',
      'Modifier library: create modifiers centrally, add to groups on items.',
      'Interactive full-page builder: POS/Kiosk/Handheld preview, drag to reorder categories and items.',
      'Items tab: inline price editing for all order types in table rows.',
      'Modifiers tab: modifier library with category grouping and global overview.',
    ],
  },
  {
    version: '0.8.5', date: 'Apr 2026', label: 'Menu Manager fixes & Supabase init',
    changes: [
      'Fixed illegal useState inside .map() in CategoryRow — extracted to proper component.',
      'KDS uses kitchenName, receipts use receiptName, POS buttons use menuName.',
      'useSupabaseInit hook called from App on mount — loads menu, floor plan, 86 list, KDS, closed checks from DB.',
    ],
  },
  {
    version: '0.8.3', date: 'Apr 2026', label: 'Menu Manager rebuild: multiple menus, full item model',
    changes: [
      'Complete menu manager rebuild: multiple menus, hierarchical category tree with subcategories.',
      'Triple naming per item: Menu name (POS button), Receipt name, Kitchen name (KDS).',
      'Per-menu price overrides, modifier groups with min/max, pizza builder, scope (local/shared/global).',
      'Routing tab: production centre per item or inherited from category, course assignment.',
      'Visibility tab: toggle per channel (POS, Kiosk, Online, Delivery apps).',
    ],
  },
  {
    version: '0.8.2', date: 'Apr 2026', label: 'Inventory management + full Supabase write path',
    changes: [
      'Inventory section in Back Office: portion tracking, par counts, low/critical/out status bars.',
      '86 all out-of-stock quick action, bulk count modal.',
      'All store mutations wired to Supabase: menu items, floor tables, KDS tickets, closed checks, config pushes.',
    ],
  },
  {
    version: '0.8.0', date: 'Apr 2026', label: 'Supabase Phase 2: schema, DB layer, Realtime',
    changes: [
      '293-line Postgres schema: organisations, locations, menus, items, modifiers, floor plan, staff, orders, KDS, 86 list.',
      'db.js data access layer: fetchMenuItems, upsertMenuItem, fetch86List, fetchKDSTickets, insertClosedCheck, insertConfigPush.',
      'realtime.js: Postgres change subscriptions for KDS tickets, 86 list, and config pushes.',
      'toggle86 and bumpTicket wired to Supabase. Mock mode falls back to BroadcastChannel.',
    ],
  },
  {
    version: '0.7.9', date: 'Apr 2026', label: 'Modifier groups, kiosk surface, EOD close',
    changes: [
      'Modifier groups editor on items: name, required/optional, single/multi-select, options with prices.',
      'Kiosk surface (?t=kiosk): full customer-facing UI with category tabs, search, modifier picker, order confirmation.',
      'EOD Close: full shift summary, checklist, cash variance, manager notes, two-step confirm.',
      'Quick screen profile-aware: bar terminal prioritises bar/drinks items.',
    ],
  },
  {
    version: '0.7.5', date: 'Apr 2026', label: 'Back Office: Push to POS & config snapshot',
    changes: [
      '"Push to POS →" button in Back Office header — broadcasts config snapshot to all POS terminals.',
      'POS sync banner shown when BO pushes an update.',
      'Config snapshot persisted to localStorage and written to Supabase config_pushes table.',
    ],
  },
  {
    version: '0.7.0', date: 'Apr 2026', label: '⚙ Back Office Portal launched',
    changes: [
      'Full Back Office portal: Menu manager, Floor plan builder, Device profiles, Device registry, Staff & access, Print routing, Reports, EOD close.',
      'Device profiles: configure surface, order types, sections, features per terminal type.',
      'URL-based terminal selection (?t=counter/bar/handheld/kds/kiosk).',
      'BroadcastChannel cross-tab sync for operational data.',
    ],
  },
];




















export default function App() {
  const { staff, surface, setSurface, toast, shift, theme, setTheme, appMode, deviceConfig } = useStore();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [syncPulse, setSyncPulse] = useState(false);

  useSupabaseInit(); // Load state from Supabase on mount (no-op in mock mode)

  const handleSyncPulse = useCallback(() => {
    setSyncPulse(true);
    setTimeout(() => setSyncPulse(false), 600);
  }, []);

  // Start Supabase Realtime on mount — NEVER use loc-demo, retry until real locationId resolves
  useEffect(() => {
    let cleanup;
    let retryTimer;
    const boot = async () => {
      try {
        const [{ startRealtime }, { getLocationId }] = await Promise.all([
          import('./lib/realtime.js'),
          import('./lib/supabase.js'),
        ]);
        // Try up to 5 times with 2s gap to get the real locationId
        for (let attempt = 0; attempt < 5; attempt++) {
          const locationId = await getLocationId().catch(() => null);
          if (locationId && locationId !== 'loc-demo') {
            cleanup = startRealtime(useStore, locationId);
            return;
          }
          await new Promise(r => { retryTimer = setTimeout(r, 2000); });
        }
        // If still no real locationId after retries, try once from paired device localStorage
        try {
          const dev = JSON.parse(localStorage.getItem('rpos-device') || '{}');
          if (dev.locationId && dev.locationId !== 'loc-demo') {
            const { startRealtime } = await import('./lib/realtime.js');
            cleanup = startRealtime(useStore, dev.locationId);
          }
        } catch {}
      } catch {}
    };
    boot();
    return () => { cleanup?.(); clearTimeout(retryTimer); };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Device mode selection ─────────────────────────────────────────────
  // Priority: URL ?mode=X param > localStorage > first-visit selector
  // This lets users bookmark /app?mode=pos, /app?mode=office, /app?mode=admin
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  const storedMode = localStorage.getItem('rpos-device-mode');
  const deviceMode = isMock ? 'pos' : (urlMode || storedMode || null);

  // If URL param set, save to localStorage so it persists
  if (urlMode && urlMode !== storedMode) {
    localStorage.setItem('rpos-device-mode', urlMode);
  }

  // First visit — ask what this device is for
  if (!deviceMode) return (
    <ModeSelector
      onSelectPOS={() => { localStorage.setItem('rpos-device-mode', 'pos'); window.location.href = '?mode=pos'; }}
      onSelectBackOffice={() => { localStorage.setItem('rpos-device-mode', 'backoffice'); window.location.href = '?mode=office'; }}
      onSelectAdmin={() => { localStorage.setItem('rpos-device-mode', 'admin'); window.location.href = '?mode=admin'; }}
    />
  );

  // Company Admin — completely separate internal app
  if (deviceMode === 'admin') return <CompanyAdminApp />;

  // Back office mode — go to email login (no pairing needed)
  if (deviceMode === 'backoffice' || deviceMode === 'office') return <><SyncBridge onSyncPulse={handleSyncPulse}/><BackOfficeApp /></>;

  // POS mode — check if paired to a location
  const pairedDevice = (() => { try { return JSON.parse(localStorage.getItem('rpos-device') || 'null'); } catch { return null; } })();
  if (!pairedDevice) return <PairingScreen onPaired={() => window.location.reload()} />;

  // Validate device against Supabase (checks if admin removed it)
  // Uses a component so hooks work properly
  return <ValidatedPOSApp pairedDevice={pairedDevice} staff={staff} surface={surface} setSurface={setSurface} toast={toast} shift={shift} theme={theme} setTheme={setTheme} syncPulse={syncPulse} handleSyncPulse={handleSyncPulse} showWhatsNew={showWhatsNew} setShowWhatsNew={setShowWhatsNew} deviceConfig={deviceConfig} />;
}

function ValidatedPOSApp({ pairedDevice, staff, surface, setSurface, toast, shift, theme, setTheme, syncPulse, handleSyncPulse, showWhatsNew, setShowWhatsNew, deviceConfig }) {
  const [deviceValid, setDeviceValid] = useState(null); // null=checking, true=ok, false=revoked
  const [masterOffline, setMasterOffline] = useState(false);
  const [masterInfo, setMasterInfo] = useState(null);
  // No "dismissed" state — master offline is a hard block

  // Start master/child sync after device is validated
  useEffect(() => {
    if (!pairedDevice || isMock || deviceValid !== true) return;

    let stopped = false;
    const boot = async () => {
      try {
        const { getLocationId } = await import('./lib/supabase.js');
        const locId = await getLocationId().catch(() => null);
        if (!locId || stopped) return;

        const { startMasterHeartbeat, startChildMonitor } = await import('./sync/MasterSync.js');

        // isMaster is written to rpos-device-config during device validation (refreshDevice)
        // which queries device_profiles from Supabase — always authoritative
        const cfg = JSON.parse(localStorage.getItem('rpos-device-config') || '{}');
        const isMasterDevice = cfg.isMaster === true;

        if (isMasterDevice) {
          // Master: write heartbeat immediately, never monitor
          startMasterHeartbeat({
            deviceId: pairedDevice.id,
            locationId: locId,
            deviceName: pairedDevice.name,
            version: VERSION,
          });
        } else {
          // Child: wait 20s before first check so master has time to write heartbeat on startup
          await new Promise(r => setTimeout(r, 20_000));
          if (!stopped) startChildMonitor({ locationId: locId });
        }
      } catch (e) {
        console.warn('[MasterSync] boot error:', e.message);
      }
    };

    boot();
    return () => { stopped = true; };
  }, [deviceValid]);

  useEffect(() => {
    const onOffline = (e) => { setMasterInfo(e.detail); setMasterOffline(true); };
    const onOnline  = (e) => { setMasterInfo(e.detail); setMasterOffline(false); };
    window.addEventListener('rpos-master-offline', onOffline);
    window.addEventListener('rpos-master-online',  onOnline);
    return () => {
      window.removeEventListener('rpos-master-offline', onOffline);
      window.removeEventListener('rpos-master-online',  onOnline);
    };
  }, []);

  useEffect(() => {
    if (isMock) { setDeviceValid(true); return; }

    // Generate a unique session token for this browser tab
  const SESSION_TOKEN_KEY = `rpos-session-${pairedDevice.id}`;
  const mySessionToken = (() => {
    let t = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!t) { t = `sess-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; sessionStorage.setItem(SESSION_TOKEN_KEY, t); }
    return t;
  })();

  // Check if this is a forced reclaim (user clicked Reconnect)
  const isReclaim = !!sessionStorage.getItem(`rpos-reclaim-${pairedDevice.id}`);
  if (isReclaim) sessionStorage.removeItem(`rpos-reclaim-${pairedDevice.id}`);

  const refreshDevice = async () => {
      // If reclaiming: write our token to Supabase FIRST — this kicks the other session immediately
      if (isReclaim) {
        await supabase.from('devices').update({ session_token: mySessionToken }).eq('id', pairedDevice.id);
      }
      const { data } = await supabase.from('devices').select('id, status, profile_id, name, session_token').eq('id', pairedDevice.id).single();
      if (!data || data.status === 'removed') {
        localStorage.removeItem('rpos-device');
        setDeviceValid(false);
        return;
      }
      // Check if another session has claimed this device (only if we're NOT reclaiming)
      if (!isReclaim && data.session_token && data.session_token !== mySessionToken) {
        setDeviceValid('kicked');
        return;
      }
      // Claim this device for our session (if not already done via reclaim above)
      if (!isReclaim) {
        await supabase.from('devices').update({ session_token: mySessionToken }).eq('id', pairedDevice.id);
      }
      // Refresh device name + profile
      const current = JSON.parse(localStorage.getItem('rpos-device') || '{}');
      if (data.name !== current.name || data.profile_id !== current.profileId) {
        localStorage.setItem('rpos-device', JSON.stringify({ ...current, name: data.name, profileId: data.profile_id }));
      }
      // Apply profile settings — fetch directly from Supabase for accuracy
      if (data.profile_id) {
        try {
          // Always fetch from Supabase first — this is the single source of truth
          let profile = null;
          try {
            const { data: dbProfile } = await supabase
              .from('device_profiles')
              .select('*')
              .eq('id', data.profile_id)
              .single();
            if (dbProfile) {
              profile = {
                id: dbProfile.id,
                name: dbProfile.name,
                defaultSurface: dbProfile.default_surface || 'tables',
                enabledOrderTypes: dbProfile.enabled_order_types || ['dine-in'],
                assignedSection: dbProfile.assigned_section || null,
                hiddenFeatures: dbProfile.hidden_features || [],
                tableServiceEnabled: dbProfile.table_service_enabled !== false,
                quickScreenEnabled: dbProfile.quick_screen_enabled !== false,
                serviceCharge: dbProfile.service_charge || null,
                isMaster: dbProfile.is_master === true,
              };
            }
          } catch {}
          // Fallback: localStorage > config snapshot only (NO hardcoded defaults — deleted means deleted)
          if (!profile) {
            const storedProfiles = JSON.parse(localStorage.getItem('rpos-device-profiles') || 'null');
            const snapProfiles = (() => { try { return JSON.parse(localStorage.getItem('rpos-config-snapshot') || '{}')?.profiles || null; } catch { return null; } })();
            const allProfiles = [...(storedProfiles || []), ...(snapProfiles || [])];
            profile = allProfiles.find(p => p.id === data.profile_id) || null;
          }
          if (profile) {
            const config = {
              profileId: profile.id, profileName: profile.name,
              defaultSurface: profile.defaultSurface || 'tables',
              enabledOrderTypes: profile.enabledOrderTypes || ['dine-in'],
              assignedSection: profile.assignedSection || null,
              hiddenFeatures: profile.hiddenFeatures || [],
              tableServiceEnabled: profile.tableServiceEnabled !== false,
              quickScreenEnabled: profile.quickScreenEnabled !== false,
              serviceCharge: profile.serviceCharge || null,
              isMaster: profile.isMaster === true,
            };
            localStorage.setItem('rpos-device-config', JSON.stringify(config));
            useStore.getState().setDeviceConfig(config);
          } else {
            // Profile ID not found in hardcoded list — try to find it in config push payload
            const existingConfig = JSON.parse(localStorage.getItem('rpos-device-config') || 'null');
            // Check if we have a name for this profile from a previous config push
            let profileName = existingConfig?.profileName;
            if (!profileName || profileName === data.name) {
              // Try config pushes for profile name
              try {
                const { data: pushData } = await supabase
                  .from('config_pushes')
                  .select('payload')
                  .eq('location_id', pairedDevice.location_id)
                  .order('pushed_at', { ascending: false })
                  .limit(1)
                  .single();
                const profiles = pushData?.payload?.profiles || [];
                const found = profiles.find(p => p.id === data.profile_id);
                if (found) profileName = found.name;
              } catch {}
              if (!profileName || profileName === data.name) {
                profileName = data.name || pairedDevice.name || 'POS Terminal';
              }
            }
            const minConfig = {
              profileId: data.profile_id || 'custom',
              profileName: profileName,
              defaultSurface: existingConfig?.defaultSurface || 'tables',
              enabledOrderTypes: existingConfig?.enabledOrderTypes || ['dine-in','takeaway','collection'],
              assignedSection: existingConfig?.assignedSection || null,
              hiddenFeatures: existingConfig?.hiddenFeatures || [],
              tableServiceEnabled: existingConfig?.tableServiceEnabled !== false,
              quickScreenEnabled: existingConfig?.quickScreenEnabled !== false,
              serviceCharge: existingConfig?.serviceCharge || null,
            };
            localStorage.setItem('rpos-device-config', JSON.stringify(minConfig));
            useStore.getState().setDeviceConfig(minConfig);
          }
        } catch(e) {}
      }
      // Always ensure serviceCharge is in deviceConfig (backfill for existing sessions)
      const currentConfig = useStore.getState().deviceConfig;
      if (currentConfig && !currentConfig.serviceCharge && currentConfig.profileId) {
        try {
          const profiles = JSON.parse(localStorage.getItem('rpos-device-profiles') || '[]');
          const match = profiles.find(p => p.id === currentConfig.profileId);
          if (match?.serviceCharge) {
            useStore.getState().setDeviceConfig({ ...currentConfig, serviceCharge: match.serviceCharge });
          }
        } catch {}
      }
      setDeviceValid(true);
    };

    // Initial check
    refreshDevice().catch(() => setDeviceValid(true));

    // Subscribe to realtime changes on this device row
    const channel = supabase
      .channel(`device-${pairedDevice.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'devices',
        filter: `id=eq.${pairedDevice.id}`,
      }, (payload) => {
        const updatedToken = payload.new?.session_token;
        // If session_token changed and it's not ours → we've been displaced
        if (updatedToken && updatedToken !== mySessionToken) {
          setDeviceValid('kicked');
          return;
        }
        // Otherwise refresh profile
        refreshDevice().catch(() => {});
      })
      .subscribe();

    // Also subscribe to changes on the device_profiles table for this device's profile.
    // This means: if someone edits the profile settings (order types, features, etc.),
    // the front end picks them up immediately without a reload.
    let profileChannel = null;
    const wireProfileChannel = (profileId) => {
      if (!profileId) return;
      if (profileChannel) supabase.removeChannel(profileChannel);
      profileChannel = supabase
        .channel(`profile-${profileId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_profiles',
          filter: `id=eq.${profileId}`,
        }, (payload) => {
          // Profile settings changed — re-apply immediately
          const p = payload.new;
          if (!p) return;
          const config = {
            profileId: p.id,
            profileName: p.name,
            defaultSurface: p.default_surface || 'tables',
            enabledOrderTypes: p.enabled_order_types || ['dine-in'],
            assignedSection: p.assigned_section || null,
            hiddenFeatures: p.hidden_features || [],
            tableServiceEnabled: p.table_service_enabled !== false,
            quickScreenEnabled: p.quick_screen_enabled !== false,
            serviceCharge: p.service_charge || null,
            terminalName: useStore.getState().deviceConfig?.terminalName,
          };
          localStorage.setItem('rpos-device-config', JSON.stringify(config));
          useStore.getState().setDeviceConfig(config);
          useStore.getState().showToast('Device profile updated', 'info');
        })
        .subscribe();
    };

    // Wire up now with current profile_id
    const currentProfileId = JSON.parse(localStorage.getItem('rpos-device') || '{}')?.profileId;
    wireProfileChannel(currentProfileId);

    return () => {
      supabase.removeChannel(channel);
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  if (deviceValid === null) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--t3)', fontSize:14 }}>
      Checking device…
    </div>
  );
  if (deviceValid === false) return <PairingScreen onPaired={() => window.location.reload()} />;

  if (deviceValid === 'kicked') return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0f1117', fontFamily:'inherit', gap:20, padding:40, position:'relative', zIndex:9999 }}>
      <div style={{ fontSize:48 }}>⚠️</div>
      <div style={{ fontSize:22, fontWeight:800, color:'#f1f5f9', textAlign:'center' }}>This terminal has been disconnected</div>
      <div style={{ fontSize:15, color:'#64748b', textAlign:'center', maxWidth:400, lineHeight:1.7 }}>
        Another device or browser window has connected to <strong style={{color:'#e2e8f0'}}>{pairedDevice.name}</strong>.<br/>
        Each POS device can only be active in one place at a time.
      </div>
      <a href="?mode=pos" onClick={() => {
          sessionStorage.setItem(`rpos-reclaim-${pairedDevice.id}`, '1');
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
          localStorage.setItem('rpos-device-mode', 'pos');
        }}
        style={{ padding:'14px 32px', borderRadius:12, background:'#6366f1', color:'#fff', fontWeight:700, fontSize:15, textDecoration:'none', fontFamily:'inherit', display:'inline-block' }}>
        Reconnect this terminal
      </a>
      <div style={{ fontSize:12, color:'#334155' }}>v{VERSION}</div>
    </div>
  );

  // KDS devices — if device type is kds, ensure mode is set correctly
  const pairedDeviceType = pairedDevice?.type;
  if (pairedDeviceType === 'kds') {
    // KDS devices always show KDS surface regardless of URL mode
    return <><SyncBridge onSyncPulse={handleSyncPulse}/><KDSSurface /></>;
  }
  // For non-KDS devices, also check deviceConfig (set during pairing)
  if (deviceConfig?.defaultSurface === 'kds' && !deviceConfig?.profileName?.toLowerCase().includes('counter') && !deviceConfig?.profileName?.toLowerCase().includes('bar') && !deviceConfig?.profileName?.toLowerCase().includes('server')) {
    return <><SyncBridge onSyncPulse={handleSyncPulse}/><KDSSurface /></>;
  }

  if (!staff) return <><SyncBridge onSyncPulse={handleSyncPulse}/><PINScreen /></>;
  // Kiosk — full screen, no staff sidebar, no shift bar
  if (surface === 'kiosk' || deviceConfig?.defaultSurface === 'kiosk') return <><SyncBridge onSyncPulse={handleSyncPulse}/><KioskSurface /></>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <SyncBridge onSyncPulse={handleSyncPulse}/>
      {masterOffline && (
        <MasterOfflineModal
          masterName={masterInfo?.device_name}
          lastSeen={masterInfo}
        />
      )}
      
      <ShiftBar version={VERSION} onWhatsNew={()=>setShowWhatsNew(true)} theme={theme} onToggleTheme={()=>setTheme(theme==='dark'?'light':'dark')} syncPulse={syncPulse}/>
      <ConfigSyncBanner />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar surface={surface} setSurface={setSurface} />
        <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>
          {surface==='tables'     && <TablesSurface />}
          {surface==='pos'        && <POSSurface />}
          {surface==='bar'        && <BarSurface />}
          {surface==='orders'     && <OrdersHub />}
          {surface==='kds'        && <KDSSurface />}
          {surface==='ai'         && <AIAssistantSurface />}
        </div>
      </div>
      {toast && <Toast toast={toast} />}
      {showWhatsNew && <WhatsNewModal onClose={()=>setShowWhatsNew(false)} />}
    </div>
  );
}

const NAV = [
  { id:'bar',     label:'Bar',    icon:'🍸' },
  { id:'tables',  label:'Floor',  icon:'⬚' },
  { id:'pos',     label:'POS',    icon:'⊞' },
  { id:'orders',  label:'Orders', icon:'📋' },
  { id:'ai',      label:'AI',     icon:'✦' },
  // KDS is NOT in the nav — KDS devices are separate terminals that boot straight to KDS surface
];

function ShiftBar({ version, onWhatsNew, theme, onToggleTheme, syncPulse }) {
  const { deviceConfig, setSurface, orderQueue, tables, tabs, closedChecks, shift } = useStore();
  const pairedDevice = (() => { try { return JSON.parse(localStorage.getItem('rpos-device') || 'null'); } catch { return null; } })();
  const terminalName = deviceConfig?.terminalName || pairedDevice?.name || 'POS';
  const storedProfiles = (() => { try { return JSON.parse(localStorage.getItem('rpos-device-profiles') || 'null'); } catch { return null; } })();
  const DEFAULT_PROFILES = [
    { id:'prof-1', name:'Main counter' },
    { id:'prof-2', name:'Bar terminal' },
    { id:'prof-3', name:'Server handheld' },
  ];
  const allProfiles = storedProfiles || DEFAULT_PROFILES;
  const profileName = deviceConfig?.profileName
    || allProfiles.find(p => p.id === pairedDevice?.profileId)?.name
    || null;

  const activeOrders = (orderQueue?.filter(o => !['collected','paid'].includes(o.status)).length || 0)
    + (tables?.filter(t => t.status !== 'available').length || 0)
    + (tabs?.filter(t => t.status !== 'closed').length || 0);
  const urlParam = deviceConfig?.param;

  // Printer status — poll bridge every 30s
  const [printerStatus, setPrinterStatus] = useState(null); // null | 'online' | 'offline'
  const [printers, setPrinters] = useState(() => { try { return JSON.parse(localStorage.getItem('rpos-printers') || '[]'); } catch { return []; } });

  useEffect(() => {
    const update = () => { try { setPrinters(JSON.parse(localStorage.getItem('rpos-printers') || '[]')); } catch {} };
    window.addEventListener('rpos-printers-updated', update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener('rpos-printers-updated', update); window.removeEventListener('storage', update); };
  }, []);

  useEffect(() => {
    if (!printers.length) return;
    const check = async () => {
      const cfg = (() => { try { return JSON.parse(localStorage.getItem('rpos-printer-config') || '{}'); } catch { return {}; } })();
      const bridgeUrl = cfg.bridgeUrl || 'http://localhost:3001';
      try {
        const res = await fetch(`${bridgeUrl}/status`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        setPrinterStatus(data.ok ? 'online' : 'offline');
      } catch {
        setPrinterStatus('offline');
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [printers.length]);

  return (
    <div style={{ height:42, display:'flex', alignItems:'center', background:'var(--bg1)', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
      {/* Logo */}
      <div style={{ width:'var(--nav)', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', borderRight:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ width:30, height:30, background:'var(--acc)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#0b0c10', fontFamily:'var(--font-mono)' }}>R</div>
      </div>

      {/* Terminal identity — LEFT, always visible */}
      <div style={{ padding:'0 16px 0 14px', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', justifyContent:'center', height:'100%', flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em', lineHeight:1 }}>{terminalName}</div>
        <div style={{ fontSize:9, fontWeight:700, color: profileName ? 'var(--acc)' : 'var(--t4)', marginTop:2, letterSpacing:'.04em', textTransform:'uppercase' }}>
          {profileName || 'No profile'}
          {urlParam && <span style={{ marginLeft:4, padding:'0 4px', background:'var(--bg3)', borderRadius:3, color:'var(--t4)', fontFamily:'var(--font-mono)', fontSize:8 }}>?t={urlParam}</span>}
        </div>
      </div>

      {/* Shift stats */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 16px', flex:1, gap:0, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:20 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--grn)', boxShadow:'0 0 6px var(--grn)' }}/>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{shift.name}</span>
          {/* Sync pulse — flashes amber when data syncs from another terminal */}
          {syncPulse && (
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--acc)', boxShadow:'0 0 8px var(--acc)', animation:'pulse .6s ease-out', opacity:1 }}/>
          )}
        </div>
        {[{label:'Covers',val:shift.covers},{label:'Sales',val:`£${shift.sales.toLocaleString()}`},{label:'Avg',val:`£${shift.avgCheck.toFixed(2)}`}].map(s=>(
          <div key={s.label} style={{ marginRight:20, display:'flex', alignItems:'baseline', gap:5 }}>
            <span style={{ fontSize:10, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>{s.label}</span>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--t2)', fontFamily:typeof s.val==='string'&&s.val.includes('£')?'var(--font-mono)':'inherit' }}>{s.val}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 14px', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'var(--t4)', fontFamily:'var(--font-mono)' }}>
          {new Date().toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
        </div>
        <button onClick={onToggleTheme} style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:32, height:28, borderRadius:9, cursor:'pointer',
          background:'var(--bg3)', border:'1px solid var(--bdr)', fontFamily:'inherit',
          fontSize:15, color:'var(--t3)', transition:'all .14s',
        }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--bdr3)';e.currentTarget.style.color='var(--t1)';}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr)';e.currentTarget.style.color='var(--t3)';}}>
          {theme==='dark' ? '☀️' : '🌙'}
        </button>
        <button onClick={() => setSurface('orders')} style={{
          display:'flex', alignItems:'center', gap:6, padding:'4px 11px', borderRadius:20, cursor:'pointer',
          background: activeOrders > 0 ? 'var(--acc-d)' : 'var(--bg3)',
          border:`1px solid ${activeOrders > 0 ? 'var(--acc-b)' : 'var(--bdr)'}`,
          fontFamily:'inherit', fontSize:11, fontWeight:700,
          color: activeOrders > 0 ? 'var(--acc)' : 'var(--t3)',
          position:'relative', transition:'all .14s',
        }}>
          <span>📋 Orders</span>
          {activeOrders > 0 && (
            <span style={{ background:'var(--acc)', color:'#0b0c10', borderRadius:10, padding:'0 5px', fontSize:10, fontWeight:800 }}>
              {activeOrders}
            </span>
          )}
        </button>
        {/* Printer status moved to Status drawer (sidebar button) */}
        <button onClick={onWhatsNew} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, cursor:'pointer', background:'var(--bg3)', border:'1px solid var(--bdr)', fontFamily:'inherit', fontSize:11, fontWeight:700, color:'var(--t3)', transition:'all .14s' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--acc-b)';e.currentTarget.style.color='var(--acc)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr)';e.currentTarget.style.color='var(--t3)';}}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10 }}>v{version}</span>
          <span style={{ color:'var(--bdr3)' }}>·</span>
          <span>What's new</span>
        </button>
      </div>
    </div>
  );
}

function WhatsNewModal({ onClose }) {
  const [selected, setSelected] = useState(CHANGELOG[0].version);
  const entry = CHANGELOG.find(c => c.version === selected) || CHANGELOG[0];
  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:20,
        width:'100%', maxWidth:560, maxHeight:'80vh',
        display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--t1)' }}>What's new</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>Restaurant OS · version history</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:22, lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Version list */}
          <div style={{ width:160, flexShrink:0, borderRight:'1px solid var(--bdr)', overflowY:'auto', padding:'8px 0' }}>
            {CHANGELOG.map((c, i) => (
              <button key={c.version} onClick={()=>setSelected(c.version)} style={{
                width:'100%', padding:'10px 14px', textAlign:'left', cursor:'pointer',
                fontFamily:'inherit', border:'none', transition:'background .1s',
                background: selected===c.version ? 'var(--bg3)' : 'transparent',
                borderLeft: `2px solid ${selected===c.version ? 'var(--acc)' : 'transparent'}`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:12, fontWeight:700, color: selected===c.version?'var(--acc)':'var(--t1)', fontFamily:'DM Mono, monospace' }}>v{c.version}</span>
                  {i===0 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:20, background:'var(--acc)', color:'#0e0f14' }}>LATEST</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{c.label}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{c.date}</div>
              </button>
            ))}
          </div>

          {/* Changes detail */}
          <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4 }}>
              <span style={{ fontSize:20, fontWeight:800, color:'var(--t1)', fontFamily:'DM Mono, monospace' }}>v{entry.version}</span>
              <span style={{ fontSize:13, color:'var(--acc)', fontWeight:600 }}>{entry.label}</span>
            </div>
            <div style={{ fontSize:11, color:'var(--t4)', marginBottom:16 }}>{entry.date}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {entry.changes.map((change, i) => (
                <div key={i} style={{ display:'flex', gap:10, padding:'8px 12px', background:'var(--bg3)', borderRadius:8, border:'1px solid var(--bdr)' }}>
                  <span style={{ color:'var(--acc)', fontWeight:700, flexShrink:0, marginTop:1 }}>✓</span>
                  <span style={{ fontSize:13, color:'var(--t2)', lineHeight:1.5 }}>{change}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ surface, setSurface }) {
  const { setAppMode, syncStatus, deviceConfig } = useStore();
  const [showStatus, setShowStatus] = useState(false);

  const hidden = deviceConfig?.hiddenFeatures || [];
  const allOk = syncStatus.printerOnline && !syncStatus.pendingChanges;
  const printers = (() => { try { return JSON.parse(localStorage.getItem('rpos-printers') || '[]'); } catch { return []; } })();
  const hasPrinters = printers.length > 0;

  const FEATURE_MAP = { kds:'kds', reports:'backoffice', barTabs:'bar', bar:'bar', floorplan:'tables', tables:'tables', floor:'tables', orders:'orders' };
  const visibleNav = NAV.filter(n => {
    // Table service disabled → hide floor plan
    if (n.id === 'tables' && deviceConfig && deviceConfig.tableServiceEnabled === false) return false;
    // Hidden features → hide matching nav item
    return !hidden.some(f => FEATURE_MAP[f] === n.id);
  });

  return (
    <>
    <nav style={{ width:'var(--nav)', background:'var(--bg1)', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 0', gap:2, flexShrink:0 }}>
      {visibleNav.map(n=>{
        const active=surface===n.id;
        return(<button key={n.id} onClick={()=>setSurface(n.id)} style={{ width:46, height:46, borderRadius:10, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, background:active?'var(--acc-d)':'transparent', border:`1px solid ${active?'var(--acc-b)':'transparent'}`, color:active?'var(--acc)':'var(--t3)', transition:'all .15s', fontFamily:'inherit', position:'relative' }}>
          <span style={{ fontSize:18, lineHeight:1 }}>{n.icon}</span>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em', color:active?'var(--acc)':'var(--t3)' }}>{n.label}</span>
        </button>);
      })}

      {/* Divider */}
      <div style={{ width:32, height:1, background:'var(--bdr)', margin:'4px 0' }}/>

      {/* Status button — shows dot if anything offline or pending */}
      <button onClick={() => setShowStatus(true)} title="Terminal status" style={{
        width:46, height:46, borderRadius:10, cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
        background:'transparent', border:'1px solid transparent',
        color: allOk ? 'var(--t3)' : 'var(--acc)', transition:'all .15s', fontFamily:'inherit',
        position:'relative',
      }}
      onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
        <span style={{ fontSize:17, lineHeight:1 }}>⊙</span>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em' }}>Status</span>
        {!allOk && hasPrinters && <div style={{ position:'absolute', top:6, right:8, width:7, height:7, borderRadius:'50%', background:'var(--acc)', boxShadow:'0 0 6px var(--acc)' }}/>}
        {!deviceConfig && <div style={{ position:'absolute', top:6, right:8, width:7, height:7, borderRadius:'50%', background:'var(--red)', boxShadow:'0 0 6px var(--red)' }}/>}
      </button>

      {/* Back Office button */}
      <button onClick={() => { window.location.href = "?mode=office"; }} title="Back Office" style={{
        width:46, height:46, borderRadius:10, cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
        background:'transparent', border:'1px solid transparent',
        color:'var(--t3)', transition:'all .15s', fontFamily:'inherit',
      }}
      onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--t1)';}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--t3)';}}>
        <span style={{ fontSize:17, lineHeight:1 }}>⚙</span>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em' }}>Office</span>
      </button>

      <div style={{ marginTop:'auto' }}><StaffAvatar /></div>
    </nav>

    {showStatus && <StatusDrawer onClose={() => setShowStatus(false)} />}
    </>
  );
}

function StaffAvatar() {
  const [open,setOpen]=useState(false);
  const { staff, logout }=useStore();
  if (!staff) return null;
  return(
    <div style={{ position:'relative', marginBottom:8 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ width:34, height:34, borderRadius:'50%', cursor:'pointer', background:staff.color+'22', border:`2px solid ${staff.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:staff.color }}>{staff.initials}</div>
      {open&&(<div style={{ position:'absolute', bottom:42, left:0, background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:12, padding:8, minWidth:160, boxShadow:'var(--sh3)', zIndex:50 }}>
        <div style={{ padding:'6px 10px', fontSize:13, fontWeight:600, color:'var(--t1)' }}>{staff.name}</div>
        <div style={{ padding:'2px 10px 8px', fontSize:12, color:'var(--t3)' }}>{staff.role}</div>
        <div style={{ height:1, background:'var(--bdr)', margin:'4px 0' }}/>
        <button onClick={()=>{logout();setOpen(false);}} style={{ width:'100%', padding:'7px 10px', borderRadius:8, cursor:'pointer', background:'transparent', border:'none', color:'var(--red)', fontSize:13, textAlign:'left', fontFamily:'inherit', fontWeight:500 }}>Sign out</button>
      </div>)}
    </div>
  );
}

function Toast({ toast }) {
  const map={success:{bg:'var(--grn-d)',bdr:'var(--grn-b)',color:'var(--grn)'},error:{bg:'var(--red-d)',bdr:'var(--red-b)',color:'var(--red)'},warning:{bg:'var(--acc-d)',bdr:'var(--acc-b)',color:'var(--acc)'},info:{bg:'var(--bg3)',bdr:'var(--bdr2)',color:'var(--t1)'}};
  const c=map[toast.type]||map.info;
  return <div className="toast" key={toast.key} style={{ background:c.bg, border:`1px solid ${c.bdr}`, color:c.color }}>{toast.msg}</div>;
}
