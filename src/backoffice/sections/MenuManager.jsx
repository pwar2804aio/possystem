import { useState, useMemo, useCallback, useRef } from 'react';
import { useStore } from '../../store';
import { ALLERGENS, PRODUCTION_CENTRES } from '../../data/seed';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const inp = { background:'var(--bg3)', border:'1.5px solid var(--bdr2)', borderRadius:10, padding:'8px 12px', color:'var(--t1)', fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', width:'100%' };
const label = { display:'block', fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:5 };

const ITEM_TYPES = [
  { id:'simple',    label:'Simple item',     desc:'Fixed price, no choices',         icon:'⬛' },
  { id:'modifiers', label:'Modifiers',        desc:'Choices (cooking, sauce, size)',   icon:'⊕' },
  { id:'variants',  label:'Variants / sizes', desc:'Multiple size options',           icon:'▾' },
  { id:'pizza',     label:'Pizza builder',    desc:'Custom crust, toppings, extras',  icon:'🍕' },
  { id:'bundle',    label:'Bundle / combo',   desc:'Set menu or meal deal',           icon:'📦' },
];

const SCOPES = [
  { id:'local',  label:'Local',  desc:'This location only',                     color:'#3b82f6' },
  { id:'shared', label:'Shared', desc:'Name shared, price set per location',    color:'#e8a020' },
  { id:'global', label:'Global', desc:'Everything shared across all locations', color:'#22c55e' },
];

const COURSES = [
  { id:null, label:'No course' },
  { id:1,    label:'Course 1 — Starters' },
  { id:2,    label:'Course 2 — Mains' },
  { id:3,    label:'Course 3 — Desserts' },
];

const VISIBILITY_CHANNELS = [
  { id:'pos',            label:'POS terminal',     icon:'🖥' },
  { id:'kiosk',          label:'Kiosk',            icon:'⬜' },
  { id:'online',         label:'Online ordering',  icon:'🌐' },
  { id:'onlineDelivery', label:'Delivery apps',    icon:'🛵' },
];

function getEffectivePrice(item, menuId) {
  if (menuId && item.priceOverrides?.[menuId] !== undefined) return item.priceOverrides[menuId];
  return item.price || item.basePrice || 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function MenuManager() {
  const {
    menus, activeMenuId, setActiveMenuId, addMenu, updateMenu, removeMenu,
    menuCategories, addCategory, updateCategory, removeCategory,
    menuItems, addMenuItem, updateMenuItem, archiveMenuItem, duplicateMenuItem,
    eightySixIds, toggle86, dailyCounts, setDailyCount, showToast, markBOChange,
  } = useStore();

  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [search, setSearch] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid | table

  const activeMenu = menus.find(m => m.id === activeMenuId) || menus[0];

  // Category tree for active menu
  const rootCats = useMemo(() =>
    menuCategories.filter(c => !c.parentId && (c.menuId === activeMenuId || !c.menuId) && !c.isSpecial).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0)),
    [menuCategories, activeMenuId]
  );

  const subCats = useCallback(parentId =>
    menuCategories.filter(c => c.parentId === parentId).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0)),
    [menuCategories]
  );

  // Items for selected category (or search)
  const displayItems = useMemo(() => {
    let items = menuItems.filter(i => !i.archived);
    if (search) {
      const q = search.toLowerCase();
      return items.filter(i => (i.menuName||i.name||'').toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q));
    }
    if (selectedCatId) {
      const childIds = menuCategories.filter(c => c.parentId === selectedCatId).map(c => c.id);
      items = items.filter(i => i.cat === selectedCatId || childIds.includes(i.cat));
    }
    return items;
  }, [menuItems, selectedCatId, search, menuCategories]);

  const selectedItem = menuItems.find(i => i.id === selectedItemId);

  const handleSelectItem = id => setSelectedItemId(id === selectedItemId ? null : id);

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden', fontFamily:'inherit' }}>

      {/* ── PANEL 1: Menu tabs + Category tree ── */}
      <div style={{ width:240, borderRight:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>

        {/* Menu selector */}
        <div style={{ padding:'12px 12px 8px', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em' }}>Menus</span>
            <button onClick={() => setShowNewMenu(true)} style={{ fontSize:11, color:'var(--acc)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>+ New</button>
          </div>
          {menus.map(m => (
            <button key={m.id} onClick={() => { setActiveMenuId(m.id); setSelectedCatId(null); setSelectedItemId(null); }} style={{
              width:'100%', padding:'7px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit',
              fontSize:12, fontWeight:activeMenuId===m.id?800:400, border:'none', marginBottom:2, textAlign:'left',
              background:activeMenuId===m.id?'var(--acc-d)':'transparent',
              color:activeMenuId===m.id?'var(--acc)':'var(--t2)',
              borderLeft:`2px solid ${activeMenuId===m.id?'var(--acc)':'transparent'}`,
              display:'flex', alignItems:'center', justifyContent:'space-between',
            }}>
              <span>{m.name}</span>
              {m.isDefault && <span style={{ fontSize:8, fontWeight:800, padding:'1px 5px', borderRadius:10, background:'var(--bg3)', color:'var(--t4)', border:'1px solid var(--bdr)' }}>DEFAULT</span>}
            </button>
          ))}
        </div>

        {/* Category tree */}
        <div style={{ flex:1, overflowY:'auto', padding:'10px 10px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.1em' }}>Categories</span>
            <button onClick={() => setShowNewCat('root')} style={{ fontSize:11, color:'var(--acc)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700 }}>+ Add</button>
          </div>

          {/* All items */}
          <button onClick={() => { setSelectedCatId(null); setSelectedItemId(null); }} style={{
            width:'100%', padding:'6px 8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
            fontSize:12, fontWeight:!selectedCatId?700:400, border:'none', textAlign:'left', marginBottom:2,
            background:!selectedCatId?'var(--acc-d)':'transparent',
            color:!selectedCatId?'var(--acc)':'var(--t3)',
            borderLeft:`2px solid ${!selectedCatId?'var(--acc)':'transparent'}`,
          }}>All items <span style={{ color:'var(--t4)' }}>({menuItems.filter(i=>!i.archived).length})</span></button>

          {rootCats.map(cat => {
            const children = subCats(cat.id);
            const itemCount = menuItems.filter(i => !i.archived && (i.cat === cat.id || children.some(c => c.id === i.cat))).length;
            const isActive = selectedCatId === cat.id || children.some(c => c.id === selectedCatId);
            const [expanded, setExpanded] = useState(isActive);

            return (
              <div key={cat.id}>
                <div style={{ display:'flex', alignItems:'center' }}>
                  {children.length > 0 && (
                    <button onClick={() => setExpanded(e => !e)} style={{ width:16, flexShrink:0, background:'none', border:'none', cursor:'pointer', color:'var(--t4)', fontSize:10, padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {expanded ? '▾' : '▸'}
                    </button>
                  )}
                  <button onClick={() => { setSelectedCatId(cat.id); setSelectedItemId(null); }} style={{
                    flex:1, padding:'6px 8px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
                    fontSize:12, fontWeight:selectedCatId===cat.id?700:400, border:'none', textAlign:'left',
                    background:selectedCatId===cat.id?`${cat.color||'var(--acc)'}22`:'transparent',
                    color:selectedCatId===cat.id?(cat.color||'var(--acc)'):'var(--t2)',
                    borderLeft:`2px solid ${selectedCatId===cat.id?(cat.color||'var(--acc)'):'transparent'}`,
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    marginLeft: children.length > 0 ? 0 : 16,
                  }}
                  onContextMenu={e => { e.preventDefault(); setEditCat(cat); }}>
                    <span>{cat.icon} {cat.label}</span>
                    <span style={{ fontSize:10, color:'var(--t4)' }}>{itemCount}</span>
                  </button>
                </div>

                {/* Subcategories */}
                {expanded && children.map(sub => {
                  const subCount = menuItems.filter(i => !i.archived && i.cat === sub.id).length;
                  return (
                    <button key={sub.id} onClick={() => { setSelectedCatId(sub.id); setSelectedItemId(null); }} style={{
                      width:'calc(100% - 16px)', marginLeft:16, padding:'5px 8px', borderRadius:7, cursor:'pointer',
                      fontFamily:'inherit', fontSize:11, fontWeight:selectedCatId===sub.id?700:400, border:'none', textAlign:'left',
                      background:selectedCatId===sub.id?`${sub.color||'var(--acc)'}22`:'transparent',
                      color:selectedCatId===sub.id?(sub.color||'var(--acc)'):'var(--t3)',
                      borderLeft:`2px solid ${selectedCatId===sub.id?(sub.color||'var(--acc)'):'transparent'}`,
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                    }}>
                      <span>{sub.icon} {sub.label}</span>
                      <span style={{ fontSize:9, color:'var(--t4)' }}>{subCount}</span>
                    </button>
                  );
                })}
                {expanded && (
                  <button onClick={() => setShowNewCat(cat.id)} style={{ width:'calc(100% - 16px)', marginLeft:16, padding:'4px 8px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', fontSize:10, border:'none', textAlign:'left', background:'transparent', color:'var(--t4)' }}>
                    + Subcategory
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PANEL 2: Item list ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Toolbar */}
        <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
          <div style={{ position:'relative', flex:1, maxWidth:300 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:13 }}>🔍</span>
            <input style={{ ...inp, paddingLeft:32 }} placeholder="Search all items…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div style={{ display:'flex', background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:8, padding:2 }}>
            {[['grid','⊞'],['table','☰']].map(([v,ic])=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{ width:28, height:28, borderRadius:6, border:'none', cursor:'pointer', fontFamily:'inherit', background:viewMode===v?'var(--bg1)':'transparent', color:viewMode===v?'var(--t1)':'var(--t3)', fontSize:14 }}>{ic}</button>
            ))}
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <button onClick={() => { setShowNewCat(selectedCatId || 'root'); }} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr2)', color:'var(--t2)', fontSize:12, fontWeight:600 }}>+ Category</button>
            <button onClick={() => {
              const newItem = { menuName:'New item', receiptName:'New item', kitchenName:'New item', name:'New item', description:'', price:0, cat:selectedCatId||rootCats[0]?.id||'starters', type:'simple', allergens:[], modifierGroups:[], scope:'local', visibility:{pos:true,kiosk:true,online:true,onlineDelivery:true} };
              addMenuItem(newItem);
              markBOChange();
              // Select the newly added item
              setTimeout(() => {
                const items = useStore.getState().menuItems;
                setSelectedItemId(items[items.length-1]?.id);
              }, 50);
              showToast('New item created — edit it in the panel →', 'success');
            }} style={{ padding:'6px 16px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:13, fontWeight:700 }}>+ Item</button>
          </div>
        </div>

        {/* Category context info */}
        {selectedCatId && !search && (() => {
          const cat = menuCategories.find(c => c.id === selectedCatId);
          if (!cat) return null;
          return (
            <div style={{ padding:'8px 16px', background:'var(--bg2)', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
              <span style={{ fontSize:16 }}>{cat.icon}</span>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{cat.label}</span>
                {cat.accountingGroup && <span style={{ fontSize:11, color:'var(--t4)', marginLeft:10 }}>· {cat.accountingGroup}</span>}
                {cat.defaultCourse && <span style={{ fontSize:11, color:'var(--t4)', marginLeft:6 }}>· Course {cat.defaultCourse}</span>}
              </div>
              <button onClick={() => setEditCat(cat)} style={{ fontSize:11, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Edit category</button>
            </div>
          );
        })()}

        {/* Items */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {viewMode === 'grid' ? (
            <ItemGrid
              items={displayItems}
              selectedId={selectedItemId}
              onSelect={handleSelectItem}
              eightySixIds={eightySixIds}
              dailyCounts={dailyCounts}
              activeMenuId={activeMenuId}
            />
          ) : (
            <ItemTable
              items={displayItems}
              selectedId={selectedItemId}
              onSelect={handleSelectItem}
              eightySixIds={eightySixIds}
              dailyCounts={dailyCounts}
              activeMenuId={activeMenuId}
              categories={menuCategories}
            />
          )}
        </div>

        <div style={{ padding:'6px 16px', borderTop:'1px solid var(--bdr)', fontSize:11, color:'var(--t4)', background:'var(--bg1)', flexShrink:0 }}>
          {displayItems.length} item{displayItems.length!==1?'s':''} {search?`matching "${search}"`:''}
          {' · '}{eightySixIds.length} 86'd
          {' · '}{displayItems.filter(i=>dailyCounts[i.id]).length} tracked
        </div>
      </div>

      {/* ── PANEL 3: Item editor ── */}
      {selectedItem ? (
        <ItemEditor
          key={selectedItem.id}
          item={selectedItem}
          menus={menus}
          categories={menuCategories}
          activeMenuId={activeMenuId}
          onUpdate={(patch) => { updateMenuItem(selectedItem.id, patch); markBOChange(); }}
          onDuplicate={() => { duplicateMenuItem(selectedItem.id); markBOChange(); showToast('Item duplicated','success'); }}
          onArchive={() => { archiveMenuItem(selectedItem.id); setSelectedItemId(null); markBOChange(); showToast('Item archived','info'); }}
          onToggle86={() => { toggle86(selectedItem.id); markBOChange(); }}
          eightySixIds={eightySixIds}
          dailyCounts={dailyCounts}
          setDailyCount={setDailyCount}
        />
      ) : (
        <div style={{ width:340, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <div style={{ textAlign:'center', color:'var(--t4)', padding:32 }}>
            <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>←</div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--t2)' }}>Select an item to edit</div>
            <div style={{ fontSize:11, marginTop:4 }}>Click any item from the list</div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewMenu && <MenuModal onClose={() => setShowNewMenu(false)} onCreate={m => { addMenu(m); markBOChange(); showToast(`"${m.name}" menu created`,'success'); setShowNewMenu(false); }}/>}
      {(showNewCat || editCat) && (
        <CategoryModal
          cat={editCat}
          parentId={typeof showNewCat === 'string' && showNewCat !== 'root' ? showNewCat : null}
          menuId={activeMenuId}
          categories={menuCategories}
          onSave={cat => {
            if (editCat) { updateCategory(editCat.id, cat); showToast('Category updated','success'); }
            else { addCategory({ menuId:activeMenuId, ...cat }); showToast('Category added','success'); }
            markBOChange(); setShowNewCat(false); setEditCat(null);
          }}
          onDelete={editCat ? () => { removeCategory(editCat.id); setShowNewCat(false); setEditCat(null); if (selectedCatId===editCat.id) setSelectedCatId(null); markBOChange(); showToast('Category removed','warning'); } : null}
          onClose={() => { setShowNewCat(false); setEditCat(null); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item grid view
// ─────────────────────────────────────────────────────────────────────────────
function ItemGrid({ items, selectedId, onSelect, eightySixIds, dailyCounts, activeMenuId }) {
  if (!items.length) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--t4)' }}>
      <div style={{ fontSize:36, marginBottom:12, opacity:.3 }}>🍽</div>
      <div style={{ fontSize:14, fontWeight:600, color:'var(--t2)' }}>No items here yet</div>
      <div style={{ fontSize:12, marginTop:4 }}>Use "+ Item" to add one</div>
    </div>
  );

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10, padding:'14px 16px' }}>
      {items.map(item => {
        const is86 = eightySixIds.includes(item.id);
        const count = dailyCounts[item.id];
        const price = getEffectivePrice(item, activeMenuId);
        const selected = selectedId === item.id;
        const type = ITEM_TYPES.find(t => t.id === item.type) || ITEM_TYPES[0];
        const scope = SCOPES.find(s => s.id === item.scope) || SCOPES[0];

        return (
          <button key={item.id} onClick={() => onSelect(item.id)} style={{
            padding:'12px 14px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
            textAlign:'left', border:`${selected?'2px':'1px'} solid ${selected?'var(--acc)':is86?'var(--red-b)':'var(--bdr)'}`,
            background:selected?'var(--acc-d)':is86?'var(--red-d)':'var(--bg1)',
            opacity:is86?.6:1, transition:'all .1s', position:'relative',
          }}>
            {/* Type badge */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t4)' }}>{type.icon} {type.label}</span>
              {scope.id !== 'local' && <span style={{ fontSize:9, fontWeight:800, color:scope.color }}>◈ {scope.label}</span>}
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:selected?'var(--acc)':'var(--t1)', marginBottom:3, lineHeight:1.3 }}>{item.menuName||item.name}</div>
            {item.receiptName && item.receiptName !== (item.menuName||item.name) && (
              <div style={{ fontSize:10, color:'var(--t4)', marginBottom:3 }}>Receipt: {item.receiptName}</div>
            )}
            <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8, minHeight:28, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{item.description}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:15, fontWeight:800, color:'var(--acc)', fontFamily:'var(--font-mono)' }}>£{price.toFixed(2)}</span>
              <div style={{ display:'flex', gap:4 }}>
                {item.allergens?.length > 0 && <span style={{ fontSize:10, color:'var(--red)', fontWeight:700 }}>⚠</span>}
                {count && (
                  <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:10, background: count.remaining<=3?'var(--acc-d)':'var(--grn-d)', color:count.remaining<=3?'var(--acc)':'var(--grn)', border:`1px solid ${count.remaining<=3?'var(--acc-b)':'var(--grn-b)'}` }}>
                    {count.remaining}/{count.par}
                  </span>
                )}
                {is86 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:10, background:'var(--red-d)', color:'var(--red)', border:'1px solid var(--red-b)' }}>86'd</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item table view
// ─────────────────────────────────────────────────────────────────────────────
function ItemTable({ items, selectedId, onSelect, eightySixIds, dailyCounts, activeMenuId, categories }) {
  return (
    <table style={{ width:'100%', borderCollapse:'collapse' }}>
      <thead>
        <tr style={{ background:'var(--bg2)', position:'sticky', top:0, zIndex:1 }}>
          {['Item','Receipt name','Kitchen name','Category','Type','Scope','Price','Status'].map(h=>(
            <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:9, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--bdr)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const is86 = eightySixIds.includes(item.id);
          const price = getEffectivePrice(item, activeMenuId);
          const cat = categories.find(c => c.id === item.cat);
          const selected = selectedId === item.id;
          return (
            <tr key={item.id} onClick={() => onSelect(item.id)} style={{ borderBottom:'1px solid var(--bdr)', background:selected?'var(--acc-d)':i%2===0?'var(--bg)':'var(--bg1)', cursor:'pointer', opacity:is86?.5:1 }}>
              <td style={{ padding:'9px 12px', fontSize:13, fontWeight:600, color:selected?'var(--acc)':'var(--t1)' }}>{item.menuName||item.name}</td>
              <td style={{ padding:'9px 12px', fontSize:11, color:'var(--t3)' }}>{item.receiptName||item.name}</td>
              <td style={{ padding:'9px 12px', fontSize:11, color:'var(--t3)' }}>{item.kitchenName||item.name}</td>
              <td style={{ padding:'9px 12px', fontSize:11, color:'var(--t4)' }}>{cat?.label||item.cat}</td>
              <td style={{ padding:'9px 12px' }}><span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t4)' }}>{item.type||'simple'}</span></td>
              <td style={{ padding:'9px 12px' }}><span style={{ fontSize:10, fontWeight:700, color:SCOPES.find(s=>s.id===item.scope)?.color||'var(--t4)' }}>{item.scope||'local'}</span></td>
              <td style={{ padding:'9px 12px', fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--acc)' }}>£{price.toFixed(2)}</td>
              <td style={{ padding:'9px 12px' }}>
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:is86?'var(--red-d)':'var(--grn-d)', border:`1px solid ${is86?'var(--red-b)':'var(--grn-b)'}`, color:is86?'var(--red)':'var(--grn)' }}>{is86?"86'd":'Active'}</span>
              </td>
            </tr>
          );
        })}
        {!items.length && (
          <tr><td colSpan={8} style={{ textAlign:'center', padding:'40px', color:'var(--t4)' }}>No items found</td></tr>
        )}
      </tbody>
    </table>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item editor panel (right side — always visible when an item is selected)
// ─────────────────────────────────────────────────────────────────────────────
function ItemEditor({ item, menus, categories, activeMenuId, onUpdate, onDuplicate, onArchive, onToggle86, eightySixIds, dailyCounts, setDailyCount }) {
  const [tab, setTab] = useState('details');
  const is86 = eightySixIds.includes(item.id);
  const count = dailyCounts[item.id];

  const tabs = [
    { id:'details',    label:'Details' },
    { id:'pricing',    label:'Pricing' },
    { id:'modifiers',  label:`Modifiers${item.modifierGroups?.length ? ` (${item.modifierGroups.length})` : ''}` },
    { id:'routing',    label:'Routing' },
    { id:'visibility', label:'Visibility' },
  ];

  return (
    <div style={{ width:360, borderLeft:'1px solid var(--bdr)', background:'var(--bg1)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'12px 16px 0', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:800, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.menuName||item.name}</div>
            <div style={{ fontSize:10, color:'var(--t4)', marginTop:2 }}>{ITEM_TYPES.find(t=>t.id===item.type)?.label||'Simple item'} · {item.cat}</div>
          </div>
          <div style={{ display:'flex', gap:5, flexShrink:0 }}>
            <button onClick={onDuplicate} title="Duplicate" style={{ width:28, height:28, borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg3)', cursor:'pointer', fontFamily:'inherit', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>⧉</button>
            <button onClick={() => { if(confirm('Archive this item?')) onArchive(); }} title="Archive" style={{ width:28, height:28, borderRadius:8, border:'1px solid var(--bdr)', background:'var(--bg3)', cursor:'pointer', fontFamily:'inherit', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t4)' }}>⊗</button>
          </div>
        </div>

        {/* Status bar */}
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          <button onClick={onToggle86} style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, cursor:'pointer', fontFamily:'inherit', background:is86?'var(--grn-d)':'var(--red-d)', border:`1px solid ${is86?'var(--grn-b)':'var(--red-b)'}`, color:is86?'var(--grn)':'var(--red)' }}>
            {is86 ? '✓ Reinstate' : '⊘ 86 item'}
          </button>
          {count && (
            <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, background:count.remaining<=3?'var(--acc-d)':'var(--grn-d)', border:`1px solid ${count.remaining<=3?'var(--acc-b)':'var(--grn-b)'}`, color:count.remaining<=3?'var(--acc)':'var(--grn)' }}>
              Stock: {count.remaining}/{count.par}
            </span>
          )}
          <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, background:'var(--bg3)', border:'1px solid var(--bdr)', color:SCOPES.find(s=>s.id===item.scope)?.color||'var(--t4)' }}>
            ◈ {item.scope||'local'}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, overflowX:'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'6px 12px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
              border:'none', borderBottom:`2.5px solid ${tab===t.id?'var(--acc)':'transparent'}`,
              background:'transparent', color:tab===t.id?'var(--acc)':'var(--t4)',
              fontSize:11, fontWeight:tab===t.id?800:500,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
        {tab === 'details'    && <DetailsTab    item={item} categories={categories} onUpdate={onUpdate}/>}
        {tab === 'pricing'    && <PricingTab    item={item} menus={menus} onUpdate={onUpdate}/>}
        {tab === 'modifiers'  && <ModifiersTab  item={item} onUpdate={onUpdate}/>}
        {tab === 'routing'    && <RoutingTab    item={item} categories={categories} onUpdate={onUpdate}/>}
        {tab === 'visibility' && <VisibilityTab item={item} onUpdate={onUpdate}/>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Details tab
// ─────────────────────────────────────────────────────────────────────────────
function DetailsTab({ item, categories, onUpdate }) {
  const f = (key, val) => onUpdate({ [key]: val });
  const rootCats = categories.filter(c => !c.parentId && !c.isSpecial);
  const subCats = categories.filter(c => c.parentId);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Item type */}
      <div>
        <div style={label}>Item type</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {ITEM_TYPES.map(t => (
            <button key={t.id} onClick={() => f('type', t.id)} style={{
              padding:'8px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
              background:(item.type||'simple')===t.id?'var(--acc-d)':'var(--bg3)',
              border:`1.5px solid ${(item.type||'simple')===t.id?'var(--acc)':'var(--bdr)'}`,
            }}>
              <div style={{ fontSize:12, fontWeight:700, color:(item.type||'simple')===t.id?'var(--acc)':'var(--t1)' }}>{t.icon} {t.label}</div>
              <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Triple naming */}
      <div>
        <div style={label}>Menu name <span style={{ color:'var(--t4)', fontWeight:400 }}>(shown on POS button)</span></div>
        <input style={inp} value={item.menuName||item.name||''} onChange={e => f('menuName', e.target.value)} placeholder="e.g. Ribeye steak 8oz"/>
      </div>
      <div>
        <div style={label}>Receipt name <span style={{ color:'var(--t4)', fontWeight:400 }}>(printed on guest receipt)</span></div>
        <input style={inp} value={item.receiptName||item.name||''} onChange={e => f('receiptName', e.target.value)} placeholder="Leave blank to use menu name"/>
      </div>
      <div>
        <div style={label}>Kitchen name <span style={{ color:'var(--t4)', fontWeight:400 }}>(shown on KDS + kitchen ticket)</span></div>
        <input style={inp} value={item.kitchenName||item.name||''} onChange={e => f('kitchenName', e.target.value)} placeholder="Leave blank to use menu name"/>
      </div>

      <div>
        <div style={label}>Description</div>
        <textarea style={{ ...inp, resize:'none', height:60 }} value={item.description||''} onChange={e => f('description', e.target.value)} placeholder="Short description shown on kiosk, online ordering, item info"/>
      </div>

      {/* Category */}
      <div>
        <div style={label}>Category</div>
        <select value={item.cat||''} onChange={e => f('cat', e.target.value)} style={{ ...inp, cursor:'pointer' }}>
          <option value="">Select category…</option>
          {rootCats.map(c => (
            <optgroup key={c.id} label={`${c.icon||''} ${c.label}`}>
              <option value={c.id}>{c.icon||''} {c.label}</option>
              {subCats.filter(s => s.parentId === c.id).map(s => (
                <option key={s.id} value={s.id}>  └ {s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div>
        <div style={label}>Kitchen instructions <span style={{ color:'var(--t4)', fontWeight:400 }}>(always printed on ticket)</span></div>
        <textarea style={{ ...inp, resize:'none', height:52 }} value={item.instructions||''} onChange={e => f('instructions', e.target.value)} placeholder="e.g. Contains nuts — alert kitchen"/>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing tab
// ─────────────────────────────────────────────────────────────────────────────
function PricingTab({ item, menus, onUpdate }) {
  const basePrice = item.price || item.basePrice || 0;

  const setMenuPrice = (menuId, val) => {
    const overrides = { ...(item.priceOverrides||{}) };
    if (val === '' || val === null) delete overrides[menuId];
    else overrides[menuId] = parseFloat(val) || 0;
    onUpdate({ priceOverrides: overrides });
  };

  const setLocPrice = (locId, val) => {
    const overrides = { ...(item.locationPriceOverrides||{}) };
    if (val === '' || val === null) delete overrides[locId];
    else overrides[locId] = parseFloat(val) || 0;
    onUpdate({ locationPriceOverrides: overrides });
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Base price */}
      <div>
        <div style={label}>Base price</div>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--t2)', fontSize:14, fontWeight:700 }}>£</span>
          <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft:26, fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16 }}
            value={basePrice} onChange={e => onUpdate({ price: parseFloat(e.target.value)||0, basePrice: parseFloat(e.target.value)||0 })}/>
        </div>
        <div style={{ fontSize:11, color:'var(--t4)', marginTop:5 }}>Applied when no menu-specific price is set</div>
      </div>

      {/* Per-menu price overrides */}
      <div>
        <div style={label}>Menu-specific prices</div>
        <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8 }}>Override the base price for specific menus (e.g. lunch special pricing)</div>
        {menus.map(m => {
          const override = item.priceOverrides?.[m.id];
          return (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{ flex:1, fontSize:12, color:'var(--t1)', fontWeight:500 }}>{m.name}</div>
              <div style={{ position:'relative', width:120 }}>
                <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--t4)', fontSize:12 }}>£</span>
                <input type="number" step="0.01" min="0"
                  style={{ ...inp, paddingLeft:22, width:120, fontSize:12, fontFamily:'var(--font-mono)' }}
                  value={override !== undefined ? override : ''}
                  placeholder={basePrice.toFixed(2)}
                  onChange={e => setMenuPrice(m.id, e.target.value)}/>
              </div>
              {override !== undefined && (
                <button onClick={() => setMenuPrice(m.id, '')} style={{ fontSize:11, color:'var(--t4)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>✕</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Multi-location price overrides (for Shared items) */}
      {(item.scope === 'shared' || item.scope === 'global') && (
        <div>
          <div style={label}>Location price overrides</div>
          <div style={{ fontSize:11, color:'var(--t3)', marginBottom:8 }}>Set different prices at each location for this shared item</div>
          <div style={{ padding:'10px 12px', background:'var(--bg3)', borderRadius:9, border:'1px solid var(--bdr)', fontSize:12, color:'var(--t3)' }}>
            Location-specific price overrides require Supabase to be connected and locations to be configured.
          </div>
        </div>
      )}

      {/* Scope */}
      <div>
        <div style={label}>Multi-site scope</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {SCOPES.map(s => (
            <button key={s.id} onClick={() => onUpdate({ scope: s.id })} style={{
              padding:'9px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left',
              background:(item.scope||'local')===s.id?`${s.color}22`:'var(--bg3)',
              border:`1.5px solid ${(item.scope||'local')===s.id?s.color:'var(--bdr)'}`,
              display:'flex', alignItems:'center', gap:10,
            }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:(item.scope||'local')===s.id?s.color:'var(--t1)' }}>{s.label}</div>
                <div style={{ fontSize:10, color:'var(--t4)' }}>{s.desc}</div>
              </div>
              {(item.scope||'local')===s.id && <span style={{ marginLeft:'auto', fontSize:12, color:s.color }}>✓</span>}
            </button>
          ))}
        </div>
        {item.scope === 'shared' && <div style={{ fontSize:10, color:'var(--acc)', marginTop:6 }}>⚠ Changing scope from Shared → Local is not reversible. Only Local → Shared → Global transitions are allowed.</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modifiers tab (min/max, required, options with prices)
// ─────────────────────────────────────────────────────────────────────────────
function ModifiersTab({ item, onUpdate }) {
  const groups = item.modifierGroups || [];

  const setGroups = gs => onUpdate({ modifierGroups: gs });
  const addGroup = () => setGroups([...groups, { id:`mg-${Date.now()}`, label:'New group', min:0, max:1, free:0, options:[] }]);
  const removeGroup = i => setGroups(groups.filter((_,idx)=>idx!==i));
  const updGroup = (i, patch) => setGroups(groups.map((g,idx)=>idx===i?{...g,...patch}:g));
  const addOption = i => setGroups(groups.map((g,idx)=>idx===i?{...g,options:[...g.options,{id:`opt-${Date.now()}`,label:'',price:0,allergens:[],isDefault:false}]}:g));
  const updOption = (gi,oi,patch) => setGroups(groups.map((g,gi2)=>gi2===gi?{...g,options:g.options.map((o,oi2)=>oi2===oi?{...o,...patch}:o)}:g));
  const delOption = (gi,oi) => setGroups(groups.map((g,gi2)=>gi2===gi?{...g,options:g.options.filter((_,oi2)=>oi2!==oi)}:g));

  const [expandedGroup, setExpandedGroup] = useState(null);
  const ii = { background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:7, padding:'5px 9px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none' };

  return (
    <div>
      {item.type === 'variants' && (
        <VariantsEditor item={item} onUpdate={onUpdate}/>
      )}

      {item.type === 'pizza' && (
        <PizzaEditor item={item} onUpdate={onUpdate}/>
      )}

      {(item.type === 'modifiers' || item.type === 'simple' || item.type === 'bundle') && (
        <>
          {groups.length === 0 && (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--t4)', fontSize:12, marginBottom:12 }}>
              No modifier groups. Add one to give customers choices.
            </div>
          )}
          {groups.map((g, gi) => (
            <div key={g.id} style={{ background:'var(--bg3)', border:'1px solid var(--bdr)', borderRadius:11, marginBottom:8, overflow:'hidden' }}>
              <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:8, cursor:'pointer' }} onClick={() => setExpandedGroup(expandedGroup===gi?null:gi)}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{g.label}</div>
                  <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>
                    Min {g.min} · Max {g.max} {g.min>0?'· Required':'· Optional'} · {g.options.length} options
                  </div>
                </div>
                <span style={{ fontSize:11, color:'var(--t4)' }}>{expandedGroup===gi?'▲':'▼'}</span>
              </div>
              {expandedGroup === gi && (
                <div style={{ padding:'0 12px 12px', borderTop:'1px solid var(--bdr)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto auto', gap:6, margin:'10px 0 8px', alignItems:'center' }}>
                    <input style={{...ii, width:'100%', boxSizing:'border-box'}} value={g.label} onChange={e=>updGroup(gi,{label:e.target.value})} placeholder="Group name"/>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:9, color:'var(--t4)', marginBottom:2 }}>Min</div>
                      <input type="number" min="0" max="10" style={{...ii, width:44, textAlign:'center'}} value={g.min} onChange={e=>updGroup(gi,{min:parseInt(e.target.value)||0})}/>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:9, color:'var(--t4)', marginBottom:2 }}>Max</div>
                      <input type="number" min="1" max="20" style={{...ii, width:44, textAlign:'center'}} value={g.max} onChange={e=>updGroup(gi,{max:parseInt(e.target.value)||1})}/>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:9, color:'var(--t4)', marginBottom:2 }}>Free</div>
                      <input type="number" min="0" style={{...ii, width:44, textAlign:'center'}} value={g.free} onChange={e=>updGroup(gi,{free:parseInt(e.target.value)||0})}/>
                    </div>
                    <button onClick={()=>removeGroup(gi)} style={{ padding:'4px 8px', borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700 }}>✕</button>
                  </div>
                  <div style={{ fontSize:9, color:'var(--t4)', marginBottom:8 }}>
                    Min=0: optional · Min≥1: required · Max=1: pick one · Max&gt;1: pick many · Free: how many options are included free
                  </div>
                  {g.options.map((opt, oi) => (
                    <div key={opt.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px auto auto', gap:5, marginBottom:5, alignItems:'center' }}>
                      <input style={{...ii, boxSizing:'border-box'}} value={opt.label} onChange={e=>updOption(gi,oi,{label:e.target.value})} placeholder="Option name"/>
                      <div style={{ position:'relative' }}>
                        <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--t4)' }}>£</span>
                        <input type="number" step="0.50" min="0" style={{...ii, paddingLeft:16, width:'100%', boxSizing:'border-box'}} value={opt.price||0} onChange={e=>updOption(gi,oi,{price:parseFloat(e.target.value)||0})}/>
                      </div>
                      <button onClick={()=>updOption(gi,oi,{isDefault:!opt.isDefault})} title="Set as default" style={{ width:24, height:28, borderRadius:6, border:`1px solid ${opt.isDefault?'var(--grn-b)':'var(--bdr)'}`, background:opt.isDefault?'var(--grn-d)':'var(--bg3)', color:opt.isDefault?'var(--grn)':'var(--t4)', cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>✓</button>
                      <button onClick={()=>delOption(gi,oi)} style={{ width:24, height:28, borderRadius:6, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>×</button>
                    </div>
                  ))}
                  <button onClick={()=>addOption(gi)} style={{ width:'100%', padding:'5px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg4)', border:'1px solid var(--bdr)', color:'var(--t3)', fontSize:11, fontWeight:600, marginTop:4 }}>+ Add option</button>
                </div>
              )}
            </div>
          ))}
          <button onClick={addGroup} style={{ width:'100%', padding:'8px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700, marginTop:4 }}>+ Add modifier group</button>
        </>
      )}
    </div>
  );
}

// Size variants editor
function VariantsEditor({ item, onUpdate }) {
  const variants = item.variants || [];
  const ii = { background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:7, padding:'5px 9px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' };

  const upd = vs => onUpdate({ variants: vs });
  const add = () => upd([...variants, { id:`v-${Date.now()}`, label:'', price:0 }]);
  const del = i => upd(variants.filter((_,idx)=>idx!==i));
  const set = (i, k, v) => upd(variants.map((vt,idx)=>idx===i?{...vt,[k]:v}:vt));

  return (
    <div>
      <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12 }}>Size variants — customer must pick one. Price shows "from £X" on menus.</div>
      {variants.map((v, i) => (
        <div key={v.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px auto', gap:6, marginBottom:6, alignItems:'center' }}>
          <input style={{...ii, width:'100%'}} value={v.label} onChange={e=>set(i,'label',e.target.value)} placeholder="e.g. Small, Regular, Large"/>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--t4)' }}>£</span>
            <input type="number" step="0.01" min="0" style={{...ii, paddingLeft:16, width:'100%'}} value={v.price||0} onChange={e=>set(i,'price',parseFloat(e.target.value)||0)}/>
          </div>
          <button onClick={()=>del(i)} style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>×</button>
        </div>
      ))}
      <button onClick={add} style={{ width:'100%', padding:'7px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--acc)', border:'none', color:'#0b0c10', fontSize:12, fontWeight:700, marginTop:4 }}>+ Add size</button>
    </div>
  );
}

// Pizza builder config
function PizzaEditor({ item, onUpdate }) {
  const cfg = item.pizzaConfig || {
    sizes: [{ id:'s1', label:'9 inch Regular', basePrice:12.00 }, { id:'s2', label:'12 inch Large', basePrice:15.00 }],
    toppingGroups: [{ id:'tg1', name:'Toppings', includedCount:2, extraPrice:1.50, options:[] }]
  };
  const upd = patch => onUpdate({ pizzaConfig: { ...cfg, ...patch } });
  const ii = { background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:7, padding:'5px 9px', color:'var(--t1)', fontSize:12, fontFamily:'inherit', outline:'none', boxSizing:'border-box' };

  const updSize = (i, key, val) => {
    const sizes = cfg.sizes.map((s, si) => si === i ? { ...s, [key]: val } : s);
    upd({ sizes });
  };
  const addSize = () => upd({ sizes: [...cfg.sizes, { id:`s-${Date.now()}`, label:'', basePrice:0 }] });
  const delSize = i => upd({ sizes: cfg.sizes.filter((_, si) => si !== i) });

  const updGroup = (gi, key, val) => {
    const toppingGroups = cfg.toppingGroups.map((g, i) => i === gi ? { ...g, [key]: val } : g);
    upd({ toppingGroups });
  };
  const addGroup = () => upd({ toppingGroups: [...cfg.toppingGroups, { id:`tg-${Date.now()}`, name:'New group', includedCount:0, extraPrice:1.50, options:[] }] });
  const delGroup = gi => upd({ toppingGroups: cfg.toppingGroups.filter((_, i) => i !== gi) });

  const updTopping = (gi, oi, val) => {
    const toppingGroups = cfg.toppingGroups.map((g, i) => i !== gi ? g : {
      ...g, options: g.options.map((o, j) => j === oi ? { ...o, label: val } : o)
    });
    upd({ toppingGroups });
  };
  const addTopping = gi => {
    const toppingGroups = cfg.toppingGroups.map((g, i) => i !== gi ? g : {
      ...g, options: [...g.options, { id:`top-${Date.now()}`, label:'', isDefault:false }]
    });
    upd({ toppingGroups });
  };
  const delTopping = (gi, oi) => {
    const toppingGroups = cfg.toppingGroups.map((g, i) => i !== gi ? g : {
      ...g, options: g.options.filter((_, j) => j !== oi)
    });
    upd({ toppingGroups });
  };

  return (
    <div>
      <div style={{ fontSize:12, color:'var(--t3)', marginBottom:14, lineHeight:1.5 }}>
        Pizza builder — customers pick a size then toppings. Configure sizes and topping groups below.
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:800, color:'var(--t4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8 }}>Sizes</div>
        {cfg.sizes.map((s, i) => (
          <div key={s.id} style={{ display:'grid', gridTemplateColumns:'1fr 90px auto', gap:6, marginBottom:5 }}>
            <input style={{...ii, width:'100%'}} value={s.label} onChange={e => updSize(i, 'label', e.target.value)} placeholder="e.g. 9 inch Regular"/>
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:6, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--t4)' }}>£</span>
              <input type="number" step="0.01" style={{...ii, paddingLeft:16, width:'100%'}} value={s.basePrice||0} onChange={e => updSize(i, 'basePrice', parseFloat(e.target.value)||0)}/>
            </div>
            <button onClick={() => delSize(i)} style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:13 }}>×</button>
          </div>
        ))}
        <button onClick={addSize} style={{ padding:'5px 10px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>+ Add size</button>
      </div>

      {cfg.toppingGroups.map((tg, gi) => (
        <div key={tg.id} style={{ marginBottom:12, padding:'12px', background:'var(--bg3)', borderRadius:10, border:'1px solid var(--bdr)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:6, marginBottom:8, alignItems:'center' }}>
            <input style={{...ii, width:'100%'}} value={tg.name} onChange={e => updGroup(gi, 'name', e.target.value)} placeholder="Group name"/>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:9, color:'var(--t4)', marginBottom:2 }}>Free</div>
              <input type="number" min="0" style={{...ii, width:44, textAlign:'center'}} value={tg.includedCount||0} onChange={e => updGroup(gi, 'includedCount', parseInt(e.target.value)||0)}/>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:9, color:'var(--t4)', marginBottom:2 }}>Extra £</div>
              <input type="number" min="0" step="0.50" style={{...ii, width:60}} value={tg.extraPrice||0} onChange={e => updGroup(gi, 'extraPrice', parseFloat(e.target.value)||0)}/>
            </div>
            <button onClick={() => delGroup(gi)} style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:13 }}>×</button>
          </div>
          {tg.options.map((opt, oi) => (
            <div key={opt.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:5, marginBottom:4 }}>
              <input style={{...ii, width:'100%'}} value={opt.label} onChange={e => updTopping(gi, oi, e.target.value)} placeholder="Topping name"/>
              <button onClick={() => delTopping(gi, oi)} style={{ width:24, height:28, borderRadius:6, border:'1px solid var(--red-b)', background:'var(--red-d)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>×</button>
            </div>
          ))}
          <button onClick={() => addTopping(gi)} style={{ padding:'4px 8px', borderRadius:7, cursor:'pointer', fontFamily:'inherit', background:'var(--bg4)', border:'1px solid var(--bdr)', color:'var(--t3)', fontSize:10, fontWeight:600, marginTop:4 }}>+ Add topping</button>
        </div>
      ))}
      <button onClick={addGroup} style={{ padding:'6px 12px', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'var(--bg3)', border:'1px solid var(--bdr)', color:'var(--t2)', fontSize:11, fontWeight:600 }}>+ Add topping group</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing tab
// ─────────────────────────────────────────────────────────────────────────────
function RoutingTab({ item, categories, onUpdate }) {
  const f = (k,v) => onUpdate({ [k]:v });
  const cat = categories.find(c => c.id === item.cat);
  const centres = PRODUCTION_CENTRES || [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Course */}
      <div>
        <div style={label}>Course</div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {COURSES.map(c => (
            <button key={String(c.id)} onClick={() => f('course', c.id)} style={{
              padding:'7px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', fontSize:12,
              background:item.course===c.id?'var(--acc-d)':'var(--bg3)', border:`1.5px solid ${item.course===c.id?'var(--acc)':'var(--bdr)'}`,
              color:item.course===c.id?'var(--acc)':'var(--t2)', fontWeight:item.course===c.id?700:400,
            }}>{c.label} {c.id===null && cat?.defaultCourse?`(category default: Course ${cat.defaultCourse})`:''}</button>
          ))}
        </div>
      </div>

      {/* Production centre */}
      <div>
        <div style={label}>Production centre <span style={{ color:'var(--t4)', fontWeight:400 }}>(where this item is made)</span></div>
        {cat?.defaultProductionCentreId && (
          <div style={{ fontSize:11, color:'var(--t4)', marginBottom:6 }}>Category default: {PRODUCTION_CENTRES?.find(p=>p.id===cat.defaultProductionCentreId)?.name || cat.defaultProductionCentreId}</div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <button onClick={() => f('productionCentreId', null)} style={{ padding:'7px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', fontSize:12, background:!item.productionCentreId?'var(--acc-d)':'var(--bg3)', border:`1.5px solid ${!item.productionCentreId?'var(--acc)':'var(--bdr)'}`, color:!item.productionCentreId?'var(--acc)':'var(--t2)' }}>
            Inherit from category {cat?.defaultProductionCentreId ? `(${PRODUCTION_CENTRES?.find(p=>p.id===cat.defaultProductionCentreId)?.name||cat.defaultProductionCentreId})` : '(no default set)'}
          </button>
          {centres.map(pc => (
            <button key={pc.id} onClick={() => f('productionCentreId', pc.id)} style={{ padding:'7px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', fontSize:12, display:'flex', alignItems:'center', gap:8, background:item.productionCentreId===pc.id?'var(--acc-d)':'var(--bg3)', border:`1.5px solid ${item.productionCentreId===pc.id?'var(--acc)':'var(--bdr)'}`, color:item.productionCentreId===pc.id?'var(--acc)':'var(--t2)' }}>
              <span>{pc.icon}</span>{pc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Allergens */}
      <div>
        <div style={label}>Allergens</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
          {ALLERGENS.map(a => {
            const on = (item.allergens||[]).includes(a.id);
            return (
              <button key={a.id} onClick={() => {
                const allergens = on ? (item.allergens||[]).filter(x=>x!==a.id) : [...(item.allergens||[]), a.id];
                onUpdate({ allergens });
              }} style={{ padding:'7px 10px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', textAlign:'left', display:'flex', alignItems:'center', gap:7, background:on?'var(--red-d)':'var(--bg3)', border:`1.5px solid ${on?'var(--red)':'var(--bdr)'}`, color:on?'var(--red)':'var(--t2)', transition:'all .1s' }}>
                <span style={{ fontSize:14 }}>{a.icon}</span>
                <span style={{ fontSize:11, fontWeight:on?700:400 }}>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Visibility tab
// ─────────────────────────────────────────────────────────────────────────────
function VisibilityTab({ item, onUpdate }) {
  const vis = item.visibility || { pos:true, kiosk:true, online:true, onlineDelivery:true };
  const toggle = ch => onUpdate({ visibility: { ...vis, [ch]: !vis[ch] } });

  return (
    <div>
      <div style={{ fontSize:12, color:'var(--t3)', marginBottom:14, lineHeight:1.5 }}>
        Control where this item appears. Hidden items still exist in the system but won't show up to customers or staff in that channel.
      </div>
      {VISIBILITY_CHANNELS.map(ch => (
        <div key={ch.id} onClick={() => toggle(ch.id)} style={{
          display:'flex', alignItems:'center', gap:12, padding:'11px 12px', marginBottom:7,
          borderRadius:10, cursor:'pointer', border:'1px solid var(--bdr)',
          background:vis[ch.id]?'var(--grn-d)':'var(--bg3)', transition:'all .1s',
        }}>
          <span style={{ fontSize:18, flexShrink:0 }}>{ch.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:vis[ch.id]?'var(--grn)':'var(--t1)' }}>{ch.label}</div>
            <div style={{ fontSize:11, color:'var(--t4)', marginTop:1 }}>{vis[ch.id] ? 'Visible' : 'Hidden'}</div>
          </div>
          <div style={{ width:36, height:20, borderRadius:10, background:vis[ch.id]?'var(--grn)':'var(--bg4)', position:'relative', transition:'background .2s', flexShrink:0 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left:vis[ch.id]?18:2, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────────────────
function MenuModal({ onCreate, onClose }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:380, boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>New menu</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ padding:'18px 20px' }}>
          <div style={{ marginBottom:12 }}><div style={label}>Menu name</div><input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Lunch menu, Bar menu, Kids menu" autoFocus/></div>
          <div style={{ marginBottom:20 }}><div style={label}>Description</div><input style={inp} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="When and where this menu is used"/></div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-acc" style={{ flex:2, height:40 }} disabled={!name.trim()} onClick={() => onCreate({ name:name.trim(), description:desc, scope:'local', assignedProfiles:[], isDefault:false, isActive:true, sortOrder:99 })}>Create menu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryModal({ cat, parentId, menuId, categories, onSave, onDelete, onClose }) {
  const [label, setLabel] = useState(cat?.label||'');
  const [icon, setIcon] = useState(cat?.icon||'🍽');
  const [color, setColor] = useState(cat?.color||'#3b82f6');
  const [acctGrp, setAcctGrp] = useState(cat?.accountingGroup||'Food & Beverage');
  const [statGrp, setStatGrp] = useState(cat?.statisticGroup||'');
  const [defCentre, setDefCentre] = useState(cat?.defaultProductionCentreId||null);
  const [defCourse, setDefCourse] = useState(cat?.defaultCourse||null);
  const ICONS = ['🍽','🥗','🍖','🍕','🍸','☕','🎂','🥤','🍣','🥩','🌿','🔥','❄️','🏷','⭐','🥐'];
  const PALETTE = ['#3b82f6','#e8a020','#22c55e','#a855f7','#ef4444','#22d3ee','#f97316','#ec4899','#8b5cf6','#10b981'];

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'var(--bg1)', border:'1px solid var(--bdr2)', borderRadius:20, width:'100%', maxWidth:440, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>{cat ? 'Edit category' : parentId ? 'New subcategory' : 'New category'}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:20 }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          <div style={{ marginBottom:12 }}><div style={{ ...label }}>Name</div><input style={inp} value={label} onChange={e=>setLabel(e.target.value)} autoFocus/></div>
          <div style={{ marginBottom:12 }}>
            <div style={{ ...label }}>Icon</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{ width:34, height:34, borderRadius:8, border:`1.5px solid ${icon===ic?'var(--acc)':'var(--bdr)'}`, background:icon===ic?'var(--acc-d)':'var(--bg3)', cursor:'pointer', fontSize:16 }}>{ic}</button>)}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ ...label }}>Colour</div>
            <div style={{ display:'flex', gap:6 }}>
              {PALETTE.map(c=><button key={c} onClick={()=>setColor(c)} style={{ width:24, height:24, borderRadius:'50%', background:c, border:'none', cursor:'pointer', outline:color===c?'3px solid var(--t1)':'3px solid transparent', outlineOffset:2 }}/>)}
            </div>
          </div>
          <div style={{ marginBottom:12 }}><div style={{ ...label }}>Accounting group <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>(for P&L reporting)</span></div><input style={inp} value={acctGrp} onChange={e=>setAcctGrp(e.target.value)} placeholder="e.g. Food, Beverages, Alcohol"/></div>
          <div style={{ marginBottom:12 }}><div style={{ ...label }}>Statistic group <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0 }}>(for operational reporting)</span></div><input style={inp} value={statGrp} onChange={e=>setStatGrp(e.target.value)} placeholder="e.g. Hot starters, Cocktails"/></div>
          <div style={{ marginBottom:12 }}>
            <div style={{ ...label }}>Default production centre</div>
            <select value={defCentre||''} onChange={e=>setDefCentre(e.target.value||null)} style={{ ...inp, cursor:'pointer' }}>
              <option value="">None — items inherit from their own setting</option>
              {(PRODUCTION_CENTRES||[]).map(pc=><option key={pc.id} value={pc.id}>{pc.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:4 }}>
            <div style={{ ...label }}>Default course</div>
            <select value={defCourse||''} onChange={e=>setDefCourse(e.target.value?parseInt(e.target.value):null)} style={{ ...inp, cursor:'pointer' }}>
              {COURSES.map(c=><option key={String(c.id)} value={c.id||''}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--bdr)', display:'flex', gap:8 }}>
          {cat && onDelete && <button onClick={onDelete} style={{ padding:'8px 12px', borderRadius:9, cursor:'pointer', fontFamily:'inherit', background:'var(--red-d)', border:'1px solid var(--red-b)', color:'var(--red)', fontSize:12, fontWeight:700 }}>Remove</button>}
          <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:2, height:40 }} disabled={!label.trim()} onClick={() => onSave({ label:label.trim(), icon, color, parentId:parentId||cat?.parentId||null, menuId, accountingGroup:acctGrp, statisticGroup:statGrp, defaultProductionCentreId:defCentre, defaultCourse:defCourse, sortOrder:99 })}>
            {cat ? 'Save' : 'Add category'}
          </button>
        </div>
      </div>
    </div>
  );
}
