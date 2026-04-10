import { useState, useCallback, useEffect } from 'react';
import './styles/globals.css';
import { useStore } from './store';
import PINScreen from './surfaces/PINScreen';
import POSSurface from './surfaces/POSSurface';
import BarSurface from './surfaces/BarSurface';
import TablesSurface from './surfaces/TablesSurface';
import { KDSSurface } from './surfaces/OtherSurfaces';
import BackOfficeApp from './backoffice/BackOfficeApp';
import StatusDrawer from './components/StatusDrawer';
import SyncBridge from './sync/SyncBridge';
import ConfigSyncBanner from './components/ConfigSyncBanner';
import KioskSurface from './surfaces/KioskSurface';
import OrdersHub from './surfaces/OrdersHub';
import useSupabaseInit from './lib/useSupabaseInit';

const VERSION = '0.9.5';

const CHANGELOG = [
  {
    version: '0.9.5', date: 'Apr 2026', label: 'Table send clears POS, Orders tab restored',
    changes: [
      'Table orders (including split checks T1.2, T1.3): clicking Send now clears the POS panel immediately — table stays occupied in the floor plan, POS resets ready for the next order.',
      'Walk-in orders: clicking Send through OrderTypeModal always clears POS (fixed in v0.9.4).',
      'Orders tab restored to sidebar nav: Bar → Floor → POS → Orders → KDS.',
      'Orders Hub: filter by order type (All / Tables / Bar / Dine-in / Takeaway / Collection / Delivery), "👤 My orders" quick filter, search by name/ref/server, show completed toggle.',
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

  // Start Supabase Realtime on mount (no-op in mock mode)
  useEffect(() => {
    let cleanup;
    import('./lib/realtime.js').then(({ startRealtime }) => {
      import('./store/index.js').then(({ useStore: storeModule }) => {
        cleanup = startRealtime(storeModule);
      });
    }).catch(() => {});
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (!staff) return <><SyncBridge onSyncPulse={handleSyncPulse}/><PINScreen /></>;
  if (appMode === 'backoffice') return <><SyncBridge onSyncPulse={handleSyncPulse}/><BackOfficeApp /></>;
  // Kiosk — full screen, no staff sidebar, no shift bar
  if (surface === 'kiosk' || deviceConfig?.defaultSurface === 'kiosk') return <><SyncBridge onSyncPulse={handleSyncPulse}/><KioskSurface /></>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <SyncBridge onSyncPulse={handleSyncPulse}/>
      <ShiftBar shift={shift} version={VERSION} onWhatsNew={()=>setShowWhatsNew(true)} theme={theme} onToggleTheme={()=>setTheme(theme==='dark'?'light':'dark')} syncPulse={syncPulse}/>
      <ConfigSyncBanner />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar surface={surface} setSurface={setSurface} />
        <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>
          {surface==='tables'     && <TablesSurface />}
          {surface==='pos'        && <POSSurface />}
          {surface==='bar'        && <BarSurface />}
          {surface==='orders'     && <OrdersHub />}
          {surface==='kds'        && <KDSSurface />}
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
  { id:'kds',     label:'KDS',    icon:'▣' },
];

function ShiftBar({ shift, version, onWhatsNew, theme, onToggleTheme, syncPulse }) {
  const { deviceConfig, setSurface, orderQueue, tables, tabs } = useStore();
  const terminalName = deviceConfig?.terminalName || 'POS';
  const profileName  = deviceConfig?.profileName;

  // Active order count for Orders Hub button
  const activeOrders = (orderQueue?.filter(o => !['collected','paid'].includes(o.status)).length || 0)
    + (tables?.filter(t => t.status !== 'available').length || 0)
    + (tabs?.filter(t => t.status !== 'closed').length || 0);
  const urlParam     = deviceConfig?.param;

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
  const allOk = syncStatus.printerOnline && syncStatus.paymentTerminalOnline && !syncStatus.pendingChanges;

  const FEATURE_MAP = { kds:'kds', reports:'backoffice' };
  const visibleNav = NAV.filter(n => {
    const featureKey = Object.entries(FEATURE_MAP).find(([,v]) => v === n.id)?.[0];
    return !featureKey || !hidden.includes(featureKey);
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
        {!allOk && <div style={{ position:'absolute', top:6, right:8, width:7, height:7, borderRadius:'50%', background:'var(--acc)', boxShadow:'0 0 6px var(--acc)' }}/>}
        {!deviceConfig && <div style={{ position:'absolute', top:6, right:8, width:7, height:7, borderRadius:'50%', background:'var(--red)', boxShadow:'0 0 6px var(--red)' }}/>}
      </button>

      {/* Back Office button */}
      <button onClick={() => setAppMode('backoffice')} title="Back Office" style={{
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
