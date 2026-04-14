import { create } from 'zustand';
import { supabase, isMock, getLocationId } from '../lib/supabase';

// ── Supabase helpers ─────────────────────────────────────────────────────────
const sbUpsertMenu = async (menu) => {
  if (isMock) return;
  const locationId = await getLocationId();
  if (!locationId) return console.warn('[Supabase] no location ID — menu not saved');
  const { error } = await supabase.from('menus').upsert({
    id: menu.id,
    location_id: locationId,
    name: menu.name,
    description: menu.description || '',
    is_default: menu.isDefault || false,
    is_active: menu.isActive !== false,
    sort_order: menu.sortOrder || 0,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('[Supabase] menus upsert error:', error);
};
const sbDeleteMenu = async (id) => {
  if (isMock) return;
  await supabase.from('menus').delete().eq('id', id);
};
const sbUpsertCategory = async (cat) => {
  if (isMock) return;
  const locationId = await getLocationId();
  if (!locationId) return console.warn('[Supabase] no location ID — category not saved');
  const { error } = await supabase.from('menu_categories').upsert({
    id: cat.id,
    location_id: locationId,
    menu_id: cat.menuId || null,
    parent_id: cat.parentId || null,
    label: cat.label,
    icon: cat.icon || '🍽',
    color: cat.color || '#3b82f6',
    accounting_group: cat.accountingGroup || '',
    sort_order: cat.sortOrder || 0,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('[Supabase] menu_categories upsert error:', error);
};
const sbDeleteCategory = async (id) => {
  if (isMock) return;
  await supabase.from('menu_categories').delete().eq('id', id);
};
const sbUpsertMenuItem = async (item) => {
  if (isMock) return;
  const locationId = await getLocationId();
  if (!locationId) return console.warn('[Supabase] no location ID — item not saved');
  await supabase.from('menu_items').upsert({
    id: item.id, location_id: locationId, name: item.name,
    menu_name: item.menuName||item.name, receipt_name: item.receiptName||item.name,
    kitchen_name: item.kitchenName||item.name, description: item.description||'',
    type: item.type||'simple', cat: item.cat||null, cats: item.cats||[],
    parent_id: item.parentId||null, sort_order: item.sortOrder||0,
    pricing: item.pricing||{base:0}, allergens: item.allergens||[],
    assigned_modifier_groups: item.assignedModifierGroups||[],
    visibility: item.visibility||{pos:true,kiosk:true,online:true},
    sold_alone: item.soldAlone||false, archived: item.archived||false,
    updated_at: new Date().toISOString()
  });
};
import { INITIAL_KDS, SHIFT, MENU_ITEMS, CATEGORIES, STAFF as STAFF_SEED, QUICK_IDS } from '../data/seed';

// ─── ID helpers ──────────────────────────────────────────────────────────────
let _itemUid = 1;
const uid = () => `i${_itemUid++}`;
let _orderNum = 1000;
let _tabNum   = 1;

const CAT_COURSE = { starters:1, mains:2, pizza:2, sides:2, desserts:3, drinks:0, cocktails:0, quick:1 };

// ─── Tables with static config + runtime session ──────────────────────────────
// session: null | { id, items[], firedCourses[], sentAt, server, covers, seatedAt, note }
const TABLES_CONFIG = [
  { id:'t1',  label:'T1',        maxCovers:2, shape:'sq', x:18,  y:30,  w:70,  h:60,  section:'main'  },
  { id:'t2',  label:'T2',        maxCovers:4, shape:'sq', x:110, y:30,  w:80,  h:60,  section:'main'  },
  { id:'t3',  label:'T3',        maxCovers:2, shape:'sq', x:214, y:30,  w:70,  h:60,  section:'main'  },
  { id:'t4',  label:'T4',        maxCovers:4, shape:'sq', x:306, y:30,  w:80,  h:60,  section:'main'  },
  { id:'t5',  label:'T5',        maxCovers:3, shape:'rd', x:18,  y:118, w:78,  h:78,  section:'main'  },
  { id:'t6',  label:'T6',        maxCovers:3, shape:'rd', x:120, y:118, w:78,  h:78,  section:'main'  },
  { id:'t7',  label:'Banquette', maxCovers:8, shape:'sq', x:224, y:120, w:150, h:68,  section:'main'  },
  { id:'t8',  label:'T8',        maxCovers:2, shape:'sq', x:18,  y:220, w:68,  h:60,  section:'main'  },
  { id:'t9',  label:'T9',        maxCovers:4, shape:'sq', x:108, y:220, w:80,  h:60,  section:'main'  },
  { id:'t10', label:'T10',       maxCovers:4, shape:'sq', x:208, y:220, w:80,  h:60,  section:'main'  },
  { id:'b1',  label:'B1',        maxCovers:1, shape:'rd', x:415, y:30,  w:50,  h:50,  section:'bar'   },
  { id:'b2',  label:'B2',        maxCovers:1, shape:'rd', x:415, y:96,  w:50,  h:50,  section:'bar'   },
  { id:'b3',  label:'B3',        maxCovers:1, shape:'rd', x:415, y:162, w:50,  h:50,  section:'bar'   },
  { id:'b4',  label:'B4',        maxCovers:1, shape:'rd', x:415, y:228, w:50,  h:50,  section:'bar'   },
  { id:'p1',  label:'P1',        maxCovers:4, shape:'sq', x:500, y:30,  w:78,  h:64,  section:'patio' },
  { id:'p2',  label:'P2',        maxCovers:4, shape:'sq', x:500, y:118, w:78,  h:64,  section:'patio' },
  { id:'p3',  label:'P3',        maxCovers:6, shape:'sq', x:500, y:206, w:90,  h:68,  section:'patio' },
];

// Seed with a couple of occupied tables for demo
function buildInitialTables() {
  return TABLES_CONFIG.map(t => {
    const base = { ...t, status:'available', session:null, reservation:null };
    if (t.id==='t2') return { ...base, status:'occupied', session:{ id:'ORD-DEMO1', items:[
      { uid:'d1', itemId:'m-soup',    name:'Soup of the day',  price:6.5,  qty:2, mods:[], notes:'', allergens:['gluten','milk'], course:1, fired:true, status:'sent', seat:'shared' },
      { uid:'d2', itemId:'m-salmon',  name:'Grilled salmon',   price:19.0, qty:2, mods:[], notes:'', allergens:['fish','milk'],   course:2, fired:true, status:'sent', seat:'shared' },
      { uid:'d3', itemId:'m-hwine-250',name:'House white 250ml',price:8.5, qty:1, mods:[], notes:'', allergens:['sulphites'],    course:0, fired:true, status:'sent', seat:'shared' },
    ], firedCourses:[0,1], sentAt:Date.now()-18*60000, server:'Sarah', covers:2, seatedAt:Date.now()-22*60000, note:'', orderNote:'' } };
    if (t.id==='t5') return { ...base, status:'occupied', session:{ id:'ORD-DEMO2', items:[
      { uid:'d4', itemId:'m-rib8',    name:'8oz Ribeye',       price:28.0, qty:1, mods:[{label:'Side: Chips',price:0},{label:'Sauce: Peppercorn',price:0}], notes:'', allergens:['milk'], course:2, fired:true, status:'sent', seat:'shared' },
      { uid:'d5', itemId:'m-sir6',    name:'6oz Sirloin',      price:22.0, qty:1, mods:[{label:'Side: Side salad',price:0},{label:'Cooking: Medium rare',price:0}], notes:'', allergens:['milk'], course:2, fired:true, status:'sent', seat:'shared' },
      { uid:'d6', itemId:'m-hrwine-175',name:'House red 175ml',price:6.5,  qty:2, mods:[], notes:'', allergens:['sulphites'], course:0, fired:true, status:'sent', seat:'shared' },
    ], firedCourses:[0,2], sentAt:Date.now()-35*60000, server:'Tom', covers:2, seatedAt:Date.now()-40*60000, note:'', orderNote:'' } };
    if (t.id==='t3') return { ...base, status:'reserved', reservation:{ name:'Johnson party', phone:'07700 900111', time:'7:30 PM', partySize:2 } };
    if (t.id==='p2') return { ...base, status:'reserved', reservation:{ name:'Chen table',   phone:'07700 900222', time:'8:00 PM', partySize:4 } };
    return base;
  });
}

// ─── Utility: recalc session totals ──────────────────────────────────────────
function calcSessionTotals(session) {
  if (!session) return null;
  const subtotal = session.items.reduce((s,i) => s + i.price * i.qty, 0);
  return { ...session, subtotal, total: subtotal * 1.125 };
}

export function getCollectionSlots() {
  const slots = [], now = new Date(), start = new Date(now);
  start.setMinutes(Math.ceil((now.getMinutes()+15)/15)*15, 0, 0);
  for (let i=0; i<12; i++) {
    const t = new Date(start.getTime() + i*15*60000);
    slots.push({ value:t.toISOString(), label:t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}), isASAP:i===0 });
  }
  return slots;
}

// ─── Store ────────────────────────────────────────────────────────────────────
// Restore back-office config from localStorage — ONLY in mock mode
// In real mode, data comes from Supabase (loaded in BackOfficeApp on mount)
const _isMockMode = import.meta.env.VITE_USE_MOCK === 'true';
const _savedBO = (() => {
  if (!_isMockMode) return {}; // real mode: always load from Supabase
  try { return JSON.parse(localStorage.getItem('rpos-bo-config')||'{}'); } catch { return {}; }
})();

export const useStore = create((set, get) => ({

  // ── Auth ──────────────────────────────────
  staff: null,
  staffMembers: isMock ? STAFF_SEED : [],
  addStaffMember:    s    => set(st => ({ staffMembers: [...st.staffMembers, { ...s, id:`s-${Date.now()}` }] })),
  updateStaffMember: (id,patch) => set(st => ({ staffMembers: st.staffMembers.map(s => s.id===id ? {...s,...patch} : s) })),
  removeStaffMember: id  => set(st => ({ staffMembers: st.staffMembers.filter(s => s.id!==id) })),
  login:  s => set({ staff:s }),
  logout: () => set({ staff:null, activeTableId:null, orderType:'dine-in', customer:null }),

  // ── Navigation ────────────────────────────
  surface: 'tables',
  setSurface: s => set({ surface:s }),

  // ── Back Office config push workflow ────────────────────────────────────────
  // pendingBOChanges: count of BO changes not yet pushed to POS
  // configVersion: incremented on each push — POS compares this to know if it's stale
  // configUpdateAvailable: true on POS when a push has been received but not applied
  // configUpdateSnapshot: the incoming config snapshot waiting to be applied
  pendingBOChanges: 0,
  configVersion: 0,
  configUpdateAvailable: false,
  configUpdateSnapshot: null,
  markBOChange: () => set(s => ({ pendingBOChanges: s.pendingBOChanges + 1 })),
  clearBOChanges: () => set({ pendingBOChanges: 0 }),
  setConfigUpdate: (snapshot) => set({ configUpdateAvailable: true, configUpdateSnapshot: snapshot }),
  applyConfigUpdate: () => {
    const snap = useStore.getState().configUpdateSnapshot;
    if (!snap) return;
    set({
      // Layout: merge positions/labels into live tables, preserve session/order state
      tables: snap.tables
        ? useStore.getState().tables.map(t => {
            const st = snap.tables.find(s => s.id === t.id);
            return st ? { ...t, label:st.label, x:st.x, y:st.y, w:st.w, h:st.h, shape:st.shape, maxCovers:st.maxCovers, section:st.section } : t;
          })
        : useStore.getState().tables,
      // Sections
      locationSections: snap.locationSections || useStore.getState().locationSections,
      // Menu items — full replace with pushed version
      ...(snap.menuItems ? { menuItems: snap.menuItems } : {}),
      // Menus list
      ...(snap.menus ? { menus: snap.menus } : {}),
      // Menu categories — full replace
      ...(snap.menuCategories ? { menuCategories: snap.menuCategories } : {}),

      configVersion: snap.version,
      configUpdateAvailable: false,
      configUpdateSnapshot: null,
    });
    try { sessionStorage.setItem('rpos-config-version', String(snap.version)); } catch {}
  },
  locationSections: [
    { id:'main',  label:'Main dining', color:'#3b82f6', icon:'🍽' },
    { id:'bar',   label:'Bar',         color:'#e8a020', icon:'🍸' },
    { id:'patio', label:'Patio',       color:'#22c55e', icon:'🌿' },
  ],
  addSection: (section) => set(s => ({ locationSections: [...s.locationSections, { id:`sec-${Date.now()}`, ...section }] })),
  updateSection: (id, patch) => set(s => ({ locationSections: s.locationSections.map(sec => sec.id===id ? { ...sec, ...patch } : sec) })),
  removeSection: (id) => set(s => ({
    locationSections: s.locationSections.filter(sec => sec.id !== id),
    // Move tables in deleted section to 'main'
    tables: s.tables.map(t => t.section===id ? { ...t, section:'main' } : t),
  })),

  // ── Sync status — tracks whether POS config is current ───────────────────
  syncStatus: {
    lastConfigChange: null,      // timestamp when BO last pushed a change
    lastTerminalSync: Date.now(), // timestamp when this terminal last received config
    pendingChanges: false,
    printerOnline: true,
    paymentTerminalOnline: true,
    kdsOnline: true,
  },
  setSyncStatus: (patch) => set(s => ({ syncStatus: { ...s.syncStatus, ...patch } })),
  markConfigChanged: () => set(s => ({
    syncStatus: { ...s.syncStatus, lastConfigChange: Date.now(), pendingChanges: true }
  })),
  markTerminalSynced: () => set(s => ({
    syncStatus: { ...s.syncStatus, lastTerminalSync: Date.now(), pendingChanges: false }
  })),
  appMode: 'pos',
  setAppMode: mode => set({ appMode: mode }),

  // ── Organisations & Locations ──────────────────────────────────────────────
  currentLocationId: 'loc-demo',
  locations: [
    { id:'loc-demo', name:'The Anchor — High Street', address:'1 High Street, London EC1A 1BB', timezone:'Europe/London', currency:'GBP', vat:20, serviceCharge:12.5, plan:'standard', isActive:true, receiptHeader:'', receiptFooter:'Thank you for dining with us!', createdAt:Date.now() },
  ],
  setCurrentLocation: id => set({ currentLocationId: id }),
  addLocation: loc => set(s => ({ locations: [...s.locations, loc] })),
  updateLocation: (id, patch) => set(s => ({ locations: s.locations.map(l => l.id===id ? { ...l,...patch } : l) })),
  removeLocation: id => set(s => ({ locations: s.locations.filter(l => l.id!==id) })),

  // ── Device config — uses sessionStorage so each browser tab is a separate terminal
  // URL param ?t=bar or ?t=counter2 overrides on load (for testing)
  // In Phase 2: loaded from Supabase by device ID on pairing
  deviceConfig: (() => {
    try {
      // Check URL param first — ?t=bar, ?t=counter, ?t=handheld etc.
      const urlParam = new URLSearchParams(window.location.search).get('t');
      const PRESET_PROFILES = {
        'counter':  { terminalName:'Counter 1',  profileName:'Main counter',    defaultSurface:'tables', enabledOrderTypes:['dine-in','takeaway','collection'], assignedSection:null,  hiddenFeatures:[],                    tableServiceEnabled:true,  quickScreenEnabled:true },
        'counter2': { terminalName:'Counter 2',  profileName:'Main counter',    defaultSurface:'tables', enabledOrderTypes:['dine-in','takeaway','collection'], assignedSection:null,  hiddenFeatures:[],                    tableServiceEnabled:true,  quickScreenEnabled:true },
        'bar':      { terminalName:'Bar',        profileName:'Bar terminal',     defaultSurface:'bar',    enabledOrderTypes:['dine-in'],                         assignedSection:'bar', hiddenFeatures:['courses','reports'], tableServiceEnabled:false, quickScreenEnabled:true, menuId:'menu-2' },
        'handheld': { terminalName:'Handheld 1', profileName:'Server handheld', defaultSurface:'pos',    enabledOrderTypes:['dine-in'],                         assignedSection:null,  hiddenFeatures:['reports','kiosk'],   tableServiceEnabled:true,  quickScreenEnabled:true },
        'kiosk':    { terminalName:'Kiosk 1',    profileName:'Kiosk',           defaultSurface:'pos',    enabledOrderTypes:['dine-in','takeaway'],               assignedSection:null,  hiddenFeatures:['reports','staff'],   tableServiceEnabled:false, quickScreenEnabled:true },
        'kds':      { terminalName:'KDS',        profileName:'Kitchen display',  defaultSurface:'kds',   enabledOrderTypes:[],                                   assignedSection:null,  hiddenFeatures:['reports'],           tableServiceEnabled:false, quickScreenEnabled:false },
      };
      if (urlParam && PRESET_PROFILES[urlParam]) {
        const config = { ...PRESET_PROFILES[urlParam], source:'url-param', param:urlParam };
        try { sessionStorage.setItem('rpos-terminal-config', JSON.stringify(config)); } catch {}
        return config;
      }
      // Then check sessionStorage (tab-specific — each tab is a separate terminal)
      const saved = sessionStorage.getItem('rpos-terminal-config');
      if (saved) return JSON.parse(saved);
      // Fall back to localStorage device config (set when device was paired/profiled)
      const localConfig = localStorage.getItem('rpos-device-config');
      if (localConfig) return JSON.parse(localConfig);
      return null;
    } catch { return null; }
  })(),
  setDeviceConfig: (config) => {
    try { sessionStorage.setItem('rpos-terminal-config', JSON.stringify(config)); } catch {}
    set({ deviceConfig: config });
    if (config?.defaultSurface) set({ surface: config.defaultSurface });
  },
  clearDeviceConfig: () => {
    try { sessionStorage.removeItem('rpos-terminal-config'); } catch {}
    set({ deviceConfig: null });
  },

  // ── Registered POS terminals ───────────────────────────────────────────────
  devices: isMock ? [
    { id:'dev-1', label:'Counter 1', type:'counter', section:'main', status:'online', hardwareModel:'Sunmi T2s', ipAddress:'192.168.1.10' },
    { id:'dev-2', label:'Counter 2', type:'counter', section:'bar',  status:'offline',hardwareModel:'Sunmi T2s', ipAddress:'192.168.1.11' },
    { id:'dev-3', label:'Handheld 1',type:'handheld',section:'main', status:'online', hardwareModel:'Sunmi V2s', ipAddress:'192.168.1.20' },
  ] : [],
  addDevice: (device) => set(s => ({ devices:[...s.devices, { id:`dev-${Date.now()}`, status:'offline', ...device }] })),
  updateDevice: (id, patch) => set(s => ({ devices:s.devices.map(d=>d.id===id?{...d,...patch}:d) })),
  removeDevice: (id) => set(s => ({ devices:s.devices.filter(d=>d.id!==id) })),

  // ── Menus (multiple menus per location, assigned to device profiles) ─────────
  menus: _savedBO.menus || (isMock ? [
    { id:'menu-1', name:'Main menu',    description:'Full food and drinks', scope:'local', assignedProfiles:[], isDefault:true,  isActive:true, sortOrder:0 },
    { id:'menu-2', name:'Bar menu',     description:'Drinks and bar snacks',scope:'local', assignedProfiles:['prof-2'],isDefault:false, isActive:true, sortOrder:1 },
    { id:'menu-3', name:'Lunch menu',   description:'Midday menu',          scope:'local', assignedProfiles:[], isDefault:false, isActive:true, sortOrder:2 },
  ] : []),
  activeMenuId: 'menu-1',
  setActiveMenuId: id => set({ activeMenuId: id }),
  addMenu: menu => {
    const newMenu = { id:`menu-${Date.now()}`, ...menu };
    set(s => ({ menus: [...s.menus, newMenu] }));
    sbUpsertMenu(newMenu);
  },
  updateMenu: (id, patch) => {
    set(s => ({ menus: s.menus.map(m => m.id===id ? { ...m, ...patch } : m) }));
    const updated = useStore.getState().menus.find(m => m.id===id);
    if (updated) sbUpsertMenu(updated);
  },
  removeMenu: id => {
    set(s => ({ menus: s.menus.filter(m => m.id!==id) }));
    sbDeleteMenu(id);
  },

  // ── Categories (hierarchical — parentId for subcategories) ───────────────────
  // accountingGroup → for financial reporting (P&L, tax)
  // statisticGroup  → for operational reporting (bestsellers, waste)
  menuCategories: _savedBO.menuCategories || (isMock ? [
    // ── The Anchor — category tree ──────────────────────────────────────────
    // Root categories
    { id:'cat-starters',  menuId:'menu-1', parentId:null, label:'Starters',  icon:'🥗', color:'#22c55e', accountingGroup:'Food',      sortOrder:0 },
    { id:'cat-mains',     menuId:'menu-1', parentId:null, label:'Mains',     icon:'🍖', color:'#e8a020', accountingGroup:'Food',      sortOrder:1 },
    { id:'cat-pizza',     menuId:'menu-1', parentId:null, label:'Pizza',     icon:'🍕', color:'#f97316', accountingGroup:'Food',      sortOrder:2 },
    { id:'cat-desserts',  menuId:'menu-1', parentId:null, label:'Desserts',  icon:'🎂', color:'#ec4899', accountingGroup:'Food',      sortOrder:3 },
    { id:'cat-drinks',    menuId:'menu-1', parentId:null, label:'Drinks',    icon:'🍸', color:'#a855f7', accountingGroup:'Beverages', sortOrder:4 },
    { id:'cat-hot',       menuId:'menu-1', parentId:null, label:'Hot drinks',icon:'☕', color:'#78716c', accountingGroup:'Beverages', sortOrder:5 },
    // Mains subcategories
    { id:'cat-grills',    menuId:'menu-1', parentId:'cat-mains',  label:'From the grill', icon:'🥩', color:'#ef4444', accountingGroup:'Food',      sortOrder:0 },
    { id:'cat-fish',      menuId:'menu-1', parentId:'cat-mains',  label:'Fish',           icon:'🐟', color:'#3b82f6', accountingGroup:'Food',      sortOrder:1 },
    { id:'cat-veggie',    menuId:'menu-1', parentId:'cat-mains',  label:'Vegetarian',     icon:'🌿', color:'#22c55e', accountingGroup:'Food',      sortOrder:2 },
    // Drinks subcategories
    { id:'cat-draught',   menuId:'menu-1', parentId:'cat-drinks', label:'Draught beer', icon:'🍺', color:'#e8a020', accountingGroup:'Beverages', sortOrder:0 },
    { id:'cat-wine',      menuId:'menu-1', parentId:'cat-drinks', label:'Wine',         icon:'🍷', color:'#8b1e3f', accountingGroup:'Beverages', sortOrder:1 },
    { id:'cat-softs',     menuId:'menu-1', parentId:'cat-drinks', label:'Soft drinks',  icon:'🥤', color:'#22d3ee', accountingGroup:'Beverages', sortOrder:2 },

    // ── Bar menu (menu-2) ───────────────────────────────────────────────────
    { id:'bcat-draught',  menuId:'menu-2', parentId:null, label:'Draught',      icon:'🍺', color:'#e8a020', accountingGroup:'Beverages', sortOrder:0 },
    { id:'bcat-wine',     menuId:'menu-2', parentId:null, label:'Wine',         icon:'🍷', color:'#8b1e3f', accountingGroup:'Beverages', sortOrder:1 },
    { id:'bcat-spirits',  menuId:'menu-2', parentId:null, label:'Spirits',      icon:'🥃', color:'#a855f7', accountingGroup:'Beverages', sortOrder:2 },
    { id:'bcat-softs',    menuId:'menu-2', parentId:null, label:'Soft drinks',  icon:'🥤', color:'#22d3ee', accountingGroup:'Beverages', sortOrder:3 },
    { id:'bcat-hot',      menuId:'menu-2', parentId:null, label:'Hot drinks',   icon:'☕', color:'#78716c', accountingGroup:'Beverages', sortOrder:4 },
    { id:'bcat-snacks',   menuId:'menu-2', parentId:null, label:'Bar snacks',   icon:'🍟', color:'#22c55e', accountingGroup:'Food',      sortOrder:5 },
  ] : []),
  addCategory: cat => {
    const newCat = { id:`cat-${Date.now()}`, ...cat };
    set(s => ({ menuCategories: [...s.menuCategories, newCat] }));
    sbUpsertCategory(newCat);
  },
  updateCategory: (id, patch) => {
    set(s => ({ menuCategories: s.menuCategories.map(c => c.id===id ? { ...c, ...patch } : c) }));
    const updated = useStore.getState().menuCategories.find(c => c.id===id);
    if (updated) sbUpsertCategory(updated);
  },
  removeCategory: id => {
    set(s => ({ menuCategories: s.menuCategories.filter(c => c.id!==id) }));
    sbDeleteCategory(id);
  },

  // ── Modifier library — create modifiers here, add to groups ─────────────────
  modifierLibrary: [
    { id:'ml-1',  name:'Rare',           price:0,    category:'Cooking',   allergens:[] },
    { id:'ml-2',  name:'Medium rare',    price:0,    category:'Cooking',   allergens:[] },
    { id:'ml-3',  name:'Medium',         price:0,    category:'Cooking',   allergens:[] },
    { id:'ml-4',  name:'Medium well',    price:0,    category:'Cooking',   allergens:[] },
    { id:'ml-5',  name:'Well done',      price:0,    category:'Cooking',   allergens:[] },
    { id:'ml-6',  name:'Peppercorn',     price:0,    category:'Sauce',     allergens:['milk'] },
    { id:'ml-7',  name:'Béarnaise',      price:0,    category:'Sauce',     allergens:['eggs','milk'] },
    { id:'ml-8',  name:'Chimichurri',    price:0,    category:'Sauce',     allergens:[] },
    { id:'ml-9',  name:'No sauce',       price:0,    category:'Sauce',     allergens:[] },
    { id:'ml-10', name:'Truffle oil',    price:3.50, category:'Extra',     allergens:[] },
    { id:'ml-11', name:'Extra pancetta', price:2.50, category:'Extra',     allergens:[] },
    { id:'ml-12', name:'Side salad',     price:0,    category:'Side swap', allergens:[] },
    { id:'ml-13', name:'Mac & cheese',   price:3.00, category:'Side swap', allergens:['gluten','milk','eggs'] },
    { id:'ml-14', name:'Chips',          price:0,    category:'Side swap', allergens:['gluten'] },
    { id:'ml-15', name:'Gluten-free base',price:2.00,category:'Pizza base', allergens:[] },
    { id:'ml-16', name:'Sourdough base', price:0,    category:'Pizza base', allergens:['gluten'] },
    { id:'ml-17', name:'With bread',     price:0,    category:'Bread',     allergens:['gluten'] },
    { id:'ml-18', name:'No bread',       price:0,    category:'Bread',     allergens:[] },
  ],
  addModifier: mod => set(s => ({ modifierLibrary: [...s.modifierLibrary, { id:`ml-${Date.now()}`, ...mod }] })),
  updateModifier: (id, patch) => set(s => ({ modifierLibrary: s.modifierLibrary.map(m => m.id===id ? {...m,...patch} : m) })),
  removeModifier: id => set(s => ({ modifierLibrary: s.modifierLibrary.filter(m => m.id!==id) })),

  // ── Modifier groups — reusable paid option groups ─────────────────────────
  // These change the price. Assigned to items in the Product Builder.
  modifierGroupDefs: isMock ? [
    // Options reference sub item IDs from MENU_ITEMS (type:'subitem')
    { id:'mgd-sides',        name:'Side choice',       min:1, max:1,
      options:[
        {id:'sub-chips',   name:'Chips',               price:0,   soldAlone:true,  soldAloneCat:'cat-starters'},
        {id:'sub-salad',   name:'Side salad',          price:0,   soldAlone:true,  soldAloneCat:'cat-starters'},
        {id:'sub-spfries', name:'Sweet potato fries',  price:1.5, soldAlone:true,  soldAloneCat:'cat-starters'},
        {id:'sub-mash',    name:'Creamy mash',         price:0,   soldAlone:false},
      ]},
    { id:'mgd-sauces',       name:'Sauce',              min:0, max:1,
      options:[
        {id:'sub-pepper',  name:'Peppercorn sauce',    price:0, subGroupId:'mgd-sauce-temp'},
        {id:'sub-bearn',   name:'Béarnaise',           price:0},
        {id:'sub-chimich', name:'Chimichurri',         price:0},
        {id:'sub-nosace',  name:'No sauce',            price:0},
      ]},
    { id:'mgd-sauce-temp',   name:'Sauce preference',   min:0, max:1,
      options:[
        {id:'sub-st-hot',  name:'Served hot',          price:0},
        {id:'sub-st-side', name:'On the side',         price:0},
      ]},
    { id:'mgd-pizza-extras', name:'Pizza extras',       min:0, max:5,
      options:[
        {id:'sub-extra-ch',  name:'Extra cheese',      price:1.5},
        {id:'sub-extra-pep', name:'Extra pepperoni',   price:1.5},
        {id:'sub-truffle',   name:'Truffle oil',       price:3.0},
      ]},
    { id:'mgd-milk',         name:'Milk choice',        min:1, max:1,
      options:[
        {id:'sub-whole',   name:'Whole milk',          price:0},
        {id:'sub-oat',     name:'Oat milk',            price:0.5},
        {id:'sub-almond',  name:'Almond milk',         price:0.5},
        {id:'sub-soy',     name:'Soy milk',            price:0.5},
      ]},
  ] : [],
  addModifierGroupDef: g => set(s => ({ modifierGroupDefs:[...s.modifierGroupDefs,{id:`mgd-${Date.now()}`,...g}] })),
  updateModifierGroupDef: (id,patch) => set(s => ({ modifierGroupDefs:s.modifierGroupDefs.map(g=>g.id===id?{...g,...patch}:g) })),
  updateModifierGroupOption: (groupId, optId, patch) => set(s => ({
    modifierGroupDefs: s.modifierGroupDefs.map(g =>
      g.id === groupId
        ? { ...g, options: (g.options||[]).map(o => o.id===optId ? { ...o, ...patch } : o) }
        : g
    )
  })),
  removeModifierGroupDef: id => set(s => ({ modifierGroupDefs:s.modifierGroupDefs.filter(g=>g.id!==id) })),
  reorderModifierGroupDefs: (fromIdx, toIdx) => set(s => {
    const arr = [...s.modifierGroupDefs];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    return { modifierGroupDefs: arr };
  }),

  // ── Instruction groups — preparation instructions (no price change) ────────
  // These DON'T change the price. e.g. "Cooking preference: Rare / Medium / Well done"
  instructionGroupDefs: [
    { id:'igd-cook-temp', name:'Cooking preference',
      options:['Rare','Medium rare','Medium','Medium well','Well done'] },
    { id:'igd-bread',     name:'Bread service',
      options:['With bread','No bread','Gluten-free bread (+£1)'] },
    { id:'igd-spice',     name:'Spice level',
      options:['Mild','Medium','Hot','Extra hot'] },
    { id:'igd-allergen',  name:'Allergy note',
      options:['Gluten-free option please','Dairy-free please','Nut allergy — check with kitchen','Speak to server'] },
  ],
  addInstructionGroupDef: g => set(s => ({ instructionGroupDefs:[...s.instructionGroupDefs,{id:`igd-${Date.now()}`,...g}] })),
  updateInstructionGroupDef: (id,patch) => set(s => ({ instructionGroupDefs:s.instructionGroupDefs.map(g=>g.id===id?{...g,...patch}:g) })),
  removeInstructionGroupDef: id => set(s => ({ instructionGroupDefs:s.instructionGroupDefs.filter(g=>g.id!==id) })),
  reorderInstructionGroupDefs: (fromIdx, toIdx) => set(s => {
    const arr = [...s.instructionGroupDefs];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    return { instructionGroupDefs: arr };
  }),

  // ── Menu items — full enhanced model ─────────────────────────────────────────
  //
  // Triple naming:  menuName | receiptName | kitchenName
  // Pricing:        per order type (dineIn / takeaway / collection / delivery)
  //                 null = use base price for that channel
  // Scope:          local | shared | global
  // Routing:        productionCentreId (null = inherit from category), course
  // Type:           simple | modifiers | variants | pizza | bundle
  // Visibility:     { pos, kiosk, online, onlineDelivery }
  //
  // Quick Screen — list of item IDs shown on the ⚡ Quick tab, ordered
  quickScreenIds: isMock ? QUICK_IDS : [],
  setQuickScreenIds: (ids) => set({ quickScreenIds: ids }),

  menuItems: (isMock ? MENU_ITEMS : []).map((item, idx) => ({
    ...item,
    sortOrder: item.sortOrder ?? idx,  // assign sequential sortOrder if not set
    menuName:    item.menuName    || item.name,
    receiptName: item.receiptName || item.name,
    kitchenName: item.kitchenName || item.name,
    scope: item.scope || 'local',
    // Per-order-type pricing (replaces per-menu pricing)
    pricing: item.pricing || {
      base:       item.price || 0,
      dineIn:     null,   // null = use base
      takeaway:   null,
      collection: null,
      delivery:   null,
    },
    productionCentreId: item.centreId || null,
    course: item.course || null,
    instructions: item.instructions || '',
    image: item.image || null,
    tags: item.tags || [],
    visibility: item.visibility || { pos:true, kiosk:true, online:true, onlineDelivery:true },
    sortOrder: item.sortOrder || 0,
  })),

  updateMenuItem: (id, patch) => {
    set(s => {
      let items = s.menuItems.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, ...patch };
        // Auto simple↔modifiable based on modifier groups
        if (patch.modifierGroups !== undefined && !['subitem','variants','combo','pizza'].includes(updated.type)) {
          updated.type = patch.modifierGroups?.length > 0 ? 'modifiable' : 'simple';
        }
        return updated;
      });

      // When setting parentId: auto-mark that parent as 'variants'
      if (patch.parentId) {
        items = items.map(item => {
          if (item.id !== patch.parentId || item.type === 'subitem') return item;
          return { ...item, type: 'variants' };
        });
      }
      // When clearing parentId: revert parent to 'simple' if it has no remaining children
      if ('parentId' in patch && !patch.parentId) {
        const oldParentId = s.menuItems.find(i => i.id === id)?.parentId;
        if (oldParentId) {
          const remainingChildren = items.filter(i => i.parentId === oldParentId && i.id !== id && !i.archived);
          if (remainingChildren.length === 0) {
            items = items.map(item => item.id === oldParentId ? { ...item, type: 'simple' } : item);
          }
        }
      }

      return { menuItems: items };
    });
    import('../lib/db.js').then(({ upsertMenuItem }) => upsertMenuItem({ id, ...patch }));
  },
  addMenuItem: item => {
    const base = item.price || item.basePrice || 0;
    const isSubitem = item.type === 'subitem';
    const newItem = {
      id:`m-${Date.now()}`, scope:'local', instructions:'', image:null, tags:[],
      // Subitems are hidden from POS/kiosk/online by default - they only appear in modifier groups
      visibility: isSubitem
        ? { pos:false, kiosk:false, online:false, onlineDelivery:false }
        : (item.visibility || { pos:true, kiosk:true, online:true, onlineDelivery:true }),
      sortOrder: useStore.getState().menuItems.length,
      ...item,
      menuName:    item.menuName    || item.name || 'New item',
      receiptName: item.receiptName || item.name || 'New item',
      kitchenName: item.kitchenName || item.name || 'New item',
      pricing: item.pricing || { base, dineIn:null, takeaway:null, collection:null, delivery:null },
    };
    set(s => ({ menuItems: [...s.menuItems, newItem] }));
    import('../lib/db.js').then(({ upsertMenuItem }) => upsertMenuItem(newItem));
    return newItem;
  },

  // Get effective price for an order type
  getItemPrice: (item, orderType = 'dineIn') => {
    const p = item?.pricing;
    if (!p) return item?.price || 0;
    const MAP = { 'dine-in':'dineIn', 'takeaway':'takeaway', 'collection':'collection', 'delivery':'delivery', 'dineIn':'dineIn' };
    const key = MAP[orderType] || 'dineIn';
    return (p[key] !== null && p[key] !== undefined) ? p[key] : (p.base || 0);
  },

  // Reorder items within a category
  reorderMenuItems: (catId, fromIdx, toIdx) => {
    set(s => {
      const catItems = s.menuItems.filter(i => i.cat === catId).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      const others   = s.menuItems.filter(i => i.cat !== catId);
      const moved    = [...catItems];
      const [item]   = moved.splice(fromIdx, 1);
      moved.splice(toIdx, 0, item);
      const reindexed = moved.map((it, idx) => ({ ...it, sortOrder: idx }));
      return { menuItems: [...others, ...reindexed] };
    });
  },

  // Reorder categories
  reorderCategories: (fromIdx, toIdx) => {
    set(s => {
      const cats = [...s.menuCategories];
      const [cat] = cats.splice(fromIdx, 1);
      cats.splice(toIdx, 0, cat);
      const reindexed = cats.map((c, idx) => ({ ...c, sortOrder: idx }));
      return { menuCategories: reindexed };
    });
  },
  duplicateMenuItem: id => {
    const source = useStore.getState().menuItems.find(i => i.id === id);
    if (!source) return;
    const dupe = { ...source, id:`m-${Date.now()}`, menuName:`${source.menuName} (copy)`, receiptName:`${source.receiptName} (copy)`, kitchenName:`${source.kitchenName} (copy)` };
    set(s => ({ menuItems: [...s.menuItems, dupe] }));
  },
  archiveMenuItem: id => set(s => ({
    menuItems: s.menuItems.map(item => item.id===id ? { ...item, archived:true } : item)
  })),

  // ── Editable floor plan ────────────────────────────────────────────────────
  // Tables state already exists in `tables` — floor plan builder just edits positions
  updateTableLayout: (id, patch) => {
    set(s => ({ tables: s.tables.map(t => t.id===id ? { ...t, ...patch } : t) }));
    import('../lib/db.js').then(({ upsertFloorTable }) => upsertFloorTable({ id, ...patch }));
  },
  addTableToLayout: (table) => {
    const newTable = { id:`t-${Date.now()}`, status:'available', session:null, ...table };
    set(s => ({ tables: [...s.tables, newTable] }));
    import('../lib/db.js').then(({ upsertFloorTable }) => upsertFloorTable(newTable));
  },
  removeTableFromLayout: (id) => set(s => ({
    tables: s.tables.filter(t => t.id!==id && t.parentId!==id)
  })),

  // ── Tables (source of truth for all orders) ──────────
  tables: isMock ? buildInitialTables() : [],

  // Helper to update a single table
  _updateTable: (id, patch) => set(s => ({ tables: s.tables.map(t => t.id===id ? { ...t, ...patch } : t) })),

  // Seat a table: create session, go to POS
  seatTable: (tableId, { covers, server }) => {
    const session = {
      id: `ORD-${++_orderNum}`,
      items: [], firedCourses: [],
      sentAt: null, covers, server,
      seatedAt: Date.now(), note: '', orderNote: '',
      subtotal: 0, total: 0,
    };
    get()._updateTable(tableId, { status:'open', session, reservation:null });
    set({ activeTableId:tableId, surface:'pos', orderType:'dine-in' });
  },

  // Seat a table AND pre-populate its session with walk-in items
  seatTableWithItems: (tableId, items, { covers, server }) => {
    const now = Date.now();
    const session = {
      id: `ORD-${++_orderNum}`,
      items: items.map(i => ({ ...i, status:'pending' })),
      firedCourses: [], sentAt: null, covers, server,
      seatedAt: now, note: '', orderNote: '',
      subtotal: items.reduce((s,i)=>s+i.price*i.qty, 0),
      total: items.reduce((s,i)=>s+i.price*i.qty, 0) * 1.125,
    };
    get()._updateTable(tableId, { status:'open', session, reservation:null });
    set({ activeTableId:tableId, surface:'pos', orderType:'dine-in', walkInOrder:null, customer:null });
    get().showToast(`Items moved to ${get().tables.find(t=>t.id===tableId)?.label}`, 'success');
  },

  // Merge walk-in items into an already-occupied table
  mergeItemsToTable: (tableId, newItems) => {
    set(s => ({
      tables: s.tables.map(t => {
        if (t.id !== tableId || !t.session) return t;
        const items = [...t.session.items, ...newItems.map(i=>({...i, status:'pending'}))];
        const subtotal = items.reduce((s,i)=>s+i.price*i.qty, 0);
        return { ...t, session: { ...t.session, items, subtotal, total: subtotal*1.125 } };
      }),
      walkInOrder: null, customer: null,
    }));
    set({ activeTableId:tableId, surface:'pos', orderType:'dine-in' });
    get().showToast(`Items merged into ${get().tables.find(t=>t.id===tableId)?.label}`, 'success');
  },

  // Split a table — create a child table (T1.2) with the given items
  splitTableCheck: (parentTableId, splitItems, staffName) => {
    const parent = get().tables.find(t => t.id === parentTableId);
    if (!parent) return;

    // Determine child label: T1 → T1.2, T1.2 → T1.3, etc.
    const existingChildren = get().tables.filter(t => t.parentId === parentTableId);
    const checkNum = existingChildren.length + 2;
    const childLabel = `${parent.label}.${checkNum}`;
    const childId = `${parentTableId}-${checkNum}`;

    const childSession = {
      id: `ORD-${++_orderNum}`,
      items: splitItems.map(i => ({...i, status:'pending'})),
      firedCourses: [], sentAt: null,
      covers: parent.session?.covers || 2,
      server: staffName || parent.session?.server || 'Server',
      seatedAt: Date.now(), note: '', orderNote: '',
      subtotal: splitItems.reduce((s,i)=>s+i.price*i.qty, 0),
      total: splitItems.reduce((s,i)=>s+i.price*i.qty, 0) * 1.125,
    };

    // Remove split items from parent
    const parentItems = (parent.session?.items || []).filter(
      pi => !splitItems.some(si => si.uid === pi.uid)
    );
    const parentSub = parentItems.reduce((s,i)=>s+i.price*i.qty, 0);

    // Child table — same position as parent, flagged virtual
    const childTable = {
      ...parent,
      id: childId,
      label: childLabel,
      parentId: parentTableId,
      status: 'open',
      session: childSession,
      reservation: null,
    };

    set(s => ({
      tables: [
        ...s.tables.map(t => {
          if (t.id !== parentTableId) return t;
          const session = { ...t.session, items: parentItems, subtotal: parentSub, total: parentSub*1.125 };
          return { ...t, session, childIds: [...(t.childIds||[]), childId] };
        }),
        childTable,
      ],
      walkInOrder: null, customer: null,
      activeTableId: childId, surface: 'pos', orderType: 'dine-in',
    }));
    get().showToast(`Check 2 created — ${childLabel}`, 'success');
  },

  // Open an already-seated table (go to its POS)
  openTableInPOS: (tableId) => {
    set({ activeTableId:tableId, surface:'pos', orderType:'dine-in' });
  },

  // Close / clear a table after payment
  clearTable: (tableId, paymentInfo = {}) => {
    get().recordClosedCheck(tableId, paymentInfo);
    const table = get().tables.find(t => t.id === tableId);

    if (table?.parentId) {
      // Child table (T1.2) — remove it, update parent childIds
      set(s => {
        const remaining = s.tables.filter(t => t.id !== tableId);
        const parent = remaining.find(t => t.id === table.parentId);
        const newChildIds = (parent?.childIds || []).filter(id => id !== tableId);
        // If parent has no more children and no active session, set to available
        const parentHasSession = parent?.session?.items?.some(i => !i.voided);
        return {
          tables: remaining.map(t => {
            if (t.id !== table.parentId) return t;
            if (newChildIds.length === 0 && !parentHasSession) {
              return { ...t, status:'available', session:null, childIds:[] };
            }
            return { ...t, childIds: newChildIds };
          }),
        };
      });
    } else {
      // Parent table — clear it and all its children
      const childIds = table?.childIds || [];
      set(s => ({
        tables: s.tables
          .filter(t => !childIds.includes(t.id))
          .map(t => t.id === tableId ? { ...t, status:'available', session:null, childIds:[] } : t),
      }));
    }
    set(s => ({ activeTableId: s.activeTableId === tableId ? null : s.activeTableId }));
  },

  // Add/remove reservation
  setReservation: (tableId, res) => {
    get()._updateTable(tableId, { status: res?'reserved':'available', reservation: res||null });
  },

  // Update covers count mid-service
  updateCovers: (tableId, covers) => {
    set(s => ({
      tables: s.tables.map(t =>
        t.id === tableId && t.session
          ? { ...t, session: { ...t.session, covers } }
          : t
      ),
    }));
  },

  // Transfer a table's session to another table
  transferTable: (fromId, toId) => {
    const { tables } = get();
    const from = tables.find(t => t.id === fromId);
    const to   = tables.find(t => t.id === toId);
    if (!from?.session || !to) return;
    set(s => ({
      tables: s.tables.map(t => {
        if (t.id === fromId) return { ...t, status:'available', session:null, childIds:[] };
        if (t.id === toId)   return { ...t, status:'occupied', session:{ ...from.session }, reservation:null };
        return t;
      }),
      activeTableId: toId,
    }));
    get().showToast(`Transferred to ${to.label}`, 'success');
  },

  // ── Active table context ───────────────────
  activeTableId: null,
  setActiveTableId: id => set({ activeTableId:id }),

  getActiveTable: () => get().tables.find(t => t.id === get().activeTableId) || null,

  // ── Add item to active table's session ────
  addItem: (item, mods=[], pizzaConfig=null, opts={}) => {
    const { activeTableId, staff, tables } = get();
    const qty = opts.qty || 1;
    const price = opts.linePrice != null ? opts.linePrice/qty : item.price;
    const newItem = {
      uid: uid(), itemId: item.id,
      name: opts.displayName || item.name,
      price, qty, mods: mods||[], notes: opts.notes||'',
      pizzaConfig, allergens: item.allergens||[],
      centreId: item.centreId,
      seat: 'shared',
      course: CAT_COURSE[item.cat] ?? 1,
      fired: CAT_COURSE[item.cat] === 0,
      status: 'pending',
    };

    // Decrement daily count if set
    if (item.id) get().decrementDailyCount(item.id);

    if (activeTableId) {
      // Add to the table's session
      set(s => ({
        tables: s.tables.map(t => {
          if (t.id !== activeTableId) return t;
          const session = t.session || { id:`ORD-${++_orderNum}`, items:[], firedCourses:[], sentAt:null, covers:2, server:staff?.name||'Staff', seatedAt:Date.now(), note:'', orderNote:'', subtotal:0, total:0 };
          const items = [...session.items, newItem];
          const subtotal = items.reduce((s,i)=>s+i.price*i.qty, 0);
          return { ...t, status:t.status==='available'?'open':t.status, session:{ ...session, items, subtotal, total:subtotal*1.125 } };
        }),
      }));
    } else {
      // Walk-in / takeaway: use standalone order
      set(s => {
        const items = [...(s.walkInOrder?.items||[]), newItem];
        const subtotal = items.reduce((a,i)=>a+i.price*i.qty, 0);
        return { walkInOrder:{ ...(s.walkInOrder||{id:`ORD-${++_orderNum}`}), items, subtotal, total:subtotal } };
      });
    }
  },

  addCustomItem: (name, price, notes) => {
    const { activeTableId, staff } = get();
    const newItem = { uid:uid(), itemId:'custom', name, price:parseFloat(price)||0, qty:1, mods:[], notes, allergens:[], seat:'shared', course:1, fired:false, status:'pending' };
    if (activeTableId) {
      set(s=>({ tables:s.tables.map(t=>{
        if (t.id!==activeTableId) return t;
        const session = t.session||{ id:`ORD-${++_orderNum}`, items:[], firedCourses:[], sentAt:null, covers:2, server:staff?.name||'Staff', seatedAt:Date.now(), note:'', orderNote:'', subtotal:0, total:0 };
        const items=[...session.items, newItem];
        const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);
        return {...t, session:{...session, items, subtotal, total:subtotal*1.125}};
      }) }));
    } else {
      set(s=>{const items=[...(s.walkInOrder?.items||[]),newItem];return{walkInOrder:{...(s.walkInOrder||{id:`ORD-${++_orderNum}`}),items}};});
    }
  },

  removeItem: (itemUid) => {
    const { activeTableId } = get();
    if (activeTableId) {
      set(s=>({ tables:s.tables.map(t=>{
        if(t.id!==activeTableId||!t.session)return t;
        const items=t.session.items.filter(i=>i.uid!==itemUid);
        const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);
        return {...t, session:{...t.session, items, subtotal, total:subtotal*1.125}};
      })}) );
    } else {
      set(s=>{const items=(s.walkInOrder?.items||[]).filter(i=>i.uid!==itemUid);return{walkInOrder:{...s.walkInOrder,items}};});
    }
  },

  updateItemQty: (itemUid, delta) => {
    const { activeTableId } = get();
    const applyQty = items => {
      const item = items.find(i => i.uid === itemUid);
      if (!item) return items;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        // Pending items can be removed by dragging to 0; committed items must be voided
        if (item.status === 'sent' || item.voided) return items;
        return items.filter(i => i.uid !== itemUid);
      }
      return items.map(i => i.uid === itemUid ? { ...i, qty: newQty } : i);
    };
    if (activeTableId) {
      set(s=>({ tables:s.tables.map(t=>{
        if(t.id!==activeTableId||!t.session)return t;
        const items=applyQty(t.session.items);
        const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);
        return {...t,session:{...t.session,items,subtotal,total:subtotal*1.125}};
      })}) );
    } else {
      set(s=>{const items=applyQty(s.walkInOrder?.items||[]);return{walkInOrder:{...s.walkInOrder,items}};});
    }
  },

  updateItemNote: (itemUid, note) => {
    const { activeTableId } = get();
    const apply = items => items.map(i=>i.uid===itemUid?{...i,notes:note}:i);
    if (activeTableId) {
      set(s=>({ tables:s.tables.map(t=>{
        if(t.id!==activeTableId||!t.session)return t;
        return {...t,session:{...t.session,items:apply(t.session.items)}};
      })}) );
    } else {
      set(s=>({walkInOrder:{...s.walkInOrder,items:apply(s.walkInOrder?.items||[])}}));
    }
  },

  setOrderNote: (note) => {
    const { activeTableId } = get();
    if (activeTableId) {
      set(s=>({ tables:s.tables.map(t=>t.id===activeTableId&&t.session?{...t,session:{...t.session,orderNote:note}}:t) }));
    } else {
      set(s=>({ walkInOrder:{...s.walkInOrder,orderNote:note} }));
    }
  },

  updateItemSeat: (itemUid, seat) => {
    const { activeTableId } = get();
    if (activeTableId) {
      set(s=>({ tables:s.tables.map(t=>{
        if(t.id!==activeTableId||!t.session)return t;
        return {...t,session:{...t.session,items:t.session.items.map(i=>i.uid===itemUid?{...i,seat}:i)}};
      })}) );
    }
  },

  updateItemCourse: (itemUid, course) => {
    const { activeTableId } = get();
    if (activeTableId) {
      set(s=>({ tables:s.tables.map(t=>{
        if(t.id!==activeTableId||!t.session)return t;
        return {...t,session:{...t.session,items:t.session.items.map(i=>i.uid===itemUid?{...i,course}:i)}};
      })}) );
    }
  },

  // ── SEND TO KITCHEN ────────────────────────
  // Fires courses 0+1, marks table occupied, updates totals
  sendToKitchen: () => {
    const { activeTableId, staff, orderType, customer, addToQueue, tables } = get();

    const createKdsTickets = (items, tableLabel, serverName, covers) => {
      const byCenter = {};
      items.filter(i => [0,1].includes(i.course) && !i.voided && i.status==='pending').forEach(item => {
        const cid = item.centreId || 'pc1';
        if (!byCenter[cid]) byCenter[cid] = [];
        byCenter[cid].push(item);
      });
      return Object.entries(byCenter).map(([centreId, centreItems]) => ({
        id: `kds-${Date.now()}-${centreId}-${Math.random().toString(36).slice(2,6)}`,
        table: tableLabel, server: serverName, covers, centreId,
        sentAt: Date.now(), minutes: 0,
        items: centreItems.map(i => ({
          qty: i.qty, name: i.kitchenName || i.name,
          mods: [
            ...(i.mods?.map(m => m.groupLabel ? `${m.groupLabel}: ${m.label}` : m.label).filter(Boolean) || []),
            ...(i.allergens?.length ? [`⚠ ${i.allergens.map(a=>a.toUpperCase()).join(' · ')}`] : []),
            ...(i.notes ? [`📝 ${i.notes}`] : []),
          ].join(' · '),
          course: i.course, centreId, uid: i.uid,
        })),
      }));
    };

    if (activeTableId) {
      const table = tables.find(t => t.id === activeTableId);
      const session = table?.session;
      const pendingItems = session?.items?.filter(i => i.status === 'pending' && !i.voided) || [];
      const newTickets = createKdsTickets(pendingItems, table?.label || activeTableId, staff?.name || 'Server', session?.covers || 2);
      // Route print jobs for each ticket (fires to mapped printer per centre)
      const CENTRE_PRINTERS = { pc1:'Hot kitchen', pc2:'Cold section', pc3:'Pizza oven', pc4:'Bar', pc5:'Expo / pass' };
      newTickets.forEach(t => {
        if (t.items.length) get().routePrintJob({ centreId:t.centreId, printerName:CENTRE_PRINTERS[t.centreId]||'Kitchen', tableLabel:t.table, items:t.items, type:'kitchen' });
      });
      set(s=>({
        tables: s.tables.map(t=>{
          if(t.id!==activeTableId||!t.session)return t;
          const fired=[0,1];
          const firedCourses=[...new Set([...(t.session.firedCourses||[]),...fired])];
          const items=t.session.items.map(i=>firedCourses.includes(i.course)?{...i,fired:true,status:'sent'}:i);
          const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);
          return {...t, status:'occupied', session:{...t.session, items, firedCourses, sentAt:t.session.sentAt||Date.now(), server:staff?.name||t.session.server, subtotal, total:subtotal*1.125 }};
        }),
        kdsTickets: [...s.kdsTickets, ...newTickets],
      }));
      import('../lib/db.js').then(({ insertKDSTicket }) => newTickets.forEach(t => insertKDSTicket(t)));
      get().showToast('Sent to kitchen','success');
    } else {
      const order = get().walkInOrder;
      if (!order?.items?.length) return;
      const pendingItems = order.items.filter(i => i.status === 'pending' && !i.voided);
      const label = customer?.name ? `${orderType.charAt(0).toUpperCase()+orderType.slice(1)} · ${customer.name}` : orderType;
      const newTickets = createKdsTickets(pendingItems, label, staff?.name || 'Server', 1);
      // Always add walk-in orders to queue so they appear in Orders Hub
      const ref = order.ref || `#${++_orderNum}`;
      const queueEntry = {
        ref, type: orderType,
        customer: customer ? { ...customer } : { name: customer?.name || label },
        items: order.items.filter(i => !i.voided),
        total: order.items.reduce((s, i) => s + i.price * i.qty, 0),
        status: 'received', createdAt: order.createdAt || Date.now(), sentAt: Date.now(),
        collectionTime: customer?.collectionTime, isASAP: customer?.isASAP, staff: staff?.name,
      };
      const alreadyQueued = get().orderQueue.find(o => o.ref === ref);
      if (alreadyQueued) {
        set(s => ({ orderQueue: s.orderQueue.map(o => o.ref === ref ? { ...o, ...queueEntry } : o) }));
      } else {
        addToQueue(queueEntry);
      }
      set(s => ({
        walkInOrder: { ...(s.walkInOrder||{}), ref, sentAt: Date.now(), items: (s.walkInOrder?.items||[]).map(i => [0,1].includes(i.course) ? {...i, fired:true, status:'sent'} : i) },
        kdsTickets: [...s.kdsTickets, ...newTickets],
      }));
      import('../lib/db.js').then(({ insertKDSTicket }) => newTickets.forEach(t => insertKDSTicket(t)));
      get().showToast(customer?.name ? `Order sent — ${customer.name}` : 'Sent to kitchen', 'success');
    }
  },

  fireCourse: (courseNum) => {
    const { activeTableId, tables, staff } = get();
    if (activeTableId) {
      const table = tables.find(t => t.id === activeTableId);
      const session = table?.session;
      // Items in this course that haven't been sent yet
      const courseItems = session?.items?.filter(i => i.course === courseNum && i.status === 'pending' && !i.voided) || [];

      // Group by production centre and create KDS tickets
      const byCenter = {};
      courseItems.forEach(item => {
        const cid = item.centreId || 'pc1';
        if (!byCenter[cid]) byCenter[cid] = [];
        byCenter[cid].push(item);
      });
      const newTickets = Object.entries(byCenter).map(([centreId, centreItems]) => ({
        id: `kds-${Date.now()}-${centreId}-c${courseNum}`,
        table: table?.label || activeTableId,
        server: staff?.name || session?.server || 'Server',
        covers: session?.covers || 2,
        centreId, sentAt: Date.now(), minutes: 0,
        items: centreItems.map(i => ({
          qty: i.qty, name: i.kitchenName || i.name,
          mods: [
            ...(i.mods?.map(m => m.groupLabel ? `${m.groupLabel}: ${m.label}` : m.label).filter(Boolean) || []),
            ...(i.allergens?.length ? [`⚠ ${i.allergens.map(a=>a.toUpperCase()).join(' · ')}`] : []),
            ...(i.notes ? [`📝 ${i.notes}`] : []),
          ].join(' · '),
          course: i.course, centreId, uid: i.uid,
        })),
      }));

      set(s=>({
        tables: s.tables.map(t => {
          if(t.id!==activeTableId||!t.session) return t;
          const firedCourses=[...new Set([...(t.session.firedCourses||[]),courseNum])];
          const items=t.session.items.map(i=>i.course===courseNum?{...i,fired:true,status:'sent'}:i);
          return {...t,session:{...t.session,items,firedCourses}};
        }),
        kdsTickets: [...s.kdsTickets, ...newTickets],
      }));
      get().showToast(`Course ${courseNum} fired to kitchen`,'success');
    }
  },

  // ── Walk-in order (non-table) ──────────────
  walkInOrder: null,
  clearWalkIn: () => set({ walkInOrder:null, customer:null, orderType:'dine-in' }),

  // Get current items/totals for POS (works for both table and walk-in)
  getPOSItems: () => {
    const { activeTableId, tables, walkInOrder } = get();
    if (activeTableId) {
      return tables.find(t=>t.id===activeTableId)?.session?.items || [];
    }
    return walkInOrder?.items || [];
  },

  getPOSTotals: () => {
    const { activeTableId, tables, walkInOrder, orderType } = get();
    let items, checkDiscounts;
    if (activeTableId) {
      const session = tables.find(t=>t.id===activeTableId)?.session;
      items = session?.items || [];
      checkDiscounts = session?.discounts || [];
    } else {
      items = walkInOrder?.items || [];
      checkDiscounts = walkInOrder?.discounts || [];
    }
    // Subtotal — voided items excluded, item discounts applied
    const subtotal = items.filter(i=>!i.voided).reduce((s,i)=>{
      const base = i.price * i.qty;
      if (!i.discount) return s + base;
      return s + (i.discount.type==='percent' ? base*(1-i.discount.value/100) : Math.max(0,base-i.discount.value));
    }, 0);
    // Check-level discounts
    const checkDiscount = checkDiscounts.reduce((s,d) => s + (d.type==='percent'?subtotal*d.value/100:d.value), 0);
    const discountedSub = Math.max(0, subtotal - checkDiscount);
    const loc = get().locations?.find(l => l.id === get().currentLocationId);
    const serviceRate = (loc?.serviceCharge ?? 12.5) / 100;
    const service = orderType==='dine-in' ? discountedSub * serviceRate : 0;
    return {
      subtotal, checkDiscount, discountedSub, service,
      total: discountedSub+service,
      itemCount: items.filter(i=>!i.voided).reduce((s,i)=>s+i.qty,0),
    };
  },

  getPOSOrderNote: () => {
    const { activeTableId, tables, walkInOrder } = get();
    if (activeTableId) return tables.find(t=>t.id===activeTableId)?.session?.orderNote || '';
    return walkInOrder?.orderNote || '';
  },

  // ── Allergens ─────────────────────────────
  allergens: [],
  toggleAllergen: id => set(s=>({ allergens:s.allergens.includes(id)?s.allergens.filter(a=>a!==id):[...s.allergens,id] })),
  clearAllergens: () => set({ allergens:[] }),

  // ── Order type / customer ─────────────────
  orderType: 'dine-in',
  setOrderType: t => set({ orderType:t }),
  customer: null,
  setCustomer: c => set({ customer:c }),
  clearCustomer: () => set({ customer:null }),
  customerHistory: [
    { id:'c1', name:'James Wilson',   phone:'07700 900123', email:'james@email.com',  visits:8,  lastOrder:'2 days ago' },
    { id:'c2', name:'Sophie Chen',    phone:'07700 900456', email:'sophie@email.com', visits:14, lastOrder:'1 week ago' },
    { id:'c3', name:'Marcus Johnson', phone:'07700 900789', email:'',                 visits:3,  lastOrder:'3 weeks ago' },
  ],
  searchCustomers: q => { if(!q||q.length<3)return[]; const l=q.toLowerCase(); return get().customerHistory.filter(c=>c.name.toLowerCase().includes(l)||c.phone.replace(/\s/g,'').includes(q.replace(/\s/g,''))); },
  addToHistory: c => set(s=>({ customerHistory:[{...c,id:`c${Date.now()}`,visits:1,lastOrder:'Just now'},...s.customerHistory.filter(x=>x.phone!==c.phone)] })),

  // ── Collection queue ──────────────────────
  orderQueue: [],
  addToQueue: o => set(s => ({ orderQueue: [o, ...s.orderQueue] })),
  updateQueueStatus: (ref, status) => set(s => ({ orderQueue: s.orderQueue.map(o => o.ref===ref ? {...o, status} : o) })),
  updateQueueItem: (ref, patch) => set(s => ({ orderQueue: s.orderQueue.map(o => o.ref===ref ? {...o,...patch} : o) })),
  removeFromQueue: ref => set(s => ({ orderQueue: s.orderQueue.filter(o => o.ref!==ref) })),

  // ── 86 ────────────────────────────────────
  eightySixIds: [],
  toggle86: id => {
    const is86 = get().eightySixIds.includes(id);
    set(s => ({ eightySixIds: is86 ? s.eightySixIds.filter(x=>x!==id) : [...s.eightySixIds, id] }));
    // Write to Supabase (no-op in mock mode)
    import('../lib/db.js').then(({ toggle86DB }) => toggle86DB(id, is86));
  },

  // ── Daily counts / par levels ──────────────────────────────────────────────
  dailyCounts: {},
  setDailyCount: (itemId, count) => {
    const n = parseInt(count);
    if (!n || n <= 0) return;
    set(s => {
      // Un-86 if previously auto-86'd from count
      const was86 = s.eightySixIds.includes(itemId);
      return {
        dailyCounts: { ...s.dailyCounts, [itemId]: { par: n, remaining: n } },
        eightySixIds: was86 ? s.eightySixIds.filter(x => x !== itemId) : s.eightySixIds,
      };
    });
  },
  clearDailyCount: (itemId) => {
    set(s => ({
      dailyCounts: { ...s.dailyCounts, [itemId]: undefined },
    }));
  },
  decrementDailyCount: (itemId) => {
    set(s => {
      const current = s.dailyCounts[itemId];
      if (!current || current.remaining <= 0) return s;
      const remaining = current.remaining - 1;
      const newCounts = { ...s.dailyCounts, [itemId]: { ...current, remaining } };
      if (remaining <= 0) {
        get().showToast(`Sold out — auto 86'd`, 'warning');
        return { dailyCounts: newCounts, eightySixIds: [...s.eightySixIds, itemId] };
      }
      return { dailyCounts: newCounts };
    });
  },

  // ── Bar tabs ──────────────────────────────
  tabs: [],
  activeTabId: null,
  openTab: ({ name, seatId=null, tableId=null, preAuth=false, preAuthAmount=50, note='' }) => {
    const tab = { id:`tab-${Date.now()}`, ref:`TAB-${_tabNum++}`, name:name.trim(), seatId, tableId, openedBy:get().staff?.name||'Staff', openedAt:Date.now(), status:'open', preAuth, preAuthAmount, rounds:[], note, total:0 };
    set(s=>({ tabs:[tab,...s.tabs], activeTabId:tab.id }));
    return tab;
  },
  setActiveTab: id => set({ activeTabId:id }),
  addRoundToTab: (tabId, items, note='') => {
    const round = { id:uid(), sentAt:Date.now(), items:items.map(i=>({...i})), subtotal:items.reduce((s,i)=>s+i.price*i.qty,0), note };
    set(s=>({ tabs:s.tabs.map(t=>{ if(t.id!==tabId)return t; const rounds=[...t.rounds,round]; return{...t,rounds,status:'running',total:rounds.reduce((s,r)=>s+r.subtotal,0)}; }) }));
    return round;
  },
  updateTabNote: (tabId,note) => set(s=>({ tabs:s.tabs.map(t=>t.id===tabId?{...t,note}:t) })),
  updateTabStatus: (tabId,status) => set(s=>({ tabs:s.tabs.map(t=>t.id===tabId?{...t,status}:t) })),
  closeTab: tabId => set(s=>({ tabs:s.tabs.map(t=>t.id===tabId?{...t,status:'closed'}:t), activeTabId:s.activeTabId===tabId?null:s.activeTabId })),
  voidTabRound: (tabId,roundId) => set(s=>({ tabs:s.tabs.map(t=>{ if(t.id!==tabId)return t; const rounds=t.rounds.filter(r=>r.id!==roundId); return{...t,rounds,total:rounds.reduce((s,r)=>s+r.subtotal,0)}; }) })),
  seedTabs: () => set({ tabs:[
    { id:'t-demo1', ref:'TAB-001', name:'Maria G.', seatId:'B1', tableId:null, openedBy:'Maria', openedAt:Date.now()-22*60000, status:'running', preAuth:false, preAuthAmount:0, note:'Birthday drinks', total:29.8,
      rounds:[
        { id:'r1', sentAt:Date.now()-20*60000, subtotal:17.4, note:'', items:[
          {uid:'ri1',name:'Lager — Pint',price:5.8,qty:2,mods:[],notes:''},
          {uid:'ri2',name:'Sparkling water',price:2.8,qty:1,mods:[],notes:'No ice'},
        ]},
        { id:'r2', sentAt:Date.now()-8*60000, subtotal:12.4, note:'', items:[
          {uid:'ri3',name:'Stout — Pint',price:6.2,qty:1,mods:[],notes:''},
          {uid:'ri4',name:'House white 250ml',price:8.5,qty:1,mods:[],notes:'Extra cold'},
        ]},
      ]},
    { id:'t-demo2', ref:'TAB-002', name:'Table 4 bar', seatId:null, tableId:'t4', openedBy:'Tom', openedAt:Date.now()-45*60000, status:'running', preAuth:false, preAuthAmount:0, note:'', total:35.2,
      rounds:[
        { id:'r3', sentAt:Date.now()-40*60000, subtotal:20.7, note:'', items:[
          {uid:'ri5',name:'Lager — Pint',price:5.8,qty:2,mods:[],notes:''},
          {uid:'ri6',name:'House red 175ml',price:6.5,qty:1,mods:[],notes:''},
          {uid:'ri7',name:'Coke',price:3.5,qty:1,mods:[],notes:''},
        ]},
        { id:'r4', sentAt:Date.now()-15*60000, subtotal:14.5, note:'', items:[
          {uid:'ri8',name:'Stout — Pint',price:6.2,qty:1,mods:[],notes:''},
          {uid:'ri9',name:'House white 250ml',price:8.5,qty:1,mods:[],notes:''},
        ]},
      ]},
  ] }),

  // ── Closed check history ──────────────────
  closedChecks: isMock ? [
    { id:'cc1', ref:'#1042', tableId:'t1', tableLabel:'T1', server:'Sarah', covers:2, orderType:'dine-in', customer:null,
      items:[{uid:'cc1i1',name:'Carbonara pasta',price:14.5,qty:2,mods:[],notes:'',allergens:[]},{uid:'cc1i2',name:'House red wine — 250ml',price:10.5,qty:2,mods:[],notes:'',allergens:[]}],
      discounts:[], subtotal:50, service:6.25, tip:7.50, total:63.75, method:'card',
      closedAt:Date.now()-25*60000, status:'paid', refunds:[] },
    { id:'cc2', ref:'#1041', tableId:'t3', tableLabel:'T3', server:'Tom', covers:4, orderType:'dine-in', customer:null,
      items:[{uid:'cc2i1',name:'Ribeye steak 8oz',price:32,qty:2,mods:[{label:'Cooking: Medium rare',price:0}],notes:'',allergens:[]},{uid:'cc2i2',name:'Chicken supreme',price:22,qty:1,mods:[],notes:'',allergens:[]},{uid:'cc2i3',name:'Tiramisu',price:8.5,qty:2,mods:[],notes:'',allergens:[]}],
      discounts:[], subtotal:103, service:12.88, tip:15, total:130.88, method:'card',
      closedAt:Date.now()-62*60000, status:'partial_refund',
      refunds:[{id:'r1',timestamp:Date.now()-30*60000,manager:'Alex',managerId:'s1',reason:'Quality issue',isFullRefund:false,items:[{uid:'cc2i3',name:'Tiramisu',price:8.5,qty:2,refundQty:1}],amount:8.5}] },
    { id:'cc3', ref:'#1040', tableId:null, tableLabel:null, server:'Alex', covers:1, orderType:'collection',
      customer:{name:'James Wilson',phone:'07700 900123',collectionTime:'6:30 PM'},
      items:[{uid:'cc3i1',name:'Pepperoni pizza',price:14,qty:1,mods:[],notes:'Extra cheese',allergens:[]},{uid:'cc3i2',name:'Garlic bread',price:4.5,qty:1,mods:[],notes:'',allergens:[]}],
      discounts:[], subtotal:18.5, service:0, tip:0, total:18.5, method:'card',
      closedAt:Date.now()-90*60000, status:'paid', refunds:[] },
  ] : [],

  recordClosedCheck: (tableId, paymentInfo = {}) => {
    const { tables, staff } = get();
    const table = tables.find(t => t.id === tableId);
    const session = table?.session;
    if (!session) return;

    const ref = `#${Math.floor(1000 + Math.random() * 9000)}`;
    const record = {
      id: `chk-${Date.now()}`,
      ref,
      tableId,
      tableLabel: table.label,
      server:     session.server || staff?.name || 'Staff',
      covers:     session.covers || 1,
      orderType:  'dine-in',
      items:      session.items.filter(i => !i.voided).map(i => ({ ...i })),
      discounts:  session.discounts || [],
      subtotal:   session.subtotal || 0,
      service:    (session.subtotal || 0) * 0.125,
      tip:        paymentInfo.tip || 0,
      total:      paymentInfo.grand || session.total || 0,
      method:     paymentInfo.method || 'card',
      closedAt:   Date.now(),
      status:     'paid',   // paid | partial_refund | refunded
      refunds:    [],
    };
    set(s => ({ closedChecks: [record, ...s.closedChecks] }));
    import('../lib/db.js').then(({ insertClosedCheck }) => insertClosedCheck(record));
    return record;
  },

  recordWalkInClosed: (walkInOrder, orderType, customer, paymentInfo = {}) => {
    if (!walkInOrder?.items?.length) return;
    const { staff } = get();
    const subtotal = walkInOrder.items.reduce((s, i) => s + i.price * i.qty, 0);
    const record = {
      id: `chk-${Date.now()}`,
      ref: `#${Math.floor(1000 + Math.random() * 9000)}`,
      tableId: null,
      tableLabel: null,
      server: staff?.name || 'Staff',
      covers: 1,
      orderType,
      customer,
      items: walkInOrder.items.filter(i => !i.voided).map(i => ({ ...i })),
      discounts: walkInOrder.discounts || [],
      subtotal,
      service: 0,
      tip: paymentInfo.tip || 0,
      total: paymentInfo.grand || subtotal,
      method: paymentInfo.method || 'card',
      closedAt: Date.now(),
      status: 'paid',
      refunds: [],
    };
    set(s => ({ closedChecks: [record, ...s.closedChecks] }));
    import('../lib/db.js').then(({ insertClosedCheck }) => insertClosedCheck(record));
    return record;
  },

  refundCheck: (checkId, { items: refundItems, isFullRefund, manager, reason, tenderMethod, amount }) => {
    set(s => ({
      closedChecks: s.closedChecks.map(chk => {
        if (chk.id !== checkId) return chk;
        const refund = {
          id: `ref-${Date.now()}`,
          timestamp: Date.now(),
          manager: manager.name,
          managerId: manager.id,
          reason,
          isFullRefund,
          tenderMethod: tenderMethod || 'card',
          items: refundItems,
          amount: amount || refundItems.reduce((s, ri) => s + ri.price * ri.refundQty, 0),
        };
        const totalRefunded = [...chk.refunds, refund].reduce((s, r) => s + r.amount, 0);
        const status = totalRefunded >= chk.subtotal ? 'refunded' : 'partial_refund';
        return { ...chk, refunds: [...chk.refunds, refund], status };
      }),
    }));
    get().showToast(`Refund of £${amount?.toFixed(2)} processed via ${tenderMethod}`, 'success');
  },

  // ── Void log ──────────────────────────────
  voidLog: [],

  voidItem: (tableId, itemUid, { manager, reason }) => {
    const { tables, voidLog, showToast } = get();
    const table = tables.find(t => t.id === tableId);
    const item  = table?.session?.items?.find(i => i.uid === itemUid);
    if (!item) return;

    // Mark item as voided (keep visible with strikethrough)
    set(s => ({
      tables: s.tables.map(t => {
        if (t.id !== tableId || !t.session) return t;
        const items = t.session.items.map(i => i.uid === itemUid ? { ...i, status:'voided', voided:true } : i);
        const subtotal = items.filter(i=>!i.voided).reduce((s,i)=>s+i.price*i.qty,0);
        return { ...t, session:{ ...t.session, items, subtotal, total:subtotal*1.125 } };
      }),
      voidLog: [{
        id:`void-${Date.now()}`, timestamp:Date.now(), type:'item',
        tableId, tableLabel:table.label,
        items:[{ name:item.name, price:item.price, qty:item.qty }],
        totalValue: item.price * item.qty,
        reason, manager: manager.name, managerId: manager.id,
      }, ...s.voidLog],
    }));
    showToast(`${item.name} voided — ${reason}`, 'warning');
  },

  voidCheck: (tableId, { manager, reason }) => {
    const { tables, showToast } = get();
    const table  = tables.find(t => t.id === tableId);
    const session = table?.session;
    if (!session) return;

    const totalValue = session.items.reduce((s,i) => s+i.price*i.qty, 0);
    set(s => ({
      tables: s.tables.map(t => {
        if (t.id !== tableId || !t.session) return t;
        const items = t.session.items.map(i => ({ ...i, status:'voided', voided:true }));
        return { ...t, status:'available', session:null };
      }),
      voidLog: [{
        id:`void-${Date.now()}`, timestamp:Date.now(), type:'check',
        tableId, tableLabel:table.label,
        items: session.items.map(i => ({ name:i.name, price:i.price, qty:i.qty })),
        totalValue, reason, manager:manager.name, managerId:manager.id,
      }, ...s.voidLog],
      activeTableId: s.activeTableId === tableId ? null : s.activeTableId,
    }));
    showToast(`Check voided by ${manager.name} — ${reason}`, 'error');
  },

  // ── Discounts ──────────────────────────────
  // Check-level discounts stored on the session
  addCheckDiscount: (tableId, discount) => {
    set(s => ({
      tables: s.tables.map(t => {
        if (t.id !== tableId || !t.session) return t;
        const discounts = [...(t.session.discounts||[]), discount];
        return { ...t, session:{ ...t.session, discounts } };
      }),
    }));
  },

  removeCheckDiscount: (tableId, discountId) => {
    set(s => ({
      tables: s.tables.map(t => {
        if (t.id !== tableId || !t.session) return t;
        const discounts = (t.session.discounts||[]).filter(d => d.id !== discountId);
        return { ...t, session:{ ...t.session, discounts } };
      }),
    }));
  },

  addWalkInDiscount: (discount) => set(s => ({
    walkInOrder: { ...s.walkInOrder, discounts:[...(s.walkInOrder?.discounts||[]), discount] },
  })),

  removeWalkInDiscount: (discountId) => set(s => ({
    walkInOrder: { ...s.walkInOrder, discounts:(s.walkInOrder?.discounts||[]).filter(d=>d.id!==discountId) },
  })),

  // Item-level discount
  addItemDiscount: (tableId, itemUid, discount) => {
    if (tableId) {
      set(s => ({ tables:s.tables.map(t => {
        if (t.id!==tableId||!t.session) return t;
        const items = t.session.items.map(i => i.uid===itemUid ? {...i, discount} : i);
        const subtotal = items.filter(i=>!i.voided).reduce((s,i)=>s+(i.discount?i.price*(1-i.discount.value/100)*i.qty:i.price*i.qty),0);
        return {...t, session:{...t.session, items, subtotal, total:subtotal*1.125}};
      })}));
    } else {
      set(s => ({ walkInOrder:{ ...s.walkInOrder, items:(s.walkInOrder?.items||[]).map(i=>i.uid===itemUid?{...i,discount}:i) } }));
    }
  },

  removeItemDiscount: (tableId, itemUid) => {
    if (tableId) {
      set(s => ({ tables:s.tables.map(t => {
        if(t.id!==tableId||!t.session) return t;
        const items=t.session.items.map(i=>i.uid===itemUid?{...i,discount:null}:i);
        return {...t,session:{...t.session,items}};
      })}));
    } else {
      set(s=>({walkInOrder:{...s.walkInOrder,items:(s.walkInOrder?.items||[]).map(i=>i.uid===itemUid?{...i,discount:null}:i)}}));
    }
  },

  // ── KDS ───────────────────────────────────
  kdsTickets: isMock ? INITIAL_KDS : [],
  bumpTicket: id => {
    set(s => ({ kdsTickets: s.kdsTickets.filter(t => t.id !== id) }));
    import('../lib/db.js').then(({ bumpKDSTicket }) => bumpKDSTicket(id));
  },

  // ── Print job routing ─────────────────────────────────────────────────────
  // In production this would POST to the Sunmi NT311 ESC/POS bridge.
  // For now we record jobs with status so the Printers UI can show them.
  printJobs: [],
  routePrintJob: (job) => {
    // job: { id, centreId, printerName, tableLabel, items, type:'kitchen'|'pass'|'bar' }
    const printJob = { ...job, id:`pj-${Date.now()}`, sentAt:Date.now(), status:'sent' };
    set(s=>({ printJobs:[printJob, ...s.printJobs.slice(0,49)] }));
    // In a real integration: POST to Sunmi native bridge or ESC/POS server
    get().showToast(`Printed to ${job.printerName}`, 'info');
  },

  // ── Shift ─────────────────────────────────
  // Shift stats — computed live from closed checks
  get shift() {
    const checks = useStore.getState().closedChecks;
    const seed = SHIFT;
    // Only use seed values in mock mode — real mode starts with a clean shift
    if (!checks.length) return isMock ? seed : {
      name: 'Current shift', opened: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
      covers: 0, sales: 0, avgCheck: 0, cashSales: 0, cardSales: 0, tips: 0, voids: 0, voidValue: 0,
    };
    const revenue  = checks.reduce((s,c) => s + c.total, 0);
    const covers   = checks.reduce((s,c) => s + (c.covers || 1), 0);
    const tips     = checks.reduce((s,c) => s + (c.tip || 0), 0);
    const voids    = checks.reduce((s,c) => s + c.voids?.length || 0, 0);
    const card     = checks.filter(c => c.method !== 'cash').reduce((s,c) => s + c.total, 0);
    const cash     = checks.filter(c => c.method === 'cash').reduce((s,c) => s + c.total, 0);
    return {
      name: isMock ? seed.name : 'Current shift',
      opened: isMock ? seed.opened : new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
      covers, sales: revenue, avgCheck: covers > 0 ? revenue / covers : 0,
      cashSales: cash, cardSales: card, tips, voids, voidValue: 0,
    };
  },

  // ── Toast ─────────────────────────────────
  toast: null,
  theme: localStorage.getItem('rpos-theme') || 'dark',
  setTheme: (t) => {
    localStorage.setItem('rpos-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
  showToast: (msg,type='info') => { set({ toast:{ msg,type,key:Date.now() } }); setTimeout(()=>set({toast:null}),2800); },

  // ── Allergen pending ──────────────────────
  pendingItem: null,
  setPendingItem: item => set({ pendingItem:item }),
  clearPendingItem: () => set({ pendingItem:null }),
}));
// NOTE: these are appended but the store is defined above — we patch via the create callback
