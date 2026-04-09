import { useState } from 'react';
import './styles/globals.css';
import { useStore } from './store';
import PINScreen from './surfaces/PINScreen';
import POSSurface from './surfaces/POSSurface';
import BarSurface from './surfaces/BarSurface';
import { TablesSurface, KDSSurface, BackOfficeSurface } from './surfaces/OtherSurfaces';

const NAV = [
  { id:'pos',        label:'POS',   icon:'⊞' },
  { id:'bar',        label:'Bar',   icon:'🍸' },
  { id:'tables',     label:'Floor', icon:'⬚' },
  { id:'kds',        label:'KDS',   icon:'▣' },
  { id:'backoffice', label:'Office',icon:'⚙' },
];

export default function App() {
  const { staff, surface, setSurface, toast, shift } = useStore();
  if (!staff) return <PINScreen />;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <ShiftBar shift={shift} />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar surface={surface} setSurface={setSurface} />
        <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>
          {surface==='pos'        && <POSSurface />}
          {surface==='bar'        && <BarSurface />}
          {surface==='tables'     && <TablesSurface />}
          {surface==='kds'        && <KDSSurface />}
          {surface==='backoffice' && <BackOfficeSurface />}
        </div>
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  );
}

function ShiftBar({ shift }) {
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
      <div style={{ padding:'0 20px', fontSize:12, color:'var(--t3)', fontFamily:'DM Mono, monospace' }}>
        {new Date().toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
      </div>
    </div>
  );
}

function Sidebar({ surface, setSurface }) {
  const { staff } = useStore();
  return (
    <nav style={{ width:'var(--nav)', background:'var(--bg1)', borderRight:'1px solid var(--bdr2)', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:2, flexShrink:0 }}>
      {NAV.map(n=>{
        const active=surface===n.id;
        return(
          <button key={n.id} onClick={()=>setSurface(n.id)} style={{ width:46,height:46,borderRadius:10,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,background:active?'var(--acc-d)':'transparent',border:`1px solid ${active?'var(--acc-b)':'transparent'}`,color:active?'var(--acc)':'var(--t3)',transition:'all .15s',fontFamily:'inherit' }}>
            <span style={{ fontSize:18,lineHeight:1 }}>{n.icon}</span>
            <span style={{ fontSize:9,fontWeight:700,letterSpacing:'.04em',color:active?'var(--acc)':'var(--t3)' }}>{n.label}</span>
          </button>
        );
      })}
      <div style={{ marginTop:'auto' }}><StaffAvatar /></div>
    </nav>
  );
}

function StaffAvatar() {
  const [open,setOpen]=useState(false);
  const { staff,logout }=useStore();
  if (!staff) return null;
  return(
    <div style={{ position:'relative',marginBottom:8 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ width:34,height:34,borderRadius:'50%',cursor:'pointer',background:staff.color+'22',border:`2px solid ${staff.color}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:staff.color }}>{staff.initials}</div>
      {open&&(
        <div style={{ position:'absolute',bottom:42,left:0,background:'var(--bg3)',border:'1px solid var(--bdr2)',borderRadius:12,padding:8,minWidth:160,boxShadow:'var(--sh3)',zIndex:50 }}>
          <div style={{ padding:'6px 10px',fontSize:13,fontWeight:600,color:'var(--t1)' }}>{staff.name}</div>
          <div style={{ padding:'2px 10px 8px',fontSize:12,color:'var(--t3)' }}>{staff.role}</div>
          <div style={{ height:1,background:'var(--bdr)',margin:'4px 0' }}/>
          <button onClick={()=>{logout();setOpen(false);}} style={{ width:'100%',padding:'7px 10px',borderRadius:8,cursor:'pointer',background:'transparent',border:'none',color:'var(--red)',fontSize:13,textAlign:'left',fontFamily:'inherit',fontWeight:500 }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

function Toast({ toast }) {
  const map={ success:{bg:'var(--grn-d)',bdr:'var(--grn-b)',color:'var(--grn)'},error:{bg:'var(--red-d)',bdr:'var(--red-b)',color:'var(--red)'},warning:{bg:'var(--acc-d)',bdr:'var(--acc-b)',color:'var(--acc)'},info:{bg:'var(--bg3)',bdr:'var(--bdr2)',color:'var(--t1)'} };
  const c=map[toast.type]||map.info;
  return <div className="toast" key={toast.key} style={{ background:c.bg,border:`1px solid ${c.bdr}`,color:c.color }}>{toast.msg}</div>;
}
