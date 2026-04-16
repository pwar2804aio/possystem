/**
 * Restaurant OS — AI Tool Executor
 * Runs tool calls returned by the AI, reading data from Supabase.
 * Write tools return a "pending" action — the user must confirm before execution.
 */

import { supabase, getLocationId } from './supabase';

// Tools that require user confirmation before executing
export const WRITE_TOOLS = new Set(['add_menu_item', 'update_item_price', 'eighty_six_item']);

/**
 * Execute a tool call from the AI.
 * Returns { result, pendingAction? }
 * If pendingAction is set, show it to the user for confirmation before calling executePendingAction().
 */
export async function executeTool(toolName, toolInput, storeState = {}) {
  const locationId = await getLocationId();

  switch (toolName) {

    case 'get_sales_summary': {
      const { closedChecks = [] } = storeState;
      // Only today's checks — since midnight local time
      const sod = new Date(); sod.setHours(0, 0, 0, 0);
      const checks = closedChecks.filter(c => c.closedAt && new Date(c.closedAt) >= sod);
      const revenue = checks.reduce((s, c) => s + (c.total || 0), 0);
      const covers  = checks.reduce((s, c) => s + (c.covers || 1), 0);
      const tips    = checks.reduce((s, c) => s + (c.tip || 0), 0);
      const card    = checks.filter(c => c.method === 'card').reduce((s, c) => s + c.total, 0);
      const cash    = checks.filter(c => c.method === 'cash').reduce((s, c) => s + c.total, 0);
      const avg     = checks.length ? revenue / checks.length : 0;
      return {
        result: {
          period: 'today',
          checks: checks.length,
          revenue: `£${revenue.toFixed(2)}`,
          covers,
          average_check: `£${avg.toFixed(2)}`,
          tips: `£${tips.toFixed(2)}`,
          card: `£${card.toFixed(2)}`,
          cash: `£${cash.toFixed(2)}`,
        },
      };
    }

    case 'get_top_items': {
      const { closedChecks = [] } = storeState;
      const limit = Math.min(toolInput.limit || 5, 10);
      const sod = new Date(); sod.setHours(0, 0, 0, 0);
      const checks = closedChecks.filter(c => c.closedAt && new Date(c.closedAt) >= sod);
      const itemMap = {};
      checks.forEach(c => (c.items || []).forEach(i => {
        itemMap[i.name] = (itemMap[i.name] || { qty: 0, revenue: 0 });
        itemMap[i.name].qty     += (i.qty || 1);
        itemMap[i.name].revenue += (i.price || 0) * (i.qty || 1);
      }));
      const top = Object.entries(itemMap)
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, limit)
        .map(([name, data]) => ({ name, qty: data.qty, revenue: `£${data.revenue.toFixed(2)}` }));
      return { result: { period: 'today', items: top } };
    }

    case 'get_printer_status': {
      if (!supabase || !locationId) return { result: { error: 'Not connected' } };
      const [{ data: health }, { data: agents }] = await Promise.all([
        supabase.from('printer_health').select('*').eq('location_id', locationId),
        supabase.from('printer_agents').select('*').eq('location_id', locationId),
      ]);
      const now = Date.now();
      const printers = (health || []).map(h => ({
        printer_id:   h.printer_id,
        status:       h.status,
        last_success: h.last_success_at ? `${Math.round((now - new Date(h.last_success_at)) / 60000)}min ago` : 'never',
        last_error:   h.last_error || null,
        failures:     h.consecutive_failures || 0,
      }));
      const agent = agents?.[0];
      const agentStatus = agent
        ? { hostname: agent.hostname, last_seen: `${Math.round((now - new Date(agent.last_seen)) / 1000)}s ago`, status: agent.status }
        : { status: 'not detected — is the print agent running?' };
      return { result: { printers, agent: agentStatus } };
    }

    case 'get_allergen_info': {
      const { menuItems = [] } = storeState;
      const query = toolInput.item_name?.toLowerCase() || '';
      const item = menuItems.find(i => i.name?.toLowerCase().includes(query));
      if (!item) return { result: { error: `No menu item found matching "${toolInput.item_name}"` } };
      return {
        result: {
          name:      item.name,
          allergens: item.allergens?.length ? item.allergens.join(', ') : 'None declared',
          contains:  item.allergens || [],
        },
      };
    }

    case 'get_floor_status': {
      const { tables = [], activeSessions = {} } = storeState;
      const occupied  = tables.filter(t => activeSessions[t.id]?.items?.length > 0).length;
      const available = tables.length - occupied;
      return {
        result: { total_tables: tables.length, occupied, available },
      };
    }

    case 'get_menu_items': {
      const { menuItems = [], menuCategories = [] } = storeState;
      const catFilter = toolInput.category?.toLowerCase();
      let items = menuItems.filter(i => !i.archived);
      if (catFilter) {
        const cat = menuCategories.find(c => c.name?.toLowerCase().includes(catFilter));
        if (cat) items = items.filter(i => i.categoryId === cat.id);
      }
      return {
        result: {
          count: items.length,
          items: items.slice(0, 30).map(i => ({
            id:       i.id,
            name:     i.name,
            price:    `£${(i.price || 0).toFixed(2)}`,
            category: menuCategories.find(c => c.id === i.categoryId)?.name || 'Unknown',
          })),
        },
      };
    }

    case 'get_order_history': {
      if (!supabase || !locationId) return { result: { error: 'Not connected' } };
      const limit = Math.min(toolInput.limit || 10, 50);
      const { data } = await supabase
        .from('closed_checks')
        .select('id, total, covers, method, closed_at, tip')
        .eq('location_id', locationId)
        .order('closed_at', { ascending: false })
        .limit(limit);
      const orders = (data || []).map(o => ({
        id:     o.id?.slice(0, 8),
        total:  `£${(o.total || 0).toFixed(2)}`,
        covers: o.covers,
        method: o.method,
        tip:    o.tip ? `£${o.tip.toFixed(2)}` : null,
        time:   o.closed_at ? new Date(o.closed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '?',
      }));
      return { result: { orders } };
    }

    // ── Write tools — return pendingAction, don't execute yet ──────────────────

    case 'add_menu_item': {
      const { menuCategories = [] } = storeState;
      const cat = menuCategories.find(c => c.id === toolInput.category_id);
      return {
        result: {
          preview: true,
          message: `Proposed new item — awaiting your confirmation`,
          item: {
            name:     toolInput.name,
            price:    `£${Number(toolInput.price).toFixed(2)}`,
            category: cat?.name || toolInput.category_id,
          },
        },
        pendingAction: {
          type:    'add_menu_item',
          label:   `Add "${toolInput.name}" at £${Number(toolInput.price).toFixed(2)} to ${cat?.name || 'menu'}`,
          payload: toolInput,
        },
      };
    }

    case 'update_item_price': {
      const { menuItems = [] } = storeState;
      const item = menuItems.find(i => i.id === toolInput.item_id);
      const oldPrice = item ? `£${(item.price || 0).toFixed(2)}` : 'unknown';
      return {
        result: {
          preview: true,
          message: `Proposed price change — awaiting your confirmation`,
          change: {
            item:      toolInput.item_name || item?.name || toolInput.item_id,
            old_price: oldPrice,
            new_price: `£${Number(toolInput.new_price).toFixed(2)}`,
          },
        },
        pendingAction: {
          type:    'update_item_price',
          label:   `Change ${item?.name || toolInput.item_id} from ${oldPrice} to £${Number(toolInput.new_price).toFixed(2)}`,
          payload: toolInput,
        },
      };
    }

    case 'eighty_six_item': {
      return {
        result: {
          preview: true,
          message: `Proposed 86 — awaiting your confirmation`,
          item: toolInput.item_name || toolInput.item_id,
        },
        pendingAction: {
          type:    'eighty_six_item',
          label:   `86 "${toolInput.item_name || toolInput.item_id}" — mark as sold out`,
          payload: toolInput,
        },
      };
    }

    case 'get_current_order': {
      const { tables = [], activeTableId, activeSessions = {} } = storeState;
      const activeTable = tables.find(t => t.id === activeTableId);
      const session = activeTableId ? (activeSessions[activeTableId] || activeTable?.session) : null;
      const items = session?.items || [];
      if (!activeTableId || !items.length) {
        return { result: { active: false, message: 'No active order open. Open a table or start a new order on the POS first.' } };
      }
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      return {
        result: {
          active: true,
          table: activeTable?.label || activeTableId,
          item_count: items.length,
          items: items.map(i => ({ name: i.name, qty: i.qty, price: `£${i.price.toFixed(2)}`, notes: i.notes || null })),
          subtotal: `£${subtotal.toFixed(2)}`,
        },
      };
    }

    case 'add_to_order': {
      const { menuItems = [], tables = [], activeTableId } = storeState;
      const activeTable = tables.find(t => t.id === activeTableId);
      if (!activeTableId) {
        return { result: { error: 'No active order — staff must open a table or start an order on the POS first.' } };
      }
      const query = toolInput.item_name?.toLowerCase() || '';
      const item = menuItems.find(i => i.name?.toLowerCase() === query)
                || menuItems.find(i => i.name?.toLowerCase().includes(query));
      if (!item) {
        return { result: { error: `No menu item found matching "${toolInput.item_name}". Check the menu and try again.` } };
      }
      const qty = toolInput.qty || 1;
      return {
        result: {
          preview: true,
          message: 'Proposed order addition — awaiting confirmation',
          item: { name: item.name, price: `£${item.price.toFixed(2)}`, qty, notes: toolInput.notes || null },
          table: activeTable?.label || activeTableId,
          total: `£${(item.price * qty).toFixed(2)}`,
        },
        pendingAction: {
          type:  'add_to_order',
          label: `Add ${qty}× ${item.name} (£${item.price.toFixed(2)}) to ${activeTable?.label || 'current order'}${toolInput.notes ? ` — note: "${toolInput.notes}"` : ''}`,
          payload: { item, qty, notes: toolInput.notes || '' },
        },
      };
    }

    case 'apply_order_discount': {
      const { tables = [], activeTableId } = storeState;
      const activeTable = tables.find(t => t.id === activeTableId);
      if (!activeTableId) {
        return { result: { error: 'No active order open.' } };
      }
      const display = toolInput.type === 'percent'
        ? `${toolInput.value}% off`
        : `£${Number(toolInput.value).toFixed(2)} off`;
      return {
        result: {
          preview: true,
          message: 'Proposed discount — awaiting confirmation',
          discount: display,
          reason: toolInput.reason,
          table: activeTable?.label || activeTableId,
        },
        pendingAction: {
          type:  'apply_order_discount',
          label: `Apply ${display} to ${activeTable?.label || 'current order'} — reason: ${toolInput.reason}`,
          payload: { ...toolInput, tableId: activeTableId },
        },
      };
    }

    default:
      return { result: { error: `Unknown tool: ${toolName}` } };
  }
}

/**
 * Execute a confirmed write action.
 * Only called after the user explicitly confirms.
 */
export async function executeConfirmedAction(action, storeActions = {}) {
  const { type, payload } = action;

  switch (type) {
    case 'add_menu_item': {
      const { addMenuItem } = storeActions;
      if (!addMenuItem) return { ok: false, error: 'Not available' };
      const newItem = {
        id:         `item-ai-${Date.now()}`,
        name:       payload.name,
        price:      Number(payload.price),
        categoryId: payload.category_id,
        description: payload.description || '',
        allergens:  [],
        archived:   false,
      };
      await addMenuItem(newItem);
      return { ok: true, message: `"${payload.name}" added to the menu at £${Number(payload.price).toFixed(2)}` };
    }

    case 'update_item_price': {
      const { updateMenuItem } = storeActions;
      if (!updateMenuItem) return { ok: false, error: 'Not available' };
      await updateMenuItem(payload.item_id, { price: Number(payload.new_price) });
      return { ok: true, message: `Price updated to £${Number(payload.new_price).toFixed(2)}` };
    }

    case 'eighty_six_item': {
      const { toggle86 } = storeActions;
      if (!toggle86) return { ok: false, error: 'Not available' };
      toggle86(payload.item_id);
      return { ok: true, message: `"${payload.item_name}" has been 86'd` };
    }

    case 'add_to_order': {
      const { addItem } = storeActions;
      if (!addItem) return { ok: false, error: 'Not available' };
      addItem(payload.item, [], null, { qty: payload.qty || 1, notes: payload.notes || '' });
      return { ok: true, message: `${payload.qty || 1}× ${payload.item.name} added to the order` };
    }

    case 'apply_order_discount': {
      const { applyDiscount } = storeActions;
      if (!applyDiscount) return { ok: false, error: 'Discount not available' };
      applyDiscount({ type: payload.type, value: payload.value, reason: payload.reason, tableId: payload.tableId });
      const display = payload.type === 'percent' ? `${payload.value}%` : `£${Number(payload.value).toFixed(2)}`;
      return { ok: true, message: `${display} discount applied — ${payload.reason}` };
    }

    default:
      return { ok: false, error: 'Unknown action type' };
  }
}
