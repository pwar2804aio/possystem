import { useCompact } from '../lib/useCompact';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { resolveServiceCharge } from '../lib/serviceCharge';
import CheckSelectorModal from '../components/CheckSelectorModal';

const STATUS = {
  available: { color:'#22c55e', bg:'rgba(34,197,94,.12)',  border:'rgba(34,197,94,.35)', label:'Available' },
  open:      { color:'#3b82f6', bg:'rgba(59,130,246,.12)', border:'rgba(59,130,246,.35)', label:'Open'      },
  seated:    { color:'#60a5fa', bg:'rgba(96,165,250,.10)', border:'rgba(96,165,250,.3)',  label:'Seated'    },
  occupied:  { color:'#e8a020', bg:'rgba(232,160,32,.14)', border:'rgba(232,160,32,.4)',  label:'Occupied'  },
  reserved:  { color:'#a855f7', bg:'rgba(168,85,247,.12)', border:'rgba(168,85,247,.35)', label:'Reserved'  },
};

function mins(ts) {
  if (!ts) return 0;
  const t = ts instanceof Date ? ts.getTime() : typeof ts === 'string' ? new Date(ts).getTime() : ts;
  return Math.floor((Date.now() - t) / 60000);
}
function fmt(ts) {
  const m = mins(ts);
  if (m < 0) return '0m';
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

// ─── Reservation Modal ────────────────────────────────────────────────────────
const TIME_SLOTS = [];
for (let h=11; h<=23; h++) {
  for (let m=0; m<60; m+=15) {
    const hh = h.toString().padStart(2,'0');
    const mm = m.toString().padStart(2,'0');
    TIME_SLOTS.push(`${hh}:${mm}`);
  }
}

function ReservationModal({ table, existing, onConfirm, onCancel }) {
  const now = new Date();
  const nearestSlot = TIME_SLOTS.find(t => {
    const [h,m] = t.split(':').map(Number);
    return h * 60 + m >= now.getHours() * 60 + now.getMinutes() + 15;
  }) || TIME_SLOTS[TIME_SLOTS.length - 1];

  const [name,      setName]     = useState(existing?.name      || '');
  const [phone,     setPhone]    = useState(existing?.phone     || '');
  const [partySize, setParty]    = useState(existing?.partySize || Math.min(2, table.maxCovers));
  const [time,      setTime]     = useState(existing?.time      || nearestSlot);
  const [notes,     setNotes]    = useState(existing?.notes     || '');
  const [date,      setDate]     = useState(existing?.date      || new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD

  const canSave = name.trim().length > 0;

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:22, width:'100%', maxWidth:400, maxHeight:'88vh', overflow:'auto', boxShadow:'var(--sh3)' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>{existing ? 'Edit reservation' : 'New reservation'}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{table.label} · max {table.maxCovers} covers</div>
          </div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:22 }}>×</button>
        </div>

        <div style={{ padding:'16px 20px' }}>
          {/* Guest name */}
          <div style={{ marginBottom:14 }}>
            <label style={L}>Guest name <span style={{ color:'var(--red)', fontWeight:400 }}>*</span></label>
            <input className="input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
          </div>

          {/* Phone */}
          <div style={{ marginBottom:14 }}>
            <label style={L}>Phone number</label>
            <input className="input" type="tel" placeholder="+44 7700 000000" value={phone} onChange={e=>setPhone(e.target.value)}/>
          </div>

          {/* Date + time row */}
          <div style={{ display:'flex', gap:10, marginBottom:14 }}>
            <div style={{ flex:1.2 }}>
              <label style={L}>Date</label>
              <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
            </div>
            <div style={{ flex:1 }}>
              <label style={L}>Time</label>
              <select value={time} onChange={e=>setTime(e.target.value)} style={{ width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:11, padding:'0 12px', height:42, fontSize:13, color:'var(--t1)', fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Party size */}
          <div style={{ marginBottom:14 }}>
            <label style={L}>Party size</label>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={()=>setParty(p=>Math.max(1,p-1))} style={QB}>−</button>
              <span style={{ fontSize:22, fontWeight:800, minWidth:36, textAlign:'center', color:'var(--t1)' }}>{partySize}</span>
              <button onClick={()=>setParty(p=>Math.min(table.maxCovers,p+1))} style={QB}>+</button>
              {partySize > table.maxCovers && (
                <span style={{ fontSize:11, color:'var(--red)', fontWeight:600 }}>Exceeds table max ({table.maxCovers})</span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom:20 }}>
            <label style={L}>Notes <span style={{ fontWeight:400, color:'var(--t4)', textTransform:'none', letterSpacing:0 }}>optional</span></label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Birthday, dietary requirements, VIP, high chair needed…" rows={2}
              style={{ width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:11, padding:'10px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', resize:'none', outline:'none', lineHeight:1.5, display:'block', transition:'border-color .15s' }}
              onFocus={e=>e.target.style.borderColor='var(--acc-b)'}
              onBlur={e=>e.target.style.borderColor='var(--bdr2)'}/>
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onCancel}>Cancel</button>
            <button className="btn btn-acc" style={{ flex:2, height:46 }} disabled={!canSave}
              onClick={()=>onConfirm({ name:name.trim(), phone, partySize, time, date, notes })}>
              {existing ? 'Update reservation' : 'Confirm reservation'} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Table Node ───────────────────────────────────────────────────────────────
function TableNode({ table, onClick }) {
  const { tables } = useStore();
  const session = table.session;
  // Derive display status: seated = session exists but no items yet
  const displayStatus = (table.status === 'occupied' && session && session.items?.filter(i=>!i.voided).length === 0)
    ? 'seated'
    : table.status;
  const sm = STATUS[displayStatus] || STATUS.available;
  const timeSeated = session?.seatedAt ? fmt(session.seatedAt) : null;
  const isRound = table.shape === 'rd';
  const childCount = tables.filter(t => t.parentId === table.id).length;

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

      {displayStatus === 'seated' && session && (
        <div style={{ fontSize:9, color:sm.color, marginTop:2, fontWeight:600 }}>
          {session.covers} cvr · seated
        </div>
      )}

      {(table.status === 'open' || (table.status === 'occupied' && displayStatus !== 'seated')) && session && (
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
      {/* Split checks badge */}
      {childCount > 0 && (
        <div style={{ position:'absolute', top:4, left:5, fontSize:9, fontWeight:800, padding:'1px 5px', borderRadius:8, background:'var(--acc)', color:'#0b0c10', lineHeight:1.4 }}>
          {childCount+1} checks
        </div>
      )}
    </div>
  );
}

// ─── Main Tables Surface ─────────────────────────────────────────────────────
export default function TablesSurface() {
  const compact = useCompact();
  const { tables, seatTable, openTableInPOS, clearTable, setReservation, setSurface, showToast, staff, locationSections, deviceConfig } = useStore();
  const [selected, setSelected]   = useState(null);
  const [showSeat, setShowSeat]   = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [showCheckSelector, setShowCheckSelector] = useState(false);
  const [checkSelectorTable, setCheckSelectorTable] = useState(null);
  // Auto-filter to assigned section from device profile (e.g. bar terminal shows bar section by default)
  const [section, setSection] = useState(deviceConfig?.assignedSection || 'all');
  const [view, setView]           = useState('floor');  // floor | mine | all
  const [, setTick] = useState(0);

  // Re-render every 30s so urgency colours stay live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(id);
  }, []);

  const selectedTable = tables.find(t => t.id === selected);

  // v4.6.56: filter hidden sections from the tab list. Hidden flag set in Back Office.
  const visibleSections = (locationSections || []).filter(s => !s.hidden);
  const hiddenSectionIds = new Set((locationSections || []).filter(s => s.hidden).map(s => s.id));
  const sections = [
    { id:'all', label:'All' },
    ...visibleSections,
  ];

  const counts = {
    available: tables.filter(t=>t.status==='available').length,
    open:      tables.filter(t=>t.status==='open').length,
    occupied:  tables.filter(t=>t.status==='occupied').length,
    reserved:  tables.filter(t=>t.status==='reserved').length,
  };

  // Helper — open a table, showing check selector if it has splits
  const openTable = (table) => {
    const hasChildren = tables.some(t => t.parentId === table.id);
    if (hasChildren) {
      setCheckSelectorTable(table);
      setShowCheckSelector(true);
    } else {
      openTableInPOS(table.id);
    }
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
        openTable(selectedTable);
        break;
      case 'close':
        clearTable(selectedTable.id);
        showToast(`${selectedTable.label} cleared`, 'success');
        setSelected(null);
        break;
      case 'reserve':
        setShowReservation(true);
        break;
      case 'cancel_reserve':
        setReservation(selectedTable.id, null);
        showToast(`Reservation cancelled`, 'info');
        setSelected(null);
        break;
    }
  };

  // v4.6.56: in 'all' view exclude tables whose section is hidden.
  const filteredTables = (section === 'all'
      ? tables.filter(t => !hiddenSectionIds.has(t.section))
      : tables.filter(t => t.section === section))
    .filter(t => !t.parentId);  // never render child tables (T1.2) on the floor plan
  // v4.6.56: per-section auto-fit. When a single section is selected, shift
  // tables to top-left of the canvas (subtract section's min-x/min-y) so the
  // user sees just that section filling the viewport. 'All' view keeps absolute
  // positions so multi-section layouts retain their relative geometry.
  const _tbls = filteredTables.length ? filteredTables : tables;
  const _minX = section === 'all' ? 0 : Math.min(..._tbls.map(t => t.x || 0));
  const _minY = section === 'all' ? 0 : Math.min(..._tbls.map(t => t.y || 0));
  const _offX = section === 'all' ? 0 : Math.max(0, _minX - 20);
  const _offY = section === 'all' ? 0 : Math.max(0, _minY - 40);
  const canvasW = (_tbls.length ? Math.max(..._tbls.map(t => (t.x || 0) + (t.w || 80))) : 0) - _offX + 40;
  const canvasH = (_tbls.length ? Math.max(..._tbls.map(t => (t.y || 0) + (t.h || 64))) : 0) - _offY + 40;

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Floor plan ─────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'0 18px', borderBottom:'1px solid var(--bdr2)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:0, flexShrink:0 }}>
          {/* View tabs */}
          {[
            { id:'floor', label:'Floor plan' },
            { id:'mine',  label:`My orders${staff?.name?' ('+staff.name+')':''}` },
            { id:'all',   label:'All open orders' },
          ].map(v => (
            <button key={v.id} onClick={()=>setView(v.id)} style={{
              padding:'12px 16px', cursor:'pointer', fontFamily:'inherit', border:'none',
              borderBottom:`2px solid ${view===v.id?'var(--acc)':'transparent'}`,
              background:'transparent', color:view===v.id?'var(--acc)':'var(--t3)',
              fontSize:13, fontWeight:view===v.id?700:500, whiteSpace:'nowrap',
            }}>{v.label}</button>
          ))}

          {/* Status legend + section filter — only on floor view */}
          {view==='floor' && (
            <>
              <div style={{ display:'flex', gap:10, marginLeft:16 }}>
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
            </>
          )}
        </div>

        {/* ── Orders list view ─────────────────────────────── */}
        {(view==='mine' || view==='all') && (() => {
          const now = Date.now();
          const activeTables = tables.filter(t =>
            (t.status==='open'||t.status==='occupied') && t.session && !t.parentId
          ).filter(t =>
            view==='all' || t.session.server===staff?.name
          ).sort((a,b) => (b.session.seatedAt||0) - (a.session.seatedAt||0));

          const urgency = (session) => {
            // Use sentAt if order has been sent, else seatedAt
            const lastActivity = session.sentAt ? new Date(session.sentAt).getTime() : (session.seatedAt||now);
            const idleMins = (now - lastActivity) / 60000;
            if (idleMins >= 20) return 'red';
            if (idleMins >= 10) return 'amber';
            return 'green';
          };
          const urgencyStyle = {
            green: { border:'1px solid var(--grn-b)', bg:'var(--bg2)', dot:'var(--grn)' },
            amber: { border:'1px solid var(--acc-b)', bg:'rgba(232,160,32,.06)', dot:'var(--acc)' },
            red:   { border:'1px solid var(--red-b)', bg:'rgba(220,40,40,.06)',  dot:'var(--red)' },
          };

          return (
            <div style={{ flex:1, overflowY:'auto', padding:16 }}>
              {activeTables.length === 0 && (
                <div style={{ textAlign:'center', padding:'60px 0', color:'var(--t3)' }}>
                  <div style={{ fontSize:40, marginBottom:12, opacity:.4 }}>⬚</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>
                    {view==='mine' ? 'No open tables assigned to you' : 'No open tables'}
                  </div>
                </div>
              )}

              {/* Urgency legend */}
              {activeTables.length > 0 && (
                <div style={{ display:'flex', gap:12, marginBottom:14, fontSize:11, color:'var(--t3)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--grn)' }}/>Active
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--acc)' }}/>10+ mins idle
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:8,height:8,borderRadius:'50%',background:'var(--red)' }}/>20+ mins idle
                  </div>
                </div>
              )}

              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {activeTables.map(table => {
                  const session = table.session;
                  const urg = urgency(session);
                  const us = urgencyStyle[urg];
                  const seatedMins = Math.floor((now - (session.seatedAt||now)) / 60000);
                  const lastActivity = session.sentAt ? new Date(session.sentAt).getTime() : (session.seatedAt||now);
                  const idleMins = Math.floor((now - lastActivity) / 60000);
                  const childChecks = tables.filter(t => t.parentId === table.id);
                  const hasChildren = childChecks.length > 0;
                  // Combined total across all checks
                  const allChecks = [table, ...childChecks];
                  const combinedTotal = allChecks.reduce((s,t) => s+(t.session?.subtotal||0), 0);

                  return (
                    <div key={table.id}>
                    <div onClick={()=>openTable(table)} style={{
                      display:'flex', alignItems:'center', gap:16, padding:'14px 18px',
                      borderRadius:hasChildren?'14px 14px 0 0':14, cursor:'pointer', border:us.border, background:us.bg,
                      transition:'all .15s', borderBottom:hasChildren?'none':us.border,
                    }}>
                      {/* Urgency dot */}
                      <div style={{ width:10, height:10, borderRadius:'50%', background:us.dot, flexShrink:0, boxShadow:`0 0 6px ${us.dot}` }}/>

                      {/* Table label */}
                      <div style={{ width:80, flexShrink:0 }}>
                        <div style={{ fontSize:18, fontWeight:800, color:'var(--t1)' }}>{table.label}</div>
                        <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>{table.section}</div>
                      </div>

                      {/* Covers */}
                      <div style={{ width:70, flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>🪑 {session.covers}</div>
                        <div style={{ fontSize:11, color:'var(--t3)' }}>covers</div>
                      </div>

                      {/* Server */}
                      {view==='all' && (
                        <div style={{ width:90, flexShrink:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.server}</div>
                          <div style={{ fontSize:11, color:'var(--t3)' }}>server</div>
                        </div>
                      )}

                      {/* Time seated */}
                      <div style={{ width:70, flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>⏱ {seatedMins < 60 ? `${seatedMins}m` : `${Math.floor(seatedMins/60)}h${seatedMins%60}m`}</div>
                        <div style={{ fontSize:11, color:'var(--t3)' }}>seated</div>
                      </div>

                      {/* Idle time */}
                      <div style={{ width:80, flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:urg==='green'?'var(--t2)':urg==='amber'?'var(--acc)':'var(--red)' }}>
                          {idleMins < 1 ? 'Just now' : `${idleMins}m ago`}
                        </div>
                        <div style={{ fontSize:11, color:'var(--t3)' }}>last activity</div>
                      </div>

                      {/* Check total */}
                      <div style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:20, fontWeight:800, color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>
                          £{combinedTotal.toFixed(2)}
                        </div>
                        <div style={{ fontSize:11, color:'var(--t3)' }}>
                          {hasChildren ? `${allChecks.length} checks` : `${session.items?.filter(i=>!i.voided).length||0} items`}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div style={{ color:'var(--t4)', fontSize:18, flexShrink:0 }}>›</div>
                    </div>

                    {/* Child check sub-rows */}
                    {hasChildren && childChecks.map((child, ci) => {
                      const childSub = child.session?.subtotal || 0;
                      const childItems = child.session?.items?.filter(i=>!i.voided).length || 0;
                      return (
                        <div key={child.id} onClick={()=>openTableInPOS(child.id)} style={{
                          display:'flex', alignItems:'center', gap:16, padding:'10px 18px',
                          cursor:'pointer', background:us.bg, borderLeft:`3px solid var(--acc)`,
                          border:us.border, borderTop:'none',
                          borderRadius:ci===childChecks.length-1?'0 0 14px 14px':'0',
                          transition:'all .15s',
                        }}>
                          <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--acc)', flexShrink:0 }}/>
                          <div style={{ width:80, flexShrink:0 }}>
                            <div style={{ fontSize:15, fontWeight:700, color:'var(--acc)' }}>{child.label}</div>
                            <div style={{ fontSize:10, color:'var(--t4)' }}>Check {ci+2}</div>
                          </div>
                          <div style={{ fontSize:12, color:'var(--t3)', flex:1 }}>
                            {child.session?.server} · {childItems} items
                          </div>
                          <div style={{ fontSize:16, fontWeight:800, color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>
                            £{childSub.toFixed(2)}
                          </div>
                          <div style={{ color:'var(--t4)', fontSize:16 }}>›</div>
                        </div>
                      );
                    })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Floor plan canvas ─────────────────────────────── */}
        {view==='floor' && (
          <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <div style={{ position:'relative', width:canvasW, height:canvasH, minWidth:'100%', minHeight:'100%' }}>
            {/* v4.6.55: Dynamic section labels. Position each label at its section's
                min-x (matches FloorPlanBuilder back-office rendering). Previously
                hardcoded label positions assumed fixed lane widths and broke when
                tables were placed past the Bar lane's hardcoded x=488 boundary. */}
            {(() => {
              const sectionSet = new Set(filteredTables.map(t => t.section).filter(Boolean));
              const SECTION_LABELS = { main: 'Main dining', bar: 'Bar', patio: 'Patio' };
              return [...sectionSet].map(secKey => {
                const secTables = filteredTables.filter(t => t.section === secKey);
                if (!secTables.length) return null;
                const minX = Math.min(...secTables.map(t => t.x || 0));
                const label = SECTION_LABELS[secKey] || secKey;
                return (
                  <div key={secKey} style={{ position:'absolute', top:Math.max(4, 8 - _offY), left:Math.max(8, minX - _offX), fontSize:10, fontWeight:700, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em' }}>
                    {label}
                  </div>
                );
              });
            })()}

            {filteredTables.map(table=>(
              <div key={table.id}>
                <TableNode table={{ ...table, x: (table.x || 0) - _offX, y: (table.y || 0) - _offY }} onClick={()=>handleTableClick(table)}/>
                {/* Highlight ring when selected */}
                {selected===table.id && (
                  <div style={{
                    position:'absolute', left:(table.x || 0) - _offX - 4, top:(table.y || 0) - _offY - 4, width:table.w+8, height:table.h+8,
                    borderRadius:table.shape==='rd'?'50%':16,
                    border:'2px solid var(--acc)', pointerEvents:'none',
                    boxShadow:'0 0 0 3px rgba(232,160,32,.2)',
                  }}/>
                )}
              </div>
            ))}
          </div>
          </div>  /* scroll wrapper */
        )}  {/* end floor view */}
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
                        {(() => {
                          // Compute service charge using device profile config
                          const sub = session.subtotal || 0;
                          let scRate = 0;
                          try {
                            scRate = resolveServiceCharge({
                              deviceConfig,
                              orderType: 'dine-in',
                              covers: session.covers || 1,
                              waived: session.serviceChargeWaived || false,
                            });
                          } catch {}
                          const scAmt = sub * scRate;
                          const totalWithSC = sub + scAmt;
                          return (
                            <>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:700 }}>
                                <span style={{ color:'var(--t2)' }}>Running total</span>
                                <span style={{ color:'var(--acc)', fontFamily:'DM Mono,monospace' }}>£{sub.toFixed(2)}</span>
                              </div>
                              {scAmt > 0 && (
                                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', marginTop:3 }}>
                                  <span>inc. service ({deviceConfig?.serviceCharge?.rate ?? 12.5}%)</span>
                                  <span style={{ fontFamily:'DM Mono,monospace' }}>£{totalWithSC.toFixed(2)}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {selectedTable.status==='reserved' && selectedTable.reservation && (
                      <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                          <span style={{ color:'var(--t3)' }}>Name</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{selectedTable.reservation.name}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                          <span style={{ color:'var(--t3)' }}>Time</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{selectedTable.reservation.time}{selectedTable.reservation.date ? ` · ${new Date(selectedTable.reservation.date+'T12:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}` : ''}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:selectedTable.reservation.notes?3:0 }}>
                          <span style={{ color:'var(--t3)' }}>Party</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{selectedTable.reservation.partySize} guests</span>
                        </div>
                        {selectedTable.reservation.phone && (
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:selectedTable.reservation.notes?3:0 }}>
                            <span style={{ color:'var(--t3)' }}>Phone</span><span style={{ color:'var(--t1)', fontWeight:600 }}>{selectedTable.reservation.phone}</span>
                          </div>
                        )}
                        {selectedTable.reservation.notes && (
                          <div style={{ marginTop:4, fontSize:11, color:'var(--orn)', fontStyle:'italic', padding:'5px 8px', background:'rgba(249,115,22,.08)', borderRadius:6 }}>
                            📝 {selectedTable.reservation.notes}
                          </div>
                        )}
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
                  <button className="btn btn-ghost btn-full" onClick={()=>setShowReservation(true)}>Reserve table</button>
                </>
              )}
              {selectedTable.status==='reserved' && (
                <>
                  <button className="btn btn-acc btn-full" onClick={()=>handleAction('seat')} style={{ height:44, fontSize:14 }}>Seat guests →</button>
                  <button className="btn btn-ghost btn-full" onClick={()=>setShowReservation(true)}>✏ Edit reservation</button>
                  <button className="btn btn-red btn-sm btn-full" style={{ height:32 }} onClick={()=>handleAction('cancel_reserve')}>Cancel reservation</button>
                </>
              )}
              {selectedTable.status==='open' && (
                <>
                  <button className="btn btn-acc btn-full" onClick={()=>handleAction('open_pos')} style={{ height:44, fontSize:14 }}>Open order →</button>
                  <button className="btn btn-ghost btn-full" onClick={()=>handleAction('close')}>Close table</button>
                </>
              )}
              {selectedTable.status==='occupied' && (() => {
                const childChecks = tables.filter(t => t.parentId === selectedTable.id);
                const hasChildren = childChecks.length > 0;
                return (
                  <>
                    {hasChildren ? (
                      <button className="btn btn-acc btn-full" onClick={()=>{
                        setCheckSelectorTable(selectedTable);
                        setShowCheckSelector(true);
                      }} style={{ height:44, fontSize:14 }}>
                        Select check ({childChecks.length+1} open) →
                      </button>
                    ) : (
                      <button className="btn btn-acc btn-full" onClick={()=>handleAction('open_pos')} style={{ height:44, fontSize:14 }}>Add to order →</button>
                    )}
                    <button className="btn btn-ghost btn-full" style={{ borderColor:'var(--grn-b)', color:'var(--grn)' }}
                      onClick={()=>handleAction('open_pos')}>Take payment</button>
                    <button className="btn btn-ghost btn-full" onClick={()=>handleAction('close')}>Force close</button>
                  </>
                );
              })()}
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

      {showCheckSelector && checkSelectorTable && (
        <CheckSelectorModal
          parentTable={checkSelectorTable}
          onSelect={(tableId)=>{
            openTableInPOS(tableId);
            setShowCheckSelector(false);
            setCheckSelectorTable(null);
          }}
          onClose={()=>{ setShowCheckSelector(false); setCheckSelectorTable(null); }}
        />
      )}

      {showReservation && selectedTable && (
        <ReservationModal
          table={selectedTable}
          existing={selectedTable.reservation}
          onConfirm={(res)=>{
            setReservation(selectedTable.id, res);
            setShowReservation(false);
            showToast(`${selectedTable.label} reserved for ${res.name} at ${res.time}`, 'success');
          }}
          onCancel={()=>setShowReservation(false)}
        />
      )}
    </div>
  );
}
