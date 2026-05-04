// src/backoffice/sections/BillingManager.jsx
// Back office Billing section. Lists locations + their connected Stripe account
// status, lets super_admin paste an acct_... to link, shows current period GMV
// + auto-tier from get_plan_for_gmv(). Reads from Platform DB.
//
// Phase 1 capabilities:
//   - List locations + Stripe connection status
//   - Super-admin: paste acct_... → link to location
//   - View rolling GMV, current plan, monthly fee
//   - Unlink (clears stripe_account_id, keeps subscription row)
//
// Out of scope this drop:
//   - Express onboarding link generation
//   - Tier override UI
//   - Skim history / invoice list
//   - GMV chart / period drill-down

import { useEffect, useState, useCallback } from 'react';
import { platformSupabase } from '../../lib/supabase';
import { linkMerchantAccount } from '../../lib/stripeClient';

export default function BillingManager({ orgId, currentUser }) {
  const [locations, setLocations] = useState([]);
  const [subscriptions, setSubscriptions] = useState({}); // locId -> sub row
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkModalLoc, setLinkModalLoc] = useState(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const refresh = useCallback(async () => {
    if (!platformSupabase) {
      setError('Platform DB not configured (set VITE_PLATFORM_SUPABASE_URL + VITE_PLATFORM_SUPABASE_ANON_KEY)');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let locQuery = platformSupabase.from('locations').select('id, name, org_id, currency, timezone');
      if (orgId && !isSuperAdmin) locQuery = locQuery.eq('org_id', orgId);
      const { data: locs, error: locErr } = await locQuery;
      if (locErr) throw locErr;
      setLocations(locs ?? []);

      const ids = (locs ?? []).map(l => l.id);
      if (ids.length === 0) { setLoading(false); return; }

      const { data: subs, error: subErr } = await platformSupabase
        .from('subscriptions')
        .select('id, location_id, plan, monthly_fee, gmv_this_month, gmv_last_month, billing_period_start, ' +
                'stripe_account_id, stripe_account_link_method, charges_enabled, payouts_enabled, ' +
                'details_submitted, stripe_account_country, stripe_default_currency, stripe_linked_at, ' +
                'stripe_last_webhook_at')
        .in('location_id', ids);
      if (subErr) throw subErr;

      const map = {};
      (subs ?? []).forEach(s => { map[s.location_id] = s; });
      setSubscriptions(map);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [orgId, isSuperAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div style={{ padding: 24, color: 'var(--t1, #fff)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Billing &amp; Stripe accounts</h2>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            Per-location Stripe Connect status and rolling GMV. Tiers auto-calculated from GMV at period close.
          </div>
        </div>
        <button onClick={refresh} disabled={loading} style={btnGhost}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div style={{ padding: 12, background: '#5a1a1a', color: '#fff', borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {locations.length === 0 && !loading && (
        <div style={{ opacity: 0.6 }}>No locations to display.</div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {locations.map(loc => (
          <LocationBillingCard
            key={loc.id}
            location={loc}
            subscription={subscriptions[loc.id]}
            isSuperAdmin={isSuperAdmin}
            onLinkClick={() => setLinkModalLoc(loc)}
            onUnlinkClick={async () => {
              if (!confirm(`Unlink Stripe account from ${loc.name}? Subscription row stays; only the Stripe link is cleared.`)) return;
              const sub = subscriptions[loc.id];
              if (!sub) return;
              const { error } = await platformSupabase.from('subscriptions').update({
                stripe_account_id: null,
                stripe_account_link_method: null,
                charges_enabled: false,
                payouts_enabled: false,
                details_submitted: false,
                stripe_account_country: null,
                stripe_default_currency: null,
                stripe_capabilities: {},
                stripe_requirements: null,
                stripe_linked_at: null,
                stripe_linked_by_user_id: null,
              }).eq('id', sub.id);
              if (error) alert(`Unlink failed: ${error.message}`);
              else refresh();
            }}
          />
        ))}
      </div>

      {linkModalLoc && (
        <LinkAccountModal
          location={linkModalLoc}
          onClose={() => setLinkModalLoc(null)}
          onLinked={() => { setLinkModalLoc(null); refresh(); }}
        />
      )}
    </div>
  );
}

function LocationBillingCard({ location, subscription, isSuperAdmin, onLinkClick, onUnlinkClick }) {
  const linked = !!subscription?.stripe_account_id;
  const status = !subscription
    ? { label: 'No subscription row', color: '#888' }
    : !linked
      ? { label: 'Not linked', color: '#888' }
      : !subscription.charges_enabled
        ? { label: 'Onboarding incomplete', color: '#d97706' }
        : { label: 'Live (charges enabled)', color: '#16a34a' };

  const currency = (subscription?.stripe_default_currency || location.currency || 'gbp').toUpperCase();

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
                <span style={pill}>{subscription.stripe_account_country ?? '—'}</span>
                <span style={pill}>{currency}</span>
                <span style={pill}>{subscription.stripe_account_link_method === 'admin_manual' ? 'Manual' : 'Express'}</span>
                <code style={{ fontSize: 11, opacity: 0.7 }}>{subscription.stripe_account_id}</code>
              </>
            )}
          </div>

          {subscription && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <Stat label="This month GMV" value={fmtMoney(subscription.gmv_this_month, currency)} />
              <Stat label="Plan" value={(subscription.plan ?? '—').toUpperCase()} />
              <Stat label="Monthly fee" value={fmtMoney(subscription.monthly_fee, currency)} />
              <Stat label="Last month GMV" value={fmtMoney(subscription.gmv_last_month, currency)} />
              <Stat label="Period start" value={subscription.billing_period_start ?? '—'} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!linked && isSuperAdmin && (
            <button onClick={onLinkClick} style={btnPrimary}>Link Stripe account</button>
          )}
          {linked && isSuperAdmin && (
            <button onClick={onUnlinkClick} style={btnDanger}>Unlink</button>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkAccountModal({ location, onClose, onLinked }) {
  const [acctId, setAcctId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setError(null);
    if (!acctId.startsWith('acct_')) {
      setError("Account ID must start with 'acct_'");
      return;
    }
    setSubmitting(true);
    try {
      const { data: session } = await platformSupabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('not authenticated to Platform DB');
      await linkMerchantAccount({
        authToken: token,
        locationId: location.id,
        stripeAccountId: acctId.trim(),
      });
      onLinked();
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px' }}>Link Stripe account</h3>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
          to <strong>{location.name}</strong>
        </div>

        <label style={label}>Stripe account ID</label>
        <input
          type="text"
          value={acctId}
          onChange={(e) => setAcctId(e.target.value)}
          placeholder="acct_1ABC..."
          style={input}
          autoFocus
        />
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>
          Find this in the merchant&apos;s Stripe dashboard URL or in your platform&apos;s Connect → Accounts list. The function will validate it with Stripe before linking.
        </div>

        {error && (
          <div style={{ padding: 10, background: '#5a1a1a', color: '#fff', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

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

function fmtMoney(amount, currency = 'GBP') {
  const code = (currency || 'GBP').toUpperCase();
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(code === 'GBP' ? 'en-GB' : 'en-US', {
      style: 'currency', currency: code, minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

// ── Inline styles using existing CSS vars (--bg, --acc, --t1, etc.) ──────────

const card = {
  padding: 16,
  border: '1px solid var(--bd, #2a2a30)',
  borderRadius: 8,
  background: 'var(--p2, #18181c)',
};
const pill = {
  fontSize: 11, padding: '2px 8px', borderRadius: 99,
  background: 'var(--p3, #2a2a30)', textTransform: 'uppercase', letterSpacing: 0.5,
};
const btnPrimary = {
  padding: '8px 14px', borderRadius: 6, border: 'none',
  background: 'var(--acc, #ff7070)', color: '#fff',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const btnDanger = {
  padding: '8px 14px', borderRadius: 6, border: '1px solid #5a1a1a',
  background: 'transparent', color: '#ff8888', fontSize: 13, cursor: 'pointer',
};
const btnGhost = {
  padding: '8px 14px', borderRadius: 6, border: '1px solid var(--bd, #2a2a30)',
  background: 'transparent', color: 'var(--t1, #fff)', fontSize: 13, cursor: 'pointer',
};
const label = { display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.7 };
const input = {
  width: '100%', padding: 10, borderRadius: 6,
  border: '1px solid var(--bd, #2a2a30)',
  background: 'var(--p3, #1a1a1e)', color: 'var(--t1, #fff)',
  fontSize: 14, fontFamily: 'monospace', marginBottom: 4, boxSizing: 'border-box',
};
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalCard = {
  width: 480, maxWidth: 'calc(100vw - 32px)', padding: 24,
  background: 'var(--p2, #18181c)',
  border: '1px solid var(--bd, #2a2a30)',
  borderRadius: 10, color: 'var(--t1, #fff)',
};
