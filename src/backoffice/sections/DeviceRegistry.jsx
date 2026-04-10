import { useState } from 'react';
import { useStore } from '../../store';

const HW_MODELS = [
  { id:'T2s',    label:'Sunmi T2s',    type:'counter',  icon:'🖥', desc:'15.6" counter terminal' },
  { id:'T3Pro',  label:'Sunmi T3 Pro', type:'counter',  icon:'🖥', desc:'21.5" large counter terminal' },
  { id:'V2s',    label:'Sunmi V2s',    type:'handheld', icon:'📱', desc:'Android handheld' },
  { id:'FT2',    label:'Sunmi FT2',    type:'kiosk',    icon:'⬜', desc:'Self-service kiosk' },
  { id:'NT311',  label:'Sunmi NT311',  type:'printer',  icon:'🖨', desc:'Cloud receipt printer' },
];

const STATUS_STYLE = {
  online:  { color:'var(--grn)', bg:'var(--grn-d)', border:'var(--grn-b)', dot:'var(--grn)' },
  offline: { color:'var(--t4)',  bg:'var(--bg3)',    border:'var(--bdr)',   dot:'var(--t4)' },
  pairing: { color:'var(--acc)', bg:'var(--acc-d)',  border:'var(--acc-b)', dot:'var(--acc)' },
};

const DEFAULT_PROFILES = [
  { id:'prof-1', name:'Main counter', color:'#3b82f6' },
  { id:'prof-2', name:'Bar terminal', color:'#e8a020' },
  { id:'prof-3', name:'Server handheld', color:'#22c55e' },
];

export default function DeviceRegistry() {
  const { devices, addDevice, updateDevice, removeDevice, showToast } = useStore();
  const [showPair, setShowPair] = useState(false);
  const [editDev, setEditDev] = useState(null);
  const [pairingCode] = useState(() => Math.random().toString(36).slice(2,8).toUpperCase());

  const profiles = DEFAULT_PROFILES;

  return (
    <div style={{ flex:1, overflowY:'auto', padding:28 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ fontSize:13, color:'var(--t3)', maxWidth:500 }}>
          Register and manage all Sunmi POS terminals for this location. Each device is assigned a device profile that controls its behaviour.
        </div>
        <button onClick={() => setShowPair(true)} style={{
          padding:'8px 18px', borderRadius:10, cursor:'pointer', fontFamily:'inherit',
          background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, flexShrink:0,
        }}>+ Pair device</button>
      </div>

      {/* Device list */}
      {devices.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--t3)' }}>
          <div style={{ fontSize:40, marginBottom:12, opacity:.3 }}>📱</div>
          <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>No devices registered</div>
          <div style={{ fontSize:13 }}>Pair your first Sunmi terminal to get started</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
          {devices.map(dev => {
            const hw = HW_MODELS.find(h => h.id === dev.hardwareModel) || HW_MODELS[0];
            const prof = profiles.find(p => p.id === dev.profileId);
            const st = STATUS_STYLE[dev.status] || STATUS_STYLE.offline;

            return (
              <div key={dev.id} style={{
                background:'var(--bg1)', border:'1px solid var(--bdr)',
                borderRadius:14, padding:'16px 18px',
              }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontSize:28 }}>{hw.icon}</div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)' }}>{dev.label}</div>
                      <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{hw.label} · {hw.desc}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:st.bg, border:`1px solid ${st.border}` }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:st.dot, animation: dev.status === 'online' ? 'pulse 2s ease-in-out infinite' : 'none' }}/>
                    <span style={{ fontSize:10, fontWeight:700, color:st.color }}>{dev.status}</span>
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:'var(--t4)' }}>IP address</span>
                    <span style={{ color:'var(--t2)', fontFamily:'var(--font-mono)' }}>{dev.ipAddress || '—'}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:'var(--t4)' }}>Profile</span>
                    {prof ? (
                      <span style={{ fontWeight:600, color:prof.color }}>{prof.name}</span>
                    ) : (
                      <span style={{ color:'var(--red)' }}>No profile assigned</span>
                    )}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                    <span style={{ color:'var(--t4)' }}>Last seen</span>
                    <span style={{ color:'var(--t2)' }}>{dev.status === 'online' ? 'Now' : 'Offline'}</span>
                  </div>
                </div>

                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => setEditDev(dev)} style={{
                    flex:1, height:32, borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                    background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600,
                  }}>Configure</button>
                  <button onClick={() => { updateDevice(dev.id, { status: dev.status === 'online' ? 'offline' : 'online' }); showToast(`${dev.label} ${dev.status === 'online' ? 'taken offline' : 'brought online'}`, 'info'); }} style={{
                    flex:1, height:32, borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                    background: dev.status === 'online' ? 'var(--red-d)' : 'var(--grn-d)',
                    border:`1px solid ${dev.status === 'online' ? 'var(--red-b)' : 'var(--grn-b)'}`,
                    color: dev.status === 'online' ? 'var(--red)' : 'var(--grn)', fontSize:11, fontWeight:600,
                  }}>{dev.status === 'online' ? 'Take offline' : 'Bring online'}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPair && <PairModal profiles={profiles} pairingCode={pairingCode} onClose={() => setShowPair(false)} onPair={dev => { addDevice(dev); showToast(`${dev.label} paired successfully`, 'success'); setShowPair(false); }}/>}
      {editDev  && <EditDeviceModal device={editDev} profiles={profiles} onSave={upd => { updateDevice(editDev.id, upd); showToast(`${editDev.label} updated`, 'success'); setEditDev(null); }} onRemove={() => { removeDevice(editDev.id); showToast(`${editDev.label} removed`, 'warning'); setEditDev(null); }} onClose={() => setEditDev(null)}/>}
    </div>
  );
}

function PairModal({ profiles, pairingCode, onClose, onPair }) {
  const [step, setStep] = useState('code'); // code | details
  const [label, setLabel] = useState('');
  const [hw, setHw] = useState('T2s');
  const [profileId, setProfileId] = useState(profiles[0]?.id || '');
  const [ip, setIp] = useState('');

  const inp = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', display:'block', boxSizing:'border-box' };

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:22, width:'100%', maxWidth:440, boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800 }}>{step === 'code' ? 'Pair new device' : 'Configure device'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>

        <div style={{ padding:'20px' }}>
          {step === 'code' && (
            <>
              <div style={{ fontSize:13, color:'var(--t3)', marginBottom:20, lineHeight:1.5 }}>
                On your Sunmi terminal, open Restaurant OS and go to <strong>Pair device</strong>. Enter the code below when prompted.
              </div>
              <div style={{ textAlign:'center', padding:'24px', background:'var(--bg3)', borderRadius:14, border:'2px dashed var(--bdr2)', marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Pairing code</div>
                <div style={{ fontSize:42, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)', letterSpacing:'.1em' }}>{pairingCode}</div>
                <div style={{ fontSize:11, color:'var(--t4)', marginTop:8 }}>Expires in 10 minutes</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
                <button className="btn btn-acc" style={{ flex:2, height:42 }} onClick={() => setStep('details')}>
                  Device connected → Configure it
                </button>
              </div>
            </>
          )}

          {step === 'details' && (
            <>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Device name</label>
                <input style={inp} placeholder="e.g. Counter 1, Bar terminal, Handheld Sarah" value={label} onChange={e => setLabel(e.target.value)} autoFocus/>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Hardware model</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {HW_MODELS.filter(h => h.type !== 'printer').map(h => (
                    <button key={h.id} onClick={() => setHw(h.id)} style={{
                      padding:'8px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                      background: hw === h.id ? 'var(--acc-d)' : 'var(--bg3)',
                      border:`1.5px solid ${hw === h.id ? 'var(--acc)' : 'var(--bdr)'}`,
                    }}>
                      <div style={{ fontSize:12, fontWeight:700, color: hw === h.id ? 'var(--acc)' : 'var(--t1)' }}>{h.icon} {h.label}</div>
                      <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{h.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Device profile</label>
                <select value={profileId} onChange={e => setProfileId(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>IP address (optional)</label>
                <input style={inp} placeholder="192.168.1.10" value={ip} onChange={e => setIp(e.target.value)}/>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setStep('code')}>← Back</button>
                <button className="btn btn-acc" style={{ flex:2, height:42 }} disabled={!label.trim()} onClick={() => onPair({ label, hardwareModel:hw, profileId, ipAddress:ip, status:'online' })}>
                  Complete pairing
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditDeviceModal({ device, profiles, onSave, onRemove, onClose }) {
  const [label, setLabel] = useState(device.label);
  const [profileId, setProfileId] = useState(device.profileId || '');
  const [ip, setIp] = useState(device.ipAddress || '');
  const inp = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', display:'block', boxSizing:'border-box' };

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:400, boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800 }}>Configure device</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ marginBottom:14 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Name</label><input style={inp} value={label} onChange={e => setLabel(e.target.value)}/></div>
          <div style={{ marginBottom:14 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Profile</label>
            <select value={profileId} onChange={e => setProfileId(e.target.value)} style={{ ...inp, cursor:'pointer' }}>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:20 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>IP address</label><input style={inp} value={ip} onChange={e => setIp(e.target.value)}/></div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onRemove} style={{ padding:'8px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>Remove</button>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-acc" style={{ flex:1, height:38 }} onClick={() => onSave({ label, profileId, ipAddress:ip })}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
