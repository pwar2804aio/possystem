import { useState } from 'react';
import { useStore } from '../store';

export default function PINScreen() {
  const { login, staffMembers } = useStore();
  const staff = staffMembers && staffMembers.length ? staffMembers : [];
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const tap = (k) => {
    if (!sel) return;
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === sel.pin) {
          login(sel);
        } else {
          setShake(true);
          setPin('');
          setTimeout(() => setShake(false), 500);
        }
      }, 100);
    }
  };

  const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', gap: 48,
      background: 'var(--bg)',
    }}>
      {/* Wordmark */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, background: 'var(--acc)', borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, color: '#0e0f14',
          margin: '0 auto 16px',
        }}>R</div>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>Restaurant OS</div>
        <div style={{ fontSize: 14, color: 'var(--t2)', marginTop: 4 }}>Select your profile</div>
      </div>

      {/* Staff cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 420 }}>
        {staff.map(s => (
          <button key={s.id} onClick={() => { setSel(s); setPin(''); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '16px 20px', minWidth: 96,
              background: sel?.id === s.id ? 'rgba(240,165,0,.08)' : 'var(--bg3)',
              border: `1px solid ${sel?.id === s.id ? 'var(--acc-b)' : 'var(--bdr)'}`,
              borderRadius: 16, cursor: 'pointer', transition: 'all .15s',
            }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: s.color + '22', border: `2px solid ${s.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 600, color: s.color,
            }}>{s.initials}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{s.role}</div>
          </button>
        ))}
      </div>

      {/* PIN entry */}
      {sel && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--t2)' }}>
            PIN for <strong style={{ color: 'var(--t1)' }}>{sel.name}</strong>
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', gap: 12 }} className={shake ? 'anim-fade' : ''}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: '50%',
                border: `2px solid ${shake ? 'var(--red)' : i < pin.length ? 'var(--acc)' : 'var(--bdr3)'}`,
                background: i < pin.length ? (shake ? 'var(--red)' : 'var(--acc)') : 'transparent',
                transition: 'all .12s',
              }}/>
            ))}
          </div>
          {shake && <div style={{ fontSize: 12, color: 'var(--red)' }}>Incorrect PIN — try again</div>}

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 10 }}>
            {KEYS.map((k, i) => (
              <button key={i} onClick={() => k && tap(k)}
                style={{
                  height: 56, borderRadius: 14,
                  background: k === '⌫' ? 'transparent' : 'var(--bg3)',
                  border: `1px solid ${k === '⌫' ? 'transparent' : 'var(--bdr)'}`,
                  fontSize: k === '⌫' ? 20 : 22, fontWeight: 400,
                  color: 'var(--t1)', cursor: k ? 'pointer' : 'default',
                  visibility: k === '' ? 'hidden' : 'visible',
                  transition: 'all .1s', fontFamily: 'inherit',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(.94)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >{k}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
