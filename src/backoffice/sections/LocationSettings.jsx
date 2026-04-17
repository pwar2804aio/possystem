import { useState, useEffect } from 'react';
import { platformSupabase, supabase, getLocationId } from '../../lib/supabase';
import { clearLocationConfigCache } from '../../lib/locationTime';

const TIMEZONES = [
  { value:'Europe/London',      label:'Europe/London (UK)' },
  { value:'Europe/Paris',       label:'Europe/Paris (CET)' },
  { value:'Europe/Berlin',      label:'Europe/Berlin (CET)' },
  { value:'Europe/Amsterdam',   label:'Europe/Amsterdam (CET)' },
  { value:'Europe/Dublin',      label:'Europe/Dublin' },
  { value:'America/New_York',   label:'America/New York (ET)' },
  { value:'America/Chicago',    label:'America/Chicago (CT)' },
  { value:'America/Denver',     label:'America/Denver (MT)' },
  { value:'America/Los_Angeles',label:'America/Los Angeles (PT)' },
  { value:'America/Toronto',    label:'America/Toronto (ET)' },
  { value:'Australia/Sydney',   label:'Australia/Sydney (AEDT)' },
  { value:'Australia/Melbourne',label:'Australia/Melbourne (AEDT)' },
  { value:'Asia/Dubai',         label:'Asia/Dubai (GST)' },
  { value:'Asia/Singapore',     label:'Asia/Singapore (SGT)' },
  { value:'Asia/Tokyo',         label:'Asia/Tokyo (JST)' },
];

const HOURS = Array.from({ length: 24 }, (_, h) =>
  ({ value: `${String(h).padStart(2,'0')}:00`, label: `${String(h).padStart(2,'0')}:00` })
);

const S = {
  page: { padding:'32px 40px', maxWidth:760, overflowY:'auto' },
  h1:   { fontSize:22, fontWeight:800, marginBottom:4, color:'var(--t1)' },
  sub:  { fontSize:13, color:'var(--t3)', marginBottom:32 },
  card: { background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:24, marginBottom:20 },
  h2:   { fontSize:14, fontWeight:700, color:'var(--t1)', marginBottom:4 },
  desc: { fontSize:12, color:'var(--t4)', marginBottom:16, lineHeight:1.6 },
  label:{ fontSize:12, fontWeight:600, color:'var(--t3)', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.04em' },
  select:{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg)', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none' },
  input: { padding:'9px 12px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg)', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none' },
  row:  { display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:8, alignItems:'end', marginBottom:8 },
  btn:  { padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' },
};

export default function LocationSettings() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  const [timezone, setTimezone]     = useState('Europe/London');
  const [bizDayStart, setBizDayStart] = useState('06:00');
  const [shifts, setShifts]         = useState([]);
  const [showItemImages, setShowItemImages] = useState(false);
  const [loadingImageSetting, setLoadingImageSetting] = useState(true);

  useEffect(() => {
    if (!platformSupabase) { setLoading(false); return; }
    platformSupabase.from('locations').select('id, name, timezone, business_day_start, shifts').limit(1).single()
      .then(({ data }) => {
        if (data) {
          setLocation(data);
          setTimezone(data.timezone || 'Europe/London');
          setBizDayStart(data.business_day_start || '06:00');
          setShifts(data.shifts || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load show_item_images from ops DB
    (async () => {
      const locId = await getLocationId().catch(() => null);
      if (!locId || !supabase) { setLoadingImageSetting(false); return; }
      const { data } = await supabase.from('locations').select('show_item_images').eq('id', locId).single();
      if (data) setShowItemImages(data.show_item_images ?? false);
      setLoadingImageSetting(false);
    })();
  }, []);

  const addShift = () => {
    setShifts(s => [...s, { id:`shift-${Date.now()}`, name:'New shift', start:'09:00', end:'17:00' }]);
  };
  const updateShift = (id, key, val) => {
    setShifts(s => s.map(sh => sh.id === id ? { ...sh, [key]: val } : sh));
  };
  const removeShift = (id) => setShifts(s => s.filter(sh => sh.id !== id));

  const save = async () => {
    if (!platformSupabase || !location) return;
    setSaving(true); setError(''); setSaved(false);
    const { error: err } = await platformSupabase
      .from('locations')
      .update({ timezone, business_day_start: bizDayStart, shifts })
      .eq('id', location.id);

    // Save show_item_images to ops DB
    const locId = await getLocationId().catch(() => null);
    if (locId && supabase) {
      await supabase.from('locations').update({ show_item_images: showItemImages }).eq('id', locId);
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    clearLocationConfigCache(); // force refresh on next read
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div style={{ padding:40, color:'var(--t4)', fontSize:13 }}>Loading…</div>;
  if (!platformSupabase) return (
    <div style={S.page}>
      <div style={S.h1}>Location Settings</div>
      <div style={{ padding:'20px 0', color:'var(--red)', fontSize:13 }}>
        Platform DB not configured. Add <code>VITE_PLATFORM_SUPABASE_URL</code> and <code>VITE_PLATFORM_SUPABASE_ANON_KEY</code> to Vercel environment variables.
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.h1}>Location Settings</div>
      <div style={S.sub}>Configure timezone and service periods for {location?.name || 'your location'}</div>

      {/* Timezone */}
      <div style={S.card}>
        <div style={S.h2}>🌍 Timezone</div>
        <div style={S.desc}>
          All timestamps, reporting, and shift calculations use this timezone.
          Reports will show "today's" data from the correct local midnight — not the server or device time.
        </div>
        <label style={S.label}>Location timezone</label>
        <select style={S.select} value={timezone} onChange={e => setTimezone(e.target.value)}>
          {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
        </select>
        <div style={{ fontSize:11, color:'var(--t4)', marginTop:6 }}>
          Current time in {timezone}: <strong style={{ color:'var(--t2)' }}>
            {new Date().toLocaleTimeString('en-GB', { timeZone: timezone, hour:'2-digit', minute:'2-digit' })}
          </strong>
        </div>
      </div>

      {/* Business day start */}
      <div style={S.card}>
        <div style={S.h2}>⏰ Business day start</div>
        <div style={S.desc}>
          The time a new reporting day begins. Checks closed before this time are attributed to the previous day.
          Set to <strong>06:00</strong> for a standard restaurant. Nightclubs or late bars might use <strong>04:00</strong>.
        </div>
        <label style={S.label}>New day starts at</label>
        <select style={{ ...S.select, maxWidth:160 }} value={bizDayStart} onChange={e => setBizDayStart(e.target.value)}>
          {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
        </select>
        <div style={{ fontSize:11, color:'var(--t4)', marginTop:6 }}>
          Today's reporting period: <strong style={{ color:'var(--t2)' }}>{bizDayStart} — {bizDayStart} tomorrow</strong>
        </div>
      </div>

      {/* Shifts */}
      <div style={S.card}>
        <div style={S.h2}>🕐 Service periods</div>
        <div style={S.desc}>
          Named shifts let you filter reports by period (Breakfast / Lunch / Dinner) and give the AI assistant
          shift context. Leave empty to use whole-day reporting only.
        </div>

        {shifts.map((sh, i) => (
          <div key={sh.id} style={S.row}>
            <div>
              {i === 0 && <label style={S.label}>Name</label>}
              <input style={{ ...S.input, width:'100%', boxSizing:'border-box' }}
                value={sh.name} onChange={e => updateShift(sh.id, 'name', e.target.value)}
                placeholder="e.g. Dinner"/>
            </div>
            <div>
              {i === 0 && <label style={S.label}>Start</label>}
              <select style={S.select} value={sh.start} onChange={e => updateShift(sh.id, 'start', e.target.value)}>
                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div>
              {i === 0 && <label style={S.label}>End</label>}
              <select style={S.select} value={sh.end} onChange={e => updateShift(sh.id, 'end', e.target.value)}>
                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div>
              {i === 0 && <label style={S.label}>&nbsp;</label>}
              <button onClick={() => removeShift(sh.id)}
                style={{ ...S.btn, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)', padding:'9px 12px' }}>✕</button>
            </div>
          </div>
        ))}

        <button onClick={addShift}
          style={{ ...S.btn, background:'var(--bg3)', color:'var(--t2)', border:'1px solid var(--bdr)', marginTop:4 }}>
          + Add shift
        </button>

        {shifts.length > 0 && (
          <div style={{ marginTop:12, fontSize:11, color:'var(--t4)', lineHeight:1.8 }}>
            ⓘ Shifts appear in the AI assistant context and will be used to filter reports in a future update.
            Gaps between shifts are valid — not all time needs to be covered.
          </div>
        )}
      </div>

      {/* POS Display */}
      <div style={S.card}>
        <div style={S.h2}>🖼 POS Display</div>
        <div style={S.desc}>
          When enabled, product images appear as background photos on the POS item buttons.
          Images can be added per-item in the menu manager. Images always show on long-press regardless of this setting.
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>Show images on POS buttons</div>
            <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Applies to all terminals at this location</div>
          </div>
          <button
            onClick={() => setShowItemImages(v => !v)}
            style={{
              width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background: showItemImages ? 'var(--acc)' : 'var(--bdr2)',
              position:'relative', transition:'background .2s', flexShrink:0,
            }}>
            <div style={{
              position:'absolute', top:3, left: showItemImages ? 23 : 3,
              width:18, height:18, borderRadius:'50%', background:'#fff',
              transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
            }}/>
          </button>
        </div>
        {loadingImageSetting && <div style={{ fontSize:11, color:'var(--t4)' }}>Loading…</div>}
      </div>

      {/* Save */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={save} disabled={saving}
          style={{ ...S.btn, background:'var(--acc)', color:'#fff', opacity:saving?.6:1 }}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span style={{ fontSize:13, color:'var(--grn)', fontWeight:600 }}>✓ Saved</span>}
        {error && <span style={{ fontSize:13, color:'var(--red)' }}>{error}</span>}
      </div>
    </div>
  );
}
