/**
 * MenuManager — 3 focused tabs
 *
 * Menu       — Category tree | Items in category | Item editor (all config in one place)
 * Modifiers  — Reusable paid option group library
 * Instructions — Preparation instruction group library
 *
 * Flow: Click a category → see its items → click an item → edit everything inline
 */
import { useState, useMemo, useRef } from 'react';
import { useStore } from '../../store';
import { ALLERGENS } from '../../data/seed';

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp = {
  background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:9,
  padding:'8px 11px', color:'var(--t1)', fontSize:13, fontFamily:'inherit',
  outline:'none', boxSizing:'border-box', width:'100%',
};
const lbl = {
  fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase',
  letterSpacing:'.1em', marginBottom:5, display:'block',
};
const ICONS   = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🌿','🔥','❄️','⭐','🌮','🦞','🍜','🥩','🍤','🥚','🥐','🫙'];
const COLOURS = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899','#10b981','#8b5cf6'];

// ── Root ─────────────────────────────────────────────────────────────────────
export default function MenuManager() {
  const [tab, setTab] = useState('menu');
  const TABS = [
    { id:'menu',         label:'Menu',               icon:'🍽' },
    { id:'modifiers',    label:'Modifier groups',     icon:'⊕' },
    { id:'instructions', label:'Instruction groups',  icon:'📝' },
  ];
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <nav style={{ display:'flex', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'0 20px', height:46, cursor:'pointer', fontFamily:'inherit', border:'none',
            borderBottom:`3px solid ${tab===t.id?'var(--acc)':'transparent'}`,
            background:'transparent', color:tab===t.id?'var(--acc)':'var(--t3)',
            fontSize:13, fontWeight:tab===t.id?800:500, display:'flex', alignItems:'center', gap:7,
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>
      <div style={{ flex:1, overflow:'hidden' }}>
        {tab === 'menu'         && <MenuTab />}
        {tab === 'modifiers'    && <ModifiersLibrary />}
        {tab === 'instructions' && <InstructionsLibrary />}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MENU TAB — Category tree | Items in category | Item editor
// ═════════════════════════════════════════════════════════════════════════════
function MenuTab() {
  const {
    menuCategories, menuItems,
    addCategory, updateCategory, removeCategory,
    addMenuItem, updateMenuItem, archiveMenuItem,
    eightySixIds, toggle86, markBOChange, showToast,
  } = useStore();

  const [selCatId, setSelCatId] = useState(null);    // selected category
  const [selItemId, setSelItemId] = useState(null);   // selected item for editor
  const [catDragId, setCatDragId] = useState(null);
  const [catDropId, setCatDropId] = useState(null);
  const [itemDragId, setItemDragId] = useState(null);
  const [itemOverId, setItemOverId] = useState(null);
  const [addingCat, setAddingCat] = useState(false);
  const [catForm, setCatForm] = useState({ label:'', icon:'🍽', color:'#3b82f6', parentId:null });
  const [editingCatId, setEditingCatId] = useState(null);

  const roots   = useMemo(() => menuCategories.filter(c => !c.parentId && !c.isSpecial).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)), [menuCategories]);
  const allCats = useMemo(() => [...roots, ...menuCategories.filter(c=>c.parentId)], [menuCategories, roots]);

  // Items in the selected category (and its subcategories)
  const catItems = useMemo(() => {
    if (!selCatId) return [];
    const subIds = menuCategories.filter(c=>c.parentId===selCatId).map(c=>c.id);
    const inCat = (i) => i.cat===selCatId || subIds.includes(i.cat) || (i.cats||[]).includes(selCatId) || (i.cats||[]).some(c=>subIds.includes(c));
    const base  = menuItems.filter(i => !i.archived && inCat(i));
    // Parents first, then children under them
    const parents = base.filter(i=>!i.parentId).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
    const result  = [];
    parents.forEach(p => {
      result.push(p);
      menuItems.filter(c=>c.parentId===p.id&&!c.archived).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).forEach(c=>result.push({...c,_isChild:true}));
    });
    return result;
  }, [selCatId, menuCategories, menuItems]);

  const selCat  = menuCategories.find(c=>c.id===selCatId);
  const selItem = menuItems.find(i=>i.id===selItemId);

  // ── Category drag ─────────────────────────────────────────────────────────
  // Hold Shift while dragging: force nest (make subcategory)
  // Normal drag onto same-level category: reorder
  // Drag onto different-level category: nest
  // Drag onto root zone: un-nest
  const onCatDS = (e, id) => { setCatDragId(id); e.dataTransfer.effectAllowed='move'; };
  const onCatDO = (e, id) => { e.preventDefault(); if(id!==catDragId) setCatDropId(id); };
  const onCatDrop = (e, targetId) => {
    e.preventDefault();
    if (!catDragId||catDragId===targetId) { setCatDragId(null); setCatDropId(null); return; }

    const dragged = menuCategories.find(c=>c.id===catDragId);
    const target  = menuCategories.find(c=>c.id===targetId);

    if (targetId==='root') {
      // Un-nest: move to root
      updateCategory(catDragId, { parentId:null });
      showToast('Moved to root','success');
    } else if (!dragged||!target) {
      // fallthrough
    } else if (dragged.parentId===target.parentId) {
      // Same level → REORDER
      const sameLevel = menuCategories.filter(c=>c.parentId===dragged.parentId).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      const without   = sameLevel.filter(c=>c.id!==catDragId);
      const targetIdx = without.findIndex(c=>c.id===targetId);
      const insert    = targetIdx===-1 ? without.length : targetIdx;
      const reordered = [...without.slice(0,insert), dragged, ...without.slice(insert)];
      reordered.forEach((cat,idx)=>{ if((cat.sortOrder||0)!==idx) updateCategory(cat.id,{sortOrder:idx}); });
      showToast('Reordered','success');
    } else {
      // Different level → NEST as subcategory of target
      const wouldCircle = menuCategories.find(c=>c.id===targetId)?.parentId===catDragId;
      if (wouldCircle) { showToast('Cannot nest that way','error'); }
      else { updateCategory(catDragId, { parentId:targetId }); showToast('Nested as subcategory','success'); }
    }
    markBOChange(); setCatDragId(null); setCatDropId(null);
  };
  const onCatEnd = () => { setCatDragId(null); setCatDropId(null); };

  // ── Item drag: drag handle to reorder within category ────────────────────
  const onItemHandleDS = (e, id) => { e.stopPropagation(); setItemDragId(id); e.dataTransfer.effectAllowed='move'; };
  const onItemRowDO    = (e, id) => { e.preventDefault(); if(itemDragId&&id!==itemDragId) setItemOverId(id); };
  const onItemDrop     = (e, targetId) => {
    e.preventDefault();
    if (!itemDragId||itemDragId===targetId) { setItemDragId(null); setItemOverId(null); return; }
    // Reorder: re-index by position
    const tops = catItems.filter(i=>!i._isChild);
    const without = tops.filter(i=>i.id!==itemDragId);
    const tIdx = without.findIndex(i=>i.id===targetId);
    const insert = tIdx===-1?without.length:tIdx;
    const reordered = [...without.slice(0,insert), tops.find(i=>i.id===itemDragId), ...without.slice(insert)];
    reordered.forEach((item,idx)=>{ if(item&&(item.sortOrder||0)!==idx) updateMenuItem(item.id,{sortOrder:idx}); });
    markBOChange(); showToast('Order updated','success');
    setItemDragId(null); setItemOverId(null);
  };
  const onItemEnd = () => { setItemDragId(null); setItemOverId(null); };

  // ── Add category ──────────────────────────────────────────────────────────
  const saveNewCat = () => {
    if (!catForm.label.trim()) return;
    addCategory({ menuId:'menu-1', ...catForm, label:catForm.label.trim(), sortOrder:menuCategories.length });
    markBOChange(); showToast(`"${catForm.label}" added`,'success');
    setCatForm({ label:'', icon:'🍽', color:'#3b82f6', parentId:null });
    setAddingCat(false);
  };

  // ── Add item ──────────────────────────────────────────────────────────────
  const addItem = (type='simple') => {
    const newItem = addMenuItem({
      name:'New item', menuName:'New item', receiptName:'New item', kitchenName:'New item',
      type, cat:selCatId||undefined, allergens:[],
      pricing:{ base:0, dineIn:null, takeaway:null, collection:null, delivery:null },
      assignedModifierGroups:[], assignedInstructionGroups:[],
    });
    markBOChange();
    setTimeout(()=>{ const id=useStore.getState().menuItems.slice(-1)[0]?.id; if(id) setSelItemId(id); },30);
  };

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── Panel 1: Category tree ──────────────────────────────────────── */}
      <div style={{ width:220, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', background:'var(--bg1)' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)', flex:1 }}>Categories</span>
          <button onClick={()=>setAddingCat(true)} style={{ width:26, height:26, borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'6px 8px' }}>
          {/* Root drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setCatDropId('root');}}
            onDrop={e=>onCatDrop(e,'root')}
            onDragLeave={()=>setCatDropId(null)}
            style={{ padding:'5px 10px', borderRadius:7, marginBottom:6, fontSize:10, color:'var(--t4)', border:`1.5px dashed ${catDropId==='root'?'var(--acc)':'var(--bdr)'}`, background:catDropId==='root'?'var(--acc-d)':'transparent', textAlign:'center', transition:'all .1s' }}>
            {catDropId==='root' ? 'Drop → root category' : 'Drop to un-nest'}
          </div>

          {roots.map(cat => {
            const children = menuCategories.filter(c=>c.parentId===cat.id);
            const itemCount = menuItems.filter(i=>!i.archived&&(i.cat===cat.id||children.some(s=>s.id===i.cat))).length;
            const isActive   = selCatId===cat.id;
            const isDrop     = catDropId===cat.id;
            const isDragging = catDragId===cat.id;
            const color      = cat.color||'#3b82f6';
            // Is this a reorder drop or a nest drop?
            const draggedCat = menuCategories.find(c=>c.id===catDragId);
            const isReorder  = isDrop && draggedCat?.parentId === cat.parentId;
            const isNest     = isDrop && !isReorder;
            return (
              <div key={cat.id} style={{ opacity:isDragging?.3:1 }}>
                {/* Drop indicator line for reordering */}
                {isReorder && <div style={{ height:3, background:'var(--acc)', borderRadius:2, margin:'1px 4px' }}/>}
                <div
                  draggable
                  onDragStart={e=>onCatDS(e,cat.id)}
                  onDragOver={e=>onCatDO(e,cat.id)}
                  onDragLeave={()=>setCatDropId(null)}
                  onDragEnd={onCatEnd}
                  onDrop={e=>onCatDrop(e,cat.id)}
                  onClick={()=>{ setSelCatId(cat.id); setSelItemId(null); }}
                  style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px', borderRadius:9, marginBottom:2, cursor:'grab', userSelect:'none',
                    border:`1.5px solid ${isNest?'var(--acc)':isActive?color+'55':'transparent'}`,
                    background:isNest?'var(--acc-d)':isActive?color+'15':'transparent',
                    transition:'all .1s' }}>
                  <span style={{ fontSize:9, color:'var(--t4)', cursor:'grab' }}>⣿</span>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
                  <span style={{ fontSize:16 }}>{cat.icon}</span>
                  <span style={{ fontSize:12, fontWeight:isActive?700:500, color:isActive?color:'var(--t2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.label}</span>
                  <span style={{ fontSize:10, color:'var(--t4)', flexShrink:0 }}>{itemCount}</span>
                  {children.length>0 && <span style={{ fontSize:9, color:'var(--t4)' }}>▾</span>}
                </div>

                {/* Subcategories */}
                {children.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(sub => {
                  const subCount = menuItems.filter(i=>!i.archived&&i.cat===sub.id).length;
                  const subActive = selCatId===sub.id;
                  const subDrop   = catDropId===sub.id;
                  const sc = sub.color||'#3b82f6';
                  return (
                    <div key={sub.id}
                      draggable
                      onDragStart={e=>onCatDS(e,sub.id)} onDragOver={e=>onCatDO(e,sub.id)}
                      onDragLeave={()=>setCatDropId(null)} onDragEnd={onCatEnd} onDrop={e=>onCatDrop(e,sub.id)}
                      onClick={()=>{ setSelCatId(sub.id); setSelItemId(null); }}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px 5px 22px', borderRadius:8, marginBottom:2, cursor:'pointer', userSelect:'none', border:`1.5px solid ${subDrop?'var(--acc)':subActive?sc+'55':'transparent'}`, background:subDrop?'var(--acc-d)':subActive?sc+'15':'transparent' }}>
                      <span style={{ fontSize:8, color:'var(--t4)', cursor:'grab' }}>⣿</span>
                      <span style={{ fontSize:14 }}>{sub.icon}</span>
                      <span style={{ fontSize:11, fontWeight:subActive?700:400, color:subActive?sc:'var(--t3)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sub.label}</span>
                      <span style={{ fontSize:9, color:'var(--t4)' }}>{subCount}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Add category inline */}
          {addingCat && (
            <div style={{ padding:'10px', background:'var(--bg2)', borderRadius:10, border:'1px solid var(--bdr)', marginTop:8 }}>
              <input style={{ ...inp, fontSize:12, marginBottom:8 }} value={catForm.label} onChange={e=>setCatForm(f=>({...f,label:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&saveNewCat()} placeholder="Category name" autoFocus/>
              <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginBottom:8 }}>
                {ICONS.slice(0,10).map(ic=><button key={ic} onClick={()=>setCatForm(f=>({...f,icon:ic}))} style={{ width:26,height:26,borderRadius:6,border:`1.5px solid ${catForm.icon===ic?'var(--acc)':'var(--bdr)'}`,background:catForm.icon===ic?'var(--acc-d)':'var(--bg3)',cursor:'pointer',fontSize:13 }}>{ic}</button>)}
              </div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                {COLOURS.map(c=><button key={c} onClick={()=>setCatForm(f=>({...f,color:c}))} style={{ width:18,height:18,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:catForm.color===c?'2px solid var(--t1)':'none',outlineOffset:2 }}/>)}
              </div>
              <select value={catForm.parentId||''} onChange={e=>setCatForm(f=>({...f,parentId:e.target.value||null}))} style={{ ...inp, fontSize:11, marginBottom:8, padding:'5px 8px' }}>
                <option value="">Root category</option>
                {roots.map(r=><option key={r.id} value={r.id}>└ Subcategory of: {r.label}</option>)}
              </select>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>setAddingCat(false)} style={{ flex:1, padding:'5px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t3)', fontSize:11 }}>Cancel</button>
                <button onClick={saveNewCat} disabled={!catForm.label.trim()} style={{ flex:2, padding:'5px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:11, fontWeight:700, opacity:catForm.label.trim()?1:.4 }}>Add</button>
              </div>
            </div>
          )}

          {roots.length===0&&!addingCat&&(
            <div style={{ textAlign:'center', padding:'24px 8px', color:'var(--t4)', fontSize:11 }}>No categories yet.<br/>Click + to add one.</div>
          )}
        </div>

        {/* Category actions when selected */}
        {selCat && (
          <div style={{ padding:'8px 10px', borderTop:'1px solid var(--bdr)', display:'flex', gap:5, flexShrink:0 }}>
            <button onClick={()=>setEditingCatId(selCatId)} style={{ flex:1, padding:'5px 8px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:11 }}>Edit cat</button>
            <button onClick={()=>{if(confirm(`Remove "${selCat.label}"?`)){removeCategory(selCatId);setSelCatId(null);markBOChange();}}} style={{ padding:'5px 8px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11 }}>Delete</button>
          </div>
        )}
      </div>

      {/* ── Panel 2: Items in category ──────────────────────────────────── */}
      <div style={{ width:280, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {selCat ? (
          <>
            <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:`${selCat.color||'#3b82f6'}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{selCat.icon}</div>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)', flex:1 }}>{selCat.label}</span>
              <div style={{ display:'flex', gap:5 }}>
                <button onClick={()=>addItem('subitem')} title="Add sub item" style={{ padding:'4px 8px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t4)', fontSize:10, fontWeight:700 }}>+ Sub</button>
                <button onClick={()=>addItem('simple')} style={{ padding:'4px 10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:11, fontWeight:700 }}>+ Item</button>
              </div>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'6px 8px' }}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{ if(itemDragId&&!itemOverId){const tops=catItems.filter(i=>!i._isChild);const max=Math.max(...tops.map(i=>i.sortOrder||0),0);updateMenuItem(itemDragId,{sortOrder:max+1,cat:selCatId});markBOChange();setItemDragId(null);} }}
            >
              {catItems.length===0 ? (
                <div style={{ textAlign:'center', padding:'32px 12px', color:'var(--t4)', fontSize:11, lineHeight:1.7 }}>
                  No items in {selCat.label} yet.<br/>Click + Item to add one.
                </div>
              ) : catItems.map(item => {
                const isChild  = item._isChild;
                const isSub    = item.type==='subitem';
                const isParent = menuItems.some(c=>c.parentId===item.id&&!c.archived);
                const active   = selItemId===item.id;
                const isOver   = itemOverId===item.id;
                const p        = item.pricing||{base:item.price||0};
                const modCount = (item.assignedModifierGroups||[]).length;
                const is86     = eightySixIds.includes(item.id);

                return (
                  <div key={item.id}>
                    {isOver && !isChild && <div style={{ height:3, background:'var(--acc)', borderRadius:2, margin:'0 2px 2px' }}/>}
                    <div
                    onDragOver={e=>{ e.preventDefault(); if(itemDragId&&!isChild) setItemOverId(item.id); }}
                    onDragLeave={()=>setItemOverId(null)}
                    onDrop={e=>{ e.preventDefault(); onItemDrop(e,item.id); }}
                    onDragEnd={onItemEnd}
                    onClick={()=>setSelItemId(active?null:item.id)}
                    style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 10px', borderRadius:9, marginBottom:3, cursor:'pointer', marginLeft:isChild?16:0, border:`1.5px solid ${active?'var(--acc)':'var(--bdr)'}`, background:active?'var(--acc-d)':isSub?'var(--bg2)':'var(--bg3)', opacity:(itemDragId===item.id||is86)?.4:1 }}>

                    {/* Drag handle */}
                    {!isChild&&!isSub&&(
                      <span draggable onDragStart={e=>onItemHandleDS(e,item.id)} onClick={e=>e.stopPropagation()} title="Drag to reorder"
                        style={{ fontSize:10, color:'var(--t4)', cursor:'grab', flexShrink:0 }}>⣿</span>
                    )}
                    {isChild&&<span style={{ fontSize:10, color:'var(--t4)' }}>↳</span>}

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ fontSize:12, fontWeight:active?700:600, color:active?'var(--acc)':'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {item.menuName||item.name}
                        </span>
                        {isSub    && <span style={{ fontSize:8, padding:'1px 4px', borderRadius:6, background:'var(--bg1)', color:'var(--t4)', border:'1px solid var(--bdr)', flexShrink:0 }}>sub</span>}
                        {isParent && <span style={{ fontSize:8, padding:'1px 4px', borderRadius:6, background:'var(--acc-d)', color:'var(--acc)', border:'1px solid var(--acc-b)', flexShrink:0 }}>variants</span>}
                        {is86     && <span style={{ fontSize:8, padding:'1px 4px', borderRadius:6, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)', flexShrink:0 }}>86'd</span>}
                      </div>
                      <div style={{ display:'flex', gap:6, marginTop:1 }}>
                        {(item.allergens||[]).length>0&&<span style={{ fontSize:9, color:'var(--red)' }}>⚠ {item.allergens.length}</span>}
                        {modCount>0&&<span style={{ fontSize:9, color:'var(--acc)' }}>⊕ {modCount}</span>}
                      </div>
                    </div>

                    {/* Price */}
                    <span style={{ fontSize:12, fontWeight:700, color:active?'var(--acc)':'var(--t2)', fontFamily:'var(--font-mono)', flexShrink:0 }}>
                      {isParent?'var':p.base>0?`£${p.base.toFixed(2)}`:isSub&&p.base>0?`+£${p.base.toFixed(2)}`:'free'}
                    </span>
                  </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding:'5px 10px', borderTop:'1px solid var(--bdr)', fontSize:9, color:'var(--t4)', background:'var(--bg1)' }}>
              {catItems.filter(i=>!i._isChild&&i.type!=='subitem').length} items · ⣿ drag to reorder
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', flexDirection:'column', gap:8 }}>
            <span style={{ fontSize:32, opacity:.2 }}>🍽</span>
            <span style={{ fontSize:12, fontWeight:600, color:'var(--t3)' }}>Select a category</span>
          </div>
        )}
      </div>

      {/* ── Panel 3: Item editor ────────────────────────────────────────── */}
      {selItem ? (
        <ItemEditor
          key={selItem.id}
          item={selItem}
          allCategories={menuCategories.filter(c=>!c.isSpecial)}
          onUpdate={patch=>{ updateMenuItem(selItem.id,patch); markBOChange(); }}
          onArchive={()=>{ archiveMenuItem(selItem.id); setSelItemId(null); markBOChange(); showToast('Archived','info'); }}
          onClose={()=>setSelItemId(null)}
          is86={eightySixIds.includes(selItem.id)}
          onToggle86={()=>toggle86(selItem.id)}
        />
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', flexDirection:'column', gap:8 }}>
          <span style={{ fontSize:32, opacity:.15 }}>✎</span>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--t3)' }}>{selCat ? 'Select an item to edit' : 'Select a category, then an item'}</span>
        </div>
      )}

      {/* Edit category modal */}
      {editingCatId && (
        <EditCategoryModal
          cat={menuCategories.find(c=>c.id===editingCatId)}
          roots={roots}
          onSave={(patch)=>{ updateCategory(editingCatId,patch); markBOChange(); setEditingCatId(null); showToast('Updated','success'); }}
          onDelete={()=>{ removeCategory(editingCatId); setSelCatId(null); setEditingCatId(null); markBOChange(); }}
          onClose={()=>setEditingCatId(null)}
        />
      )}
    </div>
  );
}

// ── Item Editor (right panel) ─────────────────────────────────────────────────
function ItemEditor({ item, allCategories, onUpdate, onArchive, onClose, is86, onToggle86 }) {
  const { modifierGroupDefs, instructionGroupDefs } = useStore();
  const [section, setSection] = useState('details'); // details | pricing | modifiers | allergens

  const rootCats = allCategories.filter(c=>!c.parentId);
  const subCats  = allCategories.filter(c=>c.parentId);
  const isSub    = item.type==='subitem';
  const p        = item.pricing||{base:item.price||0,dineIn:null,takeaway:null,collection:null,delivery:null};

  const f = (k,v) => onUpdate({[k]:v});
  const setPrice = (k,v) => onUpdate({ pricing:{...p,[k]:v===''?null:parseFloat(v)||0}, ...(k==='base'?{price:parseFloat(v)||0}:{}) });

  const toggleModGroup = (gid) => {
    const cur = item.assignedModifierGroups||[];
    const has = cur.find(g=>g.groupId===gid);
    onUpdate({ assignedModifierGroups: has ? cur.filter(g=>g.groupId!==gid) : [...cur,{groupId:gid,min:0,max:null}] });
  };
  const setModMin = (gid,v) => onUpdate({ assignedModifierGroups:(item.assignedModifierGroups||[]).map(g=>g.groupId===gid?{...g,min:parseInt(v)||0}:g) });
  const setModMax = (gid,v) => onUpdate({ assignedModifierGroups:(item.assignedModifierGroups||[]).map(g=>g.groupId===gid?{...g,max:v===''?null:parseInt(v)||1}:g) });
  const toggleInstGroup = (gid) => {
    const cur = item.assignedInstructionGroups||[];
    onUpdate({ assignedInstructionGroups: cur.includes(gid)?cur.filter(g=>g!==gid):[...cur,gid] });
  };

  const SECTIONS = [
    { id:'details',   label:'Details' },
    { id:'pricing',   label:'Pricing' },
    { id:'modifiers', label:'Modifiers' },
    { id:'allergens', label:'Allergens' },
  ];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', borderLeft:'1px solid var(--bdr)', background:'var(--bg1)' }}>
      {/* Header */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:800, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.menuName||item.name}</span>
          <button onClick={onToggle86} style={{ fontSize:10, padding:'3px 8px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', border:`1px solid ${is86?'var(--grn-b)':'var(--red-b)'}`, background:is86?'var(--grn-d)':'var(--red-d)', color:is86?'var(--grn)':'var(--red)', fontWeight:700 }}>{is86?'Un-86':'86'}</button>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:18 }}>×</button>
        </div>
        {/* Section tabs */}
        <div style={{ display:'flex', gap:3 }}>
          {SECTIONS.map(s=>(
            <button key={s.id} onClick={()=>setSection(s.id)} style={{ padding:'3px 10px', borderRadius:16, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:section===s.id?700:400, border:'none', background:section===s.id?'var(--acc-d)':'transparent', color:section===s.id?'var(--acc)':'var(--t4)' }}>{s.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>

        {/* ── DETAILS ── */}
        {section==='details' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Type */}
            <div>
              <span style={lbl}>Item type</span>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {[['simple','Simple','Fixed price'],['modifiable','Modifiable','Has options'],['variants','Variant parent','Shows size/type picker'],['subitem','Sub item','Used in modifier groups only'],['combo','Combo','Meal deal']].map(([v,l,d])=>{
                  const active = (item.type||'simple')===v;
                  return (
                    <button key={v} onClick={()=>f('type',v)} title={d} style={{ padding:'5px 10px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:active?700:400, border:`1.5px solid ${active?'var(--acc)':'var(--bdr)'}`, background:active?'var(--acc-d)':'var(--bg3)', color:active?'var(--acc)':'var(--t2)' }}>{l}</button>
                  );
                })}
              </div>
              {isSub && <div style={{ fontSize:10, color:'var(--t3)', marginTop:6, padding:'6px 8px', background:'var(--bg3)', borderRadius:7 }}>Sub items are hidden from the POS ordering screen. They can only be used as options inside modifier groups.</div>}
            </div>

            {/* Names */}
            <div>
              <span style={lbl}>Name on POS button</span>
              <input style={inp} value={item.menuName||''} onChange={e=>f('menuName',e.target.value)} placeholder="e.g. Ribeye steak"/>
            </div>
            {!isSub && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div><span style={lbl}>Receipt name</span><input style={inp} value={item.receiptName||''} onChange={e=>f('receiptName',e.target.value)} placeholder="Same as above"/></div>
                <div><span style={lbl}>Kitchen / KDS</span><input style={inp} value={item.kitchenName||''} onChange={e=>f('kitchenName',e.target.value)} placeholder="Same as above"/></div>
              </div>
            )}
            <div>
              <span style={lbl}>Description</span>
              <textarea style={{ ...inp, resize:'none', height:52 }} value={item.description||''} onChange={e=>f('description',e.target.value)} placeholder="Shown on kiosk & online ordering"/>
            </div>

            {/* Category */}
            <div>
              <span style={lbl}>Primary category</span>
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
            {/* Additional categories */}
            <div>
              <span style={lbl}>Also appears in</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {[...rootCats,...subCats].filter(c=>c.id!==item.cat).map(c=>{
                  const on=(item.cats||[]).includes(c.id);
                  return (<button key={c.id} onClick={()=>{ const cur=item.cats||[]; onUpdate({cats:on?cur.filter(id=>id!==c.id):[...cur,c.id]}); }} style={{ padding:'3px 8px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontSize:10, fontWeight:on?700:400, border:`1px solid ${on?'var(--acc)':'var(--bdr)'}`, background:on?'var(--acc-d)':'var(--bg3)', color:on?'var(--acc)':'var(--t4)' }}>{c.icon} {c.label}</button>);
                })}
              </div>
            </div>

            {/* Visibility */}
            {!isSub && (
              <div>
                <span style={lbl}>Visible on</span>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[['pos','POS'],['kiosk','Kiosk'],['online','Online'],['onlineDelivery','Delivery apps']].map(([k,l])=>{
                    const on=(item.visibility||{pos:true,kiosk:true,online:true,onlineDelivery:true})[k]!==false;
                    return (<button key={k} onClick={()=>onUpdate({visibility:{...(item.visibility||{pos:true,kiosk:true,online:true,onlineDelivery:true}),[k]:!on}})} style={{ padding:'4px 10px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:on?700:400, border:`1px solid ${on?'var(--acc)':'var(--bdr)'}`, background:on?'var(--acc-d)':'var(--bg3)', color:on?'var(--acc)':'var(--t3)' }}>{on?'✓ ':''}{l}</button>);
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PRICING ── */}
        {section==='pricing' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              {k:'base',       label:'Base price',  hint:'Used when no channel-specific price is set', accent:true},
              {k:'dineIn',     label:'Dine-in',     hint:'Leave blank to use base price'},
              {k:'takeaway',   label:'Takeaway',    hint:'Leave blank to use base price'},
              {k:'collection', label:'Collection',  hint:'Leave blank to use base price'},
              {k:'delivery',   label:'Delivery',    hint:'Leave blank to use base price'},
            ].map(({k,label,hint,accent})=>(
              <div key={k}>
                <span style={lbl}>{label} {hint&&<span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--t4)', fontSize:9 }}>{hint}</span>}</span>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, color:accent?'var(--acc)':'var(--t4)', fontWeight:700 }}>£</span>
                  <input type="number" step="0.01" min="0"
                    style={{ ...inp, paddingLeft:24, fontSize:accent?16:13, fontWeight:accent?800:400, color:accent?'var(--acc)':'var(--t1)' }}
                    value={k==='base'?(p.base||0):p[k]!==null&&p[k]!==undefined?p[k]:''}
                    placeholder={k!=='base'?`${p.base||0} (base)`:''}
                    onChange={e=>setPrice(k,e.target.value)}
                  />
                  {k!=='base'&&p[k]!==null&&p[k]!==undefined&&<button onClick={()=>setPrice(k,'')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:14 }}>×</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MODIFIERS ── */}
        {section==='modifiers' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {isSub && <div style={{ padding:'10px', background:'var(--bg3)', borderRadius:8, fontSize:11, color:'var(--t3)' }}>Sub items cannot have modifier groups.</div>}
            {!isSub && (
              <>
                {/* Modifier groups */}
                <div>
                  <span style={lbl}>Modifier groups <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>— paid options that change the price</span></span>
                  {(modifierGroupDefs||[]).length===0 && <div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>Create modifier groups in the Modifier groups tab first.</div>}
                  {(modifierGroupDefs||[]).map(g=>{
                    const assigned=(item.assignedModifierGroups||[]).find(ag=>ag.groupId===g.id);
                    return (
                      <div key={g.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', marginBottom:6, borderRadius:9, border:`1.5px solid ${assigned?'var(--acc)':'var(--bdr)'}`, background:assigned?'var(--acc-d)':'var(--bg3)', cursor:'pointer' }} onClick={()=>toggleModGroup(g.id)}>
                        <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${assigned?'var(--acc)':'var(--bdr2)'}`, background:assigned?'var(--acc)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {assigned&&<div style={{ width:8, height:8, borderRadius:1, background:'#0b0c10' }}/>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:assigned?700:500, color:assigned?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                          <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).map(o=>o.name).join(' · ')||'no options yet'}</div>
                        </div>
                        {assigned && (
                          <div style={{ display:'flex', gap:6, alignItems:'center' }} onClick={e=>e.stopPropagation()}>
                            <label style={{ fontSize:10, color:'var(--t2)', display:'flex', alignItems:'center', gap:3, cursor:'pointer' }}>
                              <input type="checkbox" checked={(assigned.min||0)>0} onChange={e=>setModMin(g.id,e.target.checked?1:0)} style={{ accentColor:'var(--acc)' }}/> Required
                            </label>
                            <span style={{ fontSize:10, color:'var(--t4)' }}>Max:</span>
                            <input type="number" min="1" max="99" style={{ ...inp, width:44, padding:'2px 6px', fontSize:10 }} value={assigned.max||''} placeholder="∞" onChange={e=>setModMax(g.id,e.target.value)}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Instruction groups */}
                <div>
                  <span style={lbl}>Instruction groups <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>— preparation choices, no price change</span></span>
                  {(instructionGroupDefs||[]).length===0 && <div style={{ fontSize:11, color:'var(--t4)', padding:'8px 0' }}>Create instruction groups in the Instruction groups tab first.</div>}
                  {(instructionGroupDefs||[]).map(g=>{
                    const assigned=(item.assignedInstructionGroups||[]).includes(g.id);
                    return (
                      <div key={g.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', marginBottom:6, borderRadius:9, border:`1.5px solid ${assigned?'var(--grn)':'var(--bdr)'}`, background:assigned?'var(--grn-d)':'var(--bg3)', cursor:'pointer' }} onClick={()=>toggleInstGroup(g.id)}>
                        <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${assigned?'var(--grn)':'var(--bdr2)'}`, background:assigned?'var(--grn)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {assigned&&<div style={{ width:8, height:8, borderRadius:1, background:'#0b0c10' }}/>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:assigned?700:500, color:assigned?'var(--grn)':'var(--t1)' }}>{g.name}</div>
                          <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).join(' · ')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ALLERGENS ── */}
        {section==='allergens' && (
          <div>
            <span style={lbl}>Declared allergens</span>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {ALLERGENS.map(a=>{
                const on=(item.allergens||[]).includes(a.id);
                return (
                  <button key={a.id} onClick={()=>onUpdate({allergens:on?(item.allergens||[]).filter(x=>x!==a.id):[...(item.allergens||[]),a.id]})}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 11px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', border:`1.5px solid ${on?'var(--red)':'var(--bdr)'}`, background:on?'var(--red-d)':'var(--bg3)' }}>
                    <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${on?'var(--red)':'var(--bdr2)'}`, background:on?'var(--red)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {on&&<div style={{ width:8, height:8, borderRadius:1, background:'#fff' }}/>}
                    </div>
                    <span style={{ fontSize:13, fontWeight:on?700:500, color:on?'var(--red)':'var(--t1)', flex:1 }}>{a.icon} {a.label}</span>
                    {on && <span style={{ fontSize:11, color:'var(--red)', fontWeight:700 }}>✓ Declared</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--bdr)', display:'flex', gap:6 }}>
        <button onClick={()=>{if(confirm('Archive this item?'))onArchive();}} style={{ flex:1, padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'transparent', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:11, fontWeight:600 }}>Archive</button>
      </div>
    </div>
  );
}

// ── Edit Category Modal ───────────────────────────────────────────────────────
function EditCategoryModal({ cat, roots, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({ label:cat.label, icon:cat.icon||'🍽', color:cat.color||'#3b82f6', accountingGroup:cat.accountingGroup||'', parentId:cat.parentId||null });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:18, width:'100%', maxWidth:460, padding:'20px', boxShadow:'var(--sh3)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:800, color:'var(--t1)' }}>Edit category</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div><span style={lbl}>Name</span><input style={inp} value={form.label} onChange={e=>f('label',e.target.value)} autoFocus/></div>
          <div><span style={lbl}>Accounting group</span><input style={inp} value={form.accountingGroup} onChange={e=>f('accountingGroup',e.target.value)} placeholder="e.g. Food, Beverages"/></div>
          <div>
            <span style={lbl}>Icon</span>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {ICONS.map(ic=><button key={ic} onClick={()=>f('icon',ic)} style={{ width:30,height:30,borderRadius:7,border:`1.5px solid ${form.icon===ic?'var(--acc)':'var(--bdr)'}`,background:form.icon===ic?'var(--acc-d)':'var(--bg3)',cursor:'pointer',fontSize:15 }}>{ic}</button>)}
            </div>
          </div>
          <div>
            <span style={lbl}>Colour</span>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {COLOURS.map(c=><button key={c} onClick={()=>f('color',c)} style={{ width:22,height:22,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:form.color===c?'3px solid var(--t1)':'none',outlineOffset:2 }}/>)}
            </div>
          </div>
          <div>
            <span style={lbl}>Parent (for subcategory)</span>
            <select value={form.parentId||''} onChange={e=>f('parentId',e.target.value||null)} style={{ ...inp, cursor:'pointer' }}>
              <option value="">Root category</option>
              {roots.filter(r=>r.id!==cat.id).map(r=><option key={r.id} value={r.id}>Subcategory of: {r.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:16 }}>
          <button onClick={()=>{if(confirm('Delete this category?'))onDelete();}} style={{ padding:'8px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:600 }}>Delete</button>
          <button onClick={onClose} style={{ flex:1, padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12 }}>Cancel</button>
          <button onClick={()=>onSave(form)} disabled={!form.label.trim()} style={{ flex:2, padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:800, opacity:form.label.trim()?1:.4 }}>Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MODIFIER GROUPS LIBRARY
// ═════════════════════════════════════════════════════════════════════════════
function ModifiersLibrary() {
  const { modifierGroupDefs: groups, addModifierGroupDef, updateModifierGroupDef, removeModifierGroupDef, menuItems, markBOChange, showToast } = useStore();
  const [selId, setSelId]     = useState(null);
  const [newName, setNewName] = useState('');
  const [subSearch, setSubSearch] = useState('');

  const subitems = menuItems.filter(i => i.type==='subitem'&&!i.archived);
  const filteredSubs = subSearch ? subitems.filter(i=>(i.menuName||i.name||'').toLowerCase().includes(subSearch.toLowerCase())) : subitems;
  const sel = groups?.find(g=>g.id===selId);
  const isRequired = sel?.min>0;
  const maxUnlimited = !sel?.max||sel.max>=99;

  const addGroup = () => {
    if (!newName.trim()) return;
    addModifierGroupDef({ name:newName.trim(), min:0, max:1, selectionType:'single', options:[] });
    markBOChange(); setNewName('');
    setTimeout(()=>setSelId(useStore.getState().modifierGroupDefs.slice(-1)[0]?.id),30);
  };
  const updGroup = (patch) => { updateModifierGroupDef(selId,patch); markBOChange(); };
  const addSubitemOpt = (sub) => {
    if ((sel.options||[]).find(o=>o.id===sub.id)) { showToast('Already in group','error'); return; }
    updGroup({ options:[...(sel.options||[]),{id:sub.id,name:sub.menuName||sub.name,price:sub.pricing?.base??sub.price??0}] });
  };
  const delOpt = (oid) => updGroup({ options:(sel.options||[]).filter(o=>o.id!==oid) });

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Group list */}
      <div style={{ width:260, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>Modifier groups</div>
          <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8, lineHeight:1.4 }}>Paid options that change the price. Assign to items from the item editor.</div>
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1, fontSize:12, padding:'6px 10px' }} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="New group name…"/>
            <button onClick={addGroup} disabled={!newName.trim()} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, opacity:newName.trim()?1:.4 }}>+</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {(groups||[]).map(g=>(
            <div key={g.id} onClick={()=>setSelId(g.id===selId?null:g.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', marginBottom:4, borderRadius:9, cursor:'pointer', border:`1.5px solid ${selId===g.id?'var(--acc)':'var(--bdr)'}`, background:selId===g.id?'var(--acc-d)':'var(--bg3)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:selId===g.id?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).length} options · {g.min>0?'required':'optional'} · {g.max>=99||!g.max?'unlimited':`max ${g.max}`}</div>
              </div>
              <button onClick={e=>{e.stopPropagation();if(confirm(`Remove "${g.name}"?`)){removeModifierGroupDef(g.id);if(selId===g.id)setSelId(null);markBOChange();}}} style={{ width:22,height:22,borderRadius:5,border:'1px solid var(--red-b)',background:'var(--red-d)',color:'var(--red)',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
            </div>
          ))}
          {(!groups||groups.length===0)&&<div style={{ textAlign:'center', padding:'32px 8px', color:'var(--t4)', fontSize:11 }}>No modifier groups yet</div>}
        </div>
      </div>

      {/* Group editor */}
      {sel ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
            <input style={{ ...inp, fontSize:15, fontWeight:800, border:'none', background:'transparent', padding:'0 0 8px' }} value={sel.name} onChange={e=>updGroup({name:e.target.value})}/>
            {/* Required / Optional */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
              {[['Optional',0,'var(--grn)'],['Required',1,'var(--acc)']].map(([label,minVal,color])=>{
                const active = (minVal===0&&!isRequired)||(minVal===1&&isRequired);
                return <button key={label} onClick={()=>updGroup({min:minVal})} style={{ padding:'7px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', textAlign:'left', border:`2px solid ${active?color:'var(--bdr)'}`, background:active?color+'22':'var(--bg3)' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:active?color:'var(--t2)' }}>{label}</div>
                  <div style={{ fontSize:9, color:'var(--t4)' }}>{minVal===0?'Customer can skip':'Must pick at least one'}</div>
                </button>;
              })}
            </div>
            {/* Max selections */}
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, color:'var(--t2)', fontWeight:600 }}>Max selections:</span>
              {[['1 (pick one)',1,'single'],[' Unlimited',99,'multiple']].map(([label,val,st])=>{
                const active = val===1?sel.max===1:maxUnlimited&&sel.max!==1;
                return <button key={label} onClick={()=>updGroup({max:val,selectionType:st})} style={{ padding:'3px 10px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:active?800:500, border:`1px solid ${active?'var(--acc)':'var(--bdr)'}`, background:active?'var(--acc-d)':'var(--bg3)', color:active?'var(--acc)':'var(--t3)' }}>{label}</button>;
              })}
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:10, color:'var(--t4)' }}>Custom:</span>
                <input type="number" min="2" max="20" style={{ ...inp, width:50, padding:'3px 6px', fontSize:11 }} value={!maxUnlimited&&sel.max!==1?sel.max:''} placeholder="N" onChange={e=>updGroup({max:parseInt(e.target.value)||2,selectionType:'multiple'})}/>
              </div>
            </div>
          </div>

          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
            {/* Options in this group */}
            <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
              <span style={lbl}>Options in this group</span>
              {(sel.options||[]).length===0 ? (
                <div style={{ padding:'10px', background:'var(--bg3)', borderRadius:8, fontSize:11, color:'var(--t4)' }}>
                  No options yet. Add sub items from the panel on the right →
                </div>
              ) : (sel.options||[]).map(opt=>{
                const sub = menuItems.find(i=>i.id===opt.id);
                return (
                  <div key={opt.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', marginBottom:5, borderRadius:8, background:'var(--bg3)', border:'1px solid var(--bdr)' }}>
                    <span style={{ fontSize:10, padding:'1px 5px', borderRadius:4, background:'var(--bg1)', border:'1px solid var(--bdr)', color:'var(--t4)', fontWeight:700 }}>⬡</span>
                    <span style={{ flex:1, fontSize:12, fontWeight:600, color:'var(--t1)' }}>{opt.name}</span>
                    <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:opt.price>0?'var(--acc)':'var(--t4)' }}>{opt.price>0?`+£${opt.price.toFixed(2)}`:'free'}</span>
                    {!sub&&<span style={{ fontSize:9, color:'var(--red)', padding:'1px 5px', borderRadius:4, background:'var(--red-d)' }}>missing</span>}
                    <button onClick={()=>delOpt(opt.id)} style={{ width:22,height:22,borderRadius:5,border:'1px solid var(--red-b)',background:'var(--red-d)',color:'var(--red)',cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>×</button>
                  </div>
                );
              })}
            </div>

            {/* Sub item picker */}
            <div style={{ width:200, borderLeft:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg2)', flexShrink:0 }}>
              <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--t2)', marginBottom:5 }}>Add sub items</div>
                <input style={{ ...inp, fontSize:11, padding:'4px 8px' }} value={subSearch} onChange={e=>setSubSearch(e.target.value)} placeholder="Search…"/>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'5px 7px' }}>
                {filteredSubs.length===0 ? (
                  <div style={{ padding:'12px 6px', fontSize:10, color:'var(--t4)', lineHeight:1.5, textAlign:'center' }}>No sub items yet.<br/>Create them in the Menu tab → + Sub button.</div>
                ) : filteredSubs.map(sub=>{
                  const already=(sel.options||[]).some(o=>o.id===sub.id);
                  const price=sub.pricing?.base??sub.price??0;
                  return (
                    <button key={sub.id} onClick={()=>!already&&addSubitemOpt(sub)} style={{ width:'100%', textAlign:'left', padding:'6px 8px', borderRadius:7, marginBottom:3, cursor:already?'default':'pointer', fontFamily:'inherit', border:`1px solid ${already?'var(--grn-b)':'var(--bdr)'}`, background:already?'var(--grn-d)':'var(--bg3)', opacity:already?.7:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ flex:1, fontSize:11, fontWeight:600, color:already?'var(--grn)':'var(--t1)' }}>{sub.menuName||sub.name}</span>
                        <span style={{ fontSize:10, color:already?'var(--grn)':price>0?'var(--acc)':'var(--t4)', fontFamily:'var(--font-mono)' }}>{already?'✓':price>0?`+£${price.toFixed(2)}`:'free'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {subitems.length===0&&<div style={{ padding:'7px 9px', borderTop:'1px solid var(--bdr)', fontSize:9, color:'var(--acc)', background:'var(--acc-d)', lineHeight:1.4 }}>💡 Create sub items first: Menu tab → select a category → + Sub</div>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:32, opacity:.2 }}>⊕</div>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>Select a modifier group to edit</div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// INSTRUCTION GROUPS LIBRARY
// ═════════════════════════════════════════════════════════════════════════════
function InstructionsLibrary() {
  const { instructionGroupDefs: groups, addInstructionGroupDef, updateInstructionGroupDef, removeInstructionGroupDef, markBOChange } = useStore();
  const [selId, setSelId]     = useState(null);
  const [newName, setNewName] = useState('');
  const [newOpt, setNewOpt]   = useState('');

  const sel = groups?.find(g=>g.id===selId);
  const updGroup = (patch) => { updateInstructionGroupDef(selId,patch); markBOChange(); };
  const addGroup = () => {
    if (!newName.trim()) return;
    addInstructionGroupDef({ name:newName.trim(), options:[] });
    markBOChange(); setNewName('');
    setTimeout(()=>setSelId(useStore.getState().instructionGroupDefs.slice(-1)[0]?.id),30);
  };
  const addOpt = () => { if(!newOpt.trim())return; updGroup({options:[...(sel.options||[]),newOpt.trim()]}); setNewOpt(''); };
  const delOpt = (i) => updGroup({options:(sel.options||[]).filter((_,idx)=>idx!==i)});
  const updOpt = (i,v) => updGroup({options:(sel.options||[]).map((o,idx)=>idx===i?v:o)});

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      <div style={{ width:260, borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', marginBottom:4 }}>Instruction groups</div>
          <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8, lineHeight:1.4 }}>Preparation choices — no price change. e.g. "Cooking preference: Rare / Medium / Well done".</div>
          <div style={{ display:'flex', gap:6 }}>
            <input style={{ ...inp, flex:1, fontSize:12, padding:'6px 10px' }} value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder="e.g. Cooking preference"/>
            <button onClick={addGroup} disabled={!newName.trim()} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700, opacity:newName.trim()?1:.4 }}>+</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {(groups||[]).map(g=>(
            <div key={g.id} onClick={()=>setSelId(g.id===selId?null:g.id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', marginBottom:4, borderRadius:9, cursor:'pointer', border:`1.5px solid ${selId===g.id?'var(--acc)':'var(--bdr)'}`, background:selId===g.id?'var(--acc-d)':'var(--bg3)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:selId===g.id?'var(--acc)':'var(--t1)' }}>{g.name}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{(g.options||[]).length} options · no price change</div>
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
            <input style={{ ...inp, fontSize:15, fontWeight:800, border:'none', background:'transparent', padding:'0 0 4px' }} value={sel.name} onChange={e=>updGroup({name:e.target.value})}/>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>These are printed on the kitchen ticket. Customer selects one during ordering. No price change.</div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            <span style={lbl}>Options</span>
            {(sel.options||[]).map((opt,i)=>(
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:7 }}>
                <input style={inp} value={opt} onChange={e=>updOpt(i,e.target.value)}/>
                <button onClick={()=>delOpt(i)} style={{ width:30,height:36,borderRadius:7,border:'1px solid var(--red-b)',background:'var(--red-d)',color:'var(--red)',cursor:'pointer',fontSize:14 }}>×</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <input style={{ ...inp, flex:1 }} value={newOpt} onChange={e=>setNewOpt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addOpt()} placeholder="e.g. Rare, Medium rare, Well done…"/>
              <button onClick={addOpt} disabled={!newOpt.trim()} style={{ padding:'7px 14px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600, opacity:newOpt.trim()?1:.4 }}>+ Add</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:32, opacity:.2 }}>📝</div>
          <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>Select an instruction group to edit</div>
        </div>
      )}
    </div>
  );
}
