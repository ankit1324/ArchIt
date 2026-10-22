

/* ============================== catalog ============================== */
const C = {
  rooms:{
    bedroom:{name:'Bedroom', w:3.0, len:3.6, fill:'#f6ede0', floor:'#e8d9c3'},
    hall:   {name:'Hall',    w:3.6, len:4.8, fill:'#e9eff8', floor:'#dfe6ef'},
    hallway:{name:'Hallway', w:1.4, len:3.6, fill:'#f1eee8', floor:'#e2ddd2'},
    kitchen:{name:'Kitchen', w:2.4, len:3.0, fill:'#fdeef2', floor:'#f0d9c9'},
    bath:   {name:'Bathroom',w:1.8, len:2.4, fill:'#e4f1ef', floor:'#cfe4e6'},
    balcony:{name:'Balcony', w:1.5, len:3.0, fill:'#eef4e7', floor:'#d9e4cf', open:true},
    veranda:{name:'Veranda', w:2.4, len:3.6, fill:'#f7f1e3', floor:'#e6dcc4', open:true},
    stairs: {name:'Stairs',  w:1.2, len:3.0, fill:'#ececf4', floor:'#dcdce8'},
  },
  paint:{
    white:{name:'White', hex:'#f4f2ec'},
    cream:{name:'Cream', hex:'#e9dcbe'},
    beige:{name:'Beige', hex:'#e3d5c3'},
    gray: {name:'Gray',  hex:'#cfd4da'},
    greige:{name:'Greige', hex:'#d6d0c4'},
    mint: {name:'Mint',  hex:'#d8e8e0'},
    sage: {name:'Sage',  hex:'#ccd6c5'},
    blush:{name:'Blush', hex:'#f2dede'},
    terra:{name:'Terra', hex:'#e0b9a6'},
    lavender:{name:'Lavender', hex:'#e2ddf0'},
  },
  facade:{
    white:{name:'White', hex:'#f4f2ec'},
    ivory:{name:'Ivory', hex:'#efe8d8'},
    sand: {name:'Sand',  hex:'#e9dcbe'},
    clay: {name:'Clay',  hex:'#d9a08c'},
    terracotta:{name:'Terracotta', hex:'#c97b5d'},
    brickred:{name:'Brick red', hex:'#96604e'},
    darkbrick:{name:'Dark brick', hex:'#5c4740'},
    sage: {name:'Sage',  hex:'#cfd8c4'},
    olive:{name:'Olive', hex:'#a8ad8e'},
    sky:  {name:'Sky',   hex:'#c9d7e4'},
    steel:{name:'Steel', hex:'#8ea3b5'},
    graphite:{name:'Graphite', hex:'#6b7280'},
    charcoal:{name:'Charcoal', hex:'#3f4650'},
    black:{name:'Black', hex:'#26292e'},
  },
  facadeMat:{
    paint:{name:'Smooth paint'},
    wood:{name:'Wood slats'},
    brick:{name:'Brick'},
    concrete:{name:'Concrete'},
    fluted_wood:{name:'Fluted wood'},
    stone_cladding:{name:'Stone cladding'},
    metal_panel:{name:'Metal panels'},
    stucco_matte:{name:'Matte stucco'},
  },
  roofStyle:{
    flat:{name:'Flat'},
    overhang:{name:'Flat + overhang'},
    parapet:{name:'Parapet'},
    gable:{name:'Low gable'},
    gabled:{name:'Gabled + skylights'},
    monoslope:{name:'Monoslope'},
    butterfly:{name:'Butterfly'},
    cantilever_flat:{name:'Cantilever flat'},
    green_roof:{name:'Green roof'},
  },
  roofCol:{
    light:{name:'Light', hex:'#e9ebef'},
    zinc: {name:'Zinc',  hex:'#b8bfc9'},
    slate:{name:'Slate', hex:'#8a94a3'},
    graphite:{name:'Graphite', hex:'#5b6470'},
    charcoal:{name:'Charcoal', hex:'#3f4650'},
    black:{name:'Black', hex:'#23262b'},
    clay: {name:'Clay',  hex:'#b0705c'},
    copper:{name:'Copper', hex:'#9c6b4f'},
  },
  floorCol:{
    oak:  {name:'Oak',   hex:'#d9bc93'},
    honey:{name:'Honey', hex:'#c9a06b'},
    walnut:{name:'Walnut', hex:'#8a6a4f'},
    ash:  {name:'Ash',   hex:'#e4ded2'},
    wtile:{name:'White tile', hex:'#eceff1'},
    gtile:{name:'Grey tile',  hex:'#b9c0c7'},
    terra:{name:'Terracotta', hex:'#c98a6a'},
    slate:{name:'Slate', hex:'#6d757e'},
  },
  floorMat:{
    plank:{name:'Wood planks'},
    tile:{name:'Ceramic tile'},
    marble:{name:'Marble'},
    terrazzo:{name:'Terrazzo'},
    carpet:{name:'Carpet'},
    concrete:{name:'Concrete'},
  },
  wallMat:{
    plaster:{name:'Plaster'},
    wallpaper:{name:'Wallpaper'},
    concrete:{name:'Concrete'},
  },
  furniture:{
    // Living
    sofa:      {name:'3-seat sofa',   w:2.0, d:0.9, h:1.05, cat:'living'},
    sofa_l:    {name:'L-shaped sofa', w:2.4, d:1.6, h:1.05, cat:'living'},
    armchair:  {name:'Armchair',      w:0.9, d:0.9, h:1.0,  cat:'living'},
    coffee:    {name:'Coffee table',  w:0.9, d:0.55,h:0.42, cat:'living'},
    tv:        {name:'TV & media',    w:1.4, d:0.4, h:1.5,  cat:'living'},
    side_table:{name:'Side table',    w:0.5, d:0.5, h:0.55, cat:'living'},
    floor_lamp:{name:'Floor lamp',    w:0.4, d:0.4, h:1.6,  cat:'living'},
    plant:     {name:'Plant',         w:0.45,d:0.45,h:1.2,  cat:'living'},
    // Bedroom
    bed:       {name:'Double bed',    w:1.6, d:2.0, h:0.9,  cat:'bedroom'},
    bed_single:{name:'Single bed',    w:1.0, d:2.0, h:0.8,  cat:'bedroom'},
    wardrobe:  {name:'Wardrobe',      w:1.8, d:0.6, h:2.2,  cat:'bedroom'},
    dresser:   {name:'Dresser',       w:1.2, d:0.5, h:0.8,  cat:'bedroom'},
    nightstand:{name:'Nightstand',    w:0.45,d:0.4, h:0.5,  cat:'bedroom'},
    bookshelf: {name:'Bookshelf',     w:0.9, d:0.35,h:1.9,  cat:'bedroom'},
    // Kitchen & dining
    kunit:     {name:'Kitchen unit',  w:1.8, d:0.6, h:1.1,  cat:'kitchen'},
    fridge:    {name:'Fridge',        w:0.7, d:0.7, h:1.9,  cat:'kitchen'},
    oven:      {name:'Oven',          w:0.6, d:0.6, h:0.9,  cat:'kitchen'},
    table:     {name:'Dining table',  w:1.4, d:0.8, h:0.9,  cat:'kitchen'},
    chair:     {name:'Chair',         w:0.45,d:0.45,h:0.9,  cat:'kitchen'},
    bar_stool: {name:'Bar stool',     w:0.4, d:0.4, h:1.05, cat:'kitchen'},
    // Bath
    toilet:    {name:'Toilet',        w:0.4, d:0.65,h:1.05, cat:'bath'},
    basin:     {name:'Washbasin',     w:0.5, d:0.4, h:1.0,  cat:'bath'},
    shower:    {name:'Shower',        w:0.9, d:0.9, h:2.2,  cat:'bath'},
    bath:      {name:'Bathtub',       w:1.7, d:0.75,h:0.75, cat:'bath'},
    mirror_cab:{name:'Mirror cabinet',w:0.6, d:0.15,h:0.8,  cat:'bath'},
    // Office & decor
    desk:      {name:'Desk',          w:1.2, d:0.6, h:0.9,  cat:'office'},
    office_chair:{name:'Office chair', w:0.6, d:0.6, h:1.1, cat:'office'},
    wall_art:  {name:'Wall art',      w:0.8, d:0.05,h:0.6,  cat:'office'},
    rug:       {name:'Area rug',      w:1.6, d:1.1, h:0.02, cat:'office'},
    ceiling_light:{name:'Ceiling light',w:0.4,d:0.4,h:0.3,  cat:'office'},
    walllamp:  {name:'Wall lamp',     w:0.16,d:0.16,h:2.4,  cat:'office'},
  },
  roomMin:1.2, roomMax:8,
  doors:{
    ext_hard:{name:'Hardboard door', grp:'EXTERIOR DOORS'},
    ext_metal:{name:'Metal door',    grp:'EXTERIOR DOORS'},
    ext_plastic:{name:'Plastic door',grp:'EXTERIOR DOORS'},
    ext_glass:{name:'Sliding glass door', grp:'EXTERIOR DOORS'},
    int_hard:{name:'Hardboard door', grp:'INTERIOR DOORS'},
    int_mdf:{name:'MDF door',        grp:'INTERIOR DOORS'},
    int_pvc:{name:'PVC door',        grp:'INTERIOR DOORS'},
    int_panel:{name:'Paneled door',  grp:'INTERIOR DOORS'},
  },
  W:2.45, H:2.75,
};

const MODERN_PRESETS = {
  japandi:{name:'Japandi Minimal', paint:'cream', facade:'sand', facadeMat:'fluted_wood', roofStyle:'cantilever_flat', roofCol:'charcoal'},
  nordic:{name:'Nordic Timber', paint:'white', facade:'darkbrick', facadeMat:'fluted_wood', roofStyle:'monoslope', roofCol:'zinc'},
  stone:{name:'Contemporary Stone', paint:'greige', facade:'ivory', facadeMat:'stone_cladding', roofStyle:'cantilever_flat', roofCol:'graphite'},
  monolith:{name:'Modern Monolith', paint:'gray', facade:'graphite', facadeMat:'stucco_matte', roofStyle:'monoslope', roofCol:'black'},
};
function assertModernExteriorCatalog(){
  Object.entries(MODERN_PRESETS).forEach(([key,preset])=>{
    ['paint','facade','facadeMat','roofStyle','roofCol'].forEach(field=>{
      if(!C[field][preset[field]]) throw new Error('Invalid '+field+' in preset '+key);
    });
  });
  ['fluted_wood','stone_cladding','metal_panel','stucco_matte'].forEach(key=>{
    if(!C.facadeMat[key]?.name) throw new Error('Missing facade material '+key);
  });
  ['monoslope','butterfly','cantilever_flat','green_roof'].forEach(key=>{
    if(!C.roofStyle[key]?.name) throw new Error('Missing roof style '+key);
  });
  return true;
}
assertModernExteriorCatalog();

export {C, MODERN_PRESETS};
