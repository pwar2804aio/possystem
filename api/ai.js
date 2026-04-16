/**
 * Restaurant OS — AI API Proxy
 * Keeps the Anthropic API key server-side.
 * Validates requests so only allowed tools can be called.
 */

// Tools the AI is allowed to call — hardcoded server-side
// This is the security boundary. No client-side request can expand this list.
const ALLOWED_TOOLS_FOH = [
  'get_sales_summary',
  'get_top_items',
  'get_printer_status',
  'get_allergen_info',
  'get_floor_status',
  'get_current_order',
  'add_to_order',
  'apply_order_discount',
  'eighty_six_item',
];

const ALLOWED_TOOLS_BOH = [
  'get_sales_summary',
  'get_top_items',
  'get_printer_status',
  'get_allergen_info',
  'get_menu_items',
  'get_order_history',
  'add_menu_item',
  'update_item_price',
];

const TOOL_DEFINITIONS = {
  get_sales_summary: {
    name: 'get_sales_summary',
    description: 'Get a summary of sales for today including revenue, cover count, check count, and payment breakdown.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  get_top_items: {
    name: 'get_top_items',
    description: 'Get the top selling menu items by quantity sold today.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Number of items to return (default 5, max 10)' } },
      required: [],
    },
  },
  get_printer_status: {
    name: 'get_printer_status',
    description: 'Check the current status of all printers and the print agent. Returns online/offline status, last success time, and any error messages.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  get_allergen_info: {
    name: 'get_allergen_info',
    description: 'Get allergen information for a specific menu item by name.',
    input_schema: {
      type: 'object',
      properties: { item_name: { type: 'string', description: 'The name of the menu item' } },
      required: ['item_name'],
    },
  },
  get_floor_status: {
    name: 'get_floor_status',
    description: 'Get current table and floor status — how many tables are occupied, waiting, available.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  get_menu_items: {
    name: 'get_menu_items',
    description: 'List all menu items with their prices, categories, and availability status.',
    input_schema: {
      type: 'object',
      properties: { category: { type: 'string', description: 'Filter by category name (optional)' } },
      required: [],
    },
  },
  get_order_history: {
    name: 'get_order_history',
    description: 'Get recent order history with check totals, items, and payment methods.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Number of recent orders to return (default 10, max 50)' } },
      required: [],
    },
  },
  add_menu_item: {
    name: 'add_menu_item',
    description: 'Propose adding a new menu item. This returns a preview for the user to confirm before anything is created. NEVER call this without user explicitly asking to add an item.',
    input_schema: {
      type: 'object',
      properties: {
        name:        { type: 'string',  description: 'Item name' },
        price:       { type: 'number',  description: 'Price in GBP' },
        category_id: { type: 'string',  description: 'Category ID to add item to' },
        description: { type: 'string',  description: 'Brief item description (optional)' },
      },
      required: ['name', 'price', 'category_id'],
    },
  },
  update_item_price: {
    name: 'update_item_price',
    description: 'Propose updating the price of an existing menu item. Returns a preview for the user to confirm. NEVER call this without the user explicitly asking to change a price.',
    input_schema: {
      type: 'object',
      properties: {
        item_id:   { type: 'string', description: 'The menu item ID' },
        item_name: { type: 'string', description: 'The menu item name (for display)' },
        new_price: { type: 'number', description: 'New price in GBP' },
      },
      required: ['item_id', 'new_price'],
    },
  },
  eighty_six_item: {
    name: 'eighty_six_item',
    description: 'Propose marking a menu item as sold out (86\'d). Returns a preview for the user to confirm.',
    input_schema: {
      type: 'object',
      properties: {
        item_id:   { type: 'string', description: 'The menu item ID' },
        item_name: { type: 'string', description: 'The menu item name (for display)' },
      },
      required: ['item_id', 'item_name'],
    },
  },
  get_current_order: {
    name: 'get_current_order',
    description: 'Get the items currently in the active order / checkout. Use this before adding items to understand what is already on the order.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  add_to_order: {
    name: 'add_to_order',
    description: 'Propose adding a menu item to the current active order. Always call get_current_order first to confirm what table/order is active. Requires confirmation before adding.',
    input_schema: {
      type: 'object',
      properties: {
        item_name: { type: 'string', description: 'The name of the item to add (will be matched against the menu)' },
        qty:       { type: 'number', description: 'Quantity to add (default 1)' },
        notes:     { type: 'string', description: 'Special instructions or notes for this item (optional)' },
      },
      required: ['item_name'],
    },
  },
  apply_order_discount: {
    name: 'apply_order_discount',
    description: 'Propose applying a discount to the current order. Requires confirmation. Only use when explicitly asked by staff.',
    input_schema: {
      type: 'object',
      properties: {
        type:   { type: 'string', enum: ['percent', 'fixed'], description: 'Discount type: percent (e.g. 10%) or fixed amount (e.g. £5 off)' },
        value:  { type: 'number', description: 'Discount value — percentage (0-100) or fixed GBP amount' },
        reason: { type: 'string', description: 'Reason for the discount (e.g. "staff discount", "manager comp")' },
      },
      required: ['type', 'value', 'reason'],
    },
  },
};

const SYSTEM_FOH = `You are an AI shift assistant for front-of-house restaurant staff. You help during live service.

PERSONALITY: Brief, practical, direct. Staff are busy — no waffle.

WHAT YOU CAN DO:
- Answer questions about today's sales, covers, and top-selling items
- Look up allergen information for menu items
- Check if printers are online
- Check table and floor status
- View the current order (always call get_current_order first before adding anything)
- Add items to the current active order — always confirm before doing this
- Apply discounts to the current order — always confirm, always capture a reason
- Mark items as sold out (86) — always confirm before doing this

CHECKOUT RULES:
- Always call get_current_order first to confirm a table is open before adding items
- If no order is active, tell staff to open a table on the POS first
- Never add more than 5 items in one go
- Flag discounts over 50% as unusual and ask for manager confirmation

HARD LIMITS — you MUST NOT:
- Delete anything
- Change menu prices
- Modify the menu (add/remove items)
- Access data beyond today's shift
- Discuss anything unrelated to the restaurant

Always use £ for currency. Keep responses brief — staff are busy.`;

const SYSTEM_BOH = `You are an AI assistant for restaurant managers using the back office system. You help with reporting, menu management, and operational questions.

PERSONALITY: Professional, helpful, data-driven. Present numbers clearly.

WHAT YOU CAN DO:
- Answer detailed reporting questions (revenue, top items, order history, payment breakdown)
- Look up allergen information
- Check printer and system status
- Browse and discuss the menu
- PROPOSE adding new menu items — always show a preview and wait for explicit confirmation
- PROPOSE price changes — always show a preview and wait for explicit confirmation

HARD LIMITS — you MUST NOT under any circumstances:
- Delete any items, orders, checks, or data of any kind
- Make bulk changes to the menu (change multiple prices at once, delete categories, etc.)
- Change table layouts or floor plans
- Modify printer configurations
- Access or discuss staff PIN codes
- Process refunds
- Make any change without explicit user confirmation

For any write action (add item, change price): you MUST use the appropriate tool to generate a preview, then STOP and ask the user to confirm before proceeding. Never assume confirmation.

Always use £ for currency. Format numbers clearly.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI not configured — ANTHROPIC_API_KEY not set' });
  }

  const { messages, mode = 'foh', tool_results } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const allowedTools = mode === 'boh' ? ALLOWED_TOOLS_BOH : ALLOWED_TOOLS_FOH;
  const tools = allowedTools.map(name => TOOL_DEFINITIONS[name]).filter(Boolean);
  const systemPrompt = mode === 'boh' ? SYSTEM_BOH : SYSTEM_FOH;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
