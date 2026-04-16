import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { broadcastConfigPush } from '../sync/SyncBridge';
import { supabase, isMock, getLocationId, setResolvedLocationId, clearResolvedLocationId } from '../lib/supabase';
import BOLogin from './BOLogin';
import LocationSwitcher from './LocationSwitcher';
import { VERSION } from '../lib/version';
import MenuManager from './sections/MenuManager';
import FloorPlanBuilder from './sections/FloorPlanBuilder';
import DeviceProfiles from './sections/DeviceProfiles';
import DeviceRegistry from './sections/DeviceRegistry';
import StaffManager from './sections/StaffManager';
import PrintRouting from './sections/PrintRouting';
import PrinterRegistry from './sections/PrinterRegistry';
import BOReports from './sections/BOReports';
import EODClose from './sections/EODClose';
import Inventory from './sections/Inventory';
import SupabaseSetup from '../lib/SupabaseSetup';
import CompanyAdmin from './sections/CompanyAdmin';
import AIAssistantSection from './sections/AIAssistantSection';
import LocationSettings from './sections/LocationSettings';

const NAV = [
  { id:'overview',   label:'Overview',        icon:'◈',  group:'Dashboard' },
  { id:'menu',       label:'Menu manager',    icon:'🍽',  group:'Configuration' },
  { id:'floorplan',  label:'Floor plan',      icon:'⬚',  group:'Configuration' },
  { id:'inventory',  label:'Inventory',       icon:'📦',  group:'Configuration' },
  { id:'profiles',   label:'Device profiles', icon:'📋',  group:'Devices' },
  { id:'devices',    label:'Devices',         icon:'📱',  group:'Devices' },
  { id:'printers',   label:'Printers',        icon:'🖨',  group:'Devices' },
  { id:'staff',      label:'Staff & access',  icon:'👥',  group:'Configuration' },
  { id:'printing',   label:'Production printing',   icon:'🖨',  group:'Configuration' },
  { id:'reports',    label:'Reports',         icon:'📊',  group:'Analytics' },
  { id:'eod',        label:'End of day',      icon:'🔒',  group:'Analytics' },
  { id:'ai',         label:'AI Assistant',    icon:'✦',  group:'Analytics' },
  { id:'location',   label:'Location settings', icon:'⚙️', group:'Analytics' },
];

export default function BackOfficeApp() {
  const { setAppMode, staff, closedChecks, tables, devices } = useStore();
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(isMock);
  const [section, setSection] = useState('overview');
  const [orgCtx, setOrgCtx] = useState(null); // { orgName, locationName, locationId, orgId, role }
  const [showLocationSwitcher, setShowLocationSwitcher] = useState(false);

  // Check Supabase session on mount
  useEffect(() => {
    if (isMock) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data?.session?.user || null);
      setAuthChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load org/location context once user is known
  useEffect(() => {
    if (!authUser || isMock) return;
    (async () => {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, org_id, location_id, organisations(name), locations(name)')
        .eq('id', authUser.id)
        .single();
      if (profile) {
        setOrgCtx({
          role: profile.role,
          orgId: profile.org_id,
          orgName: profile.organisations?.name || 'Restaurant OS',
          locationId: profile.location_id,
          locationName: profile.locations?.name || null,
        });
        if (profile.location_id) {
          setResolvedLocationId(profile.location_id);
          // Load all location data from Supabase
          loadLocationData(profile.location_id);
        }
      }
    })();
  }, [authUser]);

  const loadLocationData = async (locationId) => {
    if (!locationId) return;
    const { fetchMenus, fetchMenuCategories, fetchMenuItems, fetchFloorPlan } = await import('../lib/db.js');
    const [menusRes, catsRes, itemsRes, floorRes, modGroupsRes] = await Promise.all([
      fetchMenus(locationId),
      fetchMenuCategories(locationId),
      fetchMenuItems(locationId),
      fetchFloorPlan(locationId),
      // Load modifier group definitions from Supabase
      supabase ? supabase.from('modifier_groups').select('*').eq('location_id', locationId).order('sort_order') : { data: null },
    ]);
    const { useStore } = await import('../store/index.js');
    const patch = {};
    if (menusRes.data?.length)   patch.menus          = menusRes.data;
    if (catsRes.data?.length)    patch.menuCategories  = catsRes.data.map(c => ({
      ...c,
      menuId: c.menu_id ?? c.menuId,
      parentId: c.parent_id ?? c.parentId,
      accountingGroup: c.accounting_group ?? c.accountingGroup,
      sortOrder: c.sort_order ?? c.sortOrder,
      defaultCourse: c.default_course ?? c.defaultCourse ?? 1,
    }));
    if (itemsRes.data?.length)   patch.menuItems       = itemsRes.data.map(item => ({
      ...item,
      menuName:    item.menu_name    ?? item.menuName    ?? item.name ?? 'Item',
      receiptName: item.receipt_name ?? item.receiptName ?? item.name ?? 'Item',
      kitchenName: item.kitchen_name ?? item.kitchenName ?? item.name ?? 'Item',
      sortOrder:   item.sort_order   ?? item.sortOrder   ?? 0,
      isDefault:   item.is_default   ?? item.isDefault,
      soldAlone:   item.sold_alone   ?? item.soldAlone,
      parentId:    item.parent_id    ?? item.parentId,
      assignedModifierGroups: item.assigned_modifier_groups ?? item.assignedModifierGroups ?? [],
    }));
    if (floorRes.data?.tables?.length) patch.tables = floorRes.data.tables;
    // Map modifier groups from snake_case DB columns to camelCase store format
    if (modGroupsRes.data?.length) patch.modifierGroupDefs = modGroupsRes.data.map(g => ({
      id: g.id, name: g.name, min: g.min ?? 0, max: g.max ?? 1,
      selectionType: g.selection_type ?? 'single',
      options: g.options ?? [],
      sortOrder: g.sort_order ?? 0,
    }));
    if (Object.keys(patch).length) useStore.setState(patch);
  };

  // Show spinner while checking session
  if (!authChecked) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ color:'var(--t3)', fontSize:13 }}>Loading…</div>
    </div>
  );

  // Show login screen if not authenticated
  if (!authUser && !isMock) return <BOLogin onLogin={setAuthUser} />;

  const groups = [...new Set(NAV.map(n => n.group))];

  return (
    <div style={{
      display:'flex', height:'100vh', background:'var(--bg)', color:'var(--t1)',
      fontFamily:'inherit', overflow:'hidden',
    }}>
      {/* ── Sidebar ─────────────────────────────────────── */}
      <div style={{
        width:228, background:'var(--bg1)', borderRight:'1px solid var(--bdr)',
        display:'flex', flexDirection:'column', flexShrink:0,
      }}>
        {/* Brand */}
        <div style={{ padding:'16px 16px 14px', borderBottom:'1px solid var(--bdr)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:34, height:34, borderRadius:9,
              background:'var(--acc)', display:'flex',
              alignItems:'center', justifyContent:'center',
              fontSize:16, fontWeight:800, color:'#0b0c10', flexShrink:0,
            }}>{orgCtx?.orgName?.[0] || 'R'}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em' }}>
                {orgCtx?.orgName || 'Restaurant OS'}
              </div>
              <div style={{ fontSize:10, color:'var(--acc)', fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase' }}>
                {orgCtx?.locationName || 'Back Office'}
              </div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 8px' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom:20 }}>
              <div style={{
                fontSize:9, fontWeight:800, color:'var(--t4)',
                textTransform:'uppercase', letterSpacing:'.1em',
                padding:'0 10px', marginBottom:4,
              }}>{group}</div>
              {NAV.filter(n => n.group === group).map(n => {
                const active = section === n.id;
                return (
                  <button key={n.id} onClick={() => setSection(n.id)} style={{
                    width:'100%', padding:'8px 10px', borderRadius:9,
                    cursor:'pointer', textAlign:'left', fontSize:13,
                    fontWeight: active ? 700 : 400, border:'none',
                    fontFamily:'inherit',
                    background: active ? 'var(--acc-d)' : 'transparent',
                    color: active ? 'var(--acc)' : 'var(--t2)',
                    marginBottom:1, display:'flex', alignItems:'center', gap:9,
                    borderLeft:`2px solid ${active ? 'var(--acc)' : 'transparent'}`,
                    transition:'all .1s',
                  }}>
                    <span style={{ fontSize:14, width:18, textAlign:'center' }}>{n.icon}</span>
                    {n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:'10px 8px 14px', borderTop:'1px solid var(--bdr)' }}>
          <div style={{
            padding:'8px 10px', marginBottom:6,
            fontSize:12, color:'var(--t3)',
            display:'flex', alignItems:'center', gap:8,
          }}>
            <div style={{
              width:26, height:26, borderRadius:'50%',
              background:'var(--acc-d)', border:'1.5px solid var(--acc-b)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:10, fontWeight:800, color:'var(--acc)', flexShrink:0,
            }}>{staff?.initials || 'MG'}</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{staff?.name || 'Manager'}</div>
              <div style={{ fontSize:10, color:'var(--t4)' }}>{staff?.role || 'Admin'}</div>
            </div>
          </div>
          <button onClick={() => { localStorage.removeItem('rpos-device'); localStorage.removeItem('rpos-device-config'); localStorage.setItem('rpos-device-mode','pos'); window.location.href = '?mode=pos'; }} style={{
            width:'100%', padding:'9px 10px', borderRadius:9,
            cursor:'pointer', textAlign:'left', fontSize:12,
            fontWeight:600, border:'1px solid var(--bdr)',
            fontFamily:'inherit', background:'var(--bg3)',
            color:'var(--t2)', display:'flex', alignItems:'center', gap:8,
            transition:'all .1s', marginBottom:6,
          }}>
            <span style={{ fontSize:16 }}>←</span> Back to POS
          </button>
          {!isMock && (
            <button onClick={() => setShowLocationSwitcher(true)} style={{
              width:'100%', padding:'9px 10px', borderRadius:9,
              cursor:'pointer', textAlign:'left', fontSize:12,
              fontWeight:600, border:'1px solid var(--bdr)',
              fontFamily:'inherit', background:'transparent',
              color:'var(--t3)', display:'flex', alignItems:'center', gap:8,
              marginBottom:6, transition:'all .1s',
            }}>
              <span>📍</span> Switch location
            </button>
          )}
          {authUser && !isMock && (
            <button onClick={() => { clearResolvedLocationId(); supabase.auth.signOut(); }} style={{
              width:'100%', padding:'8px 10px', borderRadius:9,
              cursor:'pointer', textAlign:'left', fontSize:12,
              fontWeight:600, border:'1px solid var(--bdr)',
              fontFamily:'inherit', background:'transparent',
              color:'var(--t4)', display:'flex', alignItems:'center', gap:8,
            }}>
              <span>⎋</span> Sign out
            </button>
          )}
          {!isMock && (
            <button onClick={() => { localStorage.removeItem('rpos-device-mode'); window.location.href = '/'; }} style={{
              width:'100%', padding:'6px 10px', borderRadius:9, marginTop:4,
              cursor:'pointer', textAlign:'left', fontSize:11,
              fontWeight:600, border:'none',
              fontFamily:'inherit', background:'transparent',
              color:'var(--t4)', display:'flex', alignItems:'center', gap:8,
            }}>
              <span>↩</span> Switch device mode
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Top bar */}
        <div style={{
          height:52, borderBottom:'1px solid var(--bdr)',
          background:'var(--bg1)', display:'flex',
          alignItems:'center', justifyContent:'space-between',
          padding:'0 24px', flexShrink:0,
        }}>
          <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>
            {NAV.find(n => n.id === section)?.label}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {/* Quick nav — switch between modes */}
            <div style={{ display:'flex', gap:4 }}>
              <a href="?mode=pos" onClick={() => { localStorage.removeItem('rpos-device'); localStorage.removeItem('rpos-device-config'); }} style={{ padding:'5px 12px', borderRadius:7, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t2)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textDecoration:'none', display:'flex', alignItems:'center', gap:5 }}>🖥 POS</a>
              <a href="?mode=office" style={{ padding:'5px 12px', borderRadius:7, border:'1px solid var(--acc-b)', background:'var(--acc-d)', color:'var(--acc)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textDecoration:'none' }}>🏢 Office</a>
              <a href="?mode=admin" style={{ padding:'5px 12px', borderRadius:7, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t3)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textDecoration:'none' }}>🔐 Admin</a>
            </div>
            {/* Push to POS button */}
            <PushToPOSButton />
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--t3)' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--grn)', boxShadow:'0 0 6px var(--grn)' }}/>
              <span>Live</span>
              <span style={{ color:'var(--bdr2)' }}>·</span>
              <span>{new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}</span>
              <span style={{ color:'var(--bdr2)' }}>·</span>
              <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--t4)' }}>{VERSION}</span>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {section === 'overview'   && <BOOverview setSection={setSection} orgCtx={orgCtx} />}
          {section === 'menu'       && <MenuManager />}
          {section === 'floorplan'  && <FloorPlanBuilder />}
          {section === 'inventory'  && <Inventory />}
          {section === 'profiles'   && <DeviceProfiles />}
          {section === 'devices'    && <DeviceRegistry />}
          {section === 'printers'   && <PrinterRegistry />}
          {section === 'staff'      && <StaffManager />}
          {section === 'printing'   && <PrintRouting />}
          {section === 'reports'    && <BOReports />}
          {section === 'eod'        && <EODClose />}
          {section === 'admin'       && <CompanyAdmin />}
          {section === 'ai'         && <AIAssistantSection />}
          {section === 'location'   && <LocationSettings />}
        </div>
      </div>
      {showLocationSwitcher && <LocationSwitcher onClose={() => setShowLocationSwitcher(false)} />}
    </div>
  );
}

// ── Push to POS button ────────────────────────────────────────────────────────
function PushToPOSButton() {
  const { pendingBOChanges, clearBOChanges, tables, locationSections, menuItems, menuCategories, menus, staff } = useStore();
  const [pushing, setPushing] = useState(false);
  const [justPushed, setJustPushed] = useState(false);

  const handlePush = async () => {
    setPushing(true);

    // Build config snapshot — layout + menu config (not operational/session state)
    // Include print routing config in snapshot
    // Load routing from Supabase (source of truth), fall back to localStorage
    let printRouting = { centres:[], routing:{} };
    let printers = [];
    try {
      const locId = await getLocationId();
      if (locId && supabase) {
        const [rtRes, prnRes] = await Promise.all([
          supabase.from('print_routing').select('centres,routing').eq('location_id', locId).single(),
          supabase.from('printers').select('*').eq('location_id', locId),
        ]);
        if (rtRes.data) printRouting = { centres: rtRes.data.centres||[], routing: rtRes.data.routing||{} };
        if (prnRes.data) printers = prnRes.data.map(r => ({ id:r.id, name:r.name, model:r.meta?.model, connectionType:r.connection, address:r.ip, port:r.port||9100, paperWidth:r.paper_width||80, roles:r.meta?.roles||[], location:r.meta?.location||'' }));
      }
    } catch {}
    // Fallback to localStorage if Supabase failed
    if (!printRouting.centres.length) {
      try { printRouting = JSON.parse(localStorage.getItem('rpos-print-routing') || 'null') || { centres:[], routing:{} }; } catch {}
    }
    if (!printers.length) {
      try { printers = JSON.parse(localStorage.getItem('rpos-printers') || '[]'); } catch {}
    }
    const deviceProfiles = (() => { try { return JSON.parse(localStorage.getItem('rpos-device-profiles') || 'null') || []; } catch { return []; } })();

    const snapshot = {
      version: Date.now(),
      pushedAt: new Date().toISOString(),
      pushedBy: staff?.name || 'Manager',
      printRouting: printRouting || { centres:[], routing:{} },
      printers,
      tables: tables.map(t => ({
        id:t.id, label:t.label, x:t.x, y:t.y, w:t.w, h:t.h,
        shape:t.shape, maxCovers:t.maxCovers, section:t.section,
      })),
      locationSections,
      menus,
      menuItems,
      menuCategories,
      quickScreenIds: useStore.getState().quickScreenIds || [],
      changeCount: pendingBOChanges,
      profiles: deviceProfiles,
      modifierGroupDefs: useStore.getState().modifierGroupDefs || [],
      instructionGroupDefs: useStore.getState().instructionGroupDefs || [],
    };

    // Persist snapshot so POS tabs that open later can still receive it
    try {
      localStorage.setItem('rpos-config-snapshot', JSON.stringify(snapshot));
    } catch {}

    // Write to Supabase so physical devices on other machines receive it
    // Write to Supabase scoped to this location so POS devices on other machines receive it
    import('../lib/db.js').then(async ({ insertConfigPush }) => {
      const { getLocationId } = await import('../lib/supabase.js');
      const locationId = await getLocationId();
      insertConfigPush({ pushed_by: staff?.name || 'Manager', snapshot, change_count: pendingBOChanges }, locationId);
    });

    // Broadcast to all open POS terminals in this browser session
    broadcastConfigPush(snapshot);

    clearBOChanges();
    setPushing(false);
    setJustPushed(true);
    setTimeout(() => setJustPushed(false), 3000);
  };

  if (justPushed) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 14px', borderRadius:10, background:'var(--grn-d)', border:'1px solid var(--grn-b)' }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--grn)' }}/>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--grn)' }}>Pushed to all terminals</span>
      </div>
    );
  }

  return (
    <button
      onClick={handlePush}
      disabled={pushing}
      style={{
        display:'flex', alignItems:'center', gap:8,
        padding:'7px 16px', borderRadius:10, cursor:'pointer',
        fontFamily:'inherit', fontSize:13, fontWeight:700, border:'none',
        background: pendingBOChanges > 0 ? 'var(--acc)' : 'var(--bg3)',
        color: pendingBOChanges > 0 ? '#0b0c10' : 'var(--t3)',
        transition:'all .15s',
        boxShadow: pendingBOChanges > 0 ? '0 0 12px var(--acc-b)' : 'none',
      }}
    >
      {pendingBOChanges > 0 && (
        <span style={{
          fontSize:10, fontWeight:800, padding:'1px 6px', borderRadius:20,
          background:'rgba(0,0,0,.2)', color:'inherit',
        }}>{pendingBOChanges}</span>
      )}
      <span>Push to POS</span>
      <span style={{ fontSize:15 }}>→</span>
    </button>
  );
}
function BOOverview({ setSection, orgCtx }) {
  const { closedChecks, tables, devices, activeSessions, staff: currentStaff } = useStore();

  // Today = since midnight local time
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayChecks = closedChecks.filter(c => c.closedAt && new Date(c.closedAt) >= todayStart);

  // Open orders = active sessions with items (not yet paid)
  const openOrdersValue = Object.values(activeSessions || {})
    .filter(s => s?.items?.length > 0)
    .reduce((sum, s) => sum + s.items.reduce((t, i) => t + (i.price || 0) * (i.qty || 1), 0), 0);
  const openOrdersCount = Object.values(activeSessions || {}).filter(s => s?.items?.length > 0).length;

  const revenue     = todayChecks.reduce((s, c) => s + c.total, 0);
  const covers      = todayChecks.reduce((s, c) => s + (c.covers || 1), 0);
  const onlineDevs  = devices.filter(d => d.status === 'online').length;
  const activeTbls  = tables.filter(t => (t.status === 'open' || t.status === 'occupied') && !t.parentId).length;

  const stats = [
    { label:"Revenue today",   value:`£${revenue.toFixed(2)}`, color:'var(--acc)', sub:`${todayChecks.length} closed checks` },
    { label:'Covers today',    value:covers,                    color:'var(--blu)', sub:`£${covers > 0 ? (revenue / covers).toFixed(2) : '0.00'}/head` },
    { label:'Tables active',   value:activeTbls,                color:'var(--grn)', sub:`of ${tables.filter(t => !t.parentId).length} tables` },
    { label:'Terminals online',value:`${onlineDevs}/${devices.length}`, color: onlineDevs === devices.length ? 'var(--grn)' : 'var(--acc)', sub:'this site' },
  ];

  const quickActions = [
    { icon:'🍽', label:'Edit menu',        sub:'Update items, prices, allergens',  target:'menu' },
    { icon:'⬚',  label:'Floor plan',       sub:'Move tables, add sections',       target:'floorplan' },
    { icon:'📋', label:'Device profiles',  sub:'Configure terminal behaviour',    target:'profiles' },
    { icon:'📱', label:'Add terminal',       sub:'Pair a new Sunmi device',                    target:'devices' },
    { icon:'🖨', label:'Manage printers',    sub:'Add NT311 and other ESC/POS printers',       target:'printers' },
    { icon:'👥', label:'Manage staff',       sub:'Add servers, change PINs',                   target:'staff' },
    { icon:'🗺', label:'Production printing', sub:'Route orders to kitchen & receipt printers', target:'printing' },
  ];

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <SupabaseSetup />

      {/* No location warning */}
      {!orgCtx?.locationId && !isMock && (
        <div style={{ padding:'14px 18px', borderRadius:10, background:'#fef9c3', border:'1px solid #fde047', marginBottom:20, fontSize:13 }}>
          <strong>⚠️ No location assigned to your account.</strong> Go to <button onClick={() => setSection('admin')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--acc)', fontWeight:700, fontSize:13, padding:0, textDecoration:'underline' }}>Company Admin</button> → create an organisation and location first.
        </div>
      )}

      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--acc)', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:4 }}>
          {orgCtx?.locationName ? `${orgCtx.orgName} · ${orgCtx.locationName}` : orgCtx?.orgName || 'Restaurant OS'}
        </div>
        <div style={{ fontSize:24, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em', marginBottom:4 }}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
          {currentStaff?.name ? `, ${currentStaff.name}` : ''}
        </div>
        <div style={{ fontSize:13, color:'var(--t3)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:28 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background:'var(--bg1)', border:'1px solid var(--bdr)',
            borderRadius:14, padding:'18px 20px',
          }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>{s.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:s.color, fontFamily:'var(--font-mono)', letterSpacing:'-.02em' }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ fontSize:13, fontWeight:700, color:'var(--t2)', marginBottom:12 }}>Quick actions</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:28 }}>
        {quickActions.map(a => (
          <button key={a.label} onClick={() => setSection(a.target)} style={{
            background:'var(--bg1)', border:'1px solid var(--bdr)',
            borderRadius:14, padding:'16px 18px', cursor:'pointer',
            textAlign:'left', fontFamily:'inherit', transition:'all .14s',
            display:'flex', alignItems:'flex-start', gap:12,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--acc-b)'; e.currentTarget.style.background = 'var(--acc-d)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)'; e.currentTarget.style.background = 'var(--bg1)'; }}>
            <span style={{ fontSize:22, flexShrink:0 }}>{a.icon}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:3 }}>{a.label}</div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Terminal simulator */}
      <div style={{ fontSize:13, fontWeight:700, color:'var(--t2)', marginBottom:12 }}>Open terminals for testing</div>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:'18px 20px', marginBottom:20 }}>
        <div style={{ fontSize:12, color:'var(--t3)', marginBottom:16, lineHeight:1.5 }}>
          Each URL below opens an independent POS terminal in a new tab — different profile, separate session storage. Open multiple at once to test how the bar terminal differs from the counter.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
          {[
            { param:'counter',  label:'Counter 1',    profile:'Main counter',    icon:'🖥', color:'#3b82f6', desc:'Full features, all order types' },
            { param:'counter2', label:'Counter 2',    profile:'Main counter',    icon:'🖥', color:'#3b82f6', desc:'Second counter terminal' },
            { param:'bar',      label:'Bar',          profile:'Bar terminal',    icon:'🍸', color:'#e8a020', desc:'Bar tabs default, dine-in only' },
            { param:'handheld', label:'Handheld 1',   profile:'Server handheld', icon:'📱', color:'#22c55e', desc:'POS default, dine-in only' },
            { param:'kiosk',    label:'Kiosk 1',      profile:'Kiosk',           icon:'⬜', color:'#a855f7', desc:'Self-service, no staff features' },
            { param:'kds',      label:'KDS',          profile:'Kitchen display',  icon:'📋', color:'#ef4444', desc:'Kitchen display only' },
          ].map(t => {
            const url = `${window.location.origin}${window.location.pathname}?t=${t.param}`;
            return (
              <div key={t.param} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{t.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{t.label}</div>
                  <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{t.desc}</div>
                </div>
                <a href={url} target="_blank" rel="noopener" style={{
                  padding:'5px 12px', borderRadius:8, textDecoration:'none',
                  background:`${t.color}22`, border:`1px solid ${t.color}44`,
                  color:t.color, fontSize:11, fontWeight:700, flexShrink:0, cursor:'pointer',
                }}>Open ↗</a>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:12, fontSize:11, color:'var(--t4)', padding:'8px 12px', background:'var(--bg3)', borderRadius:8 }}>
          💡 Each tab has independent state — ordering on the bar tab doesn't affect the counter tab until Supabase sync is enabled in Phase 2
        </div>
      </div>
    </div>
  );
}
