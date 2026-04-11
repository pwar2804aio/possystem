/**
 * Menu Manager — designed to mirror the POS experience
 *
 * MENTAL MODEL (matches Toast / Square / Lightspeed):
 *
 *  Menu tab
 *  ├── Left: Category tree  (same order as POS nav)
 *  ├── Centre: Item GRID    (same cards as POS, drag to reorder)
 *  └── Right: Item editor   (slide-in, all config in one place)
 *       ├── Details
 *       ├── Variants   ← add size/type variations inline (no drag-to-link)
 *       ├── Modifiers  ← tick modifier groups; set required/max
 *       ├── Pricing    ← per-channel overrides
 *       └── Allergens
 *
 *  Modifier groups tab
 *  ├── Group list
 *  └── Group editor: add options as name+price pairs directly (no sub-item concept)
 *
 *  Instruction groups tab
 *  └── Same — options are plain strings
 */
import { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../store';
import { ALLERGENS } from '../../data/seed';

// ── Shared ───────────────────────────────────────────────────────────────────
const inp = { background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:9, padding:'8px 11px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' };
const lbl = { fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:5, display:'block' };
const COLOURS = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899','#10b981','#8b5cf6','#eab308','#78716c'];
const ICONS   = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🌿','🔥','❄️','⭐','🌮','🦞','🍜','🥩','🍤','🥚','🥐'];

// ── Root ─────────────────────────────────────────────────────────────────────
export default function MenuManager() {
  const [tab, setTab] = useState('menu');
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <nav style={{ display:'flex', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
        {[['menu','🍽 Menu'],['modifiers','⊕ Modifier groups'],['instructions','📝 Instruction groups']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ padding:'0 20px', height:46, cursor:'pointer', fontFamily:'inherit', border:'none', borderBottom:`3px solid ${tab===id?'var(--acc)':'transparent'}`, background:'transparent', color:tab===id?'var(--acc)':'var(--t3)', fontSize:13, fontWeight:tab===id?800:500 }}>
            {label}
          </button>
        ))}
      </nav>
      <div style={{ flex:1, overflow:'hidden' }}>
        {tab==='menu'         && <MenuTab />}
        {tab==='modifiers'    && <ModifiersTab />}
        {tab==='instructions' && <InstructionsTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU TAB
// ═══════════════════════════════════════════════════════════════════════════
function MenuTab() {
  const { menuCategories, menuItems, addCategory, updateCategory, removeCategory,
          addMenuItem, updateMenuItem, archiveMenuItem, eightySixIds, toggle86,
          markBOChange, showToast } = useStore();

  const [selCatId, setSelCatId]   = useState(null);
  const [selItemId, setSelItemId] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [addingCat, setAddingCat]   = useState(false);
  const [catForm, setCatForm]       = useState({ label:'', icon:'🍽', color:'#3b82f6', parentId:'' });
  const [dragCatId, setDragCatId]   = useState(null);
  const [overCatId, setOverCatId]   = useState(null);
  const [dragItemId, setDragItemId] = useState(null);
  const [overItemId, setOverItemId] = useState(null);
  const [search, setSearch]         = useState('');

  const roots     = useMemo(()=>menuCategories.filter(c=>!c.parentId&&!c.isSpecial).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)),[menuCategories]);
  const selCat    = menuCategories.find(c=>c.id===selCatId);
  const selItem   = menuItems.find(i=>i.id===selItemId);

  // Items to show in grid — only orderable items (not sub-items, not archived)
  const gridItems = useMemo(()=>{
    if (!selCatId) return [];
    const subs  = menuCategories.filter(c=>c.parentId===selCatId).map(c=>c.id);
    const inCat = i => i.cat===selCatId || subs.includes(i.cat) || (i.cats||[]).includes(selCatId) || (i.cats||[]).some(c=>subs.includes(c));
    return menuItems
      .filter(i=>!i.archived && i.type!=='subitem' && inCat(i))
      .sort((a,b)=>(a.sortOrder??999)-(b.sortOrder??999));
  },[selCatId, menuCategories, menuItems]);

  const searchResults = useMemo(()=>{
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return menuItems.filter(i=>!i.archived&&i.type!=='subitem'&&((i.menuName||i.name||'').toLowerCase().includes(q)||(i.description||'').toLowerCase().includes(q))).sort((a,b)=>(a.sortOrder??999)-(b.sortOrder??999));
  },[search, menuItems]);

  const displayItems = search.trim() ? searchResults : gridItems;

  // ── Category drag: same level = reorder, cross level = nest ──────────────
  const onCatDrop = useCallback((e, targetId) => {
    e.preventDefault();
    if (!dragCatId||dragCatId===targetId) { setDragCatId(null); setOverCatId(null); return; }
    const dragged = menuCategories.find(c=>c.id===dragCatId);
    const target  = menuCategories.find(c=>c.id===targetId);
    if (!dragged||!target) { setDragCatId(null); setOverCatId(null); return; }
    if (targetId==='root') {
      updateCategory(dragCatId,{parentId:null}); showToast('Moved to root','success');
    } else if (dragged.parentId===target.parentId) {
      // Same level → reorder
      const siblings = menuCategories.filter(c=>c.parentId===dragged.parentId).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      const without  = siblings.filter(c=>c.id!==dragCatId);
      const ti       = without.findIndex(c=>c.id===targetId);
      const reordered= [...without.slice(0,ti), dragged, ...without.slice(ti)];
      reordered.forEach((c,i)=>{ if((c.sortOrder||0)!==i) updateCategory(c.id,{sortOrder:i}); });
      showToast('Category reordered','success');
    } else {
      if (menuCategories.find(c=>c.id===targetId)?.parentId===dragCatId) { showToast('Cannot nest that way','error'); }
      else { updateCategory(dragCatId,{parentId:targetId}); showToast('Nested as subcategory','success'); }
    }
    markBOChange(); setDragCatId(null); setOverCatId(null);
  },[dragCatId, menuCategories, updateCategory, markBOChange, showToast]);

  // ── Item drag: reorder in grid ────────────────────────────────────────────
  const onItemDrop = useCallback((e, targetId)=>{
    e.preventDefault();
    if (!dragItemId||dragItemId===targetId) { setDragItemId(null); setOverItemId(null); return; }
    const items   = displayItems.filter(i=>!i._isChild);
    const without = items.filter(i=>i.id!==dragItemId);
    const ti      = without.findIndex(i=>i.id===targetId);
    const reordered=[...without.slice(0,ti), items.find(i=>i.id===dragItemId), ...without.slice(ti)];
    reordered.forEach((item,idx)=>{ if(item&&(item.sortOrder??999)!==idx) updateMenuItem(item.id,{sortOrder:idx}); });
    markBOChange(); showToast('Order updated — reflects on POS instantly','success');
    setDragItemId(null); setOverItemId(null);
  },[dragItemId, displayItems, updateMenuItem, markBOChange, showToast]);

  const addItem = (type='simple')=>{
    addMenuItem({ name:'New item', menuName:'New item', receiptName:'New item', kitchenName:'New item',
      type, cat:selCatId||undefined, allergens:[],
      pricing:{base:0,dineIn:null,takeaway:null,collection:null,delivery:null},
      assignedModifierGroups:[], assignedInstructionGroups:[], cats:[], });
    markBOChange();
    setTimeout(()=>{ const id=useStore.getState().menuItems.slice(-1)[0]?.id; if(id) setSelItemId(id); },30);
  };

  const saveNewCat = ()=>{
    if (!catForm.label.trim()) return;
    addCategory({ menuId:'menu-1', ...catForm, parentId:catForm.parentId||null, sortOrder:menuCategories.length });
    markBOChange(); showToast(`"${catForm.label}" added`,'success');
    setCatForm({label:'',icon:'🍽',color:'#3b82f6',parentId:''}); setAddingCat(false);
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── PANEL 1: Category tree ─────────────────────────────────────── */}
      <div style={{ width:200, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg1)', flexShrink:0 }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--bdr)', display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--t2)', flex:1 }}>Categories</span>
          <button onClick={()=>setAddingCat(v=>!v)} style={{ width:24, height:24, borderRadius:6, cursor:'pointer', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
        </div>

        {addingCat && (
          <div style={{ padding:'8px', borderBottom:'1px solid var(--bdr)', background:'var(--bg2)', flexShrink:0 }}>
            <input style={{ ...inp, fontSize:12, marginBottom:6 }} value={catForm.label} onChange={e=>setCatForm(f=>({...f,label:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&saveNewCat()} placeholder="Category name…" autoFocus/>
            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
              {ICONS.slice(0,12).map(ic=><button key={ic} onClick={()=>setCatForm(f=>({...f,icon:ic}))} style={{ width:24,height:24,borderRadius:5,border:`1.5px solid ${catForm.icon===ic?'var(--acc)':'var(--bdr)'}`,background:catForm.icon===ic?'var(--acc-d)':'var(--bg3)',cursor:'pointer',fontSize:12 }}>{ic}</button>)}
            </div>
            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:6 }}>
              {COLOURS.map(c=><button key={c} onClick={()=>setCatForm(f=>({...f,color:c}))} style={{ width:16,height:16,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:catForm.color===c?'2px solid white':'none',outlineOffset:1 }}/>)}
            </div>
            <select value={catForm.parentId} onChange={e=>setCatForm(f=>({...f,parentId:e.target.value}))} style={{ ...inp, fontSize:11, padding:'4px 7px', marginBottom:6 }}>
              <option value="">Root category</option>
              {roots.map(r=><option key={r.id} value={r.id}>Under: {r.label}</option>)}
            </select>
            <div style={{ display:'flex', gap:5 }}>
              <button onClick={()=>setAddingCat(false)} style={{ flex:1,padding:'4px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',background:'var(--bg3)',border:'1px solid var(--bdr)',color:'var(--t3)',fontSize:11 }}>Cancel</button>
              <button onClick={saveNewCat} disabled={!catForm.label.trim()} style={{ flex:2,padding:'4px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',background:'var(--acc)',border:'none',color:'#0b0c10',fontSize:11,fontWeight:700,opacity:catForm.label.trim()?1:.4 }}>Add</button>
            </div>
          </div>
        )}

        {/* Root drop zone */}
        <div onDragOver={e=>{e.preventDefault();setOverCatId('root');}} onDrop={e=>onCatDrop(e,'root')} onDragLeave={()=>setOverCatId(null)}
          style={{ margin:'6px 8px 2px', padding:'3px 8px', borderRadius:6, fontSize:9, color:'var(--t4)', border:`1.5px dashed ${overCatId==='root'?'var(--acc)':'var(--bdr)'}`, background:overCatId==='root'?'var(--acc-d)':'transparent', textAlign:'center' }}>
          {overCatId==='root'?'Drop → root':'Drag to un-nest →'}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'4px 6px' }}>
          {roots.map(cat=>{
            const children = menuCategories.filter(c=>c.parentId===cat.id).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
            const count    = menuItems.filter(i=>!i.archived&&i.type!=='subitem'&&(i.cat===cat.id||children.some(s=>s.id===i.cat))).length;
            const active   = selCatId===cat.id;
            const over     = overCatId===cat.id;
            const dragging = dragCatId===cat.id;
            const draggedC = menuCategories.find(c=>c.id===dragCatId);
            const isReorder= over && draggedC?.parentId===cat.parentId;
            const color    = cat.color||'#3b82f6';
            return (
              <div key={cat.id} style={{ opacity:dragging?.3:1 }}>
                {isReorder && <div style={{ height:3, background:'var(--acc)', borderRadius:2, margin:'1px 4px' }}/>}
                <div draggable onDragStart={e=>{setDragCatId(cat.id);e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{e.preventDefault();setOverCatId(cat.id);}} onDragLeave={()=>setOverCatId(null)} onDragEnd={()=>{setDragCatId(null);setOverCatId(null);}} onDrop={e=>onCatDrop(e,cat.id)} onClick={()=>{setSelCatId(cat.id);setSelItemId(null);setSearch('');}}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', borderRadius:8, marginBottom:1, cursor:'grab', userSelect:'none', border:`1.5px solid ${!isReorder&&over?'var(--acc)':active?color+'55':'transparent'}`, background:!isReorder&&over?'var(--acc-d)':active?color+'18':'transparent' }}>
                  <span style={{ fontSize:8, color:'var(--t4)', flexShrink:0 }}>⣿</span>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }}/>
                  <span style={{ fontSize:14, flexShrink:0 }}>{cat.icon}</span>
                  <span style={{ fontSize:11, fontWeight:active?700:500, color:active?color:'var(--t2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.label}</span>
                  <span style={{ fontSize:9, color:'var(--t4)', flexShrink:0 }}>{count}</span>
                </div>
                {/* Subcats */}
                {children.map(sub=>{
                  const sa = selCatId===sub.id;
                  const so = overCatId===sub.id;
                  const dc = menuCategories.find(c=>c.id===dragCatId);
                  const sr = so && dc?.parentId===sub.parentId;
                  const sc = sub.color||'#3b82f6';
                  return (
                    <div key={sub.id} style={{ opacity:dragCatId===sub.id?.3:1 }}>
                      {sr && <div style={{ height:2, background:'var(--acc)', borderRadius:2, margin:'1px 12px' }}/>}
                      <div draggable onDragStart={e=>{setDragCatId(sub.id);e.dataTransfer.effectAllowed='move';}} onDragOver={e=>{e.preventDefault();setOverCatId(sub.id);}} onDragLeave={()=>setOverCatId(null)} onDragEnd={()=>{setDragCatId(null);setOverCatId(null);}} onDrop={e=>onCatDrop(e,sub.id)} onClick={()=>{setSelCatId(sub.id);setSelItemId(null);setSearch('');}}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 8px 5px 20px', borderRadius:7, marginBottom:1, cursor:'grab', border:`1.5px solid ${!sr&&so?'var(--acc)':sa?sc+'55':'transparent'}`, background:!sr&&so?'var(--acc-d)':sa?sc+'18':'transparent' }}>
                        <span style={{ fontSize:13 }}>{sub.icon}</span>
                        <span style={{ fontSize:10, fontWeight:sa?700:400, color:sa?sc:'var(--t3)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub.label}</span>
                        <span style={{ fontSize:9, color:'var(--t4)' }}>{menuItems.filter(i=>!i.archived&&i.type!=='subitem'&&i.cat===sub.id).length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {roots.length===0 && <div style={{ textAlign:'center', padding:'20px 6px', color:'var(--t4)', fontSize:10 }}>No categories.<br/>Click + to add one.</div>}
        </div>

        {selCat && (
          <div style={{ padding:'6px 8px', borderTop:'1px solid var(--bdr)', display:'flex', gap:4, flexShrink:0 }}>
            <button onClick={()=>setEditingCat(selCat)} style={{ flex:1, padding:'5px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:10, fontWeight:600 }}>✎ Edit</button>
            <button onClick={()=>{if(confirm(`Delete "${selCat.label}"?`)){removeCategory(selCatId);setSelCatId(null);markBOChange();}}} style={{ padding:'5px 8px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:10 }}>✕</button>
          </div>
        )}
      </div>

      {/* ── PANEL 2: Item GRID (mirrors POS) ───────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {selCat || search.trim() ? (<>
          {/* Toolbar */}
          <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            {selCat && (
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:28, height:28, borderRadius:8, background:`${selCat.color||'#3b82f6'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{selCat.icon}</div>
                <span style={{ fontSize:14, fontWeight:800, color:'var(--t1)' }}>{selCat.label}</span>
                <span style={{ fontSize:10, color:'var(--t4)' }}>{displayItems.length} items</span>
              </div>
            )}
            <div style={{ position:'relative', flex:1, maxWidth:260 }}>
              <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--t4)' }}>🔍</span>
              <input style={{ ...inp, paddingLeft:28, fontSize:12 }} placeholder="Search all items…" value={search} onChange={e=>setSearch(e.target.value)}/>
              {search && <button onClick={()=>setSearch('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:14 }}>×</button>}
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              <button onClick={()=>addItem('simple')} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700 }}>+ Item</button>
            </div>
          </div>

          {/* GRID — same card style as POS */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px' }}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{ if(dragItemId&&!overItemId){ const max=Math.max(...displayItems.map(i=>i.sortOrder??0),0); updateMenuItem(dragItemId,{sortOrder:max+1}); markBOChange(); setDragItemId(null); } }}>
            {displayItems.length===0 ? (
              <div style={{ textAlign:'center', padding:'48px 0', color:'var(--t4)' }}>
                <div style={{ fontSize:36, opacity:.15, marginBottom:10 }}>{selCat?.icon||'🍽'}</div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--t3)', marginBottom:8 }}>No items in {selCat?.label||'this category'}</div>
                <button onClick={()=>addItem('simple')} style={{ padding:'8px 18px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700 }}>+ Add first item</button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
                {displayItems.map(item=>{
                  const active   = selItemId===item.id;
                  const isOver   = overItemId===item.id;
                  const isDragging= dragItemId===item.id;
                  const isParent = menuItems.some(c=>c.parentId===item.id&&!c.archived);
                  const is86     = eightySixIds.includes(item.id);
                  const p        = item.pricing||{base:item.price||0};
                  const children = menuItems.filter(c=>c.parentId===item.id&&!c.archived);
                  const catColor = (menuCategories.find(c=>c.id===item.cat)||selCat)?.color||'#3b82f6';
                  return (
                    <div key={item.id} style={{ opacity:isDragging?.3:1 }}>
                      {isOver && <div style={{ height:3, background:'var(--acc)', borderRadius:2, marginBottom:3 }}/>}
                      <div
                        draggable
                        onDragStart={e=>{setDragItemId(item.id);e.dataTransfer.effectAllowed='move';}}
                        onDragOver={e=>{e.preventDefault();if(dragItemId&&dragItemId!==item.id)setOverItemId(item.id);}}
                        onDragLeave={()=>setOverItemId(null)}
                        onDragEnd={()=>{setDragItemId(null);setOverItemId(null);}}
                        onDrop={e=>{e.preventDefault();onItemDrop(e,item.id);}}
                        onClick={()=>setSelItemId(active?null:item.id)}
                        style={{
                          position:'relative', borderRadius:14, cursor:'pointer', userSelect:'none',
                          border:`2px solid ${active?'var(--acc)':'var(--bdr)'}`,
                          background:active?'var(--acc-d)':'var(--bg2)',
                          overflow:'hidden', minHeight:90,
                          boxShadow:active?'0 0 0 3px var(--acc-b)':'none',
                          transition:'border-color .1s, box-shadow .1s',
                        }}>
                        {/* Colour bar — matches POS */}
                        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:catColor, opacity:.8 }}/>
                        <div style={{ padding:'10px 10px 9px 14px' }}>
                          <div style={{ fontSize:13, fontWeight:700, color:active?'var(--acc)':'var(--t1)', lineHeight:1.3, marginBottom:4 }}>
                            {item.menuName||item.name}
                          </div>
                          {item.description && <div style={{ fontSize:10, color:'var(--t4)', marginBottom:4, lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{item.description}</div>}
                          <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                            {isParent ? (
                              <span style={{ fontSize:11, fontWeight:700, color:catColor }}>from £{Math.min(...children.map(c=>c.pricing?.base??c.price??0)).toFixed(2)}</span>
                            ) : (
                              <span style={{ fontSize:13, fontWeight:800, color:catColor, fontFamily:'var(--font-mono)' }}>{p.base>0?`£${p.base.toFixed(2)}`:'free'}</span>
                            )}
                            {isParent && <span style={{ fontSize:8, padding:'1px 5px', borderRadius:8, background:catColor+'22', color:catColor, fontWeight:700 }}>sizes</span>}
                            {(item.assignedModifierGroups||[]).length>0 && <span style={{ fontSize:8, color:'var(--acc)', padding:'1px 4px', borderRadius:6, background:'var(--acc-d)', fontWeight:700 }}>⊕ options</span>}
                            {(item.allergens||[]).length>0 && <span style={{ fontSize:8, color:'var(--red)', fontWeight:700 }}>⚠{item.allergens.length}</span>}
                            {is86 && <span style={{ fontSize:8, padding:'1px 5px', borderRadius:8, background:'var(--red-d)', color:'var(--red)', fontWeight:800 }}>86'd</span>}
                          </div>
                        </div>
                        {/* Drag handle — top right */}
                        <div style={{ position:'absolute', top:4, right:6, fontSize:9, color:'var(--t4)', cursor:'grab', lineHeight:1 }}>⣿</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ padding:'4px 12px', borderTop:'1px solid var(--bdr)', fontSize:9, color:'var(--t4)', background:'var(--bg1)' }}>
            Drag cards to reorder · order reflects on POS instantly
          </div>
        </>) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, color:'var(--t4)' }}>
            <span style={{ fontSize:40, opacity:.12 }}>🍽</span>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--t3)' }}>Select a category to see its items</span>
            <span style={{ fontSize:11, color:'var(--t4)' }}>or use search to find any item</span>
            <div style={{ position:'relative', marginTop:4 }}>
              <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--t4)' }}>🔍</span>
              <input style={{ ...inp, paddingLeft:28, width:260 }} placeholder="Search all items…" value={search} onChange={e=>setSearch(e.target.value)} autoFocus/>
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL 3: Item editor ────────────────────────────────────────── */}
      {selItem && (
        <ItemEditor key={selItem.id} item={selItem}
          allCategories={menuCategories.filter(c=>!c.isSpecial)}
          onUpdate={patch=>{updateMenuItem(selItem.id,patch);markBOChange();}}
          onArchive={()=>{archiveMenuItem(selItem.id);setSelItemId(null);markBOChange();showToast('Archived','info');}}
          onClose={()=>setSelItemId(null)}
          is86={eightySixIds.includes(selItem.id)} onToggle86={()=>toggle86(selItem.id)}
          menuItems={menuItems} addMenuItem={addMenuItem} updateMenuItem={updateMenuItem}
          markBOChange={markBOChange} showToast={showToast}
        />
      )}

      {editingCat && (
        <CatModal cat={editingCat} roots={roots}
          onSave={p=>{updateCategory(editingCat.id,p);markBOChange();setEditingCat(null);showToast('Updated','success');}}
          onDelete={()=>{removeCategory(editingCat.id);setSelCatId(null);setEditingCat(null);markBOChange();}}
          onClose={()=>setEditingCat(null)}/>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM EDITOR
// ═══════════════════════════════════════════════════════════════════════════
function ItemEditor({ item, allCategories, onUpdate, onArchive, onClose, is86, onToggle86, menuItems, addMenuItem, updateMenuItem, markBOChange, showToast }) {
  const { modifierGroupDefs, instructionGroupDefs } = useStore();
  const [section, setSection] = useState('details');

  const rootCats = allCategories.filter(c=>!c.parentId);
  const subCats  = allCategories.filter(c=>c.parentId);
  const isSub    = item.type==='subitem';
  const p        = item.pricing||{base:item.price||0};

  const f   = (k,v) => onUpdate({[k]:v});
  const fp  = (k,v) => onUpdate({ pricing:{...p,[k]:v===''?null:parseFloat(v)||0}, ...(k==='base'?{price:parseFloat(v)||0}:{}) });
  const toggleModGroup = gid=>{
    const cur=item.assignedModifierGroups||[];
    onUpdate({assignedModifierGroups:cur.find(g=>g.groupId===gid)?cur.filter(g=>g.groupId!==gid):[...cur,{groupId:gid,min:0,max:null}]});
  };
  const toggleInstGroup = gid=>{
    const cur=item.assignedInstructionGroups||[];
    onUpdate({assignedInstructionGroups:cur.includes(gid)?cur.filter(g=>g!==gid):[...cur,gid]});
  };

  // Variants: children of this item
  const variants = menuItems.filter(c=>c.parentId===item.id&&!c.archived);
  const isParent = variants.length>0;

  const addVariant = ()=>{
    addMenuItem({ name:'New size', menuName:'New size', receiptName:'New size', kitchenName:'New size',
      type:'simple', parentId:item.id, cat:item.cat, allergens:item.allergens||[],
      pricing:{base:0,dineIn:null,takeaway:null,collection:null,delivery:null},
      assignedModifierGroups:[], assignedInstructionGroups:[],
    });
    if((item.type||'simple')!=='variants') onUpdate({type:'variants'});
    markBOChange();
  };
  const updateVariant = (id,patch)=>{ updateMenuItem(id,patch); markBOChange(); };
  const removeVariant = id=>{ updateMenuItem(id,{archived:true,parentId:null}); markBOChange(); showToast('Variant removed','info'); if(variants.filter(v=>v.id!==id).length===0) onUpdate({type:'simple'}); };

  const SECS=[{id:'details',label:'Details'},{id:'variants',label:`Variants${isParent?` (${variants.length})`:''}`,hide:isSub},{id:'modifiers',label:'Modifiers',hide:isSub},{id:'pricing',label:'Pricing'},{id:'allergens',label:'Allergens'}].filter(s=>!s.hide);

  return (
    <div style={{ width:340, borderLeft:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg1)', flexShrink:0 }}>
      {/* Header */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:800, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.menuName||item.name}</span>
          <button onClick={onToggle86} style={{ fontSize:10, padding:'2px 7px', borderRadius:10, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${is86?'var(--grn-b)':'var(--red-b)'}`, background:is86?'var(--grn-d)':'var(--red-d)', color:is86?'var(--grn)':'var(--red)', fontWeight:700 }}>{is86?'Un-86':'86'}</button>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
        </div>
        <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
          {SECS.map(s=>(
            <button key={s.id} onClick={()=>setSection(s.id)} style={{ padding:'3px 9px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:section===s.id?700:400, border:'none', background:section===s.id?'var(--acc-d)':'transparent', color:section===s.id?'var(--acc)':'var(--t4)' }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>

        {section==='details' && (
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            <div>
              <span style={lbl}>Type</span>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {[['simple','Simple'],['modifiable','Modifiable'],['variants','Has sizes/variants'],['subitem','Sub item (option only)'],['combo','Combo']].map(([v,l])=>{
                  const act=(item.type||'simple')===v||((v==='variants')&&isParent);
                  return <button key={v} onClick={()=>f('type',v)} style={{ padding:'4px 9px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:act?700:400, border:`1.5px solid ${act?'var(--acc)':'var(--bdr)'}`, background:act?'var(--acc-d)':'var(--bg3)', color:act?'var(--acc)':'var(--t2)' }}>{l}</button>;
                })}
              </div>
              {isSub && <div style={{ marginTop:6, padding:'6px 9px', background:'var(--bg3)', borderRadius:7, fontSize:10, color:'var(--t3)' }}>Sub items only appear as options inside modifier groups — not on the POS ordering screen.</div>}
            </div>
            <div><span style={lbl}>POS button name</span><input style={inp} value={item.menuName||''} onChange={e=>f('menuName',e.target.value)}/></div>
            {!isSub && <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div><span style={lbl}>Receipt name</span><input style={inp} value={item.receiptName||''} onChange={e=>f('receiptName',e.target.value)} placeholder="Same as above"/></div>
                <div><span style={lbl}>Kitchen / KDS</span><input style={inp} value={item.kitchenName||''} onChange={e=>f('kitchenName',e.target.value)} placeholder="Same as above"/></div>
              </div>
              <div><span style={lbl}>Description <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>(kiosk & online)</span></span><textarea style={{ ...inp, resize:'none', height:50 }} value={item.description||''} onChange={e=>f('description',e.target.value)}/></div>
            </>}
            <div>
              <span style={lbl}>Primary category</span>
              <select value={item.cat||''} onChange={e=>f('cat',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
                <option value="">— none —</option>
                {rootCats.map(c=><optgroup key={c.id} label={`${c.icon} ${c.label}`}><option value={c.id}>{c.icon} {c.label}</option>{subCats.filter(s=>s.parentId===c.id).map(s=><option key={s.id} value={s.id}>  └ {s.label}</option>)}</optgroup>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Also in</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {[...rootCats,...subCats].filter(c=>c.id!==item.cat).map(c=>{
                  const on=(item.cats||[]).includes(c.id);
                  return <button key={c.id} onClick={()=>{const cur=item.cats||[];onUpdate({cats:on?cur.filter(id=>id!==c.id):[...cur,c.id]});}} style={{ padding:'2px 7px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:on?700:400, border:`1px solid ${on?'var(--acc)':'var(--bdr)'}`, background:on?'var(--acc-d)':'var(--bg3)', color:on?'var(--acc)':'var(--t4)' }}>{c.icon} {c.label}</button>;
                })}
              </div>
            </div>
            {!isSub && <div>
              <span style={lbl}>Visible on</span>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {[['pos','POS'],['kiosk','Kiosk'],['online','Online'],['onlineDelivery','Delivery']].map(([k,l])=>{
                  const on=(item.visibility||{pos:true,kiosk:true,online:true,onlineDelivery:true})[k]!==false;
                  return <button key={k} onClick={()=>onUpdate({visibility:{...(item.visibility||{pos:true,kiosk:true,online:true,onlineDelivery:true}),[k]:!on}})} style={{ padding:'3px 9px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:on?700:400, border:`1px solid ${on?'var(--acc)':'var(--bdr)'}`, background:on?'var(--acc-d)':'var(--bg3)', color:on?'var(--acc)':'var(--t3)' }}>{on?'✓ ':''}{l}</button>;
                })}
              </div>
            </div>}
          </div>
        )}

        {section==='variants' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>Sizes / variations</div>
                <div style={{ fontSize:10, color:'var(--t3)', marginTop:2 }}>e.g. Pint & Half, or Small/Medium/Large. Customer picks one on the POS.</div>
              </div>
            </div>
            {variants.length===0 && <div style={{ padding:'10px', background:'var(--bg3)', borderRadius:8, fontSize:11, color:'var(--t4)', marginBottom:12 }}>No variants yet. Click "+ Add variant" to add sizes or types.</div>}
            {variants.map(v=>{
              const vp=v.pricing||{base:v.price||0};
              return (
                <div key={v.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:6, alignItems:'center', padding:'7px 9px', marginBottom:5, borderRadius:8, background:'var(--bg3)', border:'1px solid var(--bdr)' }}>
                  <input style={{ ...inp, fontSize:12, padding:'5px 8px' }} value={v.menuName||v.name} onChange={e=>updateVariant(v.id,{menuName:e.target.value,name:e.target.value,receiptName:e.target.value,kitchenName:e.target.value})} placeholder="e.g. Pint"/>
                  <div style={{ position:'relative', width:76 }}>
                    <span style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--t4)' }}>£</span>
                    <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft:18, fontSize:12, padding:'5px 5px 5px 18px', width:76 }} value={vp.base||''} placeholder="0.00" onChange={e=>updateVariant(v.id,{pricing:{...vp,base:parseFloat(e.target.value)||0},price:parseFloat(e.target.value)||0})}/>
                  </div>
                  <button onClick={()=>removeVariant(v.id)} style={{ width:26, height:26, borderRadius:6, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                </div>
              );
            })}
            <button onClick={addVariant} style={{ width:'100%', padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1.5px dashed var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600, marginTop:4 }}>+ Add variant</button>
          </div>
        )}

        {section==='modifiers' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <span style={lbl}>Modifier groups — paid options</span>
              {(!modifierGroupDefs||modifierGroupDefs.length===0)&&<div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>Create modifier groups in the "Modifier groups" tab first.</div>}
              {(modifierGroupDefs||[]).map(g=>{
                const asgn=(item.assignedModifierGroups||[]).find(ag=>ag.groupId===g.id);
                return (
                  <div key={g.id} style={{ marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:9, border:`1.5px solid ${asgn?'var(--acc)':'var(--bdr)'}`, background:asgn?'var(--acc-d)':'var(--bg3)', cursor:'pointer' }} onClick={()=>toggleModGroup(g.id)}>
                      <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${asgn?'var(--acc)':'var(--bdr2)'}`, background:asgn?'var(--acc)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {asgn&&<div style={{ width:7,height:7,borderRadius:1,background:'#0b0c10' }}/>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:asgn?700:500, color:asgn?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                        <div style={{ fontSize:9, color:'var(--t4)' }}>{(g.options||[]).map(o=>o.name).join(' · ')||'no options'}</div>
                      </div>
                    </div>
                    {asgn && (
                      <div style={{ display:'flex', gap:10, alignItems:'center', padding:'4px 10px', background:'var(--acc-d)', borderRadius:'0 0 8px 8px', borderTop:'1px solid var(--acc-b)' }} onClick={e=>e.stopPropagation()}>
                        <label style={{ fontSize:10, display:'flex', alignItems:'center', gap:4, cursor:'pointer', color:'var(--t2)' }}>
                          <input type="checkbox" checked={(asgn.min||0)>0} onChange={e=>{const cur=item.assignedModifierGroups||[];onUpdate({assignedModifierGroups:cur.map(ag=>ag.groupId===g.id?{...ag,min:e.target.checked?1:0}:ag)});}} style={{ accentColor:'var(--acc)' }}/> Required
                        </label>
                        <label style={{ fontSize:10, display:'flex', alignItems:'center', gap:4, cursor:'pointer', color:'var(--t2)' }}>Max:
                          <input type="number" min="1" max="99" style={{ ...inp, width:42, padding:'2px 5px', fontSize:10 }} value={asgn.max||''} placeholder="∞" onChange={e=>{const cur=item.assignedModifierGroups||[];onUpdate({assignedModifierGroups:cur.map(ag=>ag.groupId===g.id?{...ag,max:e.target.value===''?null:parseInt(e.target.value)||1}:ag)});}}/>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div>
              <span style={lbl}>Instruction groups — no price change</span>
              {(!instructionGroupDefs||instructionGroupDefs.length===0)&&<div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>Create instruction groups in the "Instruction groups" tab first.</div>}
              {(instructionGroupDefs||[]).map(g=>{
                const asgn=(item.assignedInstructionGroups||[]).includes(g.id);
                return (
                  <div key={g.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', marginBottom:5, borderRadius:9, border:`1.5px solid ${asgn?'var(--grn)':'var(--bdr)'}`, background:asgn?'var(--grn-d)':'var(--bg3)', cursor:'pointer' }} onClick={()=>toggleInstGroup(g.id)}>
                    <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${asgn?'var(--grn)':'var(--bdr2)'}`, background:asgn?'var(--grn)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {asgn&&<div style={{ width:7,height:7,borderRadius:1,background:'#0b0c10' }}/>}
                    </div>
                    <div>
                      <div style={{ fontSize:12, fontWeight:asgn?700:500, color:asgn?'var(--grn)':'var(--t1)' }}>{g.name}</div>
                      <div style={{ fontSize:9, color:'var(--t4)' }}>{(g.options||[]).join(' · ')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {section==='pricing' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {isParent && <div style={{ padding:'8px', background:'var(--bg3)', borderRadius:7, fontSize:11, color:'var(--t3)' }}>This item has variants — set prices on each variant in the Variants tab.</div>}
            {[{k:'base',label:'Base price',hint:'Used when no channel override is set',accent:true},{k:'dineIn',label:'Dine-in',hint:'Leave blank to use base'},{k:'takeaway',label:'Takeaway',hint:''},{k:'collection',label:'Collection',hint:''},{k:'delivery',label:'Delivery apps',hint:''}].map(({k,label,hint,accent})=>(
              <div key={k}>
                <span style={lbl}>{label} {hint&&<span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--t4)', fontSize:9 }}>{hint}</span>}</span>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:accent?15:13, color:accent?'var(--acc)':'var(--t4)', fontWeight:700 }}>£</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft:24, fontSize:accent?15:13, fontWeight:accent?800:400, color:accent?'var(--acc)':'var(--t1)' }} value={k==='base'?(p.base||0):p[k]!==null&&p[k]!==undefined?p[k]:''} placeholder={k!=='base'?`${p.base||0} (base)`:''} onChange={e=>fp(k,e.target.value)}/>
                  {k!=='base'&&p[k]!==null&&p[k]!==undefined&&<button onClick={()=>fp(k,'')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:14 }}>×</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {section==='allergens' && (
          <div>
            <span style={lbl}>Declared allergens (all 14 EU mandatory)</span>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {ALLERGENS.map(a=>{
                const on=(item.allergens||[]).includes(a.id);
                return (
                  <button key={a.id} onClick={()=>onUpdate({allergens:on?(item.allergens||[]).filter(x=>x!==a.id):[...(item.allergens||[]),a.id]})} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', textAlign:'left', border:`1.5px solid ${on?'var(--red)':'var(--bdr)'}`, background:on?'var(--red-d)':'var(--bg3)' }}>
                    <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${on?'var(--red)':'var(--bdr2)'}`, background:on?'var(--red)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {on&&<div style={{ width:7,height:7,borderRadius:1,background:'#fff' }}/>}
                    </div>
                    <span style={{ fontSize:12, fontWeight:on?700:400, color:on?'var(--red)':'var(--t1)', flex:1 }}>{a.icon} {a.label}</span>
                    {on&&<span style={{ fontSize:10, color:'var(--red)', fontWeight:700 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--bdr)', flexShrink:0 }}>
        <button onClick={()=>{if(confirm('Archive this item?'))onArchive();}} style={{ width:'100%', padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'transparent', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11, fontWeight:600 }}>Archive item</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODIFIER GROUPS TAB
// Options are plain {id, name, price} pairs — no sub-item concept
// ═══════════════════════════════════════════════════════════════════════════
function ModifiersTab() {
  const { modifierGroupDefs:groups, addModifierGroupDef, updateModifierGroupDef, removeModifierGroupDef, markBOChange, showToast } = useStore();
  const [selId, setSelId]   = useState(null);
  const [newName, setNewName] = useState('');
  const [newOpt, setNewOpt]   = useState({ name:'', price:'' });

  const sel = groups?.find(g=>g.id===selId);
  const maxUnlimited = !sel?.max||sel.max>=99;
  const upd = patch => { updateModifierGroupDef(selId,patch); markBOChange(); };

  const addGroup = () => {
    if (!newName.trim()) return;
    addModifierGroupDef({ name:newName.trim(), min:0, max:1, selectionType:'single', options:[] });
    markBOChange(); setNewName('');
    setTimeout(()=>setSelId(useStore.getState().modifierGroupDefs?.slice(-1)[0]?.id),30);
  };

  const addOpt = () => {
    if (!newOpt.name.trim()) return;
    const opt = { id:`opt-${Date.now()}`, name:newOpt.name.trim(), price:parseFloat(newOpt.price)||0 };
    upd({ options:[...(sel.options||[]),opt] });
    setNewOpt({name:'',price:''});
  };

  const delOpt = oid => upd({ options:(sel.options||[]).filter(o=>o.id!==oid) });
  const updOpt = (oid,patch) => upd({ options:(sel.options||[]).map(o=>o.id===oid?{...o,...patch}:o) });

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* List */}
      <div style={{ width:260, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>Modifier groups</div>
          <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.5, marginBottom:8 }}>Paid option groups. Create here, then assign to items from the item editor (Modifiers tab).</div>
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1, fontSize:12, padding:'6px 10px' }} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="Group name e.g. Sides"/>
            <button onClick={addGroup} disabled={!newName.trim()} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, opacity:newName.trim()?1:.4 }}>+</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {(groups||[]).map(g=>(
            <div key={g.id} onClick={()=>setSelId(g.id===selId?null:g.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', marginBottom:4, borderRadius:9, cursor:'pointer', border:`1.5px solid ${selId===g.id?'var(--acc)':'var(--bdr)'}`, background:selId===g.id?'var(--acc-d)':'var(--bg3)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:selId===g.id?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).length} options · {g.min>0?'required':'optional'} · {!g.max||g.max>=99?'unlimited':`max ${g.max}`}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();if(confirm(`Remove "${g.name}"?`)){removeModifierGroupDef(g.id);if(selId===g.id)setSelId(null);markBOChange();}}} style={{ width:22,height:22,borderRadius:5,border:'1px solid var(--red-b)',background:'var(--red-d)',color:'var(--red)',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
          ))}
          {(!groups||groups.length===0)&&<div style={{ textAlign:'center', padding:'32px 8px', color:'var(--t4)', fontSize:11 }}>No modifier groups yet</div>}
        </div>
      </div>

      {/* Editor */}
      {sel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
            <input style={{ ...inp, fontSize:15, fontWeight:800, border:'none', background:'transparent', padding:'0 0 8px' }} value={sel.name} onChange={e=>upd({name:e.target.value})}/>
            {/* Required / Optional */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              {[[false,'Optional','Customer can skip'],[ true,'Required','Must pick at least one']].map(([req,label,hint])=>{
                const act=req?(sel.min||0)>0:!(sel.min>0);
                return <button key={label} onClick={()=>upd({min:req?1:0})} style={{ padding:'7px 8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', textAlign:'left', border:`2px solid ${act?'var(--acc)':'var(--bdr)'}`, background:act?'var(--acc-d)':'var(--bg3)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:act?'var(--acc)':'var(--t2)' }}>{label}</div>
                  <div style={{ fontSize:9, color:'var(--t4)' }}>{hint}</div>
                </button>;
              })}
            </div>
            {/* Max */}
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:600, color:'var(--t2)' }}>Max selections:</span>
              <button onClick={()=>upd({max:1,selectionType:'single'})} style={{ padding:'3px 9px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:sel.max===1?800:500, border:`1px solid ${sel.max===1?'var(--acc)':'var(--bdr)'}`, background:sel.max===1?'var(--acc-d)':'var(--bg3)', color:sel.max===1?'var(--acc)':'var(--t3)' }}>1 (pick one)</button>
              <button onClick={()=>upd({max:99,selectionType:'multiple'})} style={{ padding:'3px 9px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:maxUnlimited&&sel.max!==1?800:500, border:`1px solid ${maxUnlimited&&sel.max!==1?'var(--acc)':'var(--bdr)'}`, background:maxUnlimited&&sel.max!==1?'var(--acc-d)':'var(--bg3)', color:maxUnlimited&&sel.max!==1?'var(--acc)':'var(--t3)' }}>Unlimited</button>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:10, color:'var(--t4)' }}>Custom:</span>
                <input type="number" min="2" max="20" style={{ ...inp, width:48, padding:'3px 6px', fontSize:11 }} value={!maxUnlimited&&sel.max!==1?sel.max:''} placeholder="N" onChange={e=>upd({max:parseInt(e.target.value)||2,selectionType:'multiple'})}/>
              </div>
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
            <span style={lbl}>Options in this group</span>
            {(sel.options||[]).map(opt=>(
              <div key={opt.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px auto', gap:6, alignItems:'center', marginBottom:6 }}>
                <input style={{ ...inp, fontSize:12 }} value={opt.name} onChange={e=>updOpt(opt.id,{name:e.target.value})} placeholder="Option name"/>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--t4)' }}>£</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft:20, fontSize:12 }} value={opt.price||''} placeholder="0.00" onChange={e=>updOpt(opt.id,{price:parseFloat(e.target.value)||0})}/>
                </div>
                <button onClick={()=>delOpt(opt.id)} style={{ width:28,height:28,borderRadius:6,border:'1px solid var(--red-b)',background:'var(--red-d)',color:'var(--red)',cursor:'pointer',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
              </div>
            ))}
            {/* Add new option */}
            <div style={{ marginTop:8, padding:'10px', background:'var(--bg3)', borderRadius:10, border:'1.5px dashed var(--bdr2)' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--t3)', marginBottom:6 }}>Add option</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 80px auto', gap:6, alignItems:'center' }}>
                <input style={{ ...inp, fontSize:12 }} value={newOpt.name} onChange={e=>setNewOpt(o=>({...o,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addOpt()} placeholder="e.g. Chips" autoComplete="off"/>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--t4)' }}>£</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft:20, fontSize:12 }} value={newOpt.price} placeholder="0.00" onChange={e=>setNewOpt(o=>({...o,price:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addOpt()}/>
                </div>
                <button onClick={addOpt} disabled={!newOpt.name.trim()} style={{ width:28,height:28,borderRadius:6,border:'none',background:'var(--acc)',color:'#0b0c10',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',opacity:newOpt.name.trim()?1:.4 }}>+</button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--t4)' }}>
          <div style={{ fontSize:32, opacity:.15 }}>⊕</div>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--t3)' }}>Select a group to edit</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTRUCTION GROUPS TAB
// ═══════════════════════════════════════════════════════════════════════════
function InstructionsTab() {
  const { instructionGroupDefs:groups, addInstructionGroupDef, updateInstructionGroupDef, removeInstructionGroupDef, markBOChange } = useStore();
  const [selId, setSelId]   = useState(null);
  const [newName, setNewName] = useState('');
  const [newOpt, setNewOpt]   = useState('');

  const sel = groups?.find(g=>g.id===selId);
  const upd = patch => { updateInstructionGroupDef(selId,patch); markBOChange(); };
  const addGroup = () => { if(!newName.trim())return; addInstructionGroupDef({name:newName.trim(),options:[]}); markBOChange(); setNewName(''); setTimeout(()=>setSelId(useStore.getState().instructionGroupDefs?.slice(-1)[0]?.id),30); };
  const addOpt = () => { if(!newOpt.trim())return; upd({options:[...(sel.options||[]),newOpt.trim()]}); setNewOpt(''); };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      <div style={{ width:260, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>Instruction groups</div>
          <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.5, marginBottom:8 }}>Preparation choices printed on the kitchen ticket. No price change — customer picks one during ordering.</div>
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1, fontSize:12, padding:'6px 10px' }} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="e.g. Cooking preference"/>
            <button onClick={addGroup} disabled={!newName.trim()} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, opacity:newName.trim()?1:.4 }}>+</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {(groups||[]).map(g=>(
            <div key={g.id} onClick={()=>setSelId(g.id===selId?null:g.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', marginBottom:4, borderRadius:9, cursor:'pointer', border:`1.5px solid ${selId===g.id?'var(--acc)':'var(--bdr)'}`, background:selId===g.id?'var(--acc-d)':'var(--bg3)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:selId===g.id?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).join(' · ')||'no options yet'}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();if(confirm(`Remove "${g.name}"?`)){removeInstructionGroupDef(g.id);if(selId===g.id)setSelId(null);markBOChange();}}} style={{ width:22,height:22,borderRadius:5,border:'1px solid var(--red-b)',background:'var(--red-d)',color:'var(--red)',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
          ))}
          {(!groups||groups.length===0)&&<div style={{ textAlign:'center', padding:'32px 8px', color:'var(--t4)', fontSize:11 }}>No instruction groups yet</div>}
        </div>
      </div>
      {sel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
            <input style={{ ...inp, fontSize:15, fontWeight:800, border:'none', background:'transparent', padding:'0 0 4px' }} value={sel.name} onChange={e=>upd({name:e.target.value})}/>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:3 }}>Printed on kitchen ticket. Customer picks one — no price change.</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            <span style={lbl}>Options</span>
            {(sel.options||[]).map((opt,i)=>(
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:7, marginBottom:6 }}>
                <input style={inp} value={opt} onChange={e=>{const o=[...(sel.options||[])];o[i]=e.target.value;upd({options:o});}}/>
                <button onClick={()=>upd({options:(sel.options||[]).filter((_,idx)=>idx!==i)})} style={{ width:30,height:36,borderRadius:7,border:'1px solid var(--red-b)',background:'var(--red-d)',color:'var(--red)',cursor:'pointer',fontSize:14 }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:7, marginTop:6 }}>
              <input style={{ ...inp, flex:1 }} value={newOpt} onChange={e=>setNewOpt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addOpt()} placeholder="e.g. Rare, Medium rare, Well done"/>
              <button onClick={addOpt} disabled={!newOpt.trim()} style={{ padding:'7px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600, opacity:newOpt.trim()?1:.4 }}>+ Add</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:32, opacity:.15 }}>📝</div>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--t3)' }}>Select a group to edit</div>
        </div>
      )}
    </div>
  );
}

// ── Edit Category Modal ───────────────────────────────────────────────────────
function CatModal({ cat, roots, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ label:cat.label, icon:cat.icon||'🍽', color:cat.color||'#3b82f6', parentId:cat.parentId||'', accountingGroup:cat.accountingGroup||'' });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:18, width:'100%', maxWidth:420, padding:'20px', boxShadow:'var(--sh3)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)' }}>Edit category</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div><span style={lbl}>Name</span><input style={inp} value={f.label} onChange={e=>set('label',e.target.value)} autoFocus/></div>
          <div><span style={lbl}>Accounting group</span><input style={inp} value={f.accountingGroup} onChange={e=>set('accountingGroup',e.target.value)} placeholder="e.g. Food, Beverages"/></div>
          <div><span style={lbl}>Icon</span><div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>{ICONS.map(ic=><button key={ic} onClick={()=>set('icon',ic)} style={{ width:28,height:28,borderRadius:7,border:`1.5px solid ${f.icon===ic?'var(--acc)':'var(--bdr)'}`,background:f.icon===ic?'var(--acc-d)':'var(--bg3)',cursor:'pointer',fontSize:14 }}>{ic}</button>)}</div></div>
          <div><span style={lbl}>Colour</span><div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{COLOURS.map(c=><button key={c} onClick={()=>set('color',c)} style={{ width:20,height:20,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:f.color===c?'3px solid var(--t1)':'none',outlineOffset:2 }}/>)}</div></div>
          <div><span style={lbl}>Parent</span>
            <select value={f.parentId} onChange={e=>set('parentId',e.target.value)} style={{ ...inp, cursor:'pointer' }}>
              <option value="">Root category</option>
              {roots.filter(r=>r.id!==cat.id).map(r=><option key={r.id} value={r.id}>Subcategory of: {r.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:7, marginTop:14 }}>
          <button onClick={()=>{if(confirm('Delete?'))onDelete();}} style={{ padding:'8px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:600 }}>Delete</button>
          <button onClick={onClose} style={{ flex:1, padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12 }}>Cancel</button>
          <button onClick={()=>onSave({...f,parentId:f.parentId||null})} disabled={!f.label.trim()} style={{ flex:2, padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:800, opacity:f.label.trim()?1:.4 }}>Save</button>
        </div>
      </div>
    </div>
  );
}
