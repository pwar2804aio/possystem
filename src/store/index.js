import { create } from 'zustand';
import { INITIAL_TABLES, INITIAL_KDS, SHIFT } from '../data/seed';

let _uid = 1;
const uid = () => `li-${_uid++}`;
let _orderNum = 1001;
let _tabNum = 1;

const CAT_COURSE = {
  starters:1, mains:2, pizza:2, sides:2,
  desserts:3, drinks:0, cocktails:0, quick:1,
};

export function getCollectionSlots() {
  const slots = [];
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(Math.ceil((now.getMinutes()+15)/15)*15, 0, 0);
  for (let i=0; i<12; i++) {
    const t = new Date(start.getTime() + i*15*60000);
    slots.push({ value:t.toISOString(), label:t.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}), isASAP:i===0 });
  }
  return slots;
}

export const useStore = create((set, get) => ({

  // ── Auth ──────────────────────────────────
  staff: null,
  login:  (s) => set({ staff:s }),
  logout: () => set({ staff:null, order:null, tableId:null, customer:null }),

  // ── Surface ───────────────────────────────
  surface: 'pos',
  setSurface: (s) => set({ surface:s }),

  // ── Allergens ─────────────────────────────
  allergens: [],
  toggleAllergen: (id) => set(s=>({ allergens: s.allergens.includes(id)?s.allergens.filter(a=>a!==id):[...s.allergens,id] })),
  clearAllergens: () => set({ allergens:[] }),

  // ── Order context ─────────────────────────
  tableId: null,
  setTableId: (id) => set({ tableId:id }),
  orderType: 'dine-in',
  setOrderType: (t) => set({ orderType:t }),
  covers: 2,
  setCovers: (n) => set({ covers:Math.max(1,n) }),
  activeSeat: 'shared',
  setActiveSeat: (s) => set({ activeSeat:s }),
  orderNote: '',
  setOrderNote: (n) => set({ orderNote:n }),

  // ── Customer ──────────────────────────────
  customer: null,
  setCustomer: (c) => set({ customer:c }),
  clearCustomer: () => set({ customer:null }),
  customerHistory: [
    { id:'c1', name:'James Wilson',   phone:'07700 900123', email:'james@email.com',  visits:8,  lastOrder:'2 days ago' },
    { id:'c2', name:'Sophie Chen',    phone:'07700 900456', email:'sophie@email.com', visits:14, lastOrder:'1 week ago' },
    { id:'c3', name:'Marcus Johnson', phone:'07700 900789', email:'',                 visits:3,  lastOrder:'3 weeks ago' },
  ],
  searchCustomers: (q) => {
    if (!q||q.length<3) return [];
    const l=q.toLowerCase();
    return get().customerHistory.filter(c=>c.name.toLowerCase().includes(l)||c.phone.replace(/\s/g,'').includes(q.replace(/\s/g,'')));
  },
  addToHistory: (c) => set(s=>({ customerHistory:[{...c,id:`c${Date.now()}`,visits:1,lastOrder:'Just now'},...s.customerHistory.filter(x=>x.phone!==c.phone)] })),

  // ── Collection queue ──────────────────────
  orderQueue: [],
  addToQueue: (o) => set(s=>({ orderQueue:[o,...s.orderQueue] })),
  updateQueueStatus: (ref,status) => set(s=>({ orderQueue:s.orderQueue.map(o=>o.ref===ref?{...o,status}:o) })),
  removeFromQueue: (ref) => set(s=>({ orderQueue:s.orderQueue.filter(o=>o.ref!==ref) })),

  // ── BAR TABS ──────────────────────────────
  tabs: [],
  activeTabId: null,

  openTab: ({ name, seatId=null, tableId=null, preAuth=false, preAuthAmount=50 }) => {
    const tab = {
      id: `tab-${Date.now()}`,
      ref: `TAB-${_tabNum++}`,
      name: name.trim(),
      seatId,
      tableId,
      openedBy: get().staff?.name || 'Staff',
      openedAt: new Date(),
      status: 'open',   // open | running | closing | closed
      preAuth,
      preAuthAmount,
      rounds: [],       // each send creates a round: { id, sentAt, items[] }
      note: '',
      total: 0,
    };
    set(s=>({ tabs:[tab,...s.tabs], activeTabId:tab.id }));
    return tab;
  },

  setActiveTab: (id) => set({ activeTabId:id }),

  addRoundToTab: (tabId, items, note='') => {
    const round = {
      id: uid(),
      sentAt: new Date(),
      items: items.map(i=>({...i})),
      subtotal: items.reduce((s,i)=>s+i.price*i.qty,0),
      note,
    };
    set(s=>({
      tabs: s.tabs.map(t=>{
        if (t.id!==tabId) return t;
        const rounds=[...t.rounds, round];
        return { ...t, rounds, status:'running', total:rounds.reduce((s,r)=>s+r.subtotal,0) };
      }),
    }));
    return round;
  },

  updateTabNote: (tabId, note) => set(s=>({ tabs:s.tabs.map(t=>t.id===tabId?{...t,note}:t) })),
  updateTabStatus: (tabId, status) => set(s=>({ tabs:s.tabs.map(t=>t.id===tabId?{...t,status}:t) })),

  closeTab: (tabId) => {
    set(s=>({ tabs:s.tabs.map(t=>t.id===tabId?{...t,status:'closed'}:t), activeTabId:s.activeTabId===tabId?null:s.activeTabId }));
  },

  voidTabRound: (tabId, roundId) => set(s=>({
    tabs: s.tabs.map(t=>{
      if (t.id!==tabId) return t;
      const rounds=t.rounds.filter(r=>r.id!==roundId);
      return {...t,rounds,total:rounds.reduce((s,r)=>s+r.subtotal,0)};
    }),
  })),

  // Seed some demo tabs
  seedTabs: () => {
    const demo = [
      { id:'t-demo1', ref:'TAB-001', name:'Maria G.', seatId:'B1', tableId:null, openedBy:'Maria', openedAt:new Date(Date.now()-22*60000), status:'running', preAuth:true, preAuthAmount:50, note:'Celebrating birthday', total:45.50,
        rounds:[{ id:'r1', sentAt:new Date(Date.now()-20*60000), subtotal:22.00, note:'', items:[{uid:'i1',name:'Negroni',price:11,qty:2,mods:[{label:'Hendrick\'s',price:3}],notes:''}] },
                { id:'r2', sentAt:new Date(Date.now()-8*60000), subtotal:23.50, note:'', items:[{uid:'i2',name:'Espresso Martini',price:12.50,qty:1,mods:[],notes:''},{uid:'i3',name:'Peroni — Pint',price:6.50,qty:1,mods:[],notes:'No glass'}] }] },
      { id:'t-demo2', ref:'TAB-002', name:'Tom & Sarah', seatId:null, tableId:'t4', openedBy:'Tom', openedAt:new Date(Date.now()-45*60000), status:'running', preAuth:false, preAuthAmount:0, note:'', total:56.00,
        rounds:[{ id:'r3', sentAt:new Date(Date.now()-40*60000), subtotal:28.00, note:'', items:[{uid:'i4',name:'Old Fashioned',price:12,qty:2,mods:[{label:'Woodford Reserve',price:3}],notes:''}] },
                { id:'r4', sentAt:new Date(Date.now()-15*60000), subtotal:28.00, note:'No ice in Tom\'s', items:[{uid:'i5',name:'House red wine — 250ml',price:10.50,qty:1,mods:[],notes:''},{uid:'i6',name:'Margarita',price:11.50,qty:1,mods:[{label:'On the rocks',price:0}],notes:'Salt rim'},{uid:'i7',name:'Still water — 500ml',price:3,qty:2,mods:[],notes:''}] }] },
    ];
    set({ tabs:demo });
  },

  // ── Main order ────────────────────────────
  order: null,

  startOrder: (tableId) => set({
    order:{ id:`ORD-${Date.now()}`, tableId, items:[], firedCourses:[], sentAt:null },
    tableId,
  }),

  addToOrder: (item, mods=[], pizzaConfig=null, opts={}) => {
    const s=get();
    if (!s.order) {
      const tid=s.tableId||'walkin';
      set({ order:{ id:`ORD-${Date.now()}`, tableId:tid, items:[], firedCourses:[], sentAt:null }, tableId:tid });
    }
    const qty=opts.qty||1;
    const price=opts.linePrice!=null?opts.linePrice/qty:item.price;
    const newItem={
      uid:uid(), itemId:item.id,
      name:opts.displayName||item.name,
      price, qty,
      mods:mods||[], notes:opts.notes||'',
      pizzaConfig, allergens:item.allergens||[],
      centreId:item.centreId,
      seat:get().activeSeat,
      course:CAT_COURSE[item.cat]??1,
      fired:CAT_COURSE[item.cat]===0,
      status:'pending',
    };
    set(s2=>{
      const base=s2.order||{ id:`ORD-${Date.now()}`, tableId:s2.tableId||'walkin', items:[], firedCourses:[], sentAt:null };
      return { order:{ ...base, items:[...base.items,newItem] } };
    });
  },

  addCustomItem: (name,price,notes) => {
    if (!get().order) set({ order:{ id:`ORD-${Date.now()}`, tableId:get().tableId||'walkin', items:[], firedCourses:[], sentAt:null } });
    const newItem={ uid:uid(), itemId:'custom', name, price:parseFloat(price)||0, qty:1, mods:[], notes, allergens:[], seat:'shared', course:1, fired:false, status:'pending' };
    set(s=>({ order:{ ...s.order, items:[...(s.order?.items||[]),newItem] } }));
  },

  removeFromOrder: (uid) => set(s=>({ order:s.order?{...s.order,items:s.order.items.filter(i=>i.uid!==uid)}:null })),

  updateQty: (uid,delta) => set(s=>{
    if (!s.order) return s;
    return { order:{ ...s.order, items:s.order.items.map(i=>i.uid===uid?{...i,qty:Math.max(1,i.qty+delta)}:i) } };
  }),

  updateItemNote: (uid, note) => set(s=>({
    order: s.order?{ ...s.order, items:s.order.items.map(i=>i.uid===uid?{...i,notes:note}:i) }:null,
  })),

  updateItemSeat: (uid,seat) => set(s=>({ order:s.order?{...s.order,items:s.order.items.map(i=>i.uid===uid?{...i,seat}:i)}:null })),
  updateItemCourse: (uid,course) => set(s=>({ order:s.order?{...s.order,items:s.order.items.map(i=>i.uid===uid?{...i,course}:i)}:null })),

  // SEND TO KITCHEN — also updates table status to occupied
  sendToKitchen: () => {
    const { tableId, staff, getOrderTotals, updateTable, orderType, customer, addToQueue, order } = get();
    const { total } = getOrderTotals();

    set(s=>{
      if (!s.order) return s;
      const fired=[0,1];
      const items=s.order.items.map(i=>fired.includes(i.course)?{...i,fired:true,status:'sent'}:i);
      return { order:{ ...s.order, items, firedCourses:fired, sentAt:new Date() } };
    });

    // ✅ Update table to occupied
    if (tableId && tableId!=='walkin') {
      updateTable(tableId, {
        status:'occupied',
        server: staff?.name,
        orderTotal: total,
        seated: Math.round((Date.now() - (get().tables.find(t=>t.id===tableId)?.seatedAt||Date.now()))/60000) || 0,
      });
    }

    // Add to collection queue for takeaway/collection
    if (orderType!=='dine-in' && customer) {
      const ref=`#${_orderNum++}`;
      addToQueue({ ref, type:orderType, customer:{...customer}, items:order?.items||[], total, status:'received', createdAt:new Date(), collectionTime:customer.collectionTime, isASAP:customer.isASAP, staff:staff?.name });
    }
  },

  fireCourse: (courseNum) => {
    set(s=>{
      if (!s.order) return s;
      const firedCourses=[...(s.order.firedCourses||[]),courseNum];
      const items=s.order.items.map(i=>i.course===courseNum?{...i,fired:true,status:'sent'}:i);
      return { order:{ ...s.order, items, firedCourses } };
    });
    get().showToast(`Course ${courseNum} fired to kitchen`,'success');
  },

  clearOrder: () => set({ order:null, tableId:null, activeSeat:'shared', customer:null, orderNote:'' }),

  getOrderTotals: () => {
    const { order, orderType } = get();
    const items=order?.items||[];
    const subtotal=items.reduce((s,i)=>s+i.price*i.qty,0);
    const service=orderType==='dine-in'?subtotal*0.125:0;
    return { subtotal, service, total:subtotal+service, itemCount:items.reduce((s,i)=>s+i.qty,0) };
  },

  // ── 86 ────────────────────────────────────
  eightySixIds: [],
  toggle86: (id) => set(s=>({ eightySixIds:s.eightySixIds.includes(id)?s.eightySixIds.filter(x=>x!==id):[...s.eightySixIds,id] })),

  // ── Tables ────────────────────────────────
  tables: INITIAL_TABLES,
  updateTable: (id,patch) => set(s=>({ tables:s.tables.map(t=>t.id===id?{...t,...patch}:t) })),
  openTable: (id) => {
    get().updateTable(id,{status:'open',seatedAt:Date.now()});
    get().startOrder(id);
    set({ surface:'pos', activeSeat:'shared' });
  },
  closeTable: (id) => {
    get().updateTable(id, { status:'available', seated:null, server:null, orderTotal:null, seatedAt:null });
    // Always clear order when closing a table — don't rely on s.tableId matching
    set({ order:null, tableId:null, activeSeat:'shared', customer:null, orderNote:'' });
  },

  // ── KDS ───────────────────────────────────
  kdsTickets: INITIAL_KDS,
  bumpTicket: (id) => set(s=>({ kdsTickets:s.kdsTickets.filter(t=>t.id!==id) })),

  // ── Shift ─────────────────────────────────
  shift: SHIFT,

  // ── Toast ─────────────────────────────────
  toast: null,
  showToast: (msg,type='info') => {
    set({ toast:{ msg,type,key:Date.now() } });
    setTimeout(()=>set({toast:null}),2800);
  },

  // ── Allergen pending ──────────────────────
  pendingItem: null,
  setPendingItem: (item) => set({ pendingItem:item }),
  clearPendingItem: () => set({ pendingItem:null }),
}));
