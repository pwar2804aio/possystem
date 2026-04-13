export default function ModeSelector({ onSelectPOS, onSelectBackOffice, onSelectAdmin }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', fontFamily: 'inherit',
    }}>
      <div style={{ width: 560, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18, background: 'var(--acc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 800, color: '#fff', margin: '0 auto 20px',
        }}>R</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Restaurant OS</div>
        <div style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 48 }}>What is this device being used for?</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <DevCard icon="🖥" title="POS Terminal" desc="A till, counter screen or handheld device used by staff to take orders" accent="var(--acc)" onClick={onSelectPOS} />
          <DevCard icon="🏢" title="Back Office" desc="A manager or owner's browser to manage menus, staff, reports and settings" accent="#6366f1" onClick={onSelectBackOffice} />
        </div>

        {/* Company Admin — separated, subtle */}
        <div style={{ borderTop: '1px solid var(--bdr)', paddingTop: 16, marginTop: 4 }}>
          <button onClick={onSelectAdmin} style={{
            background: 'none', border: '1px solid var(--bdr)', borderRadius: 10,
            padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, color: 'var(--t3)', display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            🔐 Restaurant OS Internal — Company Admin
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 16 }}>
          This choice is saved to this device · <button onClick={() => { localStorage.removeItem('rpos-device-mode'); localStorage.removeItem('rpos-device'); window.location.reload(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: 12, textDecoration: 'underline', padding: 0 }}>reset</button>
        </div>
      </div>
    </div>
  );
}

function DevCard({ icon, title, desc, accent, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--bg1)' : 'var(--bg1)',
        border: `2px solid ${hover ? accent : 'var(--bdr)'}`,
        borderRadius: 16, padding: '32px 20px', cursor: 'pointer',
        textAlign: 'center', fontFamily: 'inherit', transition: 'all .15s',
      }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>{desc}</div>
    </button>
  );
}

// Need useState
import { useState } from 'react';
