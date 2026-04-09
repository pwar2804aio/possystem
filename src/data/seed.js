// ─── Allergens (all 14 EU mandatory) ─────────────────────────────────────────
export const ALLERGENS = [
  { id: 'gluten',      label: 'Gluten',       icon: 'G',  short: 'Glu' },
  { id: 'crustaceans', label: 'Crustaceans',  icon: 'C',  short: 'Cru' },
  { id: 'eggs',        label: 'Eggs',         icon: 'E',  short: 'Egg' },
  { id: 'fish',        label: 'Fish',         icon: 'F',  short: 'Fsh' },
  { id: 'peanuts',     label: 'Peanuts',      icon: 'P',  short: 'Pnt' },
  { id: 'soy',         label: 'Soy',          icon: 'S',  short: 'Soy' },
  { id: 'milk',        label: 'Milk',         icon: 'M',  short: 'Mlk' },
  { id: 'nuts',        label: 'Tree nuts',    icon: 'N',  short: 'Nut' },
  { id: 'celery',      label: 'Celery',       icon: 'Ce', short: 'Cel' },
  { id: 'mustard',     label: 'Mustard',      icon: 'Mu', short: 'Mst' },
  { id: 'sesame',      label: 'Sesame',       icon: 'Se', short: 'Ses' },
  { id: 'sulphites',   label: 'Sulphites',    icon: 'Su', short: 'Sul' },
  { id: 'lupin',       label: 'Lupin',        icon: 'L',  short: 'Lup' },
  { id: 'molluscs',    label: 'Molluscs',     icon: 'Mo', short: 'Mol' },
];

// ─── Staff ───────────────────────────────────────────────────────────────────
export const STAFF = [
  { id: 's1', name: 'Alex',  role: 'manager',   pin: '1234', color: '#f0a500', initials: 'AL' },
  { id: 's2', name: 'Sarah', role: 'server',    pin: '2345', color: '#3b82f6', initials: 'SA' },
  { id: 's3', name: 'Tom',   role: 'server',    pin: '3456', color: '#a855f7', initials: 'TM' },
  { id: 's4', name: 'Maria', role: 'bartender', pin: '4567', color: '#22c55e', initials: 'MA' },
];

// ─── Production centres ───────────────────────────────────────────────────────
export const PRODUCTION_CENTRES = [
  { id: 'pc1', name: 'Hot kitchen',  type: 'kitchen', printerId: 'pr1', icon: '🔥' },
  { id: 'pc2', name: 'Cold section', type: 'kitchen', printerId: 'pr2', icon: '❄️' },
  { id: 'pc3', name: 'Pizza oven',   type: 'kitchen', printerId: 'pr1', icon: '🍕' },
  { id: 'pc4', name: 'Bar',          type: 'bar',     printerId: 'pr3', icon: '🍸' },
  { id: 'pc5', name: 'Expo',         type: 'expo',    printerId: 'pr4', icon: '📋' },
];

// ─── Printers ─────────────────────────────────────────────────────────────────
export const PRINTERS = [
  { id: 'pr1', name: 'Hot kitchen',  model: 'NT311', ip: '192.168.1.101', status: 'online',  centre: 'pc1' },
  { id: 'pr2', name: 'Cold section', model: 'NT311', ip: '192.168.1.102', status: 'online',  centre: 'pc2' },
  { id: 'pr3', name: 'Bar',          model: 'NT311', ip: '192.168.1.103', status: 'online',  centre: 'pc4' },
  { id: 'pr4', name: 'Expo / pass',  model: 'NT311', ip: '192.168.1.104', status: 'offline', centre: 'pc5' },
];

// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES = [
  { id: 'quick',     label: 'Quick screen', isSpecial: true },
  { id: 'starters',  label: 'Starters' },
  { id: 'mains',     label: 'Mains' },
  { id: 'pizza',     label: 'Pizza',    hasPizzaBuilder: true },
  { id: 'sides',     label: 'Sides' },
  { id: 'desserts',  label: 'Desserts' },
  { id: 'drinks',    label: 'Drinks' },
  { id: 'cocktails', label: 'Cocktails' },
];

// ─── Pizza toppings ───────────────────────────────────────────────────────────
export const PIZZA_TOPPINGS = [
  { id: 'pep',     name: 'Pepperoni',      color: '#ef4444', price: 1.5, allergens: [] },
  { id: 'mush',    name: 'Mushrooms',      color: '#78716c', price: 1.5, allergens: [] },
  { id: 'cheese',  name: 'Extra cheese',   color: '#eab308', price: 1.5, allergens: ['milk'] },
  { id: 'olive',   name: 'Olives',         color: '#4d7c0f', price: 1.5, allergens: [] },
  { id: 'pepper',  name: 'Peppers',        color: '#dc2626', price: 1.5, allergens: [] },
  { id: 'onion',   name: 'Red onion',      color: '#9333ea', price: 1.5, allergens: [] },
  { id: 'jalapeno',name: 'Jalapeño',       color: '#16a34a', price: 1.5, allergens: [] },
  { id: 'anchovy', name: 'Anchovy',        color: '#92400e', price: 1.5, allergens: ['fish'] },
  { id: 'basil',   name: 'Fresh basil',    color: '#15803d', price: 1.0, allergens: [] },
  { id: 'chicken', name: 'BBQ chicken',    color: '#d97706', price: 2.0, allergens: [] },
  { id: 'nduja',   name: 'Nduja',          color: '#b91c1c', price: 2.5, allergens: [] },
  { id: 'truffle', name: 'Truffle oil',    color: '#44403c', price: 3.0, allergens: [] },
];

export const PIZZA_BASES = [
  { id: 'tomato', name: 'Tomato base',  allergens: [] },
  { id: 'white',  name: 'White base',   allergens: ['milk'] },
  { id: 'pesto',  name: 'Pesto base',   allergens: ['nuts', 'milk'] },
  { id: 'bbq',    name: 'BBQ base',     allergens: [] },
];

export const PIZZA_CRUSTS = [
  { id: 'thin',    name: 'Classic thin',   extra: 0 },
  { id: 'deep',    name: 'Deep pan',       extra: 0 },
  { id: 'stuffed', name: 'Stuffed crust',  extra: 2.0, allergens: ['gluten', 'milk'] },
  { id: 'gf',      name: 'Gluten-free',    extra: 2.5, allergens: [] },
];

export const PIZZA_SIZES = [
  { id: 'personal', name: 'Personal 9"',  basePrice: 10 },
  { id: 'large',    name: 'Large 12"',    basePrice: 14 },
  { id: 'xl',       name: 'XL 14"',       basePrice: 18 },
];

// ─── Menu items ───────────────────────────────────────────────────────────────
export const MENU_ITEMS = [
  // Starters
  { id: 'm1',  name: 'Bruschetta',         cat: 'starters',  price: 8.00,  allergens: ['gluten','milk'],       centre: 'pc2', sales: 312, description: 'Toasted sourdough, heritage tomatoes, basil oil' },
  { id: 'm2',  name: 'Burrata',            cat: 'starters',  price: 12.00, allergens: ['milk'],                centre: 'pc2', sales: 287, description: 'Fresh burrata, heirloom tomatoes, aged balsamic' },
  { id: 'm3',  name: 'Prawn cocktail',     cat: 'starters',  price: 11.00, allergens: ['crustaceans','eggs','milk'], centre: 'pc2', sales: 198, description: 'Tiger prawns, Marie Rose, gem lettuce' },
  { id: 'm4',  name: 'Soup of the day',   cat: 'starters',  price: 7.50,  allergens: ['gluten','milk','celery'], centre: 'pc1', sales: 145, description: 'Ask your server for today\'s soup' },
  { id: 'm5',  name: 'Charcuterie board', cat: 'starters',  price: 16.00, allergens: ['gluten','milk'],       centre: 'pc2', sales: 220, description: 'Selection of cured meats, cornichons, mustard' },

  // Mains
  { id: 'm6',  name: 'Carbonara',         cat: 'mains',    price: 14.50, allergens: ['gluten','eggs','milk'],  centre: 'pc1', sales: 445, description: 'Spaghetti, pancetta, Pecorino Romano, egg yolk', mods: 'steak_style' },
  { id: 'm7',  name: 'Ribeye steak 8oz',  cat: 'mains',    price: 32.00, allergens: [],                       centre: 'pc1', sales: 398, description: 'Dry-aged ribeye, triple-cooked chips, watercress', mods: 'steak' },
  { id: 'm8',  name: 'Sea bass',          cat: 'mains',    price: 26.00, allergens: ['fish'],                  centre: 'pc1', sales: 267, description: 'Pan-fried, samphire, lemon butter, new potatoes' },
  { id: 'm9',  name: 'Wild mushroom risotto', cat: 'mains', price: 18.00, allergens: ['milk'],               centre: 'pc1', sales: 234, description: 'Arborio rice, wild mushrooms, truffle oil, Parmesan' },
  { id: 'm10', name: 'Chicken supreme',   cat: 'mains',    price: 22.00, allergens: ['milk'],                  centre: 'pc1', sales: 312, description: 'Free-range chicken, dauphinoise, tenderstem broccoli' },

  // Pizza — these use the pizza builder
  { id: 'm11', name: 'Margherita',        cat: 'pizza',    price: 14.00, allergens: ['gluten','milk'],         centre: 'pc3', sales: 523, description: 'San Marzano tomato, fior di latte, fresh basil', isPizza: true, defaultToppings: ['cheese'] },
  { id: 'm12', name: 'Pepperoni',         cat: 'pizza',    price: 15.50, allergens: ['gluten','milk'],         centre: 'pc3', sales: 478, description: 'Spicy pepperoni, mozzarella, tomato base', isPizza: true, defaultToppings: ['pep', 'cheese'] },
  { id: 'm13', name: 'Truffle & mushroom',cat: 'pizza',    price: 17.00, allergens: ['gluten','milk'],         centre: 'pc3', sales: 187, description: 'White base, wild mushrooms, truffle oil, Parmesan', isPizza: true, defaultToppings: ['mush', 'truffle', 'cheese'] },
  { id: 'm14', name: 'Nduja & honey',     cat: 'pizza',    price: 17.50, allergens: ['gluten','milk'],         centre: 'pc3', sales: 156, description: 'Spicy nduja, mozzarella, drizzled honey', isPizza: true, defaultToppings: ['nduja', 'cheese'] },
  { id: 'm15', name: 'Build your own',    cat: 'pizza',    price: 12.00, allergens: ['gluten','milk'],         centre: 'pc3', sales: 340, description: 'Choose your size, base, crust and toppings', isPizza: true, defaultToppings: [], isCustom: true },

  // Sides
  { id: 'm16', name: 'Triple-cooked chips',  cat: 'sides', price: 4.50, allergens: ['gluten'],           centre: 'pc1', sales: 612 },
  { id: 'm17', name: 'Side salad',           cat: 'sides', price: 4.00, allergens: [],                   centre: 'pc2', sales: 189 },
  { id: 'm18', name: 'Garlic bread',         cat: 'sides', price: 4.50, allergens: ['gluten','milk'],    centre: 'pc1', sales: 287 },
  { id: 'm19', name: 'Tenderstem broccoli',  cat: 'sides', price: 4.50, allergens: [],                   centre: 'pc1', sales: 167 },
  { id: 'm20', name: 'Onion rings',          cat: 'sides', price: 4.50, allergens: ['gluten','milk','eggs'], centre: 'pc1', sales: 198 },

  // Desserts
  { id: 'm21', name: 'Tiramisu',     cat: 'desserts', price: 7.50, allergens: ['gluten','eggs','milk'],  centre: 'pc2', sales: 334 },
  { id: 'm22', name: 'Panna cotta',  cat: 'desserts', price: 6.50, allergens: ['milk'],                  centre: 'pc2', sales: 212 },
  { id: 'm23', name: 'Affogato',     cat: 'desserts', price: 5.50, allergens: ['milk'],                  centre: 'pc2', sales: 167 },
  { id: 'm24', name: 'Chocolate fondant', cat: 'desserts', price: 8.00, allergens: ['gluten','eggs','milk'], centre: 'pc2', sales: 287 },

  // Drinks
  { id: 'm25', name: 'Still water 750ml',    cat: 'drinks', price: 3.00,  allergens: [], centre: 'pc4', sales: 834 },
  { id: 'm26', name: 'Sparkling water 750ml',cat: 'drinks', price: 3.50,  allergens: [], centre: 'pc4', sales: 712 },
  { id: 'm27', name: 'Peroni',               cat: 'drinks', price: 5.50,  allergens: ['gluten'], centre: 'pc4', sales: 456 },
  { id: 'm28', name: 'House red 175ml',      cat: 'drinks', price: 7.50,  allergens: ['sulphites'], centre: 'pc4', sales: 398 },
  { id: 'm29', name: 'House white 175ml',    cat: 'drinks', price: 7.50,  allergens: ['sulphites'], centre: 'pc4', sales: 367 },
  { id: 'm30', name: 'Aperol Spritz',        cat: 'drinks', price: 9.50,  allergens: ['sulphites'], centre: 'pc4', sales: 345 },
  { id: 'm31', name: 'Soft drink',           cat: 'drinks', price: 3.00,  allergens: [], centre: 'pc4', sales: 290 },

  // Cocktails
  { id: 'm32', name: 'Negroni',         cat: 'cocktails', price: 11.00, allergens: ['sulphites'], centre: 'pc4', sales: 278 },
  { id: 'm33', name: 'Old Fashioned',   cat: 'cocktails', price: 12.00, allergens: [],            centre: 'pc4', sales: 234 },
  { id: 'm34', name: 'Espresso Martini',cat: 'cocktails', price: 12.50, allergens: [],            centre: 'pc4', sales: 312 },
  { id: 'm35', name: 'Margarita',       cat: 'cocktails', price: 11.50, allergens: [],            centre: 'pc4', sales: 198 },
  { id: 'm36', name: 'Aperol Spritz',   cat: 'cocktails', price: 11.00, allergens: ['sulphites'], centre: 'pc4', sales: 267 },
];

// ─── Quick screen (dinner daypart) ────────────────────────────────────────────
export const QUICK_IDS = ['m11','m6','m34','m28','m7','m25','m2','m16','m12','m21','m32','m30'];

export function getDaypart() {
  const h = new Date().getHours();
  if (h >= 6  && h < 11) return 'breakfast';
  if (h >= 11 && h < 17) return 'lunch';
  if (h >= 17 && h < 23) return 'dinner';
  return 'late';
}

// ─── Steak modifiers ─────────────────────────────────────────────────────────
export const STEAK_MODS = [
  {
    id: 'cook', label: 'Cooking', required: true,
    opts: [
      { id: 'rare',    label: 'Rare' },
      { id: 'mr',      label: 'Medium rare' },
      { id: 'med',     label: 'Medium' },
      { id: 'mw',      label: 'Medium well' },
      { id: 'wd',      label: 'Well done' },
    ]
  },
  {
    id: 'sauce', label: 'Sauce', required: false,
    opts: [
      { id: 'pep',  label: 'Peppercorn' },
      { id: 'bear', label: 'Béarnaise' },
      { id: 'chim', label: 'Chimichurri' },
      { id: 'none', label: 'No sauce' },
    ]
  },
];

// ─── Tables ──────────────────────────────────────────────────────────────────
export const INITIAL_TABLES = [
  // Main dining
  { id: 't1',  label: 'T1',       covers: 2, status: 'available', shape: 'sq', x: 24,  y: 36,  w: 64,  h: 64,  section: 'main' },
  { id: 't2',  label: 'T2',       covers: 4, status: 'occupied',  shape: 'sq', x: 112, y: 36,  w: 72,  h: 64,  section: 'main', seated: 38, server: 'Sarah', orderTotal: 78.50 },
  { id: 't3',  label: 'T3',       covers: 2, status: 'reserved',  shape: 'sq', x: 208, y: 36,  w: 64,  h: 64,  section: 'main', reservation: '7:30 PM', partySize: 2 },
  { id: 't4',  label: 'T4',       covers: 4, status: 'open',      shape: 'sq', x: 298, y: 36,  w: 80,  h: 64,  section: 'main', server: 'Tom', orderTotal: 0 },
  { id: 't5',  label: 'T5',       covers: 3, status: 'occupied',  shape: 'rd', x: 24,  y: 124, w: 72,  h: 72,  section: 'main', seated: 72, server: 'Sarah', orderTotal: 112.00 },
  { id: 't6',  label: 'T6',       covers: 3, status: 'available', shape: 'rd', x: 122, y: 124, w: 72,  h: 72,  section: 'main' },
  { id: 't7',  label: 'Banquette',covers: 8, status: 'open',      shape: 'sq', x: 220, y: 128, w: 140, h: 60,  section: 'main', server: 'Tom', orderTotal: 0 },
  { id: 't8',  label: 'T8',       covers: 2, status: 'available', shape: 'sq', x: 24,  y: 220, w: 60,  h: 58,  section: 'main' },
  { id: 't9',  label: 'T9',       covers: 4, status: 'occupied',  shape: 'sq', x: 106, y: 220, w: 72,  h: 58,  section: 'main', seated: 22, server: 'Sarah', orderTotal: 64.00 },
  { id: 't10', label: 'T10',      covers: 4, status: 'available', shape: 'sq', x: 202, y: 220, w: 80,  h: 58,  section: 'main' },
  // Bar
  { id: 'b1',  label: 'B1',       covers: 1, status: 'available', shape: 'rd', x: 420, y: 36,  w: 48,  h: 48,  section: 'bar' },
  { id: 'b2',  label: 'B2',       covers: 1, status: 'occupied',  shape: 'rd', x: 420, y: 96,  w: 48,  h: 48,  section: 'bar', orderTotal: 22.00 },
  { id: 'b3',  label: 'B3',       covers: 1, status: 'available', shape: 'rd', x: 420, y: 156, w: 48,  h: 48,  section: 'bar' },
  { id: 'b4',  label: 'B4',       covers: 1, status: 'available', shape: 'rd', x: 420, y: 216, w: 48,  h: 48,  section: 'bar' },
  // Patio
  { id: 'p1',  label: 'P1',       covers: 4, status: 'available', shape: 'sq', x: 510, y: 36,  w: 72,  h: 64,  section: 'patio' },
  { id: 'p2',  label: 'P2',       covers: 4, status: 'reserved',  shape: 'sq', x: 510, y: 120, w: 72,  h: 64,  section: 'patio', reservation: '8:00 PM', partySize: 4 },
  { id: 'p3',  label: 'P3',       covers: 6, status: 'available', shape: 'sq', x: 510, y: 204, w: 90,  h: 60,  section: 'patio' },
];

// ─── KDS seed tickets ─────────────────────────────────────────────────────────
export const INITIAL_KDS = [
  {
    id: 'k1', table: 'T2', covers: 4, server: 'Sarah', minutes: 38,
    items: [
      { qty: 1, name: 'Ribeye steak 8oz', mods: 'Medium rare · Peppercorn', course: 1, centre: 'pc1' },
      { qty: 1, name: 'Sea bass',         mods: '',                          course: 1, centre: 'pc1' },
      { qty: 2, name: 'Triple-cooked chips', mods: '',                       course: 1, centre: 'pc1' },
    ]
  },
  {
    id: 'k2', table: 'T5', covers: 3, server: 'Sarah', minutes: 12,
    items: [
      { qty: 2, name: 'Carbonara',           mods: '',              course: 1, centre: 'pc1' },
      { qty: 1, name: 'Wild mushroom risotto',mods: 'Extra truffle', course: 1, centre: 'pc1' },
      { qty: 3, name: 'Triple-cooked chips', mods: '',              course: 1, centre: 'pc1' },
    ]
  },
  {
    id: 'k3', table: 'T4', covers: 4, server: 'Tom', minutes: 5,
    items: [
      { qty: 1, name: 'Bruschetta',    mods: '',                              course: 1, centre: 'pc2' },
      { qty: 2, name: 'Prawn cocktail',mods: '⚠ CRUSTACEANS · EGGS · MILK',  course: 1, centre: 'pc2' },
      { qty: 1, name: 'Burrata',       mods: '',                              course: 1, centre: 'pc2' },
    ]
  },
  {
    id: 'k4', table: 'Banquette', covers: 8, server: 'Tom', minutes: 8,
    items: [
      { qty: 2, name: 'Bruschetta',    mods: '',                  course: 1, centre: 'pc2' },
      { qty: 1, name: 'Soup of the day',mods: 'No bread (GF)',    course: 1, centre: 'pc1' },
      { qty: 3, name: 'Garlic bread',  mods: '',                  course: 1, centre: 'pc1' },
    ]
  },
  {
    id: 'k5', table: 'T9', covers: 4, server: 'Sarah', minutes: 19,
    items: [
      { qty: 1, name: 'Margherita pizza XL',   mods: 'Thin crust · Left: extra cheese / Right: pepperoni', course: 1, centre: 'pc3' },
      { qty: 1, name: 'Pepperoni pizza Large',  mods: 'Deep pan',   course: 1, centre: 'pc3' },
    ]
  },
];

// ─── Shift ────────────────────────────────────────────────────────────────────
export const SHIFT = {
  name: 'Dinner service',
  opened: '17:00',
  covers: 42,
  sales: 2840.50,
  avgCheck: 67.64,
  cashSales: 640.00,
  cardSales: 2200.50,
  tips: 187.00,
  voids: 2,
  voidValue: 18.50,
};
