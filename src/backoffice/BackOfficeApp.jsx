import { useState } from 'react';
import { useStore } from '../store';
import { broadcastConfigPush } from '../sync/SyncBridge';
import MenuManager from './sections/MenuManager';
import FloorPlanBuilder from './sections/FloorPlanBuilder';
import DeviceProfiles from './sections/DeviceProfiles';
import DeviceRegistry from './sections/DeviceRegistry';
import StaffManager from './sections/StaffManager';
import PrintRouting from './sections/PrintRouting';
import BOReports from './sections/BOReports';
import EODClose from './sections/EODClose';
import MultiLocation from './sections/MultiLocation';
import Inventory from './sections/Inventory';
import SupabaseSetup from '../lib/SupabaseSetup';

const NAV = [
  { id:'overview',   label:'Overview',        icon:'◈',  group:'Dashboard' },
  { id:'menu',       label:'Menu manager',    icon:'🍽',  group:'Configuration' },
  { id:'floorplan',  label:'Floor plan',      icon:'⬚',  group:'Configuration' },
  { id:'inventory',  label:'Inventory',       icon:'📦',  group:'Configuration' },
  { id:'profiles',   label:'Device profiles', icon:'📋',  group:'Devices' },
  { id:'devices',    label:'Devices',         icon:'📱',  group:'Devices' },
  { id:'staff',      label:'Staff & access',  icon:'👥',  group:'Configuration' },
  { id:'printing',   label:'Print routing',   icon:'🖨',  group:'Configuration' },
  { id:'reports',    label:'Reports',         icon:'📊',  group:'Analytics' },
  { id:'eod',        label:'End of day',      icon:'🔒',  group:'Analytics' },
  { id:'locations',   label:'Locations',       icon:'📍',  group:'Organisation' },
];

export default function BackOfficeApp() {
  const { setAppMode, staff, closedChecks, tables, devices } = useStore();
  const [section, setSection] = useState('overview');

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
            }}>R</div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em' }}>Restaurant OS</div>
              <div style={{ fontSize:10, color:'var(--acc)', fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase' }}>Back Office</div>
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
          <button onClick={() => setAppMode('pos')} style={{
            width:'100%', padding:'9px 10px', borderRadius:9,
            cursor:'pointer', textAlign:'left', fontSize:12,
            fontWeight:600, border:'1px solid var(--bdr)',
            fontFamily:'inherit', background:'var(--bg3)',
            color:'var(--t2)', display:'flex', alignItems:'center', gap:8,
            transition:'all .1s',
          }}>
            <span style={{ fontSize:16 }}>←</span> Back to POS
          </button>
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
            {/* Push to POS button */}
            <PushToPOSButton />
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--t3)' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--grn)', boxShadow:'0 0 6px var(--grn)' }}/>
              <span>Live</span>
              <span style={{ color:'var(--bdr2)' }}>·</span>
              <span>{new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}</span>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {section === 'overview'   && <BOOverview setSection={setSection} />}
          {section === 'menu'       && <MenuManager />}
          {section === 'floorplan'  && <FloorPlanBuilder />}
          {section === 'inventory'  && <Inventory />}
          {section === 'profiles'   && <DeviceProfiles />}
          {section === 'devices'    && <DeviceRegistry />}
          {section === 'staff'      && <StaffManager />}
          {section === 'printing'   && <PrintRouting />}
          {section === 'reports'    && <BOReports />}
          {section === 'eod'        && <EODClose />}
          {section === 'locations'   && <MultiLocation />}
        </div>
      </div>
    </div>
  );
}

// ── Push to POS button ────────────────────────────────────────────────────────
function PushToPOSButton() {
  const { pendingBOChanges, clearBOChanges, tables, locationSections, menuItems, menuCategories, quickScreens, activeQuickScreenId, staff } = useStore();
  const [pushing, setPushing] = useState(false);
  const [justPushed, setJustPushed] = useState(false);

  const handlePush = () => {
    setPushing(true);

    // Build config snapshot — layout + menu config (not operational/session state)
    const snapshot = {
      version: Date.now(),
      pushedAt: new Date().toISOString(),
      pushedBy: staff?.name || 'Manager',
      tables: tables.map(t => ({
        id:t.id, label:t.label, x:t.x, y:t.y, w:t.w, h:t.h,
        shape:t.shape, maxCovers:t.maxCovers, section:t.section,
      })),
      locationSections,
      menuItems,
      menuCategories,
      quickScreens,
      activeQuickScreenId,
      changeCount: pendingBOChanges,
    };

    // Persist snapshot so POS tabs that open later can still receive it
    try {
      localStorage.setItem('rpos-config-snapshot', JSON.stringify(snapshot));
    } catch {}

    // Write to Supabase so physical devices on other machines receive it
    import('../lib/db.js').then(({ insertConfigPush }) => insertConfigPush({
      pushed_by: staff?.name || 'Manager',
      snapshot,
      change_count: pendingBOChanges,
    }));

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
function BOOverview({ setSection }) {
  const { closedChecks, tables, devices, staff: currentStaff } = useStore();

  const revenue     = closedChecks.reduce((s, c) => s + c.total, 0);
  const covers      = closedChecks.reduce((s, c) => s + (c.covers || 1), 0);
  const onlineDevs  = devices.filter(d => d.status === 'online').length;
  const activeTbls  = tables.filter(t => (t.status === 'open' || t.status === 'occupied') && !t.parentId).length;

  const stats = [
    { label:"Revenue today",   value:`£${revenue.toFixed(2)}`, color:'var(--acc)', sub:`${closedChecks.length} checks` },
    { label:'Covers',          value:covers,                    color:'var(--blu)', sub:`£${covers > 0 ? (revenue / covers).toFixed(2) : '—'}/head` },
    { label:'Tables active',   value:activeTbls,                color:'var(--grn)', sub:`of ${tables.filter(t => !t.parentId).length} tables` },
    { label:'Terminals online',value:`${onlineDevs}/${devices.length}`, color: onlineDevs === devices.length ? 'var(--grn)' : 'var(--acc)', sub:'this site' },
  ];

  const quickActions = [
    { icon:'🍽', label:'Edit menu',        sub:'Update items, prices, allergens',  target:'menu' },
    { icon:'⬚',  label:'Floor plan',       sub:'Move tables, add sections',       target:'floorplan' },
    { icon:'📋', label:'Device profiles',  sub:'Configure terminal behaviour',    target:'profiles' },
    { icon:'📱', label:'Add terminal',     sub:'Pair a new Sunmi device',         target:'devices' },
    { icon:'👥', label:'Manage staff',     sub:'Add servers, change PINs',        target:'staff' },
    { icon:'🖨', label:'Print routing',    sub:'Route stations to printers',      target:'printing' },
  ];

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <SupabaseSetup />
      <div style={{ marginBottom:28 }}>
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
