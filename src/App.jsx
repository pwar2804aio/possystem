import { useState } from 'react';
import './styles/globals.css';
import { useStore } from './store';
import PINScreen from './surfaces/PINScreen';
import POSSurface from './surfaces/POSSurface';
import { TablesSurface, KDSSurface, BackOfficeSurface } from './surfaces/OtherSurfaces';

const NAV = [
  { id:'pos',        icon:'⊞', label:'POS' },
  { id:'tables',     icon:'⬚', label:'Floor' },
  { id:'kds',        icon:'▣',  label:'KDS' },
  { id:'backoffice', icon:'⚙',  label:'Office' },
];

function ShiftBar() {
  const shift = useStore(s => s.shift);
  return (
    <div style={{ height:34, display:'flex', alignItems:'center', gap:16, padding:'0 18px', background:'var(--c-surf)', borderBottom:'1px solid var(--bdr)', flexShrink:0, fontSize:12 }}>
      <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:600, background:'var(--c-grn-dim)', border:'1px solid var(--c-grn-bdr)', color:'var(--c-grn)' }}>● {shift.name}</span>
      <span style={{ color:'var(--c-text3)' }}>Covers: <strong style={{ color:'var(--c-text2)' }}>{shift.covers}</strong></span>
      <span style={{ color:'var(--c-text3)' }}>Sales: <strong style={{ color:'var(--c-text2)' }}>£{shift.sales.toLocaleString()}</strong></span>
      <span style={{ color:'var(--c-text3)' }}>Avg: <strong style={{ color:'var(--c-text2)' }}>£{shift.avgCheck.toFixed(2)}</strong></span>
      <span style={{ marginLeft:'auto', color:'var(--c-text3)' }}>{new Date().toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
    </div>
  );
}

function Toast() {
  const toast = useStore(s => s.toast);
  if (!toast) return null;
  const colors = { success:['var(--c-grn-dim)','var(--c-grn-bdr)','var(--c-grn)'], error:['var(--c-red-dim)','var(--c-red-bdr)','var(--c-red)'], warning:['var(--c-acc-dim)','var(--c-acc-bdr)','var(--c-acc)'], info:['var(--c-raised)','var(--bdr2)','var(--c-text)'] };
  const [bg,bdr,col] = colors[toast.type] || colors.info;
  return <div className="toast" key={toast.key} style={{ background:bg, border:`1px solid ${bdr}`, color:col }}>{toast.msg}</div>;
}

function StaffAvatar() {
  const [open, setOpen] = useState(false);
  const staff = useStore(s => s.staff);
  const logout = useStore(s => s.logout);
  if (!staff) return null;
  return (
    <div style={{ position:'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={{ width:36, height:36, borderRadius:'50%', cursor:'pointer', background:staff.color+'22', border:`2px solid ${staff.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:staff.color }}>
        {staff.initials}
      </div>
      {open && (
        <div style={{ position:'absolute', bottom:44, left:0, background:'var(--c-float)', border:'1px solid var(--bdr2)', borderRadius:10, padding:8, minWidth:160, boxShadow:'var(--shadow-md)', zIndex:50 }}>
          <div style={{ padding:'6px 10px', fontSize:13, fontWeight:500 }}>{staff.name}</div>
          <div style={{ padding:'2px 10px 8px', fontSize:11, color:'var(--c-text3)' }}>{staff.role}</div>
          <div className="divider"/>
          <button onClick={() => { logout(); setOpen(false); }} style={{ width:'100%', padding:'7px 10px', borderRadius:6, cursor:'pointer', background:'transparent', border:'none', color:'var(--c-red)', fontSize:12, textAlign:'left', fontFamily:'inherit' }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { staff, surface, setSurface } = useStore();
  if (!staff) return <PINScreen />;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <ShiftBar />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <nav style={{ width:'var(--sidebar-w)', background:'var(--c-surf)', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:4, flexShrink:0 }}>
          <div style={{ width:38, height:38, background:'var(--c-acc)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'var(--c-inverse)', marginBottom:12 }}>R</div>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSurface(n.id)} style={{ width:48, height:48, borderRadius:10, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, background:surface===n.id?'var(--c-acc-dim)':'transparent', border:`1px solid ${surface===n.id?'var(--c-acc-bdr)':'transparent'}`, color:surface===n.id?'var(--c-acc)':'var(--c-text3)', transition:'all .15s', fontFamily:'inherit' }}>
              <span style={{ fontSize:18 }}>{n.icon}</span>
              <span style={{ fontSize:9, fontWeight:600, letterSpacing:'.03em' }}>{n.label}</span>
            </button>
          ))}
          <div style={{ marginTop:'auto' }}><StaffAvatar /></div>
        </nav>
        <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>
          {surface==='pos'        && <POSSurface />}
          {surface==='tables'     && <TablesSurface />}
          {surface==='kds'        && <KDSSurface />}
          {surface==='backoffice' && <BackOfficeSurface />}
        </div>
      </div>
      <Toast />
    </div>
  );
}
