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
export const CATEGORIES = [
  { id:'quick',     label:'Quick screen', isSpecial:true },
  { id:'starters',  label:'Starters'   },
  { id:'mains',     label:'Mains'      },
  { id:'pizza',     label:'Pizza'      },
  { id:'sides',     label:'Sides'      },
  { id:'desserts',  label:'Desserts'   },
  { id:'drinks',    label:'Drinks'     },
  { id:'cocktails', label:'Cocktails'  },
];

export const CAT_META = {
  quick:    { icon:'⚡', color:'#e8a020' },
  starters: { icon:'🥗', color:'#22c55e' },
  mains:    { icon:'🍽', color:'#3b82f6' },
  pizza:    { icon:'🍕', color:'#f07020' },
  sides:    { icon:'🍟', color:'#a855f7' },
  desserts: { icon:'🍮', color:'#e84066' },
  drinks:   { icon:'🍷', color:'#e84040' },
  cocktails:{ icon:'🍸', color:'#22d3ee' },
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
  { id:'basil',   name:'Fresh basil',  color:'#15803d', price:1.0, allergens:[]       },
  { id:'chicken', name:'BBQ chicken',  color:'#d97706', price:2.0, allergens:[]       },
  { id:'nduja',   name:"N'duja",       color:'#b91c1c', price:2.5, allergens:[]       },
  { id:'truffle', name:'Truffle oil',  color:'#44403c', price:3.0, allergens:[]       },
];
export const PIZZA_BASES = [
  { id:'tomato', name:'Tomato',  allergens:[]              },
  { id:'white',  name:'White',   allergens:['milk']        },
  { id:'pesto',  name:'Pesto',   allergens:['nuts','milk'] },
  { id:'bbq',    name:'BBQ',     allergens:[]              },
];
export const PIZZA_CRUSTS = [
  { id:'thin',    name:'Classic thin',  extra:0   },
  { id:'deep',    name:'Deep pan',      extra:0   },
  { id:'stuffed', name:'Stuffed crust', extra:2.0 },
  { id:'gf',      name:'Gluten-free',   extra:2.5 },
];
export const PIZZA_SIZES = [
  { id:'personal', name:'Personal 9"',  basePrice:10 },
  { id:'large',    name:'Large 12"',    basePrice:14 },
  { id:'xl',       name:'XL 14"',       basePrice:18 },
];

// ─── Product types ────────────────────────────────────────────────────────────
// type: 'simple' | 'variants' | 'modifiers' | 'pizza'
//
// variants: array of { id, label, price }   — user must pick exactly one
// modifierGroups: array of {
//   id, label, required, multi (bool),
//   options: [{ id, label, price }]
// }

export const MENU_ITEMS = [

  // ── Starters ────────────────────────────────────────────────────────────────
  { id:'m1',  name:'Bruschetta',        cat:'starters', price:8.00,  allergens:['gluten','milk'],        centreId:'pc2', sales:312, type:'simple',
    description:'Toasted sourdough, heritage tomatoes, basil oil' },

  { id:'m2',  name:'Burrata',           cat:'starters', price:12.00, allergens:['milk'],                 centreId:'pc2', sales:287, type:'simple',
    description:'Fresh burrata, heirloom tomatoes, aged balsamic' },

  { id:'m3',  name:'Prawn cocktail',    cat:'starters', price:11.00, allergens:['crustaceans','eggs','milk'], centreId:'pc2', sales:198, type:'simple',
    description:'Tiger prawns, Marie Rose sauce, gem lettuce' },

  { id:'m4',  name:'Soup of the day',   cat:'starters', price:7.50,  allergens:['gluten','milk','celery'], centreId:'pc1', sales:145, type:'modifiers',
    description:'Ask your server for today\'s soup',
    modifierGroups:[
      { id:'bread', label:'Bread', required:false, multi:false,
        options:[{ id:'yw', label:'With bread', price:0 },{ id:'nb', label:'No bread', price:0 }] },
    ]},

  { id:'m5',  name:'Charcuterie board', cat:'starters', price:16.00, allergens:['gluten','milk','mustard'], centreId:'pc2', sales:220, type:'modifiers',
    description:'Cured meats, cornichons, mustard, sourdough',
    modifierGroups:[
      { id:'sz', label:'Size', required:true, multi:false,
        options:[{ id:'sm', label:'Small (2 people)', price:0 },{ id:'lg', label:'Large (4 people)', price:8 }] },
    ]},

  // ── Mains ────────────────────────────────────────────────────────────────────
  { id:'m6',  name:'Carbonara pasta',   cat:'mains', price:14.50, allergens:['gluten','eggs','milk'], centreId:'pc1', sales:445, type:'modifiers',
    description:'Spaghetti, pancetta, Pecorino Romano, egg yolk',
    modifierGroups:[
      { id:'size', label:'Portion', required:false, multi:false,
        options:[{ id:'reg', label:'Regular', price:0 },{ id:'lg', label:'Large', price:3 }] },
      { id:'extra', label:'Add-ons', required:false, multi:true,
        options:[{ id:'truffle', label:'Truffle oil', price:3.5 },{ id:'xbacon', label:'Extra pancetta', price:2.5 }] },
    ]},

  { id:'m7',  name:'Ribeye steak 8oz',  cat:'mains', price:32.00, allergens:[], may_contain:['milk'], centreId:'pc1', sales:398, type:'modifiers',
    description:'Dry-aged ribeye, triple-cooked chips, watercress',
    modifierGroups:[
      { id:'cook',  label:'Cooking',       required:true,  multi:false,
        options:[{ id:'rare', label:'Rare' },{ id:'mr', label:'Medium rare' },{ id:'med', label:'Medium' },{ id:'mw', label:'Medium well' },{ id:'wd', label:'Well done' }] },
      { id:'sauce', label:'Sauce',         required:true,  multi:false,
        options:[{ id:'pep', label:'Peppercorn' },{ id:'bear', label:'Béarnaise' },{ id:'chim', label:'Chimichurri' },{ id:'no', label:'No sauce' }] },
      { id:'side',  label:'Swap side',     required:false, multi:false,
        options:[{ id:'chips', label:'Chips (included)', price:0 },{ id:'salad', label:'Side salad', price:0 },{ id:'mac', label:'Mac & cheese', price:3 }] },
    ]},

  { id:'m8',  name:'Sea bass fillet',   cat:'mains', price:26.00, allergens:['fish'], centreId:'pc1', sales:267, type:'modifiers',
    description:'Pan-fried sea bass, samphire, lemon butter, new potatoes',
    modifierGroups:[
      { id:'sauce', label:'Sauce', required:true, multi:false,
        options:[{ id:'lb', label:'Lemon butter' },{ id:'none', label:'No sauce' }] },
    ]},

  { id:'m9',  name:'Wild mushroom risotto', cat:'mains', price:18.00, allergens:['milk'], centreId:'pc1', sales:234, type:'modifiers',
    description:'Arborio rice, wild mushrooms, truffle oil, Parmesan',
    modifierGroups:[
      { id:'xtra', label:'Add-ons', required:false, multi:true,
        options:[{ id:'chicken', label:'Add chicken', price:4.5 },{ id:'xtruf', label:'Extra truffle', price:3 }] },
    ]},

  { id:'m10', name:'Chicken supreme',   cat:'mains', price:22.00, allergens:['milk'], centreId:'pc1', sales:312, type:'simple',
    description:'Free-range chicken, dauphinoise, tenderstem broccoli, jus' },

  // ── Pizza ────────────────────────────────────────────────────────────────────
  { id:'m11', name:'Margherita',        cat:'pizza', price:14.00, allergens:['gluten','milk'], centreId:'pc3', sales:523, type:'pizza',
    description:'San Marzano tomato, fior di latte, fresh basil', defaultToppings:['cheese'] },

  { id:'m12', name:'Pepperoni',         cat:'pizza', price:15.50, allergens:['gluten','milk'], centreId:'pc3', sales:478, type:'pizza',
    description:'Spicy pepperoni, mozzarella, tomato base', defaultToppings:['pep','cheese'] },

  { id:'m13', name:"Truffle & mushroom",cat:'pizza', price:17.00, allergens:['gluten','milk'], centreId:'pc3', sales:187, type:'pizza',
    description:'White base, wild mushrooms, truffle oil, Parmesan', defaultToppings:['mush','truffle','cheese'] },

  { id:'m14', name:"N'duja & honey",    cat:'pizza', price:17.50, allergens:['gluten','milk'], centreId:'pc3', sales:156, type:'pizza',
    description:"Spicy n'duja, mozzarella, drizzled honey", defaultToppings:['nduja','cheese'] },

  { id:'m15', name:'Build your own',    cat:'pizza', price:12.00, allergens:['gluten','milk'], centreId:'pc3', sales:340, type:'pizza',
    description:'Choose size, base, crust & toppings', defaultToppings:[], isCustom:true },

  // ── Sides ────────────────────────────────────────────────────────────────────
  { id:'m16', name:'Triple-cooked chips', cat:'sides', price:4.50, allergens:['gluten'],           centreId:'pc1', sales:612, type:'simple' },
  { id:'m17', name:'Side salad',          cat:'sides', price:4.00, allergens:[],                   centreId:'pc2', sales:189, type:'simple' },
  { id:'m18', name:'Garlic bread',        cat:'sides', price:4.50, allergens:['gluten','milk'],    centreId:'pc1', sales:287, type:'simple' },
  { id:'m19', name:'Tenderstem broccoli', cat:'sides', price:4.50, allergens:[],                   centreId:'pc1', sales:167, type:'simple' },
  { id:'m20', name:'Onion rings',         cat:'sides', price:4.50, allergens:['gluten','milk','eggs'], centreId:'pc1', sales:198, type:'simple' },
  { id:'m20b',name:'Mac & cheese',        cat:'sides', price:6.50, allergens:['gluten','milk','eggs'], centreId:'pc1', sales:145, type:'simple' },

  // ── Desserts ─────────────────────────────────────────────────────────────────
  { id:'m21', name:'Tiramisu',           cat:'desserts', price:7.50, allergens:['gluten','eggs','milk'],  centreId:'pc2', sales:334, type:'simple',
    description:'Espresso-soaked Savoiardi, Mascarpone cream' },

  { id:'m22', name:'Panna cotta',        cat:'desserts', price:6.50, allergens:['milk'],                  centreId:'pc2', sales:212, type:'modifiers',
    description:'Vanilla panna cotta, raspberry coulis',
    modifierGroups:[
      { id:'cmp', label:'Compote', required:false, multi:false,
        options:[{ id:'rasp', label:'Raspberry (default)', price:0 },{ id:'mango', label:'Mango', price:0 },{ id:'none', label:'Plain', price:0 }] },
    ]},

  { id:'m23', name:'Affogato',           cat:'desserts', price:5.50, allergens:['milk'],                  centreId:'pc2', sales:167, type:'modifiers',
    description:'Vanilla ice cream, fresh espresso',
    modifierGroups:[
      { id:'shot', label:'Liqueur', required:false, multi:false,
        options:[{ id:'none', label:'No liqueur', price:0 },{ id:'amar', label:'Amaretto', price:2.5 },{ id:'kalh', label:'Kahlúa', price:2.5 }] },
    ]},

  { id:'m24', name:'Chocolate fondant', cat:'desserts', price:8.00, allergens:['gluten','eggs','milk'],    centreId:'pc2', sales:287, type:'modifiers',
    description:'Warm chocolate fondant, vanilla ice cream',
    modifierGroups:[
      { id:'ice', label:'Ice cream', required:false, multi:false,
        options:[{ id:'van', label:'Vanilla (included)', price:0 },{ id:'salted', label:'Salted caramel', price:0 },{ id:'none', label:'No ice cream', price:0 }] },
    ]},

  // ── Drinks ───────────────────────────────────────────────────────────────────
  { id:'m25', name:'Still water',       cat:'drinks', price:3.00, allergens:[], centreId:'pc4', sales:834, type:'variants',
    variants:[
      { id:'500ml', label:'500ml bottle', price:3.00   },
      { id:'750ml', label:'750ml bottle', price:4.50   },
      { id:'jug',   label:'Jug (1 litre)', price:5.00  },
    ]},

  { id:'m26', name:'Sparkling water',   cat:'drinks', price:3.50, allergens:[], centreId:'pc4', sales:712, type:'variants',
    variants:[
      { id:'330ml', label:'330ml bottle', price:3.50   },
      { id:'750ml', label:'750ml bottle', price:5.00   },
    ]},

  { id:'m27', name:'Peroni',            cat:'drinks', price:5.50, allergens:['gluten'], centreId:'pc4', sales:456, type:'variants',
    variants:[
      { id:'btl', label:'330ml bottle', price:5.50    },
      { id:'pt',  label:'Pint',         price:6.50    },
    ]},

  { id:'m28', name:'House red wine',    cat:'drinks', price:7.50, allergens:['sulphites'], centreId:'pc4', sales:398, type:'variants',
    description:'Montepulciano d\'Abruzzo',
    variants:[
      { id:'175', label:'175ml glass',  price:7.50    },
      { id:'250', label:'250ml glass',  price:10.50   },
      { id:'btl', label:'Bottle 750ml', price:28.00   },
    ]},

  { id:'m29', name:'House white wine',  cat:'drinks', price:7.50, allergens:['sulphites'], centreId:'pc4', sales:367, type:'variants',
    description:'Pinot Grigio delle Venezie',
    variants:[
      { id:'175', label:'175ml glass',  price:7.50    },
      { id:'250', label:'250ml glass',  price:10.50   },
      { id:'btl', label:'Bottle 750ml', price:28.00   },
    ]},

  { id:'m30', name:'Rosé wine',         cat:'drinks', price:8.00, allergens:['sulphites'], centreId:'pc4', sales:245, type:'variants',
    description:'Provence rosé, dry',
    variants:[
      { id:'175', label:'175ml glass',  price:8.00    },
      { id:'250', label:'250ml glass',  price:11.00   },
      { id:'btl', label:'Bottle 750ml', price:32.00   },
    ]},

  { id:'m31', name:'Prosecco',          cat:'drinks', price:9.00, allergens:['sulphites'], centreId:'pc4', sales:198, type:'variants',
    variants:[
      { id:'gls', label:'125ml glass',  price:9.00    },
      { id:'btl', label:'Bottle 750ml', price:38.00   },
    ]},

  { id:'m32', name:'Soft drink',        cat:'drinks', price:3.00, allergens:[], centreId:'pc4', sales:290, type:'variants',
    variants:[
      { id:'cola',    label:'Coca-Cola',      price:3.00 },
      { id:'dc',      label:'Diet Coke',      price:3.00 },
      { id:'sprite',  label:'Sprite',         price:3.00 },
      { id:'fever',   label:'Fever-Tree tonic',price:3.50 },
      { id:'oj',      label:'Fresh orange juice', price:3.50 },
    ]},

  { id:'m33', name:'Juice',             cat:'drinks', price:3.50, allergens:[], centreId:'pc4', sales:145, type:'variants',
    variants:[
      { id:'oj',   label:'Orange',      price:3.50 },
      { id:'appl', label:'Apple',       price:3.50 },
      { id:'pine', label:'Pineapple',   price:3.50 },
      { id:'cran', label:'Cranberry',   price:3.50 },
    ]},

  // ── Cocktails ────────────────────────────────────────────────────────────────
  { id:'m34', name:'Negroni',           cat:'cocktails', price:11.00, allergens:['sulphites'], centreId:'pc4', sales:278, type:'modifiers',
    description:'Gin, Campari, sweet vermouth',
    modifierGroups:[
      { id:'base', label:'Spirit', required:true, multi:false,
        options:[{ id:'gin', label:'House gin', price:0 },{ id:'pregm', label:'Tanqueray', price:2 },{ id:'hend', label:'Hendrick\'s', price:3 }] },
    ]},

  { id:'m35', name:'Old Fashioned',     cat:'cocktails', price:12.00, allergens:[], centreId:'pc4', sales:234, type:'modifiers',
    description:'Bourbon, sugar, Angostura bitters, orange peel',
    modifierGroups:[
      { id:'base', label:'Whiskey', required:true, multi:false,
        options:[{ id:'maker', label:'Maker\'s Mark', price:0 },{ id:'woodf', label:'Woodford Reserve', price:3 },{ id:'bfm', label:'Buffalo Trace', price:2 }] },
    ]},

  { id:'m36', name:'Espresso Martini',  cat:'cocktails', price:12.50, allergens:[], centreId:'pc4', sales:312, type:'modifiers',
    description:'Vodka, Kahlúa, fresh espresso',
    modifierGroups:[
      { id:'shots', label:'Espresso shots', required:false, multi:false,
        options:[{ id:'s1', label:'Single shot', price:0 },{ id:'s2', label:'Double shot', price:0 }] },
    ]},

  { id:'m37', name:'Margarita',         cat:'cocktails', price:11.50, allergens:[], centreId:'pc4', sales:198, type:'modifiers',
    description:'Tequila, triple sec, fresh lime',
    modifierGroups:[
      { id:'style', label:'Style', required:true, multi:false,
        options:[{ id:'rocks', label:'On the rocks' },{ id:'frozen', label:'Frozen' },{ id:'straight', label:'Straight up' }] },
      { id:'rim', label:'Rim', required:false, multi:false,
        options:[{ id:'salt', label:'Salt rim', price:0 },{ id:'sugar', label:'Sugar rim', price:0 },{ id:'no', label:'No rim', price:0 }] },
    ]},

  { id:'m38', name:'Aperol Spritz',     cat:'cocktails', price:10.50, allergens:['sulphites'], centreId:'pc4', sales:267, type:'simple',
    description:'Aperol, Prosecco, soda, orange' },

  { id:'m39', name:'Mojito',            cat:'cocktails', price:11.00, allergens:[], centreId:'pc4', sales:189, type:'modifiers',
    description:'White rum, fresh mint, lime, sugar, soda',
    modifierGroups:[
      { id:'style', label:'Style', required:false, multi:false,
        options:[{ id:'classic', label:'Classic', price:0 },{ id:'passion', label:'Passion fruit', price:1.5 },{ id:'straw', label:'Strawberry', price:1.5 }] },
    ]},
];

// ─── Quick screen ─────────────────────────────────────────────────────────────
export const QUICK_IDS = ['m11','m7','m36','m28','m12','m25','m2','m16','m6','m21','m34','m38'];

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
