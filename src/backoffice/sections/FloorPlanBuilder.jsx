import { useState, useRef, useCallback } from 'react';
import { useStore } from '../../store';

const SECTIONS = ['main', 'bar', 'patio'];
const SHAPES = [{ id:'sq', label:'Square' }, { id:'rd', label:'Round' }];
const SECTION_COLORS = { main:'#3b82f6', bar:'#e8a020', patio:'#22c55e' };

export default function FloorPlanBuilder() {
  const { tables, updateTableLayout, addTableToLayout, removeTableFromLayout, showToast } = useStore();
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x:0, y:0 });
  const [section, setSection] = useState('all');
  const [showAddTable, setShowAddTable] = useState(false);
  const canvasRef = useRef(null);

  // Only show non-child tables on floor plan builder
  const displayTables = tables.filter(t => !t.parentId && (section === 'all' || t.section === section));
  const selectedTable = tables.find(t => t.id === selected);

  const handleMouseDown = useCallback((e, tableId) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    setDragging(tableId);
    setSelected(tableId);
    setDragOffset({
      x: e.clientX - rect.left - table.x,
      y: e.clientY - rect.top - table.y,
    });
  }, [tables]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.round((e.clientX - rect.left - dragOffset.x) / 8) * 8);
    const y = Math.max(0, Math.round((e.clientY - rect.top - dragOffset.y) / 8) * 8);
    updateTableLayout(dragging, { x, y });
  }, [dragging, dragOffset, updateTableLayout]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      showToast('Table position saved', 'success');
      setDragging(null);
    }
  }, [dragging, showToast]);

  const updateSelected = (patch) => {
    if (!selected) return;
    updateTableLayout(selected, patch);
  };

  const sectionStats = SECTIONS.map(s => ({
    id: s,
    count: tables.filter(t => t.section === s && !t.parentId).length,
    active: tables.filter(t => t.section === s && !t.parentId && (t.status === 'open' || t.status === 'occupied')).length,
  }));

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left panel */}
      <div style={{ width:220, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', background:'var(--bg1)', flexShrink:0 }}>
        <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Sections</div>
          <button onClick={() => setSection('all')} style={{ width:'100%', marginBottom:4, padding:'7px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight: section === 'all' ? 700 : 400, border:'none', background: section === 'all' ? 'var(--acc-d)' : 'transparent', color: section === 'all' ? 'var(--acc)' : 'var(--t2)', textAlign:'left', borderLeft:`2px solid ${section === 'all' ? 'var(--acc)' : 'transparent'}` }}>All sections</button>
          {SECTIONS.map(s => {
            const stats = sectionStats.find(x => x.id === s);
            const active = section === s;
            return (
              <button key={s} onClick={() => setSection(s)} style={{ width:'100%', marginBottom:4, padding:'7px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight: active ? 700 : 400, border:'none', background: active ? `${SECTION_COLORS[s]}22` : 'transparent', color: active ? SECTION_COLORS[s] : 'var(--t2)', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', borderLeft:`2px solid ${active ? SECTION_COLORS[s] : 'transparent'}` }}>
                <span style={{ textTransform:'capitalize' }}>{s}</span>
                <span style={{ fontSize:10, color:'var(--t4)' }}>{stats?.count || 0} tables</span>
              </button>
            );
          })}
        </div>

        <div style={{ padding:'14px' }}>
          <button onClick={() => setShowAddTable(true)} style={{ width:'100%', padding:'9px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700, marginBottom:10 }}>+ Add table</button>
          {selected && selectedTable && (
            <>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Edit — {selectedTable.label}</div>
              <div style={{ marginBottom:8 }}>
                <label style={{ display:'block', fontSize:10, color:'var(--t4)', marginBottom:4 }}>Label</label>
                <input style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'6px 9px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} value={selectedTable.label} onChange={e => updateSelected({ label: e.target.value })}/>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ display:'block', fontSize:10, color:'var(--t4)', marginBottom:4 }}>Max covers</label>
                <input type="number" min="1" max="20" style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'6px 9px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} value={selectedTable.maxCovers} onChange={e => updateSelected({ maxCovers: parseInt(e.target.value) || 1 })}/>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ display:'block', fontSize:10, color:'var(--t4)', marginBottom:4 }}>Shape</label>
                <div style={{ display:'flex', gap:5 }}>
                  {SHAPES.map(sh => (
                    <button key={sh.id} onClick={() => updateSelected({ shape: sh.id })} style={{ flex:1, padding:'5px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:700, border:`1px solid ${selectedTable.shape === sh.id ? 'var(--acc)' : 'var(--bdr)'}`, background: selectedTable.shape === sh.id ? 'var(--acc-d)' : 'var(--bg3)', color: selectedTable.shape === sh.id ? 'var(--acc)' : 'var(--t2)' }}>{sh.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ display:'block', fontSize:10, color:'var(--t4)', marginBottom:4 }}>Section</label>
                <select value={selectedTable.section} onChange={e => updateSelected({ section: e.target.value })} style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'6px 9px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', cursor:'pointer' }}>
                  {SECTIONS.map(s => <option key={s} value={s} style={{ textTransform:'capitalize' }}>{s}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:12 }}>
                {[['Width', 'w'], ['Height', 'h']].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ display:'block', fontSize:10, color:'var(--t4)', marginBottom:4 }}>{label}px</label>
                    <input type="number" min="40" max="200" step="8" style={{ width:'100%', background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'6px 9px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} value={selectedTable[key]} onChange={e => updateSelected({ [key]: parseInt(e.target.value) || 64 })}/>
                  </div>
                ))}
              </div>
              <button onClick={() => { removeTableFromLayout(selected); setSelected(null); showToast(`Table removed`, 'warning'); }} style={{ width:'100%', padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>
                Remove table
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex:1, overflow:'auto', background:'var(--bg)', position:'relative' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', fontSize:11, color:'var(--t4)', background:'var(--bg1)', display:'flex', gap:16, alignItems:'center' }}>
          <span>Drag tables to reposition · Click to select and edit</span>
          <span style={{ marginLeft:'auto' }}>{displayTables.length} table{displayTables.length !== 1 ? 's' : ''} shown</span>
        </div>
        <div
          ref={canvasRef}
          style={{
            position:'relative', minWidth:700, minHeight:560,
            margin:20, background:'var(--bg1)',
            border:'1px solid var(--bdr)', borderRadius:16,
            userSelect:'none', cursor: dragging ? 'grabbing' : 'default',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Section dividers */}
          <div style={{ position:'absolute', top:8, left:16, fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em' }}>Main dining</div>
          <div style={{ position:'absolute', top:8, left:410, fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em' }}>Bar</div>
          <div style={{ position:'absolute', top:8, left:500, fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em' }}>Patio</div>
          <div style={{ position:'absolute', top:0, left:405, bottom:0, width:1, background:'var(--bdr)', opacity:.5 }}/>
          <div style={{ position:'absolute', top:0, left:495, bottom:0, width:1, background:'var(--bdr)', opacity:.5 }}/>

          {/* Tables */}
          {displayTables.map(table => {
            const isSelected = selected === table.id;
            const sColor = SECTION_COLORS[table.section] || '#888780';
            const isRound = table.shape === 'rd';
            const active = table.status === 'open' || table.status === 'occupied';

            return (
              <div
                key={table.id}
                onMouseDown={e => handleMouseDown(e, table.id)}
                onClick={() => setSelected(table.id === selected ? null : table.id)}
                style={{
                  position:'absolute',
                  left:table.x, top:table.y,
                  width:table.w, height:table.h,
                  borderRadius: isRound ? '50%' : 10,
                  background: active ? `${sColor}20` : 'var(--bg3)',
                  border:`${isSelected ? 2 : 1.5}px solid ${isSelected ? sColor : sColor + '60'}`,
                  boxShadow: isSelected ? `0 0 0 3px ${sColor}33, 0 2px 8px rgba(0,0,0,.1)` : '0 1px 4px rgba(0,0,0,.05)',
                  cursor: dragging === table.id ? 'grabbing' : 'grab',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:2, transition:'box-shadow .1s', userSelect:'none',
                }}
              >
                <div style={{ fontSize: table.w > 80 ? 12 : 10, fontWeight:800, color:sColor }}>{table.label}</div>
                <div style={{ fontSize:9, color:sColor, opacity:.7 }}>{table.maxCovers} cvr</div>
                {active && <div style={{ width:6, height:6, borderRadius:'50%', background:sColor, position:'absolute', top:4, right:4 }}/>}
              </div>
            );
          })}
        </div>
      </div>

      {showAddTable && <AddTableModal onClose={() => setShowAddTable(false)} onAdd={table => { addTableToLayout(table); showToast(`${table.label} added`, 'success'); setShowAddTable(false); }}/>}
    </div>
  );
}

function AddTableModal({ onAdd, onClose }) {
  const [label, setLabel] = useState('');
  const [maxCovers, setMaxCovers] = useState(4);
  const [shape, setShape] = useState('sq');
  const [section, setSection] = useState('main');

  const inp = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', display:'block', boxSizing:'border-box' };

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:380, boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800 }}>Add table</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Label</label><input style={inp} placeholder="T11, Bar stool, Banquette…" value={label} onChange={e => setLabel(e.target.value)} autoFocus/></div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Max covers</label>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={() => setMaxCovers(c => Math.max(1,c-1))} style={{ width:36, height:36, borderRadius:9, border:'1px solid var(--bdr2)', background:'var(--bg3)', color:'var(--t1)', fontSize:20, cursor:'pointer', fontFamily:'inherit' }}>−</button>
              <span style={{ fontSize:22, fontWeight:800, minWidth:30, textAlign:'center' }}>{maxCovers}</span>
              <button onClick={() => setMaxCovers(c => Math.min(20,c+1))} style={{ width:36, height:36, borderRadius:9, border:'1px solid var(--bdr2)', background:'var(--bg3)', color:'var(--t1)', fontSize:20, cursor:'pointer', fontFamily:'inherit' }}>+</button>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Shape</label>
            <div style={{ display:'flex', gap:6 }}>
              {SHAPES.map(s => <button key={s.id} onClick={() => setShape(s.id)} style={{ flex:1, padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, border:`1.5px solid ${shape === s.id ? 'var(--acc)' : 'var(--bdr)'}`, background: shape === s.id ? 'var(--acc-d)' : 'var(--bg3)', color: shape === s.id ? 'var(--acc)' : 'var(--t2)' }}>{s.label}</button>)}
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Section</label>
            <div style={{ display:'flex', gap:6 }}>
              {SECTIONS.map(s => <button key={s} onClick={() => setSection(s)} style={{ flex:1, padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, textTransform:'capitalize', border:`1.5px solid ${section === s ? SECTION_COLORS[s] : 'var(--bdr)'}`, background: section === s ? `${SECTION_COLORS[s]}22` : 'var(--bg3)', color: section === s ? SECTION_COLORS[s] : 'var(--t2)' }}>{s}</button>)}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-acc" style={{ flex:2, height:42 }} disabled={!label.trim()} onClick={() => onAdd({ label, maxCovers, shape, section, x:40, y:40, w: shape === 'rd' ? 72 : 72, h: shape === 'rd' ? 72 : 64 })}>Add to floor plan</button>
          </div>
        </div>
      </div>
    </div>
  );
}
