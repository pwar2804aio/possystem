import { create } from 'zustand';
import { INITIAL_TABLES, INITIAL_KDS, SHIFT } from '../data/seed';

let _uid = 1;
const uid = () => `li-${_uid++}`;

export const useStore = create((set, get) => ({

  // ── Auth ──────────────────────────────────────────────────────────────────
  staff: null,
  login:  (s) => set({ staff: s }),
  logout: () => set({ staff: null, order: null, tableId: null }),

  // ── Surface ───────────────────────────────────────────────────────────────
  surface: 'pos', // pos | tables | kds | backoffice
  setSurface: (s) => set({ surface: s }),

  // ── Allergen filter ───────────────────────────────────────────────────────
  allergens: [],
  toggleAllergen: (id) => set(s => ({
    allergens: s.allergens.includes(id)
      ? s.allergens.filter(a => a !== id)
      : [...s.allergens, id],
  })),
  clearAllergens: () => set({ allergens: [] }),

  // ── Active table ──────────────────────────────────────────────────────────
  tableId: null,
  setTableId: (id) => set({ tableId: id }),

  // ── Order ─────────────────────────────────────────────────────────────────
  order: null,

  startOrder: (tableId) => {
    set({
      order: { id: `ORD-${Date.now()}`, tableId, items: [], sentAt: null },
      tableId,
    });
  },

  addToOrder: (item, mods = [], pizzaConfig = null) => {
    const { order, tableId, startOrder } = get();
    if (!order) startOrder(tableId || 'walkin');

    const extraPrice = pizzaConfig
      ? (pizzaConfig.size?.basePrice || 12) - 12 +
        (pizzaConfig.crust?.extra || 0) +
        (pizzaConfig.toppings?.left  || []).reduce((s, t) => s + t.price * 0.5, 0) +
        (pizzaConfig.toppings?.right || []).reduce((s, t) => s + t.price * 0.5, 0) +
        (pizzaConfig.toppings?.whole || []).reduce((s, t) => s + t.price, 0)
      : mods.reduce((s, m) => s + (m.price || 0), 0);

    const newItem = {
      uid: uid(),
      itemId: item.id,
      name: pizzaConfig ? buildPizzaName(pizzaConfig, item.name) : item.name,
      price: item.price + extraPrice,
      qty: 1,
      mods,
      pizzaConfig,
      allergens: item.allergens || [],
      centre: item.centre,
    };

    set(s => ({
      order: { ...s.order, items: [...(s.order?.items || []), newItem] },
    }));
  },

  removeFromOrder: (uid) => set(s => ({
    order: s.order ? { ...s.order, items: s.order.items.filter(i => i.uid !== uid) } : null,
  })),

  updateQty: (uid, delta) => set(s => {
    if (!s.order) return s;
    const items = s.order.items
      .map(i => i.uid === uid ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0);
    return { order: { ...s.order, items } };
  }),

  clearOrder: () => set({ order: null, tableId: null }),

  sendToKitchen: () => {
    set(s => ({ order: s.order ? { ...s.order, sentAt: new Date() } : null }));
    // In prod: POST to Supabase, trigger print router
  },

  getOrderTotals: () => {
    const items = get().order?.items || [];
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const service  = subtotal * 0.125;
    return { subtotal, service, total: subtotal + service };
  },

  // ── Tables ────────────────────────────────────────────────────────────────
  tables: INITIAL_TABLES,

  updateTable: (id, patch) => set(s => ({
    tables: s.tables.map(t => t.id === id ? { ...t, ...patch } : t),
  })),

  openTable: (tableId) => {
    get().updateTable(tableId, { status: 'open' });
    get().startOrder(tableId);
    set({ surface: 'pos' });
  },

  closeTable: (tableId) => {
    get().updateTable(tableId, { status: 'available', seated: null, server: null, orderTotal: null });
    set(s => ({
      order: s.tableId === tableId ? null : s.order,
      tableId: s.tableId === tableId ? null : s.tableId,
    }));
  },

  // ── KDS ───────────────────────────────────────────────────────────────────
  kdsTickets: INITIAL_KDS,
  bumpTicket: (id) => set(s => ({ kdsTickets: s.kdsTickets.filter(t => t.id !== id) })),

  // ── Shift ─────────────────────────────────────────────────────────────────
  shift: SHIFT,

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: null,
  showToast: (msg, type = 'info') => {
    set({ toast: { msg, type, key: Date.now() } });
    setTimeout(() => set({ toast: null }), 2800);
  },

  // ── Pending allergen item ─────────────────────────────────────────────────
  pendingItem: null,
  setPendingItem: (item) => set({ pendingItem: item }),
  clearPendingItem: () => set({ pendingItem: null }),
}));

// helper
function buildPizzaName(cfg, baseName) {
  if (cfg.split === 'whole') return `${baseName} — ${cfg.size?.name || 'Large'}`;
  return `${baseName} — Half & half`;
}
