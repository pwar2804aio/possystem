// ─── Allergens (all 14 EU mandatory) ─────────────────────────────────────────
export const ALLERGENS = [
  { id:'gluten',      label:'Gluten',      icon:'G'  },
  { id:'crustaceans', label:'Crustaceans', icon:'C'  },
  { id:'eggs',        label:'Eggs',        icon:'E'  },
  { id:'fish',        label:'Fish',        icon:'F'  },
  { id:'peanuts',     label:'Peanuts',     icon:'P'  },
  { id:'soy',         label:'Soy',         icon:'S'  },
  { id:'milk',        label:'Milk',        icon:'M'  },
  { id:'nuts',        label:'Tree nuts',   icon:'N'  },
  { id:'celery',      label:'Celery',      icon:'Ce' },
  { id:'mustard',     label:'Mustard',     icon:'Mu' },
  { id:'sesame',      label:'Sesame',      icon:'Se' },
  { id:'sulphites',   label:'Sulphites',   icon:'Su' },
  { id:'lupin',       label:'Lupin',       icon:'L'  },
  { id:'molluscs',    label:'Molluscs',    icon:'Mo' },
];

// ─── Staff ────────────────────────────────────────────────────────────────────
export const STAFF = [
  { id:'s1', name:'Alex',  role:'Manager',   pin:'1234', color:'#f0a500', initials:'AL' },
  { id:'s2', name:'Sarah', role:'Server',    pin:'2345', color:'#3b82f6', initials:'SA' },
  { id:'s3', name:'Tom',   role:'Server',    pin:'3456', color:'#a855f7', initials:'TM' },
  { id:'s4', name:'Maria', role:'Bartender', pin:'4567', color:'#22c55e', initials:'MA' },
];

// ─── Production centres ───────────────────────────────────────────────────────
export const PRODUCTION_CENTRES = [
  { id:'pc1', name:'Hot kitchen',  type:'kitchen', icon:'🔥' },
  { id:'pc2', name:'Cold section', type:'kitchen', icon:'❄️'  },
  { id:'pc3', name:'Pizza oven',   type:'kitchen', icon:'🍕' },
  { id:'pc4', name:'Bar',          type:'bar',     icon:'🍸' },
  { id:'pc5', name:'Expo / pass',  type:'expo',    icon:'📋' },
];

// ─── Printers ─────────────────────────────────────────────────────────────────
export const PRINTERS = [
  { id:'pr1', name:'Hot kitchen',  model:'NT311', ip:'192.168.1.101', status:'online',  centreId:'pc1' },
  { id:'pr2', name:'Cold section', model:'NT311', ip:'192.168.1.102', status:'online',  centreId:'pc2' },
  { id:'pr3', name:'Bar',          model:'NT311', ip:'192.168.1.103', status:'online',  centreId:'pc4' },
  { id:'pr4', name:'Expo / pass',  model:'NT311', ip:'192.168.1.104', status:'offline', centreId:'pc5' },
];

// ─── Categories ───────────────────────────────────────────────────────────────
// ─── Categories (built in Menu Manager — Categories tab) ─────────────────────
// parentId links subcategories to their parent
export const CATEGORIES = [
  { id:'quick', label:'Quick screen', isSpecial:true },
];

// CAT_META kept for POS colour/icon — store-based categories use their own color/icon
export const CAT_META = {
  quick: { icon:'⚡', color:'#e8a020' },
};

// ─── Pizza config ─────────────────────────────────────────────────────────────
export const PIZZA_TOPPINGS = [
  { id:'pep',     name:'Pepperoni',    color:'#ef4444', price:1.5, allergens:[]       },
  { id:'mush',    name:'Mushrooms',    color:'#78716c', price:1.5, allergens:[]       },
  { id:'cheese',  name:'Extra cheese', color:'#eab308', price:1.5, allergens:['milk'] },
  { id:'olive',   name:'Olives',       color:'#4d7c0f', price:1.5, allergens:[]       },
  { id:'pepper',  name:'Peppers',      color:'#dc2626', price:1.5, allergens:[]       },
  { id:'onion',   name:'Red onion',    color:'#9333ea', price:1.5, allergens:[]       },
  { id:'jalapeno',name:'Jalapeño',     color:'#16a34a', price:1.5, allergens:[]       },
  { id:'anchovy', name:'Anchovy',      color:'#92400e', price:1.5, allergens:['fish'] },
  { id:'chicken', name:'BBQ chicken',  color:'#d97706', price:2.0, allergens:[]       },
];
export const PIZZA_BASES  = [
  { id:'tomato', name:'Tomato',  allergens:[] },
  { id:'white',  name:'White',   allergens:['milk'] },
  { id:'pesto',  name:'Pesto',   allergens:['nuts','milk'] },
  { id:'bbq',    name:'BBQ',     allergens:[] },
];
export const PIZZA_CRUSTS = [
  { id:'thin',    name:'Classic thin',  extra:0   },
  { id:'deep',    name:'Deep pan',      extra:0   },
  { id:'stuffed', name:'Stuffed crust', extra:2.0 },
  { id:'gf',      name:'Gluten-free',   extra:2.5 },
];
export const PIZZA_SIZES  = [
  { id:'personal', name:'Personal 9\"',  basePrice:10 },
  { id:'large',    name:'Large 12\"',    basePrice:14 },
  { id:'xl',       name:'XL 14\"',       basePrice:18 },
];

// ─── The Anchor — complete menu ───────────────────────────────────────────────
// Built to demonstrate every Menu Manager feature:
//   Categories with subcategories (parentId)
//   Sub items (used only in modifier groups)
//   Variants (parent item + children via parentId)
//   Modifier groups (assigned via assignedModifierGroups)
//   Instruction groups (assigned via assignedInstructionGroups)

export const MENU_ITEMS = [

  // ── SUB ITEMS — used in modifier groups only, never shown on POS ──────────
  // Sides
  { id:'sub-chips',    name:'Chips',              menuName:'Chips',              type:'subitem', cat:'', allergens:[], pricing:{base:0},   visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-salad',    name:'Side salad',         menuName:'Side salad',         type:'subitem', cat:'', allergens:[], pricing:{base:0},   visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-spfries',  name:'Sweet potato fries', menuName:'Sweet potato fries', type:'subitem', cat:'', allergens:[], pricing:{base:1.5}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-mash',     name:'Creamy mash',        menuName:'Creamy mash',        type:'subitem', cat:'', allergens:['milk'], pricing:{base:0}, visibility:{pos:false,kiosk:false,online:false} },

  // Sauces
  { id:'sub-pepper',   name:'Peppercorn sauce', menuName:'Peppercorn sauce', type:'subitem', cat:'', allergens:['milk'], pricing:{base:0}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-bearn',    name:'Béarnaise',        menuName:'Béarnaise',        type:'subitem', cat:'', allergens:['eggs','milk'], pricing:{base:0}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-chimich',  name:'Chimichurri',      menuName:'Chimichurri',      type:'subitem', cat:'', allergens:[], pricing:{base:0}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-nosace',   name:'No sauce',         menuName:'No sauce',         type:'subitem', cat:'', allergens:[], pricing:{base:0}, visibility:{pos:false,kiosk:false,online:false} },

  // Pizza extras
  { id:'sub-extra-ch', name:'Extra cheese',   menuName:'Extra cheese',   type:'subitem', cat:'', allergens:['milk'], pricing:{base:1.5}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-extra-pep',name:'Extra pepperoni',menuName:'Extra pepperoni',type:'subitem', cat:'', allergens:['gluten'], pricing:{base:1.5}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-truffle',  name:'Truffle oil',    menuName:'Truffle oil',    type:'subitem', cat:'', allergens:[], pricing:{base:3.0}, visibility:{pos:false,kiosk:false,online:false} },

  // Coffee milks
  { id:'sub-whole',    name:'Whole milk',   menuName:'Whole milk',   type:'subitem', cat:'', allergens:['milk'], pricing:{base:0},   visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-oat',      name:'Oat milk',     menuName:'Oat milk',     type:'subitem', cat:'', allergens:[], pricing:{base:0.5}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-almond',   name:'Almond milk',  menuName:'Almond milk',  type:'subitem', cat:'', allergens:['nuts'], pricing:{base:0.5}, visibility:{pos:false,kiosk:false,online:false} },
  { id:'sub-soy',      name:'Soy milk',     menuName:'Soy milk',     type:'subitem', cat:'', allergens:['soy'], pricing:{base:0.5}, visibility:{pos:false,kiosk:false,online:false} },

  // ── STARTERS ──────────────────────────────────────────────────────────────
  { id:'m-soup',     name:'Soup of the day',       menuName:'Soup of the day',       receiptName:'Soup',         kitchenName:'SOUP',
    type:'simple', cat:'cat-starters', allergens:['gluten','milk','celery'],
    description:'Freshly made daily soup with crusty bread and butter',
    pricing:{base:6.5,dineIn:null,takeaway:6.5,collection:6.5,delivery:6.5},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-garlic',   name:'Garlic bread',          menuName:'Garlic bread',          receiptName:'Garlic bread', kitchenName:'GARLIC BREAD',
    type:'simple', cat:'cat-starters', allergens:['gluten','milk'],
    description:'Toasted sourdough with garlic butter',
    pricing:{base:5.0,dineIn:null,takeaway:5.0,collection:5.0,delivery:5.0},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-squid',    name:'Salt & pepper calamari', menuName:'Calamari',            receiptName:'Calamari',     kitchenName:'CALAMARI',
    type:'simple', cat:'cat-starters', allergens:['gluten','molluscs'],
    description:'Lightly dusted calamari, sriracha mayo, lemon',
    pricing:{base:9.0,dineIn:null,takeaway:9.0,collection:9.0,delivery:9.0},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-pate',     name:'Chicken liver pâté',    menuName:'Chicken pâté',         receiptName:'Pâté',         kitchenName:'PATE',
    type:'simple', cat:'cat-starters', allergens:['gluten','milk','eggs'],
    description:'Smooth chicken liver pâté, sourdough toast, red onion jam',
    pricing:{base:9.5,dineIn:null,takeaway:9.5,collection:9.5,delivery:9.5},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  // ── GRILLS (subcategory of Mains) ─────────────────────────────────────────
  { id:'m-rib8',     name:'8oz Ribeye steak',      menuName:'8oz Ribeye',           receiptName:'8oz Ribeye',   kitchenName:'RIBEYE 8OZ',
    type:'modifiable', cat:'cat-grills', allergens:['milk'],
    description:'28-day aged ribeye, triple-cooked chips, watercress',
    pricing:{base:28.0,dineIn:null,takeaway:28.0,collection:28.0,delivery:28.0},
    assignedModifierGroups:[{groupId:'mgd-sides',min:1,max:1},{groupId:'mgd-sauces',min:0,max:1}],
    assignedInstructionGroups:['igd-cook-temp'] },

  { id:'m-sir6',     name:'6oz Sirloin steak',     menuName:'6oz Sirloin',          receiptName:'6oz Sirloin',  kitchenName:'SIRLOIN 6OZ',
    type:'modifiable', cat:'cat-grills', allergens:['milk'],
    description:'6oz sirloin, triple-cooked chips, watercress',
    pricing:{base:22.0,dineIn:null,takeaway:22.0,collection:22.0,delivery:22.0},
    assignedModifierGroups:[{groupId:'mgd-sides',min:1,max:1},{groupId:'mgd-sauces',min:0,max:1}],
    assignedInstructionGroups:['igd-cook-temp'] },

  { id:'m-chicken',  name:'Chicken supreme',        menuName:'Chicken supreme',      receiptName:'Chicken',      kitchenName:'CHICKEN',
    type:'modifiable', cat:'cat-grills', allergens:['milk'],
    description:'Free-range chicken breast, dauphinoise potatoes, seasonal veg',
    pricing:{base:18.0,dineIn:null,takeaway:18.0,collection:18.0,delivery:18.0},
    assignedModifierGroups:[{groupId:'mgd-sides',min:1,max:1}],
    assignedInstructionGroups:[] },

  // ── FISH (subcategory of Mains) ───────────────────────────────────────────
  { id:'m-fishchips', name:'Beer battered fish & chips', menuName:'Fish & chips',   receiptName:'Fish & chips', kitchenName:'FISH & CHIPS',
    type:'simple', cat:'cat-fish', allergens:['gluten','fish','eggs'],
    description:'MSC certified cod in our craft ale batter, chips, mushy peas, tartare sauce',
    pricing:{base:16.0,dineIn:null,takeaway:16.0,collection:16.0,delivery:16.0},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-salmon',   name:'Grilled salmon',          menuName:'Grilled salmon',      receiptName:'Salmon',       kitchenName:'SALMON',
    type:'simple', cat:'cat-fish', allergens:['fish','milk'],
    description:'Atlantic salmon fillet, crushed new potatoes, tenderstem, lemon butter',
    pricing:{base:19.0,dineIn:null,takeaway:19.0,collection:19.0,delivery:19.0},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  // ── VEGETARIAN (subcategory of Mains) ─────────────────────────────────────
  { id:'m-risotto',  name:'Wild mushroom risotto',   menuName:'Mushroom risotto',    receiptName:'Risotto',      kitchenName:'RISOTTO',
    type:'simple', cat:'cat-veggie', allergens:['milk'],
    description:'Porcini and chestnut mushroom risotto, truffle oil, parmesan',
    pricing:{base:15.0,dineIn:null,takeaway:15.0,collection:15.0,delivery:15.0},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-vegburg',  name:'Smashed veggie burger',   menuName:'Veggie burger',       receiptName:'Veggie burger',kitchenName:'VEG BURGER',
    type:'modifiable', cat:'cat-veggie', allergens:['gluten','eggs','milk'],
    description:'Beetroot & black bean patty, brioche bun, skinny fries, slaw',
    pricing:{base:14.0,dineIn:null,takeaway:14.0,collection:14.0,delivery:14.0},
    assignedModifierGroups:[{groupId:'mgd-sides',min:0,max:1}],
    assignedInstructionGroups:[] },

  // ── PIZZA ─────────────────────────────────────────────────────────────────
  { id:'m-marg',     name:'Margherita',              menuName:'Margherita',          receiptName:'Margherita',   kitchenName:'MARG',
    type:'pizza', cat:'cat-pizza', allergens:['gluten','milk'],
    description:'San Marzano tomato, fior di latte, fresh basil',
    pricing:{base:13.0,dineIn:null,takeaway:13.0,collection:13.0,delivery:13.0},
    assignedModifierGroups:[], assignedInstructionGroups:[],
    defaultToppings:[],
    pizzaSizes:null, pizzaBases:null, pizzaCrusts:null },

  { id:'m-pep',      name:'Pepperoni',               menuName:'Pepperoni',           receiptName:'Pepperoni',    kitchenName:'PEPPERONI',
    type:'pizza', cat:'cat-pizza', allergens:['gluten','milk'],
    description:'San Marzano tomato, fior di latte, spicy pepperoni',
    pricing:{base:15.0,dineIn:null,takeaway:15.0,collection:15.0,delivery:15.0},
    assignedModifierGroups:[], assignedInstructionGroups:[],
    defaultToppings:['pep'],
    pizzaSizes:null, pizzaBases:null, pizzaCrusts:null },

  { id:'m-bbqchick', name:'BBQ chicken',             menuName:'BBQ chicken pizza',   receiptName:'BBQ Chicken',  kitchenName:'BBQ CHICK',
    type:'pizza', cat:'cat-pizza', allergens:['gluten','milk'],
    description:'BBQ base, mozzarella, pulled chicken, red onion, coriander',
    pricing:{base:15.0,dineIn:null,takeaway:15.0,collection:15.0,delivery:15.0},
    assignedModifierGroups:[], assignedInstructionGroups:[],
    defaultToppings:['chicken','onion'],
    pizzaSizes:null, pizzaBases:['bbq','tomato'], pizzaCrusts:null },

  // ── DESSERTS ──────────────────────────────────────────────────────────────
  { id:'m-stp',      name:'Sticky toffee pudding',   menuName:'Sticky toffee',       receiptName:'STP',          kitchenName:'STP',
    type:'simple', cat:'cat-desserts', allergens:['gluten','milk','eggs'],
    description:'Warm sticky toffee pudding, toffee sauce, clotted cream ice cream',
    pricing:{base:7.5,dineIn:null,takeaway:null,collection:null,delivery:null},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-cheese',   name:'Cheesecake',              menuName:'Cheesecake',          receiptName:'Cheesecake',   kitchenName:'CHEESECAKE',
    type:'simple', cat:'cat-desserts', allergens:['gluten','milk','eggs'],
    description:'New York style baked cheesecake, seasonal berry coulis',
    pricing:{base:7.0,dineIn:null,takeaway:null,collection:null,delivery:null},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-icecream', name:'Ice cream',               menuName:'Ice cream (3 scoops)', receiptName:'Ice cream',   kitchenName:'ICE CREAM',
    type:'simple', cat:'cat-desserts', allergens:['milk','eggs'],
    description:"Ask your server for today's flavours",
    pricing:{base:5.5,dineIn:null,takeaway:null,collection:null,delivery:null},
    assignedModifierGroups:[], assignedInstructionGroups:[] },

  // ── DRAUGHT BEER (subcategory of Drinks) ──────────────────────────────────
  // Lager — variant parent, children: pint & half pint
  { id:'m-lager',    name:'Lager',    menuName:'Lager',    type:'variants', cat:'cat-draught', allergens:['gluten'], pricing:{base:0},   assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-lager-pt', name:'Lager — Pint',      menuName:'Pint',      parentId:'m-lager', type:'simple', cat:'cat-draught', allergens:['gluten'], pricing:{base:5.8},  assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-lager-hp', name:'Lager — Half pint', menuName:'Half pint', parentId:'m-lager', type:'simple', cat:'cat-draught', allergens:['gluten'], pricing:{base:3.2},  assignedModifierGroups:[], assignedInstructionGroups:[] },

  // Stout — variant parent
  { id:'m-stout',    name:'Stout',    menuName:'Stout',    type:'variants', cat:'cat-draught', allergens:['gluten'], pricing:{base:0},   assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-stout-pt', name:'Stout — Pint',      menuName:'Pint',      parentId:'m-stout', type:'simple', cat:'cat-draught', allergens:['gluten'], pricing:{base:6.2},  assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-stout-hp', name:'Stout — Half pint', menuName:'Half pint', parentId:'m-stout', type:'simple', cat:'cat-draught', allergens:['gluten'], pricing:{base:3.4},  assignedModifierGroups:[], assignedInstructionGroups:[] },

  // ── WINE (subcategory of Drinks) ──────────────────────────────────────────
  { id:'m-hwine',    name:'House white wine', menuName:'House white', type:'variants', cat:'cat-wine', allergens:['sulphites'], pricing:{base:0}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-hwine-175',name:'House white — 175ml', menuName:'175ml', parentId:'m-hwine', type:'simple', cat:'cat-wine', allergens:['sulphites'], pricing:{base:6.5}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-hwine-250',name:'House white — 250ml', menuName:'250ml', parentId:'m-hwine', type:'simple', cat:'cat-wine', allergens:['sulphites'], pricing:{base:8.5}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-hwine-bot',name:'House white — Bottle', menuName:'Bottle', parentId:'m-hwine', type:'simple', cat:'cat-wine', allergens:['sulphites'], pricing:{base:28.0}, assignedModifierGroups:[], assignedInstructionGroups:[] },

  { id:'m-hrwine',    name:'House red wine',   menuName:'House red', type:'variants', cat:'cat-wine', allergens:['sulphites'], pricing:{base:0}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-hrwine-175',name:'House red — 175ml',  menuName:'175ml', parentId:'m-hrwine', type:'simple', cat:'cat-wine', allergens:['sulphites'], pricing:{base:6.5}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-hrwine-250',name:'House red — 250ml',  menuName:'250ml', parentId:'m-hrwine', type:'simple', cat:'cat-wine', allergens:['sulphites'], pricing:{base:8.5}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-hrwine-bot',name:'House red — Bottle', menuName:'Bottle', parentId:'m-hrwine', type:'simple', cat:'cat-wine', allergens:['sulphites'], pricing:{base:28.0}, assignedModifierGroups:[], assignedInstructionGroups:[] },

  // ── SOFT DRINKS (subcategory of Drinks) ───────────────────────────────────
  { id:'m-coke',     name:'Coca-Cola',       menuName:'Coke',          receiptName:'Coke',      kitchenName:'COKE',
    type:'simple', cat:'cat-softs', allergens:[], pricing:{base:3.5,dineIn:null,takeaway:3.0,delivery:3.0}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-lemon',    name:'Lemonade',        menuName:'Lemonade',      receiptName:'Lemonade',  kitchenName:'LEMONADE',
    type:'simple', cat:'cat-softs', allergens:[], pricing:{base:3.5,dineIn:null,takeaway:3.0,delivery:3.0}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-water',    name:'Still water',     menuName:'Still water',   receiptName:'Water',     kitchenName:'WATER',
    type:'simple', cat:'cat-softs', allergens:[], pricing:{base:2.8}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-sparkling',name:'Sparkling water', menuName:'Sparkling water',receiptName:'Sparkling', kitchenName:'SPARKLING',
    type:'simple', cat:'cat-softs', allergens:[], pricing:{base:2.8}, assignedModifierGroups:[], assignedInstructionGroups:[] },

  // ── HOT DRINKS ────────────────────────────────────────────────────────────
  { id:'m-espresso', name:'Espresso',        menuName:'Espresso',      receiptName:'Espresso',  kitchenName:'ESPRESSO',
    type:'simple', cat:'cat-hot', allergens:[], pricing:{base:2.5}, assignedModifierGroups:[], assignedInstructionGroups:[] },
  { id:'m-flat',     name:'Flat white',      menuName:'Flat white',    receiptName:'Flat white',kitchenName:'FLAT WHITE',
    type:'modifiable', cat:'cat-hot', allergens:['milk'], pricing:{base:3.5},
    assignedModifierGroups:[{groupId:'mgd-milk',min:1,max:1}],
    assignedInstructionGroups:[] },
  { id:'m-capp',     name:'Cappuccino',      menuName:'Cappuccino',    receiptName:'Cappuccino',kitchenName:'CAPP',
    type:'modifiable', cat:'cat-hot', allergens:['milk'], pricing:{base:3.5},
    assignedModifierGroups:[{groupId:'mgd-milk',min:1,max:1}],
    assignedInstructionGroups:[] },
  { id:'m-latte',    name:'Latte',           menuName:'Latte',         receiptName:'Latte',     kitchenName:'LATTE',
    type:'modifiable', cat:'cat-hot', allergens:['milk'], pricing:{base:3.8},
    assignedModifierGroups:[{groupId:'mgd-milk',min:1,max:1}],
    assignedInstructionGroups:[] },

];

export const QUICK_IDS = ['m-rib8','m-sir6','m-fishchips','m-marg','m-pep','m-flat','m-coke','m-stout','m-lager','m-stp','m-soup','m-squid'];

export function getDaypart() {
  const h = new Date().getHours();
  if (h >= 6  && h < 11) return 'breakfast';
  if (h >= 11 && h < 17) return 'lunch';
  if (h >= 17 && h < 23) return 'dinner';
  return 'late';
}

// ─── Tables ──────────────────────────────────────────────────────────────────
export const INITIAL_TABLES = [
  { id:'t1',  label:'T1',       covers:2, status:'available', shape:'sq', x:24,  y:36,  w:64,  h:64,  section:'main' },
  { id:'t2',  label:'T2',       covers:4, status:'occupied',  shape:'sq', x:112, y:36,  w:72,  h:64,  section:'main', seated:38, server:'Sarah', orderTotal:78.50 },
  { id:'t3',  label:'T3',       covers:2, status:'reserved',  shape:'sq', x:208, y:36,  w:64,  h:64,  section:'main', reservation:'7:30 PM', partySize:2 },
  { id:'t4',  label:'T4',       covers:4, status:'open',      shape:'sq', x:298, y:36,  w:80,  h:64,  section:'main', server:'Tom',   orderTotal:0 },
  { id:'t5',  label:'T5',       covers:3, status:'occupied',  shape:'rd', x:24,  y:124, w:72,  h:72,  section:'main', seated:72, server:'Sarah', orderTotal:112.00 },
  { id:'t6',  label:'T6',       covers:3, status:'available', shape:'rd', x:122, y:124, w:72,  h:72,  section:'main' },
  { id:'t7',  label:'Banquette',covers:8, status:'open',      shape:'sq', x:220, y:128, w:140, h:60,  section:'main', server:'Tom',   orderTotal:0 },
  { id:'t8',  label:'T8',       covers:2, status:'available', shape:'sq', x:24,  y:220, w:60,  h:58,  section:'main' },
  { id:'t9',  label:'T9',       covers:4, status:'occupied',  shape:'sq', x:106, y:220, w:72,  h:58,  section:'main', seated:22, server:'Sarah', orderTotal:64.00 },
  { id:'t10', label:'T10',      covers:4, status:'available', shape:'sq', x:202, y:220, w:80,  h:58,  section:'main' },
  { id:'b1',  label:'B1',       covers:1, status:'available', shape:'rd', x:420, y:36,  w:48,  h:48,  section:'bar' },
  { id:'b2',  label:'B2',       covers:1, status:'occupied',  shape:'rd', x:420, y:96,  w:48,  h:48,  section:'bar', orderTotal:22.00 },
  { id:'b3',  label:'B3',       covers:1, status:'available', shape:'rd', x:420, y:156, w:48,  h:48,  section:'bar' },
  { id:'b4',  label:'B4',       covers:1, status:'available', shape:'rd', x:420, y:216, w:48,  h:48,  section:'bar' },
  { id:'p1',  label:'P1',       covers:4, status:'available', shape:'sq', x:510, y:36,  w:72,  h:64,  section:'patio' },
  { id:'p2',  label:'P2',       covers:4, status:'reserved',  shape:'sq', x:510, y:120, w:72,  h:64,  section:'patio', reservation:'8:00 PM', partySize:4 },
  { id:'p3',  label:'P3',       covers:6, status:'available', shape:'sq', x:510, y:204, w:90,  h:60,  section:'patio' },
];

// ─── KDS ─────────────────────────────────────────────────────────────────────
export const INITIAL_KDS = [
  { id:'k1', table:'T2', covers:4, server:'Sarah', minutes:38, items:[
    { qty:1, name:'Ribeye steak 8oz',    mods:'Medium rare · Peppercorn sauce',  course:1, centreId:'pc1' },
    { qty:1, name:'Sea bass fillet',     mods:'Lemon butter',                    course:1, centreId:'pc1' },
    { qty:2, name:'Triple-cooked chips', mods:'',                                course:1, centreId:'pc1' },
  ]},
  { id:'k2', table:'T5', covers:3, server:'Sarah', minutes:12, items:[
    { qty:2, name:'Carbonara pasta',     mods:'Regular · Extra pancetta',        course:1, centreId:'pc1' },
    { qty:1, name:'Wild mushroom risotto',mods:'Extra truffle',                  course:1, centreId:'pc1' },
    { qty:3, name:'Triple-cooked chips', mods:'',                                course:1, centreId:'pc1' },
  ]},
  { id:'k3', table:'T4', covers:4, server:'Tom', minutes:5, items:[
    { qty:1, name:'Bruschetta',          mods:'',                                course:1, centreId:'pc2' },
    { qty:2, name:'Prawn cocktail',      mods:'⚠ CRUSTACEANS · EGGS · MILK',    course:1, centreId:'pc2' },
    { qty:1, name:'Charcuterie board',   mods:'Large',                           course:1, centreId:'pc2' },
  ]},
  { id:'k4', table:'T9', covers:4, server:'Sarah', minutes:19, items:[
    { qty:1, name:'Margherita — Large',  mods:'Thin crust · Half & half: extra cheese / pepperoni', course:1, centreId:'pc3' },
    { qty:1, name:'Pepperoni — Large',   mods:'Deep pan',                        course:1, centreId:'pc3' },
  ]},
];

// ─── Shift ────────────────────────────────────────────────────────────────────
export const SHIFT = {
  name:'Dinner service', opened:'17:00',
  covers:42, sales:2840.50, avgCheck:67.64,
  cashSales:640.00, cardSales:2200.50, tips:187.00, voids:2, voidValue:18.50,
};

// ── Recipe data — added to MENU_ITEMS by id ──────────────────────────────────
export const ITEM_RECIPES = {
  m1: {
    prepTime: 10, cookTime: 5, calories: 320,
    story: 'Our bruschetta uses sourdough baked fresh each morning by our baker. The tomatoes are dressed two hours before service to let the flavours meld.',
    recipe: [
      { qty:2, unit:'slices', ingredient:'Sourdough bread (thick cut)' },
      { qty:200, unit:'g', ingredient:'Heritage tomatoes, mixed variety' },
      { qty:1, unit:'clove', ingredient:'Garlic' },
      { qty:20, unit:'ml', ingredient:'Basil oil' },
      { qty:null, unit:null, ingredient:'Maldon sea salt and black pepper' },
      { qty:6, unit:'leaves', ingredient:'Fresh basil' },
    ],
    method: [
      'Grill sourdough on a hot griddle pan for 2 minutes each side until charred lines appear.',
      'Immediately rub the hot surface with the cut garlic clove — the heat releases the oils.',
      'Halve or quarter tomatoes, season generously with salt and pepper, rest 5 minutes.',
      'Spoon tomatoes over bread, drizzle basil oil, finish with torn basil and flaky salt.',
    ],
  },
  m2: {
    prepTime: 8, cookTime: 0, calories: 410,
    story: 'Burrata arrives from our supplier in Puglia every Tuesday and Friday. Never freeze it — serve within 24 hours of delivery at room temperature.',
    recipe: [
      { qty:1, unit:'ball', ingredient:'Fresh burrata (125g)' },
      { qty:3, unit:'medium', ingredient:'Heirloom tomatoes, mixed colours' },
      { qty:15, unit:'ml', ingredient:'Aged balsamic vinegar (min 6 years)' },
      { qty:20, unit:'ml', ingredient:'Extra virgin olive oil' },
      { qty:null, unit:null, ingredient:'Flaky sea salt, cracked black pepper' },
      { qty:4, unit:'leaves', ingredient:'Fresh basil' },
    ],
    method: [
      'Remove burrata from fridge 30 minutes before service — it must be at room temperature.',
      'Slice tomatoes in irregular shapes, season with salt and leave to drain for 5 minutes.',
      'Arrange tomatoes on plate, place burrata in centre, tear open at table or in kitchen.',
      'Drizzle balsamic then olive oil in separate streams. Top with basil and cracked pepper.',
    ],
  },
  m6: {
    prepTime: 5, cookTime: 12, calories: 680,
    story: "A Roman classic made the right way — no cream ever. The emulsion comes from egg yolks and starchy pasta water. Guanciale is correct but we use pancetta for consistency.",
    recipe: [
      { qty:160, unit:'g', ingredient:'Spaghetti or rigatoni' },
      { qty:80, unit:'g', ingredient:'Pancetta (or guanciale), diced' },
      { qty:2, unit:'whole', ingredient:'Egg yolks per portion' },
      { qty:40, unit:'g', ingredient:'Pecorino Romano, finely grated' },
      { qty:20, unit:'g', ingredient:'Parmesan, finely grated' },
      { qty:null, unit:null, ingredient:'Coarse black pepper, pasta water' },
    ],
    method: [
      'Cook pasta in heavily salted boiling water until al dente, reserve 200ml pasta water.',
      'Render pancetta in a dry pan on medium heat until fat is rendered and edges crisp, 4–5 mins.',
      'Whisk egg yolks, Pecorino, and Parmesan together with a crack of pepper.',
      'Remove pan from heat. Add drained pasta to pancetta, toss to coat in fat.',
      'Off heat, add egg mix and 50ml pasta water. Toss rapidly — the residual heat cooks the eggs without scrambling. Add more water to reach a silky, coating consistency.',
      'Plate immediately, finish with more Pecorino and cracked black pepper.',
    ],
  },
  m7: {
    prepTime: 5, cookTime: 14, calories: 720,
    story: 'We use 28-day dry-aged ribeye from our butcher in the Cotswolds. Always rest the steak for half the cooking time before serving.',
    recipe: [
      { qty:227, unit:'g', ingredient:'28-day dry-aged ribeye (8oz)' },
      { qty:15, unit:'ml', ingredient:'Rapeseed or vegetable oil' },
      { qty:30, unit:'g', ingredient:'Unsalted butter' },
      { qty:2, unit:'sprigs', ingredient:'Fresh thyme' },
      { qty:1, unit:'clove', ingredient:'Garlic, crushed' },
      { qty:null, unit:null, ingredient:'Flaky salt and coarse black pepper' },
    ],
    method: [
      'Remove steak from fridge 45 minutes before cooking to bring to room temperature.',
      'Pat dry thoroughly with kitchen paper. Season both sides generously with salt and pepper.',
      'Heat pan (cast iron preferred) until smoking hot. Add oil.',
      'Sear steak 2 min each side for medium-rare, adjusting for thickness and desired cook.',
      'Reduce heat to medium. Add butter, thyme, and garlic. Baste continuously for 1 minute.',
      'Rest on a warm plate for exactly half the cooking time before serving.',
      'For triple-cooked chips: par-boil, freeze, fry at 130°C, freeze again, fry at 180°C until golden.',
    ],
  },
  m8: {
    prepTime: 5, cookTime: 8, calories: 480,
    story: 'Our sea bass comes from day boats in Cornwall. Score the skin well and press it flat in a hot pan to prevent curling.',
    recipe: [
      { qty:180, unit:'g', ingredient:'Sea bass fillet, skin on, pin-boned' },
      { qty:50, unit:'g', ingredient:'Samphire, washed' },
      { qty:200, unit:'g', ingredient:'New potatoes, cooked and buttered' },
      { qty:60, unit:'g', ingredient:'Unsalted butter' },
      { qty:0.5, unit:'whole', ingredient:'Lemon, juiced' },
      { qty:10, unit:'ml', ingredient:'Olive oil' },
    ],
    method: [
      'Score the skin of the sea bass 3 times on a diagonal to prevent curling.',
      'Season skin side with salt. Heat oil in non-stick pan until shimmering.',
      'Place fish skin-side down, immediately press with a spatula for 30 seconds.',
      'Cook skin side 4–5 mins until skin is golden and crisp. Flip, cook 1 min off heat.',
      'In separate pan, wilt samphire in 20g butter with a squeeze of lemon, 2 minutes.',
      'Make lemon butter: foam remaining butter, add lemon juice at the last second.',
      'Plate potatoes, samphire, fish skin up, spoon lemon butter around.',
    ],
  },
  m14: {
    prepTime: 20, cookTime: 0, calories: 480,
    story: 'Tiramisu is made fresh each morning. We use cold-brew espresso and allow it to set for minimum 4 hours. Never serve same-day.',
    recipe: [
      { qty:4, unit:'whole', ingredient:'Egg yolks' },
      { qty:80, unit:'g', ingredient:'Caster sugar' },
      { qty:500, unit:'g', ingredient:'Mascarpone' },
      { qty:4, unit:'whole', ingredient:'Egg whites' },
      { qty:200, unit:'ml', ingredient:'Strong espresso, cold' },
      { qty:30, unit:'ml', ingredient:'Marsala wine' },
      { qty:200, unit:'g', ingredient:'Savoiardi (ladyfinger biscuits)' },
      { qty:null, unit:null, ingredient:'Cocoa powder to dust' },
    ],
    method: [
      'Whisk yolks and sugar until pale and doubled in volume (ribbon stage), 5 mins.',
      'Fold mascarpone gently into yolk mixture until just combined.',
      'Whisk egg whites to stiff peaks. Fold into mascarpone mixture in three additions.',
      'Mix cold espresso with Marsala. Briefly dip each biscuit — 2 seconds per side only.',
      'Layer soaked biscuits in dish, top with half the cream. Repeat layers.',
      'Dust generously with cocoa, cover and refrigerate minimum 4 hours before service.',
    ],
  },
};
