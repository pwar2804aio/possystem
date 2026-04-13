import { useState, useEffect } from 'react';
import { supabase, isMock } from '../../lib/supabase';

const ADJECTIVES = ['APPLE','BAKER','CEDAR','DONUT','EMBER','FROST','GROVE','HONEY','IVORY','JAZZY'];
const NOUNS      = ['STAR','MOON','PEAK','WAVE','GLOW','BIRD','SAGE','MINT','DUSK','BELL'];
const genCode    = () => `${ADJECTIVES[Math.floor(Math.random()*10)]}-${Math.floor(1000+Math.random()*9000)}`;

const DEVICE_TYPES = [
  { id: 'pos',     label: 'POS Terminal',    icon: '🖥', desc: 'Main ordering terminal' },
  { id: 'kds',     label: 'Kitchen Display', icon: '📺', desc: 'Kitchen display screen' },
  { id: 'kiosk',   label: 'Self-service Kiosk', icon: '⬜', desc: 'Customer self-order' },
  { id: 'handheld',label: 'Handheld',        icon: '📱', desc: 'Mobile ordering device' },
];

const S = {
  page: { padding: '32px 40px', maxWidth: 860 },
  h1: { fontSize: 22, fontWeight: 800, marginBottom: 4, color: 'var(--t1)' },
  sub: { fontSize: 13, color: 'var(--t3)', marginBottom: 32 },
  card: { background: 'var(--bg1)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 24, marginBottom: 20 },
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' },
  btnPrimary: { background: 'var(--acc)', color: '#fff' },
  btnGhost: { background: 'var(--bg3)', color: 'var(--t2)', border: '1px solid var(--bdr)' },
  btnDanger: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--bdr)', background: 'var(--bg)', color: 'var(--t1)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--t3)', marginBottom: 4, display: 'block' },
};

const DEFAULT_PROFILES = [
  { id:'prof-1', name:'Main counter', color:'#3b82f6' },
  { id:'prof-2', name:'Bar terminal', color:'#e8a020' },
  { id:'prof-3', name:'Server handheld', color:'#22c55e' },
];

function DeviceProfileSelect({ value, onChange }) {
  // Read profiles from localStorage (saved by DeviceProfiles section)
  const stored = (() => { try { return JSON.parse(localStorage.getItem('rpos-device-profiles') || 'null'); } catch { return null; } })();
  const profiles = stored || DEFAULT_PROFILES;
  return (
    <select
      style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg)', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
      value={value} onChange={e => onChange(e.target.value)}
    >
      <option value="">No profile assigned</option>
      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export default function DeviceRegistry() {
  const [devices, setDevices] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [showPairFlow, setShowPairFlow] = useState(false);
  const [pairStep, setPairStep] = useState(1); // 1=config, 2=code
  const [newDevice, setNewDevice] = useState({ name: '', type: 'pos', profileId: '' });
  const [pairingCode, setPairingCode] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    if (isMock) { setLoading(false); return; }
    // Get the logged-in user's location from their profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('user_profiles').select('location_id, locations(name)').eq('id', user.id).single();
    if (profile?.location_id) {
      setLocationId(profile.location_id);
      setLocationName(profile.locations?.name || '');
      // Load devices for this location
      const { data } = await supabase.from('devices').select('*').eq('location_id', profile.location_id).order('created_at');
      setDevices(data || []);
    }
    setLoading(false);
  };

  const loadDevices = async () => {
    if (!locationId || isMock) return;
    const { data } = await supabase.from('devices').select('*').eq('location_id', locationId).order('created_at');
    setDevices(data || []);
  };

  const startPairing = async () => {
    if (!newDevice.name.trim()) return setError('Device name is required');
    setWorking(true); setError('');
    const code = genCode();
    if (!locationId) return setError('No location assigned to your account. Create a location in Company Admin first.');
    const { data, error: err } = await supabase.from('devices').insert({
      location_id: locationId,
      name: newDevice.name.trim(),
      type: newDevice.type,
      pairing_code: code,
      status: 'unpaired',
      profile_id: newDevice.profileId || null,
    }).select().single();
    setWorking(false);
    if (err) return setError(err.message);
    setPairingCode(code);
    await loadDevices();
    setPairStep(2);
  };

  const cancelPairing = async (deviceId) => {
    await supabase.from('devices').delete().eq('id', deviceId);
    setShowPairFlow(false);
    setPairStep(1);
    setPairingCode('');
    setNewDevice({ name: '', type: 'pos' });
    await loadDevices();
  };

  const removeDevice = async (id) => {
    if (!confirm('Remove this device? It will need to be paired again.')) return;
    await supabase.from('devices').delete().eq('id', id);
    await loadDevices();
  };

  const statusColor = (s) => ({
    unpaired: { bg: '#fef9c3', color: '#854d0e' },
    active:   { bg: '#dcfce7', color: '#166534' },
    offline:  { bg: '#f1f5f9', color: '#64748b' },
  }[s] || { bg: '#f1f5f9', color: '#64748b' });

  return (
    <div style={S.page}>
      <div style={S.h1}>📱 Devices</div>
      <div style={S.sub}>Manage POS terminals, KDS screens and kiosks registered to this location</div>

      {/* Add device button */}
      {!showPairFlow && (
        <button onClick={() => { setShowPairFlow(true); setPairStep(1); setError(''); }}
          style={{ ...S.btn, ...S.btnPrimary, marginBottom: 24 }}>
          + Add terminal
        </button>
      )}

      {/* ── Pairing flow ── */}
      {showPairFlow && (
        <div style={{ ...S.card, borderColor: 'var(--acc)', borderWidth: 2 }}>
          {pairStep === 1 && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>
                Step 1 — Configure the new terminal
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>Terminal name *</label>
                  <input style={S.input} placeholder="e.g. Counter 1, Bar terminal" value={newDevice.name}
                    onChange={e => setNewDevice(d => ({ ...d, name: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Device type</label>
                  <select style={S.input} value={newDevice.type} onChange={e => setNewDevice(d => ({ ...d, type: e.target.value }))}>
                    {DEVICE_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Device profile</label>
                  <DeviceProfileSelect value={newDevice.profileId} onChange={v => setNewDevice(d => ({ ...d, profileId: v }))} />
                </div>
              </div>

              {error && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={startPairing} disabled={working} style={{ ...S.btn, ...S.btnPrimary }}>
                  {working ? 'Generating code…' : 'Generate pairing code →'}
                </button>
                <button onClick={() => setShowPairFlow(false)} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              </div>
            </>
          )}

          {pairStep === 2 && (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>
                Step 2 — Enter this code on the device
              </div>
              <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 24 }}>
                On the Sunmi or browser, open the POS app. On first boot it will show a pairing screen. Enter the code below.
              </div>

              {/* Big pairing code display */}
              <div style={{
                background: 'var(--bg)', border: '2px dashed var(--acc)', borderRadius: 16,
                padding: '32px', textAlign: 'center', marginBottom: 24,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Pairing code
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '.15em', color: 'var(--acc)', fontFamily: 'monospace' }}>
                  {pairingCode}
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
                  Terminal: <strong>{newDevice.name}</strong> · Type: <strong>{DEVICE_TYPES.find(t => t.id === newDevice.type)?.label}</strong>
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--t2)' }}>What happens next:</strong><br />
                The device enters this code → it registers to this location → downloads your menu, floor plan and config → POS goes live automatically.
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowPairFlow(false); setPairStep(1); setPairingCode(''); setNewDevice({ name: '', type: 'pos' }); }}
                  style={{ ...S.btn, ...S.btnPrimary }}>
                  Done
                </button>
                <button onClick={() => cancelPairing(devices.find(d => d.pairing_code === pairingCode)?.id)}
                  style={{ ...S.btn, ...S.btnGhost }}>
                  Cancel pairing
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Device list ── */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t2)', marginBottom: 16 }}>
          Registered devices ({devices.length})
        </div>

      {!loading && !locationId && !isMock && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📍</div>
          <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 8 }}>No location assigned to your account</div>
          <div style={{ fontSize: 13 }}>Go to <strong>Company Admin → Create organisation → Add location</strong>, then assign your account to that location in Supabase → user_profiles.</div>
        </div>
      )}

        {!loading && devices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)', fontSize: 13 }}>
            No devices paired yet — click "Add terminal" to register your first POS device
          </div>
        )}

        {devices.map(d => {
          const sc = statusColor(d.status);
          const dtype = DEVICE_TYPES.find(t => t.id === d.type) || DEVICE_TYPES[0];
          return (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 0', borderBottom: '1px solid var(--bdr)',
            }}>
              <div style={{ fontSize: 28, width: 40, textAlign: 'center' }}>{dtype.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 14 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                  {dtype.label}{d.profile_id ? ` · ${((() => { try { return JSON.parse(localStorage.getItem('rpos-device-profiles') || 'null'); } catch { return null; } })() || DEFAULT_PROFILES).find(p => p.id === d.profile_id)?.name || d.profile_id}` : ''}
                  {d.pairing_code && d.status === 'unpaired' && (
                    <span style={{ marginLeft: 8, fontFamily: 'monospace', color: 'var(--acc)', fontWeight: 700 }}>
                      Code: {d.pairing_code}
                    </span>
                  )}
                  {d.last_seen && (
                    <span style={{ marginLeft: 8 }}>· Last seen {new Date(d.last_seen).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
              </div>
              <span style={{ ...sc, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {d.status}
              </span>
              <button onClick={() => removeDevice(d.id)} style={{ ...S.btn, ...S.btnDanger, padding: '6px 12px' }}>
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
