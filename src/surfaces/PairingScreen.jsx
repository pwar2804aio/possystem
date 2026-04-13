import { useState } from 'react';
import { supabase, isMock, LOCATION_ID } from '../lib/supabase';
import { VERSION } from '../lib/version';

export default function PairingScreen({ onPaired }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePair = async () => {
    const clean = code.trim().toUpperCase();
    if (!clean) return setError('Enter the pairing code from your back office');
    setLoading(true); setError('');

    // Look up the code in Supabase
    const { data, error: err } = await supabase
      .from('devices')
      .select('*, locations(*)')
      .eq('pairing_code', clean)
      .eq('status', 'unpaired')
      .single();

    if (err || !data) {
      setLoading(false);
      return setError('Invalid or already-used pairing code. Generate a new one in your back office.');
    }

    // Mark device as active
    await supabase.from('devices').update({
      status: 'active',
      paired_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    }).eq('id', data.id);

    // Store device identity in localStorage
    localStorage.setItem('rpos-device', JSON.stringify({
      id: data.id,
      name: data.name,
      type: data.type,
      locationId: data.location_id,
      locationName: data.locations?.name || 'Unknown',
      orgId: data.locations?.org_id,
      pairedAt: new Date().toISOString(),
    }));

    setLoading(false);
    onPaired(data);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', fontFamily: 'inherit',
    }}>
      <div style={{
        width: 420, background: 'var(--bg1)', border: '1px solid var(--bdr)',
        borderRadius: 20, padding: '48px 40px', textAlign: 'center',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
      }}>
        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: 'var(--acc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 auto 16px',
        }}>R</div>

        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>
          Welcome to Restaurant OS
        </div>
        <div style={{ fontSize: 14, color: 'var(--t3)', marginBottom: 40, lineHeight: 1.5 }}>
          This device hasn't been set up yet.<br />
          Enter the pairing code from your back office to get started.
        </div>

        {/* Code input */}
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handlePair()}
          placeholder="e.g. DONUT-4821"
          maxLength={12}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            border: `2px solid ${error ? '#fca5a5' : 'var(--bdr)'}`,
            background: 'var(--bg)', color: 'var(--t1)',
            fontSize: 24, fontWeight: 700, letterSpacing: '.1em',
            textAlign: 'center', fontFamily: 'monospace',
            outline: 'none', boxSizing: 'border-box',
            marginBottom: 12,
          }}
          autoFocus
        />

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, background: '#fef2f2',
            border: '1px solid #fecaca', color: '#dc2626', fontSize: 13,
            marginBottom: 16, textAlign: 'left',
          }}>{error}</div>
        )}

        <button
          onClick={handlePair}
          disabled={loading || !code.trim()}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 12,
            background: loading || !code.trim() ? 'var(--t4)' : 'var(--acc)',
            color: '#fff', fontWeight: 700, fontSize: 16,
            border: 'none', cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Pairing…' : 'Pair this device →'}
        </button>

        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 16, fontFamily: 'monospace' }}>v{VERSION}</div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8, lineHeight: 1.6 }}>
          Generate a pairing code in your back office:<br />
          <strong>Back Office → Devices → Add terminal</strong>
        </div>

        {/* Admin bypass link */}
        <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 16 }}>
          Restaurant owner or admin?{' '}
          <button onClick={() => {
            // Mark as "admin mode" so we skip pairing and go to back office
            localStorage.setItem('rpos-device', JSON.stringify({ id: 'admin', name: 'Admin', type: 'admin', locationId: null, adminMode: true }));
            window.location.reload();
          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--acc)', fontWeight: 700, fontSize: 12, textDecoration: 'underline' }}>
            Access Back Office →
          </button>
        </div>
      </div>
    </div>
  );
}
