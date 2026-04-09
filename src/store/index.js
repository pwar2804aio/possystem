import { create } from 'zustand';
import { INITIAL_TABLES, INITIAL_KDS, SHIFT } from '../data/seed';

let _uid = 1;
const uid = () => `li-${_uid++}`;

export const useStore = create((set, get) => ({
  staff: null,
  login:  (s) => set({ staff: s }),
  logout: () => set({ staff: null, order: null, tableId: null }),

  surface: 'pos',
  setSurface: (s) => set({ surface: s }),

  allergens: [],
  toggleAllergen: (id) => set(s => ({
    allergens: s.allergens.includes(id) ? s.allergens.filter(a=>a!==id) : [...s.allergens, id],
  })),
  clearAllergens: () => set({ allergens: [] }),

  tableId: null,
  setTableId: (id) => set({ tableId: id }),

  // Order context
  order: null,
  orderType: 'dine-in', // 'dine-in' | 'takeaway' | 'collection'
  covers: 1,
  setOrderType: (t) => set({ orderType: t }),
  setCovers:    (n) => set({ covers: n }),

  startOrder: (tableId) => set({
    order: { id:`ORD-${Date.now()}`, tableId, items:[], sentAt:null },
    tableId,
  }),

  // addToOrder accepts: item, mods, pizzaConfig, opts { displayName, qty, linePrice, notes, variant }
  addToOrder: (item, mods=[], pizzaConfig=null, opts={}) => {
    const { order, tableId, startOrder } = get();
    if (!order) startOrder(tableId||'walkin');
    const qty = opts.qty || 1;
    const price = opts.linePrice != null ? opts.linePrice / qty : item.price;
    const newItem = {
      uid: uid(),
      itemId: item.id,
      name: opts.displayName || item.name,
      price,
      qty,
      mods: mods || [],
      notes: opts.notes || '',
      pizzaConfig,
      variant: opts.variant || null,
      allergens: item.allergens || [],
      centreId: item.centreId,
    };
    set(s => {
      const base = s.order || { id:`ORD-${Date.now()}`, tableId: s.tableId||'walkin', items:[], sentAt:null };
      const updated = { ...base, items:[...base.items, newItem] };
      return { order: updated };
    });
  },

  removeFromOrder: (uid) => set(s => ({
    order: s.order ? { ...s.order, items: s.order.items.filter(i=>i.uid!==uid) } : null,
  })),

  updateQty: (uid, delta) => set(s => {
    if (!s.order) return s;
    const items = s.order.items.map(i => i.uid===uid ? {...i, qty: i.qty+delta} : i).filter(i=>i.qty>0);
    return { order: {...s.order, items} };
  }),

  clearOrder: () => set({ order:null, tableId:null, covers:2 }),

  sendToKitchen: () => set(s => ({ order: s.order ? {...s.order, sentAt:new Date()} : null })),

  getOrderTotals: () => {
    const { order, orderType } = get();
    const items = order?.items || [];
    const subtotal = items.reduce((s,i) => s + i.price * i.qty, 0);
    const service  = orderType==='dine-in' ? subtotal * 0.125 : 0;
    return { subtotal, service, total: subtotal+service, itemCount: items.reduce((s,i)=>s+i.qty,0) };
  },

  tables: INITIAL_TABLES,
  updateTable: (id, patch) => set(s => ({ tables: s.tables.map(t=>t.id===id?{...t,...patch}:t) })),
  openTable:   (id) => { get().updateTable(id,{status:'open'}); get().startOrder(id); set({surface:'pos'}); },
  closeTable:  (id) => {
    get().updateTable(id,{status:'available',seated:null,server:null,orderTotal:null});
    set(s => ({ order: s.tableId===id?null:s.order, tableId: s.tableId===id?null:s.tableId }));
  },

  kdsTickets: INITIAL_KDS,
  bumpTicket: (id) => set(s => ({ kdsTickets: s.kdsTickets.filter(t=>t.id!==id) })),

  shift: SHIFT,

  toast: null,
  showToast: (msg, type='info') => {
    set({ toast:{msg,type,key:Date.now()} });
    setTimeout(() => set({toast:null}), 2800);
  },

  pendingItem: null,
  setPendingItem: (item) => set({ pendingItem:item }),
  clearPendingItem: () => set({ pendingItem:null }),
}));
