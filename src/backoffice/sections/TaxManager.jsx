import { useState, useEffect } from 'react';
import { supabase, isMock, getLocationId } from '../../lib/supabase';
import { UK_DEFAULT_RATES, US_DEFAULT_RATES } from '../../lib/tax';

const ORDER_TYPES = ['dine-in', 'takeaway', 'delivery', 'bar', 'counter'];

const EMPTY = { name:'', code:'', rate:'', type:'inclusive', applies_to:['all'], is_default:false, active:true };

const S = {
  page:   { padding:'32px 40px', maxWidth:820 },
  h1:     { fontSize:22, fontWeight:800, marginBottom:4, color:'var(--t1)' },
  sub:    { fontSize:13, color:'var(--t3)', marginBottom:28 },
  card:   { background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:14, padding:22, marginBottom:12 },
  label:  { fontSize:12, fontWeight:600, color:'var(--t3)', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.04em' },
  input:  { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg)', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  select: { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg)', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none' },
  btn:    { padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' },
  row:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 },
  badge:  { padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700 },
};

function RateBadge({ rate }) {
  const pct = (parseFloat(rate.rate || 0) * 100).toFixed(1).replace('.0','');
  const isInc = rate.type === 'inclusive';
  return (
    <span style={{ ...S.badge, background: isInc ? 'var(--acc-d)' : 'var(--grn-d)', color: isInc ? 'var(--acc)' : 'var(--grn)', border:`1px solid ${isInc ? 'var(--acc-b)' : 'var(--grn-b)'}` }}>
      {pct}% {isInc ? 'incl.' : 'excl.'}
    </span>
  );
}

function RateForm({ rate, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...rate });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);

  const toggleOrderType = (ot) => {
    if (form.applies_to.includes('all')) {
      f('applies_to', [ot]);
    } else if (form.applies_to.includes(ot)) {
      const next = form.applies_to.filter(x => x !== ot);
      f('applies_to', next.length ? next : ['all']);
    } else {
      f('applies_to', [...form.applies_to, ot]);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.rate === '') return;
    setSaving(true);
    await onSave({ ...form, rate: parseFloat(form.rate) });
    setSaving(false);
  };

  return (
    <div style={{ ...S.card, border:'1.5px solid var(--acc-b)', background:'var(--acc-d)' }}>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', marginBottom:16 }}>
        {rate?.id ? 'Edit tax rate' : 'Add tax rate'}
      </div>

      <div style={S.row}>
        <div>
          <label style={S.label}>Name *</label>
          <input style={S.input} value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Standard Rate"/>
        </div>
        <div>
          <label style={S.label}>Code</label>
          <input style={S.input} value={form.code} onChange={e => f('code', e.target.value)} placeholder="e.g. VAT20"/>
        </div>
      </div>

      <div style={S.row}>
        <div>
          <label style={S.label}>Rate %</label>
          <input style={S.input} type="number" min="0" max="100" step="0.001"
            value={form.rate === '' ? '' : parseFloat(form.rate) * 100}
            onChange={e => f('rate', e.target.value === '' ? '' : parseFloat(e.target.value) / 100)}
            placeholder="e.g. 20"/>
        </div>
        <div>
          <label style={S.label}>Tax model</label>
          <select style={S.select} value={form.type} onChange={e => f('type', e.target.value)}>
            <option value="inclusive">Inclusive — tax is in the price (UK VAT)</option>
            <option value="exclusive">Exclusive — tax added on top (US Sales Tax)</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.label}>Applies to order types</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          <button onClick={() => f('applies_to', ['all'])} style={{
            ...S.btn, padding:'5px 12px',
            background: form.applies_to.includes('all') ? 'var(--acc)' : 'var(--bg3)',
            color: form.applies_to.includes('all') ? '#fff' : 'var(--t2)',
            border: `1.5px solid ${form.applies_to.includes('all') ? 'var(--acc)' : 'var(--bdr)'}`,
          }}>All types</button>
          {ORDER_TYPES.map(ot => (
            <button key={ot} onClick={() => toggleOrderType(ot)} style={{
              ...S.btn, padding:'5px 12px',
              background: !form.applies_to.includes('all') && form.applies_to.includes(ot) ? 'var(--acc-d)' : 'var(--bg3)',
              color: !form.applies_to.includes('all') && form.applies_to.includes(ot) ? 'var(--acc)' : 'var(--t2)',
              border: `1.5px solid ${!form.applies_to.includes('all') && form.applies_to.includes(ot) ? 'var(--acc-b)' : 'var(--bdr)'}`,
            }}>{ot}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--t2)' }}>
          <input type="checkbox" checked={form.is_default} onChange={e => f('is_default', e.target.checked)}/>
          Default rate — applied to new menu items automatically
        </label>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onCancel} style={{ ...S.btn, background:'var(--bg3)', color:'var(--t2)', border:'1px solid var(--bdr)' }}>Cancel</button>
        <button onClick={handleSave} disabled={saving || !form.name.trim() || form.rate === ''}
          style={{ ...S.btn, background:'var(--acc)', color:'#fff', opacity: saving ? .6 : 1 }}>
          {saving ? 'Saving…' : 'Save rate'}
        </button>
      </div>
    </div>
  );
}

export default function TaxManager() {
  const [rates, setRates]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState(null);   // null | 'new' | uuid
  const [deleting, setDeleting] = useState(null);
  const [error, setError]     = useState('');
  const [msg, setMsg]         = useState('');

  const load = async () => {
    setLoading(true);
    if (isMock) { setLoading(false); return; }
    const locId = await getLocationId();
    const { data } = await supabase.from('tax_rates').select('*').eq('location_id', locId).order('rate', { ascending:false });
    setRates(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleSave = async (form) => {
    setError('');
    const locId = await getLocationId();
    if (!locId) { setError('No location ID'); return; }

    // If setting as default, unset all others first
    if (form.is_default) {
      await supabase.from('tax_rates').update({ is_default:false }).eq('location_id', locId);
    }

    if (form.id) {
      const { error: err } = await supabase.from('tax_rates').update({ ...form, location_id:locId }).eq('id', form.id);
      if (err) { setError(err.message); return; }
    } else {
      const { error: err } = await supabase.from('tax_rates').insert({ ...form, location_id:locId });
      if (err) { setError(err.message); return; }
    }
    setEditId(null);
    flash('✓ Saved');
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this tax rate? Items assigned to it will lose their tax setting.')) return;
    setDeleting(id);
    await supabase.from('tax_rates').delete().eq('id', id);
    setDeleting(null);
    await load();
  };

  const seedRates = async (defaults) => {
    const locId = await getLocationId();
    if (!locId) return;
    for (const r of defaults) {
      await supabase.from('tax_rates').insert({ ...r, location_id: locId });
    }
    flash(`✓ ${defaults.length} rates added`);
    await load();
  };

  const editingRate = editId === 'new' ? null : rates.find(r => r.id === editId);

  return (
    <div style={S.page}>
      <div style={S.h1}>Tax & VAT</div>
      <div style={S.sub}>Manage tax rates for this location. Assign rates to menu items individually, with per-order-type overrides.</div>

      {/* Info panels */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
        <div style={{ padding:'14px 16px', borderRadius:12, background:'var(--bg1)', border:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:4 }}>🇬🇧 UK VAT (Inclusive)</div>
          <div style={{ fontSize:12, color:'var(--t4)', lineHeight:1.7 }}>
            Price shown on POS includes tax. VAT is extracted at checkout. Standard 20%, Reduced 5%, Zero 0%.
            Items can be zero-rated for takeaway but standard-rated for dine-in.
          </div>
          {!rates.length && !loading && (
            <button onClick={() => seedRates(UK_DEFAULT_RATES)}
              style={{ ...S.btn, background:'var(--acc)', color:'#fff', marginTop:10, padding:'7px 14px', fontSize:12 }}>
              Seed UK rates
            </button>
          )}
        </div>
        <div style={{ padding:'14px 16px', borderRadius:12, background:'var(--bg1)', border:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)', marginBottom:4 }}>🇺🇸 US Sales Tax (Exclusive)</div>
          <div style={{ fontSize:12, color:'var(--t4)', lineHeight:1.7 }}>
            Tax is added on top of the item price at checkout. Rate varies by state/city.
            The customer-facing total is subtotal + tax.
          </div>
          {!rates.length && !loading && (
            <button onClick={() => seedRates(US_DEFAULT_RATES)}
              style={{ ...S.btn, background:'var(--acc)', color:'#fff', marginTop:10, padding:'7px 14px', fontSize:12 }}>
              Seed US rates
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {msg   && <div style={{ padding:'10px 14px', borderRadius:8, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)', fontSize:13, marginBottom:12 }}>{msg}</div>}
      {error && <div style={{ padding:'10px 14px', borderRadius:8, background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:13, marginBottom:12 }}>{error}</div>}

      {/* Rates list */}
      {loading ? (
        <div style={{ color:'var(--t4)', fontSize:13, padding:'20px 0' }}>Loading…</div>
      ) : (
        <>
          {rates.map(rate => {
            if (editId === rate.id) return <RateForm key={rate.id} rate={rate} onSave={handleSave} onCancel={() => setEditId(null)}/>;
            const pct = (parseFloat(rate.rate) * 100).toFixed(rate.rate % 0.01 === 0 ? 0 : 3).replace(/\.?0+$/, '');
            return (
              <div key={rate.id} style={{ ...S.card, display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{rate.name}</span>
                    <RateBadge rate={rate}/>
                    {rate.is_default && <span style={{ ...S.badge, background:'var(--grn-d)', color:'var(--grn)', border:'1px solid var(--grn-b)' }}>Default</span>}
                    {!rate.active && <span style={{ ...S.badge, background:'var(--bg3)', color:'var(--t4)', border:'1px solid var(--bdr)' }}>Inactive</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--t4)' }}>
                    {pct}% · {rate.type === 'inclusive' ? 'Tax included in price' : 'Tax added on top'} · 
                    {' '}{rate.code && <span style={{ fontFamily:'monospace' }}>{rate.code}</span>}
                    {' '}· Applies to: {(rate.applies_to || ['all']).join(', ')}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => setEditId(rate.id)} style={{ ...S.btn, background:'var(--bg3)', color:'var(--t2)', border:'1px solid var(--bdr)', padding:'7px 14px', fontSize:12 }}>Edit</button>
                  <button onClick={() => handleDelete(rate.id)} disabled={deleting === rate.id}
                    style={{ ...S.btn, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)', padding:'7px 14px', fontSize:12 }}>
                    {deleting === rate.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}

          {/* New rate form */}
          {editId === 'new' && <RateForm onSave={handleSave} onCancel={() => setEditId(null)}/>}

          {/* Add button */}
          {!editId && (
            <button onClick={() => setEditId('new')}
              style={{ ...S.btn, background:'var(--acc)', color:'#fff', padding:'10px 20px', marginTop:4 }}>
              + Add tax rate
            </button>
          )}

          {rates.length > 0 && (
            <div style={{ marginTop:20, padding:'12px 16px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', fontSize:12, color:'var(--t4)', lineHeight:1.8 }}>
              <strong style={{ color:'var(--t2)' }}>Next steps:</strong> Go to Menu Manager → select an item → assign a tax rate. 
              You can set different rates per order type (e.g. a burger is 20% dine-in but 0% takeaway).
            </div>
          )}
        </>
      )}
    </div>
  );
}
