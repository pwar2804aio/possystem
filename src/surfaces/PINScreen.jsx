import { useState } from 'react';
import { useStore } from '../store';

export default function PINScreen() {
  const { login, staffMembers } = useStore();
  const staff = staffMembers && staffMembers.length ? staffMembers : [];
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [skipMode, setSkipMode] = useState(false);

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  const tap = (k) => {
    if (!sel) return;
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (!sel.pin || next === sel.pin) {
          login(sel);
        } else {
          setShake(true);
          setPin('');
          setTimeout(() => setShake(false), 600);
        }
      }, 100);
    }
  };

  // Quick login — if staff has no PIN set, can tap their card to log straight in
  const handleCardTap = (s) => {
    setSel(s);
    setPin('');
    if (!s.pin) {
      // No PIN set — log in immediately
      setTimeout(() => login(s), 150);
    }
  };

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', minHeight:'100vh', gap:32,
      background:'var(--bg)',
    }}>
      {/* Logo */}
      <div style={{ textAlign:'center' }}>
        <div style={{ width:56, height:56, background:'var(--acc)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, color:'#0e0f14', margin:'0 auto 14px' }}>R</div>
        <div style={{ fontSize:22, fontWeight:800, color:'var(--t1)', letterSpacing:'-.02em' }}>Restaurant OS</div>
        <div style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>
          {staff.length ? 'Select your profile to continue' : 'No staff configured — go to Back Office → Staff'}
        </div>
      </div>

      {/* Staff cards */}
      {staff.length > 0 && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', maxWidth:480 }}>
          {staff.map(s => {
            const color = s.color || '#3b82f6';
            const isSelected = sel?.id === s.id;
            return (
              <button key={s.id} onClick={() => handleCardTap(s)} style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                padding:'16px 20px', minWidth:92,
                background: isSelected ? color+'18' : 'var(--bg3)',
                border:`2px solid ${isSelected ? color : 'var(--bdr)'}`,
                borderRadius:16, cursor:'pointer', transition:'all .14s', fontFamily:'inherit',
              }}>
                <div style={{ width:46, height:46, borderRadius:'50%', background:color+'22', border:`2px solid ${color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color }}>
                  {(s.initials || (s.name||'?').slice(0,2)).toUpperCase()}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:isSelected?color:'var(--t1)' }}>{s.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', fontWeight:500 }}>
                  {s.role}{s.pin ? ' · 🔐' : ' · tap to enter'}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* PIN entry — only shows when a staff member with a PIN is selected */}
      {sel && sel.pin && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
          <div style={{ fontSize:13, color:'var(--t2)' }}>
            PIN for <strong style={{ color:'var(--t1)' }}>{sel.name}</strong>
          </div>

          {/* Dots */}
          <div style={{ display:'flex', gap:12 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width:14, height:14, borderRadius:'50%',
                border:`2px solid ${shake ? 'var(--red)' : i < pin.length ? 'var(--acc)' : 'var(--bdr3)'}`,
                background: i < pin.length ? (shake ? 'var(--red)' : 'var(--acc)') : 'transparent',
                transition:'all .12s',
              }}/>
            ))}
          </div>
          {shake && <div style={{ fontSize:12, color:'var(--red)', fontWeight:600 }}>Incorrect PIN — try again</div>}

          {/* Numpad */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,72px)', gap:10 }}>
            {KEYS.map((k, i) => (
              <button key={i} onClick={() => k && tap(k)} style={{
                height:56, borderRadius:14, fontFamily:'inherit',
                background: k === '⌫' ? 'transparent' : 'var(--bg3)',
                border:`1px solid ${k === '⌫' ? 'transparent' : 'var(--bdr)'}`,
                fontSize: k === '⌫' ? 22 : 24, fontWeight:500,
                color:'var(--t1)', cursor: k ? 'pointer' : 'default',
                visibility: k === '' ? 'hidden' : 'visible',
                transition:'all .1s',
              }}>{k}</button>
            ))}
          </div>

          <button onClick={() => { setSel(null); setPin(''); }} style={{ fontSize:12, color:'var(--t4)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
        </div>
      )}

      {/* Emergency bypass for demo/testing — only if no staff configured */}
      {staff.length === 0 && (
        <button onClick={() => login({ id:'demo', name:'Demo User', role:'Manager', color:'#e8a020', initials:'DU', pin:'', permissions:['void','discount','refund','cashup','reports','eod','menu86','staff'] })}
          style={{ padding:'10px 24px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:14, fontWeight:700 }}>
          Enter as Demo (no staff set up)
        </button>
      )}
    </div>
  );
}
