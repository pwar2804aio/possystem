import { useState, useMemo } from 'react';
import { useStore } from '../../store';
import { MENU_ITEMS, CATEGORIES, CAT_META, ALLERGENS } from '../../data/seed';

const inp = {
  width:'100%', background:'var(--bg3)', border:'1.5px solid var(--bdr2)',
  borderRadius:10, padding:'9px 12px', color:'var(--t1)', fontSize:13,
  fontFamily:'inherit', outline:'none', display:'block', boxSizing:'border-box',
};

export default function MenuManager() {
  const { eightySixIds, toggle86, showToast, dailyCounts, setDailyCount, markBOChange, menuItems: storeItems } = useStore();

  // Use store's editable menu — always reflects latest edits
  const ALL_ITEMS = storeItems || MENU_ITEMS;
  const [activeCat, setActiveCat] = useState('starters');
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | 86d

  const cats = CATEGORIES.filter(c => !c.isSpecial);

  const displayItems = useMemo(() => {
    let items = ALL_ITEMS.filter(i => i.cat === activeCat);
    if (search) items = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter === 'active') items = items.filter(i => !eightySixIds.includes(i.id));
    if (statusFilter === '86d') items = items.filter(i => eightySixIds.includes(i.id));
    return items;
  }, [activeCat, search, statusFilter, eightySixIds]);

  const catCounts = useMemo(() => {
    const m = {};
    CATEGORIES.filter(c => !c.isSpecial).forEach(c => {
      m[c.id] = ALL_ITEMS.filter(i => i.cat === c.id).length;
    });
    return m;
  }, []);

  const totalItems  = ALL_ITEMS.length;
  const total86     = eightySixIds.length;
  const totalActive = totalItems - total86;

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Category nav */}
      <div style={{
        width:190, borderRight:'1px solid var(--bdr)',
        padding:'12px 8px', flexShrink:0, overflowY:'auto',
        background:'var(--bg1)',
      }}>
        {/* Summary pills */}
        <div style={{ padding:'0 6px', marginBottom:14 }}>
          <div style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>Menu health</div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:'var(--grn-d)', border:'1px solid var(--grn-b)', color:'var(--grn)' }}>{totalActive} active</span>
            {total86 > 0 && <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20, background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)' }}>{total86} 86'd</span>}
          </div>
        </div>

        <div style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', padding:'0 6px', marginBottom:6 }}>Categories</div>
        {cats.map(c => {
          const m = CAT_META[c.id] || {};
          const active = activeCat === c.id;
          const count86 = ALL_ITEMS.filter(i => i.cat === c.id && eightySixIds.includes(i.id)).length;
          return (
            <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
              width:'100%', padding:'8px 10px', borderRadius:9, cursor:'pointer',
              textAlign:'left', fontSize:13, fontWeight: active ? 700 : 400,
              border:'none', fontFamily:'inherit',
              background: active ? 'var(--acc-d)' : 'transparent',
              color: active ? 'var(--acc)' : 'var(--t2)',
              marginBottom:1, display:'flex', alignItems:'center', justifyContent:'space-between',
              borderLeft:`2px solid ${active ? m.color || 'var(--acc)' : 'transparent'}`,
            }}>
              <span>{m.icon} {c.label}</span>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {count86 > 0 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:10, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)' }}>{count86}</span>}
                <span style={{ fontSize:10, color:'var(--t4)' }}>{catCounts[c.id]}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Items table */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Toolbar */}
        <div style={{
          padding:'10px 18px', borderBottom:'1px solid var(--bdr)',
          display:'flex', alignItems:'center', gap:10, flexShrink:0,
          background:'var(--bg1)',
        }}>
          <div style={{ position:'relative', flex:1, maxWidth:320 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:13, pointerEvents:'none' }}>🔍</span>
            <input
              style={{ ...inp, paddingLeft:32 }}
              placeholder="Search items…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Status filter */}
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:9, padding:3 }}>
            {[['all','All'], ['active','Active'], ['86d','86\'d']].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)} style={{
                padding:'4px 12px', borderRadius:7, cursor:'pointer', fontFamily:'inherit',
                background: statusFilter === v ? 'var(--bg1)' : 'transparent',
                border: statusFilter === v ? '1px solid var(--bdr2)' : '1px solid transparent',
                color: statusFilter === v ? 'var(--t1)' : 'var(--t3)',
                fontSize:11, fontWeight: statusFilter === v ? 700 : 500, transition:'all .1s',
              }}>{l}</button>
            ))}
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <button onClick={() => setShowAdd(true)} style={{
              padding:'7px 16px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
              background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700,
            }}>+ Add item</button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {displayItems.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:'var(--t3)' }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:.3 }}>🍽</div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)' }}>No items</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg2)', position:'sticky', top:0, zIndex:1 }}>
                  {['Item', 'Price', 'Type', 'Allergens', 'Daily count', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding:'10px 16px', textAlign:'left',
                      fontSize:10, fontWeight:800, color:'var(--t4)',
                      textTransform:'uppercase', letterSpacing:'.07em',
                      borderBottom:'1px solid var(--bdr)', whiteSpace:'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => {
                  const is86 = eightySixIds.includes(item.id);
                  const count = dailyCounts[item.id];
                  const fromPrice = item.type === 'variants'
                    ? Math.min(...item.variants.map(v => v.price))
                    : item.price;
                  const allergenIcons = item.allergens?.map(a => ALLERGENS.find(x => x.id === a)?.icon).filter(Boolean).join(' ') || '';

                  return (
                    <tr key={item.id} style={{
                      borderBottom:'1px solid var(--bdr)',
                      background: idx % 2 === 0 ? 'var(--bg)' : 'var(--bg1)',
                      opacity: is86 ? .5 : 1,
                    }}>
                      <td style={{ padding:'12px 16px', maxWidth:240 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>{item.name}</div>
                        <div style={{ fontSize:11, color:'var(--t3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>{item.description}</div>
                      </td>
                      <td style={{ padding:'12px 16px', fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--acc)', whiteSpace:'nowrap' }}>
                        {item.type === 'variants' ? `from £${fromPrice.toFixed(2)}` : `£${fromPrice.toFixed(2)}`}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t3)' }}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:14 }}>
                        {allergenIcons || <span style={{ color:'var(--t4)', fontSize:11 }}>none</span>}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        {count ? (
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{
                              fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                              background: count.remaining <= 3 ? 'var(--acc-d)' : 'var(--grn-d)',
                              border:`1px solid ${count.remaining <= 3 ? 'var(--acc-b)' : 'var(--grn-b)'}`,
                              color: count.remaining <= 3 ? 'var(--acc)' : 'var(--grn)',
                            }}>
                              {count.remaining}/{count.par}
                            </span>
                            <button onClick={() => { useStore.getState().clearDailyCount(item.id); showToast('Count cleared', 'info'); }} style={{ fontSize:10, color:'var(--t4)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditItem({ ...item, _countMode: true })} style={{ fontSize:11, color:'var(--t4)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>Set count</button>
                        )}
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{
                          fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:20,
                          background: is86 ? 'var(--red-d)' : 'var(--grn-d)',
                          border:`1px solid ${is86 ? 'var(--red-b)' : 'var(--grn-b)'}`,
                          color: is86 ? 'var(--red)' : 'var(--grn)',
                        }}>{is86 ? "86'd" : 'Active'}</span>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => setEditItem(item)} style={{
                            padding:'4px 10px', borderRadius:7, cursor:'pointer',
                            fontFamily:'inherit', background:'var(--bg3)',
                            border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:11, fontWeight:600,
                          }}>Edit</button>
                          <button onClick={() => { toggle86(item.id); markBOChange(); showToast(is86 ? `${item.name} reinstated` : `${item.name} 86'd`, 'warning'); }} style={{
                            padding:'4px 10px', borderRadius:7, cursor:'pointer',
                            fontFamily:'inherit',
                            background: is86 ? 'var(--grn-d)' : 'var(--red-d)',
                            border:`1px solid ${is86 ? 'var(--grn-b)' : 'var(--red-b)'}`,
                            color: is86 ? 'var(--grn)' : 'var(--red)', fontSize:11, fontWeight:600,
                          }}>{is86 ? 'Reinstate' : '86'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        <div style={{ padding:'8px 18px', borderTop:'1px solid var(--bdr)', fontSize:11, color:'var(--t4)', background:'var(--bg1)', flexShrink:0 }}>
          {displayItems.length} item{displayItems.length !== 1 ? 's' : ''} shown
          {search && <> · searching "<strong style={{ color:'var(--t2)' }}>{search}</strong>"</>}
        </div>
      </div>

      {/* Edit modal */}
      {editItem && <EditItemModal item={editItem} onClose={() => setEditItem(null)} />}
      {showAdd  && <AddItemModal  cat={activeCat} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ── Edit item modal ───────────────────────────────────────────────────────────
function EditItemModal({ item, onClose }) {
  const { showToast, setDailyCount, toggle86, eightySixIds, updateMenuItem, markBOChange } = useStore();
  const [tab, setTab] = useState(item._countMode ? 'count' : 'details');
  const [name, setName]         = useState(item.name);
  const [price, setPrice]       = useState(String(item.price || ''));
  const [desc, setDesc]         = useState(item.description || '');
  const [allergens, setAllergens] = useState([...(item.allergens || [])]);
  const [modGroups, setModGroups] = useState(
    item.modifierGroups ? JSON.parse(JSON.stringify(item.modifierGroups)) : []
  );
  const is86 = eightySixIds.includes(item.id);

  const toggleA = (id) => setAllergens(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  const handleSave = () => {
    const patch = { name: name.trim(), description: desc, allergens, modifierGroups: modGroups };
    if (item.type !== 'variants' && price) patch.price = parseFloat(price);
    // If has modifier groups and was simple, upgrade type
    if (modGroups.length > 0 && item.type === 'simple') patch.type = 'modifiers';
    if (modGroups.length === 0 && item.type === 'modifiers') patch.type = 'simple';
    updateMenuItem(item.id, patch);
    markBOChange();
    showToast(`${name} updated — push to POS to go live`, 'success');
    onClose();
  };

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20,
        width:'100%', maxWidth:560, maxHeight:'90vh',
        display:'flex', flexDirection:'column',
        boxShadow:'var(--sh3)', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px 0', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)' }}>Edit — {item.name}</div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
          </div>
          <div style={{ display:'flex', gap:0 }}>
            {[['details','Details'], ['modifiers',`Modifiers${modGroups.length ? ` (${modGroups.length})` : ''}`], ['allergens','Allergens'], ['count','Daily count']].map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:'8px 14px', cursor:'pointer', fontFamily:'inherit',
                border:'none', borderBottom:`2.5px solid ${tab === t ? 'var(--acc)' : 'transparent'}`,
                background:'transparent', color: tab === t ? 'var(--acc)' : 'var(--t3)',
                fontSize:12, fontWeight: tab === t ? 800 : 500, transition:'all .1s',
              }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          {/* Details tab */}
          {tab === 'details' && (
            <>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Name</label>
                <input style={{width:'100%',background:'var(--bg3)',border:'1.5px solid var(--bdr2)',borderRadius:10,padding:'9px 12px',color:'var(--t1)',fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}} value={name} onChange={e=>setName(e.target.value)}/>
              </div>
              {item.type !== 'variants' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Price (£)</label>
                  <input style={{width:'100%',background:'var(--bg3)',border:'1.5px solid var(--bdr2)',borderRadius:10,padding:'9px 12px',color:'var(--t1)',fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}} type="number" step="0.01" min="0" value={price} onChange={e=>setPrice(e.target.value)}/>
                </div>
              )}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Description</label>
                <textarea style={{width:'100%',background:'var(--bg3)',border:'1.5px solid var(--bdr2)',borderRadius:10,padding:'9px 12px',color:'var(--t1)',fontSize:13,fontFamily:'inherit',outline:'none',resize:'none',height:72,boxSizing:'border-box'}} value={desc} onChange={e=>setDesc(e.target.value)}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Status</label>
                <button onClick={() => { toggle86(item.id); markBOChange(); showToast(is86 ? `${item.name} reinstated` : `${item.name} 86'd`, 'warning'); onClose(); }} style={{
                  padding:'8px 16px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
                  background: is86 ? 'var(--grn-d)' : 'var(--red-d)',
                  border:`1px solid ${is86 ? 'var(--grn-b)' : 'var(--red-b)'}`,
                  color: is86 ? 'var(--grn)' : 'var(--red)', fontSize:13, fontWeight:700,
                }}>{is86 ? '✓ Reinstate item' : '⊘ 86 this item'}</button>
              </div>
            </>
          )}

          {/* Modifiers tab */}
          {tab === 'modifiers' && (
            <ModifiersEditor groups={modGroups} onChange={setModGroups}/>
          )}

          {/* Allergens tab */}
          {tab === 'allergens' && (
            <>
              <div style={{ fontSize:12, color:'var(--t3)', marginBottom:14, lineHeight:1.5 }}>
                All 14 EU/UK mandatory allergens. Toggle to declare. Changes logged in the audit trail.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {ALLERGENS.map(a => {
                  const active = allergens.includes(a.id);
                  return (
                    <button key={a.id} onClick={() => toggleA(a.id)} style={{
                      padding:'10px 14px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                      background: active ? 'var(--red-d)' : 'var(--bg3)',
                      border:`1.5px solid ${active ? 'var(--red)' : 'var(--bdr)'}`,
                      color: active ? 'var(--red)' : 'var(--t2)',
                      display:'flex', alignItems:'center', gap:8, transition:'all .1s',
                    }}>
                      <span style={{ fontSize:16 }}>{a.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{a.label}</div>
                        {active && <div style={{ fontSize:10, color:'var(--red)', opacity:.8 }}>declared</div>}
                      </div>
                      <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${active ? 'var(--red)' : 'var(--bdr2)'}`, background: active ? 'var(--red)' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {active && <span style={{ color:'#fff', fontSize:10, fontWeight:800 }}>✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Daily count tab */}
          {tab === 'count' && (
            <DailyCountEditor item={item} onDone={onClose}/>
          )}
        </div>

        {tab !== 'count' && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8, flexShrink:0 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-acc" style={{ flex:2, height:42 }} onClick={handleSave}>Save changes</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modifiers editor ──────────────────────────────────────────────────────────
function ModifiersEditor({ groups, onChange }) {
  const [editingGroup, setEditingGroup] = useState(null); // index being edited, or 'new'
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMulti, setNewGroupMulti] = useState(false);

  const addGroup = () => {
    if (!newGroupLabel.trim()) return;
    const g = {
      id: `mg-${Date.now()}`,
      label: newGroupLabel.trim(),
      required: newGroupRequired,
      multi: newGroupMulti,
      options: [],
    };
    onChange([...groups, g]);
    setNewGroupLabel(''); setNewGroupRequired(false); setNewGroupMulti(false);
    setEditingGroup(groups.length); // open the new group to add options
  };

  const removeGroup = (i) => onChange(groups.filter((_,idx)=>idx!==i));

  const updateGroup = (i, patch) => {
    const updated = groups.map((g,idx)=>idx===i?{...g,...patch}:g);
    onChange(updated);
  };

  const addOption = (gi) => {
    const g = groups[gi];
    const updated = groups.map((grp,idx)=>idx===gi?{...grp,options:[...grp.options,{id:`opt-${Date.now()}`,label:'',price:0}]}:grp);
    onChange(updated);
  };

  const updateOption = (gi, oi, patch) => {
    const updated = groups.map((g,gi2)=>gi2===gi?{...g,options:g.options.map((o,oi2)=>oi2===oi?{...o,...patch}:o)}:g);
    onChange(updated);
  };

  const removeOption = (gi, oi) => {
    const updated = groups.map((g,gi2)=>gi2===gi?{...g,options:g.options.filter((_,oi2)=>oi2!==oi)}:g);
    onChange(updated);
  };

  const inp = { background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:8, padding:'6px 10px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none' };

  return (
    <div>
      <div style={{ fontSize:12, color:'var(--t3)', marginBottom:16, lineHeight:1.5 }}>
        Modifier groups appear as customer choices when ordering — "Cooking preference", "Sauce", "Size". Options can add to the base price.
      </div>

      {/* Existing groups */}
      {groups.length === 0 && (
        <div style={{ textAlign:'center', padding:'24px 0', color:'var(--t4)', fontSize:12, marginBottom:16 }}>
          No modifier groups. Add one below to enable upsells and choices.
        </div>
      )}

      {groups.map((g, gi) => (
        <div key={g.id} style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:12, marginBottom:10, overflow:'hidden' }}>
          {/* Group header */}
          <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderBottom: editingGroup===gi ? '1px solid var(--bdr)' : 'none' }}
            onClick={() => setEditingGroup(editingGroup===gi?null:gi)}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{g.label}</div>
              <div style={{ fontSize:11, color:'var(--t4)', marginTop:1 }}>
                {g.required?'Required':'Optional'} · {g.multi?'Multi-select':'Pick one'} · {g.options.length} option{g.options.length!==1?'s':''}
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {g.required && <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:20, background:'var(--acc-d)', border:'1px solid var(--acc-b)', color:'var(--acc)' }}>REQUIRED</span>}
              <span style={{ fontSize:13, color:'var(--t3)' }}>{editingGroup===gi?'▲':'▼'}</span>
            </div>
          </div>

          {/* Group edit expanded */}
          {editingGroup === gi && (
            <div style={{ padding:'12px 14px' }}>
              {/* Group settings */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, marginBottom:12, alignItems:'center' }}>
                <input style={{...inp, width:'100%', boxSizing:'border-box'}} value={g.label} onChange={e=>updateGroup(gi,{label:e.target.value})} placeholder="Group name"/>
                <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t2)', cursor:'pointer', whiteSpace:'nowrap' }}>
                  <input type="checkbox" checked={g.required} onChange={e=>updateGroup(gi,{required:e.target.checked})} style={{ accentColor:'var(--acc)' }}/>
                  Required
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t2)', cursor:'pointer', whiteSpace:'nowrap' }}>
                  <input type="checkbox" checked={g.multi} onChange={e=>updateGroup(gi,{multi:e.target.checked})} style={{ accentColor:'var(--acc)' }}/>
                  Multi-select
                </label>
              </div>

              {/* Options */}
              <div style={{ marginBottom:8 }}>
                {g.options.map((opt, oi) => (
                  <div key={opt.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px auto', gap:6, marginBottom:5, alignItems:'center' }}>
                    <input style={{...inp, boxSizing:'border-box'}} value={opt.label} onChange={e=>updateOption(gi,oi,{label:e.target.value})} placeholder="Option name"/>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--t4)' }}>£</span>
                      <input type="number" step="0.50" min="0" style={{...inp, width:'100%', paddingLeft:20, boxSizing:'border-box'}} value={opt.price||0} onChange={e=>updateOption(gi,oi,{price:parseFloat(e.target.value)||0})}/>
                    </div>
                    <button onClick={()=>removeOption(gi,oi)} style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', fontSize:14, flexShrink:0 }}>×</button>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>addOption(gi)} style={{ flex:1, padding:'6px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg4)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>+ Add option</button>
                <button onClick={()=>removeGroup(gi)} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11, fontWeight:700 }}>Remove group</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new group */}
      <div style={{ background:'var(--bg1)', border:'1.5px dashed var(--bdr2)', borderRadius:12, padding:'14px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>Add modifier group</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center', marginBottom:8 }}>
          <input style={{...inp, boxSizing:'border-box', width:'100%'}} value={newGroupLabel} onChange={e=>setNewGroupLabel(e.target.value)} placeholder="e.g. Cooking preference, Sauce, Size" onKeyDown={e=>e.key==='Enter'&&addGroup()}/>
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t2)', cursor:'pointer', whiteSpace:'nowrap' }}>
            <input type="checkbox" checked={newGroupRequired} onChange={e=>setNewGroupRequired(e.target.checked)} style={{ accentColor:'var(--acc)' }}/>
            Required
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--t2)', cursor:'pointer', whiteSpace:'nowrap' }}>
            <input type="checkbox" checked={newGroupMulti} onChange={e=>setNewGroupMulti(e.target.checked)} style={{ accentColor:'var(--acc)' }}/>
            Multi
          </label>
        </div>
        <button onClick={addGroup} disabled={!newGroupLabel.trim()} style={{ width:'100%', padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background: newGroupLabel.trim()?'var(--acc)':'var(--bg3)', border:'none', color: newGroupLabel.trim()?'#0b0c10':'var(--t4)', fontSize:12, fontWeight:700 }}>
          + Add group
        </button>
      </div>
    </div>
  );
}

function DailyCountEditor({ item, onDone }) {
  const { setDailyCount, clearDailyCount, dailyCounts, showToast } = useStore();
  const [val, setVal] = useState('');
  const current = dailyCounts[item.id];
  const press = d => { if (d === '⌫') { setVal(p => p.slice(0,-1)); } else if (val.length < 3) { setVal(p => p + d); } };

  return (
    <div>
      {current && (
        <div style={{ marginBottom:16, padding:'12px 14px', borderRadius:12, background: current.remaining <= 3 ? 'var(--acc-d)' : 'var(--grn-d)', border:`1px solid ${current.remaining <= 3 ? 'var(--acc-b)' : 'var(--grn-b)'}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color: current.remaining <= 3 ? 'var(--acc)' : 'var(--grn)' }}>{current.remaining <= 0 ? 'Sold out' : current.remaining <= 3 ? 'Running low' : 'In stock'}</div>
              <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>Par: {current.par} · Remaining: {current.remaining}</div>
            </div>
            <div style={{ fontSize:32, fontWeight:800, fontFamily:'var(--font-mono)', color: current.remaining <= 3 ? 'var(--acc)' : 'var(--grn)' }}>{current.remaining}</div>
          </div>
          <div style={{ height:4, background:'var(--bg4)', borderRadius:2, marginTop:10, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${Math.min(100,(current.remaining/current.par)*100)}%`, background: current.remaining <= 3 ? 'var(--acc)' : 'var(--grn)', borderRadius:2, transition:'width .3s' }}/>
          </div>
        </div>
      )}
      <div style={{ height:56, borderRadius:12, border:'2px solid var(--acc-b)', background:'var(--acc-d)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
        <span style={{ fontSize:32, fontWeight:800, color: val ? 'var(--acc)' : 'var(--t4)', fontFamily:'var(--font-mono)' }}>{val || '—'}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:10 }}>
        {[7,8,9,4,5,6,1,2,3,'',0,'⌫'].map((d,i) => (
          <button key={i} onClick={() => d !== '' && press(String(d))} style={{
            height:44, borderRadius:9, cursor: d === '' ? 'default' : 'pointer', fontFamily:'inherit',
            background: d === '⌫' ? 'var(--red-d)' : d === '' ? 'transparent' : 'var(--bg3)',
            border: d === '' ? 'none' : `1px solid ${d === '⌫' ? 'var(--red-b)' : 'var(--bdr)'}`,
            color: d === '⌫' ? 'var(--red)' : 'var(--t1)',
            fontSize: d === '⌫' ? 16 : 17, fontWeight:700, opacity: d === '' ? 0 : 1,
          }}>{d}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {[4,6,8,10,12,16,20,24].map(n => (
          <button key={n} onClick={() => setVal(String(n))} style={{
            flex:1, height:28, borderRadius:7, cursor:'pointer', fontFamily:'inherit',
            background: val === String(n) ? 'var(--acc-d)' : 'var(--bg3)',
            border:`1px solid ${val === String(n) ? 'var(--acc)' : 'var(--bdr)'}`,
            color: val === String(n) ? 'var(--acc)' : 'var(--t3)', fontSize:10, fontWeight:700,
          }}>{n}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        {current && <button onClick={() => { clearDailyCount(item.id); showToast('Count cleared', 'info'); onDone(); }} style={{ flex:1, height:38, borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>Clear</button>}
        <button onClick={() => { if (val) { setDailyCount(item.id, parseInt(val)); showToast(`Count set to ${val}`, 'success'); onDone(); } }} disabled={!val} style={{ flex:2, height:38, borderRadius:9, cursor:'pointer', fontFamily:'inherit', background: val ? 'var(--acc)' : 'var(--bg3)', border:'none', color: val ? '#0b0c10' : 'var(--t4)', fontSize:13, fontWeight:800 }}>
          {val ? `Set ${val} portions` : 'Enter a number'}
        </button>
      </div>
    </div>
  );
}

// ── Add item modal ─────────────────────────────────────────────────────────────
function AddItemModal({ cat, onClose }) {
  const { showToast, addMenuItem, markBOChange } = useStore();
  const [name, setName]   = useState('');
  const [price, setPrice] = useState('');
  const [desc, setDesc]   = useState('');
  const [allergens, setAllergens] = useState([]);
  const toggleA = id => setAllergens(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);

  const handleAdd = () => {
    if (!name.trim() || !price) return;
    addMenuItem({
      name: name.trim(),
      description: desc,
      price: parseFloat(price),
      cat,
      allergens,
      type: 'single',
    });
    markBOChange();
    showToast(`${name} added — push to POS to go live`, 'success');
    onClose();
  };

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:460, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800 }}>New item — {CATEGORIES.find(c => c.id === cat)?.label}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Name *</label><input style={inp} placeholder="Item name" value={name} onChange={e => setName(e.target.value)} autoFocus/></div>
          <div style={{ marginBottom:12 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Price (£) *</label><input style={inp} type="number" step="0.01" min="0" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}/></div>
          <div style={{ marginBottom:16 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Description</label><textarea style={{ ...inp, resize:'none', height:64 }} placeholder="Short description shown on POS and receipts" value={desc} onChange={e => setDesc(e.target.value)}/></div>
          <div style={{ marginBottom:4 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:8 }}>Allergens (select all that apply)</label>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {ALLERGENS.map(a => {
                const on = allergens.includes(a.id);
                return <button key={a.id} onClick={() => toggleA(a.id)} style={{ padding:'4px 10px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:600, background: on ? 'var(--red-d)' : 'var(--bg3)', border:`1px solid ${on ? 'var(--red)' : 'var(--bdr)'}`, color: on ? 'var(--red)' : 'var(--t3)', transition:'all .1s' }}>{a.icon} {a.label}</button>;
              })}
            </div>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8 }}>
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:2, height:42 }} disabled={!name.trim() || !price} onClick={handleAdd}>Add to menu</button>
        </div>
      </div>
    </div>
  );
}
