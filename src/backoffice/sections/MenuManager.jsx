/**
 * MenuManager — 5 focused screens
 *
 * 1. Categories — tree with drag-to-subcategorize
 * 2. Items      — all items, drag-to-variant
 * 3. Modifiers  — reusable paid option groups
 * 4. Instructions — preparation groups (no price)
 * 5. Builder    — wire items to categories + groups
 */
import { useState, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../store';
import { ALLERGENS } from '../../data/seed';

// ── Shared styles ─────────────────────────────────────────────────────────────
const row = (active) => ({
  display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:11,
  background:active?'var(--acc-d)':'var(--bg3)', border:`1.5px solid ${active?'var(--acc)':'var(--bdr)'}`,
  cursor:'pointer', userSelect:'none', transition:'all .1s', fontFamily:'inherit', width:'100%', textAlign:'left',
});
const inp = {
  background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:9, padding:'8px 11px',
  color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', width:'100%',
};
const lbl = { fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:5, display:'block' };
const btn = (variant='accent') => ({
  padding:'7px 16px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, border:'none',
  background: variant==='accent'?'var(--acc)':variant==='ghost'?'transparent':'var(--bg3)',
  color: variant==='accent'?'#0b0c10':'var(--t2)',
  border: variant==='ghost'?'1px solid var(--bdr2)':variant==='danger'?'1px solid var(--red-b)':'none',
  backgroundColor: variant==='danger'?'var(--red-d)':undefined,
  color2: variant==='danger'?'var(--red)':undefined,
});

const COLOURS = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899','#10b981','#8b5cf6'];
const ICONS   = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🌿','🔥','❄️','⭐','🌮','🦞','🍜','🥩','🍤','🥚','🥐','🫙'];

// ── Root ─────────────────────────────────────────────────────────────────────
export default function MenuManager() {
  const [tab, setTab] = useState('categories');

  const TABS = [
    { id:'categories',    label:'Categories',    icon:'🗂' },
    { id:'items',         label:'Items',         icon:'📋' },
    { id:'modifiers',     label:'Modifier groups', icon:'⊕' },
    { id:'instructions',  label:'Instruction groups', icon:'📝' },
    { id:'builder',       label:'Product builder', icon:'⚙' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <nav style={{ display:'flex', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'0 18px', height:46, cursor:'pointer', fontFamily:'inherit', border:'none',
            borderBottom:`3px solid ${tab===t.id?'var(--acc)':'transparent'}`,
            background:'transparent', color:tab===t.id?'var(--acc)':'var(--t3)',
            fontSize:12, fontWeight:tab===t.id?800:500, display:'flex', alignItems:'center', gap:6,
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>
      <div style={{ flex:1, overflow:'hidden' }}>
        {tab === 'categories'   && <CategoriesTab />}
        {tab === 'items'        && <ItemsTab />}
        {tab === 'modifiers'    && <ModifiersTab />}
        {tab === 'instructions' && <InstructionsTab />}
        {tab === 'builder'      && <BuilderTab />}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — Categories
// Drag a category onto another to make it a subcategory
// ═════════════════════════════════════════════════════════════════════════════
function CategoriesTab() {
  const { menuCategories: cats, addCategory, updateCategory, removeCategory, menuItems, markBOChange, showToast } = useStore();
  const [editing, setEditing] = useState(null); // null | id | 'new'
  const [form, setForm] = useState({ label:'', icon:'🍽', color:'#3b82f6', accountingGroup:'Food & Beverage' });
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // id to drop onto, or 'root'

  const rootCats = useMemo(() => cats.filter(c=>!c.parentId&&!c.isSpecial).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)), [cats]);

  const itemCountFor = (catId) => {
    const childIds = cats.filter(c=>c.parentId===catId).map(c=>c.id);
    return menuItems.filter(i=>!i.archived&&(i.cat===catId||childIds.includes(i.cat))).length;
  };

  const startNew = () => {
    setForm({ label:'', icon:'🍽', color:'#3b82f6', accountingGroup:'Food & Beverage', parentId:null });
    setEditing('new');
  };

  const startEdit = (cat) => {
    setForm({ label:cat.label, icon:cat.icon, color:cat.color, accountingGroup:cat.accountingGroup||'', parentId:cat.parentId||null });
    setEditing(cat.id);
  };

  const save = () => {
    if (!form.label.trim()) return;
    if (editing === 'new') {
      addCategory({ menuId:'menu-1', ...form, label:form.label.trim(), sortOrder:cats.length });
      showToast(`"${form.label}" added`, 'success');
    } else {
      updateCategory(editing, form);
      showToast('Category updated', 'success');
    }
    markBOChange();
    setEditing(null);
  };

  // Drag handlers
  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, targetId) => {
    e.preventDefault();
    if (targetId !== dragId) setDropTarget(targetId);
  };
  const onDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDropTarget(null); return; }
    if (targetId === 'root') {
      // Un-subcategorize
      updateCategory(dragId, { parentId: null });
      showToast('Moved to root', 'success');
    } else {
      // Make dragId a subcategory of targetId
      // Prevent circular: targetId can't itself be a child of dragId
      const wouldBeCircular = cats.find(c=>c.id===targetId)?.parentId === dragId;
      if (wouldBeCircular) { showToast('Cannot nest that way', 'error'); }
      else {
        updateCategory(dragId, { parentId: targetId });
        showToast('Moved to subcategory', 'success');
      }
    }
    markBOChange();
    setDragId(null);
    setDropTarget(null);
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* List */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)' }}>Categories</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>Drag a category onto another to make it a subcategory. Items in a subcategory also appear in the parent.</div>
          </div>
          <button onClick={startNew} style={{ padding:'7px 16px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700 }}>
            + Category
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
          {/* Root drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDropTarget('root'); }}
            onDrop={e => onDrop(e, 'root')}
            onDragLeave={() => setDropTarget(null)}
            style={{
              padding:'8px 12px', borderRadius:9, marginBottom:8, fontSize:11, color:'var(--t4)',
              border:`2px dashed ${dropTarget==='root'?'var(--acc)':'var(--bdr)'}`,
              background:dropTarget==='root'?'var(--acc-d)':'transparent',
              transition:'all .1s',
            }}>
            {dropTarget==='root' ? '↑ Drop here to make root category' : 'Drop here to remove subcategory'}
          </div>

          {rootCats.map(cat => {
            const children = cats.filter(c=>c.parentId===cat.id);
            const isDropTarget = dropTarget === cat.id;
            const isDragging = dragId === cat.id;

            return (
              <div key={cat.id} style={{ marginBottom:6, opacity:isDragging?.4:1 }}>
                {/* Root category */}
                <div
                  draggable
                  onDragStart={e => onDragStart(e, cat.id)}
                  onDragOver={e => onDragOver(e, cat.id)}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={e => onDrop(e, cat.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                    borderRadius:11, cursor:'grab',
                    border:`2px solid ${isDropTarget?'var(--acc)':editing===cat.id?'var(--acc)':'var(--bdr)'}`,
                    background:isDropTarget?'var(--acc-d)':editing===cat.id?'var(--acc-d)':'var(--bg1)',
                    transition:'all .1s',
                  }}>
                  <span style={{ fontSize:10, color:'var(--t4)', cursor:'grab' }}>⣿</span>
                  <div style={{ width:32, height:32, borderRadius:9, background:`${cat.color||'#3b82f6'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{cat.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{cat.label}</div>
                    <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
                      {itemCountFor(cat.id)} items
                      {children.length>0 && ` · ${children.length} subcategories`}
                      {cat.accountingGroup && ` · ${cat.accountingGroup}`}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:cat.color||'#3b82f6', flexShrink:0 }}/>
                    <button onClick={() => editing===cat.id ? setEditing(null) : startEdit(cat)}
                      style={{ padding:'4px 10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>
                      {editing===cat.id ? 'Close' : 'Edit'}
                    </button>
                    <button onClick={() => { if(confirm(`Remove "${cat.label}"?`)) { removeCategory(cat.id); markBOChange(); }}}
                      style={{ padding:'4px 8px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11 }}>
                      ×
                    </button>
                  </div>
                </div>

                {/* Inline editor for this category */}
                {editing === cat.id && <CategoryEditor form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} />}

                {/* Subcategories */}
                {children.length > 0 && (
                  <div style={{ marginLeft:24, marginTop:4, display:'flex', flexDirection:'column', gap:4 }}>
                    {children.map(sub => {
                      const subCount = menuItems.filter(i=>!i.archived&&i.cat===sub.id).length;
                      return (
                        <div key={sub.id}
                          draggable onDragStart={e=>onDragStart(e,sub.id)}
                          onDragOver={e=>onDragOver(e,sub.id)} onDragLeave={()=>setDropTarget(null)} onDrop={e=>onDrop(e,sub.id)}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderRadius:9, border:`1.5px solid ${editing===sub.id?'var(--acc)':'var(--bdr)'}`, background:editing===sub.id?'var(--acc-d)':'var(--bg2)', cursor:'grab', opacity:dragId===sub.id?.4:1 }}>
                          <span style={{ fontSize:9, color:'var(--t4)' }}>⣿</span>
                          <span style={{ fontSize:16 }}>{sub.icon}</span>
                          <div style={{ flex:1 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>{sub.label}</span>
                            <span style={{ fontSize:10, color:'var(--t4)', marginLeft:8 }}>{subCount} items</span>
                          </div>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:sub.color||'#3b82f6' }}/>
                          <button onClick={() => editing===sub.id ? setEditing(null) : startEdit(sub)}
                            style={{ padding:'3px 8px', borderRadius:6, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t3)', fontSize:10 }}>
                            {editing===sub.id?'Close':'Edit'}
                          </button>
                          <button onClick={() => { removeCategory(sub.id); markBOChange(); }}
                            style={{ padding:'3px 6px', borderRadius:6, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:10 }}>×</button>
                        </div>
                      );
                    })}
                    {editing && children.some(c=>c.id===editing) && <CategoryEditor form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} />}
                  </div>
                )}
              </div>
            );
          })}

          {editing === 'new' && (
            <div style={{ marginTop:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', marginBottom:8 }}>New category</div>
              <CategoryEditor form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} />
            </div>
          )}

          {rootCats.length === 0 && editing !== 'new' && (
            <div style={{ textAlign:'center', padding:'48px', color:'var(--t4)' }}>
              <div style={{ fontSize:36, marginBottom:10, opacity:.2 }}>🗂</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>No categories yet</div>
              <div style={{ fontSize:11, marginTop:4, marginBottom:16 }}>Categories organise your menu items</div>
              <button onClick={startNew} style={{ padding:'7px 16px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700 }}>
                Add first category
              </button>
            </div>
          )}
        </div>

        <div style={{ padding:'6px 16px', borderTop:'1px solid var(--bdr)', fontSize:10, color:'var(--t4)', background:'var(--bg1)' }}>
          {rootCats.length} categories · Drag to reorder or drop onto another to create subcategory
        </div>
      </div>
    </div>
  );
}

function CategoryEditor({ form, setForm, onSave, onCancel }) {
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div style={{ padding:'14px', background:'var(--bg2)', borderRadius:11, border:'1px solid var(--bdr)', marginTop:6 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, marginBottom:10 }}>
        <input style={inp} value={form.label} onChange={e=>f('label',e.target.value)} onKeyDown={e=>e.key==='Enter'&&onSave()} placeholder="Category name" autoFocus/>
        <input style={{ ...inp, width:120 }} value={form.accountingGroup||''} onChange={e=>f('accountingGroup',e.target.value)} placeholder="Accounting group"/>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
        <div>
          <span style={{ ...lbl, marginBottom:4 }}>Icon</span>
          <div style={{ display:'flex', gap:3, flexWrap:'wrap', maxWidth:280 }}>
            {ICONS.map(ic=><button key={ic} onClick={()=>f('icon',ic)} style={{ width:28, height:28, borderRadius:6, border:`1.5px solid ${form.icon===ic?'var(--acc)':'var(--bdr)'}`, background:form.icon===ic?'var(--acc-d)':'var(--bg3)', cursor:'pointer', fontSize:14 }}>{ic}</button>)}
          </div>
        </div>
        <div>
          <span style={{ ...lbl, marginBottom:4 }}>Colour</span>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {COLOURS.map(c=><button key={c} onClick={()=>f('color',c)} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline:form.color===c?'3px solid var(--t1)':'3px solid transparent', outlineOffset:2 }}/>)}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <button onClick={onCancel} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:12 }}>Cancel</button>
        <button onClick={onSave} disabled={!form.label.trim()} style={{ padding:'6px 16px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700, opacity:form.label.trim()?1:.4 }}>
          Save category
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — Items
// All items + subitems in one list
// Drag one item onto another → makes it a variant child
// ═════════════════════════════════════════════════════════════════════════════
function ItemsTab() {
  const { menuItems, addMenuItem, updateMenuItem, archiveMenuItem, markBOChange, showToast, eightySixIds, toggle86 } = useStore();
  const [selId, setSelId]   = useState(null);
  const [search, setSearch] = useState('');
  const [showType, setType] = useState('all'); // all | item | subitem
  const [dragId, setDragId] = useState(null);
  const [dropId, setDropId] = useState(null);

  const all = menuItems.filter(i => !i.archived);

  const display = useMemo(() => {
    let list = all;
    if (showType !== 'all') list = list.filter(i => (i.type||'simple') === showType || (showType==='item' && i.type!=='subitem'));
    if (search) { const q=search.toLowerCase(); list=list.filter(i=>(i.menuName||i.name||'').toLowerCase().includes(q)); }
    // Sort: parents first, then children under their parent
    const parents  = list.filter(i=>!i.parentId).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    const result   = [];
    parents.forEach(p => {
      result.push({ ...p, _isParent: all.filter(c=>c.parentId===p.id&&!c.archived).length > 0 });
      all.filter(c=>c.parentId===p.id&&!c.archived).forEach(c => result.push({ ...c, _isChild:true }));
    });
    // Also add children whose parents aren't in display (e.g. filtered out)
    list.filter(i=>i.parentId&&!parents.find(p=>p.id===i.parentId)).forEach(i=>result.push(i));
    return result;
  }, [all, showType, search]);

  const selItem = all.find(i=>i.id===selId);
  const is86 = selId && eightySixIds.includes(selId);

  // Drag to make variant
  const onDS = (e,id) => { setDragId(id); e.dataTransfer.effectAllowed='move'; };
  const onDO = (e,id) => { e.preventDefault(); if(id!==dragId) setDropId(id); };
  const onDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragId || dragId===targetId) { setDragId(null); setDropId(null); return; }
    const dragged = all.find(i=>i.id===dragId);
    const target  = all.find(i=>i.id===targetId);
    if (!dragged||!target) { setDragId(null); setDropId(null); return; }
    // Can't make a subitem a variant parent or child
    if (dragged.type==='subitem'||target.type==='subitem') { showToast('Subitems cannot be variants','error'); setDragId(null); setDropId(null); return; }
    // Can't nest a parent (that already has children) under another
    if (all.some(i=>i.parentId===dragId)) { showToast('Remove this item\'s variants first before linking it','error'); setDragId(null); setDropId(null); return; }
    // Make dragged a variant child of target (set target as parent)
    const parentId = target.parentId ? target.parentId : target.id; // if target is itself a child, use its parent
    updateMenuItem(dragId, { parentId });
    markBOChange();
    showToast(`${dragged.menuName||dragged.name} → variant of ${target.menuName||target.name}`, 'success');
    setDragId(null); setDropId(null);
  };
  const onDL = () => setDropId(null);

  const addItem = (type='simple') => {
    const n = addMenuItem({ name:`New ${type}`, menuName:`New ${type}`, receiptName:`New ${type}`, kitchenName:`New ${type}`, type, allergens:[], pricing:{base:0,dineIn:null,takeaway:null,collection:null,delivery:null} });
    markBOChange();
    setTimeout(() => setSelId(useStore.getState().menuItems.slice(-1)[0]?.id), 30);
  };

  const unlink = (id) => { updateMenuItem(id, { parentId:null }); markBOChange(); showToast('Variant unlinked','info'); };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* List */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          <div style={{ position:'relative', flex:1, maxWidth:280 }}>
            <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:12 }}>🔍</span>
            <input style={{ ...inp, paddingLeft:28 }} placeholder="Search items…" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          {[['all','All'],['item','Items'],['subitem','Sub items']].map(([v,l])=>(
            <button key={v} onClick={()=>setType(v)} style={{ padding:'5px 11px', borderRadius:18, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:showType===v?800:500, border:`1.5px solid ${showType===v?'var(--acc)':'var(--bdr)'}`, background:showType===v?'var(--acc-d)':'var(--bg3)', color:showType===v?'var(--acc)':'var(--t3)' }}>{l}</button>
          ))}
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <button onClick={()=>addItem('subitem')} style={{ padding:'6px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t3)', fontSize:12, fontWeight:600 }}>
              + Sub item
            </button>
            <button onClick={()=>addItem('simple')} style={{ padding:'6px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700 }}>
              + Item
            </button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'10px 14px' }}>
          <div style={{ fontSize:11, color:'var(--t3)', marginBottom:10, lineHeight:1.5 }}>
            <strong>Drag one item onto another</strong> to link it as a variant (size/type). The parent becomes a picker button on the POS. Drag to empty space to unlink.
          </div>

          {display.map(item => {
            const isParent = item._isParent;
            const isChild  = item._isChild;
            const isSub    = item.type === 'subitem';
            const active   = selId === item.id;
            const is86     = eightySixIds.includes(item.id);
            const isDrop   = dropId === item.id;
            const isDrag   = dragId === item.id;
            const p = item.pricing||{base:item.price||0};

            return (
              <div key={item.id} style={{ marginLeft:isChild?24:0, marginBottom:4, opacity:isDrag?.3:1 }}>
                <div
                  draggable={!isSub}
                  onDragStart={e=>!isSub&&onDS(e,item.id)}
                  onDragOver={e=>!isSub&&onDO(e,item.id)}
                  onDragLeave={onDL}
                  onDrop={e=>!isSub&&onDrop(e,item.id)}
                  onClick={()=>setSelId(active?null:item.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                    borderRadius:10, cursor: isSub?'pointer':'grab',
                    border:`${active?'2px':'1px'} solid ${isDrop?'var(--acc)':active?'var(--acc)':isSub?'var(--bdr)':'var(--bdr)'}`,
                    background:isDrop?'var(--acc-d)':active?'var(--acc-d)':isSub?'var(--bg2)':'var(--bg3)',
                    opacity:is86?.5:1,
                  }}>
                  {!isSub && <span style={{ fontSize:9, color:'var(--t4)', flexShrink:0 }}>⣿</span>}
                  {isChild && <span style={{ fontSize:11, color:'var(--t4)', flexShrink:0 }}>↳</span>}

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:13, fontWeight:active?700:600, color:active?'var(--acc)':isChild?'var(--t2)':'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {item.menuName||item.name}
                      </span>
                      {isSub    && <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, background:'var(--bg1)', color:'var(--t4)', border:'1px solid var(--bdr)', flexShrink:0 }}>sub item</span>}
                      {isParent && <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, background:'var(--acc-d)', color:'var(--acc)', border:'1px solid var(--acc-b)', flexShrink:0 }}>▾ variants</span>}
                      {is86     && <span style={{ fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:10, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)', flexShrink:0 }}>86'd</span>}
                    </div>
                    {item.cat && <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{useStore.getState().menuCategories.find(c=>c.id===item.cat)?.label||item.cat}</div>}
                  </div>

                  <span style={{ fontSize:13, fontWeight:800, color: active?'var(--acc)':'var(--t2)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
                    {isParent?'—':p.base>0?`£${p.base.toFixed(2)}`:isSub&&p.base>0?`+£${p.base.toFixed(2)}`:'free'}
                  </span>

                  {isChild && (
                    <button onClick={e=>{e.stopPropagation();unlink(item.id);}} title="Unlink variant" style={{ width:24, height:24, borderRadius:6, border:'1px solid var(--bdr)', background:'var(--bg1)', color:'var(--t4)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>⊗</button>
                  )}
                </div>
              </div>
            );
          })}

          {display.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px', color:'var(--t4)' }}>
              <div style={{ fontSize:36, marginBottom:10, opacity:.2 }}>📋</div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>No items found</div>
            </div>
          )}
        </div>

        <div style={{ padding:'5px 14px', borderTop:'1px solid var(--bdr)', fontSize:10, color:'var(--t4)', background:'var(--bg1)' }}>
          {all.filter(i=>i.type!=='subitem').length} items · {all.filter(i=>i.type==='subitem').length} sub items · Drag to link as variant
        </div>
      </div>

      {/* Editor panel */}
      {selItem ? (
        <ItemEditor key={selItem.id} item={selItem}
          onUpdate={p=>{ updateMenuItem(selItem.id,p); markBOChange(); }}
          onArchive={()=>{ archiveMenuItem(selItem.id); setSelId(null); markBOChange(); }}
          onClose={()=>setSelId(null)}
          is86={is86} onToggle86={()=>{ toggle86(selItem.id); markBOChange(); }}
        />
      ) : (
        <div style={{ width:340, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <div style={{ textAlign:'center', color:'var(--t4)', padding:24 }}>
            <div style={{ fontSize:28, opacity:.2, marginBottom:8 }}>✎</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>Click an item to edit</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemEditor({ item, onUpdate, onArchive, onClose, is86, onToggle86 }) {
  const { menuCategories } = useStore();
  const p = item.pricing||{base:item.price||0,dineIn:null,takeaway:null,collection:null,delivery:null};
  const isSub = item.type==='subitem';
  const isVariantParent = useStore.getState().menuItems.some(i=>i.parentId===item.id&&!i.archived);
  const cats = menuCategories.filter(c=>!c.isSpecial);
  const rootCats = cats.filter(c=>!c.parentId);
  const subCats  = cats.filter(c=>c.parentId);

  const f = (k,v) => onUpdate({[k]:v});
  const setPrice = (k,v) => onUpdate({ pricing:{...p,[k]:v===''?null:parseFloat(v)||0}, ...(k==='base'?{price:parseFloat(v)||0}:{}) });

  const ORDER_TYPES = [
    {id:'dineIn',label:'Dine-in',color:'#3b82f6'},
    {id:'takeaway',label:'Takeaway',color:'#e8a020'},
    {id:'collection',label:'Collection',color:'#22c55e'},
    {id:'delivery',label:'Delivery',color:'#ef4444'},
  ];

  return (
    <div style={{ width:340, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <div style={{ flex:1, fontSize:13, fontWeight:800, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.menuName||item.name}</div>
        <button onClick={onToggle86} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${is86?'var(--grn-b)':'var(--red-b)'}`, background:is86?'var(--grn-d)':'var(--red-d)', color:is86?'var(--grn)':'var(--red)', fontWeight:700 }}>{is86?'Reinstate':'86'}</button>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:18 }}>×</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
        {isSub && <div style={{ padding:'8px 10px', background:'var(--bg3)', borderRadius:8, fontSize:11, color:'var(--t3)', marginBottom:12 }}>⬡ Sub item — appears in modifier groups only, not on the POS ordering screen.</div>}
        {isVariantParent && <div style={{ padding:'8px 10px', background:'var(--acc-d)', borderRadius:8, fontSize:11, color:'var(--acc)', border:'1px solid var(--acc-b)', marginBottom:12 }}>▾ Variant parent — pricing set on each variant. Edit each variant's price individually.</div>}

        {/* Names */}
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>Name (POS button)</span>
          <input style={inp} value={item.menuName||item.name||''} onChange={e=>f('menuName',e.target.value)}/>
        </div>
        {!isSub && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <div><span style={lbl}>Receipt name</span><input style={inp} value={item.receiptName||''} onChange={e=>f('receiptName',e.target.value)} placeholder="Same as name"/></div>
            <div><span style={lbl}>KDS name</span><input style={inp} value={item.kitchenName||''} onChange={e=>f('kitchenName',e.target.value)} placeholder="Same as name"/></div>
          </div>
        )}

        {/* Category */}
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>Category</span>
          <select value={item.cat||''} onChange={e=>f('cat',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
            <option value="">— none —</option>
            {rootCats.map(c=>(
              <optgroup key={c.id} label={`${c.icon||''} ${c.label}`}>
                <option value={c.id}>{c.icon} {c.label}</option>
                {subCats.filter(s=>s.parentId===c.id).map(s=><option key={s.id} value={s.id}>  └ {s.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Pricing */}
        {!isVariantParent && (
          <div style={{ marginBottom:10, padding:'10px 12px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:11, color:'var(--t2)', width:68, flexShrink:0 }}>{isSub?'Price':'Base £'}</span>
              <div style={{ position:'relative', flex:1 }}><span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--acc)' }}>£</span><input type="number" step="0.01" style={{ ...inp, paddingLeft:20, color:'var(--acc)', fontWeight:800, fontSize:14 }} value={p.base||0} onChange={e=>setPrice('base',e.target.value)}/></div>
            </div>
            {!isSub && ORDER_TYPES.map(ot=>(
              <div key={ot.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:10, color:ot.color, width:68, flexShrink:0 }}>{ot.label}</span>
                <div style={{ position:'relative', flex:1 }}><span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--t4)' }}>£</span><input type="number" step="0.01" style={{ ...inp, paddingLeft:20, fontSize:12 }} value={p[ot.id]!==null&&p[ot.id]!==undefined?p[ot.id]:''} placeholder={`${p.base||0} (base)`} onChange={e=>setPrice(ot.id,e.target.value)}/></div>
                {p[ot.id]!==null&&p[ot.id]!==undefined&&<button onClick={()=>setPrice(ot.id,'')} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:14 }}>×</button>}
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>Description</span>
          <textarea style={{ ...inp, resize:'none', height:48 }} value={item.description||''} onChange={e=>f('description',e.target.value)} placeholder="Shown on kiosk & online"/>
        </div>

        {/* Allergens */}
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>Allergens</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {ALLERGENS.map(a=>{
              const on=(item.allergens||[]).includes(a.id);
              return <button key={a.id} onClick={()=>onUpdate({allergens:on?(item.allergens||[]).filter(x=>x!==a.id):[...(item.allergens||[]),a.id]})} style={{ padding:'3px 8px', borderRadius:16, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:on?700:400, border:`1px solid ${on?'var(--red)':'var(--bdr)'}`, background:on?'var(--red-d)':'var(--bg3)', color:on?'var(--red)':'var(--t3)' }}>{a.icon} {a.label}</button>;
            })}
          </div>
        </div>
      </div>

      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--bdr)' }}>
        <button onClick={()=>{if(confirm('Archive?'))onArchive();}} style={{ width:'100%', padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'transparent', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:600 }}>Archive item</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3 — Modifier groups (paid options)
// ═════════════════════════════════════════════════════════════════════════════
function ModifiersTab() {
  const { modifierGroupDefs: groups, addModifierGroupDef, updateModifierGroupDef, removeModifierGroupDef, menuItems, markBOChange, showToast } = useStore();
  const [selId, setSelId] = useState(null);
  const [newName, setNewName] = useState('');
  const [subSearch, setSubSearch] = useState('');

  // Only sub items can be options in modifier groups
  const subitems = menuItems.filter(i => i.type === 'subitem' && !i.archived);
  const filteredSubs = subSearch
    ? subitems.filter(i => (i.menuName||i.name||'').toLowerCase().includes(subSearch.toLowerCase()))
    : subitems;

  const sel = groups?.find(g => g.id === selId);

  const addGroup = () => {
    if (!newName.trim()) return;
    addModifierGroupDef({ name:newName.trim(), min:0, max:1, options:[] });
    markBOChange();
    setNewName('');
    setTimeout(() => setSelId(useStore.getState().modifierGroupDefs.slice(-1)[0]?.id), 30);
  };

  const updGroup = (patch) => { updateModifierGroupDef(selId, patch); markBOChange(); };

  // Add a sub item as an option (uses sub item id, name, price)
  const addSubitemOpt = (subitem) => {
    if ((sel.options||[]).find(o => o.id === subitem.id)) {
      showToast('Already in this group', 'error'); return;
    }
    updGroup({ options: [...(sel.options||[]), {
      id: subitem.id,
      name: subitem.menuName || subitem.name,
      price: subitem.pricing?.base ?? subitem.price ?? 0,
    }]});
  };

  const delOpt = (oid) => updGroup({ options: (sel.options||[]).filter(o => o.id !== oid) });

  const isRequired = sel?.min > 0;
  const maxUnlimited = !sel?.max || sel.max >= 99;

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Left: group list */}
      <div style={{ width:240, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>Modifier groups</div>
          <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8, lineHeight:1.4 }}>Paid options that change the price. Options must be sub items.</div>
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1, fontSize:12, padding:'6px 10px' }} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="New group name…"/>
            <button onClick={addGroup} disabled={!newName.trim()} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700, opacity:newName.trim()?1:.4 }}>+</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {(groups||[]).map(g => (
            <button key={g.id} onClick={() => setSelId(g.id === selId ? null : g.id)} style={{ ...row(selId===g.id), marginBottom:4 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:selId===g.id?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
                  {(g.options||[]).length} options · {g.min>0 ? 'required' : 'optional'} · {g.max>=99?'unlimited':g.max} max
                </div>
              </div>
              <button onClick={e=>{e.stopPropagation();if(confirm(`Remove "${g.name}"?`)){removeModifierGroupDef(g.id);if(selId===g.id)setSelId(null);markBOChange();}}} style={{ width:22, height:22, borderRadius:5, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </button>
          ))}
          {(!groups||groups.length===0) && <div style={{ textAlign:'center', padding:'32px 8px', color:'var(--t4)', fontSize:11 }}>No modifier groups yet</div>}
        </div>
      </div>

      {/* Middle: group editor */}
      {sel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {/* Group name + controls */}
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
            <input style={{ ...inp, fontSize:15, fontWeight:800, border:'none', background:'transparent', padding:'0 0 8px' }} value={sel.name} onChange={e=>updGroup({name:e.target.value})} placeholder="Group name"/>

            {/* Force / Unforce toggle */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              <button onClick={() => updGroup({ min:0 })} style={{
                padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                border:`2px solid ${!isRequired ? 'var(--grn)' : 'var(--bdr)'}`,
                background:!isRequired ? 'var(--grn-d)' : 'var(--bg3)',
              }}>
                <div style={{ fontSize:12, fontWeight:700, color:!isRequired?'var(--grn)':'var(--t2)' }}>Optional</div>
                <div style={{ fontSize:10, color:'var(--t4)' }}>Customer can skip this group</div>
              </button>
              <button onClick={() => updGroup({ min:1 })} style={{
                padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                border:`2px solid ${isRequired ? 'var(--acc)' : 'var(--bdr)'}`,
                background:isRequired ? 'var(--acc-d)' : 'var(--bg3)',
              }}>
                <div style={{ fontSize:12, fontWeight:700, color:isRequired?'var(--acc)':'var(--t2)' }}>Required</div>
                <div style={{ fontSize:10, color:'var(--t4)' }}>Must pick at least one</div>
              </button>
            </div>

            {/* Max selections */}
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:12, color:'var(--t2)', fontWeight:600 }}>Max selections:</span>
              <button onClick={() => updGroup({ max:1 })} style={{ padding:'4px 10px', borderRadius:16, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:sel.max===1?800:500, border:`1px solid ${sel.max===1?'var(--acc)':'var(--bdr)'}`, background:sel.max===1?'var(--acc-d)':'var(--bg3)', color:sel.max===1?'var(--acc)':'var(--t3)' }}>1 (pick one)</button>
              <button onClick={() => updGroup({ max:99 })} style={{ padding:'4px 10px', borderRadius:16, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:maxUnlimited&&sel.max!==1?800:500, border:`1px solid ${maxUnlimited&&sel.max!==1?'var(--acc)':'var(--bdr)'}`, background:maxUnlimited&&sel.max!==1?'var(--acc-d)':'var(--bg3)', color:maxUnlimited&&sel.max!==1?'var(--acc)':'var(--t3)' }}>Unlimited</button>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:11, color:'var(--t4)' }}>Custom:</span>
                <input type="number" min="1" max="20" style={{ ...inp, width:52, padding:'4px 8px', fontSize:12 }} value={!maxUnlimited&&sel.max!==1?sel.max:''} placeholder="N" onChange={e => updGroup({ max:parseInt(e.target.value)||1 })}/>
              </div>
            </div>
          </div>

          {/* Options list */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Options in this group</div>
            {(sel.options||[]).length === 0 ? (
              <div style={{ padding:'12px', background:'var(--bg3)', borderRadius:9, fontSize:11, color:'var(--t4)', marginBottom:12 }}>
                No options yet — add sub items from the right panel
              </div>
            ) : (
              (sel.options||[]).map(opt => {
                const sub = menuItems.find(i => i.id === opt.id);
                return (
                  <div key={opt.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 11px', marginBottom:6, borderRadius:9, background:'var(--bg3)', border:'1px solid var(--bdr)' }}>
                    <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'var(--bg1)', border:'1px solid var(--bdr)', color:'var(--t4)', fontWeight:700 }}>⬡</span>
                    <span style={{ flex:1, fontSize:13, color:'var(--t1)', fontWeight:600 }}>{opt.name}</span>
                    <span style={{ fontSize:13, fontFamily:'var(--font-mono)', color: opt.price > 0 ? 'var(--acc)' : 'var(--t4)' }}>
                      {opt.price > 0 ? `+£${opt.price.toFixed(2)}` : 'free'}
                    </span>
                    {!sub && <span style={{ fontSize:9, color:'var(--red)', padding:'1px 5px', borderRadius:4, background:'var(--red-d)' }}>missing</span>}
                    <button onClick={() => delOpt(opt.id)} style={{ width:24, height:24, borderRadius:5, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, opacity:.2, marginBottom:8 }}>⊕</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>Select a modifier group to edit</div>
          </div>
        </div>
      )}

      {/* Right: sub item picker */}
      {sel && (
        <div style={{ width:220, borderLeft:'1px solid var(--bdr)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', background:'var(--bg2)' }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', marginBottom:6 }}>Add sub items</div>
            <input style={{ ...inp, fontSize:12, padding:'5px 10px' }} value={subSearch} onChange={e=>setSubSearch(e.target.value)} placeholder="Search sub items…"/>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'6px 8px' }}>
            {filteredSubs.length === 0 ? (
              <div style={{ padding:'16px 8px', textAlign:'center', fontSize:11, color:'var(--t4)', lineHeight:1.5 }}>
                No sub items yet.{'\n'}Create sub items in the Items tab first.
              </div>
            ) : filteredSubs.map(sub => {
              const alreadyAdded = (sel.options||[]).some(o => o.id === sub.id);
              const price = sub.pricing?.base ?? sub.price ?? 0;
              return (
                <button key={sub.id} onClick={() => !alreadyAdded && addSubitemOpt(sub)} style={{
                  width:'100%', textAlign:'left', padding:'7px 10px', borderRadius:8, marginBottom:4,
                  cursor: alreadyAdded ? 'default' : 'pointer', fontFamily:'inherit',
                  border:`1px solid ${alreadyAdded?'var(--grn-b)':'var(--bdr)'}`,
                  background:alreadyAdded?'var(--grn-d)':'var(--bg3)',
                  opacity: alreadyAdded ? .7 : 1,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ flex:1, fontSize:12, fontWeight:600, color:alreadyAdded?'var(--grn)':'var(--t1)' }}>{sub.menuName||sub.name}</span>
                    <span style={{ fontSize:11, color:alreadyAdded?'var(--grn)':price>0?'var(--acc)':'var(--t4)', fontFamily:'var(--font-mono)' }}>
                      {alreadyAdded ? '✓' : price > 0 ? `+£${price.toFixed(2)}` : 'free'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {subitems.length === 0 && (
            <div style={{ padding:'8px 10px', borderTop:'1px solid var(--bdr)', fontSize:10, color:'var(--acc)', background:'var(--acc-d)', lineHeight:1.4 }}>
              💡 Go to Items tab → toggle Sub items → create items first
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4 — Instruction groups (preparation, no price)
// ═════════════════════════════════════════════════════════════════════════════
function InstructionsTab() {
  const { instructionGroupDefs: groups, addInstructionGroupDef, updateInstructionGroupDef, removeInstructionGroupDef, markBOChange } = useStore();
  const [selId, setSelId]   = useState(null);
  const [newName, setNewName] = useState('');
  const [newOpt, setNewOpt]  = useState('');

  const sel = groups?.find(g=>g.id===selId);

  const addGroup = () => {
    if (!newName.trim()) return;
    addInstructionGroupDef({ name:newName.trim(), options:[] });
    markBOChange(); setNewName('');
    setTimeout(()=>setSelId(useStore.getState().instructionGroupDefs.slice(-1)[0]?.id),30);
  };

  const updGroup = (patch) => { updateInstructionGroupDef(selId,patch); markBOChange(); };
  const addOpt   = () => { if(!newOpt.trim())return; updGroup({ options:[...(sel.options||[]),newOpt.trim()] }); setNewOpt(''); };
  const delOpt   = (i) => updGroup({ options:(sel.options||[]).filter((_,idx)=>idx!==i) });
  const updOpt   = (i,v) => updGroup({ options:(sel.options||[]).map((o,idx)=>idx===i?v:o) });

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* List */}
      <div style={{ width:260, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>Instruction groups</div>
          <div style={{ fontSize:11, color:'var(--t3)', marginBottom:10 }}>Preparation choices (no price change). e.g. "Cooking preference: Rare / Medium / Well done".</div>
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1, fontSize:12, padding:'6px 10px' }} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="e.g. Cooking preference"/>
            <button onClick={addGroup} disabled={!newName.trim()} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700, opacity:newName.trim()?1:.4 }}>+</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {(groups||[]).map(g=>(
            <button key={g.id} onClick={()=>setSelId(g.id===selId?null:g.id)} style={{ ...row(selId===g.id), marginBottom:4 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:selId===g.id?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).length} options · no price change</div>
              </div>
              <button onClick={e=>{e.stopPropagation();if(confirm(`Remove "${g.name}"?`)){removeInstructionGroupDef(g.id);if(selId===g.id)setSelId(null);markBOChange();}}} style={{ width:22, height:22, borderRadius:5, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </button>
          ))}
          {(!groups||groups.length===0)&&<div style={{ textAlign:'center', padding:'32px 8px', color:'var(--t4)', fontSize:11 }}>No instruction groups yet</div>}
        </div>
      </div>

      {/* Editor */}
      {sel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
            <input style={{ ...inp, fontSize:15, fontWeight:800, border:'none', background:'transparent', padding:'0 0 4px' }} value={sel.name} onChange={e=>updGroup({name:e.target.value})} placeholder="Group name"/>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>Options in this group don't change the price — they're preparation instructions printed on the kitchen ticket.</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>Options</div>
            {(sel.options||[]).map((opt,i)=>(
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:7 }}>
                <input style={inp} value={opt} onChange={e=>updOpt(i,e.target.value)} placeholder="Option name"/>
                <button onClick={()=>delOpt(i)} style={{ width:30, height:36, borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:14 }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <input style={{ ...inp, flex:1 }} value={newOpt} onChange={e=>setNewOpt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addOpt()} placeholder="New option (e.g. Rare)"/>
              <button onClick={addOpt} disabled={!newOpt.trim()} style={{ padding:'7px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600, opacity:newOpt.trim()?1:.4 }}>+ Add</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32, opacity:.2, marginBottom:8 }}>📝</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>Select an instruction group to edit</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 5 — Product Builder
// Wire items to categories, modifier groups, instruction groups
// ═════════════════════════════════════════════════════════════════════════════
function BuilderTab() {
  const {
    menuItems, updateMenuItem, menuCategories: cats,
    modifierGroupDefs: modGroups, instructionGroupDefs: instGroups,
    markBOChange, showToast,
  } = useStore();

  const [selId, setSelId]   = useState(null);
  const [search, setSearch] = useState('');

  const items = menuItems.filter(i=>!i.archived&&i.type!=='subitem');
  const filtered = search ? items.filter(i=>(i.menuName||i.name||'').toLowerCase().includes(search.toLowerCase())) : items;
  const sel = items.find(i=>i.id===selId);

  const rootCats = cats.filter(c=>!c.parentId&&!c.isSpecial);
  const subCats  = cats.filter(c=>c.parentId);

  const updItem = (patch) => { updateMenuItem(selId, patch); markBOChange(); };

  const toggleModGroup = (gid) => {
    const cur = sel.assignedModifierGroups||[];
    const has = cur.find(g=>g.groupId===gid);
    if (has) updItem({ assignedModifierGroups: cur.filter(g=>g.groupId!==gid) });
    else updItem({ assignedModifierGroups: [...cur, { groupId:gid, min:0, max:null }] });
  };

  const toggleInstGroup = (gid) => {
    const cur = sel.assignedInstructionGroups||[];
    updItem({ assignedInstructionGroups: cur.includes(gid) ? cur.filter(g=>g!==gid) : [...cur,gid] });
  };

  const setModGroupMin = (gid,v) => {
    const cur = sel.assignedModifierGroups||[];
    updItem({ assignedModifierGroups: cur.map(g=>g.groupId===gid?{...g,min:parseInt(v)||0}:g) });
  };

  const setModGroupMax = (gid,v) => {
    const cur = sel.assignedModifierGroups||[];
    updItem({ assignedModifierGroups: cur.map(g=>g.groupId===gid?{...g,max:v===''?null:parseInt(v)||1}:g) });
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Item picker */}
      <div style={{ width:260, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:8 }}>Product builder</div>
          <input style={{ ...inp, fontSize:12, padding:'6px 10px' }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…"/>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {filtered.map(item=>{
            const isParent = menuItems.some(i=>i.parentId===item.id&&!i.archived);
            const mCount   = (item.assignedModifierGroups||[]).length;
            const iCount   = (item.assignedInstructionGroups||[]).length;
            return (
              <button key={item.id} onClick={()=>setSelId(item.id===selId?null:item.id)} style={{ ...row(selId===item.id), marginBottom:4 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:selId===item.id?'var(--acc)':'var(--t1)' }}>{item.menuName||item.name}</div>
                  <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
                    {isParent&&'▾ variants · '}{mCount>0&&`${mCount} mod group${mCount>1?'s':''} · `}{iCount>0&&`${iCount} inst group${iCount>1?'s':''} · `}
                    {cats.find(c=>c.id===item.cat)?.label||'no category'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Builder panel */}
      {sel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
            <div style={{ fontSize:16, fontWeight:800, color:'var(--t1)', marginBottom:2 }}>{sel.menuName||sel.name}</div>
            <div style={{ fontSize:11, color:'var(--t3)' }}>Configure category, modifier groups and instruction groups for this item.</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>

            {/* Category */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--t2)', marginBottom:8 }}>Category</div>
              <select value={sel.cat||''} onChange={e=>updItem({cat:e.target.value})} style={{ ...inp, cursor:'pointer', maxWidth:320 }}>
                <option value="">— not categorised —</option>
                {rootCats.map(c=>(
                  <optgroup key={c.id} label={`${c.icon||''} ${c.label}`}>
                    <option value={c.id}>{c.icon} {c.label}</option>
                    {subCats.filter(s=>s.parentId===c.id).map(s=><option key={s.id} value={s.id}>  └ {s.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Modifier groups */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--t2)', marginBottom:4 }}>Modifier groups <span style={{ fontWeight:400, color:'var(--t4)' }}>(paid options — change the price)</span></div>
              <div style={{ fontSize:11, color:'var(--t3)', marginBottom:10 }}>When a customer orders this item, they'll be prompted with these choices.</div>
              {(modGroups||[]).map(g=>{
                const assigned = (sel.assignedModifierGroups||[]).find(ag=>ag.groupId===g.id);
                return (
                  <div key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginBottom:6, borderRadius:10, border:`1.5px solid ${assigned?'var(--acc)':'var(--bdr)'}`, background:assigned?'var(--acc-d)':'var(--bg3)' }}>
                    <button onClick={()=>toggleModGroup(g.id)} style={{ width:22, height:22, borderRadius:5, border:`2px solid ${assigned?'var(--acc)':'var(--bdr2)'}`, background:assigned?'var(--acc)':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {assigned&&<div style={{ width:8, height:8, borderRadius:1, background:'#0b0c10' }}/>}
                    </button>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:assigned?700:500, color:assigned?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                      <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).map(o=>o.name).join(', ')}</div>
                    </div>
                    {assigned && (
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <label style={{ fontSize:11, color:'var(--t2)', display:'flex', alignItems:'center', gap:4 }}>
                          <input type="checkbox" checked={assigned.min>0} onChange={e=>setModGroupMin(g.id,e.target.checked?1:0)} style={{ accentColor:'var(--acc)' }}/> Required
                        </label>
                        <label style={{ fontSize:11, color:'var(--t2)', display:'flex', alignItems:'center', gap:4 }}>
                          Max: <input type="number" min="1" max="20" style={{ ...inp, width:44, padding:'3px 6px', fontSize:11 }} value={assigned.max||g.max||1} onChange={e=>setModGroupMax(g.id,e.target.value)}/>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!modGroups||modGroups.length===0)&&<div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>Create modifier groups in the Modifier groups tab first.</div>}
            </div>

            {/* Instruction groups */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--t2)', marginBottom:4 }}>Instruction groups <span style={{ fontWeight:400, color:'var(--t4)' }}>(preparation — no price change)</span></div>
              <div style={{ fontSize:11, color:'var(--t3)', marginBottom:10 }}>Printed on the kitchen ticket. Customer chooses during ordering.</div>
              {(instGroups||[]).map(g=>{
                const assigned = (sel.assignedInstructionGroups||[]).includes(g.id);
                return (
                  <div key={g.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', marginBottom:6, borderRadius:10, border:`1.5px solid ${assigned?'var(--grn)':'var(--bdr)'}`, background:assigned?'var(--grn-d)':'var(--bg3)', cursor:'pointer' }} onClick={()=>toggleInstGroup(g.id)}>
                    <div style={{ width:22, height:22, borderRadius:5, border:`2px solid ${assigned?'var(--grn)':'var(--bdr2)'}`, background:assigned?'var(--grn)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {assigned&&<div style={{ width:8, height:8, borderRadius:1, background:'#0b0c10' }}/>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:assigned?700:500, color:assigned?'var(--grn)':'var(--t1)' }}>{g.name}</div>
                      <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).join(' · ')}</div>
                    </div>
                  </div>
                );
              })}
              {(!instGroups||instGroups.length===0)&&<div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>Create instruction groups in the Instruction groups tab first.</div>}
            </div>

          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ textAlign:'center', color:'var(--t4)', padding:24 }}>
            <div style={{ fontSize:40, opacity:.15, marginBottom:12 }}>⚙</div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)', marginBottom:6 }}>Select an item to configure</div>
            <div style={{ fontSize:11, lineHeight:1.6 }}>
              Assign it to a category<br/>
              Add modifier groups (paid choices)<br/>
              Add instruction groups (preparation)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
