// Shown on first visit — lets user choose whether this is a POS device or a back office browser

export default function ModeSelector({ onSelectPOS, onSelectBackOffice }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: 'inherit',
    }}>
      <div style={{ width: 480, textAlign: 'center' }}>

        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'var(--acc)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#fff',
          margin: '0 auto 20px',
        }}>R</div>

        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>
          Restaurant OS
        </div>
        <div style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 48 }}>
          What is this device being used for?
        </div>

        {/* Two cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>

          {/* POS Card */}
          <button onClick={onSelectPOS} style={{
            background: 'var(--bg1)', border: '2px solid var(--bdr)',
            borderRadius: 16, padding: '32px 20px', cursor: 'pointer',
            textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--acc)'; e.currentTarget.style.background = 'var(--acc-d)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)'; e.currentTarget.style.background = 'var(--bg1)'; }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🖥</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>
              POS Terminal
            </div>
            <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>
              This is a till, counter screen, or handheld device used by staff to take orders
            </div>
          </button>

          {/* Back Office Card */}
          <button onClick={onSelectBackOffice} style={{
            background: 'var(--bg1)', border: '2px solid var(--bdr)',
            borderRadius: 16, padding: '32px 20px', cursor: 'pointer',
            textAlign: 'center', transition: 'all .15s', fontFamily: 'inherit',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f5f3ff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bdr)'; e.currentTarget.style.background = 'var(--bg1)'; }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>
              Back Office
            </div>
            <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>
              This is a manager or owner's browser used to manage menus, staff, reports and settings
            </div>
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--t3)' }}>
          This choice is saved to this device. You can reset it in settings.
        </div>
      </div>
    </div>
  );
}
