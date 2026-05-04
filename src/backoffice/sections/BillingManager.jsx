// src/backoffice/sections/BillingManager.jsx
// Per-location Stripe Connect status + paste-acct flow + period GMV stats.
// Reads from Platform DB tables: locations, merchant_stripe_accounts, billing_state.

import { useEffect, useState, useCallback } from 'react';
import { supabase, platformSupabase } from '../../lib/supabase';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function BillingManager({ orgCtx, currentUser }) {
  const [locations, setLocations] = useState([]);
  const [msaByLoc, setMsaByLoc] = useState({});
  const [bsByLoc, setBsByLoc] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkModalLoc, setLinkModalLoc] = useState(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const companyId = orgCtx?.companyId || orgCtx?.orgId;

  const refresh = useCallback(async () => {
    if (!platformSupabase) {
      setError('Platform DB not configured (VITE_PLATFORM_SUPABASE_URL / _ANON_KEY)');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = platformSupabase.from('locations').select('id, name, company_id, timezone');
      if (companyId && !isSuperAdmin) q = q.eq('company_id', companyId);
      const { data: locs, error: locErr } = await q;
      if (locErr) throw locErr;
      setLocations(locs ?? []);

      const ids = (locs ?? []).map(l => l.id);
      if (!ids.length) { setLoading(false); return; }

      const [{ data: msas }, { data: bses }] = await Promise.all([
        platformSupabase.from('merchant_stripe_accounts')
          .select('*').in('location_id', ids),
        platformSupabase.from('billing_state')
          .select('*').in('location_id', ids),
      ]);

      const m = {}; (msas ?? []).forEach(r => { m[r.location_id] = r; });
      const b = {}; (bses ?? []).forEach(r => { b[r.location_id] = r; });
      setMsaByLoc(m);
      setBsByLoc(b);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [companyId, isSuperAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ padding: 24, color: 'var(--t1, #fff)', overflow: 'auto', height: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Billing &amp; Stripe accounts</h2>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            Per-location Stripe Connect status, rolling GMV, current plan. Tiers auto-promote within the period as GMV crosses thresholds.
          </div>
        </div>
        <button onClick={refresh} disabled={loading} style={btnGhost}>{loading ? 'Loading…' : 'Refresh'}</button>
      </header>

      {error && (
        <div style={{ padding: 12, background: '#5a1a1a', color: '#fff', borderRadius: 6, marginBottom: 16 }}>{error}</div>
      )}

      {locations.length === 0 && !loading && (
        <div style={{ opacity: 0.6 }}>No locations to display.</div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {locations.map(loc => (
          <Card
            key={loc.id}
            location={loc}
            msa={msaByLoc[loc.id]}
            bs={bsByLoc[loc.id]}
            isSuperAdmin={isSuperAdmin}
            onLink={() => setLinkModalLoc(loc)}
            onUnlink={async () => {
              if (!confirm(`Unlink Stripe account from ${loc.name}?`)) return;
              const msa = msaByLoc[loc.id];
              if (!msa) return;
              const { error } = await platformSupabase.from('merchant_stripe_accounts').delete().eq('id', msa.id);
              if (error) alert(`Unlink failed: ${error.message}`);
              else refresh();
            }}
          />
        ))}
      </div>

      {linkModalLoc && (
        <LinkModal
          location={linkModalLoc}
          onClose={() => setLinkModalLoc(null)}
          onLinked={() => { setLinkModalLoc(null); refresh(); }}
        />
      )}
    </div>
  );
}

function Card({ location, msa, bs, isSuperAdmin, onLink, onUnlink }) {
  const linked = !!msa;
  const status = !linked
    ? { label: 'Not linked', color: '#888' }
    : !msa.charges_enabled
      ? { label: 'Onboarding incomplete', color: '#d97706' }
      : { label: 'Live (charges enabled)', color: '#16a34a' };
  const currency = (msa?.default_currency || bs?.current_period_currency || 'gbp').toUpperCase();

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{location.name}</div>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 12, fontFamily: 'monospace' }}>{location.id}</div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: status.color }} />
              <span style={{ fontSize: 13 }}>{status.label}</span>
            </span>
            {linked && (
              <>
                <span style={pill}>{msa.country ?? '—'}</span>
                <span style={pill}>{currency}</span>
                <span style={pill}>{msa.link_method === 'admin_manual' ? 'Manual' : 'Express'}</span>
                <code style={{ fontSize: 11, opacity: 0.7 }}>{msa.stripe_account_id}</code>
              </>
            )}
          </div>

          {bs && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <Stat label="This month GMV" value={fmt(bs.gmv_this_month, currency)} />
              <Stat label="Plan" value={(bs.current_plan ?? '—').toUpperCase()} />
              <Stat label="Monthly fee" value={fmt(bs.current_monthly_fee, currency)} />
              <Stat label="Last month GMV" value={fmt(bs.gmv_last_month, currency)} />
              <Stat label="Period start" value={bs.current_period_start ?? '—'} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!linked && isSuperAdmin && <button onClick={onLink} style={btnPrimary}>Link Stripe account</button>}
          {linked && isSuperAdmin && <button onClick={onUnlink} style={btnDanger}>Unlink</button>}
        </div>
      </div>
    </div>
  );
}

function LinkModal({ location, onClose, onLinked }) {
  const [acctId, setAcctId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    if (!acctId.startsWith('acct_')) { setError("Account ID must start with 'acct_'"); return; }
    setSubmitting(true);
    try {
      // Auth via Ops DB session (matches stripe-link-merchant edge fn auth)
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('not authenticated');
      const res = await fetch(`${FUNCTIONS_URL}/stripe-link-merchant`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ stripe_account_id: acctId.trim(), location_id: location.id }),
      });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error ?? `HTTP ${res.status}`);
      onLinked();
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px' }}>Link Stripe account</h3>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>to <strong>{location.name}</strong></div>
        <label style={label}>Stripe account ID</label>
        <input type="text" value={acctId} onChange={e => setAcctId(e.target.value)} placeholder="acct_1ABC..." style={input} autoFocus />
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>
          The function validates this with Stripe before linking. Find it in Stripe → Connect → Accounts.
        </div>
        {error && <div style={{ padding: 10, background: '#5a1a1a', color: '#fff', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting} style={btnGhost}>Cancel</button>
          <button onClick={submit} disabled={submitting || !acctId} style={btnPrimary}>
            {submitting ? 'Linking…' : 'Link account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function fmt(n, c = 'GBP') {
  const code = (c || 'GBP').toUpperCase();
  try {
    return new Intl.NumberFormat(code === 'GBP' ? 'en-GB' : 'en-US', {
      style: 'currency', currency: code, minimumFractionDigits: 2,
    }).format(Number(n ?? 0));
  } catch { return `${code} ${Number(n ?? 0).toFixed(2)}`; }
}

const card = { padding: 16, border: '1px solid var(--bd, #2a2a30)', borderRadius: 8, background: 'var(--p2, #18181c)' };
const pill = { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'var(--p3, #2a2a30)', textTransform: 'uppercase', letterSpacing: 0.5 };
const btnPrimary = { padding: '8px 14px', borderRadius: 6, border: 'none', background: 'var(--acc, #ff7070)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnDanger = { padding: '8px 14px', borderRadius: 6, border: '1px solid #5a1a1a', background: 'transparent', color: '#ff8888', fontSize: 13, cursor: 'pointer' };
const btnGhost = { padding: '8px 14px', borderRadius: 6, border: '1px solid var(--bd, #2a2a30)', background: 'transparent', color: 'var(--t1, #fff)', fontSize: 13, cursor: 'pointer' };
const label = { display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 };
const input = { width: '100%', padding: 10, borderRadius: 6, border: '1px solid var(--bd, #2a2a30)', background: 'var(--p3, #1a1a1e)', color: 'var(--t1, #fff)', fontSize: 14, fontFamily: 'monospace', marginBottom: 4, boxSizing: 'border-box' };
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalCard = { width: 480, maxWidth: 'calc(100vw - 32px)', padding: 24, background: 'var(--p2, #18181c)', border: '1px solid var(--bd, #2a2a30)', borderRadius: 10, color: 'var(--t1, #fff)' };
