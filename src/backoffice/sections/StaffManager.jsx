import { useState } from 'react';
import { STAFF } from '../../data/seed';

const ROLES = ['Manager', 'Server', 'Bartender', 'Cashier', 'Kitchen'];
const ROLE_COLORS = { Manager:'#e8a020', Server:'#3b82f6', Bartender:'#22c55e', Cashier:'#a855f7', Kitchen:'#ef4444' };
const PERMISSIONS = [
  { id:'void',      label:'Void items without PIN',   group:'Orders' },
  { id:'discount',  label:'Apply discounts without PIN', group:'Orders' },
  { id:'refund',    label:'Process refunds',          group:'Payments' },
  { id:'cashup',    label:'Cash up drawer',           group:'Payments' },
  { id:'reports',   label:'View reports',             group:'Management' },
  { id:'eod',       label:'End of day close',         group:'Management' },
  { id:'menu86',    label:'86 menu items',            group:'Management' },
  { id:'staff',     label:'Manage staff',             group:'Management' },
];

const ROLE_DEFAULTS = {
  Manager:    ['void','discount','refund','cashup','reports','eod','menu86','staff'],
  Server:     [],
  Bartender:  ['void'],
  Cashier:    ['cashup'],
  Kitchen:    [],
};

export default function StaffManager() {
  const [staffList, setStaffList] = useState(STAFF.map(s => ({ ...s, permissions: ROLE_DEFAULTS[s.role] || [] })));
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPin, setShowPin] = useState(null); // staff id

  const save = (updated) => {
    setStaffList(sl => sl.map(s => s.id === updated.id ? updated : s));
    setEditing(null);
  };

  const add = (member) => {
    setStaffList(sl => [...sl, { ...member, id:`s-${Date.now()}` }]);
    setShowAdd(false);
  };

  const remove = (id) => {
    setStaffList(sl => sl.filter(s => s.id !== id));
    setEditing(null);
  };

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ fontSize:13, color:'var(--t3)', maxWidth:500 }}>
          Manage staff, PINs, and permissions. Roles set default permissions — you can customise individual access for each person.
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding:'8px 18px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, flexShrink:0 }}>+ Add staff</button>
      </div>

      {/* Staff cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
        {staffList.map(member => {
          const roleColor = ROLE_COLORS[member.role] || '#888780';
          return (
            <div key={member.id} style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  background:`${roleColor}22`, border:`2px solid ${roleColor}44`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:700, color:roleColor, flexShrink:0,
                }}>{member.initials}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)' }}>{member.name}</div>
                  <div style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${roleColor}22`, color:roleColor, border:`1px solid ${roleColor}44`, display:'inline-block', marginTop:3 }}>{member.role}</div>
                </div>
              </div>
              <div style={{ fontSize:11, color:'var(--t4)', marginBottom:10 }}>
                {member.permissions?.length ? (
                  <span>{member.permissions.length} extra permission{member.permissions.length !== 1 ? 's' : ''}</span>
                ) : (
                  <span>Standard {member.role} permissions</span>
                )}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => setEditing(member)} style={{ flex:1, height:32, borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>Edit</button>
                <button onClick={() => setShowPin(member.id)} style={{ flex:1, height:32, borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>Change PIN</button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && <StaffEditModal member={editing} onSave={save} onRemove={() => remove(editing.id)} onClose={() => setEditing(null)}/>}
      {showAdd  && <StaffEditModal member={null} onSave={add} onClose={() => setShowAdd(false)}/>}
      {showPin  && <ChangePinModal staffId={showPin} name={staffList.find(s => s.id === showPin)?.name} onClose={() => setShowPin(null)}/>}
    </div>
  );
}

function StaffEditModal({ member, onSave, onRemove, onClose }) {
  const isNew = !member;
  const [name, setName]   = useState(member?.name || '');
  const [role, setRole]   = useState(member?.role || 'Server');
  const [initials, setInitials] = useState(member?.initials || '');
  const [color, setColor] = useState(member?.color || '#3b82f6');
  const [permissions, setPerms] = useState(member?.permissions || ROLE_DEFAULTS['Server'] || []);

  const togglePerm = id => setPerms(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const applyRoleDefaults = r => { setRole(r); setPerms(ROLE_DEFAULTS[r] || []); };

  const COLORS = ['#e8a020','#3b82f6','#22c55e','#a855f7','#ef4444','#22d3ee'];
  const inp = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', display:'block', boxSizing:'border-box' };

  const groups = [...new Set(PERMISSIONS.map(p => p.group))];

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:22, width:'100%', maxWidth:480, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800 }}>{isNew ? 'Add staff member' : `Edit — ${member.name}`}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, marginBottom:14 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Full name</label>
              <input style={inp} value={name} onChange={e => { setName(e.target.value); if (!member) setInitials(e.target.value.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()); }} placeholder="First Last" autoFocus/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Initials</label>
              <input style={{ ...inp, width:60, textAlign:'center', textTransform:'uppercase' }} value={initials} onChange={e => setInitials(e.target.value.slice(0,2).toUpperCase())} maxLength={2}/>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Role</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ROLES.map(r => {
                const rc = ROLE_COLORS[r];
                return <button key={r} onClick={() => applyRoleDefaults(r)} style={{ padding:'6px 14px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, background: role === r ? `${rc}22` : 'var(--bg3)', border:`1.5px solid ${role === r ? rc : 'var(--bdr)'}`, color: role === r ? rc : 'var(--t2)', transition:'all .1s' }}>{r}</button>;
              })}
            </div>
          </div>

          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Avatar colour</label>
            <div style={{ display:'flex', gap:8 }}>
              {COLORS.map(c => <button key={c} onClick={() => setColor(c)} style={{ width:26, height:26, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline: color === c ? `3px solid var(--t1)` : '3px solid transparent', outlineOffset:2, transition:'outline .1s' }}/>)}
            </div>
          </div>

          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Permissions</label>
            {groups.map(group => (
              <div key={group} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>{group}</div>
                {PERMISSIONS.filter(p => p.group === group).map(perm => {
                  const on = permissions.includes(perm.id);
                  return (
                    <div key={perm.id} onClick={() => togglePerm(perm.id)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', marginBottom:4, borderRadius:9, cursor:'pointer', background: on ? 'var(--grn-d)' : 'var(--bg3)', border:`1px solid ${on ? 'var(--grn-b)' : 'var(--bdr)'}`, transition:'all .1s' }}>
                      <span style={{ fontSize:12, color: on ? 'var(--grn)' : 'var(--t2)', fontWeight: on ? 600 : 400 }}>{perm.label}</span>
                      <div style={{ width:18, height:18, borderRadius:4, border:`1.5px solid ${on ? 'var(--grn)' : 'var(--bdr2)'}`, background: on ? 'var(--grn)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {on && <span style={{ color:'#fff', fontSize:11, fontWeight:800, lineHeight:1 }}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8, flexShrink:0 }}>
          {!isNew && onRemove && <button onClick={onRemove} style={{ padding:'8px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>Remove</button>}
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:2, height:42 }} disabled={!name.trim()} onClick={() => onSave({ ...member, name, role, initials, color, permissions, id: member?.id })}>
            {isNew ? 'Add staff member' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePinModal({ staffId, name, onClose }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState(1);
  const press = d => {
    if (d === '⌫') { step === 1 ? setPin(p=>p.slice(0,-1)) : setConfirm(c=>c.slice(0,-1)); return; }
    if (step === 1 && pin.length < 4) setPin(p => p + d);
    if (step === 2 && confirm.length < 4) setConfirm(c => c + d);
  };

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:320, boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>Change PIN — {name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ fontSize:12, color:'var(--t3)', marginBottom:14, textAlign:'center' }}>
            {step === 1 ? 'Enter new 4-digit PIN' : 'Confirm new PIN'}
          </div>
          <div style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:18 }}>
            {[0,1,2,3].map(i => {
              const val = step === 1 ? pin : confirm;
              return <div key={i} style={{ width:14, height:14, borderRadius:'50%', background: val.length > i ? 'var(--acc)' : 'var(--bg4)', border:`2px solid ${val.length > i ? 'var(--acc)' : 'var(--bdr2)'}`, transition:'all .1s' }}/>;
            })}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:10 }}>
            {[7,8,9,4,5,6,1,2,3,'',0,'⌫'].map((d,i) => (
              <button key={i} onClick={() => d !== '' && press(String(d))} style={{
                height:42, borderRadius:9, cursor: d === '' ? 'default' : 'pointer', fontFamily:'inherit',
                background: d === '⌫' ? 'var(--red-d)' : d === '' ? 'transparent' : 'var(--bg3)',
                border: d === '' ? 'none' : `1px solid ${d === '⌫' ? 'var(--red-b)' : 'var(--bdr)'}`,
                color: d === '⌫' ? 'var(--red)' : 'var(--t1)', fontSize:16, fontWeight:700, opacity: d === '' ? 0 : 1,
              }}>{d}</button>
            ))}
          </div>
          {step === 1 ? (
            <button className="btn btn-acc" style={{ width:'100%', height:40 }} disabled={pin.length !== 4} onClick={() => setStep(2)}>Continue →</button>
          ) : (
            <div style={{ display:'flex', gap:6 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => { setStep(1); setConfirm(''); }}>← Back</button>
              <button className="btn btn-acc" style={{ flex:2, height:40 }} disabled={confirm.length !== 4 || confirm !== pin} onClick={onClose}>
                {confirm.length === 4 && confirm !== pin ? 'PINs don\'t match' : 'Save PIN'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
