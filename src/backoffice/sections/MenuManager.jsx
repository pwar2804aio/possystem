/**
 * MenuManager — three-mode menu management system
 *
 * Mode 1: Items    — category tree + item list + item editor panel
 * Mode 2: Modifiers — modifier library + group builder
 * Mode 3: Builder  — full-page interactive POS preview with drag-and-drop
 */
import { useState, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../../store';
import { ALLERGENS, PRODUCTION_CENTRES, CATEGORIES as SEED_CATS } from '../../data/seed';

// ── shared styles ──────────────────────────────────────────────────────────
const S = {
  inp: { background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:9, padding:'8px 11px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', width:'100%' },
  lbl: { display:'block', fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 },
  pill: (active, color='var(--acc)') => ({
    padding:'4px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', fontSize:11,
    fontWeight:active?800:400, border:`1.5px solid ${active?color:'var(--bdr)'}`,
    background:active?`${color}22`:'var(--bg3)', color:active?color:'var(--t3)', transition:'all .1s',
  }),
};

const ORDER_TYPES = [
  { id:'dineIn',     label:'Dine-in',    icon:'🍽', color:'#3b82f6' },
  { id:'takeaway',   label:'Takeaway',   icon:'🥡', color:'#e8a020' },
  { id:'collection', label:'Collection', icon:'📦', color:'#22c55e' },
  { id:'delivery',   label:'Delivery',   icon:'🛵', color:'#a855f7' },
];

const ITEM_TYPES = [
  { id:'simple',    label:'Simple',   icon:'⬛', desc:'Fixed price' },
  { id:'modifiers', label:'Modifiers',icon:'⊕',  desc:'Choices & extras' },
  { id:'variants',  label:'Variants', icon:'▾',  desc:'Sizes' },
  { id:'pizza',     label:'Pizza',    icon:'🍕', desc:'Custom builder' },
  { id:'bundle',    label:'Bundle',   icon:'📦', desc:'Set menu' },
];

const MOD_SELECTION_TYPES = [
  { id:'single',   label:'Pick one',        desc:'Radio — customer selects exactly one option' },
  { id:'multiple', label:'Pick any',         desc:'Checkboxes — tick as many as wanted' },
  { id:'quantity', label:'Specify quantity', desc:'Quantity per option (for pizza toppings etc.)' },
];

// ── Root component ─────────────────────────────────────────────────────────
export default function MenuManager() {
  const [mode, setMode] = useState('items'); // items | modifiers | builder

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Mode switcher */}
      <div style={{ padding:'0 20px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:0, flexShrink:0, height:44 }}>
        {[
          { id:'items',     label:'📋 Items',    desc:'Manage menu items' },
          { id:'modifiers', label:'⊕ Modifiers', desc:'Modifier library & groups' },
          { id:'builder',   label:'⬚ Builder',   desc:'Visual menu builder' },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding:'0 20px', height:44, cursor:'pointer', fontFamily:'inherit',
            border:'none', borderBottom:`2.5px solid ${mode===m.id?'var(--acc)':'transparent'}`,
            background:'transparent', color:mode===m.id?'var(--acc)':'var(--t3)',
            fontSize:13, fontWeight:mode===m.id?800:500, transition:'all .1s', display:'flex', alignItems:'center',
          }} title={m.desc}>{m.label}</button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--t4)' }}>Changes stage until Push to POS →</span>
        </div>
      </div>

      {mode === 'items'     && <ItemsMode />}
      {mode === 'modifiers' && <ModifiersMode />}
      {mode === 'builder'   && <BuilderMode />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE 1 — Items
// ══════════════════════════════════════════════════════════════════════════════
function ItemsMode() {
  const {
    menuCategories, addCategory, updateCategory, removeCategory, reorderCategories,
    menuItems, addMenuItem, updateMenuItem, archiveMenuItem, duplicateMenuItem,
    reorderMenuItems, eightySixIds, toggle86, markBOChange, showToast,
  } = useStore();

  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [search, setSearch] = useState('');
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const dragCatRef = useRef(null);
  const dragItemRef = useRef(null);

  const rootCats = useMemo(() =>
    menuCategories.filter(c => !c.parentId && !c.isSpecial).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)),
    [menuCategories]
  );

  const displayItems = useMemo(() => {
    let items = menuItems.filter(i => !i.archived);
    if (search) {
      const q = search.toLowerCase();
      return items.filter(i => (i.menuName||i.name||'').toLowerCase().includes(q));
    }
    if (selectedCatId) {
      const childIds = menuCategories.filter(c=>c.parentId===selectedCatId).map(c=>c.id);
      items = items.filter(i => i.cat===selectedCatId || childIds.includes(i.cat));
    }
    return items.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
  }, [menuItems, selectedCatId, search, menuCategories]);

  const selectedItem = menuItems.find(i => i.id === selectedItemId);

  // Category drag
  const catDragStart = (e, idx) => { dragCatRef.current = idx; e.dataTransfer.effectAllowed='move'; };
  const catDragOver  = e => e.preventDefault();
  const catDrop      = (e, toIdx) => { if(dragCatRef.current!==null && dragCatRef.current!==toIdx){ reorderCategories(dragCatRef.current, toIdx); } dragCatRef.current=null; };

  // Item drag (within same category)
  const itemDragStart = (e, idx) => { dragItemRef.current = idx; e.dataTransfer.effectAllowed='move'; };
  const itemDragOver  = e => e.preventDefault();
  const itemDrop      = (e, toIdx) => {
    if(dragItemRef.current!==null && dragItemRef.current!==toIdx && selectedCatId){
      reorderMenuItems(selectedCatId, dragItemRef.current, toIdx);
      markBOChange();
    }
    dragItemRef.current=null;
  };

  const handleAddItem = () => {
    const newItem = addMenuItem({ name:'New item', menuName:'New item', receiptName:'New item', kitchenName:'New item', cat:selectedCatId||rootCats[0]?.id||'starters', type:'simple', allergens:[], modifierGroups:[], pricing:{base:0,dineIn:null,takeaway:null,collection:null,delivery:null} });
    markBOChange();
    setTimeout(() => setSelectedItemId(useStore.getState().menuItems.slice(-1)[0]?.id), 50);
  };

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
      {/* ── Left: Category tree ── */}
      <div style={{ width:220, borderRight:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em' }}>Categories</span>
          <button onClick={() => { setEditingCat(null); setShowCatModal(true); }} style={{ fontSize:11, fontWeight:700, color:'var(--acc)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>+ Add</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {/* All */}
          <button onClick={() => { setSelectedCatId(null); setSelectedItemId(null); }} style={{ ...btnStyle(!selectedCatId && !search), width:'100%', marginBottom:2, justifyContent:'space-between' }}>
            <span>All items</span>
            <span style={{ fontSize:10, color:'var(--t4)' }}>{menuItems.filter(i=>!i.archived).length}</span>
          </button>
          {rootCats.map((cat, idx) => (
            <CatRow key={cat.id} cat={cat} idx={idx} selectedCatId={selectedCatId} menuCategories={menuCategories} menuItems={menuItems}
              onSelect={id => { setSelectedCatId(id); setSelectedItemId(null); }}
              onEdit={c => { setEditingCat(c); setShowCatModal(true); }}
              onAddSub={pid => { setEditingCat({ _parentId:pid }); setShowCatModal(true); }}
              onDragStart={catDragStart} onDragOver={catDragOver} onDrop={catDrop}
            />
          ))}
        </div>
      </div>

      {/* ── Center: Item list ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {/* Toolbar */}
        <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <div style={{ position:'relative', flex:1, maxWidth:280 }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:13 }}>🔍</span>
            <input style={{ ...S.inp, paddingLeft:28 }} placeholder="Search items…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <button onClick={() => { setShowCatModal(true); setEditingCat(selectedCatId ? { _parentId:selectedCatId } : null); }} style={{ ...outlineBtn }}>+ Category</button>
            <button onClick={handleAddItem} style={{ ...primaryBtn }}>+ Item</button>
          </div>
        </div>

        {/* Item table */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {displayItems.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t4)' }}>
              <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>🍽</div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)' }}>No items</div>
              <div style={{ fontSize:12, marginTop:4 }}>
                {search ? `No results for "${search}"` : 'Click "+ Item" to add the first item'}
              </div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg2)', position:'sticky', top:0, zIndex:1 }}>
                  <th style={thStyle}>⣿</th>
                  <th style={thStyle}>Item</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Base £</th>
                  <th style={thStyle}>Dine-in £</th>
                  <th style={thStyle}>Takeaway £</th>
                  <th style={thStyle}>Delivery £</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => {
                  const is86 = eightySixIds.includes(item.id);
                  const sel  = selectedItemId === item.id;
                  const p    = item.pricing || { base:item.price||0 };
                  const cat  = menuCategories.find(c=>c.id===item.cat);

                  return (
                    <tr key={item.id}
                      draggable
                      onDragStart={e=>itemDragStart(e,idx)}
                      onDragOver={itemDragOver}
                      onDrop={e=>itemDrop(e,idx)}
                      onClick={() => setSelectedItemId(sel ? null : item.id)}
                      style={{ borderBottom:'1px solid var(--bdr)', background:sel?'var(--acc-d)':idx%2===0?'var(--bg)':'var(--bg1)', cursor:'pointer', opacity:is86?.5:1 }}>
                      <td style={{ padding:'0 6px', color:'var(--t4)', fontSize:12, cursor:'grab' }}>⣿</td>
                      <td style={{ padding:'9px 12px' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:sel?'var(--acc)':'var(--t1)' }}>{item.menuName||item.name}</div>
                        {cat && <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{cat.icon} {cat.label}</div>}
                      </td>
                      <td style={{ padding:'9px 12px' }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t4)' }}>
                          {ITEM_TYPES.find(t=>t.id===item.type)?.icon} {item.type||'simple'}
                        </span>
                      </td>
                      {['base','dineIn','takeaway','delivery'].map(k => (
                        <td key={k} style={{ padding:'9px 8px' }}>
                          <input type="number" step="0.01" min="0"
                            style={{ width:70, background:'transparent', border:'none', borderBottom:'1px solid var(--bdr)', color:k==='base'?'var(--acc)':'var(--t2)', fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, outline:'none', padding:'2px 4px' }}
                            value={p[k]!==null&&p[k]!==undefined ? p[k] : ''}
                            placeholder={k!=='base'?`${p.base||0}`:undefined}
                            onClick={e=>e.stopPropagation()}
                            onChange={e => {
                              const val = e.target.value === '' ? null : parseFloat(e.target.value);
                              updateMenuItem(item.id, { pricing: { ...p, [k]: val } });
                              markBOChange();
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ padding:'9px 8px' }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:is86?'var(--red-d)':'var(--grn-d)', border:`1px solid ${is86?'var(--red-b)':'var(--grn-b)'}`, color:is86?'var(--red)':'var(--grn)' }}>
                          {is86?"86'd":'Active'}
                        </span>
                      </td>
                      <td style={{ padding:'9px 8px' }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={() => { duplicateMenuItem(item.id); markBOChange(); showToast('Duplicated','success'); }} style={iconBtn} title="Duplicate">⧉</button>
                          <button onClick={() => { toggle86(item.id); markBOChange(); }} style={iconBtn} title={is86?'Reinstate':'86'}>{is86?'✓':'⊘'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding:'6px 14px', borderTop:'1px solid var(--bdr)', fontSize:11, color:'var(--t4)', background:'var(--bg1)', flexShrink:0 }}>
          {displayItems.length} items · Drag rows to reorder · Click to edit in panel →
          <span style={{ marginLeft:12, color:'var(--t3)' }}>Pricing columns: blank = inherit base price</span>
        </div>
      </div>

      {/* ── Right: Item editor ── */}
      {selectedItem ? (
        <ItemEditorPanel
          key={selectedItem.id}
          item={selectedItem}
          categories={menuCategories}
          onUpdate={(patch) => { updateMenuItem(selectedItem.id, patch); markBOChange(); }}
          onArchive={() => { archiveMenuItem(selectedItem.id); setSelectedItemId(null); markBOChange(); showToast('Archived','info'); }}
          onClose={() => setSelectedItemId(null)}
          eightySixIds={eightySixIds}
          toggle86={() => { toggle86(selectedItem.id); markBOChange(); }}
        />
      ) : (
        <div style={{ width:340, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <div style={{ textAlign:'center', color:'var(--t4)', padding:24 }}>
            <div style={{ fontSize:32, marginBottom:8, opacity:.3 }}>→</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>Select an item to edit</div>
          </div>
        </div>
      )}

      {/* Category modal */}
      {showCatModal && (
        <CategoryModal
          cat={editingCat}
          categories={menuCategories}
          onSave={cat => {
            if (editingCat?.id) { updateCategory(editingCat.id, cat); showToast('Category updated','success'); }
            else { addCategory({ menuId:'menu-1', ...cat }); showToast('Category added','success'); }
            markBOChange(); setShowCatModal(false); setEditingCat(null);
          }}
          onDelete={editingCat?.id ? () => { removeCategory(editingCat.id); markBOChange(); setShowCatModal(false); setEditingCat(null); if(selectedCatId===editingCat.id) setSelectedCatId(null); } : null}
          onClose={() => { setShowCatModal(false); setEditingCat(null); }}
        />
      )}
    </div>
  );
}

// ── CatRow ─────────────────────────────────────────────────────────────────
function CatRow({ cat, idx, selectedCatId, menuCategories, menuItems, onSelect, onEdit, onAddSub, onDragStart, onDragOver, onDrop }) {
  const [exp, setExp] = useState(false);
  const children = menuCategories.filter(c=>c.parentId===cat.id);
  const count    = menuItems.filter(i => !i.archived && (i.cat===cat.id || children.some(c=>c.id===i.cat))).length;
  const active   = selectedCatId===cat.id || children.some(c=>c.id===selectedCatId);

  return (
    <div draggable onDragStart={e=>onDragStart(e,idx)} onDragOver={onDragOver} onDrop={e=>onDrop(e,idx)}>
      <div style={{ display:'flex', alignItems:'center', cursor:'grab' }}>
        {children.length>0 && (
          <button onClick={()=>setExp(e=>!e)} style={{ width:16, background:'none', border:'none', cursor:'pointer', color:'var(--t4)', fontSize:10, padding:0, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {exp?'▾':'▸'}
          </button>
        )}
        <button onClick={()=>onSelect(cat.id)} onDoubleClick={()=>onEdit(cat)}
          style={{ ...btnStyle(active, cat.color), flex:1, justifyContent:'space-between', marginLeft:children.length?0:16, marginBottom:2 }}>
          <span>{cat.icon} {cat.label}</span>
          <span style={{ fontSize:10, color:'var(--t4)' }}>{count}</span>
        </button>
        <button onClick={()=>onEdit(cat)} style={{ width:20, background:'none', border:'none', cursor:'pointer', color:'var(--t4)', fontSize:11, padding:0, flexShrink:0 }} title="Edit category">✎</button>
      </div>
      {exp && children.map(sub => {
        const sc = menuItems.filter(i=>!i.archived&&i.cat===sub.id).length;
        return (
          <button key={sub.id} onClick={()=>onSelect(sub.id)}
            style={{ ...btnStyle(selectedCatId===sub.id, sub.color), width:'calc(100% - 24px)', marginLeft:24, marginBottom:1 }}>
            <span style={{ flex:1, textAlign:'left' }}>{sub.icon} {sub.label}</span>
            <span style={{ fontSize:9, color:'var(--t4)' }}>{sc}</span>
          </button>
        );
      })}
      {exp && <button onClick={()=>onAddSub(cat.id)} style={{ width:'calc(100% - 24px)', marginLeft:24, padding:'3px 8px', borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:10, border:'none', background:'transparent', color:'var(--t4)', textAlign:'left', marginBottom:2 }}>+ Subcategory</button>}
    </div>
  );
}

// ── Item editor panel ──────────────────────────────────────────────────────
function ItemEditorPanel({ item, categories, onUpdate, onArchive, onClose, eightySixIds, toggle86 }) {
  const { modifierLibrary } = useStore();
  const [tab, setTab] = useState('details');
  const is86 = eightySixIds.includes(item.id);
  const p = item.pricing || { base:item.price||0, dineIn:null, takeaway:null, collection:null, delivery:null };

  const TABS = ['details','pricing','modifiers','allergens','routing'];

  return (
    <div style={{ width:380, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'10px 14px 0', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{ flex:1, fontSize:14, fontWeight:800, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.menuName||item.name}</div>
          <button onClick={toggle86} style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', background:is86?'var(--grn-d)':'var(--red-d)', border:`1px solid ${is86?'var(--grn-b)':'var(--red-b)'}`, color:is86?'var(--grn)':'var(--red)' }}>{is86?'Reinstate':'86'}</button>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:18 }}>×</button>
        </div>
        <div style={{ display:'flex', gap:0, overflowX:'auto', marginBottom:-1 }}>
          {TABS.map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 12px', cursor:'pointer', fontFamily:'inherit', border:'none', borderBottom:`2.5px solid ${tab===t?'var(--acc)':'transparent'}`, background:'transparent', color:tab===t?'var(--acc)':'var(--t4)', fontSize:11, fontWeight:tab===t?800:500, whiteSpace:'nowrap', textTransform:'capitalize' }}>
              {t}{t==='modifiers' && item.modifierGroups?.length ? ` (${item.modifierGroups.length})` : ''}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
        {tab==='details'   && <DetailsTab   item={item} categories={categories} onUpdate={onUpdate}/>}
        {tab==='pricing'   && <PricingTab   item={item} pricing={p} onUpdate={onUpdate}/>}
        {tab==='modifiers' && <ModifiersTab item={item} onUpdate={onUpdate} library={modifierLibrary}/>}
        {tab==='allergens' && <AllergensTab item={item} onUpdate={onUpdate}/>}
        {tab==='routing'   && <RoutingTab   item={item} categories={categories} onUpdate={onUpdate}/>}
      </div>
      <div style={{ padding:'10px 14px', borderTop:'1px solid var(--bdr)', flexShrink:0 }}>
        <button onClick={() => { if(confirm('Archive this item?')) onArchive(); }} style={{ width:'100%', padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>Archive item</button>
      </div>
    </div>
  );
}

// ── Details tab ────────────────────────────────────────────────────────────
function DetailsTab({ item, categories, onUpdate }) {
  const f = (k,v) => onUpdate({ [k]:v });
  const rootCats = categories.filter(c=>!c.parentId&&!c.isSpecial);
  const subCats  = categories.filter(c=>c.parentId);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div>
        <div style={S.lbl}>Item type</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {ITEM_TYPES.map(t => (
            <button key={t.id} onClick={()=>f('type',t.id)} style={S.pill((item.type||'simple')===t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={S.lbl}>Menu name <span style={{ color:'var(--t4)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(shown on POS button)</span></div>
        <input style={S.inp} value={item.menuName||item.name||''} onChange={e=>f('menuName',e.target.value)} placeholder="e.g. Ribeye steak 8oz"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <div style={S.lbl}>Receipt name</div>
          <input style={S.inp} value={item.receiptName||''} onChange={e=>f('receiptName',e.target.value)} placeholder="Same as menu name"/>
        </div>
        <div>
          <div style={S.lbl}>Kitchen name (KDS)</div>
          <input style={S.inp} value={item.kitchenName||''} onChange={e=>f('kitchenName',e.target.value)} placeholder="Same as menu name"/>
        </div>
      </div>
      <div>
        <div style={S.lbl}>Description</div>
        <textarea style={{ ...S.inp, resize:'none', height:56 }} value={item.description||''} onChange={e=>f('description',e.target.value)} placeholder="Shown on kiosk and online ordering"/>
      </div>
      <div>
        <div style={S.lbl}>Category</div>
        <select value={item.cat||''} onChange={e=>f('cat',e.target.value)} style={{ ...S.inp, cursor:'pointer' }}>
          <option value="">— select —</option>
          {rootCats.map(c=>(
            <optgroup key={c.id} label={`${c.icon||''} ${c.label}`}>
              <option value={c.id}>{c.icon} {c.label}</option>
              {subCats.filter(s=>s.parentId===c.id).map(s=><option key={s.id} value={s.id}>  └ {s.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <div style={S.lbl}>Kitchen instructions <span style={{ color:'var(--t4)', fontWeight:400, textTransform:'none', letterSpacing:0 }}>(always on ticket)</span></div>
        <textarea style={{ ...S.inp, resize:'none', height:44 }} value={item.instructions||''} onChange={e=>f('instructions',e.target.value)} placeholder="e.g. Contains nuts — alert kitchen"/>
      </div>
      <div>
        <div style={S.lbl}>Visibility</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[['pos','POS'],['kiosk','Kiosk'],['online','Online'],['onlineDelivery','Delivery']].map(([k,l])=>{
            const on = item.visibility?.[k] !== false;
            return (
              <button key={k} onClick={()=>onUpdate({ visibility:{ ...(item.visibility||{pos:true,kiosk:true,online:true,onlineDelivery:true}), [k]:!on } })}
                style={S.pill(on,'var(--grn)')}>
                {on?'✓':''} {l}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Pricing tab ────────────────────────────────────────────────────────────
function PricingTab({ item, pricing, onUpdate }) {
  const p = pricing;
  const setPrice = (k, raw) => {
    const val = raw===''||raw===null ? null : parseFloat(raw)||0;
    onUpdate({ pricing:{ ...p, [k]:val }, ...(k==='base'?{ price:val||0 }:{}) });
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ padding:'12px 14px', background:'var(--bg3)', borderRadius:11, border:'1px solid var(--bdr)' }}>
        <div style={S.lbl}>Base price</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18, color:'var(--t3)', fontWeight:700 }}>£</span>
          <input type="number" step="0.01" min="0"
            style={{ ...S.inp, fontFamily:'var(--font-mono)', fontWeight:800, fontSize:22, color:'var(--acc)', border:'none', background:'transparent' }}
            value={p.base||0} onChange={e=>setPrice('base',e.target.value)}/>
        </div>
        <div style={{ fontSize:11, color:'var(--t4)', marginTop:4 }}>Used when no channel-specific price is set</div>
      </div>

      <div>
        <div style={S.lbl}>Pricing by order type</div>
        <div style={{ fontSize:11, color:'var(--t3)', marginBottom:10 }}>Leave blank to use base price. Override for channel-specific pricing (e.g. delivery surcharge, takeaway discount).</div>

        {ORDER_TYPES.map(ot => {
          const val = p[ot.id];
          return (
            <div key={ot.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginBottom:6, borderRadius:10, border:`1px solid ${val!==null&&val!==undefined?ot.color+'55':'var(--bdr)'}`, background:val!==null&&val!==undefined?`${ot.color}11`:'var(--bg3)' }}>
              <span style={{ fontSize:18 }}>{ot.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:ot.color }}>{ot.label}</div>
                {val===null||val===undefined
                  ? <div style={{ fontSize:10, color:'var(--t4)' }}>Using base: £{(p.base||0).toFixed(2)}</div>
                  : <div style={{ fontSize:10, color:ot.color }}>Override active: £{val.toFixed(2)}</div>
                }
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:13, color:'var(--t4)' }}>£</span>
                <input type="number" step="0.01" min="0"
                  style={{ width:80, ...S.inp, fontFamily:'var(--font-mono)', fontWeight:700, fontSize:14 }}
                  value={val!==null&&val!==undefined?val:''} placeholder={(p.base||0).toFixed(2)}
                  onChange={e=>setPrice(ot.id, e.target.value)}/>
                {val!==null&&val!==undefined && (
                  <button onClick={()=>setPrice(ot.id,null)} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:14 }}>✕</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div style={S.lbl}>Scope</div>
        <div style={{ display:'flex', gap:6 }}>
          {[['local','Local','#3b82f6'],['shared','Shared','#e8a020'],['global','Global','#22c55e']].map(([id,l,c])=>(
            <button key={id} onClick={()=>onUpdate({scope:id})} style={S.pill((item.scope||'local')===id,c)}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize:10, color:'var(--t4)', marginTop:4 }}>Local = this site only · Shared = name shared, price per location · Global = everything shared</div>
      </div>
    </div>
  );
}

// ── Modifiers tab ──────────────────────────────────────────────────────────
function ModifiersTab({ item, onUpdate, library }) {
  const groups = item.modifierGroups || [];
  const [modSearch, setModSearch] = useState('');
  const [activeGroupIdx, setActiveGroupIdx] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');

  const setGroups = gs => onUpdate({ modifierGroups:gs });

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    setGroups([...groups, { id:`mg-${Date.now()}`, label:newGroupName.trim(), selectionType:'single', min:0, max:1, modifierIds:[] }]);
    setNewGroupName('');
    setActiveGroupIdx(groups.length);
  };

  const updGroup = (i, patch) => setGroups(groups.map((g,gi)=>gi===i?{...g,...patch}:g));
  const delGroup = i => { setGroups(groups.filter((_,gi)=>gi!==i)); if(activeGroupIdx===i) setActiveGroupIdx(null); };

  const addModToGroup = (gi, modId) => {
    const g = groups[gi];
    if (!g.modifierIds?.includes(modId)) {
      updGroup(gi, { modifierIds:[...(g.modifierIds||[]), modId] });
    }
  };
  const removeModFromGroup = (gi, modId) => updGroup(gi, { modifierIds:(groups[gi].modifierIds||[]).filter(id=>id!==modId) });

  const filteredLibrary = library.filter(m =>
    !modSearch || m.name.toLowerCase().includes(modSearch.toLowerCase()) || m.category?.toLowerCase().includes(modSearch.toLowerCase())
  );

  const grouped = filteredLibrary.reduce((acc, m) => {
    const cat = m.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  if (item.type === 'variants') return <VariantsTab item={item} onUpdate={onUpdate}/>;
  if (item.type === 'pizza')    return <div style={{ fontSize:12, color:'var(--t3)', padding:12 }}>Pizza configuration is managed in the Builder mode.</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Group list */}
      <div>
        <div style={S.lbl}>Modifier groups on this item</div>
        {groups.length === 0 && (
          <div style={{ fontSize:12, color:'var(--t4)', padding:'12px 0', textAlign:'center' }}>No modifier groups yet. Add one below.</div>
        )}
        {groups.map((g, gi) => {
          const mods = (g.modifierIds||[]).map(id => library.find(m=>m.id===id)).filter(Boolean);
          const active = activeGroupIdx === gi;
          return (
            <div key={g.id} style={{ marginBottom:6, borderRadius:10, border:`1.5px solid ${active?'var(--acc)':'var(--bdr)'}`, overflow:'hidden' }}>
              <div style={{ padding:'8px 12px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', background:active?'var(--acc-d)':'var(--bg3)' }} onClick={()=>setActiveGroupIdx(active?null:gi)}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:active?'var(--acc)':'var(--t1)' }}>{g.label}</div>
                  <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
                    {MOD_SELECTION_TYPES.find(t=>t.id===g.selectionType)?.label} · {g.min>0?'Required':'Optional'} · {mods.length} modifier{mods.length!==1?'s':''}
                  </div>
                </div>
                <button onClick={e=>{e.stopPropagation();delGroup(gi);}} style={{ width:22, height:22, borderRadius:6, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>×</button>
                <span style={{ fontSize:10, color:active?'var(--acc)':'var(--t4)' }}>{active?'▲':'▼'}</span>
              </div>
              {active && (
                <div style={{ padding:'10px 12px', borderTop:'1px solid var(--bdr)' }}>
                  {/* Group config */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8, marginBottom:10 }}>
                    <input style={S.inp} value={g.label} onChange={e=>updGroup(gi,{label:e.target.value})} placeholder="Group name"/>
                    <div>
                      <div style={S.lbl}>Selection type</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {MOD_SELECTION_TYPES.map(t=>(
                          <button key={t.id} onClick={()=>updGroup(gi,{selectionType:t.id})} style={{ padding:'7px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', textAlign:'left', border:`1.5px solid ${g.selectionType===t.id?'var(--acc)':'var(--bdr)'}`, background:g.selectionType===t.id?'var(--acc-d)':'var(--bg3)' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:g.selectionType===t.id?'var(--acc)':'var(--t1)' }}>{t.label}</div>
                            <div style={{ fontSize:10, color:'var(--t4)' }}>{t.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'var(--t2)' }}>
                        <input type="checkbox" checked={g.min>0} onChange={e=>updGroup(gi,{min:e.target.checked?1:0})} style={{ accentColor:'var(--acc)' }}/>
                        Required (min 1)
                      </label>
                      {g.selectionType!=='single' && (
                        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'var(--t2)' }}>
                          Max:
                          <input type="number" min="1" max="20" style={{ width:48, ...S.inp, padding:'4px 6px' }} value={g.max||1} onChange={e=>updGroup(gi,{max:parseInt(e.target.value)||1})}/>
                        </label>
                      )}
                    </div>
                  </div>
                  {/* Modifiers in this group */}
                  <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:6 }}>Modifiers in this group</div>
                  {mods.length === 0 && <div style={{ fontSize:11, color:'var(--t4)', marginBottom:8 }}>Search the library below to add modifiers →</div>}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                    {mods.map(m => (
                      <div key={m.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px 3px 10px', borderRadius:20, background:'var(--acc-d)', border:'1px solid var(--acc-b)' }}>
                        <span style={{ fontSize:11, color:'var(--acc)', fontWeight:600 }}>{m.name}</span>
                        {m.price>0 && <span style={{ fontSize:10, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>+£{m.price.toFixed(2)}</span>}
                        <button onClick={()=>removeModFromGroup(gi,m.id)} style={{ background:'none', border:'none', color:'var(--acc)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                      </div>
                    ))}
                  </div>
                  {/* Library search for this group */}
                  <input style={S.inp} placeholder="Search modifier library to add…" value={modSearch} onChange={e=>setModSearch(e.target.value)}/>
                  {modSearch && (
                    <div style={{ maxHeight:120, overflowY:'auto', marginTop:4, border:'1px solid var(--bdr)', borderRadius:8 }}>
                      {filteredLibrary.filter(m=>!(g.modifierIds||[]).includes(m.id)).map(m=>(
                        <button key={m.id} onClick={()=>{ addModToGroup(gi,m.id); }} style={{ width:'100%', padding:'6px 10px', cursor:'pointer', fontFamily:'inherit', background:'transparent', border:'none', textAlign:'left', fontSize:12, display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--bdr)' }}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <span style={{ color:'var(--t1)' }}>{m.name} <span style={{ color:'var(--t4)', fontSize:10 }}>{m.category}</span></span>
                          {m.price>0 && <span style={{ color:'var(--acc)', fontFamily:'var(--font-mono)', fontSize:11 }}>+£{m.price.toFixed(2)}</span>}
                        </button>
                      ))}
                      {filteredLibrary.filter(m=>!(g.modifierIds||[]).includes(m.id)).length===0 && <div style={{ padding:'8px 10px', fontSize:11, color:'var(--t4)' }}>All matching modifiers already in group</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new group */}
      <div style={{ display:'flex', gap:6 }}>
        <input style={{ ...S.inp, flex:1 }} value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="New group name (e.g. Cooking preference)"/>
        <button onClick={addGroup} disabled={!newGroupName.trim()} style={{ ...primaryBtn, flexShrink:0 }}>Add group</button>
      </div>
    </div>
  );
}

// ── Variants tab ───────────────────────────────────────────────────────────
function VariantsTab({ item, onUpdate }) {
  const vs = item.variants || [];
  const upd = v => onUpdate({ variants:v });
  return (
    <div>
      <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12 }}>Customers must pick one size. Price shows "from £X" on the menu.</div>
      {vs.map((v,i)=>(
        <div key={v.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px auto', gap:6, marginBottom:5 }}>
          <input style={S.inp} value={v.label} onChange={e=>upd(vs.map((x,j)=>j===i?{...x,label:e.target.value}:x))} placeholder="e.g. Small, Regular, Large"/>
          <div style={{ position:'relative' }}><span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--t4)' }}>£</span><input type="number" step="0.01" style={{...S.inp,paddingLeft:20}} value={v.price||0} onChange={e=>upd(vs.map((x,j)=>j===i?{...x,price:parseFloat(e.target.value)||0}:x))}/></div>
          <button onClick={()=>upd(vs.filter((_,j)=>j!==i))} style={{ width:28, height:36, borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:13 }}>×</button>
        </div>
      ))}
      <button onClick={()=>upd([...vs,{id:`v-${Date.now()}`,label:'',price:0}])} style={outlineBtn}>+ Add size</button>
    </div>
  );
}

// ── Allergens tab ──────────────────────────────────────────────────────────
function AllergensTab({ item, onUpdate }) {
  const toggle = id => {
    const a = (item.allergens||[]);
    onUpdate({ allergens: a.includes(id) ? a.filter(x=>x!==id) : [...a,id] });
  };
  return (
    <div>
      <div style={{ fontSize:11, color:'var(--t3)', marginBottom:12, lineHeight:1.5 }}>All 14 EU/UK mandatory allergens. Toggle to declare. These print on receipts and show on the allergen confirmation screen.</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {ALLERGENS.map(a=>{
          const on = (item.allergens||[]).includes(a.id);
          return (
            <button key={a.id} onClick={()=>toggle(a.id)} style={{ padding:'8px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:7, background:on?'var(--red-d)':'var(--bg3)', border:`1.5px solid ${on?'var(--red)':'var(--bdr)'}`, color:on?'var(--red)':'var(--t2)' }}>
              <span style={{ fontSize:14 }}>{a.icon}</span>
              <span style={{ fontSize:11, fontWeight:on?700:400 }}>{a.label}</span>
              {on && <span style={{ marginLeft:'auto', fontSize:12 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Routing tab ────────────────────────────────────────────────────────────
function RoutingTab({ item, categories, onUpdate }) {
  const cat = categories.find(c=>c.id===item.cat);
  const centres = PRODUCTION_CENTRES || [];
  const COURSES = [{id:null,label:'Inherit from category'},{id:1,label:'Course 1 — Starters'},{id:2,label:'Course 2 — Mains'},{id:3,label:'Course 3 — Desserts'}];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={S.lbl}>Production centre</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <button onClick={()=>onUpdate({productionCentreId:null})} style={{ ...btnStyle(!item.productionCentreId), textAlign:'left', padding:'7px 10px', borderRadius:8 }}>
            Inherit from category {cat?.defaultProductionCentreId ? `(${centres.find(p=>p.id===cat.defaultProductionCentreId)?.name||cat.defaultProductionCentreId})` : '(none set)'}
          </button>
          {centres.map(pc=>(
            <button key={pc.id} onClick={()=>onUpdate({productionCentreId:pc.id})} style={{ ...btnStyle(item.productionCentreId===pc.id), textAlign:'left', padding:'7px 10px', borderRadius:8, display:'flex', gap:8 }}>
              <span>{pc.icon}</span>{pc.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={S.lbl}>Course</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {COURSES.map(c=>(
            <button key={String(c.id)} onClick={()=>onUpdate({course:c.id})} style={{ ...btnStyle(item.course===c.id), textAlign:'left', padding:'7px 10px', borderRadius:8 }}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE 2 — Modifiers library & groups
// ══════════════════════════════════════════════════════════════════════════════
function ModifiersMode() {
  const { modifierLibrary, addModifier, updateModifier, removeModifier, markBOChange, showToast } = useStore();
  const [search, setSearch] = useState('');
  const [editingMod, setEditingMod] = useState(null);
  const [newMod, setNewMod] = useState({ name:'', price:'', category:'' });
  const [catFilter, setCatFilter] = useState('all');

  const cats = ['all', ...new Set(modifierLibrary.map(m=>m.category||'Other').filter(Boolean))];

  const filtered = modifierLibrary.filter(m => {
    if (catFilter !== 'all' && (m.category||'Other') !== catFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce((acc,m) => {
    const c = m.category||'Other';
    if (!acc[c]) acc[c]=[];
    acc[c].push(m);
    return acc;
  }, {});

  const handleAdd = () => {
    if (!newMod.name.trim()) return;
    addModifier({ name:newMod.name.trim(), price:parseFloat(newMod.price)||0, category:newMod.category||'Other', allergens:[] });
    markBOChange();
    showToast(`"${newMod.name}" added to library`,'success');
    setNewMod({ name:'', price:'', category:newMod.category });
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left: library */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid var(--bdr)' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>Modifier library</div>
          <div style={{ fontSize:12, color:'var(--t3)' }}>Create modifiers here, then add them to groups on any item.</div>
        </div>
        {/* Add new */}
        <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)', display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          <input style={{ ...S.inp, flex:2 }} value={newMod.name} onChange={e=>setNewMod(m=>({...m,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleAdd()} placeholder="Modifier name (e.g. Truffle oil)"/>
          <div style={{ position:'relative', flex:1 }}>
            <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--t4)' }}>£</span>
            <input type="number" step="0.01" style={{ ...S.inp, paddingLeft:20 }} value={newMod.price} onChange={e=>setNewMod(m=>({...m,price:e.target.value}))} placeholder="0.00"/>
          </div>
          <input style={{ ...S.inp, flex:1 }} value={newMod.category} onChange={e=>setNewMod(m=>({...m,category:e.target.value}))} placeholder="Category" list="mod-cats"/>
          <datalist id="mod-cats">{cats.filter(c=>c!=='all').map(c=><option key={c} value={c}/>)}</datalist>
          <button onClick={handleAdd} disabled={!newMod.name.trim()} style={{ ...primaryBtn, flexShrink:0 }}>+ Add</button>
        </div>
        {/* Filter bar */}
        <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', gap:6, alignItems:'center', flexShrink:0, overflowX:'auto' }}>
          <input style={{ ...S.inp, maxWidth:200 }} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
          {cats.map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)} style={S.pill(catFilter===c,'var(--acc)')}>
              {c==='all'?'All':c}
            </button>
          ))}
        </div>
        {/* List */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 16px' }}>
          {Object.entries(grouped).map(([cat, mods]) => (
            <div key={cat} style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{cat}</div>
              {mods.map(m => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', marginBottom:4, borderRadius:9, border:'1px solid var(--bdr)', background:'var(--bg3)' }}>
                  {editingMod===m.id ? (
                    <>
                      <input style={{ ...S.inp, flex:2, height:30, padding:'4px 8px', fontSize:12 }} defaultValue={m.name}
                        onBlur={e=>{ updateModifier(m.id,{name:e.target.value}); markBOChange(); }} autoFocus/>
                      <div style={{ position:'relative', flex:1 }}>
                        <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--t4)' }}>£</span>
                        <input type="number" step="0.01" style={{ ...S.inp, paddingLeft:16, height:30, padding:'4px 8px 4px 18px', fontSize:12 }} defaultValue={m.price}
                          onBlur={e=>{ updateModifier(m.id,{price:parseFloat(e.target.value)||0}); markBOChange(); }}/>
                      </div>
                      <input style={{ ...S.inp, flex:1, height:30, padding:'4px 8px', fontSize:12 }} defaultValue={m.category} list="mod-cats"
                        onBlur={e=>{ updateModifier(m.id,{category:e.target.value}); markBOChange(); }}/>
                      <button onClick={()=>setEditingMod(null)} style={{ background:'none', border:'none', color:'var(--acc)', cursor:'pointer', fontWeight:700, fontSize:12 }}>Done</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex:1, fontSize:12, fontWeight:600, color:'var(--t1)' }}>{m.name}</span>
                      {m.allergens?.length>0 && <span style={{ fontSize:10, color:'var(--red)' }}>⚠</span>}
                      <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--acc)' }}>{m.price>0?`+£${m.price.toFixed(2)}`:''}</span>
                      <button onClick={()=>setEditingMod(m.id)} style={iconBtn} title="Edit">✎</button>
                      <button onClick={()=>{ if(confirm(`Remove "${m.name}" from library?`)){ removeModifier(m.id); markBOChange(); }}} style={iconBtn} title="Remove">×</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
          {filtered.length===0 && <div style={{ textAlign:'center', padding:'40px', color:'var(--t4)' }}>
            <div style={{ fontSize:28, marginBottom:8, opacity:.3 }}>⊕</div>
            <div style={{ fontSize:13 }}>Add modifiers above to build your library</div>
          </div>}
        </div>
      </div>

      {/* Right: usage summary */}
      <div style={{ width:280, background:'var(--bg1)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>Library summary</div>
          <div style={{ fontSize:11, color:'var(--t3)' }}>{modifierLibrary.length} modifiers · Go to an item → Modifiers tab to add them to groups</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
          {cats.filter(c=>c!=='all').map(c => {
            const mods = modifierLibrary.filter(m=>(m.category||'Other')===c);
            return (
              <div key={c} style={{ marginBottom:12, padding:'10px 12px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', marginBottom:6 }}>{c} ({mods.length})</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {mods.map(m=>(
                    <span key={m.id} style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:'var(--bg1)', border:'1px solid var(--bdr)', color:'var(--t3)' }}>{m.name}{m.price>0?` +£${m.price.toFixed(2)}`:''}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE 3 — Interactive builder
// ══════════════════════════════════════════════════════════════════════════════
function BuilderMode() {
  const {
    menuCategories, menuItems, reorderMenuItems, reorderCategories,
    updateMenuItem, updateCategory, markBOChange, eightySixIds, modifierLibrary,
  } = useStore();

  const [selectedId, setSelectedId] = useState(null);   // item or category id
  const [selectedType, setSelectedType] = useState(null); // 'item' | 'cat'
  const [activeCat, setActiveCat] = useState(null);
  const [preview, setPreview] = useState('pos');         // pos | kiosk | handheld
  const [dragCat, setDragCat] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  const rootCats = menuCategories.filter(c=>!c.parentId&&!c.isSpecial).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
  const displayCat = activeCat || rootCats[0]?.id;

  const catItems = useMemo(() => {
    const childIds = menuCategories.filter(c=>c.parentId===displayCat).map(c=>c.id);
    return menuItems.filter(i=>!i.archived&&(i.cat===displayCat||childIds.includes(i.cat))).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
  }, [menuItems, displayCat, menuCategories]);

  const selectedItem = selectedType==='item' ? menuItems.find(i=>i.id===selectedId) : null;
  const selectedCat  = selectedType==='cat'  ? menuCategories.find(c=>c.id===selectedId) : null;

  const GRID_COLS = preview==='handheld' ? 2 : preview==='kiosk' ? 4 : 3;
  const CARD_H    = preview==='kiosk' ? 160 : 110;

  // Category drag
  const onCatDragStart = (e, id, idx) => { setDragCat({ id, idx }); e.dataTransfer.effectAllowed='move'; };
  const onCatDrop = (e, toIdx) => {
    e.preventDefault();
    if (dragCat && dragCat.idx !== toIdx) { reorderCategories(dragCat.idx, toIdx); markBOChange(); }
    setDragCat(null);
  };

  // Item drag
  const onItemDragStart = (e, item, idx) => { setDragItem({ item, idx }); e.dataTransfer.effectAllowed='move'; };
  const onItemDrop = (e, toIdx) => {
    e.preventDefault();
    if (dragItem && dragItem.idx !== toIdx && displayCat) {
      reorderMenuItems(displayCat, dragItem.idx, toIdx);
      markBOChange();
    }
    setDragItem(null); setDragOverItem(null);
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Preview canvas */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>
        {/* Builder toolbar */}
        <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)' }}>Preview as:</span>
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:8, padding:2 }}>
            {[['pos','🖥 POS'],['kiosk','⬜ Kiosk'],['handheld','📱 Handheld']].map(([id,l])=>(
              <button key={id} onClick={()=>setPreview(id)} style={{ padding:'4px 12px', borderRadius:6, cursor:'pointer', fontFamily:'inherit', background:preview===id?'var(--bg1)':'transparent', border:preview===id?'1px solid var(--bdr2)':'1px solid transparent', color:preview===id?'var(--t1)':'var(--t3)', fontSize:12, fontWeight:preview===id?700:400 }}>{l}</button>
            ))}
          </div>
          <span style={{ fontSize:11, color:'var(--t4)', marginLeft:4 }}>Drag to reorder · Click to edit</span>
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--acc)', fontWeight:700 }}>LIVE PREVIEW</span>
        </div>

        {/* POS-style preview */}
        <div style={{ flex:1, overflow:'auto', padding:16 }}>
          <div style={{
            background:'var(--bg1)', borderRadius:16, border:'1px solid var(--bdr)', overflow:'hidden',
            boxShadow:'0 4px 24px rgba(0,0,0,.08)',
            maxWidth: preview==='handheld' ? 360 : preview==='kiosk' ? 900 : 760,
            margin:'0 auto',
          }}>
            {/* Category tabs */}
            <div style={{ display:'flex', gap:0, overflowX:'auto', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)', padding:'4px 8px' }}>
              {rootCats.map((cat, idx) => (
                <div key={cat.id}
                  draggable
                  onDragStart={e=>onCatDragStart(e,cat.id,idx)}
                  onDragOver={e=>{e.preventDefault();}}
                  onDrop={e=>onCatDrop(e,idx)}
                  onClick={() => { setActiveCat(cat.id); setSelectedId(cat.id); setSelectedType('cat'); }}
                  style={{
                    padding:'7px 14px', borderRadius:9, cursor:'pointer', userSelect:'none', whiteSpace:'nowrap',
                    background: displayCat===cat.id ? (selectedId===cat.id?'var(--acc)':'var(--bg1)') : 'transparent',
                    color: displayCat===cat.id ? (selectedId===cat.id?'#0b0c10':'var(--t1)') : 'var(--t3)',
                    fontWeight: displayCat===cat.id ? 700 : 400, fontSize:13,
                    border: selectedId===cat.id&&selectedType==='cat' ? '2px solid var(--acc)' : '2px solid transparent',
                    transition:'all .1s',
                  }}
                >
                  {cat.icon} {cat.label}
                  <span style={{ marginLeft:6, fontSize:9, opacity:.6, cursor:'grab' }}>⣿</span>
                </div>
              ))}
            </div>

            {/* Item grid */}
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${GRID_COLS},1fr)`, gap:8, padding:10 }}>
              {catItems.map((item, idx) => {
                const is86    = eightySixIds.includes(item.id);
                const isSelI  = selectedId===item.id && selectedType==='item';
                const isDragO = dragOverItem===idx;
                const p = item.pricing || { base:item.price||0 };
                const price = p.dineIn !== null && p.dineIn !== undefined ? p.dineIn : p.base;

                return (
                  <div key={item.id}
                    draggable
                    onDragStart={e=>onItemDragStart(e,item,idx)}
                    onDragOver={e=>{ e.preventDefault(); setDragOverItem(idx); }}
                    onDragLeave={()=>setDragOverItem(null)}
                    onDrop={e=>onItemDrop(e,idx)}
                    onClick={()=>{ setSelectedId(item.id); setSelectedType('item'); }}
                    style={{
                      padding:10, borderRadius:10, cursor:'pointer', userSelect:'none',
                      border:`${isSelI?'2.5px':'1.5px'} solid ${isSelI?'var(--acc)':isDragO?'var(--acc-b)':is86?'var(--red-b)':'var(--bdr)'}`,
                      background: isSelI?'var(--acc-d)':isDragO?'var(--bg3)':is86?'var(--red-d)':'var(--bg3)',
                      height:CARD_H, display:'flex', flexDirection:'column', justifyContent:'space-between',
                      opacity:is86?.5:1, transition:'all .1s', position:'relative',
                    }}
                  >
                    <span style={{ position:'absolute', top:4, right:5, fontSize:9, color:'var(--t4)', cursor:'grab' }}>⣿</span>
                    <div>
                      <div style={{ fontSize:preview==='handheld'?11:13, fontWeight:700, color:isSelI?'var(--acc)':'var(--t1)', lineHeight:1.3, marginBottom:3 }}>
                        {item.menuName||item.name}
                      </div>
                      {preview!=='handheld' && (
                        <div style={{ fontSize:10, color:'var(--t3)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{item.description}</div>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:4 }}>
                      <span style={{ fontSize:14, fontWeight:800, color:isSelI?'var(--acc)':'var(--t2)', fontFamily:'var(--font-mono)' }}>£{price.toFixed(2)}</span>
                      <div style={{ display:'flex', gap:3 }}>
                        {item.allergens?.length>0 && <span style={{ fontSize:9, color:'var(--red)', fontWeight:700 }}>⚠</span>}
                        {item.modifierGroups?.length>0 && <span style={{ fontSize:9, color:'var(--t4)' }}>⊕</span>}
                        {is86 && <span style={{ fontSize:9, fontWeight:700, color:'var(--red)' }}>86</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add item card */}
              <button style={{ height:CARD_H, borderRadius:10, border:'2px dashed var(--bdr)', background:'transparent', cursor:'pointer', fontFamily:'inherit', color:'var(--t4)', fontSize:24, display:'flex', alignItems:'center', justifyContent:'center' }}
                onClick={() => {
                  const { addMenuItem, markBOChange } = useStore.getState();
                  addMenuItem({ name:'New item', menuName:'New item', receiptName:'New item', kitchenName:'New item', cat:displayCat, type:'simple', allergens:[], modifierGroups:[], pricing:{base:0,dineIn:null,takeaway:null,collection:null,delivery:null} });
                  markBOChange();
                }}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right edit panel */}
      <div style={{ width:360, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        {selectedItem ? (
          <>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>{selectedItem.menuName||selectedItem.name}</div>
              <div style={{ fontSize:11, color:'var(--t4)' }}>Click any field to edit. Changes apply to builder immediately.</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:14 }}>
              <QuickItemEditor item={selectedItem} categories={menuCategories} library={modifierLibrary}
                onUpdate={patch=>{ updateMenuItem(selectedItem.id, patch); markBOChange(); }}/>
            </div>
          </>
        ) : selectedCat ? (
          <>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>{selectedCat.icon} {selectedCat.label}</div>
              <div style={{ fontSize:11, color:'var(--t4)' }}>Category settings</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:14 }}>
              <QuickCatEditor cat={selectedCat} onUpdate={patch=>{ updateCategory(selectedCat.id, patch); markBOChange(); }}/>
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:24, color:'var(--t4)' }}>
            <div>
              <div style={{ fontSize:32, marginBottom:12, opacity:.3 }}>←</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>Click any item or category tab to edit it</div>
              <div style={{ fontSize:11, marginTop:6 }}>Drag to reorder · Changes push to POS instantly</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quick item editor (in builder) ─────────────────────────────────────────
function QuickItemEditor({ item, categories, library, onUpdate }) {
  const p = item.pricing || { base:item.price||0, dineIn:null, takeaway:null, collection:null, delivery:null };
  const f = (k,v) => onUpdate({ [k]:v });
  const rootCats = categories.filter(c=>!c.parentId&&!c.isSpecial);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div><div style={S.lbl}>Menu name</div><input style={S.inp} value={item.menuName||item.name||''} onChange={e=>f('menuName',e.target.value)}/></div>
      <div><div style={S.lbl}>Description</div><textarea style={{ ...S.inp, resize:'none', height:48 }} value={item.description||''} onChange={e=>f('description',e.target.value)}/></div>
      <div>
        <div style={S.lbl}>Type</div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {ITEM_TYPES.map(t=><button key={t.id} onClick={()=>f('type',t.id)} style={S.pill((item.type||'simple')===t.id)}>{t.icon} {t.label}</button>)}
        </div>
      </div>
      <div>
        <div style={S.lbl}>Category</div>
        <select value={item.cat||''} onChange={e=>f('cat',e.target.value)} style={{ ...S.inp, cursor:'pointer' }}>
          {rootCats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </div>
      <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px' }}>
        <div style={S.lbl}>Pricing by order type</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ fontSize:11, color:'var(--t3)', width:70, flexShrink:0 }}>Base</span>
          <div style={{ position:'relative', flex:1 }}><span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--acc)' }}>£</span><input type="number" step="0.01" style={{ ...S.inp, paddingLeft:20, color:'var(--acc)', fontWeight:800 }} value={p.base||0} onChange={e=>onUpdate({ pricing:{ ...p, base:parseFloat(e.target.value)||0 }, price:parseFloat(e.target.value)||0 })}/></div>
        </div>
        {ORDER_TYPES.map(ot=>(
          <div key={ot.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:11, color:ot.color, width:70, flexShrink:0 }}>{ot.icon} {ot.label}</span>
            <div style={{ position:'relative', flex:1 }}><span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--t4)' }}>£</span><input type="number" step="0.01" style={{ ...S.inp, paddingLeft:20, fontSize:12 }} value={p[ot.id]!==null&&p[ot.id]!==undefined?p[ot.id]:''} placeholder={`${p.base||0} (base)`} onChange={e=>onUpdate({ pricing:{ ...p, [ot.id]: e.target.value===''?null:parseFloat(e.target.value)||0 } })}/></div>
          </div>
        ))}
      </div>
      <div>
        <div style={S.lbl}>Allergens</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {ALLERGENS.map(a=>{
            const on=(item.allergens||[]).includes(a.id);
            return <button key={a.id} onClick={()=>onUpdate({ allergens:on?(item.allergens||[]).filter(x=>x!==a.id):[...(item.allergens||[]),a.id] })} style={S.pill(on,'var(--red)')}>{a.icon} {a.label}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

// ── Quick category editor ──────────────────────────────────────────────────
function QuickCatEditor({ cat, onUpdate }) {
  const ICONS = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🌿','🔥'];
  const PALETTE = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899'];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div><div style={S.lbl}>Name</div><input style={S.inp} value={cat.label||''} onChange={e=>onUpdate({label:e.target.value})}/></div>
      <div>
        <div style={S.lbl}>Icon</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {ICONS.map(ic=><button key={ic} onClick={()=>onUpdate({icon:ic})} style={{ width:32, height:32, borderRadius:7, border:`1.5px solid ${cat.icon===ic?'var(--acc)':'var(--bdr)'}`, background:cat.icon===ic?'var(--acc-d)':'var(--bg3)', cursor:'pointer', fontSize:16 }}>{ic}</button>)}
        </div>
      </div>
      <div>
        <div style={S.lbl}>Colour</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {PALETTE.map(c=><button key={c} onClick={()=>onUpdate({color:c})} style={{ width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline:cat.color===c?'3px solid var(--t1)':'3px solid transparent', outlineOffset:2 }}/>)}
        </div>
      </div>
      <div><div style={S.lbl}>Accounting group</div><input style={S.inp} value={cat.accountingGroup||''} onChange={e=>onUpdate({accountingGroup:e.target.value})} placeholder="e.g. Food, Beverages"/></div>
    </div>
  );
}

// ── Category modal ─────────────────────────────────────────────────────────
function CategoryModal({ cat, categories, onSave, onDelete, onClose }) {
  const isNew = !cat?.id;
  const parentId = cat?._parentId || cat?.parentId || null;
  const [label, setLabel] = useState(cat?.label||'');
  const [icon, setIcon]   = useState(cat?.icon||'🍽');
  const [color, setColor] = useState(cat?.color||'#3b82f6');
  const [acct, setAcct]   = useState(cat?.accountingGroup||'Food & Beverage');
  const [stat, setStat]   = useState(cat?.statisticGroup||'');
  const ICONS = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🌿','🔥','❄️','🏷','⭐','🥐','🌮','🦞'];
  const PALETTE = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899','#10b981','#8b5cf6'];
  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:420, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>{isNew ? (parentId ? 'New subcategory' : 'New category') : 'Edit category'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>
          <div style={{ marginBottom:10 }}><div style={S.lbl}>Name</div><input style={S.inp} value={label} onChange={e=>setLabel(e.target.value)} autoFocus/></div>
          <div style={{ marginBottom:10 }}>
            <div style={S.lbl}>Icon</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{ width:32, height:32, borderRadius:7, border:`1.5px solid ${icon===ic?'var(--acc)':'var(--bdr)'}`, background:icon===ic?'var(--acc-d)':'var(--bg3)', cursor:'pointer', fontSize:16 }}>{ic}</button>)}</div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={S.lbl}>Colour</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{PALETTE.map(c=><button key={c} onClick={()=>setColor(c)} style={{ width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline:color===c?'3px solid var(--t1)':'3px solid transparent', outlineOffset:2 }}/>)}</div>
          </div>
          <div style={{ marginBottom:10 }}><div style={S.lbl}>Accounting group</div><input style={S.inp} value={acct} onChange={e=>setAcct(e.target.value)} placeholder="Food, Beverages, Alcohol"/></div>
          <div style={{ marginBottom:4 }}><div style={S.lbl}>Statistic group</div><input style={S.inp} value={stat} onChange={e=>setStat(e.target.value)} placeholder="Hot starters, Cocktails…"/></div>
        </div>
        <div style={{ padding:'10px 18px', borderTop:'1px solid var(--bdr)', display:'flex', gap:6 }}>
          {!isNew && onDelete && <button onClick={onDelete} style={{ padding:'7px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>Remove</button>}
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:2, height:38 }} disabled={!label.trim()} onClick={()=>onSave({ label:label.trim(), icon, color, parentId, accountingGroup:acct, statisticGroup:stat, sortOrder:99 })}>
            {isNew?'Add category':'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared button styles ───────────────────────────────────────────────────
const thStyle = { padding:'9px 12px', textAlign:'left', fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--bdr)', whiteSpace:'nowrap' };
const iconBtn  = { width:24, height:24, borderRadius:7, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' };
const primaryBtn = { padding:'7px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700 };
const outlineBtn = { padding:'6px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600 };
const btnStyle = (active, color='var(--acc)') => ({
  padding:'6px 8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:active?700:400,
  border:'none', textAlign:'left', display:'flex', alignItems:'center', gap:6, width:'100%',
  background: active ? `${color}22` : 'transparent',
  color: active ? color : 'var(--t2)',
  borderLeft: `2px solid ${active ? color : 'transparent'}`,
});
