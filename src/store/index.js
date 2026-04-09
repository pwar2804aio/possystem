import { create } from 'zustand';
import { INITIAL_TABLES, INITIAL_KDS, SHIFT } from '../data/seed';

let _uid = 1;
const uid = () => `li-${_uid++}`;

// Course defaults by category
const CAT_COURSE = {
  starters: 1, mains: 2, pizza: 2, sides: 2,
  desserts: 3, drinks: 0, cocktails: 0, quick: 1,
};

export const useStore = create((set, get) => ({

  // ── Auth ──────────────────────────────────────────────
  staff: null,
  login:  (s) => set({ staff: s }),
  logout: () => set({ staff: null, order: null, tableId: null }),

  // ── Surface ───────────────────────────────────────────
  surface: 'pos',
  setSurface: (s) => set({ surface: s }),

  // ── Allergen filter ───────────────────────────────────
  allergens: [],
  toggleAllergen: (id) => set(s => ({
    allergens: s.allergens.includes(id)
      ? s.allergens.filter(a => a !== id)
      : [...s.allergens, id],
  })),
  clearAllergens: () => set({ allergens: [] }),

  // ── Order context ─────────────────────────────────────
  tableId: null,
  setTableId: (id) => set({ tableId: id }),
  orderType: 'dine-in',
  setOrderType: (t) => set({ orderType: t }),
  covers: 2,
  setCovers: (n) => set({ covers: Math.max(1, n) }),
  activeSeat: 'shared',   // 'shared' | 1 | 2 | 3...
  setActiveSeat: (s) => set({ activeSeat: s }),
  activeCourse: 1,        // 1 | 2 | 3
  setActiveCourse: (c) => set({ activeCourse: c }),

  // ── Order ─────────────────────────────────────────────
  order: null,

  startOrder: (tableId) => set({
    order: { id: `ORD-${Date.now()}`, tableId, items: [], firedCourses: [], sentAt: null },
    tableId,
  }),

  addToOrder: (item, mods = [], pizzaConfig = null, opts = {}) => {
    const s = get();
    if (!s.order) {
      const tableId = s.tableId || 'walkin';
      set({
        order: { id: `ORD-${Date.now()}`, tableId, items: [], firedCourses: [], sentAt: null },
        tableId,
      });
    }
    const qty = opts.qty || 1;
    const price = opts.linePrice != null ? opts.linePrice / qty : item.price;
    const defaultCourse = item.cat ? (CAT_COURSE[item.cat] ?? 1) : 1;
    const newItem = {
      uid: uid(),
      itemId: item.id,
      name: opts.displayName || item.name,
      price,
      qty,
      mods: mods || [],
      notes: opts.notes || '',
      pizzaConfig,
      allergens: item.allergens || [],
      centreId: item.centreId,
      seat: get().activeSeat,
      course: defaultCourse,  // 0 = immediate (drinks), 1,2,3 = hold until fired
      fired: defaultCourse === 0,  // drinks fire immediately
      status: 'pending',  // pending | sent | cooking | bumped
    };
    set(s2 => {
      const base = s2.order || { id: `ORD-${Date.now()}`, tableId: s2.tableId || 'walkin', items: [], firedCourses: [], sentAt: null };
      return { order: { ...base, items: [...base.items, newItem] } };
    });
  },

  removeFromOrder: (uid) => set(s => ({
    order: s.order ? { ...s.order, items: s.order.items.filter(i => i.uid !== uid) } : null,
  })),

  updateQty: (uid, delta) => set(s => {
    if (!s.order) return s;
    const items = s.order.items.map(i => i.uid === uid ? { ...i, qty: Math.max(1, i.qty + delta) } : i);
    return { order: { ...s.order, items } };
  }),

  updateItemSeat: (uid, seat) => set(s => {
    if (!s.order) return s;
    const items = s.order.items.map(i => i.uid === uid ? { ...i, seat } : i);
    return { order: { ...s.order, items } };
  }),

  updateItemCourse: (uid, course) => set(s => {
    if (!s.order) return s;
    const items = s.order.items.map(i => i.uid === uid ? { ...i, course } : i);
    return { order: { ...s.order, items } };
  }),

  addCustomItem: (name, price, notes) => {
    const s = get();
    if (!s.order) {
      const tableId = s.tableId || 'walkin';
      set({ order: { id: `ORD-${Date.now()}`, tableId, items: [], firedCourses: [], sentAt: null }, tableId });
    }
    const newItem = {
      uid: uid(), itemId: 'custom', name, price: parseFloat(price) || 0,
      qty: 1, mods: [], notes, allergens: [],
      seat: get().activeSeat, course: 1, fired: false, status: 'pending',
    };
    set(s2 => {
      const base = s2.order;
      return { order: { ...base, items: [...base.items, newItem] } };
    });
  },

  // Send to kitchen — fires course 0 (drinks) + course 1 (starters) immediately
  sendToKitchen: () => {
    set(s => {
      if (!s.order) return s;
      const fired = [0, 1]; // auto-fire drinks and course 1
      const items = s.order.items.map(i =>
        fired.includes(i.course) ? { ...i, fired: true, status: 'sent' } : i
      );
      return { order: { ...s.order, items, firedCourses: fired, sentAt: new Date() } };
    });
  },

  // Fire a specific course manually
  fireCourse: (courseNum) => {
    set(s => {
      if (!s.order) return s;
      const firedCourses = [...(s.order.firedCourses || []), courseNum];
      const items = s.order.items.map(i =>
        i.course === courseNum ? { ...i, fired: true, status: 'sent' } : i
      );
      return { order: { ...s.order, items, firedCourses } };
    });
    get().showToast(`Course ${courseNum} fired to kitchen`, 'success');
  },

  clearOrder: () => set({ order: null, tableId: null, activeSeat: 'shared', activeCourse: 1 }),

  getOrderTotals: () => {
    const { order, orderType } = get();
    const items = order?.items || [];
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const service  = orderType === 'dine-in' ? subtotal * 0.125 : 0;
    return { subtotal, service, total: subtotal + service, itemCount: items.reduce((s,i) => s+i.qty,0) };
  },

  // ── 86 management ─────────────────────────────────────
  eightySixIds: [],
  toggle86: (itemId) => set(s => ({
    eightySixIds: s.eightySixIds.includes(itemId)
      ? s.eightySixIds.filter(id => id !== itemId)
      : [...s.eightySixIds, itemId],
  })),
  is86: (itemId) => get().eightySixIds.includes(itemId),

  // ── Tables ─────────────────────────────────────────────
  tables: INITIAL_TABLES,
  updateTable: (id, patch) => set(s => ({ tables: s.tables.map(t => t.id === id ? { ...t, ...patch } : t) })),
  openTable: (id) => {
    get().updateTable(id, { status: 'open' });
    get().startOrder(id);
    set({ surface: 'pos', activeSeat: 'shared' });
  },
  closeTable: (id) => {
    get().updateTable(id, { status: 'available', seated: null, server: null, orderTotal: null });
    set(s => ({ order: s.tableId === id ? null : s.order, tableId: s.tableId === id ? null : s.tableId }));
  },

  // ── KDS ────────────────────────────────────────────────
  kdsTickets: INITIAL_KDS,
  bumpTicket: (id) => set(s => ({ kdsTickets: s.kdsTickets.filter(t => t.id !== id) })),

  // ── Shift ──────────────────────────────────────────────
  shift: SHIFT,

  // ── Toast ──────────────────────────────────────────────
  toast: null,
  showToast: (msg, type = 'info') => {
    set({ toast: { msg, type, key: Date.now() } });
    setTimeout(() => set({ toast: null }), 2800);
  },

  // ── Pending allergen ────────────────────────────────────
  pendingItem: null,
  setPendingItem: (item) => set({ pendingItem: item }),
  clearPendingItem: () => set({ pendingItem: null }),
}));
