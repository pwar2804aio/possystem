import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { isMock } from '../../lib/supabase';

const SURFACES = [
  { id:'tables', label:'Floor plan', icon:'⬚', desc:'Opens to the table layout view' },
  { id:'pos',    label:'POS ordering', icon:'⊞', desc:'Opens straight to the menu/ordering screen' },
  { id:'bar',    label:'Bar tabs', icon:'🍸', desc:'Opens to the bar tab management screen' },
  { id:'kds',    label:'Kitchen display', icon:'▣', desc:'Opens to the KDS screen (for kitchen units)' },
];

const ORDER_TYPES = [
  { id:'dine-in',    label:'Dine in',    icon:'🍽' },
  { id:'takeaway',   label:'Takeaway',   icon:'🥡' },
  { id:'collection', label:'Collection', icon:'📦' },
];

const FEATURES = [
  { id:'barTabs',      label:'Bar tabs',             desc:'Hide bar tab surface from POS sidebar' },
  { id:'courses',      label:'Course management',    desc:'Fire course buttons on orders' },
  { id:'kds',          label:'KDS screen',           desc:'Kitchen display screen in sidebar' },
  { id:'kiosk',        label:'Kiosk mode',           desc:'Self-service kiosk capability' },
  { id:'reports',      label:'Reports access',       desc:'Shift reports in back office tab' },
  { id:'discounts',    label:'Discounts',            desc:'Apply discounts without manager PIN' },
  { id:'voids',        label:'Voids (no PIN)',        desc:'Void items without manager PIN' },
  { id:'splitCheck',   label:'Split checks',         desc:'Allow creating split checks' },
  { id:'tableTransfer',label:'Table transfer',       desc:'Transfer tables to other terminals' },
];

const DEFAULT_PROFILES = [
  {
    id:'prof-1', name:'Main counter', color:'#3b82f6',
    defaultSurface:'tables', enabledOrderTypes:['dine-in','takeaway','collection'],
    assignedSection:null, hiddenFeatures:[], tableServiceEnabled:true,
    quickScreenEnabled:true, receiptPrinterId:'pr1', deviceCount:1,
  },
  {
    id:'prof-2', name:'Bar terminal', color:'#e8a020',
    defaultSurface:'bar', enabledOrderTypes:['dine-in'],
    assignedSection:'bar', hiddenFeatures:['courses','kiosk','reports'],
    tableServiceEnabled:false, quickScreenEnabled:true,
    receiptPrinterId:'pr3', deviceCount:1,
  },
  {
    id:'prof-3', name:'Server handheld', color:'#22c55e',
    defaultSurface:'pos', enabledOrderTypes:['dine-in'],
    assignedSection:null, hiddenFeatures:['kiosk','reports','discounts','voids'],
    tableServiceEnabled:true, quickScreenEnabled:true,
    receiptPrinterId:'pr1', deviceCount:1,
  },
];

export default function DeviceProfiles() {
  const { showToast, devices, setDeviceConfig, markBOChange } = useStore();
  const [profiles, setProfiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rpos-device-profiles') || '[]'); } catch { return []; }
  });
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [locationId, setLocationId] = useState(null);

  // Load from Supabase on mount — replaces localStorage cache with fresh data
  useEffect(() => {
    if (isMock) { setProfiles(DEFAULT_PROFILES); return; }
    const loadFromDB = async () => {
      const { getLocationId } = await import('../../lib/supabase.js');
      const locId = await getLocationId().catch(() => null);
      if (!locId) return;
      setLocationId(locId);
      const { data } = await supabase.from('device_profiles').select('*').eq('location_id', locId).order('sort_order');
      const mapped = (data || []).map(p => ({
        id: p.id, name: p.name, color: p.color || '#3b82f6',
        defaultSurface: p.default_surface || 'tables',
        enabledOrderTypes: p.enabled_order_types || ['dine-in'],
        assignedSection: p.assigned_section, hiddenFeatures: p.hidden_features || [],
        tableServiceEnabled: p.table_service_enabled !== false,
        quickScreenEnabled: p.quick_screen_enabled !== false,
        menuId: p.menu_id, deviceCount: 0, serviceCharge: p.service_charge || null, isMaster: p.is_master || false,
      }));
      setProfiles(mapped);
      try { localStorage.setItem('rpos-device-profiles', JSON.stringify(mapped)); } catch {}
    };
    loadFromDB();
  }, []);

  const toDbRow = (p, locId) => ({
    id: p.id, location_id: locId || locationId,
    name: p.name, color: p.color,
    default_surface: p.defaultSurface,
    enabled_order_types: p.enabledOrderTypes,
    assigned_section: p.assignedSection,
    hidden_features: p.hiddenFeatures,
    table_service_enabled: p.tableServiceEnabled,
    quick_screen_enabled: p.quickScreenEnabled,
    menu_id: p.menuId || null,
  });

  const save = async (updated) => {
    setProfiles(ps => ps.map(p => p.id === updated.id ? updated : p));
    markBOChange();
    if (!isMock) {
      try {
        const { getLocationId } = await import('../../lib/supabase.js');
        const locId = locationId || await getLocationId();
        // Use direct fetch — proven reliable (Supabase JS SDK had silent failures)
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const row = {
          id: updated.id,
          location_id: locId,
          name: updated.name,
          color: updated.color || '#3b82f6',
          default_surface: updated.defaultSurface,
          enabled_order_types: updated.enabledOrderTypes,
          assigned_section: updated.assignedSection || null,
          hidden_features: updated.hiddenFeatures || [],
          table_service_enabled: updated.tableServiceEnabled !== false,
          quick_screen_enabled: updated.quickScreenEnabled !== false,
          menu_id: updated.menuId || null,
          sort_order: updated.sortOrder || 0,
          service_charge: updated.serviceCharge || null,
          is_master: updated.isMaster || false,
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/device_profiles?on_conflict=id`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify([row]),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }
        try {
          const cur = JSON.parse(localStorage.getItem('rpos-device-profiles') || '[]');
          localStorage.setItem('rpos-device-profiles', JSON.stringify(cur.map(p => p.id === updated.id ? updated : p)));
        } catch {}
      } catch (err) {
        console.error('Profile save failed:', err);
        showToast('Save failed — check connection', 'error');
        return;
      }
    }
    showToast(`"${updated.name}" saved — POS updates instantly`, 'success');
    setEditing(null);
  };

  const addProfile = async (profile) => {
    const nextId = `prof-${Date.now().toString(36).slice(-4)}`;
    const newProfile = { ...profile, id: nextId, deviceCount: 0 };
    setProfiles(ps => [...ps, newProfile]);
    if (!isMock && locationId) {
      await supabase.from('device_profiles').insert(toDbRow(newProfile));
      try {
        const cur = JSON.parse(localStorage.getItem('rpos-device-profiles') || '[]');
        localStorage.setItem('rpos-device-profiles', JSON.stringify([...cur, newProfile]));
      } catch {}
    }
    markBOChange();
    showToast(`"${profile.name}" profile created`, 'success');
    setShowNew(false);
  };

  const deleteProfile = async (id) => {
    setProfiles(ps => ps.filter(p => p.id !== id));
    if (!isMock) await supabase.from('device_profiles').delete().eq('id', id);
    try {
      const cur = JSON.parse(localStorage.getItem('rpos-device-profiles') || '[]');
      localStorage.setItem('rpos-device-profiles', JSON.stringify(cur.filter(p => p.id !== id)));
    } catch {}
    markBOChange();
    showToast('Profile deleted', 'info');
  };

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontSize:14, color:'var(--t3)', marginTop:4, maxWidth:560 }}>
            Profiles control what each terminal shows and can do. Assign a profile to a device and it immediately adapts — the bar terminal never shows takeaway, the counter shows everything.
          </div>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          padding:'8px 18px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
          background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, flexShrink:0,
        }}>+ New profile</button>
      </div>

      {/* Profile cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:14 }}>
        {profiles.map(prof => {
          const devCount = devices.filter(d => d.profileId === prof.id).length || prof.deviceCount;
          return (
            <div key={prof.id} style={{
              background:'var(--bg1)', border:'1px solid var(--bdr)',
              borderRadius:16, overflow:'hidden',
              borderTop:`3px solid ${prof.color}`,
            }}>
              {/* Header */}
              <div style={{ padding:'16px 18px 14px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>{prof.name}</div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>
                      {devCount} device{devCount !== 1 ? 's' : ''} using this profile
                    </div>
                  </div>
                  <div style={{
                    padding:'4px 10px', borderRadius:20, fontSize:10, fontWeight:700,
                    background:`${prof.color}22`, color:prof.color,
                    border:`1px solid ${prof.color}44`,
                  }}>
                    {SURFACES.find(s => s.id === prof.defaultSurface)?.label || prof.defaultSurface}
                  </div>
                </div>

                {/* Config summary */}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <ConfigRow label="Default screen" value={SURFACES.find(s => s.id === prof.defaultSurface)?.label}/>
                  <ConfigRow label="Order types" value={prof.enabledOrderTypes.map(t => ORDER_TYPES.find(o => o.id === t)?.icon + ' ' + ORDER_TYPES.find(o => o.id === t)?.label).join(' · ')}/>
                  <ConfigRow label="Table service" value={prof.tableServiceEnabled ? '✓ Enabled' : '✕ Disabled'} valueColor={prof.tableServiceEnabled ? 'var(--grn)' : 'var(--red)'}/>
                  <ConfigRow label="Section" value={prof.assignedSection || 'All sections'}/>
                  {prof.hiddenFeatures.length > 0 && (
                    <ConfigRow label="Hidden features" value={prof.hiddenFeatures.join(', ')} truncate/>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding:'10px 18px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8, background:'var(--bg2)' }}>
                <button onClick={() => setEditing({ ...prof })} style={{
                  flex:1, height:34, borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                  background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600,
                }}>Edit profile</button>
                <button onClick={() => {
                  setDeviceConfig({
                    profileId: prof.id,
                    profileName: prof.name,
                    defaultSurface: prof.defaultSurface,
                    enabledOrderTypes: prof.enabledOrderTypes,
                    assignedSection: prof.assignedSection,
                    hiddenFeatures: prof.hiddenFeatures,
                    tableServiceEnabled: prof.tableServiceEnabled,
                    quickScreenEnabled: prof.quickScreenEnabled,
                    menuId: prof.menuId,
                    receiptPrinterId: prof.receiptPrinterId,
                  });
                  showToast(`"${prof.name}" applied to this terminal`, 'success');
                }} style={{
                  flex:1, height:34, borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                  background:`${prof.color}22`, border:`1px solid ${prof.color}44`, color:prof.color, fontSize:12, fontWeight:700,
                }}>Apply to this terminal</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && <ProfileEditor profile={editing} onSave={save} onDelete={() => { deleteProfile(editing.id); setEditing(null); }} onClose={() => setEditing(null)}/>}
      {showNew  && <ProfileEditor profile={null} onSave={addProfile} onClose={() => setShowNew(false)}/>}
    </div>
  );
}

function ConfigRow({ label, value, valueColor, truncate }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:10, fontSize:12 }}>
      <span style={{ color:'var(--t4)', flexShrink:0 }}>{label}</span>
      <span style={{ color: valueColor || 'var(--t2)', fontWeight:500, textAlign:'right', overflow: truncate ? 'hidden' : 'visible', textOverflow: truncate ? 'ellipsis' : 'clip', whiteSpace: truncate ? 'nowrap' : 'normal' }}>{value}</span>
    </div>
  );
}

// ── Profile editor modal ───────────────────────────────────────────────────────
function ProfileEditor({ profile, onSave, onDelete, onClose }) {
  const { menus } = useStore();
  const isNew = !profile;
  const [form, setForm] = useState(profile || {
    name:'', color:'#3b82f6',
    defaultSurface:'tables', enabledOrderTypes:['dine-in'],
    assignedSection:null, hiddenFeatures:[],
    tableServiceEnabled:true, quickScreenEnabled:true, receiptPrinterId:'pr1', menuId:null,
  });

  const upd = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const toggleOrderType = id => upd('enabledOrderTypes', form.enabledOrderTypes.includes(id) ? form.enabledOrderTypes.filter(x => x !== id) : [...form.enabledOrderTypes, id]);
  const toggleFeature = id => upd('hiddenFeatures', form.hiddenFeatures.includes(id) ? form.hiddenFeatures.filter(x => x !== id) : [...form.hiddenFeatures, id]);

  const COLORS = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316'];
  const SECTIONS = [null, 'main', 'bar', 'patio'];

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:22,
        width:'100%', maxWidth:540, maxHeight:'90vh',
        display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800 }}>{isNew ? 'New device profile' : `Edit — ${profile.name}`}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          {/* Name + colour */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Profile name</label>
            <input style={{ width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Bar terminal, Server handheld"/>
          </div>

          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Profile colour</label>
            <div style={{ display:'flex', gap:8 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => upd('color', c)} style={{
                  width:28, height:28, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
                  outline: form.color === c ? `3px solid var(--t1)` : '3px solid transparent',
                  outlineOffset:2, transition:'outline .1s',
                }}/>
              ))}
            </div>
          </div>

          {/* Default surface */}
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Default screen on startup</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {SURFACES.map(s => (
                <button key={s.id} onClick={() => upd('defaultSurface', s.id)} style={{
                  padding:'10px 12px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
                  textAlign:'left', transition:'all .1s',
                  background: form.defaultSurface === s.id ? 'var(--acc-d)' : 'var(--bg3)',
                  border:`1.5px solid ${form.defaultSurface === s.id ? 'var(--acc)' : 'var(--bdr)'}`,
                }}>
                  <div style={{ fontSize:13, fontWeight:700, color: form.defaultSurface === s.id ? 'var(--acc)' : 'var(--t1)', marginBottom:2 }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize:10, color:'var(--t4)' }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Order types */}
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Enabled order types</label>
            <div style={{ display:'flex', gap:8 }}>
              {ORDER_TYPES.map(t => {
                const on = form.enabledOrderTypes.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleOrderType(t.id)} style={{
                    flex:1, padding:'10px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'center',
                    background: on ? 'var(--acc-d)' : 'var(--bg3)',
                    border:`1.5px solid ${on ? 'var(--acc)' : 'var(--bdr)'}`,
                    color: on ? 'var(--acc)' : 'var(--t3)', transition:'all .1s',
                  }}>
                    <div style={{ fontSize:18, marginBottom:2 }}>{t.icon}</div>
                    <div style={{ fontSize:11, fontWeight:700 }}>{t.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section */}
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Default floor section</label>
            <div style={{ display:'flex', gap:6 }}>
              {SECTIONS.map(s => (
                <button key={String(s)} onClick={() => upd('assignedSection', s)} style={{
                  padding:'7px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
                  background: form.assignedSection === s ? 'var(--acc-d)' : 'var(--bg3)',
                  border:`1px solid ${form.assignedSection === s ? 'var(--acc)' : 'var(--bdr)'}`,
                  color: form.assignedSection === s ? 'var(--acc)' : 'var(--t3)',
                  fontSize:12, fontWeight:700, textTransform:'capitalize',
                }}>{s || 'All'}</button>
              ))}
            </div>
          </div>

          {/* Table service toggle */}
          <div style={{ marginBottom:18, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>Table service</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>Show floor plan, seat guests, manage covers</div>
            </div>
            <button onClick={() => upd('tableServiceEnabled', !form.tableServiceEnabled)} style={{
              width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
              background: form.tableServiceEnabled ? 'var(--grn)' : 'var(--bg4)', transition:'all .2s', flexShrink:0, position:'relative',
            }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left: form.tableServiceEnabled ? 22 : 3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}/>
            </button>
          </div>

          {/* Service charge */}
          {(() => {
            const sc = form.serviceCharge || { enabled: false, rate: 12.5, applyTo: 'all', minCovers: 8 };
            const updSC = (k, v) => upd('serviceCharge', { ...sc, [k]: v });
            return (
              <div style={{ marginBottom:18, padding:'14px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: sc.enabled ? 14 : 0 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>Service charge</div>
                    <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>Applies to dine-in table orders only</div>
                  </div>
                  <button onClick={() => updSC('enabled', !sc.enabled)} style={{
                    width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                    background: sc.enabled ? 'var(--grn)' : 'var(--bg4)', transition:'all .2s', flexShrink:0, position:'relative',
                  }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff', position:'absolute', top:3, left: sc.enabled ? 22 : 3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}/>
                  </button>
                </div>
                {sc.enabled && (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <label style={{ fontSize:12, color:'var(--t3)', flexShrink:0 }}>Rate</label>
                      <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:8, padding:'6px 10px' }}>
                        <input type="number" min="0" max="100" step="0.5" value={sc.rate} onChange={e => updSC('rate', parseFloat(e.target.value)||0)}
                          style={{ width:50, border:'none', background:'transparent', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', textAlign:'right' }}/>
                        <span style={{ fontSize:12, color:'var(--t3)' }}>%</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <label style={{ fontSize:12, color:'var(--t3)' }}>Apply to</label>
                      {[
                        { id:'all',       label:'All dine-in orders', desc:'Every table order' },
                        { id:'minCovers', label:'Minimum covers',     desc:`Only when covers ≥ threshold` },
                      ].map(opt => (
                        <button key={opt.id} onClick={() => updSC('applyTo', opt.id)} style={{
                          padding:'8px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                          background: sc.applyTo === opt.id ? 'var(--acc-d)' : 'var(--bg)',
                          border:`1.5px solid ${sc.applyTo === opt.id ? 'var(--acc)' : 'var(--bdr)'}`,
                        }}>
                          <div style={{ fontSize:12, fontWeight:600, color:sc.applyTo===opt.id?'var(--acc)':'var(--t1)' }}>{opt.label}</div>
                          <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                    {sc.applyTo === 'minCovers' && (
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <label style={{ fontSize:12, color:'var(--t3)', flexShrink:0 }}>Minimum covers</label>
                        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:8, padding:'6px 10px' }}>
                          <input type="number" min="1" max="50" step="1" value={sc.minCovers} onChange={e => updSC('minCovers', parseInt(e.target.value)||1)}
                            style={{ width:40, border:'none', background:'transparent', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', textAlign:'right' }}/>
                          <span style={{ fontSize:12, color:'var(--t3)' }}>+</span>
                        </div>
                        <span style={{ fontSize:11, color:'var(--t4)' }}>covers to trigger service charge</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Menu assignment */}
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Menu</label>
            <div style={{ fontSize:11, color:'var(--t4)', marginBottom:8 }}>Which menu this terminal shows. Create and manage menus in Menu Manager → Menus tab.</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[{ id:null, name:'All menus (default)', description:'Shows all categories from all menus' }, ...(menus||[])].map(m => (
                <button key={String(m.id)} onClick={()=>upd('menuId', m.id)}
                  style={{ padding:'9px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', transition:'all .1s',
                    background: form.menuId === m.id ? 'var(--acc-d)' : 'var(--bg3)',
                    border:`1.5px solid ${form.menuId === m.id ? 'var(--acc)' : 'var(--bdr)'}` }}>
                  <div style={{ fontSize:12, fontWeight:700, color:form.menuId===m.id?'var(--acc)':'var(--t1)' }}>📋 {m.name}</div>
                  {m.description && <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{m.description}</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Hidden features */}
          <div style={{ marginBottom:4 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Hide features from this terminal</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {FEATURES.map(f => {
                const hidden = form.hiddenFeatures.includes(f.id);
                return (
                  <div key={f.id} onClick={() => toggleFeature(f.id)} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'9px 12px', borderRadius:9, cursor:'pointer',
                    background: hidden ? 'var(--red-d)' : 'var(--bg3)',
                    border:`1px solid ${hidden ? 'var(--red-b)' : 'var(--bdr)'}`,
                    transition:'all .1s',
                  }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color: hidden ? 'var(--red)' : 'var(--t1)' }}>{f.label}</div>
                      <div style={{ fontSize:11, color:'var(--t4)', marginTop:1 }}>{f.desc}</div>
                    </div>
                    <div style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background: hidden ? 'var(--red)' : 'var(--bg4)', color: hidden ? '#fff' : 'var(--t4)', flexShrink:0 }}>
                      {hidden ? 'Hidden' : 'Visible'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Master POS toggle */}
        <div style={{ margin:'0 20px 16px', padding:'14px 16px', borderRadius:12,
          background: form.isMaster ? 'rgba(234,179,8,0.1)' : 'var(--bg3)',
          border: `1.5px solid ${form.isMaster ? '#ca8a04' : 'var(--bdr)'}`,
          cursor:'pointer', transition:'all .2s' }}
          onClick={() => upd('isMaster', !form.isMaster)}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color: form.isMaster ? '#ca8a04' : 'var(--t1)' }}>👑 Master POS</div>
              <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>Designate this terminal as the network master. Other devices monitor its heartbeat.</div>
            </div>
            <div style={{ width:36, height:20, borderRadius:10, background: form.isMaster ? '#ca8a04' : 'var(--bdr2)', position:'relative', flexShrink:0, transition:'background .2s' }}>
              <div style={{ position:'absolute', top:2, left: form.isMaster ? 18 : 2, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s' }}/>
            </div>
          </div>
        </div>

        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8, flexShrink:0 }}>
          {!isNew && onDelete && <button onClick={onDelete} style={{ padding:'8px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>Delete</button>}
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:2, height:42 }} disabled={!form.name.trim() || form.enabledOrderTypes.length === 0} onClick={() => onSave(form)}>
            {isNew ? 'Create profile' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
