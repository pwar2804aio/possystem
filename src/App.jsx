import { useState, useCallback, useEffect } from 'react';
import './styles/globals.css';
import { useStore } from './store';
import PINScreen from './surfaces/PINScreen';
import POSSurface from './surfaces/POSSurface';
import BarSurface from './surfaces/BarSurface';
import TablesSurface from './surfaces/TablesSurface';
import { KDSSurface } from './surfaces/OtherSurfaces';
import BackOfficeApp from './backoffice/BackOfficeApp';
import { isMock, supabase } from './lib/supabase';
import PairingScreen from './surfaces/PairingScreen';
import ModeSelector from './surfaces/ModeSelector';
import CompanyAdminApp from './admin/CompanyAdminApp';
import DeviceSetup from './surfaces/DeviceSetup';
import StatusDrawer from './components/StatusDrawer';
import SyncBridge from './sync/SyncBridge';
import ConfigSyncBanner from './components/ConfigSyncBanner';
import KioskSurface from './surfaces/KioskSurface';
import OrdersHub from './surfaces/OrdersHub';
import useSupabaseInit from './lib/useSupabaseInit';

const VERSION = '3.1.2';

const CHANGELOG = [
  {
    version: '1.1.1', date: 'Apr 2026', label: 'Store-driven login, kiosk and quick screen fixes',
    changes: [
      'PIN login screen now reads from store staffMembers — staff added in Staff Manager appear on the login screen immediately.',
      'Kiosk surface now reads categories and items from the store, respects quickScreenIds for the Popular tab, filters by visibility.kiosk, and sorts by sortOrder.',
      'Kiosk Popular tab uses the Quick Screen configuration set in Menu Manager.',
      'Items hidden from kiosk via visibility settings no longer appear on the kiosk.',
    ],
  },
  {
    version: '1.1.9', date: 'Apr 2026', label: 'Modifier modal Add button fixed — ReferenceError on selected',
    changes: [
      'CRITICAL FIX: Modifier modal (Ribeye, Chicken supreme etc.) Add button silently failed — buildDisplayName referenced selected which only exists in VariantsModal not ModifiersModal, causing ReferenceError. The modal stayed open with no error visible. Fixed by removing the undefined reference — modifier-only items never have a variant selection in this context.',
    ],
  },
  {
    version: '1.1.9', date: 'Apr 2026', label: 'Modifier modal Add button fixed',
    changes: [
      'CRITICAL FIX: clicking "Add to order" on modifiable items (Ribeye, Chicken supreme etc.) did nothing — buildDisplayName in ModifiersModal referenced selected which is only defined in the variant pick step, not the modifier step. ReferenceError was swallowed by React leaving the modal open.',
      'ModifiersModal buildDisplayName now uses only item name + instruction group selections (cooking preference etc.). Modifier rows (Side choice, Sauce) display on separate lines in the order panel, not in the name.',
    ],
  },
  {
    version: '2.9.0', date: 'Apr 2026', label: 'Onboarding: Company Admin, Device Pairing, POS First Boot',
    changes: [
      'Company Admin panel — create organisations, add locations, invite restaurant owners (back office → Company Admin).',
      'Device pairing — generate a pairing code in Devices section, enter it on any POS device to register it to your location.',
      'POS first-boot screen — new unregistered devices show a pairing screen instead of going straight to PIN login.',
      'Devices section rebuilt with real Supabase integration — pairing codes stored in database, status tracked.',
    ],
  },
  {
    version: '2.8.2', date: 'Apr 2026', label: 'Fix: back office now loads after login',
    changes: ['Fixed React hooks violation — useState was declared after conditional early returns, causing the back office to render a blank page after authentication. All hooks are now declared before any conditional returns.'],
  },
  {
    version: '2.8.1', date: 'Apr 2026', label: 'Fix: back office auth gate — login screen now works',
    changes: ['Fixed ReferenceError: authUser not defined — auth state was referenced in JSX but never declared. Login screen now shows correctly when accessing the back office without a session.'],
  },
  {
    version: '2.8.0', date: 'Apr 2026', label: 'Auth: Back office login with Supabase Auth',
    changes: [
      'Back office is now gated behind email + password login via Supabase Auth.',
      'Super admin account (peter@posup.co.uk) created and linked to Restaurant OS Internal org.',
      'Multi-tenant schema live: organisations, locations, user_profiles, subscriptions, location_features, devices tables created.',
      'Sign out button added to back office sidebar.',
      'GMV-based plan calculator function deployed to Supabase.',
    ],
  },
  {
    version: '2.7.9', date: 'Apr 2026', label: 'Fix: POS crash — activeCatIds was not defined',
    changes: ['Fixed ReferenceError: activeCatIds is not defined — this variable was referenced in POSSurface but never declared, crashing the POS ordering screen on every load.'],
  },
  {
    version: '2.7.8', date: 'Apr 2026', label: 'Fix: store init crash resolved',
    changes: ['Fixed store initialization crash — _savedBO is now computed inside a single IIFE, eliminating the broken two-variable pattern that caused a white screen on load.'],
  },
  {
    version: '2.7.7', date: 'Apr 2026', label: 'Fix: app crash — reverted broken vite.config define block',
    changes: ['Reverted vite.config.js define block that was overriding import.meta.env and crashing the app at startup.'],
  },
  {
    version: '2.7.6', date: 'Apr 2026', label: 'Fix: POS no longer breaks when Supabase has no categories yet',
    changes: [
      'Fixed: store no longer boots with empty categories when localStorage was overwritten by Supabase hydration. Falls back to seed data if saved data has no entries.',
      'Fixed: Supabase hydration now updates menus and categories independently — never wipes one because the other is empty.',
    ],
  },
  {
    version: '2.7.5', date: 'Apr 2026', label: 'Supabase: menus load from database on startup',
    changes: [
      'Back office now reads menus and categories from Supabase on startup — not from localStorage seed.',
      'Menus you create persist permanently across all page reloads and devices.',
    ],
  },
  {
    version: '2.7.4', date: 'Apr 2026', label: 'Fix: Supabase menu writes — column mapping corrected',
    changes: ['Fixed menu and category upserts to Supabase — only sends columns that exist in the database schema. Previously failing silently because of unknown column names.'],
  },
  {
    version: '2.7.3', date: 'Apr 2026', label: 'Fix: Supabase env vars explicitly baked into bundle',
    changes: ['Updated vite.config.js to explicitly define all Supabase env vars at build time, bypassing Vercel build cache issues.'],
  },
  {
    version: '2.7.2', date: 'Apr 2026', label: 'Supabase: live connection active',
    changes: ['Supabase integration fully live — menus, categories persist to database instantly.'],
  },
  {
    version: '2.7.1', date: 'Apr 2026', label: 'Fix: Supabase connection — force fresh build with env vars',
    changes: [
      'Triggered fresh Vercel build so VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_USE_MOCK env vars are baked into the bundle.',
      'Fixed menu_items query — removed invalid embedded join that caused 400 errors on startup.',
    ],
  },
  {
    version: '2.7.0', date: 'Apr 2026', label: 'Supabase integration: menus and categories persist to live database',
    changes: [
      'Menus and categories now save to Supabase on every change — create a menu, it is instantly in the database.',
      'Page reloads, new devices, and multiple terminals all see the same menus without needing Push to POS.',
      'Falls back to localStorage automatically if Supabase is unreachable.',
    ],
  },
  {
    version: '2.6.4', date: 'Apr 2026', label: 'Menus persist across page reloads without needing Push to POS',
    changes: [
      'Menus and categories are now saved to localStorage instantly on every change. Page reloads no longer reset to the seed menus — your custom menus survive.',
      'Device Profiles menu selector now shows the menus you have actually built, not the default seed menus.',
    ],
  },
  {
    version: '2.6.3', date: 'Apr 2026', label: 'Menus: inline add and delete menus',
    changes: [
      'Menu Manager → Menus tab: click + to add a new menu with an inline form (type name, press Enter or click Create). No browser prompt.',
      'Each menu now has a × delete button. The default menu (Main menu ★) cannot be deleted. Deleting a menu does not delete its categories or items.',
    ],
  },
  {
    version: '2.6.2', date: 'Apr 2026', label: 'Revert: Quick Screen back to single screen',
    changes: [
      'Removed multiple Quick Screens. Back to one simple 16-slot grid. Click an item to add it, drag to reorder, × to remove.',
      'Removed Quick Screen layout selector from Device Profiles.',
      'Category filter in the picker now includes subcategories.',
    ],
  },
  {
    version: '2.6.1', date: 'Apr 2026', label: 'Fix: POS white screen crash + duplicate menu selector in device profiles',
    changes: [
      'Fixed: POS went white screen after v2.6.0 — a runtime crash caused by accessing menus before the store was ready. deviceMenuId is now safe and defaults to null (show all categories) when no menu is assigned to the device profile.',
      'Fixed: Device profiles Edit modal showed the Menu selector twice. Duplicate removed.',
    ],
  },
  {
    version: '2.6.0', date: 'Apr 2026', label: 'Menu-per-device: assign a menu to each terminal',
    changes: [
      'Device profiles now have a Menu selector. Go to Device Profiles → Edit any profile → Menu — pick which menu that terminal shows. The Bar terminal defaults to showing only the Bar menu (drinks and bar snacks).',
      'Both the Bar surface and POS surface now filter their category pills and item grids by the menu assigned to the device. A Bar terminal with the Bar menu only sees bar categories and bar items.',
      'The Menus tab in Menu Manager is where you build and manage named menus (Main menu, Bar menu, Lunch menu etc). Categories are assigned to menus via menuId.',
      'Falls back to showing all menus if no specific menu is assigned to the device profile.',
    ],
  },
  {
    version: '2.7.1', date: 'Apr 2026', label: 'Fix: Supabase connection — force fresh build with env vars',
    changes: [
      'Triggered fresh Vercel build so VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_USE_MOCK env vars are baked into the bundle.',
      'Fixed menu_items query — removed invalid embedded join that caused 400 errors on startup.',
    ],
  },
  {
    version: '2.7.0', date: 'Apr 2026', label: 'Supabase integration: menus and categories persist to live database',
    changes: [
      'Menus and categories now save to Supabase on every change — create a menu, it is instantly in the database.',
      'Page reloads, new devices, and multiple terminals all see the same menus without needing Push to POS.',
      'Falls back to localStorage automatically if Supabase is unreachable.',
    ],
  },
  {
    version: '2.6.4', date: 'Apr 2026', label: 'Menus persist across page reloads without needing Push to POS',
    changes: [
      'Menus and categories are now saved to localStorage instantly on every change. Page reloads no longer reset to the seed menus — your custom menus survive.',
      'Device Profiles menu selector now shows the menus you have actually built, not the default seed menus.',
    ],
  },
  {
    version: '2.6.3', date: 'Apr 2026', label: 'Menus: inline add and delete menus',
    changes: [
      'Menu Manager → Menus tab: click + to add a new menu with an inline form (type name, press Enter or click Create). No browser prompt.',
      'Each menu now has a × delete button. The default menu (Main menu ★) cannot be deleted. Deleting a menu does not delete its categories or items.',
    ],
  },
  {
    version: '2.6.2', date: 'Apr 2026', label: 'Revert: Quick Screen back to single screen',
    changes: [
      'Removed multiple Quick Screens. Back to one simple 16-slot grid. Click an item to add it, drag to reorder, × to remove.',
      'Removed Quick Screen layout selector from Device Profiles.',
      'Category filter in the picker now includes subcategories.',
    ],
  },
  {
    version: '2.6.1', date: 'Apr 2026', label: 'Fix: POS white screen crash + duplicate menu selector in device profiles',
    changes: [
      'Fixed: POS went white screen after v2.6.0 — a runtime crash caused by accessing menus before the store was ready. deviceMenuId is now safe and defaults to null (show all categories) when no menu is assigned to the device profile.',
      'Fixed: Device profiles Edit modal showed the Menu selector twice. Duplicate removed.',
    ],
  },
  {
    version: '2.6.0', date: 'Apr 2026', label: 'Menus: build multiple menus, assign per device profile',
    changes: [
      'Menus tab now shows a menu selector on the left — Main menu, Bar menu, Lunch menu, and a + New menu button. Click a menu to see only its categories. Categories created in a menu belong to that menu.',
      'Device Profiles → Edit any profile → new Menu section: assign which menu that terminal shows (Main menu, Bar menu, etc). The Bar terminal can now show only Bar menu categories.',
      'POS reads the device profile menu assignment and filters category pills accordingly. If no menu is assigned the default menu (Main menu) is used.',
      'Menus are included in Push to POS snapshot so all terminals receive menu assignments automatically.',
    ],
  },
  {
    version: '2.5.3', date: 'Apr 2026', label: 'Device profiles: assign Quick Screen per terminal',
    changes: [
      'Device profiles now have a Quick Screen layout selector. Go to Back Office → Device Profiles → Edit any profile → Quick Screen layout — pick which screen that terminal shows on its ⚡ Quick tab.',
      'The Bar terminal profile can now show the Bar screen (drinks only) while the main counter shows the Main screen. Each device independently reads its assigned screen.',
      'POS reads quickScreenId from the active device config, falling back to the global activeQuickScreenId if no profile screen is assigned.',
    ],
  },
  {
    version: '2.5.2', date: 'Apr 2026', label: 'Fix: quickScreens + menuCategories included in Push to POS snapshot',
    changes: [
      'Quick Screen configurations (multiple screens, column counts, item lists) are now included in the Push to POS snapshot and applied on every page load. Previously they were missing from the snapshot entirely.',
      'menuCategories is now also included in the snapshot so category changes (icons, colours, names, structure) propagate correctly to POS on push.',
    ],
  },
  {
    version: '2.5.1', date: 'Apr 2026', label: 'Fix: Quick Screen category filter includes subcategories',
    changes: ['Quick Screen picker category filter now shows items in subcategories. Selecting Drinks shows items from Draught beer, Wine, Soft drinks subcategories — not just direct Drinks items.'],
  },
  {
    version: '2.5.0', date: 'Apr 2026', label: 'Quick Screen: multiple named screens, variable grid, click-to-add',
    changes: [
      'Multiple named Quick Screens: click + Screen to add screens (Main screen, Bar screen, Lunch, etc). Each screen has its own independent item list. Double-click a tab to rename it.',
      'Variable grid columns: choose 3, 4, 5 or 6 columns per screen from the settings bar. Grid expands automatically.',
      'Click to add: click any item in the right panel to instantly add it to the next empty slot. No drag required. Drag still works for precise placement or reordering.',
      'Already-on-screen indicator: items that are already on the current screen show a green ✓ in the picker panel and cannot be added twice.',
      'Screen isolation: each screen saves its own item list. The main screen stays in sync with the POS Quick tab.',
    ],
  },
  {
    version: '2.4.2', date: 'Apr 2026', label: 'Fix: config snapshot always applied on page load',
    changes: [
      'Critical sync fix: when any page reloaded (POS, KDS, etc.), the Zustand store reset to seed data. SyncBridge was checking sessionStorage version — if it matched the snapshot version, it assumed the config was already applied and showed no banner. But the store had already reset to seed. Result: POS running on stale seed data with no way to know.',
      'Fix: always apply the config snapshot on every mount. The store always starts from seed on reload, so the snapshot must always be re-applied. This means soldAlone items, price changes, menu edits, category changes — all persist correctly across page reloads without needing to click Sync now.',
    ],
  },
  {
    version: '2.4.1', date: 'Apr 2026', label: 'Fix: soldAlone sub-items now appear correctly on POS and in Menus tab',
    changes: [
      'Root cause fixed: 4 separate filter bugs were blocking soldAlone sub-items from appearing on the POS. catItems excluded all sub-items regardless of soldAlone flag. Search results did the same. Tapping a sub-item on POS returned early before processing. Category pill counts did not include them.',
      'Menus tab grid now shows soldAlone sub-items in their assigned category — the gridItems filter was blocking all type=subitem items even when soldAlone was true.',
      'Add Items panel in Menus tab now shows soldAlone sub-items in the available-to-add list so they can be assigned to categories from there.',
      'Full end-to-end flow: Items tab → toggle sold alone on Chips → pick Starters → Push to POS → Chips appears in Starters on POS and is fully tappable and orderable.',
    ],
  },
  {
    version: '2.4.0', date: 'Apr 2026', label: 'Sold alone toggle on items, not modifier groups',
    changes: [
      'Sold alone moved to the correct place — it is now a sliding toggle on each sub-item row in the Items tab, not on modifier group options (which was wrong).',
      'How it works: go to Items tab → find any Sub item (Chips, Side salad, etc.) → a sliding toggle appears below the row labelled Also sell standalone. Flip it green → a Category dropdown appears inline → pick any category → that item now appears there on the POS exactly like a normal item.',
      'Removed: Extras category from POS — sold-alone items now appear in whichever real category you assign them to, not in a special Extras screen.',
      'Removed: soldAlone checkbox from Modifier groups tab (wrong location). The toggle lives on the product itself in the Items tab.',
      'Backend: POS now includes subitem-type items in the menu when soldAlone is true and a cat is set. The updateMenuItem store action handles soldAlone and cat fields directly.',
    ],
  },
  {
    version: '2.3.1', date: 'Apr 2026', label: 'Sold alone: backend wired correctly',
    changes: [
      'Fixed: menuCategories was missing from ModifiersTab store subscription — the category dropdown in the sold-alone checkbox was calling useStore.getState() (a static one-time snapshot) instead of the reactive hook. Now uses the live menuCategories value so the dropdown always shows current categories.',
      'Added: updateModifierGroupOption store action — a direct targeted action that patches a single option within a modifier group without rebuilding the entire options array. updOpt now calls this instead of re-mapping the full options array through updateModifierGroupDef.',
      'The soldAlone and soldAloneCat fields now persist correctly when toggled in the Modifier groups tab. Changes reflect immediately on POS (Extras screen and category items).',
    ],
  },
  {
    version: '2.3.0', date: 'Apr 2026', label: 'Sold alone: modifier options orderable as standalone POS items',
    changes: [
      'NEW: Can be sold alone — in the Modifier groups tab, each option now has a Can be sold alone checkbox. When ticked, you choose which category it appears in on the POS menu. That option then shows as a regular tappable item in that category.',
      'Example: Chips and Side salad in the Side choice group can now be ticked as sold alone → Starters. They appear directly on the Starters POS screen and can be ordered without being attached to another item.',
      'NEW: Extras category — when any soldAlone options exist, a purple ⊕ Extras category pill appears on the POS. It shows ALL soldAlone options from all modifier groups in one dedicated quick-access screen.',
      'Demo: Chips, Side salad, Sweet potato fries from the Side choice group are sold alone in Starters. They appear both in the Starters category and the Extras screen.',
    ],
  },
  {
    version: '2.2.0', date: 'Apr 2026', label: 'Menus tab: search and add existing items to categories',
    changes: [
      'Menus tab redesigned: the + Item button is replaced with + Add items. Clicking it opens a search panel that lets you find any item from the Items library and add it to the selected category.',
      'Add items panel shows: items already in this category (with Remove button), then all available items below (with + Add button). Search filters both sections live as you type.',
      'Removing an item from a category moves it to its next assigned category or clears the primary category — the item stays in the Items library, just removed from this menu category.',
      'Items tab is the right place to create new items. Menus tab is for building the menu by assigning existing items to categories.',
    ],
  },
  {
    version: '2.1.0', date: 'Apr 2026', label: 'Items tab — full item library with variants always visible',
    changes: [
      'NEW: 📋 Items tab — a flat list of every item in the system including all variant sub-items. Shows parent items with variant children always visible and indented below (Lager → └ Pint, └ Half pint). This is the central item library.',
      'Items tab features: search by name/description, filter by type (Simple / Options / Has sizes / Pizza), filter by category, + Item button creates a new item. Click any row to open the full item editor on the right (Flow / Sizes / Modifiers / Pricing / Allergens tabs).',
      '+ Add size button at the bottom of each variant group — add a new variant directly from the Items list.',
      'Menu renamed to Menus — all existing menu editing functionality unchanged.',
      'Nav order: Menus | Quick Screen | Items | Modifier groups | Instruction groups.',
    ],
  },
  {
    version: '2.0.2', date: 'Apr 2026', label: 'Category ↕ Move modal, list sub-items fix',
    changes: [
      'Category nesting redesigned: drag-to-nest removed (unreliable HTML5 drag events). Every category now has a ↕ button that opens a clean Move modal — choose Root level or any other category to nest under. Works reliably every time.',
      'Category un-nesting: click ↕ on any subcategory → select Root level → Move here. Done.',
      'Category reorder via drag still works within the same level (root-to-root or sub-to-sub).',
      'List view sub-items fix: switched from expandedIds (needed initialising per category switch) to collapsedIds (empty by default = all expanded). Variant children now always show immediately when you navigate to any category.',
    ],
  },
  {
    version: '2.0.1', date: 'Apr 2026', label: 'Fix: list view variants always visible, category drag reliable',
    changes: [
      'List view variants fix: sub-items (sizes) now always show expanded by default regardless of which category you navigate to. Root cause: expandedIds state was initialised once from the first category and never updated when you switched categories. Fixed by inverting the logic to track collapsedIds (empty by default = everything open). Click ▾ to collapse a variant group, click ▸ to expand.',
      'Category drag fix: removed DragLeave event listeners that were clearing the drop target on every mouse movement between child elements, making drops unreliable. Drop zones now stay highlighted until drag ends.',
      'Category nesting via drag: when dragging a category over another category, shows nest → badge to make clear it will become a subcategory. Same-level drag still reorders.',
      'Category un-nesting: the top drop zone is now larger (8px padding vs 3px) with clearer label. The Edit category modal parent selector also works as a reliable backup for nesting/unnesting.',
      'Root drop fix: un-nest to root now correctly sets parentId to null before looking up the target (previously a guard check was in wrong order).',
    ],
  },
  {
    version: '2.0.0', date: 'Apr 2026', label: 'Canvas removed · List view with inline variant editing',
    changes: [
      'Canvas feature removed completely — it was unreliable and did not correctly reflect changes on the POS. The Grid/Canvas toggle is now Grid/List.',
      'NEW: List view (☰ List button in category toolbar). Shows every item as a table row: drag handle · name · type badge · price · modifier count · allergen count. Drag rows to reorder — reorder reflects immediately on POS.',
      'Variants visible in List view: items with sizes show a ▾ expand arrow. Click to reveal all variant children indented below the parent, always visible by default. Each variant row shows its name (editable inline) and price (editable inline) without needing to click into an editor.',
      '+ Add size button appears at the bottom of each expanded variant group — adds a new size directly from the list without navigating anywhere.',
      'Clicking any row (parent or variant child) still opens the full item editor panel on the right for detailed editing.',
    ],
  },
  {
    version: '1.9.2', date: 'Apr 2026', label: 'Fix: canvas sortOrder scoped per category; nested modifiers reactive',
    changes: [
      'Canvas sortOrder fix: dragging items in Canvas view now only recalculates sortOrder for items in the SAME category. Previously, dragging a Starter would affect the sortOrder numbering of Mains, Drinks etc because all items were sorted globally — now scoped to the active category.',
      'InlineItemFlow now uses reactive Zustand subscription for modifierGroupDefs/instructionGroupDefs instead of a one-time getState() snapshot. This ensures nested sub-group definitions are always up-to-date when building modifier flows for variant items.',
      'Nested modifiers on variant items: after picking a size, modifier options with subGroupId correctly trigger their linked sub-group inline below. The subGroupId is preserved through the option spread when stored in selections state.',
    ],
  },
  {
    version: '1.9.1', date: 'Apr 2026', label: 'Fix: modifiers on variant items now show after picking a size',
    changes: [
      'Critical fix: when an item has sizes (variants), modifier groups assigned to the parent item now correctly appear after the customer picks a size. Root cause: after picking a variant (e.g. Pint), the flow was looking for modifier groups on the child item (Pint) instead of the parent (Stout). Child items never have their own modifier groups — they inherit from the parent. Fixed in InlineItemFlow to check parent modifiers when child has none.',
      'The hasMods check now also looks at the parent item — so if a variant item has parent modifiers, the flow correctly transitions to the modifiers step instead of immediately adding to the order.',
    ],
  },
  {
    version: '1.9.0', date: 'Apr 2026', label: 'Fix: variant order + canvas order now reflect on POS',
    changes: [
      'Variant order on POS fixed: dragging sizes to reorder in the Sizes tab or Flow tab now correctly reflects on the POS. Root cause was variantChildren were read from the store without sorting by sortOrder — fixed in both POSSurface and InlineItemFlow.',
      'Canvas drag now updates sortOrder: previously dragging items on the canvas only saved canvasPos (the visual position) but never updated sortOrder. Now when you release a drag, all items in the canvas are re-ranked by their Y position (top to bottom), and that order is what the POS uses.',
      'Canvas auto-layout also correctly updates sortOrder when items are rearranged.',
    ],
  },
  {
    version: '1.8.0', date: 'Apr 2026', label: 'Flow tab — complete customer journey in item editor',
    changes: [
      'New Flow tab is now the DEFAULT view when clicking any item — shows the complete customer ordering journey in numbered steps: ① Choose size (Pint / Half pint / Third, editable inline with prices), ② Side choice REQUIRED (Chips · Side salad…), ③ Sauce Optional, ④ Cooking preference no charge. This is the exact sequence the customer goes through on POS.',
      'Sizes are now editable directly in the Flow tab — name and price for each variant, inline. No need to switch to Sizes tab just to update a price.',
      'Modifier groups in Flow tab show all options as chips and display nested modifier indicators (↳ If "Peppercorn": also shows Sauce preference).',
      'Drag handles on modifier groups in Flow tab — drag to reorder the customer journey without switching tabs.',
      'Instruction groups shown in green numbered steps at the end of the flow.',
      'Search-to-add modifier groups available at the bottom of the Flow tab.',
      'Visual Builder (swimlane) removed — it did not match the POS and was confusing. Clean nav: Menu | Quick Screen | Modifier groups | Instruction groups.',
    ],
  },
  {
    version: '1.7.0', date: 'Apr 2026', label: 'Visual Menu Builder — swim-lane drag-and-drop + flow visualizer',
    changes: [
      'NEW: ✦ Visual Builder tab in Menu Manager — a full swim-lane canvas showing your entire menu at once. One column per category, drag items between categories to reassign, drag columns to reorder categories.',
      'Per-item flow visualization: click ▼ flow on any item card to see the complete POS ordering journey — ① Sizes ② Side choice ★ required ③ Sauce (with nested modifiers shown) ④ Cooking preference. Exactly what the customer sees, step by step.',
      'Channel assignment on each menu: toggle POS / Kiosk / Online / Delivery active state per menu directly in the builder header.',
      'Local/Shared/Global pricing scope restored in item editor — sets whether pricing is unique to this item, inherited from a shared rule, or identical across all channels.',
      'Item quick-edit panel slides in from right when clicking any item card — full Details/Pricing/Modifiers/Sizes/Allergens without leaving the visual builder.',
      'Modifier assignment in the quick-edit panel uses the same search-first pattern — all changes visible immediately on the swim-lane.',
    ],
  },
  {
    version: '1.6.0', date: 'Apr 2026', label: 'Modifier/instruction groups drag-reorder, subGroupId, canvas as view mode',
    changes: [
      'Modifier groups tab: drag handles on both groups (left list) and options (right editor). Drag groups to reorder the order they appear in search/assignment. Drag options within a group to set the order the customer sees them on POS.',
      'Nested modifiers in editor: each option now has a nested group selector (↳ Nested group dropdown). Pick any other modifier group to make it appear when that option is selected. This is the core of the conditional modifier flow.',
      'Instruction groups tab: same drag-to-reorder for both groups and individual options within each group.',
      'Canvas removed as top-level tab — now accessed per-category via the Grid/Canvas toggle button in the category toolbar. The canvas view automatically shows only items in the selected category.',
      'Reorder store actions added: reorderModifierGroupDefs and reorderInstructionGroupDefs for persistent ordering without sortOrder fields.',
    ],
  },
  {
    version: '1.5.0', date: 'Apr 2026', label: 'Full pizza builder + pizza items fixed',
    changes: [
      'Pizza items (Margherita, Pepperoni, BBQ chicken) now correctly set as type:pizza — previously they were type:modifiable so the pizza builder never appeared.',
      'Per-item pizza configuration: each pizza can now have its own sizes (with custom names and prices), available bases, available crusts, and default toppings — all independent from the global defaults.',
      'Pizza builder in Menu Manager shows: sizes list with drag-edit + add-size form; bases toggle (which are available for this pizza); crusts toggle; default toppings grid with colour-coded indicators; order flow preview showing exactly what the customer will see.',
      'PizzaModal now reads per-item config (pizzaSizes/pizzaBases/pizzaCrusts) and falls back to globals. BBQ chicken correctly defaults to BBQ base only.',
      'POS routing: pizza items use the full PizzaModal overlay (size + base + crust + half/half + toppings), other items use the new inline flow.',
      'BBQ base added to PIZZA_BASES global list.',
    ],
  },
  {
    version: '1.4.0', date: 'Apr 2026', label: 'Menu Manager rebuilt — search modifiers, proper sizes, pizza, grid canvas',
    changes: [
      'Item editor rebuilt from scratch: wider panel (420px), underline tab navigation that actually works, no more cramped horizontal buttons.',
      'Modifiers tab: search-first assignment. Type to filter hundreds of modifier groups, click to assign. Assigned groups shown as a draggable ordered list with Required/Optional toggle and Max selector — drag to reorder the flow the customer sees on POS.',
      'Sizes tab (renamed from Variants): clean list with drag reorder, inline name and price editing, POS preview showing exactly how sizes will appear.',
      'Pizza tab: per-item default toppings selector. All 14 toppings shown with colour coding. Global pizza settings (sizes/bases/crusts) still configured in Modifier groups.',
      'Canvas: grid snapping — items snap to 20px grid positions instead of arbitrary pixels. Auto-layout uses a clean column grid. Cleaner, more organised layout.',
      'Allergens: 2-column grid layout instead of single column — faster to scan and toggle.',
    ],
  },
  {
    version: '1.3.0', date: 'Apr 2026', label: 'Major UX redesign — inline flows, canvas layout, nested modifiers',
    changes: [
      'POS: Variant and modifier selection now happens inline in the center panel (not a modal overlay). Tap a variant item → large size buttons appear in the menu area. Pick a size → modifier groups flow below sequentially. Back button returns to variant step. Full allergen display throughout.',
      'Menu Manager: Variant children no longer appear as separate product cards. Tap the parent to expand inline variant buttons grouped below it. Add new variants directly from the parent card.',
      'Menu Manager: New 🗂 Canvas tab — free-form drag-anywhere layout. Move items to any position. Mouse-wheel zoom (30–200%), alt+drag or middle-click to pan. Auto-layout resets to clean grid. Item positions saved to canvasPos field.',
      'Nested modifiers: Modifier options can now link to sub-groups via subGroupId. Example: selecting Peppercorn sauce reveals a nested "Sauce preference" group (Served hot / On the side) inline below.',
      'Store: mgd-sauce-temp sub-group added as demonstration of nested modifier pattern.',
    ],
  },
  {
    version: '1.2.0', date: 'Apr 2026', label: 'Full audit pass: imports cleaned, Kiosk variants fixed',
    changes: [
      'OtherSurfaces: removed unused CATEGORIES import from seed (was replaced by live store menuCategories).',
      'Kiosk: item.variants.map() crash fixed — same root cause as the Bar fix. Now uses MENU_ITEMS.filter(i => i.parentId === item.id) to find variant children from the store.',
      'Kiosk: fromPrice now reads pricing.base correctly for variant parents.',
      'POSSurface CAT_META/CATEGORIES/QUICK_IDS remain as valid legacy fallbacks.',
    ],
  },
  {
    version: '1.1.9', date: 'Apr 2026', label: 'Modifier modal stays open bug fixed',
    changes: [
      'CRITICAL: Modifier modal selections (Side choice, Sauce etc.) were being reset to empty whenever any Zustand state update triggered a POSSurface re-render. Root cause: MENU_ITEMS was recreated via .map() on every render, giving items new object references. ProductModal saw a different prop object and remounted, losing useState selections.',
      'Fix 1: MENU_ITEMS wrapped in useMemo([rawItems, orderType]) so item references stay stable across renders.',
      'Fix 2: ProductModal given key={modalItem.id} so it only remounts when a genuinely different item is opened, never on parent re-renders with the same item open.',
      'Result: Clicking Chips then Peppercorn sauce then Add to order now works correctly — item is added with all modifiers and modal closes.',
    ],
  },
  {
    version: '1.1.8', date: 'Apr 2026', label: 'Send-to-table auto-fires kitchen, variant names, mod display',
    changes: [
      'Seat at table / Add to occupied table now automatically sends to kitchen. Previously items landed on the table but the operator had to reopen the check and click Send again. Now the send modal → choose table flow completes in one step.',
      'Variant name now shows in order panel: "Stout — Pint" instead of just "Stout". The displayName is built as "ItemName — VariantLabel" so the selected size/serving is always visible on the order line.',
      'Modifiers no longer appear on the item name line. Previously mods were concatenated into the name ("Ribeye — Chips, Peppercorn") AND also shown as separate rows below — double display. Now the name shows only the variant label, and modifiers show exclusively on their own rows underneath.',
      'Instruction group selections (e.g. cooking preference) are still included in the name when relevant, since they have no separate display row in the order panel.',
    ],
  },
  {
    version: '1.1.7', date: 'Apr 2026', label: 'Bar variants fixed, parent-only items in menu',
    changes: [
      'Bar menu: variant child items (Stout Pint, Half pint etc.) were appearing alongside the parent Stout item. Fixed ITEMS filter to exclude items with a parentId.',
      'Bar variants: clicking a variant item (Stout, Lager) crashed because QuickItemBuilder called item.variants.map() — no such array exists. Variants are stored as child items in the store. Fixed to look up children via menuItems.filter(i => i.parentId === item.id).',
      'Bar modifiers: QuickItemBuilder now resolves modifier groups from modifierGroupDefs store state instead of the defunct item.modifierGroups format.',
      'Bar fromPrice: item card price calculation now uses variant children from ITEMS instead of item.variants array.',
    ],
  },
  {
    version: '1.1.6', date: 'Apr 2026', label: 'Bar crash fix: toFixed on undefined total',
    changes: [
      'Bar crash fixed: tab.total, activeTab.total, round.subtotal and item prices guarded with ||0 fallback before .toFixed() calls — old localStorage state from previous sessions had tabs without a total field.',
      'openedAt and all action timestamps (closedAt, timestamp, createdAt) changed from new Date() to Date.now() throughout the store for consistent numeric timestamp storage.',
      'Bar fromPrice guard: item.variants checked for existence before Math.min spread.',
    ],
  },
  {
    version: '1.1.5', date: 'Apr 2026', label: 'Bar items fix, seed refs cleaned up across surfaces',
    changes: [
      'Bar surface: category default was cocktails (nonexistent) — changed to all so items always show on load.',
      'Bar surface: CAT_META and QUICK_IDS replaced with live store data (menuCategories, quickScreenIds) so category colours, icons and quick screen reflect Menu Manager edits.',
      'Bar surface: unused CATEGORIES and QUICK_IDS seed imports removed.',
      'OtherSurfaces (Status): CATEGORIES replaced with store menuCategories so category filter reflects live menu.',
      'Inventory: CATEGORIES replaced with store menuCategories, category labels now live.',
      'All surfaces now read category data from store rather than static seed constants.',
    ],
  },
  {
    version: '1.1.4', date: 'Apr 2026', label: 'KDS crash fixed, NaN time fixed, variant labels',
    changes: [
      'CRITICAL: KDS crashed entire app on click — getLiveMinutes was a const arrow function but was referenced before its declaration in the minified bundle. Changed to a hoisted function declaration.',
      'KDS tick timer (setInterval/useEffect) was missing — timers now update every 30 seconds.',
      'Floor plan "Order sent: NaNh NaNm ago" fixed — sentAt was stored as Date object which serialised to string, then Date.now()-string = NaN. All sentAt values now stored as numeric timestamps.',
      'Variant picker label changed from "Choose option" to "Choose size/serving" — default variantLabel changed from Option to Size.',
      'Lager/Stout get variantLabel: Size, House white/red get variantLabel: Serving in seed data.',
      'Demo table sentAt timestamps fixed to plain numbers (no Date objects).',
    ],
  },
  {
    version: '1.1.3', date: 'Apr 2026', label: 'POS white screen fixed — missing computed values restored',
    changes: [
      'CRITICAL FIX: subCategories, catItems and displayItems useMemos were accidentally deleted from POSSurface during a Python string replacement. POS rendered with undefined references causing a white screen.',
      'All three computed values restored: subCategories (pills strip), catItems (items in selected category), displayItems (search results or category items).',
    ],
  },
  {
    version: '1.1.2', date: 'Apr 2026', label: 'Login screen fixed — staff cards clickable, demo bypass',
    changes: [
      'Staff without a PIN set can now tap their card to log straight in (no PIN required).',
      'Staff with a PIN set show a 🔐 indicator and open the numpad when tapped.',
      'If no staff are configured (Back Office not set up yet), a "Enter as Demo" bypass button appears.',
      'Back button on PIN entry returns to staff selection.',
      'Staff card colour from store used for selection highlight.',
    ],
  },
  {
    version: '1.1.1', date: 'Apr 2026', label: 'Black screen fix: QUICK_IDS missing import',
    changes: [
      'CRITICAL FIX: store referenced QUICK_IDS but it was never imported from seed — ReferenceError crashed the entire app at module load before React could mount (black screen).',
      'PINScreen now reads from store.staffMembers — staff added in Staff Manager appear on the login screen.',
      'Kiosk surface now reads categories and items from store, respects quickScreenIds, filters by visibility.kiosk, sorts by sortOrder.',
    ],
  },
  {
    version: '1.1.0', date: 'Apr 2026', label: 'Quick Screen manager, Staff manager, EOD Z-read',
    changes: [
      'Quick Screen manager (⚡ tab in Menu Manager): 4×4 drag-and-drop grid — drag items from the picker panel onto slots. Reorder by dragging within the grid. Remove with ✕. Auto-fill and Clear all buttons. Changes reflect on POS ⚡ tab instantly.',
      'Staff Manager rebuilt: list + editor layout. Add staff with role, colour, 4-digit PIN (numpad). Set per-staff permissions (void, discount, refund, cash up, reports, EOD, manage staff). Reset to role defaults button. All data persists to store.',
      'EOD Z-read rebuilt: cash declaration with denomination counts (+/- buttons per note/coin type), opening float, variance calculation (over/short), banking amount. Z-Read summary with full revenue breakdown, cash reconciliation, and net totals.',
      'Store: quickScreenIds state + setQuickScreenIds action. staffMembers state with add/update/remove. Reads from seed data as initial state.',
    ],
  },
  {
    version: '1.0.9', date: 'Apr 2026', label: 'Variants: modifiers work after variant pick, better labels, POS preview',
    changes: [
      'Variants tab in item editor now shows modifier groups — assign once to the parent and they appear after every variant is picked (Step 1: size → Step 2: options).',
      'Instruction groups also assignable from Variants tab.',
      'variantLabel is now prominent — preset buttons (Size, Type, Cut, Style, Strength, Format, Serving, Portion, Blend, Roast) plus free-text custom label.',
      'POS variant picker: item name shown prominently, "Choose size/type/cut" heading uses the real label. Step indicator only appears when modifiers follow.',
      'Step 2 (modifier step) shows selected variant with a green tick badge for clarity.',
      'POS preview in Variants tab shows how the picker will look, and confirms which modifier groups follow.',
    ],
  },
  {
    version: '1.0.8', date: 'Apr 2026', label: 'Modifier options no longer show undefined',
    changes: [
      'Modifier options store name as opt.name (new format) but POS ordering modal was reading opt.label — all option labels showed as undefined.',
      'Fix: opt.label||opt.name throughout ProductModal — display, buildDisplayName, handleAdd all updated.',
      'Options now also have label aliased from name at build-groups time so both old and new format options work.',
      'selectionType now reads stored value first (single/multiple), falling back to max-based detection.',
    ],
  },
  {
    version: '1.0.7', date: 'Apr 2026', label: 'Menu Manager — complete rethink matching Toast/Square model',
    changes: [
      'Items panel is now a GRID matching the POS — same card style, same colour bars, same proportions. Drag cards to reorder, order reflects on POS instantly.',
      'Variants managed inside the item editor (Variants tab) — type a name and price, click Add variant. No more dragging items onto each other. Works like Square/Toast.',
      'Sub items removed from the main menu flow. Modifier group options are now plain name+price pairs typed directly in the Modifier groups tab — no separate sub-item records needed.',
      'Category drag: same-level drag reorders, cross-level drag nests as subcategory. Drop indicator line shows insert position.',
      'Search across all items from the item grid toolbar — find anything without leaving the current category view.',
      'Item editor: Details / Variants / Modifiers / Pricing / Allergens all in one slide-in panel.',
      'Modifier group option editor: add options with name+price inline — no sub-item picker step required.',
    ],
  },
  {
    version: '1.0.6', date: 'Apr 2026', label: 'POS now reflects Menu Manager changes instantly',
    changes: [
      'POS item grid now sorts by sortOrder on every render — drag-to-reorder in Menu Manager is reflected immediately on the POS without a page reload.',
      'catItems useMemo adds .sort((a,b) => (a.sortOrder??999)-(b.sortOrder??999)) so new order is picked up as soon as store updates.',
      'Both POS and Menu Manager share the same Zustand store — changes are reactive with no manual "Push to POS" required for menu edits.',
    ],
  },
  {
    version: '1.0.5', date: 'Apr 2026', label: 'Menu Manager drag-and-drop actually works',
    changes: [
      'Category drag: same-level drag now REORDERS (updates sortOrder) — not just nests. Dragging onto a different-level category nests it. Blue indicator line shows insert position.',
      'Seed items now get sequential sortOrder (0,1,2…) at store init — previously all had undefined, so reordering never changed display order.',
      'Item drag indicator: blue line appears between items showing exactly where the item will land.',
      'POS catItems sort uses sortOrder correctly — changes made in Menu Manager reflect immediately on POS item grid.',
    ],
  },
  {
    version: '1.0.4', date: 'Apr 2026', label: 'Menu Manager complete redesign — 3-panel contextual layout',
    changes: [
      'Menu Manager rebuilt from scratch. Was: 5 disconnected tabs (Categories, Items, Modifiers, Instructions, Builder). Now: 3 tabs — Menu, Modifier groups, Instruction groups.',
      'Menu tab: 3-panel layout — Category tree (left) | Items in selected category (centre) | Item editor (right). Click a category → see its items. Click an item → edit everything in one place.',
      'Item editor has 4 sub-sections: Details (names, type, category, visibility), Pricing (per-channel prices), Modifiers (assign modifier+instruction groups with required/max controls), Allergens.',
      'No more separate Builder tab — modifier and instruction group assignment is in the item editor.',
      'Category tree: drag ⣿ to reorder, drag onto another to nest as subcategory, drop on root zone to un-nest. Click Edit cat to change icon/colour/name. Inline add category form.',
      'Items panel: items in the selected category only. Drag ⣿ to reorder (updates sortOrder, reflects on POS). Shows allergen count, modifier group count inline.',
      'Modifier groups and Instruction groups are now library tabs — create/edit groups there, assign from inside item editor.',
    ],
  },
  {
    version: '1.0.3', date: 'Apr 2026', label: 'Items tab filters + richer item info',
    changes: [
      'Items tab: 5 filter pills — All, Items only, Sub items, Variants, With modifiers. Category filter dropdown. Clear all button. Live item count.',
      'Search now searches description as well as name.',
      'Each item row now shows: category icon+name, allergen count (⚠ N), modifier group count (⊕ N mods), instruction group count (📝 N).',
      'Items in multiple categories show "+N" next to the primary category label.',
    ],
  },
  {
    version: '1.0.2', date: 'Apr 2026', label: 'Drag-and-drop fixed across Menu Manager',
    changes: [
      'Item reorder: drop target moved to full row (was only the 12px handle icon — undroppable). Dragging ⣿ handle now correctly reorders items, re-indexing sortOrder sequentially.',
      'onDragEnd added to all draggable elements in Categories and Items tabs — prevents stuck drag state when drag is cancelled or dropped on invalid target.',
      'Category drag-to-subcategory: onDragEnd added so dragId resets properly after every drag operation.',
      'Variant drag (drag item onto item): still works via row body drag. Handle drag and row drag now cleanly separated.',
    ],
  },
  {
    version: '1.0.1', date: 'Apr 2026', label: 'Modifier UX, multi-category, drag reorder, bug fixes',
    changes: [
      'Modifier groups: single-choice shows radio UI, multi-choice shows +/- qty buttons — allows adding multiple of the same option (e.g. 2× Truffle oil). Unlimited option sets no cap.',
      'selectionType field (single/multiple) wired to store and respected in POS ordering modal.',
      'Items can now belong to multiple categories — primary category dropdown + additional category toggles in Item Editor. Items appear in all assigned categories on POS.',
      'Menu Manager Items tab: ⣿ drag handle reorders items (updates sortOrder, reflects on POS). Body drag still creates variants.',
      'Checkout modal groups items by course (Course 1 / Course 2 headers) when order spans multiple courses.',
      'Split check (T1.2) now sends to kitchen immediately on creation — no longer left as pending.',
      'Split check floor plan icon clears correctly when all checks for a table are settled.',
      'Duplicate subcategory pill strip removed from POS (was rendering twice).',
      'Modifier group title fallback: group.label || group.name — titles no longer blank.',
    ],
  },
  {
    version: '1.0.0', date: 'Apr 2026', label: 'v1.0 — send flow fixed, checkout by course, split check fixes',
    changes: [
      'Split check now sends to kitchen immediately after creation.',
      'Checkout modal now groups items by course.',
      'Split check icon on floor plan clears properly after settling both checks.',
      'Duplicate subcategory nav strip removed.',
      'Modifier group titles fixed — no longer blank.',
    ],
  },
  {
    version: '0.9.9', date: 'Apr 2026', label: 'POS blank screen root cause fixed',
    changes: [
      'useEffect was missing from React import in POSSurface — caused ReferenceError on every render, blank screen.',
      'One line fix: added useEffect to import { useState, useMemo, useRef, useEffect }.',
    ],
  },
  {
    version: '0.9.8', date: 'Apr 2026', label: 'Anchor demo data, Reports, variant pricing fix',
    changes: [
      'Demo floor plan tables updated to use real Anchor menu items (Ribeye, Salmon, House white).',
      'Demo bar tabs updated to use real Anchor items (Lager pints, Stout, House wine).',
      'Variant parent cards now show correct "from £X.XX" using child item lookup — no longer crashes on item.variants.map.',
      'Reports rebuilt: Overview (KPIs + payment split + order type + top 5), Product mix table with share bars, By server table, Hourly bar chart with peak hour callout.',
    ],
  },
  {
    version: '0.9.7', date: 'Apr 2026', label: 'POS fixed after blank screen regression',
    changes: [
      'Removed stale inline OrdersHub render from POS right panel — was causing crash before anything could render.',
      'Subcategory pills consolidated to single clean render.',
      'Dynamic category nav from store confirmed working.',
    ],
  },
  {
    version: '0.9.6', date: 'Apr 2026', label: 'Menu Manager ↔ POS bridge + The Anchor menu',
    changes: [
      'POS category nav now reads from store (Menu Manager) — not static seed data. Categories you create appear on POS immediately.',
      'Subcategories on POS: tapping Mains reveals Grills / Fish / Vegetarian sub-tabs. Tapping Drinks reveals Draught / Wine / Soft drinks. Pill strip appears above item grid.',
      'Variants wired end-to-end: dragging an item under another in Items tab auto-sets parent type to "variants". POS detects variant parents via child lookup, not just type field. Lager → Pint/Half pint picker works.',
      'Modifier groups: options must be sub items only. Three-panel editor: groups list, group editor, sub item picker (search + one-click add). Options show sub item name and price.',
      'Force/Unforce controls: Optional/Required toggle buttons. Max = 1 (pick one) / Unlimited / Custom number.',
      'Parent type auto-reverts to "simple" when last variant child is unlinked.',
      'The Anchor seed menu: 29 orderable items across 6 categories, 5 subcategories, 4 variant parents (Lager, Stout, House White, House Red), 10 modifiable items (steaks, chicken, pizza, coffee), 15 sub items, 4 modifier groups, 4 instruction groups.',
    ],
  },
  {
    version: '0.9.5', date: 'Apr 2026', label: 'Unified Orders screen',
    changes: [
      'Orders tab restored to sidebar: Bar → Floor → POS → Orders → KDS.',
      'Three clear sections: Tables, Bar tabs, Walk-in/Queue — each collapsible.',
      'Filter tabs by type + 👤 My orders + search + show completed.',
    ],
  },
  {
    version: '0.9.4', date: 'Apr 2026', label: 'Send flow fixes & split check restored',
    changes: [
      'Send always clears the order — removed async setTimeout, now uses direct store calls so customer/orderType are set before sendToKitchen reads them.',
      'Occupied table: both "Add to existing check" and "New separate check (T1.2)" options restored.',
      'Split check creates a child table (T1.2) with its own independent session and bill.',
      'Full CHANGELOG updated from v0.7.0.',
    ],
  },
  {
    version: '0.9.3', date: 'Apr 2026', label: 'Modifier & instruction groups end-to-end',
    changes: [
      'Modifier groups and instruction groups from the Product Builder are now fully wired into the POS ordering modal.',
      'Instruction groups (cooking temp, bread, spice level etc.) show with green radio UI, no price shown — printed on kitchen ticket.',
      'Modifier groups (paid options: sauce, extras) show with radio/checkbox UI enforcing min/max.',
      'POS openFlow now triggers modal for items with assignedModifierGroups or assignedInstructionGroups.',
      'All send paths (table, counter, takeaway, collection, delivery, bar) close checkout on send.',
    ],
  },
  {
    version: '0.9.2', date: 'Apr 2026', label: 'Nav restructure & Orders Hub in shift bar',
    changes: [
      'Orders Hub removed from sidebar nav — now lives as 📋 Orders button in the top shift bar, always visible with live active order count badge.',
      'Bar moved above Floor in sidebar nav: Bar → Floor → POS → KDS.',
      'Checkout modal closes on send in all paths.',
    ],
  },
  {
    version: '0.9.1', date: 'Apr 2026', label: 'Menu Manager complete rebuild',
    changes: [
      'Five focused screens: Categories, Items, Modifier groups, Instruction groups, Product builder.',
      'Categories: drag one category onto another to nest it as a subcategory. Items in subcategory also count in the parent.',
      'Items: all items and sub items in one list. Drag an item onto another to link it as a variant child. The parent becomes a picker button on POS.',
      'Modifier groups: define reusable paid option groups (options that change price). Set min/max per group.',
      'Instruction groups: preparation instructions with no price change (cooking temp, bread preference, spice level etc.).',
      'Product builder: assign modifier groups and instruction groups to any item. Set per-item min/max overrides.',
      'Store: modifierGroupDefs and instructionGroupDefs state added.',
    ],
  },
  {
    version: '0.9.0', date: 'Apr 2026', label: 'Multi-location & Stripe Terminal scaffold',
    changes: [
      'Multi-location Back Office section: manage locations, switch active location, configure per-location VAT/currency/timezone/service charge.',
      'Locations store state: currentLocationId, locations[], setCurrentLocation, addLocation, updateLocation.',
      'Stripe Terminal scaffold (src/lib/stripe.js): initStripeTerminal, discoverReaders, connectReader, collectPayment, cancelPayment — mock mode simulates card tap with 5% decline rate.',
    ],
  },
  {
    version: '0.8.9', date: 'Apr 2026', label: 'OrderTypeModal — complete send flow redesign',
    changes: [
      'Send button with no table assigned now shows OrderTypeModal — six clear paths: Counter/named, Seat at table, Bar tab, Takeaway, Collection, Delivery.',
      'Counter/named: enter optional name, sends to kitchen immediately, appears in Orders Hub, POS clears.',
      'Seat at table: picks available table from floor plan, seats items, navigates to floor plan.',
      'Bar tab: open a new named tab or add to an existing open tab.',
      'Takeaway/Collection: name + phone + time (or ASAP), sends to kitchen + order queue.',
      'Delivery: name + phone + address, sends to queue.',
    ],
  },
  {
    version: '0.8.8', date: 'Apr 2026', label: 'Orders Hub rebuild + live badge',
    changes: [
      'Orders Hub rebuilt with live elapsed timers, channel filter tabs (All / Tables / Bar / Dine-in / Takeaway / Collection / Delivery), colour-coded status strips.',
      'My orders filter: tap "👤 My orders" to see only the current server\'s active orders.',
      'Orders Hub shows table sessions, bar tabs, and walk-in queue orders unified.',
      'Active order count badge on Orders button in shift bar.',
    ],
  },
  {
    version: '0.8.7', date: 'Apr 2026', label: 'Orders Hub + walk-in routing fix + menu type system',
    changes: [
      'Orders Hub added as a full-screen surface: unified view of all active orders across tables, bar tabs, and walk-in queue.',
      'Walk-in order routing fixed: all orders sent without a table (including named dine-in) now always appear in the Orders Hub.',
      'Sub item type: first-class item type, hidden from POS/kiosk/online, used only as options within modifier groups.',
      'Modifiable type: auto-set the moment modifier groups are added to an item, reverts to Simple when all groups are removed.',
      'Variants: parent item with children linked via parentId. Each child is a full item with its own price.',
      'Combo (renamed from Bundle).',
    ],
  },
  {
    version: '0.8.6', date: 'Apr 2026', label: 'Menu Manager v2: order-type pricing, modifier library, builder',
    changes: [
      'Pricing changed from per-menu to per-order-type: Base, Dine-in, Takeaway, Collection, Delivery.',
      'Modifier library: create modifiers centrally, add to groups on items.',
      'Interactive full-page builder: POS/Kiosk/Handheld preview, drag to reorder categories and items.',
      'Items tab: inline price editing for all order types in table rows.',
      'Modifiers tab: modifier library with category grouping and global overview.',
    ],
  },
  {
    version: '0.8.5', date: 'Apr 2026', label: 'Menu Manager fixes & Supabase init',
    changes: [
      'Fixed illegal useState inside .map() in CategoryRow — extracted to proper component.',
      'KDS uses kitchenName, receipts use receiptName, POS buttons use menuName.',
      'useSupabaseInit hook called from App on mount — loads menu, floor plan, 86 list, KDS, closed checks from DB.',
    ],
  },
  {
    version: '0.8.3', date: 'Apr 2026', label: 'Menu Manager rebuild: multiple menus, full item model',
    changes: [
      'Complete menu manager rebuild: multiple menus, hierarchical category tree with subcategories.',
      'Triple naming per item: Menu name (POS button), Receipt name, Kitchen name (KDS).',
      'Per-menu price overrides, modifier groups with min/max, pizza builder, scope (local/shared/global).',
      'Routing tab: production centre per item or inherited from category, course assignment.',
      'Visibility tab: toggle per channel (POS, Kiosk, Online, Delivery apps).',
    ],
  },
  {
    version: '0.8.2', date: 'Apr 2026', label: 'Inventory management + full Supabase write path',
    changes: [
      'Inventory section in Back Office: portion tracking, par counts, low/critical/out status bars.',
      '86 all out-of-stock quick action, bulk count modal.',
      'All store mutations wired to Supabase: menu items, floor tables, KDS tickets, closed checks, config pushes.',
    ],
  },
  {
    version: '0.8.0', date: 'Apr 2026', label: 'Supabase Phase 2: schema, DB layer, Realtime',
    changes: [
      '293-line Postgres schema: organisations, locations, menus, items, modifiers, floor plan, staff, orders, KDS, 86 list.',
      'db.js data access layer: fetchMenuItems, upsertMenuItem, fetch86List, fetchKDSTickets, insertClosedCheck, insertConfigPush.',
      'realtime.js: Postgres change subscriptions for KDS tickets, 86 list, and config pushes.',
      'toggle86 and bumpTicket wired to Supabase. Mock mode falls back to BroadcastChannel.',
    ],
  },
  {
    version: '0.7.9', date: 'Apr 2026', label: 'Modifier groups, kiosk surface, EOD close',
    changes: [
      'Modifier groups editor on items: name, required/optional, single/multi-select, options with prices.',
      'Kiosk surface (?t=kiosk): full customer-facing UI with category tabs, search, modifier picker, order confirmation.',
      'EOD Close: full shift summary, checklist, cash variance, manager notes, two-step confirm.',
      'Quick screen profile-aware: bar terminal prioritises bar/drinks items.',
    ],
  },
  {
    version: '0.7.5', date: 'Apr 2026', label: 'Back Office: Push to POS & config snapshot',
    changes: [
      '"Push to POS →" button in Back Office header — broadcasts config snapshot to all POS terminals.',
      'POS sync banner shown when BO pushes an update.',
      'Config snapshot persisted to localStorage and written to Supabase config_pushes table.',
    ],
  },
  {
    version: '0.7.0', date: 'Apr 2026', label: '⚙ Back Office Portal launched',
    changes: [
      'Full Back Office portal: Menu manager, Floor plan builder, Device profiles, Device registry, Staff & access, Print routing, Reports, EOD close.',
      'Device profiles: configure surface, order types, sections, features per terminal type.',
      'URL-based terminal selection (?t=counter/bar/handheld/kds/kiosk).',
      'BroadcastChannel cross-tab sync for operational data.',
    ],
  },
];




















export default function App() {
  const { staff, surface, setSurface, toast, shift, theme, setTheme, appMode, deviceConfig } = useStore();
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [syncPulse, setSyncPulse] = useState(false);

  useSupabaseInit(); // Load state from Supabase on mount (no-op in mock mode)

  const handleSyncPulse = useCallback(() => {
    setSyncPulse(true);
    setTimeout(() => setSyncPulse(false), 600);
  }, []);

  // Start Supabase Realtime on mount (no-op in mock mode)
  useEffect(() => {
    let cleanup;
    import('./lib/realtime.js').then(({ startRealtime }) => {
      import('./store/index.js').then(({ useStore: storeModule }) => {
        cleanup = startRealtime(storeModule);
      });
    }).catch(() => {});
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Device mode selection ─────────────────────────────────────────────
  // Priority: URL ?mode=X param > localStorage > first-visit selector
  // This lets users bookmark /app?mode=pos, /app?mode=office, /app?mode=admin
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  const storedMode = localStorage.getItem('rpos-device-mode');
  const deviceMode = isMock ? 'pos' : (urlMode || storedMode || null);

  // If URL param set, save to localStorage so it persists
  if (urlMode && urlMode !== storedMode) {
    localStorage.setItem('rpos-device-mode', urlMode);
  }

  // First visit — ask what this device is for
  if (!deviceMode) return (
    <ModeSelector
      onSelectPOS={() => { localStorage.setItem('rpos-device-mode', 'pos'); window.location.href = '?mode=pos'; }}
      onSelectBackOffice={() => { localStorage.setItem('rpos-device-mode', 'backoffice'); window.location.href = '?mode=office'; }}
      onSelectAdmin={() => { localStorage.setItem('rpos-device-mode', 'admin'); window.location.href = '?mode=admin'; }}
    />
  );

  // Company Admin — completely separate internal app
  if (deviceMode === 'admin') return <CompanyAdminApp />;

  // Back office mode — go to email login (no pairing needed)
  if (deviceMode === 'backoffice' || deviceMode === 'office') return <><SyncBridge onSyncPulse={handleSyncPulse}/><BackOfficeApp /></>;

  // POS mode — check if paired to a location
  const pairedDevice = (() => { try { return JSON.parse(localStorage.getItem('rpos-device') || 'null'); } catch { return null; } })();
  if (!pairedDevice) return <PairingScreen onPaired={() => window.location.reload()} />;

  // Validate device against Supabase (checks if admin removed it)
  // Uses a component so hooks work properly
  return <ValidatedPOSApp pairedDevice={pairedDevice} staff={staff} surface={surface} setSurface={setSurface} toast={toast} shift={shift} theme={theme} setTheme={setTheme} syncPulse={syncPulse} handleSyncPulse={handleSyncPulse} showWhatsNew={showWhatsNew} setShowWhatsNew={setShowWhatsNew} deviceConfig={deviceConfig} />;
}

function ValidatedPOSApp({ pairedDevice, staff, surface, setSurface, toast, shift, theme, setTheme, syncPulse, handleSyncPulse, showWhatsNew, setShowWhatsNew, deviceConfig }) {
  const [deviceValid, setDeviceValid] = useState(null); // null=checking, true=ok, false=revoked

  useEffect(() => {
    if (isMock) { setDeviceValid(true); return; }
    // Check device still active in Supabase AND refresh profile settings
    supabase.from('devices').select('id, status, profile_id, name').eq('id', pairedDevice.id).single().then(({ data }) => {
      if (!data || data.status === 'removed' || data.status === 'unpaired') {
        localStorage.removeItem('rpos-device');
        setDeviceValid(false);
      } else {
        // Refresh device name in case it was edited
        const current = JSON.parse(localStorage.getItem('rpos-device') || '{}');
        if (data.name !== current.name || data.profile_id !== current.profileId) {
          localStorage.setItem('rpos-device', JSON.stringify({ ...current, name: data.name, profileId: data.profile_id }));
        }
        // Refresh profile settings if profile changed
        if (data.profile_id) {
          try {
            const storedProfiles = JSON.parse(localStorage.getItem('rpos-device-profiles') || 'null');
            const DEFAULT_PROFILES = [
              { id:'prof-1', name:'Main counter', defaultSurface:'tables', enabledOrderTypes:['dine-in','takeaway','collection'], assignedSection:null, hiddenFeatures:[], tableServiceEnabled:true, quickScreenEnabled:true },
              { id:'prof-2', name:'Bar terminal', defaultSurface:'bar', enabledOrderTypes:['dine-in'], assignedSection:'bar', hiddenFeatures:['courses','kiosk','reports'], tableServiceEnabled:false, quickScreenEnabled:true },
              { id:'prof-3', name:'Server handheld', defaultSurface:'pos', enabledOrderTypes:['dine-in'], assignedSection:null, hiddenFeatures:['kiosk','reports'], tableServiceEnabled:true, quickScreenEnabled:true },
            ];
            const allProfiles = storedProfiles || DEFAULT_PROFILES;
            const profile = allProfiles.find(p => p.id === data.profile_id);
            if (profile) {
              localStorage.setItem('rpos-device-config', JSON.stringify({
                profileId: profile.id, profileName: profile.name,
                defaultSurface: profile.defaultSurface || 'tables',
                enabledOrderTypes: profile.enabledOrderTypes || ['dine-in'],
                assignedSection: profile.assignedSection || null,
                hiddenFeatures: profile.hiddenFeatures || [],
                tableServiceEnabled: profile.tableServiceEnabled !== false,
                quickScreenEnabled: profile.quickScreenEnabled !== false,
              }));
            }
          } catch(e) {}
        }
        setDeviceValid(true);
      }
    }).catch(() => setDeviceValid(true));
  }, []);

  if (deviceValid === null) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--t3)', fontSize:14 }}>
      Checking device…
    </div>
  );
  if (deviceValid === false) return <PairingScreen onPaired={() => window.location.reload()} />;

  if (!staff) return <><SyncBridge onSyncPulse={handleSyncPulse}/><PINScreen /></>;
  // Kiosk — full screen, no staff sidebar, no shift bar
  if (surface === 'kiosk' || deviceConfig?.defaultSurface === 'kiosk') return <><SyncBridge onSyncPulse={handleSyncPulse}/><KioskSurface /></>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <SyncBridge onSyncPulse={handleSyncPulse}/>
      <ShiftBar version={VERSION} onWhatsNew={()=>setShowWhatsNew(true)} theme={theme} onToggleTheme={()=>setTheme(theme==='dark'?'light':'dark')} syncPulse={syncPulse}/>
      <ConfigSyncBanner />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar surface={surface} setSurface={setSurface} />
        <div style={{ display:'flex', flex:1, overflow:'hidden', minWidth:0 }}>
          {surface==='tables'     && <TablesSurface />}
          {surface==='pos'        && <POSSurface />}
          {surface==='bar'        && <BarSurface />}
          {surface==='orders'     && <OrdersHub />}
          {surface==='kds'        && <KDSSurface />}
        </div>
      </div>
      {toast && <Toast toast={toast} />}
      {showWhatsNew && <WhatsNewModal onClose={()=>setShowWhatsNew(false)} />}
    </div>
  );
}

const NAV = [
  { id:'bar',     label:'Bar',    icon:'🍸' },
  { id:'tables',  label:'Floor',  icon:'⬚' },
  { id:'pos',     label:'POS',    icon:'⊞' },
  { id:'orders',  label:'Orders', icon:'📋' },
  { id:'kds',     label:'KDS',    icon:'▣' },
];

function ShiftBar({ version, onWhatsNew, theme, onToggleTheme, syncPulse }) {
  // Subscribe to closedChecks directly so shift stats re-render when checks are added
  const { deviceConfig, setSurface, orderQueue, tables, tabs, closedChecks, shift } = useStore();
  const pairedDevice = (() => { try { return JSON.parse(localStorage.getItem('rpos-device') || 'null'); } catch { return null; } })();
  const terminalName = deviceConfig?.terminalName || pairedDevice?.name || 'POS';
  // Resolve profile name from paired device's profileId
  const storedProfiles = (() => { try { return JSON.parse(localStorage.getItem('rpos-device-profiles') || 'null'); } catch { return null; } })();
  const DEFAULT_PROFILES = [
    { id:'prof-1', name:'Main counter' },
    { id:'prof-2', name:'Bar terminal' },
    { id:'prof-3', name:'Server handheld' },
  ];
  const allProfiles = storedProfiles || DEFAULT_PROFILES;
  const profileName = deviceConfig?.profileName
    || allProfiles.find(p => p.id === pairedDevice?.profileId)?.name
    || null;

  // Active order count for Orders Hub button
  const activeOrders = (orderQueue?.filter(o => !['collected','paid'].includes(o.status)).length || 0)
    + (tables?.filter(t => t.status !== 'available').length || 0)
    + (tabs?.filter(t => t.status !== 'closed').length || 0);
  const urlParam     = deviceConfig?.param;

  return (
    <div style={{ height:42, display:'flex', alignItems:'center', background:'var(--bg1)', borderBottom:'1px solid var(--bdr)', flexShrink:0 }}>
      {/* Logo */}
      <div style={{ width:'var(--nav)', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', borderRight:'1px solid var(--bdr)', flexShrink:0 }}>
        <div style={{ width:30, height:30, background:'var(--acc)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:900, color:'#0b0c10', fontFamily:'var(--font-mono)' }}>R</div>
      </div>

      {/* Terminal identity — LEFT, always visible */}
      <div style={{ padding:'0 16px 0 14px', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', justifyContent:'center', height:'100%', flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:800, color:'var(--t1)', letterSpacing:'-.01em', lineHeight:1 }}>{terminalName}</div>
        <div style={{ fontSize:9, fontWeight:700, color: profileName ? 'var(--acc)' : 'var(--t4)', marginTop:2, letterSpacing:'.04em', textTransform:'uppercase' }}>
          {profileName || 'No profile'}
          {urlParam && <span style={{ marginLeft:4, padding:'0 4px', background:'var(--bg3)', borderRadius:3, color:'var(--t4)', fontFamily:'var(--font-mono)', fontSize:8 }}>?t={urlParam}</span>}
        </div>
      </div>

      {/* Shift stats */}
      <div style={{ display:'flex', alignItems:'center', padding:'0 16px', flex:1, gap:0, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:20 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--grn)', boxShadow:'0 0 6px var(--grn)' }}/>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t1)' }}>{shift.name}</span>
          {/* Sync pulse — flashes amber when data syncs from another terminal */}
          {syncPulse && (
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--acc)', boxShadow:'0 0 8px var(--acc)', animation:'pulse .6s ease-out', opacity:1 }}/>
          )}
        </div>
        {[{label:'Covers',val:shift.covers},{label:'Sales',val:`£${shift.sales.toLocaleString()}`},{label:'Avg',val:`£${shift.avgCheck.toFixed(2)}`}].map(s=>(
          <div key={s.label} style={{ marginRight:20, display:'flex', alignItems:'baseline', gap:5 }}>
            <span style={{ fontSize:10, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em' }}>{s.label}</span>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--t2)', fontFamily:typeof s.val==='string'&&s.val.includes('£')?'var(--font-mono)':'inherit' }}>{s.val}</span>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 14px', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'var(--t4)', fontFamily:'var(--font-mono)' }}>
          {new Date().toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
        </div>
        <button onClick={onToggleTheme} style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:32, height:28, borderRadius:9, cursor:'pointer',
          background:'var(--bg3)', border:'1px solid var(--bdr)', fontFamily:'inherit',
          fontSize:15, color:'var(--t3)', transition:'all .14s',
        }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--bdr3)';e.currentTarget.style.color='var(--t1)';}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr)';e.currentTarget.style.color='var(--t3)';}}>
          {theme==='dark' ? '☀️' : '🌙'}
        </button>
        <button onClick={() => setSurface('orders')} style={{
          display:'flex', alignItems:'center', gap:6, padding:'4px 11px', borderRadius:20, cursor:'pointer',
          background: activeOrders > 0 ? 'var(--acc-d)' : 'var(--bg3)',
          border:`1px solid ${activeOrders > 0 ? 'var(--acc-b)' : 'var(--bdr)'}`,
          fontFamily:'inherit', fontSize:11, fontWeight:700,
          color: activeOrders > 0 ? 'var(--acc)' : 'var(--t3)',
          position:'relative', transition:'all .14s',
        }}>
          <span>📋 Orders</span>
          {activeOrders > 0 && (
            <span style={{ background:'var(--acc)', color:'#0b0c10', borderRadius:10, padding:'0 5px', fontSize:10, fontWeight:800 }}>
              {activeOrders}
            </span>
          )}
        </button>
        <button onClick={onWhatsNew} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, cursor:'pointer', background:'var(--bg3)', border:'1px solid var(--bdr)', fontFamily:'inherit', fontSize:11, fontWeight:700, color:'var(--t3)', transition:'all .14s' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--acc-b)';e.currentTarget.style.color='var(--acc)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--bdr)';e.currentTarget.style.color='var(--t3)';}}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10 }}>v{version}</span>
          <span style={{ color:'var(--bdr3)' }}>·</span>
          <span>What's new</span>
        </button>
      </div>
    </div>
  );
}

function WhatsNewModal({ onClose }) {
  const [selected, setSelected] = useState(CHANGELOG[0].version);
  const entry = CHANGELOG.find(c => c.version === selected) || CHANGELOG[0];
  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:'var(--bg2)', border:'1px solid var(--bdr2)', borderRadius:20,
        width:'100%', maxWidth:560, maxHeight:'80vh',
        display:'flex', flexDirection:'column', boxShadow:'var(--sh3)', overflow:'hidden',
      }}>
        {/* Header */}
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'var(--t1)' }}>What's new</div>
            <div style={{ fontSize:12, color:'var(--t3)', marginTop:2 }}>Restaurant OS · version history</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--t3)', cursor:'pointer', fontSize:22, lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
          {/* Version list */}
          <div style={{ width:160, flexShrink:0, borderRight:'1px solid var(--bdr)', overflowY:'auto', padding:'8px 0' }}>
            {CHANGELOG.map((c, i) => (
              <button key={c.version} onClick={()=>setSelected(c.version)} style={{
                width:'100%', padding:'10px 14px', textAlign:'left', cursor:'pointer',
                fontFamily:'inherit', border:'none', transition:'background .1s',
                background: selected===c.version ? 'var(--bg3)' : 'transparent',
                borderLeft: `2px solid ${selected===c.version ? 'var(--acc)' : 'transparent'}`,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <span style={{ fontSize:12, fontWeight:700, color: selected===c.version?'var(--acc)':'var(--t1)', fontFamily:'DM Mono, monospace' }}>v{c.version}</span>
                  {i===0 && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:20, background:'var(--acc)', color:'#0e0f14' }}>LATEST</span>}
                </div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{c.label}</div>
                <div style={{ fontSize:10, color:'var(--t4)', marginTop:1 }}>{c.date}</div>
              </button>
            ))}
          </div>

          {/* Changes detail */}
          <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4 }}>
              <span style={{ fontSize:20, fontWeight:800, color:'var(--t1)', fontFamily:'DM Mono, monospace' }}>v{entry.version}</span>
              <span style={{ fontSize:13, color:'var(--acc)', fontWeight:600 }}>{entry.label}</span>
            </div>
            <div style={{ fontSize:11, color:'var(--t4)', marginBottom:16 }}>{entry.date}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {entry.changes.map((change, i) => (
                <div key={i} style={{ display:'flex', gap:10, padding:'8px 12px', background:'var(--bg3)', borderRadius:8, border:'1px solid var(--bdr)' }}>
                  <span style={{ color:'var(--acc)', fontWeight:700, flexShrink:0, marginTop:1 }}>✓</span>
                  <span style={{ fontSize:13, color:'var(--t2)', lineHeight:1.5 }}>{change}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ surface, setSurface }) {
  const { setAppMode, syncStatus, deviceConfig } = useStore();
  const [showStatus, setShowStatus] = useState(false);

  const hidden = deviceConfig?.hiddenFeatures || [];
  const allOk = syncStatus.printerOnline && syncStatus.paymentTerminalOnline && !syncStatus.pendingChanges;

  const FEATURE_MAP = { kds:'kds', reports:'backoffice' };
  const visibleNav = NAV.filter(n => {
    const featureKey = Object.entries(FEATURE_MAP).find(([,v]) => v === n.id)?.[0];
    return !featureKey || !hidden.includes(featureKey);
  });

  return (
    <>
    <nav style={{ width:'var(--nav)', background:'var(--bg1)', borderRight:'1px solid var(--bdr)', display:'flex', flexDirection:'column', alignItems:'center', padding:'10px 0', gap:2, flexShrink:0 }}>
      {visibleNav.map(n=>{
        const active=surface===n.id;
        return(<button key={n.id} onClick={()=>setSurface(n.id)} style={{ width:46, height:46, borderRadius:10, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, background:active?'var(--acc-d)':'transparent', border:`1px solid ${active?'var(--acc-b)':'transparent'}`, color:active?'var(--acc)':'var(--t3)', transition:'all .15s', fontFamily:'inherit', position:'relative' }}>
          <span style={{ fontSize:18, lineHeight:1 }}>{n.icon}</span>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em', color:active?'var(--acc)':'var(--t3)' }}>{n.label}</span>
        </button>);
      })}

      {/* Divider */}
      <div style={{ width:32, height:1, background:'var(--bdr)', margin:'4px 0' }}/>

      {/* Status button — shows dot if anything offline or pending */}
      <button onClick={() => setShowStatus(true)} title="Terminal status" style={{
        width:46, height:46, borderRadius:10, cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
        background:'transparent', border:'1px solid transparent',
        color: allOk ? 'var(--t3)' : 'var(--acc)', transition:'all .15s', fontFamily:'inherit',
        position:'relative',
      }}
      onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
        <span style={{ fontSize:17, lineHeight:1 }}>⊙</span>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em' }}>Status</span>
        {!allOk && <div style={{ position:'absolute', top:6, right:8, width:7, height:7, borderRadius:'50%', background:'var(--acc)', boxShadow:'0 0 6px var(--acc)' }}/>}
        {!deviceConfig && <div style={{ position:'absolute', top:6, right:8, width:7, height:7, borderRadius:'50%', background:'var(--red)', boxShadow:'0 0 6px var(--red)' }}/>}
      </button>

      {/* Back Office button */}
      <button onClick={() => { window.location.href = "?mode=office"; }} title="Back Office" style={{
        width:46, height:46, borderRadius:10, cursor:'pointer',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
        background:'transparent', border:'1px solid transparent',
        color:'var(--t3)', transition:'all .15s', fontFamily:'inherit',
      }}
      onMouseEnter={e=>{e.currentTarget.style.background='var(--bg3)';e.currentTarget.style.color='var(--t1)';}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--t3)';}}>
        <span style={{ fontSize:17, lineHeight:1 }}>⚙</span>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.04em' }}>Office</span>
      </button>

      <div style={{ marginTop:'auto' }}><StaffAvatar /></div>
    </nav>

    {showStatus && <StatusDrawer onClose={() => setShowStatus(false)} />}
    </>
  );
}

function StaffAvatar() {
  const [open,setOpen]=useState(false);
  const { staff, logout }=useStore();
  if (!staff) return null;
  return(
    <div style={{ position:'relative', marginBottom:8 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ width:34, height:34, borderRadius:'50%', cursor:'pointer', background:staff.color+'22', border:`2px solid ${staff.color}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:staff.color }}>{staff.initials}</div>
      {open&&(<div style={{ position:'absolute', bottom:42, left:0, background:'var(--bg3)', border:'1px solid var(--bdr2)', borderRadius:12, padding:8, minWidth:160, boxShadow:'var(--sh3)', zIndex:50 }}>
        <div style={{ padding:'6px 10px', fontSize:13, fontWeight:600, color:'var(--t1)' }}>{staff.name}</div>
        <div style={{ padding:'2px 10px 8px', fontSize:12, color:'var(--t3)' }}>{staff.role}</div>
        <div style={{ height:1, background:'var(--bdr)', margin:'4px 0' }}/>
        <button onClick={()=>{logout();setOpen(false);}} style={{ width:'100%', padding:'7px 10px', borderRadius:8, cursor:'pointer', background:'transparent', border:'none', color:'var(--red)', fontSize:13, textAlign:'left', fontFamily:'inherit', fontWeight:500 }}>Sign out</button>
      </div>)}
    </div>
  );
}

function Toast({ toast }) {
  const map={success:{bg:'var(--grn-d)',bdr:'var(--grn-b)',color:'var(--grn)'},error:{bg:'var(--red-d)',bdr:'var(--red-b)',color:'var(--red)'},warning:{bg:'var(--acc-d)',bdr:'var(--acc-b)',color:'var(--acc)'},info:{bg:'var(--bg3)',bdr:'var(--bdr2)',color:'var(--t1)'}};
  const c=map[toast.type]||map.info;
  return <div className="toast" key={toast.key} style={{ background:c.bg, border:`1px solid ${c.bdr}`, color:c.color }}>{toast.msg}</div>;
}
