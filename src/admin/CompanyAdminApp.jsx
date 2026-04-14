import { useState, useEffect } from 'react';
import { VERSION } from '../lib/version';
import BOLogin from '../backoffice/BOLogin';

const S = {
  shell: { display:'flex', height:'100vh', fontFamily:'inherit', background:'#0f1117', color:'#e2e8f0' },
  sidebar: { width:220, background:'#1a1d27', borderRight:'1px solid #2d3148', display:'flex', flexDirection:'column', padding:'24px 0' },
  brand: { padding:'0 20px 24px', borderBottom:'1px solid #2d3148', marginBottom:16 },
  brandBadge: { width:36, height:36, borderRadius:10, background:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'#fff', marginBottom:10 },
  brandName: { fontSize:14, fontWeight:800, color:'#f1f5f9' },
  brandSub: { fontSize:11, color:'#6366f1', fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase' },
  main: { flex:1, overflowY:'auto', padding:'32px 40px' },
  h1: { fontSize:22, fontWeight:800, color:'#f1f5f9', marginBottom:4 },
  sub: { fontSize:13, color:'#64748b', marginBottom:32 },
  card: { background:'#1a1d27', border:'1px solid #2d3148', borderRadius:12, padding:24, marginBottom:20 },
  cardTitle: { fontSize:14, fontWeight:700, color:'#e2e8f0', marginBottom:16 },
  label: { fontSize:12, fontWeight:600, color:'#94a3b8', marginBottom:5, display:'block' },
  input: { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid #2d3148', background:'#0f1117', color:'#f1f5f9', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 },
  row3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 },
  btn: { padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' },
  btnPrimary: { background:'#6366f1', color:'#fff' },
  btnGhost: { background:'#1a1d27', color:'#94a3b8', border:'1px solid #2d3148' },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { textAlign:'left', padding:'8px 12px', borderBottom:'1px solid #2d3148', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em' },
  td: { padding:'12px', borderBottom:'1px solid #1e2235', color:'#94a3b8', verticalAlign:'top' },
  badge: { padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700 },
};

// Direct REST fetch — bypasses supabase client auth init delay
async function sbFetch(path, opts = {}) {
  const auth = JSON.parse(localStorage.getItem('rpos-auth') || 'null');
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || !key) return { data: null, error: { message: 'Supabase not configured' } };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${auth?.access_token || key}`,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
    },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) return { data: null, error: { message: data?.message || res.statusText } };
  return { data, error: null };
}

export default function CompanyAdminApp() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const fallback = setTimeout(() => setAuthChecked(true), 4000);
    // Check session via direct REST (faster than supabase client init)
    const auth = JSON.parse(localStorage.getItem('rpos-auth') || 'null');
    if (auth?.user && auth?.expires_at && Date.now() < auth.expires_at * 1000) {
      clearTimeout(fallback);
      setAuthUser(auth.user);
      setAuthChecked(true);
    } else {
      clearTimeout(fallback);
      setAuthChecked(true);
    }
  }, []);

  if (!authChecked) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f1117', color:'#64748b', fontSize:13 }}>Loading…</div>;
  if (!authUser) return <BOLogin onLogin={(u) => { setAuthUser(u); }} />;
  return <AdminPanel authUser={authUser} />;
}

function AdminPanel({ authUser }) {
  const [section, setSection] = useState('orgs');
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [editUsersFor, setEditUsersFor] = useState(null); // location id being edited
  const [form, setForm] = useState({});
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState({ type:'', text:'' });

  useEffect(() => { loadOrgs(); }, []);

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const { data } = await sbFetch('organisations?select=*&order=created_at.desc');
      setOrgs(Array.isArray(data) ? data : []);
    } catch(e) { setOrgs([]); }
    setLoading(false);
  };

  const loadLocations = async (orgId) => {
    const { data } = await sbFetch(`locations?select=*,subscriptions(plan,gmv_this_month),location_features(feature,price_per_month)&org_id=eq.${orgId}&order=created_at.asc`);
    setLocations(Array.isArray(data) ? data : []);
  };

  const loadUsers = async (orgId) => {
    const { data } = await sbFetch(`user_profiles?select=*,user_locations(location_id)&org_id=eq.${orgId}&order=created_at.asc`);
    setUsers(Array.isArray(data) ? data : []);
  };

  const selectOrg = async (org) => {
    setSelectedOrg(org);
    setSection('org-detail');
    setMsg({ type:'', text:'' });
    setEditUsersFor(null);
    await Promise.all([loadLocations(org.id), loadUsers(org.id)]);
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const ok = t => setMsg({ type:'ok', text:t });
  const err = t => setMsg({ type:'err', text:t });

  const createOrg = async () => {
    if (!form.name?.trim()) return err('Organisation name is required');
    setWorking(true); setMsg({ type:'', text:'' });
    const slug = (form.slug || form.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const { data, error:e } = await sbFetch('organisations', { method:'POST', body:{ name:form.name.trim(), slug, status:'active' } });
    setWorking(false);
    if (e) return err(e.message);
    const org = Array.isArray(data) ? data[0] : data;
    ok(`✓ "${org.name}" created`);
    setForm({});
    await loadOrgs();
    await selectOrg(org);
  };

  const createLocation = async () => {
    if (!form.locName?.trim()) return err('Location name required');
    setWorking(true); setMsg({ type:'', text:'' });
    const { data, error:e } = await sbFetch('locations', { method:'POST', body:{
      org_id: selectedOrg.id, name: form.locName.trim(),
      address: form.locAddress || '', timezone: form.locTz || 'Europe/London',
      currency: form.locCurrency || 'GBP', status: 'active',
    }});
    const loc = Array.isArray(data) ? data[0] : data;
    if (e || !loc) { setWorking(false); return err(e?.message || 'Failed'); }
    const maxDevices = parseInt(form.maxDevices) || 3;
    await sbFetch('subscriptions', { method:'POST', body:{ org_id:selectedOrg.id, location_id:loc.id, plan:'free', gmv_this_month:0, billing_period_start:new Date().toISOString().slice(0,10) } });
    await sbFetch('location_features', { method:'POST', body:{ location_id:loc.id, feature:'max_devices', enabled:true, price_per_month:maxDevices } });
    setWorking(false);
    ok(`✓ "${loc.name}" created`);
    setForm(p => ({ ...p, locName:'', locAddress:'', maxDevices:'' }));
    setSection('org-detail');
    await loadLocations(selectedOrg.id);
  };

  const createUser = async () => {
    if (!form.inviteEmail?.trim()) return err('Email required');
    if (!form.invitePassword?.trim() || form.invitePassword.length < 8) return err('Password min 8 chars');
    setWorking(true); setMsg({ type:'', text:'' });
    const auth = JSON.parse(localStorage.getItem('rpos-auth') || 'null');
    const assignLocationId = form.inviteLocationId || locations[0]?.id || null;
    try {
      const resp = await fetch('https://tbetcegmszzotrwdtqhi.supabase.co/functions/v1/create-user', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${auth?.access_token}` },
        body: JSON.stringify({ email:form.inviteEmail.trim(), password:form.invitePassword, fullName:form.inviteName||'', orgId:selectedOrg.id, locationId:assignLocationId, role:'owner' }),
      });
      const result = await resp.json();
      setWorking(false);
      if (result.error) return err(result.error);
      ok(`✓ User created: ${result.email}`);
      setForm(p => ({ ...p, inviteEmail:'', invitePassword:'', inviteName:'', inviteLocationId:'' }));
      setSection('org-detail');
      await loadUsers(selectedOrg.id);
    } catch(e) { setWorking(false); err(e.message); }
  };

  const toggleUserLocation = async (userId, locationId, hasAccess) => {
    if (hasAccess) {
      await sbFetch(`user_locations?user_id=eq.${userId}&location_id=eq.${locationId}`, { method:'DELETE', prefer:'' });
    } else {
      await sbFetch('user_locations', { method:'POST', body:{ user_id:userId, location_id:locationId } });
      // Set as primary location if they don't have one
      const u = users.find(u => u.id === userId);
      if (!u?.location_id) await sbFetch(`user_profiles?id=eq.${userId}`, { method:'PATCH', body:{ location_id:locationId } });
    }
    await loadUsers(selectedOrg.id);
  };

  const usersForLocation = (locId) =>
    users.filter(u => u.location_id === locId || u.user_locations?.some(ul => ul.location_id === locId));

  const msgBg = { ok:{ bg:'#0d2e1a', border:'#166534', color:'#86efac' }, err:{ bg:'#2d0f0f', border:'#991b1b', color:'#fca5a5' } };
  const ms = msgBg[msg.type];

  return (
    <div style={S.shell}>
      <div style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.brandBadge}>R</div>
          <div style={S.brandName}>Restaurant OS</div>
          <div style={S.brandSub}>Company Admin</div>
        </div>
        {[{ id:'orgs', label:'All organisations', icon:'🏢' }, { id:'new-org', label:'+ New organisation', icon:'' }].map(n => (
          <button key={n.id} onClick={() => { setSection(n.id); setMsg({ type:'', text:'' }); }}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', margin:'1px 8px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:(section===n.id||section==='org-detail'&&n.id==='orgs')?700:400, background:(section===n.id||section==='org-detail'&&n.id==='orgs')?'#2d3148':'none', color:(section===n.id||section==='org-detail'&&n.id==='orgs')?'#f1f5f9':'#94a3b8', border:'none', fontFamily:'inherit', width:'calc(100% - 16px)', textAlign:'left' }}>
            {n.icon} {n.label}
          </button>
        ))}
        {selectedOrg && (
          <div style={{ padding:'4px 8px' }}>
            <button onClick={() => setSection('org-detail')} style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, color:'#6366f1', background:section==='org-detail'?'#1e1a3a':'none', fontFamily:'inherit' }}>
              └ {selectedOrg.name}
            </button>
          </div>
        )}
        <div style={{ flex:1 }} />
        <div style={{ padding:'0 12px' }}>
          <div style={{ fontSize:11, color:'#475569', padding:'0 6px', marginBottom:6 }}>{authUser.email}</div>
          <button onClick={() => { localStorage.removeItem('rpos-auth'); window.location.reload(); }} style={{ ...S.btn, ...S.btnGhost, width:'100%', fontSize:12 }}>Sign out</button>
          <button onClick={() => { localStorage.removeItem('rpos-device-mode'); window.location.href = '/'; }} style={{ width:'100%', padding:'6px', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#475569', marginTop:4, fontFamily:'inherit' }}>← Switch device mode</button>
        </div>
      </div>

      <div style={S.main}>
        {ms && msg.text && <div style={{ background:ms.bg, border:`1px solid ${ms.border}`, color:ms.color, borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13 }}>{msg.text}</div>}

        {/* ── Orgs list ── */}
        {section === 'orgs' && (
          <>
            <div style={S.h1}>🏢 Organisations</div>
            <div style={S.sub}>All restaurants on the platform · {orgs.length} total</div>
            <button onClick={() => setSection('new-org')} style={{ ...S.btn, ...S.btnPrimary, marginBottom:20 }}>+ New organisation</button>
            <div style={S.card}>
              {loading ? <div style={{ color:'#64748b', fontSize:13 }}>Loading… <button onClick={loadOrgs} style={{ ...S.btn, ...S.btnGhost, padding:'3px 10px', fontSize:11, marginLeft:8 }}>Retry</button></div> : (
                <table style={S.table}>
                  <thead><tr><th style={S.th}>Name</th><th style={S.th}>Slug</th><th style={S.th}>Status</th><th style={S.th}>Created</th><th style={S.th}></th></tr></thead>
                  <tbody>
                    {orgs.map(o => (
                      <tr key={o.id}>
                        <td style={{ ...S.td, fontWeight:700, color:'#f1f5f9' }}>{o.name}</td>
                        <td style={{ ...S.td, fontFamily:'monospace', fontSize:12, color:'#64748b' }}>{o.slug}</td>
                        <td style={S.td}><span style={{ ...S.badge, background:'#0d2e1a', color:'#86efac' }}>{o.status}</span></td>
                        <td style={{ ...S.td, fontSize:12 }}>{new Date(o.created_at).toLocaleDateString('en-GB')}</td>
                        <td style={S.td}><button onClick={() => selectOrg(o)} style={{ ...S.btn, ...S.btnGhost, padding:'5px 12px', fontSize:12 }}>Manage →</button></td>
                      </tr>
                    ))}
                    {!orgs.length && <tr><td colSpan={5} style={{ ...S.td, textAlign:'center', padding:40 }}>No organisations yet</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── New org form ── */}
        {section === 'new-org' && (
          <>
            <div style={S.h1}>New Organisation</div>
            <div style={S.sub}>Create a new restaurant company</div>
            <div style={S.card}>
              <div style={S.row}>
                <div><label style={S.label}>Name *</label><input style={S.input} placeholder="e.g. Dougboy Donuts" value={form.name||''} onChange={e=>f('name',e.target.value)} /></div>
                <div><label style={S.label}>Slug (auto)</label><input style={S.input} placeholder="dougboy-donuts" value={form.slug||''} onChange={e=>f('slug',e.target.value)} /></div>
              </div>
              <button onClick={createOrg} disabled={working} style={{ ...S.btn, ...S.btnPrimary }}>{working?'Creating…':'Create →'}</button>
            </div>
          </>
        )}

        {/* ── Org detail ── */}
        {(section === 'org-detail' || section === 'new-location' || section === 'create-user') && selectedOrg && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
              <div style={S.h1}>{selectedOrg.name}</div>
              <span style={{ ...S.badge, background:'#0d2e1a', color:'#86efac' }}>{selectedOrg.status}</span>
            </div>
            <div style={S.sub}>Manage locations and user access</div>

            {section === 'org-detail' && (
              <>
                <div style={{ display:'flex', gap:10, marginBottom:24 }}>
                  <button onClick={() => setSection('new-location')} style={{ ...S.btn, ...S.btnPrimary }}>+ Add location</button>
                  <button onClick={() => { setSection('create-user'); setMsg({type:'',text:''}); }} style={{ ...S.btn, ...S.btnGhost }}>👤 Create user</button>
                </div>

                {/* ── Locations with inline user management ── */}
                <div style={S.card}>
                  <div style={S.cardTitle}>📍 Locations & User Access</div>
                  {locations.length === 0
                    ? <div style={{ color:'#64748b', fontSize:13, padding:'20px 0' }}>No locations yet</div>
                    : locations.map(loc => {
                        const maxDev = loc.location_features?.find(f=>f.feature==='max_devices')?.price_per_month || 3;
                        const plan = loc.subscriptions?.[0]?.plan || 'free';
                        const gmv = loc.subscriptions?.[0]?.gmv_this_month || 0;
                        const locUsers = usersForLocation(loc.id);
                        const isEditing = editUsersFor === loc.id;

                        return (
                          <div key={loc.id} style={{ borderBottom:'1px solid #2d3148', paddingBottom:20, marginBottom:20, ':last-child':{ borderBottom:'none' } }}>
                            {/* Location header row */}
                            <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
                              <div style={{ flex:1, minWidth:200 }}>
                                <div style={{ fontSize:15, fontWeight:700, color:'#f1f5f9', marginBottom:4 }}>{loc.name}</div>
                                <div style={{ fontSize:12, color:'#64748b', display:'flex', gap:12 }}>
                                  <span style={{ ...S.badge, background:'#1e1a3a', color:'#a5b4fc' }}>{plan}</span>
                                  <span>{maxDev} max devices</span>
                                  <span>£{parseFloat(gmv).toFixed(2)} GMV</span>
                                </div>
                              </div>

                              {/* Users for this location */}
                              <div style={{ flex:2, minWidth:260 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Users with access</div>
                                {isEditing ? (
                                  <div>
                                    {users.length === 0
                                      ? <div style={{ fontSize:12, color:'#475569' }}>No users in this org yet — create one first</div>
                                      : users.map(u => {
                                          const has = locUsers.some(lu => lu.id === u.id);
                                          return (
                                            <label key={u.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, cursor:'pointer' }}>
                                              <input type="checkbox" checked={has}
                                                onChange={() => toggleUserLocation(u.id, loc.id, has)}
                                                style={{ accentColor:'#6366f1', width:16, height:16 }}
                                              />
                                              <div>
                                                <div style={{ fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{u.full_name || '—'}</div>
                                                <div style={{ fontSize:11, color:'#6366f1', fontFamily:'monospace' }}>{u.email}</div>
                                              </div>
                                            </label>
                                          );
                                        })
                                    }
                                    <button onClick={() => setEditUsersFor(null)} style={{ ...S.btn, ...S.btnGhost, padding:'5px 14px', fontSize:12, marginTop:4 }}>Done</button>
                                  </div>
                                ) : (
                                  <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                                    {locUsers.length === 0
                                      ? <span style={{ fontSize:12, color:'#475569' }}>No users assigned</span>
                                      : locUsers.map(u => (
                                          <div key={u.id} style={{ background:'#1e1a3a', border:'1px solid #3730a3', borderRadius:8, padding:'4px 10px' }}>
                                            <div style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>{u.full_name || u.email}</div>
                                            <div style={{ fontSize:11, color:'#6366f1', fontFamily:'monospace' }}>{u.email}</div>
                                          </div>
                                        ))
                                    }
                                    <button onClick={() => setEditUsersFor(loc.id)} style={{ ...S.btn, ...S.btnGhost, padding:'5px 12px', fontSize:12 }}>
                                      {locUsers.length ? 'Edit access' : '+ Add user'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  }
                </div>
              </>
            )}

            {/* ── Add location form ── */}
            {section === 'new-location' && (
              <div style={S.card}>
                <div style={S.cardTitle}>Add location to {selectedOrg.name}</div>
                <div style={S.row}>
                  <div><label style={S.label}>Location name *</label><input style={S.input} placeholder="e.g. Oxford Street" value={form.locName||''} onChange={e=>f('locName',e.target.value)} /></div>
                  <div><label style={S.label}>Address</label><input style={S.input} placeholder="123 High St" value={form.locAddress||''} onChange={e=>f('locAddress',e.target.value)} /></div>
                </div>
                <div style={S.row3}>
                  <div><label style={S.label}>Timezone</label>
                    <select style={S.input} value={form.locTz||'Europe/London'} onChange={e=>f('locTz',e.target.value)}>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="Asia/Dubai">Asia/Dubai</option>
                    </select>
                  </div>
                  <div><label style={S.label}>Currency</label>
                    <select style={S.input} value={form.locCurrency||'GBP'} onChange={e=>f('locCurrency',e.target.value)}>
                      <option value="GBP">GBP £</option><option value="EUR">EUR €</option><option value="USD">USD $</option><option value="AED">AED</option>
                    </select>
                  </div>
                  <div><label style={S.label}>Max POS devices</label><input style={S.input} type="number" min="1" max="20" placeholder="3" value={form.maxDevices||''} onChange={e=>f('maxDevices',e.target.value)} /></div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={createLocation} disabled={working} style={{ ...S.btn, ...S.btnPrimary }}>{working?'Creating…':'Create location →'}</button>
                  <button onClick={() => setSection('org-detail')} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── Create user form ── */}
            {section === 'create-user' && (
              <div style={S.card}>
                <div style={S.cardTitle}>👤 Create user for {selectedOrg.name}</div>
                <div style={S.row}>
                  <div><label style={S.label}>Email *</label><input type="email" style={S.input} placeholder="owner@restaurant.com" value={form.inviteEmail||''} onChange={e=>f('inviteEmail',e.target.value)} /></div>
                  <div><label style={S.label}>Full name</label><input style={S.input} placeholder="Sarah Smith" value={form.inviteName||''} onChange={e=>f('inviteName',e.target.value)} /></div>
                </div>
                <div style={S.row}>
                  <div><label style={S.label}>Password *</label><input type="password" style={S.input} placeholder="Min 8 characters" value={form.invitePassword||''} onChange={e=>f('invitePassword',e.target.value)} /></div>
                  <div><label style={S.label}>Primary location</label>
                    <select style={S.input} value={form.inviteLocationId||''} onChange={e=>f('inviteLocationId',e.target.value)}>
                      <option value="">First location (auto)</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={createUser} disabled={working} style={{ ...S.btn, ...S.btnPrimary }}>{working?'Creating…':'Create user →'}</button>
                  <button onClick={() => setSection('org-detail')} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
