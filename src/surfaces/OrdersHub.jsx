/**
 * OrdersHub — unified view of ALL active orders
 * Tables · Bar tabs · Walk-in (dine-in named / takeaway / collection / delivery)
 */
import { useState, useMemo } from 'react';
import { useStore } from '../store';

const CHANNELS = [
  { id:'all',        label:'All orders',   icon:'⊞' },
  { id:'dine-in',    label:'Dine-in',      icon:'🍽', color:'#3b82f6' },
  { id:'table',      label:'Tables',       icon:'⬚', color:'#3b82f6' },
  { id:'bar',        label:'Bar tabs',     icon:'🍸', color:'#a855f7' },
  { id:'takeaway',   label:'Takeaway',     icon:'🥡', color:'#e8a020' },
  { id:'collection', label:'Collection',   icon:'📦', color:'#22c55e' },
  { id:'delivery',   label:'Delivery',     icon:'🛵', color:'#ef4444' },
];

const Q_STATUS = {
  received: { label:'Received',   color:'#3b82f6', bg:'rgba(59,130,246,.1)',  icon:'⏳' },
  prep:     { label:'In prep',    color:'#e8a020', bg:'rgba(232,160,32,.1)',  icon:'👨‍🍳' },
  ready:    { label:'Ready',      color:'#22c55e', bg:'rgba(34,197,94,.1)',   icon:'✓' },
  collected:{ label:'Collected',  color:'#888780', bg:'rgba(136,135,128,.1)', icon:'✓✓' },
  paid:     { label:'Paid',       color:'#888780', bg:'rgba(136,135,128,.1)', icon:'💳' },
};

const T_STATUS = {
  available: { label:'Available',  color:'#888780' },
  occupied:  { label:'Occupied',   color:'#e8a020' },
  bill:      { label:'Bill req.',  color:'#ef4444' },
};

function elapsed(date) {
  if (!date) return '';
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins/60)}h ${mins%60}m ago`;
}

function moneyFmt(n) { return `£${(n||0).toFixed(2)}`; }

export default function OrdersHub() {
  const {
    tables, tabs,
    orderQueue, updateQueueStatus, updateQueueItem, removeFromQueue,
    showToast, setSurface, setActiveTableId,
  } = useStore();

  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [showDone, setDone]   = useState(false);

  // Build a unified orders list
  const allOrders = useMemo(() => {
    const result = [];

    // Table orders
    tables
      .filter(t => t.status !== 'available' && t.session)
      .forEach(t => {
        const s = t.session;
        result.push({
          _kind: 'table',
          id: `table-${t.id}`,
          ref: `Table ${t.label}`,
          type: 'table',
          channel: 'table',
          label: `Table ${t.label}`,
          server: s.server,
          covers: s.covers,
          items: s.items?.filter(i=>!i.voided) || [],
          total: s.total || 0,
          subtotal: s.subtotal || 0,
          status: t.status === 'bill' ? 'bill' : s.sentAt ? 'active' : 'ordering',
          createdAt: s.createdAt || s.sentAt,
          sentAt: s.sentAt,
          section: t.section,
          tableId: t.id,
          _table: t,
        });
      });

    // Bar tabs
    tabs
      ?.filter(tab => !tab.closed)
      .forEach(tab => {
        result.push({
          _kind: 'tab',
          id: `tab-${tab.id}`,
          ref: tab.name || tab.id,
          type: 'bar',
          channel: 'bar',
          label: tab.name || 'Bar tab',
          server: tab.server,
          items: tab.items?.filter(i=>!i.voided) || [],
          total: tab.total || 0,
          status: 'active',
          createdAt: tab.createdAt,
          sentAt: tab.sentAt,
          _tab: tab,
        });
      });

    // Walk-in / queue orders
    orderQueue.forEach(o => {
      result.push({
        _kind: 'queue',
        id: `q-${o.ref}`,
        ref: o.ref,
        type: o.type || 'dine-in',
        channel: o.type || 'dine-in',
        label: o.customer?.name || o.ref,
        server: o.staff,
        customer: o.customer,
        items: o.items || [],
        total: o.total || 0,
        status: o.status || 'received',
        createdAt: o.createdAt,
        sentAt: o.sentAt,
        collectionTime: o.collectionTime,
        isASAP: o.isASAP,
        _queue: o,
      });
    });

    return result;
  }, [tables, tabs, orderQueue]);

  const filtered = useMemo(() => {
    let list = allOrders;

    // Channel filter
    if (filter !== 'all') {
      list = list.filter(o => o.channel === filter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        (o.label||'').toLowerCase().includes(q) ||
        (o.ref||'').toLowerCase().includes(q) ||
        (o.server||'').toLowerCase().includes(q)
      );
    }

    // Hide done
    if (!showDone) {
      list = list.filter(o => !['collected','paid'].includes(o.status));
    }

    return list.sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
  }, [allOrders, filter, search, showDone]);

  // Summary counts
  const counts = useMemo(() => ({
    total:  allOrders.filter(o => !['collected','paid'].includes(o.status)).length,
    tables: allOrders.filter(o => o.channel==='table').length,
    bar:    allOrders.filter(o => o.channel==='bar').length,
    queue:  orderQueue.filter(o => !['collected','paid'].includes(o.status)).length,
  }), [allOrders, orderQueue]);

  const advanceStatus = (o) => {
    if (o._kind !== 'queue') return;
    const flow = ['received','prep','ready','collected'];
    const idx  = flow.indexOf(o.status);
    if (idx < flow.length - 1) {
      const next = flow[idx + 1];
      updateQueueStatus(o.ref, next);
      if (next === 'ready')     showToast(`${o.ref} ready for ${o.label}`, 'success');
      if (next === 'collected') { showToast(`${o.ref} collected`, 'info'); setTimeout(() => removeFromQueue(o.ref), 8000); }
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>Orders Hub</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>
              {counts.total} active · {counts.tables} tables · {counts.bar} bar tabs · {counts.queue} in queue
            </div>
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'var(--t3)' }}>
            <input type="checkbox" checked={showDone} onChange={e=>setDone(e.target.checked)} style={{ accentColor:'var(--acc)' }}/>
            Show completed
          </label>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:12 }}>🔍</span>
            <input
              style={{ background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:9, padding:'6px 10px 6px 28px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', width:200 }}
              placeholder="Search by name, ref…"
              value={search} onChange={e=>setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Channel filter tabs */}
        <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
          {CHANNELS.map(ch => {
            const count = ch.id === 'all' ? counts.total : allOrders.filter(o => o.channel===ch.id && !['collected','paid'].includes(o.status)).length;
            return (
              <button key={ch.id} onClick={() => setFilter(ch.id)} style={{
                padding:'5px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit',
                fontSize:11, fontWeight:filter===ch.id?800:500, whiteSpace:'nowrap',
                border:`1.5px solid ${filter===ch.id?(ch.color||'var(--acc)'):'var(--bdr)'}`,
                background:filter===ch.id?`${ch.color||'var(--acc)'}18`:'var(--bg3)',
                color:filter===ch.id?(ch.color||'var(--acc)'):'var(--t3)',
              }}>
                {ch.icon} {ch.label}
                {count > 0 && <span style={{ marginLeft:6, fontFamily:'var(--font-mono)', fontWeight:800 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders grid */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t4)' }}>
            <div style={{ fontSize:40, marginBottom:14, opacity:.2 }}>⊞</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)', marginBottom:4 }}>No orders</div>
            <div style={{ fontSize:12 }}>
              {search ? `No results for "${search}"` : filter==='all' ? 'All active orders will appear here' : `No active ${filter} orders`}
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:12 }}>
            {filtered.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={() => advanceStatus(order)}
                onNavigate={() => {
                  if (order._kind === 'table' && order.tableId) {
                    setActiveTableId(order.tableId);
                    setSurface('tables');
                  } else if (order._kind === 'queue') {
                    setSurface('pos');
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance, onNavigate }) {
  const ch = CHANNELS.find(c => c.id === order.channel) || CHANNELS[0];
  const qs = Q_STATUS[order.status] || Q_STATUS.received;
  const itemCount = order.items?.length || 0;

  // For table/bar orders, compute a simple status label
  const statusLabel =
    order._kind === 'queue' ? qs.label :
    order.status === 'bill' ? 'Bill requested' :
    order.status === 'ordering' ? 'Building order' :
    order.sentAt ? 'In kitchen' : 'Ordering';

  const statusColor =
    order.status === 'bill'     ? '#ef4444' :
    order.status === 'ready'    ? '#22c55e' :
    order.status === 'ordering' ? '#888780' :
    ch.color || '#3b82f6';

  return (
    <div style={{
      background:'var(--bg1)', border:`1.5px solid ${statusColor}33`,
      borderRadius:14, overflow:'hidden', display:'flex', flexDirection:'column',
    }}>
      {/* Card header */}
      <div style={{ padding:'11px 14px', background:`${statusColor}08`, borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'flex-start', gap:10 }}>
        <div style={{ fontSize:22 }}>{ch.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14, fontWeight:800, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {order.label}
            </span>
            <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--t4)', flexShrink:0 }}>{order.ref}</span>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap' }}>
            {order.server && <span style={{ fontSize:10, color:'var(--t3)' }}>👤 {order.server}</span>}
            {order.covers && <span style={{ fontSize:10, color:'var(--t3)' }}>🧑 {order.covers} covers</span>}
            <span style={{ fontSize:10, color:'var(--t4)' }}>{elapsed(order.sentAt || order.createdAt)}</span>
          </div>
        </div>
        <div style={{
          fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20, flexShrink:0,
          background:qs.bg || `${statusColor}18`, color:statusColor, border:`1px solid ${statusColor}44`,
        }}>
          {statusLabel}
        </div>
      </div>

      {/* Items */}
      <div style={{ padding:'10px 14px', flex:1 }}>
        {order.items.slice(0, 4).map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:3 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--t3)', fontFamily:'var(--font-mono)', minWidth:20 }}>{item.qty}×</span>
            <span style={{ fontSize:12, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {item.kitchenName || item.receiptName || item.name}
            </span>
            <span style={{ fontSize:11, color:'var(--t3)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
              {moneyFmt(item.price * item.qty)}
            </span>
          </div>
        ))}
        {itemCount > 4 && (
          <div style={{ fontSize:11, color:'var(--t4)', marginTop:4 }}>+ {itemCount - 4} more items…</div>
        )}
        {itemCount === 0 && (
          <div style={{ fontSize:12, color:'var(--t4)', fontStyle:'italic' }}>No items yet</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--bdr)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:14, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>
          {moneyFmt(order.total)}
        </span>
        <span style={{ fontSize:10, color:'var(--t4)' }}>{itemCount} item{itemCount!==1?'s':''}</span>

        {/* Collection time */}
        {order.collectionTime && (
          <span style={{ fontSize:10, fontWeight:700, color:'var(--t2)', marginLeft:4 }}>
            {order.isASAP ? '⚡ ASAP' : `⏰ ${order.collectionTime}`}
          </span>
        )}

        <div style={{ marginLeft:'auto', display:'flex', gap:5 }}>
          {/* Navigate to order */}
          <button onClick={onNavigate}
            style={{ padding:'4px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>
            Open →
          </button>

          {/* Advance queue status */}
          {order._kind === 'queue' && !['collected','paid'].includes(order.status) && (() => {
            const NEXT_LABEL = { received:'Mark in prep', prep:'Mark ready', ready:'Mark collected' };
            const label = NEXT_LABEL[order.status];
            if (!label) return null;
            return (
              <button onClick={onAdvance}
                style={{ padding:'4px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:11, fontWeight:700 }}>
                {label}
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
