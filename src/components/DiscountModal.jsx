import { useState } from 'react';
import { STAFF } from '../data/seed';

const PRESET_DISCOUNTS = [
  { id:'staff50',   label:'Staff meal',      type:'percent', value:50,  requiresManager:false },
  { id:'staff_drk', label:'Staff drinks',    type:'percent', value:50,  requiresManager:false },
  { id:'loyalty',   label:'Loyalty 10%',     type:'percent', value:10,  requiresManager:false },
  { id:'nhs',       label:'NHS / Blue Light',type:'percent', value:10,  requiresManager:false },
  { id:'happy',     label:'Happy hour 20%',  type:'percent', value:20,  requiresManager:false },
  { id:'comp',      label:'Comp (100%)',      type:'percent', value:100, requiresManager:true  },
];

const managerPins = STAFF.filter(s => s.role === 'Manager').map(s => ({ pin: s.pin, name: s.name, id: s.id }));

export default function DiscountModal({ scope, itemName, subtotal, onConfirm, onCancel }) {
  // scope: 'item' | 'check'
  const [selected, setSelected]   = useState(null);   // preset id or 'custom'
  const [customType, setCustomType] = useState('percent');
  const [customVal, setCustomVal]   = useState('');
  const [step, setStep]             = useState('pick');  // pick | pin
  const [pin, setPin]               = useState('');
  const [pinError, setPinError]     = useState('');
  const [manager, setManager]       = useState(null);

  const preset   = PRESET_DISCOUNTS.find(p => p.id === selected);
  const needsPin = preset?.requiresManager && !manager;

  const discountAmount = () => {
    if (selected === 'custom') {
      const v = parseFloat(customVal) || 0;
      return customType === 'percent' ? subtotal * v / 100 : v;
    }
    if (preset) return subtotal * preset.value / 100;
    return 0;
  };

  const handlePick = () => {
    if (!selected) return;
    if (needsPin) { setStep('pin'); return; }
    finalise();
  };

  const finalise = (mgr) => {
    const isPreset = selected !== 'custom';
    const disc = {
      id: `disc-${Date.now()}`,
      label: isPreset ? preset.label : `Custom ${customType==='percent'?customVal+'%':'£'+customVal}`,
      type: isPreset ? preset.type : customType,
      value: isPreset ? preset.value : parseFloat(customVal)||0,
      scope,
      amount: discountAmount(),
      manager: mgr || manager,
    };
    onConfirm(disc);
  };

  const handleDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      const match = managerPins.find(m => m.pin === next);
      if (match) { setManager(match); setPinError(''); setTimeout(() => finalise(match), 200); }
      else { setPinError('Incorrect manager PIN'); setTimeout(() => setPin(''), 600); }
    }
  };

  return (
    <div className="modal-back">
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:420, boxShadow:'var(--sh3)', overflow:'hidden' }}>

        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--t1)' }}>
              {scope === 'item' ? `Discount — ${itemName}` : 'Check discount'}
            </div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>
              {scope === 'check' ? `£${subtotal.toFixed(2)} before discount` : 'Applied to this item only'}
            </div>
          </div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:22 }}>×</button>
        </div>

        <div style={{ padding:'18px 22px' }}>

          {step === 'pick' && (
            <>
              {/* Presets */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Quick discounts</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:16 }}>
                {PRESET_DISCOUNTS.map(p => (
                  <button key={p.id} onClick={() => setSelected(p.id)} style={{
                    padding:'10px 8px', borderRadius:10, cursor:'pointer', textAlign:'center', fontFamily:'inherit',
                    border:`1.5px solid ${selected===p.id?'var(--acc)':'var(--bdr)'}`,
                    background:selected===p.id?'var(--acc-d)':'var(--bg3)',
                    position:'relative',
                  }}>
                    {p.requiresManager && <div style={{ position:'absolute', top:4, right:4, width:6, height:6, borderRadius:'50%', background:'var(--acc)' }}/>}
                    <div style={{ fontSize:11, fontWeight:700, color:selected===p.id?'var(--acc)':'var(--t1)', lineHeight:1.3 }}>{p.label}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:selected===p.id?'var(--acc)':'var(--t2)', marginTop:3, fontFamily:'DM Mono, monospace' }}>
                      {p.value}%
                    </div>
                    {selected===p.id && scope==='check' && (
                      <div style={{ fontSize:10, color:'var(--acc)', marginTop:2 }}>−£{(subtotal*p.value/100).toFixed(2)}</div>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom */}
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>Custom amount</div>
              <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                <button onClick={()=>{setSelected('custom');setCustomType('percent');}} style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:`1.5px solid ${selected==='custom'&&customType==='percent'?'var(--acc)':'var(--bdr)'}`, background:selected==='custom'&&customType==='percent'?'var(--acc-d)':'var(--bg3)', color:selected==='custom'&&customType==='percent'?'var(--acc)':'var(--t2)', fontSize:12, fontWeight:700 }}>% off</button>
                <button onClick={()=>{setSelected('custom');setCustomType('amount');}} style={{ flex:1, padding:'8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', border:`1.5px solid ${selected==='custom'&&customType==='amount'?'var(--acc)':'var(--bdr)'}`, background:selected==='custom'&&customType==='amount'?'var(--acc-d)':'var(--bg3)', color:selected==='custom'&&customType==='amount'?'var(--acc)':'var(--t2)', fontSize:12, fontWeight:700 }}>£ off</button>
              </div>
              {selected === 'custom' && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                  <span style={{ fontSize:18, color:'var(--t3)' }}>{customType==='percent'?'%':'£'}</span>
                  <input className="input" type="number" min="0" max={customType==='percent'?100:undefined} placeholder={customType==='percent'?'10':'5.00'} value={customVal} onChange={e=>setCustomVal(e.target.value)} autoFocus style={{ fontSize:18 }}/>
                  {customVal && scope==='check' && (
                    <span style={{ fontSize:13, color:'var(--acc)', whiteSpace:'nowrap', fontFamily:'DM Mono,monospace' }}>
                      −£{discountAmount().toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              {/* Manager note */}
              {selected && PRESET_DISCOUNTS.find(p=>p.id===selected)?.requiresManager && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, background:'rgba(232,160,32,.1)', border:'1px solid var(--acc-b)', marginBottom:14 }}>
                  <span>🔑</span>
                  <span style={{ fontSize:12, color:'var(--acc)' }}>Requires manager PIN</span>
                </div>
              )}

              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={onCancel}>Cancel</button>
                <button
                  className="btn btn-acc" style={{ flex:2, height:46 }}
                  disabled={!selected || (selected==='custom'&&(!customVal||parseFloat(customVal)<=0))}
                  onClick={handlePick}
                >
                  Apply discount {selected && discountAmount()>0 ? `· −£${discountAmount().toFixed(2)}` : ''}
                </button>
              </div>
            </>
          )}

          {step === 'pin' && (
            <>
              <div style={{ fontSize:13, color:'var(--t2)', marginBottom:16, lineHeight:1.5 }}>
                <strong style={{color:'var(--t1)'}}>{preset?.label}</strong> requires manager authorisation.
              </div>

              <div style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:pinError?8:20 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width:14, height:14, borderRadius:'50%', background:i<pin.length?'var(--acc)':'var(--bg4)', border:`2px solid ${i<pin.length?'var(--acc)':'var(--bdr2)'}`, transition:'all .15s' }}/>
                ))}
              </div>
              {pinError && <div style={{ textAlign:'center', fontSize:12, color:'var(--red)', marginBottom:16, fontWeight:600 }}>{pinError}</div>}

              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, maxWidth:240, margin:'0 auto 16px' }}>
                {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d,i)=>(
                  <button key={i} onClick={()=>d==='⌫'?setPin(p=>p.slice(0,-1)):d!==''?handleDigit(String(d)):null} style={{ height:52, borderRadius:12, cursor:d===''?'default':'pointer', background:d===''?'transparent':'var(--bg3)', border:d===''?'none':'1px solid var(--bdr2)', color:d==='⌫'?'var(--t3)':'var(--t1)', fontSize:d==='⌫'?18:20, fontWeight:700, fontFamily:'inherit', opacity:d===''?0:1 }}>{d}</button>
                ))}
              </div>

              <button className="btn btn-ghost btn-full" onClick={()=>setStep('pick')}>← Back</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
