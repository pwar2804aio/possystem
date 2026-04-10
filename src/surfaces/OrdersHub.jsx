/**
 * OrdersHub — unified live view of ALL active orders
 * Tables · Bar tabs · Walk-in (dine-in named / takeaway / collection / delivery)
 */
import { useState, useMemo, useEffect } from 'react';
import { useStore } from '../store';

const CHANNELS = [
  { id:'all',        label:'All',        icon:'⊞',  color:'var(--acc)' },
  { id:'table',      label:'Tables',     icon:'⬚',  color:'#3b82f6' },
  { id:'bar',        label:'Bar tabs',   icon:'🍸',  color:'#a855f7' },
  { id:'dine-in',    label:'Dine-in',    icon:'🍽',  color:'#22d3ee' },
  { id:'takeaway',   label:'Takeaway',   icon:'🥡',  color:'#e8a020' },
  { id:'collection', label:'Collection', icon:'📦',  color:'#22c55e' },
  { id:'delivery',   label:'Delivery',   icon:'🛵',  color:'#ef4444' },
];

const Q_STATUS = {
  received:  { label:'Received',  color:'#3b82f6', dot:'#3b82f6' },
  prep:      { label:'In prep',   color:'#e8a020', dot:'#e8a020' },
  ready:     { label:'Ready ✓',  color:'#22c55e', dot:'#22c55e' },
  collected: { label:'Collected', color:'#888780', dot:'#888780' },
  paid:      { label:'Paid',      color:'#888780', dot:'#888780' },
};

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

function moneyFmt(n) { return `£${(n||0).toFixed(2)}`; }

export default function OrdersHub() {
  const {
    tables, tabs, orderQueue,
    updateQueueStatus, updateQueueItem, removeFromQueue,
    showToast, setSurface, setActiveTableId,
  } = useStore();

  const [channel, setChannel]   = useState('all');
  const [search, setSearch]     = useState('');
  const [showDone, setShowDone] = useState(false);
  const [myOrders, setMyOrders] = useState(false);
  const [tick, setTick]         = useState(0);
  const currentStaff = useStore(s => s.staff);

  // Refresh elapsed times every 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // ── Unified order list ──────────────────────────────────────────────────
  const allOrders = useMemo(() => {
    const out = [];

    // Active table sessions
    tables.filter(t => t.status !== 'available' && t.session).forEach(t => {
      const s = t.session;
      const items = s.items?.filter(i => !i.voided) || [];
      out.push({
        _kind: 'table', id: `tbl-${t.id}`,
        ref: `Table ${t.label}`,
        channel: 'table',
        displayName: `Table ${t.label}`,
        section: t.section,
        server: s.server,
        covers: s.covers,
        items,
        total: s.total || 0,
        subtotal: s.subtotal || 0,
        status: t.status === 'bill' ? 'bill_req' : s.sentAt ? 'active' : 'ordering',
        createdAt: s.createdAt || s.sentAt,
        sentAt: s.sentAt,
        tableId: t.id,
        _raw: t,
      });
    });

    // Bar tabs
    tabs?.filter(tab => tab.status !== 'closed').forEach(tab => {
      const rounds = tab.rounds || [];
      const items  = rounds.flatMap(r => r.items || []).filter(i => !i.voided);
      out.push({
        _kind: 'tab', id: `tab-${tab.id}`,
        ref: tab.name || tab.id,
        channel: 'bar',
        displayName: tab.name || 'Bar tab',
        server: tab.openedBy || tab.server,
        items,
        total: tab.total || 0,
        status: 'active',
        createdAt: tab.openedAt || tab.createdAt,
        sentAt: tab.openedAt,
        _raw: tab,
      });
    });

    // Queue orders (walk-in, collection, delivery, named dine-in)
    orderQueue.forEach(o => {
      out.push({
        _kind: 'queue', id: `q-${o.ref}`,
        ref: o.ref,
        channel: o.type || 'dine-in',
        displayName: o.customer?.name || o.ref,
        server: o.staff,
        customer: o.customer,
        items: o.items || [],
        total: o.total || 0,
        status: o.status || 'received',
        createdAt: o.createdAt,
        sentAt: o.sentAt,
        collectionTime: o.collectionTime,
        isASAP: o.isASAP,
        _raw: o,
      });
    });

    return out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [tables, tabs, orderQueue, tick]);

  // ── Filtered view ────────────────────────────────────────────────────────
  const display = useMemo(() => {
    let list = allOrders;
    if (channel !== 'all') list = list.filter(o => o.channel === channel);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.displayName||'').toLowerCase().includes(q) ||
        (o.ref||'').toLowerCase().includes(q) ||
        (o.server||'').toLowerCase().includes(q)
      );
    }
    if (!showDone) list = list.filter(o => !['collected','paid'].includes(o.status));
    if (myOrders && currentStaff) {
      const myName = currentStaff.name?.toLowerCase();
      list = list.filter(o => o.server?.toLowerCase() === myName);
    }
    return list;
  }, [allOrders, channel, search, showDone]);

  // ── Per-channel counts ────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const active = allOrders.filter(o => !['collected','paid'].includes(o.status));
    return {
      all:        active.length,
      table:      active.filter(o => o.channel === 'table').length,
      bar:        active.filter(o => o.channel === 'bar').length,
      'dine-in':  active.filter(o => o.channel === 'dine-in').length,
      takeaway:   active.filter(o => o.channel === 'takeaway').length,
      collection: active.filter(o => o.channel === 'collection').length,
      delivery:   active.filter(o => o.channel === 'delivery').length,
    };
  }, [allOrders]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const advance = (o) => {
    if (o._kind !== 'queue') return;
    const flow = ['received', 'prep', 'ready', 'collected'];
    const idx  = flow.indexOf(o.status);
    if (idx < 0 || idx >= flow.length - 1) return;
    const next = flow[idx + 1];
    updateQueueStatus(o.ref, next);
    if (next === 'ready')     showToast(`${o.displayName} — ready!`, 'success');
    if (next === 'collected') {
      showToast(`${o.ref} collected`, 'info');
      setTimeout(() => removeFromQueue(o.ref), 10000);
    }
  };

  const openOrder = (o) => {
    if (o._kind === 'table') {
      setActiveTableId(o.tableId);
      setSurface('tables');
    } else if (o._kind === 'tab') {
      setSurface('bar');
    } else {
      setSurface('pos');
    }
  };

  const totalActive = counts.all;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ padding:'12px 18px 0', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)', display:'flex', alignItems:'center', gap:10 }}>
              Orders Hub
              {totalActive > 0 && (
                <span style={{ fontSize:12, fontWeight:800, padding:'2px 9px', borderRadius:20, background:'var(--acc)', color:'#0b0c10' }}>
                  {totalActive} active
                </span>
              )}
            </div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
              All live orders — tables, bar tabs, walk-in, collection & delivery
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {currentStaff && (
              <button onClick={() => setMyOrders(m => !m)} style={{
                padding:'5px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit',
                background: myOrders ? 'var(--acc-d)' : 'var(--bg3)',
                border: `1.5px solid ${myOrders ? 'var(--acc)' : 'var(--bdr)'}`,
                color: myOrders ? 'var(--acc)' : 'var(--t3)', fontSize:11, fontWeight:myOrders?800:500,
              }}>
                👤 My orders
              </button>
            )}
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'var(--t3)' }}>
              <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)}
                style={{ accentColor:'var(--acc)', width:14, height:14 }} />
              Show completed
            </label>
          </div>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:12, pointerEvents:'none' }}>🔍</span>
            <input
              style={{ background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:9, padding:'7px 10px 7px 28px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', width:200 }}
              placeholder="Name, ref, server…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Channel filter */}
        <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:1 }}>
          {CHANNELS.map(ch => {
            const n = counts[ch.id] || 0;
            const active = channel === ch.id;
            return (
              <button key={ch.id} onClick={() => setChannel(ch.id)} style={{
                padding:'6px 13px', borderRadius:'10px 10px 0 0', cursor:'pointer', fontFamily:'inherit',
                fontSize:12, fontWeight:active ? 800 : 500, whiteSpace:'nowrap', border:'none',
                borderBottom: active ? `3px solid ${ch.color}` : '3px solid transparent',
                background: active ? `${ch.color}15` : 'transparent',
                color: active ? ch.color : 'var(--t3)',
                transition:'all .12s',
              }}>
                {ch.icon} {ch.label}
                {n > 0 && (
                  <span style={{ marginLeft:6, fontSize:10, fontWeight:800, padding:'1px 6px', borderRadius:10, background:active?ch.color:'var(--bg3)', color:active?'#0b0c10':'var(--t4)' }}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Order cards ──────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>
        {display.length === 0 ? (
          <EmptyState channel={channel} search={search} counts={counts} />
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
            {display.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={() => advance(order)}
                onOpen={() => openOrder(order)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({ order, onAdvance, onOpen }) {
  const ch  = CHANNELS.find(c => c.id === order.channel) || CHANNELS[0];
  const qs  = Q_STATUS[order.status] || Q_STATUS.received;
  const elapsed = timeAgo(order.sentAt || order.createdAt);

  // Compute status display
  let statusText = qs.label;
  let statusColor = qs.color;
  if (order.status === 'bill_req') { statusText = 'Bill requested'; statusColor = '#ef4444'; }
  if (order.status === 'ordering') { statusText = 'Building order'; statusColor = '#888780'; }
  if (order.status === 'active' && order._kind === 'table') { statusText = 'In kitchen'; statusColor = '#e8a020'; }
  if (order.status === 'active' && order._kind === 'tab')   { statusText = 'Open tab'; statusColor = '#a855f7'; }

  const NEXT_ACTION = { received:'Mark in prep →', prep:'Mark ready →', ready:'Mark collected →' };
  const canAdvance = order._kind === 'queue' && !!NEXT_ACTION[order.status];

  const items = order.items || [];

  return (
    <div style={{
      background:'var(--bg1)', border:`1.5px solid ${statusColor}30`,
      borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column',
      transition:'border-color .15s',
    }}
    onMouseEnter={e=>e.currentTarget.style.borderColor=statusColor+'80'}
    onMouseLeave={e=>e.currentTarget.style.borderColor=statusColor+'30'}>

      {/* Card top strip */}
      <div style={{ height:3, background:`linear-gradient(90deg, ${statusColor}, ${ch.color})` }} />

      {/* Header */}
      <div style={{ padding:'11px 14px', display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ fontSize:24, lineHeight:1, flexShrink:0 }}>{ch.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:14, fontWeight:800, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
              {order.displayName}
            </span>
            <span style={{ fontSize:10, color:'var(--t4)', fontFamily:'var(--font-mono)', flexShrink:0 }}>{order.ref}</span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:4 }}>
            {order.server && <span style={{ fontSize:10, color:'var(--t3)' }}>👤 {order.server}</span>}
            {order.covers && <span style={{ fontSize:10, color:'var(--t3)' }}>🧑 {order.covers}</span>}
            {order.section && <span style={{ fontSize:10, color:'var(--t4)' }}>📍 {order.section}</span>}
            {elapsed && <span style={{ fontSize:10, color:'var(--t4)' }}>⏱ {elapsed}</span>}
          </div>
          {/* Collection time */}
          {order.collectionTime && (
            <div style={{ marginTop:4, fontSize:11, fontWeight:700, color:'var(--acc)' }}>
              {order.isASAP ? '⚡ ASAP' : `⏰ ${order.collectionTime}`}
            </div>
          )}
        </div>
        {/* Status badge */}
        <div style={{
          flexShrink:0, fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20,
          background:`${statusColor}18`, color:statusColor, border:`1px solid ${statusColor}40`,
          whiteSpace:'nowrap',
        }}>
          <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:statusColor, marginRight:5, verticalAlign:'middle' }}/>
          {statusText}
        </div>
      </div>

      {/* Item list */}
      <div style={{ padding:'0 14px 10px', flex:1 }}>
        {items.length === 0 ? (
          <div style={{ fontSize:11, color:'var(--t4)', fontStyle:'italic' }}>No items yet</div>
        ) : (
          <>
            {items.slice(0, 5).map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:2 }}>
                <span style={{ fontSize:11, fontWeight:800, color:'var(--t3)', fontFamily:'var(--font-mono)', minWidth:18, textAlign:'right' }}>
                  {item.qty}×
                </span>
                <span style={{ fontSize:12, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {item.kitchenName || item.receiptName || item.name}
                  {item.mods && typeof item.mods === 'string' && item.mods && (
                    <span style={{ color:'var(--t4)', fontSize:10 }}> · {item.mods.substring(0,40)}</span>
                  )}
                </span>
                <span style={{ fontSize:11, color:'var(--t3)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
                  {moneyFmt(item.price * item.qty)}
                </span>
              </div>
            ))}
            {items.length > 5 && (
              <div style={{ fontSize:10, color:'var(--t4)', marginTop:3 }}>
                +{items.length - 5} more item{items.length - 5 !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--bdr)', background:'var(--bg2)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:15, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>
          {moneyFmt(order.total)}
        </span>
        <span style={{ fontSize:10, color:'var(--t4)' }}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
        <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
          <button onClick={onOpen} style={{
            padding:'5px 11px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
            background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600,
          }}>
            Open →
          </button>
          {canAdvance && (
            <button onClick={onAdvance} style={{
              padding:'5px 13px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:11, fontWeight:700,
            }}>
              {NEXT_ACTION[order.status]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ channel, search, counts }) {
  const ch = CHANNELS.find(c => c.id === channel);
  if (search) {
    return (
      <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t4)' }}>
        <div style={{ fontSize:32, marginBottom:12, opacity:.2 }}>🔍</div>
        <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)' }}>No results for "{search}"</div>
        <div style={{ fontSize:12, marginTop:4 }}>Try a different name or order reference</div>
      </div>
    );
  }
  return (
    <div style={{ textAlign:'center', padding:'70px 20px', color:'var(--t4)' }}>
      <div style={{ fontSize:40, marginBottom:14, opacity:.15 }}>{ch?.icon || '⊞'}</div>
      <div style={{ fontSize:15, fontWeight:700, color:'var(--t2)', marginBottom:6 }}>
        No active {channel === 'all' ? '' : ch?.label} orders
      </div>
      <div style={{ fontSize:12, lineHeight:1.7 }}>
        {channel === 'all' && 'All orders will appear here once sent from any terminal'}
        {channel === 'table' && 'Seat guests at a table from the Floor plan and send their order to kitchen'}
        {channel === 'bar' && 'Open bar tabs from the Bar surface'}
        {channel === 'collection' && 'Named collection orders appear here after being sent to kitchen'}
        {channel === 'delivery' && 'Delivery orders from Deliverect will appear here once configured'}
        {channel === 'takeaway' && 'Named takeaway orders appear here after being sent to kitchen'}
        {channel === 'dine-in' && 'Named walk-in dine-in orders appear here after being sent to kitchen'}
      </div>
    </div>
  );
}
