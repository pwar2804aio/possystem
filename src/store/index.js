import { create } from 'zustand';
import { INITIAL_TABLES, INITIAL_KDS, SHIFT } from '../data/seed';

let _uid = 1;
const uid = () => `li-${_uid++}`;
let _orderNum = 1001;

const CAT_COURSE = {
  starters: 1, mains: 2, pizza: 2, sides: 2,
  desserts: 3, drinks: 0, cocktails: 0, quick: 1,
};

// Generate collection time slots from now, every 15 mins, for 3 hours
export function getCollectionSlots() {
  const slots = [];
  const now = new Date();
  // Round up to next 15-min boundary + 15 min minimum prep
  const start = new Date(now);
  start.setMinutes(Math.ceil((now.getMinutes() + 15) / 15) * 15, 0, 0);
  for (let i = 0; i < 12; i++) {
    const t = new Date(start.getTime() + i * 15 * 60000);
    slots.push({
      value: t.toISOString(),
      label: t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      isASAP: i === 0,
    });
  }
  return slots;
}

export const useStore = create((set, get) => ({

  // ── Auth ──────────────────────────────────────────────
  staff: null,
  login:  (s) => set({ staff: s }),
  logout: () => set({ staff: null, order: null, tableId: null, customer: null }),

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
  activeSeat: 'shared',
  setActiveSeat: (s) => set({ activeSeat: s }),

  // ── Customer (for takeaway / collection) ──────────────
  customer: null,   // { name, phone, email, collectionTime, notes, isASAP, orderRef }
  setCustomer: (c) => set({ customer: c }),
  clearCustomer: () => set({ customer: null }),

  // Customer history (in-memory for now, Supabase in production)
  customerHistory: [
    { id: 'c1', name: 'James Wilson',    phone: '07700 900123', email: 'james@email.com',  visits: 8,  lastOrder: '2 days ago' },
    { id: 'c2', name: 'Sophie Chen',     phone: '07700 900456', email: 'sophie@email.com', visits: 14, lastOrder: '1 week ago' },
    { id: 'c3', name: 'Marcus Johnson',  phone: '07700 900789', email: '',                 visits: 3,  lastOrder: '3 weeks ago' },
  ],
  searchCustomers: (q) => {
    if (!q || q.length < 3) return [];
    const lower = q.toLowerCase();
    return get().customerHistory.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.phone.replace(/\s/g,'').includes(q.replace(/\s/g,''))
    );
  },
  addToHistory: (customer) => set(s => ({
    customerHistory: [
      { ...customer, id: `c${Date.now()}`, visits: 1, lastOrder: 'Just now' },
      ...s.customerHistory.filter(c => c.phone !== customer.phone),
    ]
  })),

  // ── Active takeaway / collection orders queue ─────────
  // These are orders that have been sent to kitchen but not yet collected
  orderQueue: [],
  addToQueue: (order) => set(s => ({
    orderQueue: [order, ...s.orderQueue],
  })),
  updateQueueStatus: (ref, status) => set(s => ({
    orderQueue: s.orderQueue.map(o => o.ref === ref ? { ...o, status } : o),
  })),
  removeFromQueue: (ref) => set(s => ({
    orderQueue: s.orderQueue.filter(o => o.ref !== ref),
  })),

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
      set({ order: { id: `ORD-${Date.now()}`, tableId, items: [], firedCourses: [], sentAt: null }, tableId });
    }
    const qty = opts.qty || 1;
    const price = opts.linePrice != null ? opts.linePrice / qty : item.price;
    const defaultCourse = CAT_COURSE[item.cat] ?? 1;
    const newItem = {
      uid: uid(), itemId: item.id,
      name: opts.displayName || item.name,
      price, qty,
      mods: mods || [],
      notes: opts.notes || '',
      pizzaConfig,
      allergens: item.allergens || [],
      centreId: item.centreId,
      seat: get().activeSeat,
      course: defaultCourse,
      fired: defaultCourse === 0,
      status: 'pending',
    };
    set(s2 => {
      const base = s2.order || { id: `ORD-${Date.now()}`, tableId: s2.tableId||'walkin', items: [], firedCourses: [], sentAt: null };
      return { order: { ...base, items: [...base.items, newItem] } };
    });
  },

  addCustomItem: (name, price, notes) => {
    if (!get().order) set({ order: { id: `ORD-${Date.now()}`, tableId: get().tableId||'walkin', items: [], firedCourses: [], sentAt: null } });
    const newItem = { uid: uid(), itemId:'custom', name, price:parseFloat(price)||0, qty:1, mods:[], notes, allergens:[], seat:'shared', course:1, fired:false, status:'pending' };
    set(s => ({ order: { ...s.order, items: [...(s.order?.items||[]), newItem] } }));
  },

  removeFromOrder: (uid) => set(s => ({
    order: s.order ? { ...s.order, items: s.order.items.filter(i => i.uid !== uid) } : null,
  })),

  updateQty: (uid, delta) => set(s => {
    if (!s.order) return s;
    const items = s.order.items.map(i => i.uid === uid ? { ...i, qty: Math.max(1, i.qty+delta) } : i);
    return { order: { ...s.order, items } };
  }),

  updateItemSeat: (uid, seat) => set(s => ({
    order: s.order ? { ...s.order, items: s.order.items.map(i => i.uid===uid?{...i,seat}:i) } : null,
  })),

  updateItemCourse: (uid, course) => set(s => ({
    order: s.order ? { ...s.order, items: s.order.items.map(i => i.uid===uid?{...i,course}:i) } : null,
  })),

  sendToKitchen: () => {
    const { order, customer, orderType, staff } = get();
    set(s => {
      if (!s.order) return s;
      const fired = [0, 1];
      const items = s.order.items.map(i => fired.includes(i.course) ? {...i,fired:true,status:'sent'} : i);
      return { order: { ...s.order, items, firedCourses: fired, sentAt: new Date() } };
    });
    // Add to collection queue for takeaway/collection orders
    if (orderType !== 'dine-in' && customer) {
      const ref = `#${_orderNum++}`;
      get().addToQueue({
        ref,
        type: orderType,
        customer: { ...customer },
        items: order?.items || [],
        total: get().getOrderTotals().total,
        status: 'received',   // received | prep | ready | collected
        createdAt: new Date(),
        collectionTime: customer.collectionTime,
        isASAP: customer.isASAP,
        staff: staff?.name,
      });
    }
  },

  fireCourse: (courseNum) => {
    set(s => {
      if (!s.order) return s;
      const firedCourses = [...(s.order.firedCourses||[]), courseNum];
      const items = s.order.items.map(i => i.course===courseNum ? {...i,fired:true,status:'sent'} : i);
      return { order: { ...s.order, items, firedCourses } };
    });
    get().showToast(`Course ${courseNum} fired`, 'success');
  },

  clearOrder: () => set({ order: null, tableId: null, activeSeat: 'shared', customer: null }),

  getOrderTotals: () => {
    const { order, orderType } = get();
    const items = order?.items || [];
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const service  = orderType === 'dine-in' ? subtotal * 0.125 : 0;
    return { subtotal, service, total: subtotal+service, itemCount: items.reduce((s,i)=>s+i.qty,0) };
  },

  // ── 86 ────────────────────────────────────────────────
  eightySixIds: [],
  toggle86: (id) => set(s => ({
    eightySixIds: s.eightySixIds.includes(id) ? s.eightySixIds.filter(x=>x!==id) : [...s.eightySixIds, id],
  })),

  // ── Tables ────────────────────────────────────────────
  tables: INITIAL_TABLES,
  updateTable: (id, patch) => set(s => ({ tables: s.tables.map(t => t.id===id?{...t,...patch}:t) })),
  openTable: (id) => { get().updateTable(id,{status:'open'}); get().startOrder(id); set({surface:'pos',activeSeat:'shared'}); },
  closeTable: (id) => {
    get().updateTable(id,{status:'available',seated:null,server:null,orderTotal:null});
    set(s=>({order:s.tableId===id?null:s.order,tableId:s.tableId===id?null:s.tableId}));
  },

  // ── KDS ───────────────────────────────────────────────
  kdsTickets: INITIAL_KDS,
  bumpTicket: (id) => set(s => ({ kdsTickets: s.kdsTickets.filter(t => t.id!==id) })),

  // ── Shift ─────────────────────────────────────────────
  shift: SHIFT,

  // ── Toast ─────────────────────────────────────────────
  toast: null,
  showToast: (msg, type='info') => {
    set({ toast: { msg, type, key: Date.now() } });
    setTimeout(() => set({ toast: null }), 2800);
  },

  // ── Allergen pending ──────────────────────────────────
  pendingItem: null,
  setPendingItem: (item) => set({ pendingItem: item }),
  clearPendingItem: () => set({ pendingItem: null }),
}));
