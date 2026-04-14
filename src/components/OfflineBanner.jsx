import { useState, useEffect } from 'react';
import { getQueueSize } from '../sync/OfflineQueue';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const onOffline = () => { setOffline(true); };
    const onOnline = async () => {
      setOffline(false);
      // Show briefly that we're syncing then clear
      const size = await getQueueSize();
      if (size > 0) setQueueSize(size);
      setTimeout(() => setQueueSize(0), 4000);
    };

    window.addEventListener('rpos-offline', onOffline);
    window.addEventListener('rpos-online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('rpos-offline', onOffline);
      window.removeEventListener('rpos-online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (!offline && queueSize === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: offline ? '#7f1d1d' : '#14532d',
      color: 'white',
      padding: '6px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 12, fontWeight: 700,
    }}>
      <span style={{ fontSize: 14 }}>{offline ? '⚡' : '✓'}</span>
      {offline
        ? 'No internet connection — orders are saved locally and will sync when reconnected'
        : `Back online — syncing ${queueSize} saved operation${queueSize !== 1 ? 's' : ''}…`
      }
    </div>
  );
}
