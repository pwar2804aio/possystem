import { useState, useEffect } from 'react';

// Polls for a new version every 5 minutes and prompts staff to refresh
export default function UpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Check immediately then every 5 minutes
    const check = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting) setUpdateReady(true);
        }
      } catch {}
    };

    // Also listen for SW waiting event (new SW ready to activate)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // SW just activated — page already has new content, just reload cleanly
      window.location.reload();
    });

    const listen = async () => {
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      if (!reg) return;
      const onUpdate = (r) => { if (r.waiting) setUpdateReady(true); };
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
      if (reg.waiting) setUpdateReady(true);
    };

    listen();
    check();
    const timer = setInterval(check, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(timer);
  }, []);

  const applyUpdate = () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
    // Fallback: force reload regardless
    setTimeout(() => window.location.reload(true), 500);
  };

  if (!updateReady) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      background: '#1a1d27',
      border: '1.5px solid var(--acc-b, #d4881c44)',
      borderRadius: 14,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      minWidth: 280,
    }}>
      <div style={{ fontSize: 20 }}>🔄</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
          Update available
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          Tap to refresh and get the latest version
        </div>
      </div>
      <button
        onClick={applyUpdate}
        style={{
          background: '#d4881c',
          color: '#0b0c10',
          border: 'none',
          borderRadius: 9,
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        Update now
      </button>
    </div>
  );
}
