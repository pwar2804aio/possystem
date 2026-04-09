import { useState } from 'react';
import './styles/globals.css';
import { useStore } from './store';
import PINScreen from './surfaces/PINScreen';
import POSSurface from './surfaces/POSSurface';
import { TablesSurface, KDSSurface, BackOfficeSurface } from './surfaces/OtherSurfaces';

const NAV = [
  { id:'pos',        label:'POS',   icon:'⊞' },
  { id:'tables',     label:'Floor', icon:'⬚' },
  { id:'kds',        label:'KDS',   icon:'▣'  },
  { id:'backoffice', label:'Office',icon:'⚙'  },
];

export default function App() {
  const { staff, surface, setSurface, toast, shift } = useStore();
  if (!staff) return <PINScreen />;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

      {/* Shift bar */}
      <div style={{ height:38, display:'flex', alignItems:'center', gap:0, background:'var(--bg1)', borderBottom:'1px solid var(--bdr)', flexShrink:0, fontSize:12 }}>
        {/* Logo */}
        <div style={{ width:'var(--nav)', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', borderRight:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ width:28, height:28, background:'var(--acc)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#0c0c0f', letterSpacing:'-.02em' }}>R</div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:16, padding:'0 18px', flex:1 }}>
          <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)', letterSpacing:'.02em' }}>
            ● {shift.name}
          </span>
          <span style={{ color:'var(--t3)' }}>Covers: <strong style={{ color:'var(--t2)', fontWeight:600 }}>{shift.covers}</strong></span>
          <span style={{ color:'var(--t3)' }}>Sales: <strong style={{ color:'var(--t2)', fontWeight:600 }}>£{shift.sales.toLocaleString()}</strong></span>
          <span style={{ color:'var(--t3)' }}>Avg: <strong style={{ color:'var(--t2)', fontWeight:600 }}>£{shift.avgCheck.toFixed(2)}</strong></span>
        </div>

        <div style={{ padding:'0 18px', fontSize:11, color:'var(--t3)', fontFamily:'DM Mono,monospace' }}>
          {new Date().toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Nav sidebar */}
        <nav style={{ width:'var(--nav)', background:'var(--bg1)', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 0', gap:2, flexShrink:0 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSurface(n.id)} style={{
              width:46, height:46, borderRadius:12, cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
              background: surface===n.id ? 'var(--acc-d)' : 'transparent',
              border:`1px solid ${surface===n.id ? 'var(--acc-b)' : 'transparent'}`,
              color: surface===n.id ? 'var(--acc)' : 'var(--t3)',
              transition:'all .15s', fontFamily:'inherit',
            }}>
              <span style={{ fontSize:20, lineHeight:1 }}>{n.icon}</span>
              <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em' }}>{n.label}</span>
            </button>
          ))}
          <div style={{ marginTop:'auto' }}>
            <StaffAvatar />
          </div>
        </nav>

        {/* Surface */}
        <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>
          {surface==='pos'        && <POSSurface />}
          {surface==='tables'     && <TablesSurface />}
          {surface==='kds'        && <KDSSurface />}
          {surface==='backoffice' && <BackOfficeSurface />}
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast toast={toast}/>}
    </div>
  );
}

function StaffAvatar() {
  const [open, setOpen] = useState(false);
  const staff  = useStore(s => s.staff);
  const logout = useStore(s => s.logout);
  if (!staff) return null;
  return (
    <div style={{ position:'relative', marginBottom:8 }}>
      <div onClick={() => setOpen(o=>!o)} style={{ width:36, height:36, borderRadius:'50%', cursor:'pointer', background:staff.color+'22', border:`2px solid ${staff.color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:staff.color }}>
        {staff.initials}
      </div>
      {open && (
        <div style={{ position:'absolute', bottom:44, left:0, background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:12, padding:8, minWidth:160, boxShadow:'var(--sh3)', zIndex:50 }}>
          <div style={{ padding:'6px 10px', fontSize:13, fontWeight:600, color:'var(--t1)' }}>{staff.name}</div>
          <div style={{ padding:'2px 10px 8px', fontSize:11, color:'var(--t3)' }}>{staff.role}</div>
          <div style={{ height:1, background:'var(--bdr)', margin:'4px 0' }}/>
          <button onClick={() => { logout(); setOpen(false); }} style={{ width:'100%', padding:'7px 10px', borderRadius:8, cursor:'pointer', background:'transparent', border:'none', color:'var(--red)', fontSize:12, textAlign:'left', fontFamily:'inherit' }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function Toast({ toast }) {
  const c = {
    success:['var(--grn-d)','var(--grn-b)','var(--grn)'],
    error:  ['var(--red-d)','var(--red-b)','var(--red)'],
    warning:['rgba(232,160,32,.12)','rgba(232,160,32,.3)','var(--acc)'],
    info:   ['var(--bg3)','var(--bdr2)','var(--t1)'],
  }[toast.type] || ['var(--bg3)','var(--bdr2)','var(--t1)'];
  return <div className="toast" key={toast.key} style={{ background:c[0], border:`1px solid ${c[1]}`, color:c[2] }}>{toast.msg}</div>;
}
