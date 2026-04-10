/**
 * MenuManager v2 — Three-mode professional menu management
 * Mode 1: Items    — Category tree + searchable item table + full item editor
 * Mode 2: Modifiers — Global modifier library + group builder with search
 * Mode 3: Builder  — Full-page interactive POS/Kiosk/Handheld live preview
 */
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../../store';
import { ALLERGENS, PRODUCTION_CENTRES } from '../../data/seed';

// ─── Design tokens ────────────────────────────────────────────────────────────
const t = {
  inp: { background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:9, padding:'8px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', width:'100%', transition:'border-color .15s' },
  lbl: { display:'block', fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 },
  sec: { fontSize:11, fontWeight:800, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.07em', padding:'0 0 6px', borderBottom:'1px solid var(--bdr)', marginBottom:12 },
};

const ORDER_TYPES = [
  { id:'dineIn',     label:'Dine-in',    icon:'🍽', color:'#3b82f6', hint:'Table service price' },
  { id:'takeaway',   label:'Takeaway',   icon:'🥡', color:'#e8a020', hint:'Walk-out price' },
  { id:'collection', label:'Collection', icon:'📦', color:'#22c55e', hint:'Click & collect price' },
  { id:'delivery',   label:'Delivery',   icon:'🛵', color:'#a855f7', hint:'Delivery app price' },
];

const ITEM_TYPES = [
  { id:'simple',    label:'Simple',   icon:'⬛', desc:'Fixed price, no choices' },
  { id:'modifiers', label:'With modifiers', icon:'⊕', desc:'Has options & extras' },
  { id:'variants',  label:'Variants', icon:'▾', desc:'Multiple sizes' },
  { id:'pizza',     label:'Pizza',    icon:'🍕', desc:'Custom builder' },
  { id:'bundle',    label:'Bundle',   icon:'📦', desc:'Set menu / meal deal' },
];

const MOD_TYPES = [
  { id:'single',   label:'Pick one',      icon:'◉', desc:'Customer picks exactly one (radio)' },
  { id:'multiple', label:'Pick any',       icon:'☑', desc:'Tick as many as wanted (checkbox)' },
  { id:'quantity', label:'Add quantities', icon:'⊞', desc:'Specify how many of each (pizza toppings)' },
];

const SCOPES = [
  { id:'local',  label:'Local',  color:'#3b82f6', desc:'This location only' },
  { id:'shared', label:'Shared', color:'#e8a020', desc:'Name shared, price per location' },
  { id:'global', label:'Global', color:'#22c55e', desc:'Everything shared across all sites' },
];

function pill(active, color = 'var(--acc)') {
  return {
    display:'inline-flex', alignItems:'center', gap:5,
    padding:'5px 12px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', fontSize:11,
    fontWeight:active ? 800 : 500, border:`1.5px solid ${active ? color : 'var(--bdr)'}`,
    background:active ? `${color}1a` : 'var(--bg3)', color:active ? color : 'var(--t3)',
    transition:'all .12s', userSelect:'none',
  };
}

function catBtn(active, color = '#3b82f6') {
  return {
    width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'6px 8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
    border:'none', textAlign:'left', fontSize:12, fontWeight:active ? 700 : 400,
    background:active ? `${color}18` : 'transparent', color:active ? color : 'var(--t2)',
    borderLeft:`2.5px solid ${active ? color : 'transparent'}`, transition:'all .1s',
  };
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function MenuManager() {
  const [mode, setMode] = useState('items');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <nav style={{ display:'flex', alignItems:'stretch', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0, height:46 }}>
        {[
          { id:'items',     icon:'📋', label:'Items' },
          { id:'modifiers', icon:'⊕',  label:'Modifiers' },
          { id:'builder',   icon:'⬚',  label:'Builder' },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding:'0 22px', cursor:'pointer', fontFamily:'inherit', border:'none',
            borderBottom:`3px solid ${mode === m.id ? 'var(--acc)' : 'transparent'}`,
            background:'transparent', color:mode === m.id ? 'var(--acc)' : 'var(--t3)',
            fontSize:13, fontWeight:mode === m.id ? 800 : 500, display:'flex', alignItems:'center', gap:7,
            transition:'all .12s',
          }}>
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', padding:'0 16px', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--t4)' }}>Changes stage until</span>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--acc)' }}>Push to POS →</span>
        </div>
      </nav>

      {mode === 'items'     && <ItemsMode />}
      {mode === 'modifiers' && <ModifiersMode />}
      {mode === 'builder'   && <BuilderMode />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ITEMS MODE
// ═════════════════════════════════════════════════════════════════════════════
function ItemsMode() {
  const store = useStore();
  const {
    menuCategories, addCategory, updateCategory, removeCategory, reorderCategories,
    menuItems, addMenuItem, updateMenuItem, archiveMenuItem, duplicateMenuItem,
    reorderMenuItems, eightySixIds, toggle86, markBOChange, showToast,
  } = store;

  const [selCatId, setSelCatId]   = useState(null);
  const [selItemId, setSelItemId] = useState(null);
  const [search, setSearch]       = useState('');
  const [catModal, setCatModal]   = useState(null); // null | { cat? }
  const dragCat  = useRef(null);
  const dragItem = useRef(null);

  const rootCats = useMemo(() =>
    menuCategories.filter(c => !c.parentId && !c.isSpecial)
      .sort((a, b) => (a.sortOrder||0) - (b.sortOrder||0)),
    [menuCategories]
  );

  const displayItems = useMemo(() => {
    let items = menuItems.filter(i => !i.archived);
    if (search) {
      const q = search.toLowerCase();
      return items.filter(i =>
        (i.menuName || i.name || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    }
    if (selCatId) {
      const childIds = menuCategories.filter(c => c.parentId === selCatId).map(c => c.id);
      items = items.filter(i => i.cat === selCatId || childIds.includes(i.cat));
    }
    return items.sort((a, b) => (a.sortOrder||0) - (b.sortOrder||0));
  }, [menuItems, selCatId, search, menuCategories]);

  const selItem = menuItems.find(i => i.id === selItemId);

  const newItem = () => {
    const item = {
      name:'New item', menuName:'New item', receiptName:'New item', kitchenName:'New item',
      cat: selCatId || rootCats[0]?.id || 'starters',
      type:'simple', allergens:[], modifierGroups:[],
      pricing:{ base:0, dineIn:null, takeaway:null, collection:null, delivery:null },
    };
    addMenuItem(item);
    markBOChange();
    setTimeout(() => {
      const items = useStore.getState().menuItems;
      setSelItemId(items[items.length - 1]?.id);
    }, 30);
  };

  // Cat drag
  const catDS = (e, idx) => { dragCat.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const catDO = e => e.preventDefault();
  const catDr = (e, toIdx) => {
    e.preventDefault();
    if (dragCat.current !== null && dragCat.current !== toIdx) {
      reorderCategories(dragCat.current, toIdx);
      markBOChange();
    }
    dragCat.current = null;
  };

  // Item drag
  const itemDS = (e, idx) => { dragItem.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const itemDO = e => e.preventDefault();
  const itemDr = (e, toIdx) => {
    e.preventDefault();
    if (dragItem.current !== null && dragItem.current !== toIdx && selCatId) {
      reorderMenuItems(selCatId, dragItem.current, toIdx);
      markBOChange();
    }
    dragItem.current = null;
  };

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

      {/* ── Left: Category tree ─────────────────── */}
      <aside style={{ width:220, borderRight:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={t.lbl}>Categories</span>
          <button onClick={() => setCatModal({})} style={{ fontSize:12, fontWeight:700, color:'var(--acc)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:'2px 6px', borderRadius:6 }}>+ Add</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px 8px' }}>
          <button onClick={() => { setSelCatId(null); setSelItemId(null); }}
            style={{ ...catBtn(!selCatId && !search), marginBottom:3 }}>
            <span>All items</span>
            <span style={{ fontSize:10, color:'var(--t4)', background:'var(--bg3)', padding:'1px 6px', borderRadius:10 }}>{menuItems.filter(i=>!i.archived).length}</span>
          </button>
          {rootCats.map((cat, idx) => (
            <CatTreeRow key={cat.id} cat={cat} idx={idx}
              selCatId={selCatId} menuCategories={menuCategories} menuItems={menuItems}
              onSelect={id => { setSelCatId(id); setSelItemId(null); }}
              onEdit={c => setCatModal({ cat:c })}
              onAddSub={parentId => setCatModal({ cat:{ _parentId:parentId } })}
              onDragStart={catDS} onDragOver={catDO} onDrop={catDr}
            />
          ))}
        </div>
      </aside>

      {/* ── Center: Item table ──────────────────── */}
      <section style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {/* Toolbar */}
        <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, maxWidth:300 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:12, pointerEvents:'none' }}>🔍</span>
            <input style={{ ...t.inp, paddingLeft:30 }} placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {selCatId && (() => {
            const cat = menuCategories.find(c => c.id === selCatId);
            return cat ? <span style={{ fontSize:12, color:'var(--t3)', paddingLeft:4 }}>{cat.icon} {cat.label}</span> : null;
          })()}
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <button onClick={() => setCatModal({})}
              style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600 }}>
              + Category
            </button>
            <button onClick={newItem}
              style={{ padding:'6px 16px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700 }}>
              + Item
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {displayItems.length === 0 ? (
            <Empty search={search} onAdd={newItem} />
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
              <thead>
                <tr style={{ background:'var(--bg2)', position:'sticky', top:0, zIndex:2 }}>
                  <Th w={20}></Th>
                  <Th>Item name</Th>
                  <Th w={90}>Type</Th>
                  <Th w={80}>Base £</Th>
                  <Th w={80}>Dine-in £</Th>
                  <Th w={80}>T/away £</Th>
                  <Th w={80}>Delivery £</Th>
                  <Th w={72}>Status</Th>
                  <Th w={56}></Th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => {
                  const is86 = eightySixIds.includes(item.id);
                  const sel  = selItemId === item.id;
                  const p    = item.pricing || { base: item.price||0, dineIn:null, takeaway:null, collection:null, delivery:null };
                  const cat  = menuCategories.find(c => c.id === item.cat);

                  return (
                    <tr key={item.id}
                      draggable onDragStart={e => itemDS(e,idx)} onDragOver={itemDO} onDrop={e => itemDr(e,idx)}
                      onClick={() => setSelItemId(sel ? null : item.id)}
                      style={{
                        borderBottom:'1px solid var(--bdr)', cursor:'pointer',
                        background: sel ? 'var(--acc-d)' : idx%2===0 ? 'var(--bg)' : 'var(--bg1)',
                        opacity: is86 ? .55 : 1,
                      }}>
                      <td style={{ padding:'0 6px', color:'var(--t4)', fontSize:11, cursor:'grab', width:20 }}>⣿</td>
                      <td style={{ padding:'9px 12px' }}>
                        <div style={{ fontSize:13, fontWeight:600, color:sel?'var(--acc)':'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {item.menuName || item.name}
                        </div>
                        <div style={{ fontSize:10, color:'var(--t4)', marginTop:1, display:'flex', gap:6 }}>
                          {cat && <span>{cat.icon} {cat.label}</span>}
                          {item.allergens?.length > 0 && <span style={{ color:'var(--red)' }}>⚠ {item.allergens.length} allergen{item.allergens.length!==1?'s':''}</span>}
                          {item.modifierGroups?.length > 0 && <span>⊕ {item.modifierGroups.length} group{item.modifierGroups.length!==1?'s':''}</span>}
                        </div>
                      </td>
                      <td style={{ padding:'9px 8px', width:90 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t4)', whiteSpace:'nowrap' }}>
                          {ITEM_TYPES.find(tt=>tt.id===item.type)?.icon || '⬛'} {item.type||'simple'}
                        </span>
                      </td>
                      {/* Inline price editing for all 4 columns */}
                      {[
                        { k:'base', placeholder:undefined },
                        { k:'dineIn', placeholder: p.base||0 },
                        { k:'takeaway', placeholder: p.base||0 },
                        { k:'delivery', placeholder: p.base||0 },
                      ].map(({ k, placeholder }) => (
                        <td key={k} style={{ padding:'6px 4px', width:80 }}>
                          <div style={{ position:'relative' }}>
                            <span style={{ position:'absolute', left:5, top:'50%', transform:'translateY(-50%)', fontSize:10, color: k==='base' ? 'var(--acc)' : 'var(--t4)', pointerEvents:'none' }}>£</span>
                            <input
                              type="number" step="0.01" min="0"
                              style={{
                                width:'100%', background:'transparent', border:'none',
                                borderBottom:`1px solid ${p[k]!==null&&p[k]!==undefined&&k!=='base' ? 'var(--acc)' : 'var(--bdr)'}`,
                                color: k==='base' ? 'var(--acc)' : p[k]!==null&&p[k]!==undefined ? 'var(--t1)' : 'var(--t4)',
                                fontSize:12, fontFamily:'var(--font-mono)', fontWeight: k==='base' ? 800 : 500,
                                outline:'none', padding:'4px 4px 4px 16px', boxSizing:'border-box',
                              }}
                              value={p[k] !== null && p[k] !== undefined ? p[k] : ''}
                              placeholder={placeholder !== undefined ? (placeholder||0).toFixed(2) : undefined}
                              title={k==='base' ? 'Base price' : `${ORDER_TYPES.find(o=>o.id===k)?.label} price (blank = use base)`}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                updateMenuItem(item.id, {
                                  pricing: { ...p, [k]: val },
                                  ...(k === 'base' ? { price: val || 0 } : {})
                                });
                                markBOChange();
                              }}
                            />
                          </div>
                        </td>
                      ))}
                      <td style={{ padding:'9px 8px', width:72 }}>
                        <span style={{
                          fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10,
                          background: is86 ? 'var(--red-d)' : 'var(--grn-d)',
                          border:`1px solid ${is86 ? 'var(--red-b)' : 'var(--grn-b)'}`,
                          color: is86 ? 'var(--red)' : 'var(--grn)', whiteSpace:'nowrap',
                        }}>{is86 ? "86'd" : 'Active'}</span>
                      </td>
                      <td style={{ padding:'9px 6px', width:56 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', gap:3 }}>
                          <IconBtn title="Duplicate" onClick={() => { duplicateMenuItem(item.id); markBOChange(); showToast('Duplicated','success'); }}>⧉</IconBtn>
                          <IconBtn title={is86?'Reinstate':'86 item'} onClick={() => { toggle86(item.id); markBOChange(); }}
                            style={{ color: is86?'var(--grn)':'var(--red)' }}>{is86?'✓':'⊘'}</IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <footer style={{ padding:'5px 14px', borderTop:'1px solid var(--bdr)', background:'var(--bg1)', fontSize:10, color:'var(--t4)', display:'flex', gap:16, alignItems:'center' }}>
          <span>{displayItems.length} items shown</span>
          <span>Drag rows to reorder · Click to open editor</span>
          <span>Blank price = inherits base</span>
          <span style={{ marginLeft:'auto', color:eightySixIds.length?'var(--red)':'var(--t4)' }}>{eightySixIds.length} 86'd</span>
        </footer>
      </section>

      {/* ── Right: Item editor ──────────────────── */}
      <aside style={{ width:390, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        {selItem ? (
          <ItemEditor key={selItem.id} item={selItem}
            categories={menuCategories}
            onUpdate={p => { updateMenuItem(selItem.id, p); markBOChange(); }}
            onArchive={() => { archiveMenuItem(selItem.id); setSelItemId(null); markBOChange(); showToast('Item archived','info'); }}
            onClose={() => setSelItemId(null)}
            is86={eightySixIds.includes(selItem.id)}
            onToggle86={() => { toggle86(selItem.id); markBOChange(); }}
          />
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, padding:24, color:'var(--t4)', textAlign:'center' }}>
            <div style={{ fontSize:36, opacity:.2 }}>✎</div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>Click any item to edit</div>
            <div style={{ fontSize:11 }}>All changes auto-save to draft until you push to POS</div>
          </div>
        )}
      </aside>

      {catModal && (
        <CategoryModal
          cat={catModal.cat}
          categories={menuCategories}
          onSave={data => {
            if (catModal.cat?.id) {
              updateCategory(catModal.cat.id, data);
              showToast('Category updated', 'success');
            } else {
              addCategory({ menuId:'menu-1', ...data });
              showToast('Category added', 'success');
            }
            markBOChange(); setCatModal(null);
          }}
          onDelete={catModal.cat?.id ? () => {
            removeCategory(catModal.cat.id);
            if (selCatId === catModal.cat.id) setSelCatId(null);
            markBOChange(); setCatModal(null);
          } : null}
          onClose={() => setCatModal(null)}
        />
      )}
    </div>
  );
}

// ── CatTreeRow ────────────────────────────────────────────────────────────────
function CatTreeRow({ cat, idx, selCatId, menuCategories, menuItems, onSelect, onEdit, onAddSub, onDragStart, onDragOver, onDrop }) {
  const [exp, setExp] = useState(false);
  const children = menuCategories.filter(c => c.parentId === cat.id);
  const count    = menuItems.filter(i => !i.archived && (i.cat === cat.id || children.some(c => c.id === i.cat))).length;
  const isActive = selCatId === cat.id || children.some(c => c.id === selCatId);
  const color    = cat.color || '#3b82f6';

  return (
    <div style={{ marginBottom:1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:2 }}>
        {children.length > 0 && (
          <button onClick={() => setExp(e => !e)}
            style={{ width:16, height:24, background:'none', border:'none', cursor:'pointer', color:'var(--t4)', fontSize:9, padding:0, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {exp ? '▾' : '▸'}
          </button>
        )}
        <button
          style={{ ...catBtn(isActive, color), marginLeft: children.length ? 0 : 18, flex:1 }}
          draggable onDragStart={e => onDragStart(e,idx)} onDragOver={onDragOver} onDrop={e => onDrop(e,idx)}
          onClick={() => onSelect(cat.id)}
        >
          <span style={{ display:'flex', alignItems:'center', gap:5 }}><span>{cat.icon}</span><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:110 }}>{cat.label}</span></span>
          <span style={{ fontSize:9, color:'var(--t4)', background:'var(--bg3)', padding:'1px 5px', borderRadius:8, flexShrink:0 }}>{count}</span>
        </button>
        <button onClick={() => onEdit(cat)}
          style={{ width:20, height:24, background:'none', border:'none', cursor:'pointer', color:'var(--t4)', fontSize:11, padding:0, flexShrink:0, opacity:.6, transition:'opacity .1s' }}
          onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=.6}>
          ✎
        </button>
      </div>
      {exp && (
        <div style={{ paddingLeft:18 }}>
          {children.map(sub => {
            const sc = menuItems.filter(i => !i.archived && i.cat === sub.id).length;
            return (
              <button key={sub.id} onClick={() => onSelect(sub.id)}
                style={{ ...catBtn(selCatId===sub.id, sub.color||'#3b82f6'), fontSize:11, marginBottom:1, padding:'5px 8px' }}>
                <span>{sub.icon} {sub.label}</span>
                <span style={{ fontSize:9, color:'var(--t4)' }}>{sc}</span>
              </button>
            );
          })}
          <button onClick={() => onAddSub(cat.id)}
            style={{ width:'100%', padding:'3px 8px', borderRadius:6, cursor:'pointer', fontFamily:'inherit', fontSize:10, border:'none', background:'transparent', color:'var(--t4)', textAlign:'left' }}>
            + Subcategory
          </button>
        </div>
      )}
    </div>
  );
}

// ── Item editor (right panel) ─────────────────────────────────────────────────
function ItemEditor({ item, categories, onUpdate, onArchive, onClose, is86, onToggle86 }) {
  const { modifierLibrary } = useStore();
  const [tab, setTab] = useState('details');
  const TABS = [
    { id:'details',   label:'Details' },
    { id:'pricing',   label:'Pricing' },
    { id:'modifiers', label:`Modifiers${item.modifierGroups?.length ? ` (${item.modifierGroups.length})` : ''}` },
    { id:'allergens', label:`Allergens${item.allergens?.length ? ` (${item.allergens.length})` : ''}` },
    { id:'routing',   label:'Routing' },
  ];
  const p = item.pricing || { base: item.price||0, dineIn:null, takeaway:null, collection:null, delivery:null };

  return (
    <>
      {/* Editor header */}
      <div style={{ padding:'12px 14px 0', borderBottom:'1px solid var(--bdr)', flexShrink:0, background:'var(--bg1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {item.menuName || item.name}
            </div>
            <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
              {ITEM_TYPES.find(tt=>tt.id===item.type)?.label||'Simple'} · £{(p.base||0).toFixed(2)} base
              {is86 && <span style={{ marginLeft:6, color:'var(--red)', fontWeight:700 }}>86'd</span>}
            </div>
          </div>
          <button onClick={onToggle86} style={{
            fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:16, cursor:'pointer', fontFamily:'inherit',
            background: is86?'var(--grn-d)':'var(--red-d)', border:`1px solid ${is86?'var(--grn-b)':'var(--red-b)'}`,
            color: is86?'var(--grn)':'var(--red)',
          }}>{is86 ? '✓ Available' : '⊘ 86'}</button>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
        </div>
        <div style={{ display:'flex', gap:0, overflowX:'auto' }}>
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{
              padding:'6px 11px', cursor:'pointer', fontFamily:'inherit', border:'none',
              borderBottom:`2.5px solid ${tab===tb.id ? 'var(--acc)' : 'transparent'}`,
              background:'transparent', color:tab===tb.id?'var(--acc)':'var(--t4)',
              fontSize:11, fontWeight:tab===tb.id?800:500, whiteSpace:'nowrap',
            }}>{tb.label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 14px' }}>
        {tab === 'details'   && <DetailsTab   item={item} categories={categories} onUpdate={onUpdate} />}
        {tab === 'pricing'   && <PricingTab   item={item} pricing={p} onUpdate={onUpdate} />}
        {tab === 'modifiers' && <ModifiersTab item={item} onUpdate={onUpdate} library={modifierLibrary} />}
        {tab === 'allergens' && <AllergensTab item={item} onUpdate={onUpdate} />}
        {tab === 'routing'   && <RoutingTab   item={item} categories={categories} onUpdate={onUpdate} />}
      </div>

      <div style={{ padding:'10px 14px', borderTop:'1px solid var(--bdr)', flexShrink:0 }}>
        <button onClick={() => { if(confirm('Archive this item? It will be hidden from all menus.')) onArchive(); }}
          style={{ width:'100%', padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'transparent', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:600 }}>
          Archive item
        </button>
      </div>
    </>
  );
}

// ── Details tab ───────────────────────────────────────────────────────────────
function DetailsTab({ item, categories, onUpdate }) {
  const f = (k, v) => onUpdate({ [k]: v });
  const rootCats = categories.filter(c => !c.parentId && !c.isSpecial);
  const subCats  = categories.filter(c => c.parentId);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
      <div>
        <div style={t.lbl}>Item type</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {ITEM_TYPES.map(tt => (
            <button key={tt.id} onClick={() => f('type', tt.id)} style={pill((item.type||'simple')===tt.id)} title={tt.desc}>
              {tt.icon} {tt.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Menu name" hint="Shown on POS button & menus">
        <input style={t.inp} value={item.menuName||item.name||''} onChange={e => f('menuName', e.target.value)} />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <Field label="Receipt name" hint="On printed receipt">
          <input style={t.inp} value={item.receiptName||''} onChange={e => f('receiptName', e.target.value)} placeholder="Same as menu name" />
        </Field>
        <Field label="KDS / kitchen name" hint="On kitchen display">
          <input style={t.inp} value={item.kitchenName||''} onChange={e => f('kitchenName', e.target.value)} placeholder="Same as menu name" />
        </Field>
      </div>
      <Field label="Description" hint="Shown on kiosk & online ordering">
        <textarea style={{ ...t.inp, resize:'none', height:54 }} value={item.description||''} onChange={e => f('description', e.target.value)} placeholder="What makes this dish special?" />
      </Field>
      <Field label="Category">
        <select value={item.cat||''} onChange={e => f('cat', e.target.value)} style={{ ...t.inp, cursor:'pointer' }}>
          <option value="">— select category —</option>
          {rootCats.map(c => (
            <optgroup key={c.id} label={`${c.icon||''} ${c.label}`}>
              <option value={c.id}>{c.icon} {c.label}</option>
              {subCats.filter(s => s.parentId === c.id).map(s => (
                <option key={s.id} value={s.id}>  └ {s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>
      <Field label="Kitchen instructions" hint="Always printed on kitchen ticket">
        <textarea style={{ ...t.inp, resize:'none', height:44 }} value={item.instructions||''} onChange={e => f('instructions', e.target.value)} placeholder="e.g. Contains nuts — alert kitchen" />
      </Field>
      <div>
        <div style={t.lbl}>Visibility by channel</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[['pos','🖥 POS'],['kiosk','⬜ Kiosk'],['online','🌐 Online'],['onlineDelivery','🛵 Delivery']].map(([k, l]) => {
            const vis = item.visibility || { pos:true, kiosk:true, online:true, onlineDelivery:true };
            const on  = vis[k] !== false;
            return (
              <button key={k} onClick={() => onUpdate({ visibility:{ ...vis, [k]:!on } })} style={pill(on, '#22c55e')}>
                {l}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Pricing tab ───────────────────────────────────────────────────────────────
function PricingTab({ item, pricing, onUpdate }) {
  const p = pricing;
  const setPrice = (k, raw) => {
    const val = raw === '' || raw === null ? null : parseFloat(raw) || 0;
    onUpdate({ pricing:{ ...p, [k]:val }, ...(k==='base' ? { price:val||0 } : {}) });
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Base price hero */}
      <div style={{ padding:'14px 16px', background:'var(--bg3)', borderRadius:12, border:'1.5px solid var(--bdr)' }}>
        <div style={t.lbl}>Base price <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--t4)' }}>— fallback when no channel override set</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:22, color:'var(--t3)', fontWeight:700, lineHeight:1 }}>£</span>
          <input type="number" step="0.01" min="0"
            style={{ ...t.inp, fontFamily:'var(--font-mono)', fontWeight:900, fontSize:24, color:'var(--acc)', border:'none', background:'transparent', padding:'4px 0', width:'auto', flex:1 }}
            value={p.base||0}
            onChange={e => setPrice('base', e.target.value)} />
        </div>
      </div>

      {/* Per-channel overrides */}
      <div>
        <div style={t.lbl}>Price by order type</div>
        <div style={{ fontSize:11, color:'var(--t3)', marginBottom:10, lineHeight:1.5 }}>
          Set channel-specific prices. Blank = use base. Use for delivery surcharges, lunch specials, takeaway discounts.
        </div>
        {ORDER_TYPES.map(ot => {
          const val = p[ot.id];
          const hasOverride = val !== null && val !== undefined;
          return (
            <div key={ot.id} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginBottom:6,
              borderRadius:10, border:`1.5px solid ${hasOverride ? ot.color+'55' : 'var(--bdr)'}`,
              background:hasOverride ? `${ot.color}0d` : 'var(--bg3)', transition:'all .15s',
            }}>
              <span style={{ fontSize:18 }}>{ot.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:ot.color }}>{ot.label}</div>
                <div style={{ fontSize:10, color:'var(--t4)' }}>{ot.hint}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:12, color:'var(--t4)' }}>£</span>
                <input type="number" step="0.01" min="0"
                  style={{ ...t.inp, width:80, fontFamily:'var(--font-mono)', fontWeight:700, fontSize:14, padding:'6px 8px' }}
                  value={hasOverride ? val : ''}
                  placeholder={(p.base||0).toFixed(2)}
                  onChange={e => setPrice(ot.id, e.target.value)} />
                {hasOverride && (
                  <button onClick={() => setPrice(ot.id, null)}
                    style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:16, lineHeight:1, padding:0 }}>×</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scope */}
      <div>
        <div style={t.lbl}>Multi-site scope</div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {SCOPES.map(s => {
            const active = (item.scope||'local') === s.id;
            return (
              <button key={s.id} onClick={() => onUpdate({ scope:s.id })}
                style={{ padding:'9px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:10, border:`1.5px solid ${active?s.color:'var(--bdr)'}`, background:active?`${s.color}12`:'var(--bg3)' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:active?s.color:'var(--t1)' }}>{s.label}</div>
                  <div style={{ fontSize:10, color:'var(--t4)' }}>{s.desc}</div>
                </div>
                {active && <span style={{ color:s.color, fontSize:14 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Modifiers tab ─────────────────────────────────────────────────────────────
function ModifiersTab({ item, onUpdate, library }) {
  const groups    = item.modifierGroups || [];
  const [openIdx, setOpenIdx] = useState(null);
  const [modQ, setModQ]       = useState('');
  const [newGrp, setNewGrp]   = useState('');

  const setGroups = gs => onUpdate({ modifierGroups:gs });
  const updGroup  = (i, patch) => setGroups(groups.map((g,gi) => gi===i ? { ...g,...patch } : g));
  const delGroup  = i => { setGroups(groups.filter((_,gi) => gi!==i)); if(openIdx===i) setOpenIdx(null); };
  const addGroup  = () => {
    if (!newGrp.trim()) return;
    setGroups([...groups, { id:`mg-${Date.now()}`, label:newGrp.trim(), selectionType:'single', min:0, max:1, free:0, modifierIds:[] }]);
    setNewGrp(''); setOpenIdx(groups.length);
  };

  const addMod    = (gi, id) => { const g=groups[gi]; if(!g.modifierIds?.includes(id)) updGroup(gi,{ modifierIds:[...(g.modifierIds||[]),id] }); };
  const removeMod = (gi, id) => updGroup(gi,{ modifierIds:(groups[gi].modifierIds||[]).filter(x=>x!==id) });

  const libFiltered = library.filter(m =>
    !modQ || m.name.toLowerCase().includes(modQ.toLowerCase()) || (m.category||'').toLowerCase().includes(modQ.toLowerCase())
  );

  if (item.type === 'variants') return <VariantsTab item={item} onUpdate={onUpdate} />;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.5 }}>
        Build modifier groups from your modifier library. Groups define what choices the customer makes when ordering this item.
      </div>

      {/* Existing groups */}
      {groups.map((g, gi) => {
        const mods = (g.modifierIds||[]).map(id => library.find(m=>m.id===id)).filter(Boolean);
        const open = openIdx === gi;
        return (
          <div key={g.id} style={{ borderRadius:11, border:`1.5px solid ${open?'var(--acc)':'var(--bdr)'}`, overflow:'hidden' }}>
            {/* Group header */}
            <div style={{ padding:'9px 12px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', background:open?'var(--acc-d)':'var(--bg3)' }}
              onClick={() => setOpenIdx(open ? null : gi)}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:open?'var(--acc)':'var(--t1)' }}>{g.label}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
                  {MOD_TYPES.find(mt=>mt.id===g.selectionType)?.label} ·
                  {g.min>0?' Required':' Optional'} ·
                  {` ${mods.length} modifier${mods.length!==1?'s':''}`}
                  {g.selectionType!=='single'&&g.max>1?` · max ${g.max}`:''}
                </div>
              </div>
              <div style={{ display:'flex', gap:5 }}>
                <IconBtn onClick={e=>{e.stopPropagation();delGroup(gi);}} style={{ color:'var(--red)' }}>×</IconBtn>
                <span style={{ fontSize:10, color:open?'var(--acc)':'var(--t4)' }}>{open?'▲':'▼'}</span>
              </div>
            </div>

            {/* Group editor */}
            {open && (
              <div style={{ padding:'12px', borderTop:'1px solid var(--bdr)' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                  <input style={t.inp} value={g.label} onChange={e=>updGroup(gi,{label:e.target.value})} placeholder="Group name"/>
                  <div>
                    <div style={t.lbl}>Selection type</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {MOD_TYPES.map(mt => (
                        <button key={mt.id} onClick={()=>updGroup(gi,{selectionType:mt.id,max:mt.id==='single'?1:g.max||3})}
                          style={{ padding:'8px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', gap:10, alignItems:'center', border:`1.5px solid ${g.selectionType===mt.id?'var(--acc)':'var(--bdr)'}`, background:g.selectionType===mt.id?'var(--acc-d)':'var(--bg3)' }}>
                          <span style={{ fontSize:16 }}>{mt.icon}</span>
                          <div>
                            <div style={{ fontSize:12, fontWeight:700, color:g.selectionType===mt.id?'var(--acc)':'var(--t1)' }}>{mt.label}</div>
                            <div style={{ fontSize:10, color:'var(--t4)' }}>{mt.desc}</div>
                          </div>
                          {g.selectionType===mt.id && <span style={{ marginLeft:'auto', color:'var(--acc)' }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'var(--t2)' }}>
                      <input type="checkbox" checked={g.min>0} onChange={e=>updGroup(gi,{min:e.target.checked?1:0})} style={{ accentColor:'var(--acc)', width:14, height:14 }}/>
                      Required (min 1)
                    </label>
                    {g.selectionType!=='single' && (
                      <>
                        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--t2)' }}>
                          Max choices:
                          <input type="number" min="1" max="20"
                            style={{ ...t.inp, width:54, padding:'4px 8px' }}
                            value={g.max||1} onChange={e=>updGroup(gi,{max:parseInt(e.target.value)||1})}/>
                        </label>
                        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--t2)' }}>
                          Free:
                          <input type="number" min="0" max="20"
                            style={{ ...t.inp, width:54, padding:'4px 8px' }}
                            value={g.free||0} onChange={e=>updGroup(gi,{free:parseInt(e.target.value)||0})}/>
                        </label>
                      </>
                    )}
                  </div>
                </div>

                {/* Current modifiers in group */}
                <div style={t.lbl}>Modifiers in this group</div>
                {mods.length===0 && <div style={{ fontSize:11, color:'var(--t4)', marginBottom:8 }}>Search the library below to add modifiers ↓</div>}
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                  {mods.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 5px 3px 9px', borderRadius:20, background:'var(--acc-d)', border:'1px solid var(--acc-b)' }}>
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--acc)' }}>{m.name}</span>
                      {m.price>0 && <span style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--font-mono)' }}>+£{m.price.toFixed(2)}</span>}
                      <button onClick={()=>removeMod(gi,m.id)}
                        style={{ background:'none', border:'none', color:'var(--acc)', cursor:'pointer', fontSize:15, lineHeight:1, padding:'0 2px' }}>×</button>
                    </div>
                  ))}
                </div>

                {/* Library search for this group */}
                <input style={t.inp} placeholder="Search modifier library…" value={modQ} onChange={e=>setModQ(e.target.value)} />
                {modQ && (
                  <div style={{ maxHeight:140, overflowY:'auto', border:'1px solid var(--bdr)', borderRadius:8, marginTop:4 }}>
                    {libFiltered.filter(m=>!(g.modifierIds||[]).includes(m.id)).slice(0,20).map(m => (
                      <button key={m.id} onClick={()=>{addMod(gi,m.id);}}
                        style={{ width:'100%', padding:'7px 10px', cursor:'pointer', fontFamily:'inherit', background:'transparent', border:'none', borderBottom:'1px solid var(--bdr)', textAlign:'left', fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <span>
                          <span style={{ color:'var(--t1)', fontWeight:500 }}>{m.name}</span>
                          <span style={{ color:'var(--t4)', fontSize:10, marginLeft:6 }}>({m.category})</span>
                        </span>
                        {m.price>0 && <span style={{ color:'var(--acc)', fontFamily:'var(--font-mono)', fontSize:11, flexShrink:0 }}>+£{m.price.toFixed(2)}</span>}
                      </button>
                    ))}
                    {libFiltered.filter(m=>!(g.modifierIds||[]).includes(m.id)).length===0 && (
                      <div style={{ padding:'10px', fontSize:11, color:'var(--t4)', textAlign:'center' }}>All matching modifiers already added</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add new group */}
      <div style={{ display:'flex', gap:6, marginTop:4 }}>
        <input style={{ ...t.inp, flex:1 }} value={newGrp} onChange={e=>setNewGrp(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="New group name (e.g. Cooking preference, Sauce)"/>
        <button onClick={addGroup} disabled={!newGrp.trim()}
          style={{ padding:'8px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700, flexShrink:0, opacity:newGrp.trim()?1:.4 }}>
          Add group
        </button>
      </div>
    </div>
  );
}

// ── Variants tab ──────────────────────────────────────────────────────────────
function VariantsTab({ item, onUpdate }) {
  const vs = item.variants || [];
  const upd = v => onUpdate({ variants:v });
  return (
    <div>
      <div style={{ fontSize:11, color:'var(--t3)', marginBottom:12 }}>Customers pick one size. Price shows "from £X" on menus.</div>
      {vs.map((v, i) => (
        <div key={v.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px auto', gap:6, marginBottom:6, alignItems:'center' }}>
          <input style={t.inp} value={v.label} onChange={e=>upd(vs.map((x,j)=>j===i?{...x,label:e.target.value}:x))} placeholder="Small / Regular / Large"/>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--t4)' }}>£</span>
            <input type="number" step="0.01" style={{ ...t.inp, paddingLeft:20 }} value={v.price||0} onChange={e=>upd(vs.map((x,j)=>j===i?{...x,price:parseFloat(e.target.value)||0}:x))}/>
          </div>
          <button onClick={()=>upd(vs.filter((_,j)=>j!==i))} style={{ width:30, height:36, borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:14 }}>×</button>
        </div>
      ))}
      <button onClick={()=>upd([...vs,{id:`v-${Date.now()}`,label:'',price:0}])}
        style={{ padding:'6px 14px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600 }}>
        + Add size
      </button>
    </div>
  );
}

// ── Allergens tab ─────────────────────────────────────────────────────────────
function AllergensTab({ item, onUpdate }) {
  const toggle = id => {
    const a = item.allergens || [];
    onUpdate({ allergens: a.includes(id) ? a.filter(x=>x!==id) : [...a,id] });
  };
  return (
    <div>
      <div style={{ fontSize:11, color:'var(--t3)', marginBottom:12, lineHeight:1.5 }}>All 14 EU/UK mandatory allergens. Declared allergens show on receipts and require staff confirmation on every order.</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
        {ALLERGENS.map(a => {
          const on = (item.allergens||[]).includes(a.id);
          return (
            <button key={a.id} onClick={()=>toggle(a.id)}
              style={{ padding:'8px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:7, border:`1.5px solid ${on?'var(--red)':'var(--bdr)'}`, background:on?'var(--red-d)':'var(--bg3)', color:on?'var(--red)':'var(--t2)', transition:'all .1s' }}>
              <span style={{ fontSize:15 }}>{a.icon}</span>
              <span style={{ fontSize:11, fontWeight:on?700:400, flex:1 }}>{a.label}</span>
              {on && <span style={{ fontSize:12 }}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Routing tab ───────────────────────────────────────────────────────────────
function RoutingTab({ item, categories, onUpdate }) {
  const cat     = categories.find(c => c.id === item.cat);
  const centres = PRODUCTION_CENTRES || [];
  const COURSES = [
    { id:null, label:'Inherit from category' },
    { id:1,    label:'Course 1 — Starters' },
    { id:2,    label:'Course 2 — Mains' },
    { id:3,    label:'Course 3 — Desserts' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div>
        <div style={t.lbl}>Production centre</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <button onClick={()=>onUpdate({productionCentreId:null})}
            style={{ ...catBtn(!item.productionCentreId), textAlign:'left', padding:'7px 10px', borderRadius:8 }}>
            Inherit from category {cat?.defaultProductionCentreId ? `(${centres.find(p=>p.id===cat.defaultProductionCentreId)?.name||cat.defaultProductionCentreId})` : '(none set)'}
          </button>
          {centres.map(pc => (
            <button key={pc.id} onClick={()=>onUpdate({productionCentreId:pc.id})}
              style={{ ...catBtn(item.productionCentreId===pc.id), textAlign:'left', padding:'7px 10px', borderRadius:8, gap:8 }}>
              <span>{pc.icon}</span>{pc.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={t.lbl}>Course</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {COURSES.map(c => (
            <button key={String(c.id)} onClick={()=>onUpdate({course:c.id})}
              style={{ ...catBtn(item.course===c.id), textAlign:'left', padding:'7px 10px', borderRadius:8 }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODIFIERS MODE
// ═════════════════════════════════════════════════════════════════════════════
function ModifiersMode() {
  const { modifierLibrary, addModifier, updateModifier, removeModifier, markBOChange, showToast } = useStore();
  const [search, setSearch]   = useState('');
  const [catFilter, setCat]   = useState('all');
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState({ name:'', price:'', category:'' });

  const cats = useMemo(() => ['all', ...new Set(modifierLibrary.map(m=>m.category||'Other'))], [modifierLibrary]);

  const filtered = useMemo(() => modifierLibrary.filter(m => {
    if (catFilter !== 'all' && (m.category||'Other') !== catFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [modifierLibrary, catFilter, search]);

  const grouped = useMemo(() => filtered.reduce((acc, m) => {
    const c = m.category || 'Other';
    if (!acc[c]) acc[c] = [];
    acc[c].push(m);
    return acc;
  }, {}), [filtered]);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addModifier({ name:form.name.trim(), price:parseFloat(form.price)||0, category:form.category||'Other', allergens:[] });
    markBOChange();
    showToast(`"${form.name}" added`, 'success');
    setForm(f => ({ ...f, name:'', price:'' }));
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Main library */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', marginBottom:1 }}>Modifier library</div>
          <div style={{ fontSize:11, color:'var(--t3)' }}>Create modifiers here, then add them to item modifier groups on the Items tab.</div>
        </div>

        {/* Add form */}
        <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
          <div style={{ flex:3 }}>
            <div style={t.lbl}>Modifier name</div>
            <input style={t.inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleAdd()} placeholder="e.g. Truffle oil, Rare, Béarnaise sauce"/>
          </div>
          <div style={{ flex:1 }}>
            <div style={t.lbl}>Price</div>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--t4)' }}>£</span>
              <input type="number" step="0.01" style={{ ...t.inp, paddingLeft:18 }} value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0.00"/>
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={t.lbl}>Category</div>
            <input style={t.inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Sauce, Cooking…" list="mod-cats-list"/>
            <datalist id="mod-cats-list">{cats.filter(c=>c!=='all').map(c=><option key={c} value={c}/>)}</datalist>
          </div>
          <button onClick={handleAdd} disabled={!form.name.trim()}
            style={{ padding:'8px 18px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, opacity:form.name.trim()?1:.4, flexShrink:0 }}>
            Add
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ padding:'8px 18px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', gap:6, alignItems:'center', overflowX:'auto', flexShrink:0 }}>
          <div style={{ position:'relative', flex:1, maxWidth:240 }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:12 }}>🔍</span>
            <input style={{ ...t.inp, paddingLeft:28 }} placeholder="Search modifiers…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {cats.map(c => (
            <button key={c} onClick={()=>setCat(c)} style={pill(catFilter===c, 'var(--acc)')}>
              {c==='all'?'All':c}
            </button>
          ))}
        </div>

        {/* Modifier list */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 18px' }}>
          {Object.entries(grouped).map(([cat, mods]) => (
            <div key={cat} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.09em', marginBottom:8, paddingBottom:4, borderBottom:'1px solid var(--bdr)' }}>
                {cat} <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>({mods.length})</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:6 }}>
                {mods.map(m => (
                  <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:9, border:'1px solid var(--bdr)', background:'var(--bg3)' }}>
                    {editId === m.id ? (
                      <EditModRow m={m} onSave={patch=>{ updateModifier(m.id,patch); markBOChange(); setEditId(null); }} onCancel={()=>setEditId(null)} cats={cats}/>
                    ) : (
                      <>
                        <span style={{ flex:1, fontSize:12, fontWeight:600, color:'var(--t1)' }}>{m.name}</span>
                        {m.allergens?.length>0 && <span style={{ fontSize:10, color:'var(--red)', fontWeight:700 }}>⚠</span>}
                        <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:m.price>0?'var(--acc)':'var(--t4)', minWidth:36, textAlign:'right' }}>
                          {m.price>0?`+£${m.price.toFixed(2)}`:' free'}
                        </span>
                        <IconBtn onClick={()=>setEditId(m.id)}>✎</IconBtn>
                        <IconBtn style={{ color:'var(--red)' }} onClick={()=>{ if(confirm(`Remove "${m.name}" from library?`)){ removeModifier(m.id); markBOChange(); }}}>×</IconBtn>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px', color:'var(--t4)' }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:.2 }}>⊕</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>{search || catFilter!=='all' ? 'No results' : 'Add your first modifier above'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Right: usage map */}
      <div style={{ width:260, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)' }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)' }}>Library overview</div>
          <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{modifierLibrary.length} total modifiers</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
          {cats.filter(c=>c!=='all').map(c => {
            const ms = modifierLibrary.filter(m=>(m.category||'Other')===c);
            return (
              <div key={c} style={{ marginBottom:12, padding:'10px', background:'var(--bg3)', borderRadius:9, border:'1px solid var(--bdr)' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', marginBottom:6 }}>{c} ({ms.length})</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                  {ms.map(m => (
                    <span key={m.id} style={{ fontSize:10, padding:'2px 6px', borderRadius:12, background:'var(--bg1)', border:'1px solid var(--bdr)', color:'var(--t3)' }}>
                      {m.name}{m.price>0?` +£${m.price.toFixed(2)}`:' free'}
                    </span>
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

function EditModRow({ m, onSave, onCancel, cats }) {
  const [name, setName]   = useState(m.name);
  const [price, setPrice] = useState(m.price||0);
  const [cat, setCat]     = useState(m.category||'');
  return (
    <div style={{ display:'flex', gap:5, flex:1, alignItems:'center' }}>
      <input style={{ ...t.inp, flex:2, height:30, padding:'4px 8px', fontSize:12 }} value={name} onChange={e=>setName(e.target.value)} autoFocus/>
      <div style={{ position:'relative', flex:1 }}>
        <span style={{ position:'absolute', left:5, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--t4)' }}>£</span>
        <input type="number" step="0.01" style={{ ...t.inp, paddingLeft:14, height:30, padding:'4px 6px 4px 16px', fontSize:12 }} value={price} onChange={e=>setPrice(e.target.value)}/>
      </div>
      <input style={{ ...t.inp, flex:1, height:30, padding:'4px 8px', fontSize:11 }} value={cat} onChange={e=>setCat(e.target.value)} list="mod-cats-list"/>
      <button onClick={()=>onSave({name,price:parseFloat(price)||0,category:cat})} style={{ background:'var(--acc)', border:'none', color:'#0b0c10', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:11, padding:'4px 8px' }}>✓</button>
      <button onClick={onCancel} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:14 }}>×</button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BUILDER MODE — Full-page interactive preview
// ═════════════════════════════════════════════════════════════════════════════
function BuilderMode() {
  const {
    menuCategories, menuItems, reorderMenuItems, reorderCategories,
    updateMenuItem, updateCategory, addMenuItem, markBOChange, eightySixIds,
  } = useStore();

  const [selId, setSelId]     = useState(null);
  const [selType, setSelType] = useState(null); // 'item' | 'cat'
  const [activeCat, setAct]   = useState(null);
  const [preview, setPrev]    = useState('pos');
  const [dragCat, setDragCat] = useState(null);
  const [dragItem, setDragItem]     = useState(null);
  const [dragOverItem, setDragOver] = useState(null);

  const rootCats = useMemo(() =>
    menuCategories.filter(c=>!c.parentId&&!c.isSpecial).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)),
    [menuCategories]
  );

  const displayCat = activeCat || rootCats[0]?.id;

  const catItems = useMemo(() => {
    if (!displayCat) return menuItems.filter(i=>!i.archived).slice(0,12);
    const childIds = menuCategories.filter(c=>c.parentId===displayCat).map(c=>c.id);
    return menuItems.filter(i=>!i.archived&&(i.cat===displayCat||childIds.includes(i.cat)))
      .sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
  }, [menuItems, displayCat, menuCategories]);

  const selItem = selType==='item' ? menuItems.find(i=>i.id===selId) : null;
  const selCat  = selType==='cat'  ? menuCategories.find(c=>c.id===selId) : null;

  const COLS  = preview==='handheld' ? 2 : preview==='kiosk' ? 4 : 3;
  const CARD_H = preview==='kiosk' ? 180 : preview==='handheld' ? 96 : 120;

  // Cat drag
  const catDS = (e,id,idx)=>{ setDragCat({id,idx}); e.dataTransfer.effectAllowed='move'; };
  const catDr = (e,toIdx)=>{ e.preventDefault(); if(dragCat&&dragCat.idx!==toIdx){ reorderCategories(dragCat.idx,toIdx); markBOChange(); } setDragCat(null); };

  // Item drag
  const itemDS = (e,item,idx)=>{ setDragItem({item,idx}); e.dataTransfer.effectAllowed='move'; };
  const itemDr = (e,toIdx)=>{ e.preventDefault(); if(dragItem&&dragItem.idx!==toIdx&&displayCat){ reorderMenuItems(displayCat,dragItem.idx,toIdx); markBOChange(); } setDragItem(null); setDragOver(null); };

  const addItem = () => {
    addMenuItem({ name:'New item', menuName:'New item', receiptName:'New item', kitchenName:'New item', cat:displayCat, type:'simple', allergens:[], modifierGroups:[], pricing:{base:0,dineIn:null,takeaway:null,collection:null,delivery:null} });
    markBOChange();
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* ── Canvas ────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg)' }}>
        {/* Builder toolbar */}
        <div style={{ padding:'8px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--t3)', marginRight:8 }}>Preview as:</span>
            <div style={{ display:'inline-flex', background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:9, padding:3, gap:2 }}>
              {[['pos','🖥 POS'],['kiosk','⬜ Kiosk'],['handheld','📱 Handheld']].map(([id,l])=>(
                <button key={id} onClick={()=>setPrev(id)}
                  style={{ padding:'4px 12px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:preview===id?'var(--bg1)':'transparent', border:preview===id?'1px solid var(--bdr2)':'1px solid transparent', color:preview===id?'var(--t1)':'var(--t3)', fontSize:12, fontWeight:preview===id?700:400, transition:'all .1s' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize:11, color:'var(--t4)' }}>Drag tabs & cards to reorder · Click to select & edit in panel →</div>
          <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:800, padding:'3px 8px', borderRadius:10, background:'var(--acc-d)', border:'1px solid var(--acc-b)', color:'var(--acc)' }}>LIVE PREVIEW</span>
            <button onClick={addItem}
              style={{ padding:'5px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700 }}>
              + Item
            </button>
          </div>
        </div>

        {/* Preview frame */}
        <div style={{ flex:1, overflow:'auto', padding:20, display:'flex', alignItems:'flex-start', justifyContent:'center' }}>
          <div style={{
            background:'var(--bg1)', borderRadius:16, border:'2px solid var(--bdr)',
            boxShadow:'0 8px 40px rgba(0,0,0,.12)', overflow:'hidden',
            width:'100%',
            maxWidth: preview==='handheld' ? 360 : preview==='kiosk' ? 960 : 800,
          }}>
            {/* Category tabs row */}
            <div style={{ display:'flex', overflowX:'auto', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)', padding:'6px 10px', gap:4, minHeight:46, alignItems:'center' }}>
              {rootCats.map((cat, idx) => {
                const active = displayCat === cat.id;
                const selC   = selId===cat.id&&selType==='cat';
                return (
                  <div key={cat.id}
                    draggable
                    onDragStart={e=>catDS(e,cat.id,idx)}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>catDr(e,idx)}
                    onClick={()=>{ setAct(cat.id); setSelId(cat.id); setSelType('cat'); }}
                    style={{
                      padding: preview==='handheld' ? '5px 8px' : '7px 14px',
                      borderRadius:9, cursor:'pointer', userSelect:'none', whiteSpace:'nowrap',
                      fontSize: preview==='handheld' ? 11 : 13,
                      fontWeight:active ? 700 : 400,
                      background: selC ? 'var(--acc)' : active ? 'var(--bg1)' : 'transparent',
                      color: selC ? '#0b0c10' : active ? 'var(--t1)' : 'var(--t3)',
                      border:`2px solid ${selC?'var(--acc)':active?'var(--bdr)':'transparent'}`,
                      transition:'all .1s', display:'flex', alignItems:'center', gap:5,
                    }}>
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span style={{ fontSize:8, color:active?'var(--t4)':'var(--t4)', opacity:.6, marginLeft:2, cursor:'grab' }}>⣿</span>
                  </div>
                );
              })}
            </div>

            {/* Item grid */}
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${COLS},1fr)`, gap:8, padding:10 }}>
              {catItems.map((item, idx) => {
                const is86   = eightySixIds.includes(item.id);
                const selI   = selId===item.id&&selType==='item';
                const dragO  = dragOverItem===idx;
                const p      = item.pricing || { base:item.price||0 };
                const price  = p.dineIn!==null&&p.dineIn!==undefined ? p.dineIn : p.base;

                return (
                  <div key={item.id}
                    draggable
                    onDragStart={e=>itemDS(e,item,idx)}
                    onDragOver={e=>{ e.preventDefault(); setDragOver(idx); }}
                    onDragLeave={()=>setDragOver(null)}
                    onDrop={e=>itemDr(e,idx)}
                    onClick={()=>{ setSelId(item.id); setSelType('item'); }}
                    style={{
                      borderRadius:10, cursor:'pointer', userSelect:'none',
                      border:`${selI?'2.5px':'1.5px'} solid ${selI?'var(--acc)':dragO?'var(--acc)':is86?'var(--red-b)':'var(--bdr2)'}`,
                      background: selI?'var(--acc-d)':dragO?'var(--bg3)':is86?'var(--red-d)':'var(--bg3)',
                      height:CARD_H, display:'flex', flexDirection:'column', padding:10,
                      opacity:is86?.5:1, transition:'border-color .1s, background .1s',
                      position:'relative', overflow:'hidden',
                    }}>
                    <span style={{ position:'absolute', top:4, right:5, fontSize:8, color:'var(--t4)', opacity:.5, cursor:'grab', userSelect:'none' }}>⣿</span>
                    <div style={{ flex:1, minHeight:0 }}>
                      <div style={{ fontSize:preview==='handheld'?10:12, fontWeight:700, color:selI?'var(--acc)':'var(--t1)', lineHeight:1.3, marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace: preview==='handheld'?'nowrap':'normal', display:preview!=='handheld'?'-webkit-box':undefined, WebkitLineClamp:preview!=='handheld'?2:undefined, WebkitBoxOrient:preview!=='handheld'?'vertical':undefined }}>
                        {item.menuName||item.name}
                      </div>
                      {preview==='kiosk' && item.description && (
                        <div style={{ fontSize:10, color:'var(--t3)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.4 }}>{item.description}</div>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto', paddingTop:4 }}>
                      <span style={{ fontSize:preview==='handheld'?12:15, fontWeight:800, color:selI?'var(--acc)':'var(--t1)', fontFamily:'var(--font-mono)' }}>
                        £{price.toFixed(2)}
                      </span>
                      <div style={{ display:'flex', gap:3 }}>
                        {item.allergens?.length>0 && <span style={{ fontSize:9, color:'var(--red)', fontWeight:800 }}>⚠</span>}
                        {item.modifierGroups?.length>0 && <span style={{ fontSize:9, color:'var(--t4)' }}>⊕</span>}
                        {is86 && <span style={{ fontSize:8, fontWeight:800, color:'var(--red)' }}>86</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add item placeholder */}
              <button onClick={addItem}
                style={{ height:CARD_H, borderRadius:10, border:'2px dashed var(--bdr)', background:'transparent', cursor:'pointer', fontFamily:'inherit', color:'var(--t4)', fontSize:28, display:'flex', alignItems:'center', justifyContent:'center', transition:'border-color .1s, color .1s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--acc)'; e.currentTarget.style.color='var(--acc)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--bdr)'; e.currentTarget.style.color='var(--t4)'; }}>
                +
              </button>
            </div>

            {/* Status bar */}
            <div style={{ padding:'6px 14px', borderTop:'1px solid var(--bdr)', background:'var(--bg2)', display:'flex', gap:14, alignItems:'center' }}>
              <span style={{ fontSize:10, color:'var(--t4)' }}>{catItems.length} items in {menuCategories.find(c=>c.id===displayCat)?.label||'category'}</span>
              <span style={{ fontSize:10, color:'var(--t4)' }}>{rootCats.length} categories</span>
              <span style={{ fontSize:10, color:'var(--t4)' }}>Preview: {preview}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right edit panel ──────── */}
      <div style={{ width:370, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
        {selItem ? (
          <>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:1 }}>{selItem.menuName||selItem.name}</div>
              <div style={{ fontSize:10, color:'var(--t4)' }}>Click any field to edit · Changes apply immediately</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:14 }}>
              <BuilderItemEditor item={selItem} categories={menuCategories}
                onUpdate={p=>{ updateMenuItem(selItem.id,p); markBOChange(); }}/>
            </div>
          </>
        ) : selCat ? (
          <>
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:1 }}>{selCat.icon} {selCat.label}</div>
              <div style={{ fontSize:10, color:'var(--t4)' }}>Category settings</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:14 }}>
              <BuilderCatEditor cat={selCat} onUpdate={p=>{ updateCategory(selCat.id,p); markBOChange(); }}/>
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', padding:24 }}>
            <div style={{ color:'var(--t4)' }}>
              <div style={{ fontSize:40, opacity:.15, marginBottom:12 }}>⬚</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>Click any item or category to edit</div>
              <div style={{ fontSize:11, lineHeight:1.6 }}>Drag category tabs to reorder<br/>Drag item cards to reorder within category<br/>Click + to add new items</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BuilderItemEditor({ item, categories, onUpdate }) {
  const p = item.pricing || { base:item.price||0, dineIn:null, takeaway:null, collection:null, delivery:null };
  const rootCats = categories.filter(c=>!c.parentId&&!c.isSpecial);
  const f = (k,v) => onUpdate({ [k]:v });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
      <Field label="Menu name"><input style={t.inp} value={item.menuName||item.name||''} onChange={e=>f('menuName',e.target.value)}/></Field>
      <Field label="Description"><textarea style={{ ...t.inp, resize:'none', height:48 }} value={item.description||''} onChange={e=>f('description',e.target.value)}/></Field>
      <div>
        <div style={t.lbl}>Type</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {ITEM_TYPES.map(tt=><button key={tt.id} onClick={()=>f('type',tt.id)} style={pill((item.type||'simple')===tt.id)}>{tt.icon} {tt.label}</button>)}
        </div>
      </div>
      <Field label="Category">
        <select value={item.cat||''} onChange={e=>f('cat',e.target.value)} style={{ ...t.inp, cursor:'pointer' }}>
          {rootCats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
      </Field>
      <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px' }}>
        <div style={t.lbl}>Pricing</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <span style={{ fontSize:11, color:'var(--t3)', width:72, flexShrink:0 }}>Base £</span>
          <input type="number" step="0.01" style={{ ...t.inp, color:'var(--acc)', fontWeight:800 }} value={p.base||0} onChange={e=>{ const v=parseFloat(e.target.value)||0; onUpdate({ pricing:{...p,base:v}, price:v }); }}/>
        </div>
        {ORDER_TYPES.map(ot=>(
          <div key={ot.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
            <span style={{ fontSize:10, color:ot.color, width:72, flexShrink:0 }}>{ot.icon} {ot.label}</span>
            <input type="number" step="0.01" style={{ ...t.inp, fontSize:12 }}
              value={p[ot.id]!==null&&p[ot.id]!==undefined?p[ot.id]:''}
              placeholder={`${p.base||0} (base)`}
              onChange={e=>onUpdate({ pricing:{...p,[ot.id]:e.target.value===''?null:parseFloat(e.target.value)||0} })}/>
          </div>
        ))}
      </div>
      <div>
        <div style={t.lbl}>Allergens</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {ALLERGENS.map(a=>{
            const on=(item.allergens||[]).includes(a.id);
            return <button key={a.id} onClick={()=>onUpdate({ allergens:on?(item.allergens||[]).filter(x=>x!==a.id):[...(item.allergens||[]),a.id] })} style={pill(on,'var(--red)')}>{a.icon} {a.label}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

function BuilderCatEditor({ cat, onUpdate }) {
  const ICONS    = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🌿','🔥','❄️','🏷','⭐','🥐','🌮','🦞','🍜','🥩'];
  const PALETTE  = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899','#10b981','#8b5cf6','#06b6d4','#84cc16'];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
      <Field label="Name"><input style={t.inp} value={cat.label||''} onChange={e=>onUpdate({label:e.target.value})}/></Field>
      <div>
        <div style={t.lbl}>Icon</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {ICONS.map(ic=><button key={ic} onClick={()=>onUpdate({icon:ic})} style={{ width:34, height:34, borderRadius:7, border:`1.5px solid ${cat.icon===ic?'var(--acc)':'var(--bdr)'}`, background:cat.icon===ic?'var(--acc-d)':'var(--bg3)', cursor:'pointer', fontSize:17 }}>{ic}</button>)}
        </div>
      </div>
      <div>
        <div style={t.lbl}>Colour</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
          {PALETTE.map(c=><button key={c} onClick={()=>onUpdate({color:c})} style={{ width:26, height:26, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline:cat.color===c?'3px solid var(--t1)':'3px solid transparent', outlineOffset:2 }}/>)}
        </div>
      </div>
      <Field label="Accounting group"><input style={t.inp} value={cat.accountingGroup||''} onChange={e=>onUpdate({accountingGroup:e.target.value})} placeholder="Food, Beverages, Alcohol"/></Field>
      <Field label="Statistic group"><input style={t.inp} value={cat.statisticGroup||''} onChange={e=>onUpdate({statisticGroup:e.target.value})} placeholder="Hot starters, Cocktails…"/></Field>
    </div>
  );
}

// ── Category modal ─────────────────────────────────────────────────────────────
function CategoryModal({ cat, categories, onSave, onDelete, onClose }) {
  const isNew    = !cat?.id;
  const parentId = cat?._parentId || cat?.parentId || null;
  const [label, setLabel]   = useState(cat?.label||'');
  const [icon, setIcon]     = useState(cat?.icon||'🍽');
  const [color, setColor]   = useState(cat?.color||'#3b82f6');
  const [acct, setAcct]     = useState(cat?.accountingGroup||'Food & Beverage');
  const [stat, setStat]     = useState(cat?.statisticGroup||'');
  const [defCentre, setDC]  = useState(cat?.defaultProductionCentreId||null);
  const [defCourse, setDCo] = useState(cat?.defaultCourse||null);
  const ICONS   = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🌿','🔥','❄️','🏷','⭐','🥐','🌮','🦞','🍜','🥩','🍤','🥚'];
  const PALETTE = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899','#10b981','#8b5cf6','#06b6d4','#84cc16'];
  const COURSES = [{id:null,label:'None'},{id:1,label:'Course 1 — Starters'},{id:2,label:'Course 2 — Mains'},{id:3,label:'Course 3 — Desserts'}];
  const centres = PRODUCTION_CENTRES || [];

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:460, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>{isNew ? (parentId?'New subcategory':'New category') : 'Edit category'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
          <Field label="Name"><input style={t.inp} value={label} onChange={e=>setLabel(e.target.value)} autoFocus/></Field>
          <div>
            <div style={t.lbl}>Icon</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{ width:34, height:34, borderRadius:7, border:`1.5px solid ${icon===ic?'var(--acc)':'var(--bdr)'}`, background:icon===ic?'var(--acc-d)':'var(--bg3)', cursor:'pointer', fontSize:17 }}>{ic}</button>)}</div>
          </div>
          <div>
            <div style={t.lbl}>Colour</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{PALETTE.map(c=><button key={c} onClick={()=>setColor(c)} style={{ width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline:color===c?'3px solid var(--t1)':'3px solid transparent', outlineOffset:2 }}/>)}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Accounting group"><input style={t.inp} value={acct} onChange={e=>setAcct(e.target.value)} placeholder="Food, Beverages"/></Field>
            <Field label="Statistic group"><input style={t.inp} value={stat} onChange={e=>setStat(e.target.value)} placeholder="Hot starters…"/></Field>
          </div>
          <Field label="Default production centre">
            <select value={defCentre||''} onChange={e=>setDC(e.target.value||null)} style={{ ...t.inp, cursor:'pointer' }}>
              <option value="">None — items inherit own setting</option>
              {centres.map(pc=><option key={pc.id} value={pc.id}>{pc.name}</option>)}
            </select>
          </Field>
          <Field label="Default course">
            <select value={defCourse||''} onChange={e=>setDCo(e.target.value?parseInt(e.target.value):null)} style={{ ...t.inp, cursor:'pointer' }}>
              {COURSES.map(c=><option key={String(c.id)} value={c.id||''}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ padding:'10px 18px', borderTop:'1px solid var(--bdr)', display:'flex', gap:6 }}>
          {!isNew && onDelete && (
            <button onClick={onDelete}
              style={{ padding:'7px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>
              Remove
            </button>
          )}
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:2, height:38 }}
            disabled={!label.trim()}
            onClick={()=>onSave({ label:label.trim(), icon, color, parentId, accountingGroup:acct, statisticGroup:stat, defaultProductionCentreId:defCentre, defaultCourse:defCourse, sortOrder:999 })}>
            {isNew ? 'Add category' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Utility components ────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <div style={t.lbl}>{label}{hint && <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--t4)', fontSize:9 }}> — {hint}</span>}</div>
      {children}
    </div>
  );
}

function Th({ children, w }) {
  return (
    <th style={{ padding:'8px 12px', textAlign:'left', fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--bdr)', whiteSpace:'nowrap', width:w||undefined }}>
      {children}
    </th>
  );
}

function IconBtn({ onClick, title, style:s={}, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--bdr)', background:'var(--bg3)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', transition:'border-color .1s, color .1s', ...s }}
      onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--bdr2)'; e.currentTarget.style.color='var(--t1)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--bdr)'; e.currentTarget.style.color=s.color||'var(--t3)'; }}>
      {children}
    </button>
  );
}

function Empty({ search, onAdd }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t4)' }}>
      <div style={{ fontSize:40, marginBottom:14, opacity:.2 }}>🍽</div>
      <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>
        {search ? `No results for "${search}"` : 'No items yet'}
      </div>
      <div style={{ fontSize:12, marginBottom:16 }}>
        {search ? 'Try a different search term' : 'Add your first menu item to get started'}
      </div>
      {!search && (
        <button onClick={onAdd}
          style={{ padding:'8px 20px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700 }}>
          + Add item
        </button>
      )}
    </div>
  );
}
