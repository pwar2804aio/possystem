import { useState } from 'react';
import { useStore } from '../store';

const STATUS = {
  available: { color:'#22c55e', bg:'rgba(34,197,94,.12)',  border:'rgba(34,197,94,.35)', label:'Available' },
  open:      { color:'#3b82f6', bg:'rgba(59,130,246,.12)', border:'rgba(59,130,246,.35)', label:'Open'      },
  occupied:  { color:'#e8a020', bg:'rgba(232,160,32,.14)', border:'rgba(232,160,32,.4)',  label:'Occupied'  },
  reserved:  { color:'#a855f7', bg:'rgba(168,85,247,.12)', border:'rgba(168,85,247,.35)', label:'Reserved'  },
};

function mins(ts) {
  if (!ts) return 0;
  return Math.floor((Date.now() - ts) / 60000);
}
function fmt(ts) {
  const m = mins(ts);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m/60)}h ${m%60}m`;
}

// ─── Seat Guests Modal ────────────────────────────────────────────────────────
function SeatModal({ table, onConfirm, onCancel }) {
  const { staff } = useStore();
  const [covers, setCovers]   = useState(Math.min(2, table.maxCovers));
  const [server, setServer]   = useState(staff?.name || '');
  const [note, setNote]       = useState('');
  return (
    <div className="modal-back">
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:380, padding:24, boxShadow:'var(--sh3)' }}>
        <div style={{ fontSize:17, fontWeight:700, marginBottom:4, color:'var(--t1)' }}>Seat guests · {table.label}</div>
        <div style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>{table.maxCovers} cover max · {table.section} section</div>

        <div style={{ marginBottom:14 }}>
          <label style={L}>Covers</label>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={()=>setCovers(c=>Math.max(1,c-1))} style={QB}>−</button>
            <span style={{ fontSize:22, fontWeight:700, minWidth:36, textAlign:'center', color:'var(--t1)' }}>{covers}</span>
            <button onClick={()=>setCovers(c=>Math.min(table.maxCovers,c+1))} style={QB}>+</button>
            <span style={{ fontSize:12, color:'var(--t3)', marginLeft:4 }}>of {table.maxCovers} max</span>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={L}>Server</label>
          <input className="input" value={server} onChange={e=>setServer(e.target.value)} placeholder="Server name"/>
        </div>

        <div style={{ marginBottom:22 }}>
          <label style={L}>Table note <span style={{fontWeight:400,fontSize:10,color:'var(--t4)'}}>(optional)</span></label>
          <input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Birthday, allergy, VIP…"/>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:2, height:46 }}
            onClick={()=>onConfirm({ covers, server:server||staff?.name||'Staff', note })}>
            Seat & open order →
          </button>
        </div>
      </div>
    </div>
  );
}
const L = { display:'block', fontSize:11, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 };
const QB = { width:34, height:34, borderRadius:8, border:'1px solid var(--bdr2)', background:'var(--bg3)', color:'var(--t1)', fontSize:20, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' };

// ─── Table Node ───────────────────────────────────────────────────────────────
function TableNode({ table, onClick }) {
  const sm = STATUS[table.status] || STATUS.available;
  const session = table.session;
  const timeSeated = session?.seatedAt ? fmt(session.seatedAt) : null;
  const isRound = table.shape === 'rd';

  return (
    <div onClick={onClick} style={{
      position:'absolute',
      left: table.x, top: table.y, width: table.w, height: table.h,
      borderRadius: isRound ? '50%' : 12,
      background: sm.bg,
      border: `2px solid ${sm.border}`,
      cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 6, textAlign: 'center',
      transition: 'all .15s',
      userSelect: 'none',
    }}>
      {/* Table label */}
      <div style={{ fontSize: table.w > 80 ? 13 : 11, fontWeight: 800, color: sm.color, lineHeight:1.2 }}>
        {table.label}
      </div>

      {/* Status / session info */}
      {table.status === 'available' && (
        <div style={{ fontSize:9, color:sm.color, marginTop:2, fontWeight:600 }}>
          {table.maxCovers} covers
        </div>
      )}

      {(table.status === 'open' || table.status === 'occupied') && session && (
        <>
          <div style={{ fontSize:9, color:'var(--t2)', marginTop:2, lineHeight:1.3 }}>
            {session.covers} cvr · {session.server?.split(' ')[0]}
          </div>
          {timeSeated && (
            <div style={{ fontSize:9, color:'var(--t3)', marginTop:1 }}>{timeSeated}</div>
          )}
          {session.subtotal > 0 && (
            <div style={{ fontSize:10, fontWeight:700, color:sm.color, marginTop:2, fontFamily:'DM Mono,monospace' }}>
              £{session.subtotal.toFixed(0)}
            </div>
          )}
        </>
      )}

      {table.status === 'reserved' && table.reservation && (
        <>
          <div style={{ fontSize:9, color:sm.color, marginTop:2, lineHeight:1.3, fontWeight:600 }}>
            {table.reservation.time}
          </div>
          <div style={{ fontSize:9, color:'var(--t3)', marginTop:1 }}>
            {table.reservation.name.split(' ')[0]}
          </div>
        </>
      )}

      {/* Status dot */}
      <div style={{ width:6, height:6, borderRadius:'50%', background:sm.color, position:'absolute', top:5, right:5 }}/>
    </div>
  );
}

// ─── Main Tables Surface ─────────────────────────────────────────────────────
export default function TablesSurface() {
  const { tables, seatTable, openTableInPOS, clearTable, setReservation, setSurface, showToast } = useStore();
  const [selected, setSelected]   = useState(null);
  const [showSeat, setShowSeat]   = useState(false);
  const [section, setSection]     = useState('all');

  const selectedTable = tables.find(t => t.id === selected);

  const sections = [
    { id:'all',   label:'All' },
    { id:'main',  label:'Main dining' },
    { id:'bar',   label:'Bar' },
    { id:'patio', label:'Patio' },
  ];

  const counts = {
    available: tables.filter(t=>t.status==='available').length,
    open:      tables.filter(t=>t.status==='open').length,
    occupied:  tables.filter(t=>t.status==='occupied').length,
    reserved:  tables.filter(t=>t.status==='reserved').length,
  };

  const handleTableClick = (table) => {
    setSelected(table.id);
  };

  const handleAction = (action) => {
    if (!selectedTable) return;
    switch (action) {
      case 'seat':
        setShowSeat(true);
        break;
      case 'open_pos':
        openTableInPOS(selectedTable.id);
        break;
      case 'close':
        clearTable(selectedTable.id);
        showToast(`${selectedTable.label} cleared`, 'success');
        setSelected(null);
        break;
      case 'reserve':
        const name = prompt('Reservation name:');
        if (name) {
          setReservation(selectedTable.id, { name, phone:'', time:'7:00 PM', partySize:2 });
          showToast(`${selectedTable.label} reserved for ${name}`, 'success');
          setSelected(null);
        }
        break;
      case 'cancel_reserve':
        setReservation(selectedTable.id, null);
        showToast(`Reservation cancelled`, 'info');
        setSelected(null);
        break;
    }
  };

  const filteredTables = section === 'all' ? tables : tables.filter(t => t.section === section);
  // Canvas size — just big enough for all positions
  const canvasW = Math.max(...tables.map(t => t.x + t.w)) + 20;
  const canvasH = Math.max(...tables.map(t => t.y + t.h)) + 20;

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Floor plan ─────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--bdr2)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--t1)' }}>Floor plan</div>
          <div style={{ display:'flex', gap:12, marginLeft:8 }}>
            {Object.entries(STATUS).map(([s,m])=>(
              <div key={s} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t3)' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:m.color }}/>
                <span style={{ color:'var(--t2)' }}>{counts[s]}</span> {m.label}
              </div>
            ))}
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
            {sections.map(s=>(
              <button key={s.id} onClick={()=>setSection(s.id)} style={{
                padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                border:`1px solid ${section===s.id?'var(--acc-b)':'var(--bdr)'}`,
                background:section===s.id?'var(--acc-d)':'transparent',
                color:section===s.id?'var(--acc)':'var(--t3)',
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <div style={{ position:'relative', width:canvasW, height:canvasH, minWidth:'100%', minHeight:'100%' }}>
            {/* Section labels */}
            <div style={{ position:'absolute', top:8, left:8, fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em' }}>Main dining</div>
            <div style={{ position:'absolute', top:8, left:400, fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em' }}>Bar</div>
            <div style={{ position:'absolute', top:8, left:490, fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em' }}>Patio</div>

            {/* Section dividers */}
            <div style={{ position:'absolute', top:0, left:398, bottom:0, width:1, background:'var(--bdr)', opacity:.5 }}/>
            <div style={{ position:'absolute', top:0, left:488, bottom:0, width:1, background:'var(--bdr)', opacity:.5 }}/>

            {filteredTables.map(table=>(
              <div key={table.id}>
                <TableNode table={table} onClick={()=>handleTableClick(table)}/>
                {/* Highlight ring when selected */}
                {selected===table.id && (
                  <div style={{
                    position:'absolute', left:table.x-4, top:table.y-4, width:table.w+8, height:table.h+8,
                    borderRadius:table.shape==='rd'?'50%':16,
                    border:'2px solid var(--acc)', pointerEvents:'none',
                    boxShadow:'0 0 0 3px rgba(232,160,32,.2)',
                  }}/>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Detail panel ───────────────────────────── */}
      <div style={{ width:280, flexShrink:0, background:'var(--bg1)', borderLeft:'1px solid var(--bdr2)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {!selectedTable ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--t3)', padding:24, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>⬚</div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>No table selected</div>
            <div style={{ fontSize:12, lineHeight:1.6 }}>Tap a table on the floor plan to see details and actions</div>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid var(--bdr)' }}>
              {(() => {
                const sm = STATUS[selectedTable.status] || STATUS.available;
                const session = selectedTable.session;
                return (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <div style={{ width:40, height:40, borderRadius:selectedTable.shape==='rd'?'50%':10, background:sm.bg, border:`2px solid ${sm.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:sm.color }}>{selectedTable.label}</div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:'var(--t1)' }}>{selectedTable.label}</div>
                        <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>{selectedTable.maxCovers} covers · {selectedTable.section}</div>
                      </div>
                      <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:20, background:sm.bg, color:sm.color, border:`1px solid ${sm.border}` }}>{sm.label}</span>
                    </div>

                    {session && (
                      <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                          <span style={{ color:'var(--t3)' }}>Server</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{session.server}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                          <span style={{ color:'var(--t3)' }}>Covers</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{session.covers}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                          <span style={{ color:'var(--t3)' }}>Time seated</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{fmt(session.seatedAt)}</span>
                        </div>
                        {session.sentAt && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                          <span style={{ color:'var(--t3)' }}>Order sent</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{fmt(session.sentAt)} ago</span>
                        </div>}
                        <div style={{ height:1, background:'var(--bdr)', margin:'8px 0' }}/>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700 }}>
                          <span style={{ color:'var(--t2)' }}>Running total</span>
                          <span style={{ color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>£{(session.subtotal||0).toFixed(2)}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', marginTop:3 }}>
                          <span>inc. service</span><span style={{ fontFamily:'DM Mono,monospace' }}>£{(session.total||0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {selectedTable.status==='reserved' && selectedTable.reservation && (
                      <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                          <span style={{ color:'var(--t3)' }}>Name</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{selectedTable.reservation.name}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                          <span style={{ color:'var(--t3)' }}>Time</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{selectedTable.reservation.time}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                          <span style={{ color:'var(--t3)' }}>Party</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{selectedTable.reservation.partySize} guests</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Current items */}
            {selectedTable.session?.items?.length > 0 && (
              <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--bdr)', flexShrink:0, maxHeight:200, overflowY:'auto' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>
                  Order · {selectedTable.session.items.reduce((s,i)=>s+i.qty,0)} items
                </div>
                {selectedTable.session.items.map(item=>(
                  <div key={item.uid} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <div style={{ flex:1, color:'var(--t2)' }}>
                      {item.qty>1&&<span style={{ color:'var(--t3)', marginRight:3 }}>{item.qty}×</span>}
                      {item.name}
                      {item.status==='sent'&&<span style={{ marginLeft:5, fontSize:9, color:'var(--grn)', fontWeight:700 }}>sent</span>}
                    </div>
                    <span style={{ color:'var(--t3)', fontFamily:'DM Mono,monospace', flexShrink:0 }}>£{(item.price*item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
              {selectedTable.status==='available' && (
                <>
                  <button className="btn btn-acc btn-full" onClick={()=>handleAction('seat')} style={{ height:44, fontSize:14 }}>Seat guests →</button>
                  <button className="btn btn-ghost btn-full" onClick={()=>handleAction('reserve')}>Reserve table</button>
                </>
              )}
              {selectedTable.status==='reserved' && (
                <>
                  <button className="btn btn-acc btn-full" onClick={()=>handleAction('seat')} style={{ height:44, fontSize:14 }}>Seat guests →</button>
                  <button className="btn btn-ghost btn-full" onClick={()=>handleAction('cancel_reserve')}>Cancel reservation</button>
                </>
              )}
              {selectedTable.status==='open' && (
                <>
                  <button className="btn btn-acc btn-full" onClick={()=>handleAction('open_pos')} style={{ height:44, fontSize:14 }}>Open order →</button>
                  <button className="btn btn-ghost btn-full" onClick={()=>handleAction('close')}>Close table</button>
                </>
              )}
              {selectedTable.status==='occupied' && (
                <>
                  <button className="btn btn-acc btn-full" onClick={()=>handleAction('open_pos')} style={{ height:44, fontSize:14 }}>Add to order →</button>
                  <button className="btn btn-ghost btn-full" onClick={()=>handleAction('open_pos')} style={{ borderColor:'var(--grn-b)', color:'var(--grn)' }}>Take payment</button>
                  <button className="btn btn-ghost btn-full" onClick={()=>handleAction('close')}>Force close</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Seat modal */}
      {showSeat && selectedTable && (
        <SeatModal
          table={selectedTable}
          onConfirm={(opts)=>{ seatTable(selectedTable.id, opts); setShowSeat(false); setSelected(null); showToast(`${selectedTable.label} seated — ${opts.covers} covers`,'success'); }}
          onCancel={()=>setShowSeat(false)}
        />
      )}
    </div>
  );
}
