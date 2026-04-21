import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { supabase, isMock } from '../../lib/supabase';

const ROLES = ['Manager','Server','Bartender','Cashier','Kitchen'];
const ROLE_COLORS = { Manager:'#e8a020', Server:'#3b82f6', Bartender:'#22c55e', Cashier:'#a855f7', Kitchen:'#ef4444' };
const PERM_GROUPS = [
  { group:'Orders',     perms:[{id:'void',label:'Void items'},{id:'discount',label:'Apply discounts'},{id:'priceOverride',label:'Override price'}] },
  { group:'Payments',   perms:[{id:'refund',label:'Process refunds'},{id:'cashup',label:'Cash up drawer'},{id:'openDrawer',label:'Open cash drawer'}] },
  { group:'Management', perms:[{id:'reports',label:'View reports'},{id:'eod',label:'End of day close'},{id:'menu86',label:'86 menu items'},{id:'staff',label:'Manage staff'}] },
];
const ROLE_DEFAULTS = {
  Manager:   ['void','discount','priceOverride','refund','cashup','openDrawer','reports','eod','menu86','staff'],
  Server:    [],
  Bartender: ['void','openDrawer'],
  Cashier:   ['cashup','openDrawer'],
  Kitchen:   [],
};

const inp = { background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:9, padding:'8px 11px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' };

function initials(name) {
  return (name||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
}
function randomColor() {
  const palette = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899'];
  return palette[Math.floor(Math.random()*palette.length)];
}

export default function StaffManager() {
  const { staffMembers, addStaffMember, updateStaffMember, removeStaffMember, markBOChange, showToast } = useStore();

  // Load staff from Supabase on mount (real mode only)
  useEffect(() => {
    if (isMock) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('user_profiles').select('org_id, location_id').eq('id', user.id).single();
      let locationId = profile?.location_id;
      // Auto-assign first location if none set
      if (!locationId && profile?.org_id) {
        const { data: locs } = await supabase.from('locations').select('id').eq('org_id', profile.org_id).limit(1);
        locationId = locs?.[0]?.id;
        if (locationId) await supabase.from('user_profiles').update({ location_id: locationId }).eq('id', user.id);
      }
      if (!locationId) return;
      const { data: rows } = await supabase.from('staff_members').select('*').eq('location_id', locationId).eq('active', true);
      if (rows?.length) {
        useStore.setState({ staffMembers: rows.map(r => ({
          id: r.id, name: r.name, role: r.role, pin: r.pin,
          color: r.color || '#3b82f6', initials: r.initials || r.name.slice(0,2).toUpperCase(),
          permissions: Array.isArray(r.permissions) ? r.permissions : (ROLE_DEFAULTS[r.role] || []),
          active: r.active,
        })) });
      }
    })();
  }, []);

  const saveStaffToSupabase = async (member, locationId, orgId) => {
    await supabase.from('staff_members').upsert({
      id: member.id.startsWith('s-') ? undefined : member.id, // let Supabase generate UUID for new records
      location_id: locationId, org_id: orgId,
      name: member.name, role: member.role, pin: member.pin,
      color: member.color, initials: member.initials, active: true,
    }, { onConflict: 'id' });
  };

  const deleteStaffFromSupabase = async (id) => {
    if (!id.startsWith('s-')) { // only delete real UUIDs
      await supabase.from('staff_members').update({ active: false }).eq('id', id);
    }
  };
  const [selId, setSelId]     = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPin, setShowPin] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [newForm, setNewForm] = useState({ name:'', role:'Server', color:'#3b82f6', pin:'', permissions:[] });

  const sel = staffMembers.find(s => s.id === selId);

  const save = (id, patch) => {
    updateStaffMember(id, patch);
    markBOChange();

    // Persist patch to Supabase (real mode only). Fire-and-forget but
    // surface silent 0-row updates (v4.4.1 lesson) via a toast.
    if (isMock) return;
    if (String(id).startsWith('s-')) {
      // In-memory row that was never inserted to Supabase (addMember fallback
      // path when locationId was unavailable). Nothing to update server-side.
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('staff_members')
          .update(patch)
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          console.warn('[StaffManager] save: 0 rows updated for id', id, 'patch', patch);
          showToast('Save did not land — row not found on server', 'error');
        }
      } catch (e) {
        console.error('[StaffManager] save failed:', e.message, 'patch', patch);
        showToast(`Save failed: ${e.message}`, 'error');
      }
    })();
  };

  const addMember = () => {
    if (!newForm.name.trim()) return;
    const perms = newForm.permissions.length ? newForm.permissions : ROLE_DEFAULTS[newForm.role] || [];
    const member = { ...newForm, name:newForm.name.trim(), permissions:perms, initials:initials(newForm.name) };
    addStaffMember(member);
    // Save to Supabase
    if (!isMock) {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('user_profiles').select('org_id, location_id').eq('id', user.id).single();
        // Get location_id — from profile, or find first location in their org
        let locationId = profile?.location_id;
        if (!locationId && profile?.org_id) {
          const { data: locs } = await supabase.from('locations').select('id').eq('org_id', profile.org_id).limit(1);
          locationId = locs?.[0]?.id;
          // Also update user profile so we don't have to look this up again
          if (locationId) await supabase.from('user_profiles').update({ location_id: locationId }).eq('id', user.id);
        }
        if (locationId) {
          const { error } = await supabase.from('staff_members').insert({
            location_id: locationId, org_id: profile?.org_id,
            name: member.name, role: member.role, pin: member.pin,
            color: member.color || '#3b82f6', initials: member.initials,
            permissions: member.permissions || [],
            active: true,
          });
          if (error) console.error('Staff save failed:', error.message);
        } else {
          console.warn('Cannot save staff — no location_id found for this user');
        }
      })();
    }
    markBOChange();
    showToast(`${newForm.name} added`, 'success');
    setShowAdd(false);
    setNewForm({ name:'', role:'Server', color:'#3b82f6', pin:'', permissions:[] });
  };

  const deleteMember = (id) => {
    removeStaffMember(id);
    if (!isMock && !String(id).startsWith('s-')) {
      supabase.from('staff_members').update({ active: false }).eq('id', id);
    }
    markBOChange();
    if (selId === id) setSelId(null);
    showToast('Staff member removed', 'info');
  };

  const togglePerm = (id, perm) => {
    const member = staffMembers.find(s => s.id === id);
    if (!member) return;
    const cur = member.permissions || [];
    save(id, { permissions: cur.includes(perm) ? cur.filter(p=>p!==perm) : [...cur,perm] });
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── Staff list ────────────────────────────────────────── */}
      <div style={{ width:280, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ fontSize:13, fontWeight:800, color:'var(--t1)', flex:1 }}>Staff</span>
          <span style={{ fontSize:11, color:'var(--t4)' }}>{staffMembers.length} members</span>
          <button onClick={()=>setShowAdd(true)} style={{ padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700 }}>+ Add</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {staffMembers.map(s => {
            const color = ROLE_COLORS[s.role] || '#3b82f6';
            const active = selId === s.id;
            return (
              <div key={s.id} onClick={()=>setSelId(active?null:s.id)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginBottom:5, borderRadius:11, cursor:'pointer',
                  border:`1.5px solid ${active?'var(--acc)':'var(--bdr)'}`, background:active?'var(--acc-d)':'var(--bg3)' }}>
                {/* Avatar */}
                <div style={{ width:36, height:36, borderRadius:'50%', background:s.color||color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {initials(s.name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:active?'var(--acc)':'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize:11, fontWeight:600, color }}>
                    {s.role}
                    {s.pin ? ' · PIN set' : <span style={{ color:'var(--red)' }}> · No PIN</span>}
                  </div>
                </div>
                <div style={{ width:8, height:8, borderRadius:'50%', background:active?'var(--acc)':s.pin?'var(--grn)':'var(--red)', flexShrink:0 }}/>
              </div>
            );
          })}
          {staffMembers.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 8px', color:'var(--t4)', fontSize:11 }}>No staff yet — click + Add to get started</div>
          )}
        </div>
      </div>

      {/* ── Detail / editor ──────────────────────────────────── */}
      {sel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:sel.color||ROLE_COLORS[sel.role]||'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'#fff', flexShrink:0 }}>
              {initials(sel.name)}
            </div>
            <div style={{ flex:1 }}>
              <input style={{ ...inp, fontSize:16, fontWeight:800, border:'none', background:'transparent', padding:'0 0 3px', width:'auto', maxWidth:260 }}
                value={sel.name} onChange={e=>save(sel.id,{name:e.target.value,initials:initials(e.target.value)})}/>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {ROLES.map(r=>(
                  <button key={r} onClick={()=>save(sel.id,{role:r})} style={{ padding:'2px 8px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:sel.role===r?700:400, border:`1px solid ${sel.role===r?ROLE_COLORS[r]:'var(--bdr)'}`, background:sel.role===r?ROLE_COLORS[r]+'22':'transparent', color:sel.role===r?ROLE_COLORS[r]:'var(--t4)' }}>{r}</button>
                ))}
              </div>
            </div>
            {/* Avatar colour */}
            <div style={{ display:'flex', gap:4 }}>
              {['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#f97316'].map(c=>(
                <button key={c} onClick={()=>save(sel.id,{color:c})} style={{ width:18,height:18,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:(sel.color||'#3b82f6')===c?'2px solid var(--t1)':'none',outlineOffset:2 }}/>
              ))}
            </div>
            <button onClick={()=>deleteMember(sel.id)} style={{ padding:'5px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11, fontWeight:600 }}>Remove</button>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
            {/* PIN */}
            <div style={{ marginBottom:20, padding:'12px 14px', background:'var(--bg2)', borderRadius:12, border:'1px solid var(--bdr)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:sel.pin?4:0 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)', marginBottom:2 }}>Login PIN</div>
                  <div style={{ fontSize:10, color:'var(--t3)' }}>4-digit PIN used at the POS login screen. Required for all staff.</div>
                </div>
                {sel.pin ? (
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'var(--grn)', fontWeight:700 }}>✓ PIN set</span>
                    <button onClick={()=>{ setShowPin(sel.id); setPinInput(''); }} style={{ padding:'4px 10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>Change</button>
                    <button onClick={()=>save(sel.id,{pin:''})} style={{ padding:'4px 10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11, fontWeight:600 }}>Clear</button>
                  </div>
                ) : (
                  <button onClick={()=>{ setShowPin(sel.id); setPinInput(''); }} style={{ padding:'6px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700 }}>Set PIN</button>
                )}
              </div>
              {sel.pin && <div style={{ display:'flex', gap:6 }}>{Array(4).fill(null).map((_,i)=><div key={i} style={{ width:16, height:16, borderRadius:'50%', background:'var(--t3)' }}/>)}</div>}
            </div>

            {/* Permissions */}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)' }}>Permissions</div>
                <button onClick={()=>save(sel.id,{permissions:ROLE_DEFAULTS[sel.role]||[]})} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t4)' }}>Reset to {sel.role} defaults</button>
              </div>
              <div style={{ fontSize:10, color:'var(--t3)', marginBottom:12 }}>Permissions without a tick require manager PIN override at POS.</div>

              {PERM_GROUPS.map(({ group, perms }) => (
                <div key={group} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{group}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {perms.map(({ id, label }) => {
                      const has = (sel.permissions||[]).includes(id);
                      return (
                        <div key={id} onClick={()=>togglePerm(sel.id, id)}
                          style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 11px', borderRadius:8, cursor:'pointer',
                            border:`1.5px solid ${has?'var(--acc)':'var(--bdr)'}`, background:has?'var(--acc-d)':'var(--bg3)' }}>
                          <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${has?'var(--acc)':'var(--bdr2)'}`, background:has?'var(--acc)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {has && <div style={{ width:7, height:7, borderRadius:1, background:'#0b0c10' }}/>}
                          </div>
                          <span style={{ fontSize:12, fontWeight:has?600:400, color:has?'var(--acc)':'var(--t1)', flex:1 }}>{label}</span>
                          {has && <span style={{ fontSize:10, color:'var(--acc)', fontWeight:700 }}>Allowed</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--t4)' }}>
          <div style={{ fontSize:32, opacity:.15 }}>👤</div>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--t3)' }}>Select a staff member to edit</div>
        </div>
      )}

      {/* ── Add staff modal ───────────────────────────────────── */}
      {showAdd && (
        <div className="modal-back" onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:18, width:'100%', maxWidth:420, padding:22, boxShadow:'var(--sh3)' }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)', marginBottom:14 }}>Add staff member</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5, display:'block' }}>Full name</label>
                <input style={inp} value={newForm.name} onChange={e=>setNewForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Jane Smith" autoFocus/>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5, display:'block' }}>Role</label>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {ROLES.map(r=>(
                    <button key={r} onClick={()=>setNewForm(f=>({...f,role:r,permissions:ROLE_DEFAULTS[r]||[]}))} style={{ padding:'5px 12px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:newForm.role===r?700:400, border:`1.5px solid ${newForm.role===r?ROLE_COLORS[r]:'var(--bdr)'}`, background:newForm.role===r?ROLE_COLORS[r]+'22':'var(--bg3)', color:newForm.role===r?ROLE_COLORS[r]:'var(--t2)' }}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5, display:'block' }}>PIN (4 digits)</label>
                <input style={inp} type="password" maxLength={4} inputMode="numeric" value={newForm.pin} onChange={e=>setNewForm(f=>({...f,pin:e.target.value.replace(/\D/g,'').slice(0,4)}))} placeholder="0000"/>
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5, display:'block' }}>Colour</label>
                <div style={{ display:'flex', gap:4 }}>
                  {['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#f97316','#22d3ee','#ec4899'].map(c=>(
                    <button key={c} onClick={()=>setNewForm(f=>({...f,color:c}))} style={{ width:24,height:24,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:newForm.color===c?'2px solid var(--t1)':'none',outlineOffset:2 }}/>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={()=>setShowAdd(false)} style={{ flex:1, padding:'9px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:13 }}>Cancel</button>
              <button onClick={addMember} disabled={!newForm.name.trim()} style={{ flex:2, padding:'9px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:14, fontWeight:800, opacity:newForm.name.trim()?1:.4 }}>Add staff member</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set PIN modal ─────────────────────────────────────── */}
      {showPin && (
        <div className="modal-back" onClick={e=>e.target===e.currentTarget&&setShowPin(null)}>
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:18, width:'100%', maxWidth:320, padding:22, boxShadow:'var(--sh3)' }}>
            <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)', marginBottom:6 }}>Set PIN</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginBottom:14 }}>Enter a 4-digit PIN for {staffMembers.find(s=>s.id===showPin)?.name}.</div>
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:16 }}>
              {Array(4).fill(null).map((_,i)=>(
                <div key={i} style={{ width:44, height:54, borderRadius:10, border:`2px solid ${i<pinInput.length?'var(--acc)':'var(--bdr2)'}`, background:i<pinInput.length?'var(--acc-d)':'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'var(--acc)' }}>
                  {i<pinInput.length?'●':''}
                </div>
              ))}
            </div>
            {/* Numpad */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k,i)=>(
                <button key={i} onClick={()=>{
                  if (k==='⌫') setPinInput(p=>p.slice(0,-1));
                  else if (k!=='' && pinInput.length<4) setPinInput(p=>p+k);
                }} style={{ height:48, borderRadius:11, cursor:k===''?'default':'pointer', fontFamily:'inherit', background:k===''?'transparent':'var(--bg3)', border:k===''?'none':'1px solid var(--bdr2)', color:k==='⌫'?'var(--red)':'var(--t1)', fontSize:18, fontWeight:700, opacity:k===''?.3:1 }}>{k}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{setShowPin(null);setPinInput('');}} style={{ flex:1, padding:'9px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:13 }}>Cancel</button>
              <button onClick={()=>{ if(pinInput.length===4){ save(showPin,{pin:pinInput}); showToast('PIN updated','success'); setShowPin(null); setPinInput(''); } }} disabled={pinInput.length!==4} style={{ flex:2, padding:'9px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:14, fontWeight:800, opacity:pinInput.length===4?1:.4 }}>Save PIN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
