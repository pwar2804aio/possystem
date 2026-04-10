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

const VERSION = '0.8.9';

const CHANGELOG = [
  {
    version: '0.7.9', date: 'Apr 2026', label: 'Modifier groups, kiosk surface',
    changes: [
      'Menu Manager: full modifier groups editor — add groups (name, required/optional, single/multi-select), add options with prices, remove groups and options. Edit modal now has a Modifiers tab alongside Details, Allergens, Daily count',
      'Modifier groups save to store and push via Push to POS — POS ordering modal already handles them',
      'Kiosk surface (?t=kiosk) — full customer-facing UI: category/popular tabs, search, large product grid, cart panel, modifier picker modal, order confirmation with order number',
      'Kiosk renders full-screen with no staff sidebar, shift bar, or management features',
      'Kiosk sends order to kitchen via sendToKitchen on Place order — appears in KDS immediately',
      'EOD Close: full shift summary, EOD checklist with cash variance, manager notes, two-step confirm',
      'Quick screen profile-aware: bar terminal shows bar/drinks items first, 86\'d items removed and padded with available alternatives',
      'KDS auto-filters to bar station (pc4) when terminal profile has assignedSection=bar',
    ],
  },
  {
    version: '0.7.8', date: 'Apr 2026', label: 'Quick screen, EOD close, KDS centre filter',
    changes: ['Profile-aware quick screen, EOD close flow, KDS production centre filter'],
  },
  {
    version: '0.7.7', date: 'Apr 2026', label: 'Live shift stats + full BO reports',
    changes: ['Live shift stats from closedChecks, BOReports with top items and hourly chart'],
  },
  {
    version: '0.7.6', date: 'Apr 2026', label: 'Menu edits live end-to-end',
    changes: ['Menu items editable in BO, POS reads store, push snapshot includes menu'],
  },
  {
    version: '0.7.5', date: 'Apr 2026', label: 'Back Office publish workflow',
    changes: ['"Push to POS", POS sync banner, config snapshot'],
  },
  {
    version: '0.7.0', date: 'Apr 2026', label: '⚙ Back Office Portal',
    changes: ['Menu manager, floor plan, device profiles, devices, staff, print routing'],
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
  { id:'tables',  label:'Floor',  icon:'⬚' },
  { id:'pos',     label:'POS',    icon:'⊞' },
  { id:'bar',     label:'Bar',    icon:'🍸' },
  { id:'orders',  label:'Orders', icon:'📋' },
  { id:'kds',     label:'KDS',    icon:'▣' },
];

function ShiftBar({ shift, version, onWhatsNew, theme, onToggleTheme, syncPulse }) {
  const { deviceConfig } = useStore();
  const terminalName = deviceConfig?.terminalName || 'POS';
  const profileName  = deviceConfig?.profileName;
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
  const { setAppMode, syncStatus, deviceConfig, orderQueue, tables, tabs } = useStore();
  const [showStatus, setShowStatus] = useState(false);

  const hidden = deviceConfig?.hiddenFeatures || [];
  const allOk = syncStatus.printerOnline && syncStatus.paymentTerminalOnline && !syncStatus.pendingChanges;

  // Active order counts for badge
  const activeOrderCount = (orderQueue?.filter(o => !['collected','paid'].includes(o.status)).length || 0)
    + (tables?.filter(t => t.status !== 'available').length || 0)
    + (tabs?.filter(t => t.status !== 'closed').length || 0);

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
          {n.id==='orders' && activeOrderCount > 0 && (
            <div style={{ position:'absolute', top:5, right:5, minWidth:16, height:16, borderRadius:8, background:'var(--acc)', color:'#0b0c10', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', lineHeight:1 }}>
              {activeOrderCount > 99 ? '99+' : activeOrderCount}
            </div>
          )}
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
