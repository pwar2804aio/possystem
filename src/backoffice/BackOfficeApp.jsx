import { useState } from 'react';
import { useStore } from '../store';
import MenuManager from './sections/MenuManager';
import FloorPlanBuilder from './sections/FloorPlanBuilder';
import DeviceProfiles from './sections/DeviceProfiles';
import DeviceRegistry from './sections/DeviceRegistry';
import StaffManager from './sections/StaffManager';
import PrintRouting from './sections/PrintRouting';
import BOReports from './sections/BOReports';

const NAV = [
  { id:'overview',  label:'Overview',       icon:'◈',  group:'Dashboard' },
  { id:'menu',      label:'Menu manager',   icon:'🍽',  group:'Configuration' },
  { id:'floorplan', label:'Floor plan',     icon:'⬚',  group:'Configuration' },
  { id:'profiles',  label:'Device profiles',icon:'📋', group:'Devices' },
  { id:'devices',   label:'Devices',        icon:'📱',  group:'Devices' },
  { id:'staff',     label:'Staff & access', icon:'👥',  group:'Configuration' },
  { id:'printing',  label:'Print routing',  icon:'🖨',  group:'Configuration' },
  { id:'reports',   label:'Reports',        icon:'📊',  group:'Analytics' },
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
          <div style={{ display:'flex', alignItems:'center', gap:14, fontSize:12, color:'var(--t3)' }}>
            <div style={{
              width:7, height:7, borderRadius:'50%',
              background:'var(--grn)', boxShadow:'0 0 6px var(--grn)',
            }}/>
            <span>Live</span>
            <span style={{ color:'var(--bdr2)' }}>·</span>
            <span>{new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })}</span>
          </div>
        </div>

        {/* Sections */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {section === 'overview'  && <BOOverview setSection={setSection} />}
          {section === 'menu'      && <MenuManager />}
          {section === 'floorplan' && <FloorPlanBuilder />}
          {section === 'profiles'  && <DeviceProfiles />}
          {section === 'devices'   && <DeviceRegistry />}
          {section === 'staff'     && <StaffManager />}
          {section === 'printing'  && <PrintRouting />}
          {section === 'reports'   && <BOReports />}
        </div>
      </div>
    </div>
  );
}

// ── Overview dashboard ────────────────────────────────────────────────────────
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
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
    </div>
  );
}
