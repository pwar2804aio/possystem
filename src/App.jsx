import { useState } from 'react';
import './styles/globals.css';
import { useStore } from './store';
import PINScreen from './surfaces/PINScreen';
import POSSurface from './surfaces/POSSurface';
import BarSurface from './surfaces/BarSurface';
import TablesSurface from './surfaces/TablesSurface';
import { KDSSurface, BackOfficeSurface } from './surfaces/OtherSurfaces';

const VERSION = '0.5.3';

const CHANGELOG = [
  {
    version: '0.5.3', date: 'Apr 2026', label: 'Orders list view',
    changes: [
      'Floor plan now has three tabs: Floor plan, My orders, All open orders',
      'My orders filters to the current logged-in server\'s tables only',
      'Each row shows: table, covers, server (all orders), time seated, last activity, running total',
      'Urgency colour coding: green = active, amber = 10+ mins idle, red = 20+ mins idle',
      'Urgency dot pulses and border changes colour — visible at a glance across the shift',
      'Tap any row to open that table directly in POS',
      'Timer refreshes every 30 seconds so colours stay live without a page reload',
    ],
  },
  {
    version: '0.5.2', date: 'Apr 2026', label: 'Full split bill system',
    changes: [
      '4 split modes: Even, By seat, By item, Custom amounts',
      'Each split portion tendered independently with card or cash',
      'Progress bar shows X of N portions paid',
    ],
  },
  {
    version: '0.5.1', date: 'Apr 2026', label: 'Fast checkout',
    changes: [
      'Card and Cash primary buttons at bottom of checkout',
      'Card: tip picker → Stripe Terminal screen',
      'Cash: 12-key numpad, quick cash buttons, live change display',
    ],
  },
  {
    version: '0.5.0', date: 'Apr 2026', label: 'Voids, discounts & history',
    changes: [
      'Void items and checks with manager PIN + reason',
      'Discounts — by amount then select items or whole check',
      'History tab with refund flow (card or cash tender)',
    ],
  },
  {
    version: '0.4.1', date: 'Apr 2026', label: 'Table sessions',
    changes: ['Tables own sessions, floor plan, seat guests modal, live status'],
  },
  {
    version: '0.4.0', date: 'Apr 2026', label: 'Bar tabs',
    changes: ['Full bar tab system with rounds, pre-auth, checkout'],
  },
  {
    version: '0.3.0', date: 'Mar 2026', label: 'Takeaway & collection',
    changes: ['Customer capture, Orders hub, collection slots'],
  },
  {
    version: '0.2.0', date: 'Mar 2026', label: 'POS core ordering',
    changes: ['Variants, modifiers, courses, seat assignment, 86'],
  },
  {
    version: '0.1.0', date: 'Mar 2026', label: 'Foundation',
    changes: ['POS, Quick Screen, allergens, KDS, floor plan, PIN login'],
  },
];

const CHANGELOG = [
  {
    version: '0.5.2', date: 'Apr 2026', label: 'Full split bill system',
    changes: [
      '4 split modes: Even (2–10 ways), By seat (auto from seat assignments), By item (tap items between checks), Custom amounts (each guest enters their share)',
      'By seat: shared items automatically divided evenly across seats',
      'By item: unassigned pool shown at top, tap items to move between 2–4 checks',
      'Custom amounts: live coverage indicator shows shortfall or surplus, add/remove guests',
      'Each split portion tendered independently — card or cash with change calc',
      'Progress bar shows X of N portions paid',
      'Paid portions show green with payment method and change amount',
      'Split closes automatically when all portions are settled',
    ],
  },
  {
    version: '0.5.1', date: 'Apr 2026', label: 'Fast checkout',
    changes: [
      'Two primary buttons — Card (navy) and Cash (green) — at bottom of checkout',
      'Card: tip picker then Stripe Terminal screen with pulsing animation',
      'Cash: full transaction screen with 12-key numpad, quick cash buttons, live change display',
      'Takeaway, collection and bar tabs skip the tip step',
    ],
  },
  {
    version: '0.5.0', date: 'Apr 2026', label: 'Voids, discounts & history',
    changes: [
      'Void committed items and entire checks — manager PIN + reason, full audit trail',
      'Discounts — 2-step: choose amount then select items or whole check',
      'Print check and reprint production tickets',
      'History tab with closed check log and 4-step refund flow (card or cash)',
      'Orders hub tab replacing queue button',
    ],
  },
  {
    version: '0.4.1', date: 'Apr 2026', label: 'Table sessions',
    changes: [
      'Tables own their order sessions — no sync issues',
      'Floor plan with Seat Guests modal, live table status',
      'Send commits to table, payment returns to floor',
    ],
  },
  {
    version: '0.4.0', date: 'Apr 2026', label: 'Bar tabs',
    changes: [
      'Full bar tab system with rounds, pre-auth, roaming tabs',
      'Each round tendered separately via full checkout flow',
    ],
  },
  {
    version: '0.3.0', date: 'Mar 2026', label: 'Takeaway & collection',
    changes: ['Customer capture, collection slots, Orders hub, no service charge on takeaway'],
  },
  {
    version: '0.2.0', date: 'Mar 2026', label: 'POS core ordering',
    changes: ['Variants, modifiers, pizza builder, courses, seat assignment, 86'],
  },
  {
    version: '0.1.0', date: 'Mar 2026', label: 'Foundation',
    changes: ['Three-column POS, Quick Screen, 14 allergens, KDS, floor plan, PIN login'],
  },
];

export default function App() {
  const { staff, surface, setSurface, toast, shift } = useStore();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  if (!staff) return <PINScreen />;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <ShiftBar shift={shift} version={VERSION} onWhatsNew={()=>setShowWhatsNew(true)} />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar surface={surface} setSurface={setSurface} />
        <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>
          {surface==='tables'     && <TablesSurface />}
          {surface==='pos'        && <POSSurface />}
          {surface==='bar'        && <BarSurface />}
          {surface==='kds'        && <KDSSurface />}
          {surface==='backoffice' && <BackOfficeSurface />}
        </div>
      </div>
      {toast && <Toast toast={toast} />}
      {showWhatsNew && <WhatsNewModal onClose={()=>setShowWhatsNew(false)} />}
    </div>
  );
}

const NAV = [
  { id:'tables',     label:'Floor', icon:'⬚' },
  { id:'pos',        label:'POS',   icon:'⊞' },
  { id:'bar',        label:'Bar',   icon:'🍸' },
  { id:'kds',        label:'KDS',   icon:'▣' },
  { id:'backoffice', label:'Office',icon:'⚙' },
];

function ShiftBar({ shift, version, onWhatsNew }) {
  return (
    <div style={{ height:40, display:'flex', alignItems:'center', background:'var(--bg1)', borderBottom:'1px solid var(--bdr2)', flexShrink:0 }}>
      <div style={{ width:'var(--nav)', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', borderRight:'1px solid var(--bdr2)', flexShrink:0 }}>
        <div style={{ width:28, height:28, background:'var(--acc)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#0e0f14' }}>R</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:20, padding:'0 20px', flex:1 }}>
        <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)' }}>● {shift.name}</span>
        <span style={{ fontSize:12, color:'var(--t3)' }}>Covers <strong style={{ color:'var(--t1)', fontWeight:600 }}>{shift.covers}</strong></span>
        <span style={{ fontSize:12, color:'var(--t3)' }}>Sales <strong style={{ color:'var(--t1)', fontWeight:600 }}>£{shift.sales.toLocaleString()}</strong></span>
        <span style={{ fontSize:12, color:'var(--t3)' }}>Avg <strong style={{ color:'var(--t1)', fontWeight:600 }}>£{shift.avgCheck.toFixed(2)}</strong></span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 16px' }}>
        <div style={{ fontSize:12, color:'var(--t3)', fontFamily:'DM Mono, monospace' }}>
          {new Date().toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
        </div>
        <button onClick={onWhatsNew} style={{
          display:'flex', alignItems:'center', gap:5, padding:'3px 9px', borderRadius:20, cursor:'pointer',
          background:'var(--bg3)', border:'1px solid var(--bdr2)', fontFamily:'inherit',
          fontSize:11, fontWeight:700, color:'var(--t3)', transition:'all .15s',
        }}
        onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--acc-b)'; e.currentTarget.style.color='var(--acc)'; }}
        onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--bdr2)'; e.currentTarget.style.color='var(--t3)'; }}>
          <span style={{ fontFamily:'DM Mono, monospace' }}>v{version}</span>
          <span style={{ color:'var(--t4)' }}>·</span>
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
  return (
    <nav style={{ width:'var(--nav)', background:'var(--bg1)', borderRight:'1px solid var(--bdr2)', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:2, flexShrink:0 }}>
      {NAV.map(n=>{
        const active=surface===n.id;
        return(<button key={n.id} onClick={()=>setSurface(n.id)} style={{ width:46, height:46, borderRadius:10, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, background:active?'var(--acc-d)':'transparent', border:`1px solid ${active?'var(--acc-b)':'transparent'}`, color:active?'var(--acc)':'var(--t3)', transition:'all .15s', fontFamily:'inherit' }}>
          <span style={{ fontSize:18, lineHeight:1 }}>{n.icon}</span>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em', color:active?'var(--acc)':'var(--t3)' }}>{n.label}</span>
        </button>);
      })}
      <div style={{ marginTop:'auto' }}><StaffAvatar /></div>
    </nav>
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
