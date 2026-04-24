// v4.6.43: End of Day — location-wide shift Z-read.
//
// Replaces the single-drawer denomination counter with a shift-scoped
// close that aggregates every drawer session + every closed check for
// the current open shift. Three states:
//
//   A — no open shift      → prompt to open one from Shift page
//   B — drawers still open → block Z-read, list which drawers
//   C — all drawers idle   → show full Z-read preview + Run button
//
// Manager / Admin only to actually run. Saves z_report jsonb on
// shifts row, flips shifts.status to 'closed', clears drawer floats.

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { supabase, isMock, getLocationId } from '../../lib/supabase';

const fmt   = (n) => '£' + (Number(n) || 0).toFixed(2);
const fmtS  = (n) => (n >= 0 ? '+' : '−') + '£' + Math.abs(Number(n) || 0).toFixed(2);
const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtDur = (a, b) => {
  if (!a) return '—';
  const end = b ? new Date(b).getTime() : Date.now();
  const ms = end - new Date(a).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function EODClose() {
  const currentShift = useStore(s => s.currentShift);
  const cashDrawers  = useStore(s => s.cashDrawers) || [];
  const closedChecks = useStore(s => s.closedChecks) || [];
  const loadCashDrawers    = useStore(s => s.loadCashDrawers);
  const loadCurrentShift   = useStore(s => s.loadCurrentShift);
  const finaliseShift      = useStore(s => s.finaliseShift);
  const showToast          = useStore(s => s.showToast);

  const [sessions, setSessions] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Refresh drawers + shift on mount so we don't render stale data
  useEffect(() => {
    (async () => {
      await loadCashDrawers?.();
      await loadCurrentShift?.();
    })();
  }, [loadCashDrawers, loadCurrentShift]);

  // Fetch all sessions + movements for the current open shift
  useEffect(() => {
    (async () => {
      if (!currentShift?.id) { setLoading(false); return; }
      if (isMock || !supabase) { setLoading(false); return; }
      try {
        setLoading(true);
        const { data: ss } = await supabase
          .from('drawer_sessions').select('*')
          .eq('shift_id', currentShift.id)
          .order('cash_in_at', { ascending: true });
        setSessions(ss || []);
        const { data: mm } = await supabase
          .from('cash_movements').select('*')
          .eq('shift_id', currentShift.id)
          .order('timestamp', { ascending: true });
        setMovements(mm || []);
      } catch (err) {
        console.warn('[EODClose] fetch failed:', err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentShift?.id]);

  // Derived: which drawers are still non-idle (blocking the close)
  const openDrawers = useMemo(() => {
    return cashDrawers.filter(d => d.status && d.status !== 'idle');
  }, [cashDrawers]);

  // Derived: shift totals from closed_checks scoped to this shift
  const checksForShift = useMemo(() => {
    if (!currentShift?.id) return [];
    return closedChecks.filter(c => c.shiftId === currentShift.id && c.status !== 'voided');
  }, [closedChecks, currentShift?.id]);

  const totals = useMemo(() => {
    const t = { revenue: 0, cash: 0, card: 0, other: 0, tips: 0, refunds: 0, covers: 0, checks: 0 };
    checksForShift.forEach(c => {
      const total = Number(c.total) || 0;
      t.revenue += total;
      t.tips += Number(c.tip) || 0;
      t.covers += Number(c.covers) || 0;
      t.checks++;
      if (c.method === 'cash') t.cash += total;
      else if (c.method === 'card' || c.method === 'stripe') t.card += total;
      else t.other += total;
      if (Array.isArray(c.refunds)) t.refunds += c.refunds.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    });
    return t;
  }, [checksForShift]);

  // Per-drawer rollup from sessions + movements
  const drawerRollup = useMemo(() => {
    return cashDrawers.map(drawer => {
      const drawerSessions = sessions.filter(s => s.drawer_id === drawer.id);
      const totalOpeningFloat = drawerSessions.reduce((s, ses) => s + (Number(ses.opening_float) || 0), 0);
      const totalDeclared = drawerSessions.reduce((s, ses) => s + (Number(ses.declared_cash) || 0), 0);
      const totalExpected = drawerSessions.reduce((s, ses) => s + (Number(ses.expected_cash) || 0), 0);
      const totalVariance = drawerSessions.reduce((s, ses) => s + (Number(ses.variance) || 0), 0);
      const drawerMovs = movements.filter(m => drawerSessions.some(ses => ses.id === m.session_id));
      const cashSales = drawerMovs.filter(m => m.type === 'cash_sale').reduce((s, m) => s + (Number(m.amount) || 0), 0);
      const drops     = drawerMovs.filter(m => m.type === 'drop' || m.type === 'cash_drop').reduce((s, m) => s + (Number(m.amount) || 0), 0);
      const expenses  = drawerMovs.filter(m => m.type === 'expense').reduce((s, m) => s + (Number(m.amount) || 0), 0);
      const allClosed = drawerSessions.length > 0 && drawerSessions.every(s => s.status === 'closed');
      return {
        drawer,
        sessionCount: drawerSessions.length,
        openingFloat: totalOpeningFloat,
        cashSales, drops, expenses,
        declared: totalDeclared, expected: totalExpected,
        variance: totalVariance,
        allClosed,
        currentStatus: drawer.status || 'idle',
      };
    });
  }, [cashDrawers, sessions, movements]);

  // Payment method breakdown
  const paymentMethods = useMemo(() => {
    const byMethod = {};
    checksForShift.forEach(c => {
      const m = c.method || 'other';
      if (!byMethod[m]) byMethod[m] = { method: m, count: 0, revenue: 0, tips: 0 };
      byMethod[m].count++;
      byMethod[m].revenue += Number(c.total) || 0;
      byMethod[m].tips    += Number(c.tip)   || 0;
    });
    return Object.values(byMethod).sort((a, b) => b.revenue - a.revenue);
  }, [checksForShift]);

  // ────────────────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────────────────
  const handleRunZRead = async () => {
    if (busy) return;
    if (openDrawers.length > 0) {
      showToast?.('Cash drawers are still open — cash them up first', 'error');
      return;
    }
    if (!confirm(`Run Z-read and close this shift? This is final — ${checksForShift.length} checks, ${fmt(totals.revenue)} revenue, ${cashDrawers.length} drawers.`)) return;

    setBusy(true);
    try {
      const zReport = {
        shiftId: currentShift.id,
        openedAt: currentShift.openedAt,
        closedAt: new Date().toISOString(),
        totals,
        drawers: drawerRollup.map(r => ({
          drawerId: r.drawer.id,
          name: r.drawer.name,
          sessionCount: r.sessionCount,
          openingFloat: r.openingFloat,
          cashSales: r.cashSales,
          drops: r.drops,
          expenses: r.expenses,
          expected: r.expected,
          declared: r.declared,
          variance: r.variance,
        })),
        paymentMethods,
        generatedAt: new Date().toISOString(),
      };
      const res = await finaliseShift?.({ zReport });
      if (res) {
        showToast?.('Z-read complete — shift closed', 'success');
      }
    } catch (err) {
      showToast?.('Z-read failed: ' + (err?.message || err), 'error');
    } finally {
      setBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────

  // STATE A — no open shift
  if (!currentShift) {
    return (
      <div style={{ padding: '22px 28px', maxWidth: 900 }}>
        <Header />
        <EmptyCard
          icon="⏸"
          title="No shift is currently open"
          body="A shift normally opens automatically when a POS terminal boots. You can also open one manually from the Shift page."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '22px 28px', maxWidth: 900 }}>
        <Header />
        <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--t4)' }}>Loading shift data…</div>
      </div>
    );
  }

  const canRunZRead = openDrawers.length === 0 && cashDrawers.length > 0;

  return (
    <div style={{ padding: '22px 28px', maxWidth: 1100 }}>
      <Header />

      {/* Shift context */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10, marginBottom:18 }}>
        <Card label="Shift opened"  value={fmtTime(currentShift.openedAt)} />
        <Card label="Running for"   value={fmtDur(currentShift.openedAt)} />
        <Card label="Closed checks" value={`${totals.checks}`} />
        <Card label="Drawers"       value={`${cashDrawers.length - openDrawers.length}/${cashDrawers.length} closed`} highlight={openDrawers.length === 0 ? 'var(--grn)' : 'var(--amb,#e8a020)'} />
      </div>

      {/* STATE B — drawers still open */}
      {openDrawers.length > 0 && (
        <div style={{ background:'rgba(235, 97, 97, 0.08)', border:'1.5px solid var(--red-b, #cc5959)', borderRadius:14, padding:'16px 18px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:20 }}>⚠</span>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--red, #cc5959)' }}>End of day blocked</div>
              <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>
                {openDrawers.length} of {cashDrawers.length} drawers are still open. Cash up every drawer before running the Z-read.
              </div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {openDrawers.map(d => (
              <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{d.name}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2, fontFamily:'var(--font-mono)' }}>Float: {fmt(d.currentFloat)}</div>
                </div>
                <span style={{ fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:6, background:'var(--grn-d)', color:'var(--grn)', textTransform:'uppercase', letterSpacing:'.07em' }}>
                  {d.status || 'open'}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:'var(--t3)', marginTop:12, lineHeight:1.55 }}>
            Cash up from <b>Back Office → Cash drawers</b> (click the red Cash up button), or from the POS that owns each drawer.
          </div>
        </div>
      )}

      {/* Totals */}
      <SectionTitle title="Shift totals" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:20 }}>
        <Card label="Revenue"  value={fmt(totals.revenue)} highlight="var(--acc)" />
        <Card label="Cash"     value={fmt(totals.cash)}    highlight="var(--grn)" />
        <Card label="Card"     value={fmt(totals.card)}    highlight="#3b82f6" />
        {totals.other > 0 && <Card label="Other"    value={fmt(totals.other)} />}
        <Card label="Tips"     value={fmt(totals.tips)} />
        {totals.refunds > 0 && <Card label="Refunds" value={fmt(totals.refunds)} highlight="var(--red)" />}
        <Card label="Covers"   value={String(totals.covers || 0)} />
      </div>

      {/* Per-drawer breakdown */}
      {cashDrawers.length > 0 && (
        <>
          <SectionTitle title="Cash drawers" />
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden', marginBottom:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1.3fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr', gap:10, padding:'10px 14px', fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', background:'var(--bg2)', borderBottom:'1px solid var(--bdr)' }}>
              <div>Drawer</div>
              <div style={{ textAlign:'right' }}>Float</div>
              <div style={{ textAlign:'right' }}>Cash sales</div>
              <div style={{ textAlign:'right' }}>Drops</div>
              <div style={{ textAlign:'right' }}>Expenses</div>
              <div style={{ textAlign:'right' }}>Declared</div>
              <div style={{ textAlign:'right' }}>Variance</div>
            </div>
            {drawerRollup.map(r => {
              const hasSessions = r.sessionCount > 0;
              return (
                <div key={r.drawer.id} style={{ display:'grid', gridTemplateColumns:'1.3fr 0.9fr 0.9fr 0.9fr 0.9fr 0.9fr 1fr', gap:10, padding:'12px 14px', fontSize:12, borderBottom:'1px solid var(--bdr)', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{r.drawer.name}</div>
                    <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{r.sessionCount} session{r.sessionCount === 1 ? '' : 's'} · status: {r.currentStatus}</div>
                  </div>
                  <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--t2)' }}>{hasSessions ? fmt(r.openingFloat) : '—'}</div>
                  <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--grn)' }}>{hasSessions ? fmt(r.cashSales) : '—'}</div>
                  <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--t3)' }}>{hasSessions ? fmt(r.drops) : '—'}</div>
                  <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--t3)' }}>{hasSessions ? fmt(r.expenses) : '—'}</div>
                  <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--t1)', fontWeight:700 }}>{r.allClosed ? fmt(r.declared) : '—'}</div>
                  <div style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:700, color: !r.allClosed ? 'var(--t4)' : Math.abs(r.variance) < 0.01 ? 'var(--grn)' : r.variance > 0 ? 'var(--acc)' : 'var(--red)' }}>
                    {!r.allClosed ? '—' : Math.abs(r.variance) < 0.01 ? '✓ 0.00' : fmtS(r.variance)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Payment methods */}
      {paymentMethods.length > 0 && (
        <>
          <SectionTitle title="Payment methods" />
          <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:12, overflow:'hidden', marginBottom:20 }}>
            {paymentMethods.map((pm, i) => (
              <div key={pm.method} style={{ display:'grid', gridTemplateColumns:'1fr 80px 120px 120px', gap:10, padding:'10px 14px', fontSize:13, borderBottom: i < paymentMethods.length - 1 ? '1px solid var(--bdr)' : 'none' }}>
                <div style={{ color:'var(--t1)', fontWeight:600, textTransform:'capitalize' }}>{pm.method}</div>
                <div style={{ textAlign:'right', color:'var(--t4)', fontFamily:'var(--font-mono)' }}>{pm.count}</div>
                <div style={{ textAlign:'right', color:'var(--t2)', fontFamily:'var(--font-mono)', fontWeight:700 }}>{fmt(pm.revenue)}</div>
                <div style={{ textAlign:'right', color:'var(--t4)', fontFamily:'var(--font-mono)' }}>tip {fmt(pm.tips)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Action bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:12, marginTop:20 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color: canRunZRead ? 'var(--t1)' : 'var(--t4)' }}>
            {canRunZRead ? 'Ready to close' : 'Waiting on drawer close'}
          </div>
          <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>
            {canRunZRead
              ? 'Running the Z-read finalises the shift and writes the report.'
              : 'Cash up every drawer above before the Z-read becomes available.'}
          </div>
        </div>
        <button
          onClick={handleRunZRead}
          disabled={!canRunZRead || busy}
          style={{
            padding:'12px 24px', borderRadius:10, border:'none',
            background: canRunZRead && !busy ? 'var(--red, #cc5959)' : 'var(--bg3)',
            color: canRunZRead && !busy ? '#fff' : 'var(--t4)',
            fontWeight:800, fontSize:14, fontFamily:'inherit',
            cursor: canRunZRead && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          {busy ? 'Running…' : 'Run Z-read & close shift'}
        </button>
      </div>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────

function Header() {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)' }}>End of day</div>
      <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>
        Run the location-wide Z-read. Aggregates every drawer + every closed check for the current shift, then closes the shift.
      </div>
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div style={{ fontSize:11, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10, marginTop:6 }}>{title}</div>
  );
}

function Card({ label, value, highlight }) {
  return (
    <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr)', borderRadius:10, padding:'10px 14px' }}>
      <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em' }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:800, color: highlight || 'var(--t1)', marginTop:4, fontFamily:'var(--font-mono)' }}>{value}</div>
    </div>
  );
}

function EmptyCard({ icon, title, body }) {
  return (
    <div style={{ background:'var(--bg1)', border:'1px dashed var(--bdr2)', borderRadius:14, padding:'28px 20px', textAlign:'center' }}>
      <div style={{ fontSize:36, marginBottom:8, opacity:.35 }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)' }}>{title}</div>
      <div style={{ fontSize:12, color:'var(--t4)', marginTop:4 }}>{body}</div>
    </div>
  );
}
