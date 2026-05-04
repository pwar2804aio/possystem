// src/backoffice/sections/StripeTestHarness.jsx
// TEST MODE only. Fires a real PaymentIntent on a connected account end-to-end
// using Stripe Elements. Use card 4242 4242 4242 4242 / any future / any CVC.

import { useEffect, useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase, platformSupabase } from '../../lib/supabase';
import { getStripeForAccount, createPaymentIntent } from '../../lib/stripeClient';

export default function StripeTestHarness({ orgCtx, currentUser }) {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const companyId = orgCtx?.companyId || orgCtx?.orgId;
  const [locations, setLocations] = useState([]);
  const [msaByLoc, setMsaByLoc] = useState({});
  const [chosenLocId, setChosenLocId] = useState('');
  const [amountStr, setAmountStr] = useState('12.34');
  const [currency, setCurrency] = useState('gbp');
  const [pi, setPi] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      if (!platformSupabase) { setError('Platform DB not configured'); return; }
      let q = platformSupabase.from('locations').select('id, name');
      if (companyId && !isSuperAdmin) q = q.eq('company_id', companyId);
      const { data: locs } = await q;
      setLocations(locs ?? []);
      const ids = (locs ?? []).map(l => l.id);
      if (ids.length) {
        const { data: msas } = await platformSupabase.from('merchant_stripe_accounts')
          .select('location_id, stripe_account_id, charges_enabled, default_currency')
          .in('location_id', ids);
        const m = {};
        (msas ?? []).forEach(r => { m[r.location_id] = r; });
        setMsaByLoc(m);
      }
    })();
  }, [companyId, isSuperAdmin]);

  const msa = msaByLoc[chosenLocId];
  const canCreate = msa?.charges_enabled && Number(amountStr) >= 0.5;

  const handleCreate = async () => {
    setError(null); setResult(null); setPi(null); setBusy(true);
    try {
      // Auth from Ops DB session — matches edge fn expectation
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error('not authenticated');
      const amountMinor = Math.round(Number(amountStr) * 100);
      const piRes = await createPaymentIntent({
        authToken: token,
        locationId: chosenLocId,
        amountMinor,
        currency,
        description: `Test harness payment ${amountStr}`,
        paymentMethodTypes: ['card'],
        metadata: { source: 'stripe_test_harness' },
      });
      setPi(piRes);
      setStripePromise(getStripeForAccount(piRes.stripe_account));
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally { setBusy(false); }
  };

  return (
    <div style={{ padding: 24, color: 'var(--t1, #fff)', overflow: 'auto', height: '100%' }}>
      <h2 style={{ marginTop: 0 }}>Stripe test harness</h2>
      <p style={{ opacity: 0.7, fontSize: 13, marginBottom: 24, maxWidth: 600 }}>
        Test-mode only. Creates a real PaymentIntent on the selected location&apos;s connected
        account, then confirms it with Stripe Elements. Card <code>4242 4242 4242 4242</code> ·
        any future expiry · any CVC.
      </p>

      <section style={section}>
        <label style={label}>1. Location</label>
        <select value={chosenLocId} onChange={e => { setChosenLocId(e.target.value); setPi(null); setResult(null); setError(null); }} style={input}>
          <option value="">— pick —</option>
          {locations.map(l => {
            const m = msaByLoc[l.id];
            const tag = !m ? '(no Stripe acct)' : !m.charges_enabled ? '(charges not enabled)' : `(${m.stripe_account_id})`;
            return <option key={l.id} value={l.id}>{l.name} {tag}</option>;
          })}
        </select>
      </section>

      <section style={section}>
        <label style={label}>2. Amount</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" min="0.50" step="0.01" value={amountStr} onChange={e => setAmountStr(e.target.value)} style={{ ...input, flex: 1 }} />
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...input, width: 100 }}>
            <option value="gbp">GBP</option>
            <option value="usd">USD</option>
          </select>
        </div>
      </section>

      <section style={section}>
        <button onClick={handleCreate} disabled={busy || !chosenLocId || !canCreate} style={btnPrimary}>
          {busy ? 'Creating…' : '3. Create PaymentIntent'}
        </button>
        {chosenLocId && !canCreate && (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            {!msa ? 'No Stripe account linked. Use Billing manager first.'
             : !msa.charges_enabled ? 'Connected account is not yet charges-enabled — finish onboarding in Stripe.'
             : 'Amount must be at least 0.50.'}
          </div>
        )}
      </section>

      {error && <div style={{ padding: 12, background: '#5a1a1a', color: '#fff', borderRadius: 6, marginBottom: 16 }}>{error}</div>}

      {pi && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret: pi.client_secret }}>
          <ConfirmStep clientSecret={pi.client_secret} onResult={setResult} />
        </Elements>
      )}

      {result && (
        <div style={{ marginTop: 24, padding: 16, background: result.error ? '#5a1a1a' : '#1a4a1a', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {result.error ? 'Failed' : `Status: ${result.paymentIntent?.status}`}
          </div>
          <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ConfirmStep({ clientSecret, onResult }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    const card = elements.getElement(CardElement);
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });
    setBusy(false);
    onResult(error ? { error: error.message } : { paymentIntent });
  };
  return (
    <section style={section}>
      <label style={label}>4. Card details</label>
      <div style={{ padding: 12, background: 'var(--p3, #1a1a1e)', borderRadius: 6, border: '1px solid var(--bd, #2a2a30)' }}>
        <CardElement options={{ style: { base: { color: '#fff', fontSize: '16px' } } }} />
      </div>
      <button onClick={submit} disabled={busy || !stripe} style={{ ...btnPrimary, marginTop: 12 }}>
        {busy ? 'Confirming…' : '5. Confirm payment'}
      </button>
    </section>
  );
}

const section = { marginBottom: 20, maxWidth: 520 };
const label = { display: 'block', fontSize: 12, marginBottom: 6, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 };
const input = { padding: 10, borderRadius: 6, border: '1px solid var(--bd, #2a2a30)', background: 'var(--p3, #1a1a1e)', color: 'var(--t1, #fff)', fontSize: 14, width: '100%', boxSizing: 'border-box' };
const btnPrimary = { padding: '10px 18px', borderRadius: 6, border: 'none', background: 'var(--acc, #ff7070)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
