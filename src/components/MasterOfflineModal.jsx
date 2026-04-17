import { useState, useEffect } from 'react';
import { getMasterStatus, forceSyncFromSupabase } from '../sync/MasterSync';

export default function MasterOfflineModal({ masterName, lastSeen, onDismiss }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      const age = lastSeen?.ageMs ? Math.round((Date.now() - (Date.now() - lastSeen.ageMs)) / 1000) : 0;
      setElapsed(s => s + 15);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const handleForceSync = async () => {
    setSyncing(true);
    setResult(null);
    const r = await forceSyncFromSupabase();
    setSyncing(false);
    setResult(r);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--bg1)', border: '2px solid var(--red)',
        borderRadius: 20, padding: 36, maxWidth: 440, width: '90%',
        textAlign: 'center', boxShadow: '0 0 40px rgba(239,68,68,0.3)',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>

        {/* Title */}
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)', marginBottom: 8 }}>
          Master POS not found
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 6, fontWeight: 600 }}>
          {masterName || 'Master terminal'} is not responding on the network
        </div>

        {/* Last seen */}
        {lastSeen?.last_seen && (
          <div style={{ fontSize: 12, color: 'var(--t4)', marginBottom: 24 }}>
            Last seen {Math.round((Date.now() - new Date(lastSeen.last_seen).getTime()) / 1000)}s ago
            {lastSeen.version ? ` · v${lastSeen.version}` : ''}
          </div>
        )}

        {/* Instructions */}
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--bdr)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, textAlign: 'left',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--t1)' }}>What to do:</div>
          <div>1. Check that <strong>{masterName || 'the master POS'}</strong> is powered on</div>
          <div>2. Make sure it's connected to the same WiFi network</div>
          <div>3. Open the POS on the master device and wait for it to load</div>
          <div>4. This screen will clear automatically when it reconnects</div>
        </div>

        {/* Force sync result */}
        {result && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, marginBottom: 16,
            background: result.ok ? 'var(--grn-d)' : 'var(--red-d)',
            border: `1px solid ${result.ok ? 'var(--grn-b)' : 'var(--red-b)'}`,
            fontSize: 12, color: result.ok ? 'var(--grn)' : 'var(--red)',
          }}>
            {result.ok
              ? `✓ Synced ${result.sessionCount} sessions and ${result.checkCount} checks from cloud`
              : `✗ Sync failed: ${result.error}`}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={handleForceSync}
            disabled={syncing}
            style={{
              padding: '12px 20px', borderRadius: 12, cursor: syncing ? 'default' : 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
              background: 'var(--bg3)', border: '1px solid var(--bdr)',
              color: 'var(--t1)', opacity: syncing ? 0.6 : 1,
            }}>
            {syncing ? '⟳ Syncing…' : '↓ Force sync from cloud'}
          </button>
          <button
            onClick={onDismiss}
            style={{
              padding: '12px 20px', borderRadius: 12, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
              background: 'var(--bg3)', border: '1px solid var(--bdr2)',
              color: 'var(--t3)',
            }}>
            Continue anyway
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 14 }}>
          Continuing without the master may cause data inconsistencies
        </div>
      </div>
    </div>
  );
}
