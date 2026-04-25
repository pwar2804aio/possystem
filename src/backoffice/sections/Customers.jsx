// v4.6.63: Back-office Customers section.
//
// Tier-1 features:
//   - List of every customer at this org (across locations)
//   - Search by name, phone, email
//   - Filters: location, last visit window, marketing opt-in
//   - Sortable columns
//   - Click row → detail panel: profile + per-location stats grid + order history
//   - CSV export of current filter

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { supabase, isMock, getLocationId } from '../../lib/supabase';

const fmtMoney = (n) => '£' + (Number(n) || 0).toFixed(2);

const fmtRel = (iso) => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7)   return days + 'd ago';
  if (days < 30)  return Math.floor(days / 7) + 'w ago';
  if (days < 365) return Math.floor(days / 30) + 'mo ago';
  return Math.floor(days / 365) + 'y ago';
};

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const fmtTime = (iso) => iso ? new Date(iso).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLoc, setFilterLoc] = useState('all');
  const [filterRange, setFilterRange] = useState('all');     // all | 7d | 30d | 90d | dormant (90d+)
  const [filterMarketing, setFilterMarketing] = useState('all'); // all | optIn | optOut
  const [sortBy, setSortBy] = useState('lastVisit');         // lastVisit | spend | visits | name
  const [sortDir, setSortDir] = useState('desc');
  const [selectedId, setSelectedId] = useState(null);

  // Load all customers + their per-location stats (for the org)
  useEffect(() => {
    (async () => {
      if (isMock || !supabase) { setLoading(false); return; }
      try {
        setLoading(true);
        const locId = await getLocationId();
        if (!locId) return;
        // Fetch org_id once
        const { data: thisLoc } = await supabase.from('locations').select('org_id').eq('id', locId).single();
        const orgId = thisLoc?.org_id;
        if (!orgId) return;

        // All locations under the org (so we can show location names + populate filter dropdown)
        const { data: locs } = await supabase
          .from('locations').select('id, name')
          .eq('org_id', orgId).eq('status', 'active').order('name');
        setAllLocations(locs || []);
        const locMap = Object.fromEntries((locs || []).map(l => [l.id, l.name]));

        // All customers in the org
        const { data: customerRows } = await supabase
          .from('customers')
          .select('id, name, phone, phone_raw, email, marketing_opt_in, marketing_opt_in_at, notes, created_at, updated_at')
          .eq('org_id', orgId).is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(1000);

        // All customer_locations rows for those customers
        const ids = (customerRows || []).map(c => c.id);
        let clRows = [];
        if (ids.length) {
          const { data } = await supabase
            .from('customer_locations')
            .select('*')
            .in('customer_id', ids);
          clRows = data || [];
        }
        // Group customer_locations by customer_id
        const byCust = {};
        clRows.forEach(cl => {
          if (!byCust[cl.customer_id]) byCust[cl.customer_id] = [];
          byCust[cl.customer_id].push({ ...cl, locationName: locMap[cl.location_id] || '—' });
        });

        // Roll up
        const enriched = (customerRows || []).map(c => {
          const stats = byCust[c.id] || [];
          const totalSpend = stats.reduce((s, x) => s + (Number(x.lifetime_revenue) || 0), 0);
          const totalVisits = stats.reduce((s, x) => s + (x.visit_count || 0), 0);
          const lastVisit = stats.reduce((latest, x) => {
            if (!x.last_visit_at) return latest;
            return !latest || new Date(x.last_visit_at) > new Date(latest) ? x.last_visit_at : latest;
          }, null);
          return { ...c, stats, totalSpend, totalVisits, lastVisit };
        });
        setCustomers(enriched);
      } catch (err) {
        console.warn('[Customers] load failed:', err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const sd = search.replace(/\s/g, '');
    const now = Date.now();
    const dayMs = 86400000;

    let rows = customers;
    if (s) {
      rows = rows.filter(c =>
        (c.name || '').toLowerCase().includes(s) ||
        (c.phone || '').replace(/\s/g, '').includes(sd) ||
        (c.phone_raw || '').replace(/\s/g, '').includes(sd) ||
        (c.email || '').toLowerCase().includes(s)
      );
    }
    if (filterLoc !== 'all') {
      rows = rows.filter(c => c.stats.some(x => x.location_id === filterLoc));
    }
    if (filterRange !== 'all') {
      rows = rows.filter(c => {
        if (!c.lastVisit) return filterRange === 'dormant';
        const ageDays = (now - new Date(c.lastVisit).getTime()) / dayMs;
        if (filterRange === '7d')  return ageDays <= 7;
        if (filterRange === '30d') return ageDays <= 30;
        if (filterRange === '90d') return ageDays <= 90;
        if (filterRange === 'dormant') return ageDays > 90;
        return true;
      });
    }
    if (filterMarketing === 'optIn')  rows = rows.filter(c => c.marketing_opt_in);
    if (filterMarketing === 'optOut') rows = rows.filter(c => !c.marketing_opt_in);

    // Sort
    rows = [...rows].sort((a, b) => {
      let av, bv;
      if (sortBy === 'lastVisit') { av = a.lastVisit ? new Date(a.lastVisit).getTime() : 0; bv = b.lastVisit ? new Date(b.lastVisit).getTime() : 0; }
      else if (sortBy === 'spend') { av = a.totalSpend; bv = b.totalSpend; }
      else if (sortBy === 'visits') { av = a.totalVisits; bv = b.totalVisits; }
      else { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [customers, search, filterLoc, filterRange, filterMarketing, sortBy, sortDir]);

  const selected = useMemo(() => filtered.find(c => c.id === selectedId) || customers.find(c => c.id === selectedId) || null, [filtered, customers, selectedId]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const cols = [
      ['Name',         c => c.name],
      ['Phone',        c => c.phone_raw || c.phone || ''],
      ['Email',        c => c.email || ''],
      ['Total visits', c => c.totalVisits || 0],
      ['Lifetime spend', c => (c.totalSpend || 0).toFixed(2)],
      ['Last visit',   c => c.lastVisit ? new Date(c.lastVisit).toISOString() : ''],
      ['Locations',    c => c.stats.map(s => s.locationName).join('; ')],
      ['Marketing opt-in', c => c.marketing_opt_in ? 'yes' : 'no'],
      ['Notes',        c => (c.notes || '').replace(/[\r\n]+/g, ' ')],
    ];
    const esc = v => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = cols.map(c => esc(c[0])).join(',');
    const rows = filtered.map(c => cols.map(col => esc(col[1](c))).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left: list + filters */}
      <div style={{ width: selected ? 540 : '100%', borderRight: selected ? '1px solid var(--bdr)' : 'none', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--bdr)' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--t1)' }}>Customers</div>
              <div style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>{customers.length} total · {filtered.length} matching filter</div>
            </div>
            <button onClick={exportCSV} disabled={!filtered.length}
              style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--bdr2)', background: filtered.length ? 'var(--bg3)' : 'var(--bg2)', color: filtered.length ? 'var(--t1)' : 'var(--t4)', fontFamily:'inherit', fontWeight:700, fontSize:12, cursor: filtered.length ? 'pointer' : 'not-allowed' }}>
              Export CSV
            </button>
          </div>
          {/* Search */}
          <input type="text" placeholder="Search by name, phone, email…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:'100%', marginTop:14, padding:'10px 14px', fontSize:14, borderRadius:8, border:'1.5px solid var(--bdr)', background:'var(--bg2)', color:'var(--t1)', fontFamily:'inherit' }}/>
          {/* Filters */}
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:12 }}>
            <Filter label="Location" value={filterLoc} onChange={setFilterLoc} options={[['all','All locations'], ...allLocations.map(l => [l.id, l.name])]} />
            <Filter label="Last visit" value={filterRange} onChange={setFilterRange} options={[['all','All time'],['7d','Last 7 days'],['30d','Last 30 days'],['90d','Last 90 days'],['dormant','Dormant (90+)']]}/>
            <Filter label="Marketing" value={filterMarketing} onChange={setFilterMarketing} options={[['all','All'],['optIn','Opt-in only'],['optOut','Opt-out only']]}/>
          </div>
        </div>

        {/* List */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--t4)' }}>Loading customers…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--t4)' }}>
              <div style={{ fontSize:36, marginBottom:8, opacity:.35 }}>👥</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--t3)' }}>{customers.length === 0 ? 'No customers yet' : 'No matches'}</div>
              <div style={{ fontSize:12, marginTop:4 }}>{customers.length === 0 ? 'Take a takeaway order with a phone number to start the database.' : 'Try a different search or clear the filters.'}</div>
            </div>
          ) : (
            <div>
              {/* Header row */}
              <div style={{ display:'grid', gridTemplateColumns:'2.4fr 1.4fr 0.8fr 1fr 1fr 1fr', padding:'10px 24px', fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', background:'var(--bg2)', borderBottom:'1px solid var(--bdr)', position:'sticky', top:0, zIndex:1 }}>
                <SortHeader col="name" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort}>Customer</SortHeader>
                <span>Phone</span>
                <SortHeader col="visits" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right">Visits</SortHeader>
                <SortHeader col="spend" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right">Lifetime</SortHeader>
                <SortHeader col="lastVisit" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} align="right">Last visit</SortHeader>
                <span>Locations</span>
              </div>
              {filtered.map(c => {
                const isSel = selectedId === c.id;
                return (
                  <div key={c.id} onClick={() => setSelectedId(isSel ? null : c.id)}
                    style={{ display:'grid', gridTemplateColumns:'2.4fr 1.4fr 0.8fr 1fr 1fr 1fr', padding:'10px 24px', fontSize:13, alignItems:'center', borderBottom:'1px solid var(--bdr)', cursor:'pointer', background: isSel ? 'var(--acc-d)' : 'transparent' }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:700, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                      {c.email && <div style={{ fontSize:11, color:'var(--t4)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis' }}>{c.email}</div>}
                    </div>
                    <div style={{ color:'var(--t2)', fontFamily:'var(--font-mono)', fontSize:12 }}>{c.phone_raw || c.phone || '—'}</div>
                    <div style={{ textAlign:'right', color:'var(--t1)', fontWeight:700, fontFamily:'var(--font-mono)' }}>{c.totalVisits}</div>
                    <div style={{ textAlign:'right', color:'var(--acc)', fontWeight:700, fontFamily:'var(--font-mono)' }}>{fmtMoney(c.totalSpend)}</div>
                    <div style={{ textAlign:'right', color:'var(--t3)', fontSize:12 }}>{fmtRel(c.lastVisit)}</div>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {c.stats.slice(0, 3).map(s => (
                        <span key={s.location_id} style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:5, background:'var(--bg3)', color:'var(--t3)' }}>{s.locationName}</span>
                      ))}
                      {c.stats.length > 3 && <span style={{ fontSize:10, color:'var(--t4)' }}>+{c.stats.length - 3}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      {selected && <DetailPanel customer={selected} onClose={() => setSelectedId(null)} onChanged={(updated) => {
        setCustomers(cs => cs.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      }} onDeleted={() => {
        setCustomers(cs => cs.filter(c => c.id !== selected.id));
        setSelectedId(null);
      }}/>}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function Filter({ label, value, onChange, options }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding:'5px 8px', fontSize:12, borderRadius:6, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t2)', fontFamily:'inherit', cursor:'pointer' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function SortHeader({ col, sortBy, sortDir, onClick, align = 'left', children }) {
  const active = sortBy === col;
  return (
    <span onClick={() => onClick(col)} style={{ cursor:'pointer', textAlign: align, color: active ? 'var(--acc)' : 'inherit', userSelect:'none' }}>
      {children}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </span>
  );
}

function DetailPanel({ customer, onClose, onChanged, onDeleted }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: customer.name || '',
    phone_raw: customer.phone_raw || customer.phone || '',
    email: customer.email || '',
    notes: customer.notes || '',
    marketing_opt_in: !!customer.marketing_opt_in,
  });

  useEffect(() => {
    (async () => {
      if (isMock || !supabase) { setLoading(false); return; }
      try {
        setLoading(true);
        const { data } = await supabase
          .from('customer_orders')
          .select('id, ordered_at, total, channel, item_summary, location_id, closed_check_id')
          .eq('customer_id', customer.id)
          .order('ordered_at', { ascending: false })
          .limit(50);
        setOrders(data || []);
      } catch (err) {
        console.warn('[DetailPanel orders] failed:', err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
    setForm({
      name: customer.name || '',
      phone_raw: customer.phone_raw || customer.phone || '',
      email: customer.email || '',
      notes: customer.notes || '',
      marketing_opt_in: !!customer.marketing_opt_in,
    });
    setEditing(false);
  }, [customer.id]);

  const handleSave = async () => {
    if (isMock || !supabase) return;
    try {
      const patch = {
        name: form.name.trim() || customer.name,
        phone_raw: form.phone_raw.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        marketing_opt_in: !!form.marketing_opt_in,
        updated_at: new Date().toISOString(),
      };
      if (form.marketing_opt_in && !customer.marketing_opt_in) {
        patch.marketing_opt_in_at = new Date().toISOString();
      }
      const { data, error } = await supabase.from('customers').update(patch).eq('id', customer.id).select().single();
      if (error) throw error;
      onChanged?.(data);
      setEditing(false);
    } catch (err) {
      alert('Save failed: ' + (err?.message || err));
    }
  };

  const handleDelete = async () => {
    if (!confirm('Soft-delete this customer? Their order history stays for audit, but they\'ll disappear from search and reports. (GDPR right-to-be-forgotten.)')) return;
    try {
      await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', customer.id);
      onDeleted?.();
    } catch (err) {
      alert('Delete failed: ' + (err?.message || err));
    }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis' }}>{customer.name}</div>
          <div style={{ fontSize:12, color:'var(--t3)', marginTop:4 }}>
            <span style={{ fontFamily:'var(--font-mono)' }}>{customer.phone_raw || customer.phone || ''}</span>
            {customer.email && <span> · {customer.email}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ width:28, height:28, padding:0, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t3)', borderRadius:6, cursor:'pointer', fontSize:16, fontFamily:'inherit', flexShrink:0 }}>×</button>
      </div>

      {/* Stats overview */}
      <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--bdr)', display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10 }}>
        <Stat label="Lifetime spend" value={fmtMoney(customer.totalSpend)} color="var(--acc)"/>
        <Stat label="Total visits" value={customer.totalVisits || 0}/>
        <Stat label="Last visit" value={fmtRel(customer.lastVisit)}/>
      </div>

      {/* Per-location breakdown */}
      {customer.stats?.length > 0 && (
        <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Per location</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {customer.stats.map(s => (
              <div key={s.location_id} style={{ display:'grid', gridTemplateColumns:'1.4fr 0.8fr 1fr 1fr', gap:10, padding:'8px 10px', fontSize:12, background:'var(--bg2)', borderRadius:6, alignItems:'center' }}>
                <div style={{ color:'var(--t1)', fontWeight:700 }}>{s.locationName}</div>
                <div style={{ textAlign:'right', color:'var(--t2)', fontFamily:'var(--font-mono)' }}>{s.visit_count} visits</div>
                <div style={{ textAlign:'right', color:'var(--acc)', fontFamily:'var(--font-mono)', fontWeight:700 }}>{fmtMoney(s.lifetime_revenue)}</div>
                <div style={{ textAlign:'right', color:'var(--t3)', fontSize:11 }}>{fmtRel(s.last_visit_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile (edit / view) */}
      <div style={{ padding:'14px 22px', borderBottom:'1px solid var(--bdr)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em' }}>Profile</div>
          {!editing ? (
            <button onClick={() => setEditing(true)} style={btnSmall}>Edit</button>
          ) : (
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => setEditing(false)} style={btnSmall}>Cancel</button>
              <button onClick={handleSave} style={{ ...btnSmall, background:'var(--acc)', color:'#fff', borderColor:'var(--acc)' }}>Save</button>
            </div>
          )}
        </div>
        {editing ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <Field label="Name"><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle}/></Field>
            <Field label="Phone"><input type="text" value={form.phone_raw} onChange={e => setForm(f => ({ ...f, phone_raw: e.target.value }))} style={inputStyle}/></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle}/></Field>
            <Field label="Notes"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize:'vertical' }}/></Field>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--t2)', cursor:'pointer' }}>
              <input type="checkbox" checked={form.marketing_opt_in} onChange={e => setForm(f => ({ ...f, marketing_opt_in: e.target.checked }))}/>
              Marketing opt-in
            </label>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13 }}>
            {customer.notes && <Row label="Notes" value={customer.notes}/>}
            <Row label="Marketing" value={customer.marketing_opt_in ? '✓ Opted in' : '✗ Not opted in'}/>
            <Row label="Customer since" value={fmtDate(customer.created_at)}/>
          </div>
        )}
      </div>

      {/* Order history */}
      <div style={{ flex:1, overflowY:'auto' }}>
        <div style={{ padding:'14px 22px 8px' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em' }}>Order history</div>
        </div>
        {loading ? (
          <div style={{ padding:'30px 22px', textAlign:'center', color:'var(--t4)', fontSize:12 }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ padding:'30px 22px', textAlign:'center', color:'var(--t4)', fontSize:12 }}>No orders recorded yet.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {orders.map(o => (
              <div key={o.id} style={{ padding:'10px 22px', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:4 }}>
                  <div style={{ fontSize:12, color:'var(--t3)' }}>
                    {fmtTime(o.ordered_at)} <span style={{ color:'var(--t4)' }}>· {o.channel || 'order'}</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>{fmtMoney(o.total)}</div>
                </div>
                {Array.isArray(o.item_summary) && o.item_summary.length > 0 && (
                  <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.5 }}>
                    {o.item_summary.map((i, k) => (
                      <span key={k}>
                        {k > 0 ? ', ' : ''}{i.qty || 1} × {i.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — soft-delete */}
      <div style={{ padding:'12px 22px', borderTop:'1px solid var(--bdr)', display:'flex', justifyContent:'flex-end' }}>
        <button onClick={handleDelete} style={{ ...btnSmall, color:'var(--red, #cc5959)', borderColor:'var(--red-b, #cc5959)' }}>Delete customer</button>
      </div>
    </div>
  );
}

// ── Tiny helpers ────────────────────────────────────────────────

const inputStyle = {
  width:'100%', padding:'7px 10px', fontSize:13, borderRadius:6,
  border:'1px solid var(--bdr)', background:'var(--bg2)', color:'var(--t1)', fontFamily:'inherit',
};

const btnSmall = {
  padding:'5px 10px', fontSize:11, fontWeight:700,
  borderRadius:6, border:'1px solid var(--bdr)',
  background:'var(--bg3)', color:'var(--t2)', cursor:'pointer', fontFamily:'inherit',
};

function Stat({ label, value, color = 'var(--t1)' }) {
  return (
    <div style={{ background:'var(--bg2)', borderRadius:8, padding:'8px 10px' }}>
      <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:800, color, marginTop:3, fontFamily:'var(--font-mono)' }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:10, fontSize:12 }}>
      <span style={{ color:'var(--t4)' }}>{label}</span>
      <span style={{ color:'var(--t2)' }}>{value}</span>
    </div>
  );
}
