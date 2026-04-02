export type ObjectType =
  | 'business-cards' | 'letterhead' | 'phone-screen' | 'laptop-screen'
  | 'desktop-monitor' | 'imac'
  | 'book-magazine' | 'product-box' | 'shopping-bag' | 'tshirt'
  | 'tote-bag' | 'poster-print' | 'coffee-mug' | 'bottle-label'
  | 'signage' | 'notebook' | 'brand-identity' | 'vinyl-cd' | 'billboard'
  | 'restaurant-menu' | 'bus-ad' | 'bus-stop' | 'flag' | 'pull-up-banner';

export type CameraAngle =
  | 'top-down' | 'three-quarter' | 'eye-level' | 'low-angle'
  | 'macro' | 'isometric' | 'dutch-tilt' | 'custom';

export type SurfaceType =
  | 'white-marble' | 'terrazzo' | 'concrete' | 'dark-slate'
  | 'light-oak' | 'dark-walnut' | 'linen-fabric' | 'leather'
  | 'kraft-paper' | 'ceramic-tile' | 'brushed-metal' | 'glass';

export type SettingType =
  | 'white-studio' | 'dark-studio' | 'sunlit-natural' | 'cafe-table'
  | 'office-desk' | 'kitchen-counter' | 'botanical' | 'urban'
  | 'gradient-backdrop' | 'plaster-wall';

export type LightingType =
  | 'window-pane' | 'tree-dappled' | 'venetian-blinds' | 'soft-arch'
  | 'ring-light' | 'golden-hour' | 'clean-studio'
  | 'neon-glow' | 'candlelight' | 'overcast' | 'harsh-midday'
  | 'backlit-silhouette' | 'spotlight' | 'fluorescent';

export type MaterialType = 'matte' | 'linen' | 'recycled' | 'glass' | 'metal';

export type ImageRatio = '1:1' | '4:5' | '4:3' | '3:2' | '16:9' | '21:9' | '9:16' | '2:3';

export type AssetInputType = 'transparent-logo' | 'screenshot' | 'design-custom';

export type PropType =
  | 'coffee-cup' | 'plant' | 'pen-pencil' | 'glasses' | 'watch'
  | 'phone' | 'flowers' | 'fabric-swatch' | 'color-chips' | 'keyboard'
  | 'book' | 'candle' | 'fruit' | 'stones' | 'headphones' | 'camera';

export type HandMode = 'none' | 'holding' | 'near' | 'placing';

export type ScreenEffectType = 'reflection' | 'glare' | 'light-leak';

export type ImperfectionType =
  | 'surface-dust' | 'fingerprints' | 'water-ring' | 'micro-scratches'
  | 'screen-scratches' | 'screen-smudge'
  | 'fabric-lint' | 'loose-thread' | 'pilling'
  | 'paper-dog-ear' | 'ink-bleed' | 'paper-aging'
  | 'scuff-marks' | 'patina' | 'chipped-edge';

export interface CustomAngle {
  pitch: number;
  yaw: number;
}

// ── Per-object option registry ──────────────────────────────────────────────

export interface ObjectOptionDef {
  key: string;
  label: string;
  choices: { id: string; label: string; prompt: string }[];
  default: string;
}

export function getObjectDefaults(obj: ObjectType): Record<string, string> {
  const defs = OBJECT_OPTIONS[obj] ?? [];
  return Object.fromEntries(defs.map(d => [d.key, d.default]));
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface MockupConfig {
  object: ObjectType;
  objectDetails: Record<string, string>;
  camera: CameraAngle;
  customAngle: CustomAngle | null;
  surface: SurfaceType;
  setting: SettingType;
  lighting: LightingType;
  intensity: number;
  material: MaterialType;
  assetDescription: string;
  colorPalette?: string;
  swatchColors: string[];
  imageRatio: ImageRatio;
  assetInput: AssetInputType;
  assetDimensions?: string;
  props: PropType[];
  hand: HandMode;
  screenEffects: ScreenEffectType[];
  imperfections: ImperfectionType[];
  infiniteBackground: boolean;
  infiniteBgColor: string;
}

// ── Object categories for conditional UI ────────────────────────────────────

export const PRINT_OBJECTS: ObjectType[] = [
  'business-cards', 'letterhead', 'book-magazine', 'product-box',
  'poster-print', 'notebook', 'brand-identity', 'vinyl-cd', 'shopping-bag',
  'restaurant-menu',
];

export const FABRIC_OBJECTS: ObjectType[] = [
  'tshirt', 'tote-bag', 'flag',
];

export const SCREEN_OBJECTS: ObjectType[] = [
  'phone-screen', 'laptop-screen', 'desktop-monitor', 'imac',
];

export const SIGNAGE_OBJECTS: ObjectType[] = [
  'signage', 'billboard', 'bus-ad', 'bus-stop', 'pull-up-banner',
];

// ── Constants ───────────────────────────────────────────────────────────────

export const OBJECTS = [
  { id: 'business-cards', label: 'Business Cards' },
  { id: 'letterhead', label: 'Letterhead Set' },
  { id: 'phone-screen', label: 'Phone Screen' },
  { id: 'laptop-screen', label: 'Laptop Screen' },
  { id: 'desktop-monitor', label: 'Desktop Monitor' },
  { id: 'imac', label: 'iMac' },
  { id: 'book-magazine', label: 'Book / Magazine' },
  { id: 'product-box', label: 'Product Box' },
  { id: 'shopping-bag', label: 'Shopping Bag' },
  { id: 'tshirt', label: 'T-Shirt' },
  { id: 'tote-bag', label: 'Tote Bag' },
  { id: 'poster-print', label: 'Poster / Print' },
  { id: 'coffee-mug', label: 'Coffee Mug' },
  { id: 'bottle-label', label: 'Bottle / Label' },
  { id: 'signage', label: 'Signage' },
  { id: 'notebook', label: 'Notebook' },
  { id: 'brand-identity', label: 'Brand Identity Set' },
  { id: 'vinyl-cd', label: 'Vinyl / CD Cover' },
  { id: 'billboard', label: 'Billboard' },
  { id: 'restaurant-menu', label: 'Restaurant Menu' },
  { id: 'bus-ad', label: 'Bus Advertising' },
  { id: 'bus-stop', label: 'Bus Stop Ad' },
  { id: 'flag', label: 'Flag / Banner' },
  { id: 'pull-up-banner', label: 'Pull-Up Banner' },
] as const;

export const CAMERAS = [
  { id: 'top-down', label: 'Top-down Flat Lay' },
  { id: 'three-quarter', label: '45° Three-Quarter' },
  { id: 'eye-level', label: 'Straight-on Eye Level' },
  { id: 'low-angle', label: 'Low Angle Hero' },
  { id: 'macro', label: 'Macro Close-up' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'dutch-tilt', label: 'Dutch Tilt' },
  { id: 'custom', label: '3D Custom Angle' },
] as const;

export const SURFACES = [
  { id: 'white-marble', label: 'White Marble' },
  { id: 'terrazzo', label: 'Terrazzo' },
  { id: 'concrete', label: 'Smooth Concrete' },
  { id: 'dark-slate', label: 'Dark Slate' },
  { id: 'light-oak', label: 'Light Oak Wood' },
  { id: 'dark-walnut', label: 'Dark Walnut Wood' },
  { id: 'linen-fabric', label: 'Linen Fabric' },
  { id: 'leather', label: 'Leather' },
  { id: 'kraft-paper', label: 'Kraft Paper' },
  { id: 'ceramic-tile', label: 'Ceramic Tile' },
  { id: 'brushed-metal', label: 'Brushed Metal' },
  { id: 'glass', label: 'Glass' },
] as const;

export const SETTINGS = [
  { id: 'white-studio', label: 'Minimal White Studio' },
  { id: 'dark-studio', label: 'Dark Moody Studio' },
  { id: 'sunlit-natural', label: 'Sunlit Natural' },
  { id: 'cafe-table', label: 'Cafe Table' },
  { id: 'office-desk', label: 'Office Desk' },
  { id: 'kitchen-counter', label: 'Kitchen Counter' },
  { id: 'botanical', label: 'Botanical / Greenery' },
  { id: 'urban', label: 'Urban / Architectural' },
  { id: 'gradient-backdrop', label: 'Gradient Backdrop' },
  { id: 'plaster-wall', label: 'Textured Plaster Wall' },
] as const;

export const LIGHTINGS = [
  { id: 'window-pane', label: 'Window Pane' },
  { id: 'tree-dappled', label: 'Tree Leaves' },
  { id: 'venetian-blinds', label: 'Venetian Blinds' },
  { id: 'soft-arch', label: 'Soft Arch' },
  { id: 'ring-light', label: 'Ring Light' },
  { id: 'golden-hour', label: 'Golden Hour' },
  { id: 'clean-studio', label: 'Clean Studio' },
  { id: 'neon-glow', label: 'Neon Glow' },
  { id: 'candlelight', label: 'Candlelight' },
  { id: 'overcast', label: 'Overcast / Diffused' },
  { id: 'harsh-midday', label: 'Harsh Midday Sun' },
  { id: 'backlit-silhouette', label: 'Backlit / Silhouette' },
  { id: 'spotlight', label: 'Spotlight' },
  { id: 'fluorescent', label: 'Fluorescent' },
] as const;

export const MATERIALS = [
  { id: 'matte', label: 'Matte Paper' },
  { id: 'linen', label: 'Linen Texture' },
  { id: 'recycled', label: 'Recycled Fiber' },
  { id: 'glass', label: 'Clear Glass' },
  { id: 'metal', label: 'Brushed Metal' },
] as const;

export const IMAGE_RATIOS = [
  { id: '1:1', label: 'Square 1:1' },
  { id: '4:5', label: 'Portrait 4:5' },
  { id: '4:3', label: 'Classic 4:3' },
  { id: '3:2', label: 'Photo 3:2' },
  { id: '16:9', label: 'Wide 16:9' },
  { id: '21:9', label: 'Ultra Wide 21:9' },
  { id: '9:16', label: 'Vertical 9:16' },
  { id: '2:3', label: 'Tall 2:3' },
] as const;

export const ASSET_INPUTS = [
  { id: 'transparent-logo', label: 'Transparent Logo PNG' },
  { id: 'screenshot', label: 'Screenshot' },
  { id: 'design-custom', label: 'Design (custom size)' },
] as const;

export const PROPS = [
  { id: 'coffee-cup', label: 'Coffee Cup' },
  { id: 'plant', label: 'Plant / Succulent' },
  { id: 'pen-pencil', label: 'Pen & Pencil' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'watch', label: 'Watch' },
  { id: 'phone', label: 'Phone' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'fabric-swatch', label: 'Fabric Swatch' },
  { id: 'color-chips', label: 'Color Chips' },
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'book', label: 'Book' },
  { id: 'candle', label: 'Candle' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'stones', label: 'Stones / Pebbles' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'camera', label: 'Camera' },
] as const;

export const HANDS = [
  { id: 'none', label: 'No Hand' },
  { id: 'holding', label: 'Holding' },
  { id: 'near', label: 'Hand Nearby' },
  { id: 'placing', label: 'Placing Down' },
] as const;

export const SCREEN_EFFECTS = [
  { id: 'reflection', label: 'Screen Reflection' },
  { id: 'glare', label: 'Light Glare' },
  { id: 'light-leak', label: 'Light Leak' },
] as const;

export const IMPERFECTIONS_UNIVERSAL = [
  { id: 'surface-dust', label: 'Surface Dust' },
  { id: 'fingerprints', label: 'Fingerprints' },
  { id: 'water-ring', label: 'Water Ring Mark' },
  { id: 'micro-scratches', label: 'Micro Scratches' },
] as const;

export const IMPERFECTIONS_SCREEN = [
  { id: 'screen-scratches', label: 'Hairline Scratches' },
  { id: 'screen-smudge', label: 'Finger Smudge' },
] as const;

export const IMPERFECTIONS_FABRIC = [
  { id: 'fabric-lint', label: 'Minuscule Lint' },
  { id: 'loose-thread', label: 'Loose Thread' },
  { id: 'pilling', label: 'Fabric Pilling' },
] as const;

export const IMPERFECTIONS_PRINT = [
  { id: 'paper-dog-ear', label: 'Dog-eared Corner' },
  { id: 'ink-bleed', label: 'Subtle Ink Bleed' },
  { id: 'paper-aging', label: 'Paper Aging / Yellowing' },
] as const;

export const IMPERFECTIONS_HARD = [
  { id: 'scuff-marks', label: 'Scuff Marks' },
  { id: 'patina', label: 'Natural Patina' },
  { id: 'chipped-edge', label: 'Chipped Edge' },
] as const;

// ── Per-Object Options Registry ─────────────────────────────────────────────

export const OBJECT_OPTIONS: Partial<Record<ObjectType, ObjectOptionDef[]>> = {

  // ── PRINT ──────────────────────────────────────────────────
  'business-cards': [
    { key: 'corner', label: 'Corner Type', default: 'sharp', choices: [
      { id: 'sharp', label: 'Sharp', prompt: 'with sharp precisely cut 90-degree corners' },
      { id: 'rounded', label: 'Rounded', prompt: 'with softly rounded corners' },
      { id: 'die-cut', label: 'Die-Cut', prompt: 'with custom die-cut decorative corners' },
    ]},
    { key: 'thickness', label: 'Card Thickness', default: 'standard', choices: [
      { id: 'standard', label: 'Standard', prompt: 'on standard 300gsm card stock' },
      { id: 'thick', label: 'Thick', prompt: 'on thick 600gsm luxury card stock with visible edge layers' },
      { id: 'ultra-thick', label: 'Ultra-Thick', prompt: 'on ultra-thick 900gsm triple-layered card stock with dramatic edge profile' },
    ]},
    { key: 'orientation', label: 'Orientation', default: 'landscape', choices: [
      { id: 'landscape', label: 'Landscape', prompt: 'in horizontal landscape orientation' },
      { id: 'portrait', label: 'Portrait', prompt: 'in vertical portrait orientation' },
    ]},
    { key: 'finish', label: 'Special Finish', default: 'none', choices: [
      { id: 'none', label: 'None', prompt: '' },
      { id: 'gold-foil', label: 'Gold Foil', prompt: 'with gold foil stamping catching the light with warm metallic sheen' },
      { id: 'silver-foil', label: 'Silver Foil', prompt: 'with silver foil accents reflecting cool metallic light' },
      { id: 'spot-uv', label: 'Spot UV', prompt: 'with spot UV varnish creating glossy raised areas against the matte surface' },
      { id: 'emboss', label: 'Embossed', prompt: 'with blind embossed elements creating tactile raised texture' },
      { id: 'letterpress', label: 'Letterpress', prompt: 'with deep letterpress impressions pressed into the thick stock' },
    ]},
  ],

  'letterhead': [
    { key: 'paper-size', label: 'Paper Size', default: 'a4', choices: [
      { id: 'a4', label: 'A4', prompt: 'printed on A4 paper (210x297mm)' },
      { id: 'letter', label: 'US Letter', prompt: 'printed on US Letter size paper (8.5x11in)' },
      { id: 'legal', label: 'Legal', prompt: 'printed on legal size paper (8.5x14in)' },
    ]},
    { key: 'fold', label: 'Fold', default: 'none', choices: [
      { id: 'none', label: 'Flat', prompt: 'lying completely flat and unfolded' },
      { id: 'bi-fold', label: 'Bi-Fold', prompt: 'with a single center bi-fold crease' },
      { id: 'tri-fold', label: 'Tri-Fold', prompt: 'tri-folded into three equal panels' },
    ]},
  ],

  'book-magazine': [
    { key: 'binding', label: 'Binding', default: 'perfect', choices: [
      { id: 'perfect', label: 'Perfect Bound', prompt: 'with professional perfect binding and flat spine' },
      { id: 'saddle-stitch', label: 'Saddle Stitch', prompt: 'saddle-stitched with visible staples at the spine fold' },
      { id: 'hardcover', label: 'Hardcover', prompt: 'in a rigid hardcover binding with cloth-wrapped boards' },
      { id: 'spiral', label: 'Spiral', prompt: 'spiral-bound with a metal coil spine' },
    ]},
    { key: 'page-edges', label: 'Page Edges', default: 'white', choices: [
      { id: 'white', label: 'White', prompt: 'with clean white page edges' },
      { id: 'gilt', label: 'Gilt', prompt: 'with luxurious gilt gold-edged pages' },
      { id: 'rough-cut', label: 'Rough-Cut', prompt: 'with rough-cut deckle-edged pages showing natural fiber texture' },
    ]},
  ],

  'poster-print': [
    { key: 'mounting', label: 'Mounting', default: 'framed', choices: [
      { id: 'none', label: 'Loose Print', prompt: 'as a loose unframed print' },
      { id: 'foam-board', label: 'Foam Board', prompt: 'mounted on rigid foam board with clean edges' },
      { id: 'framed', label: 'Framed', prompt: 'displayed in a gallery frame' },
      { id: 'rolled', label: 'Rolled', prompt: 'loosely rolled with one corner curling open to reveal the artwork' },
      { id: 'taped', label: 'Taped to Wall', prompt: 'taped directly to the wall with visible tape at corners' },
      { id: 'clipped', label: 'Clipped', prompt: 'hanging from minimal binder clips on a wire' },
    ]},
    { key: 'frame-color', label: 'Frame Color', default: 'white', choices: [
      { id: 'white', label: 'White', prompt: 'with a clean white frame and white mat border' },
      { id: 'black', label: 'Black', prompt: 'with a sleek black frame and dark mat' },
      { id: 'natural-wood', label: 'Natural Wood', prompt: 'with a natural oak wood frame showing warm grain' },
      { id: 'gold', label: 'Gold', prompt: 'with an elegant thin gold frame' },
      { id: 'none', label: 'No Frame', prompt: '' },
    ]},
    { key: 'location', label: 'Location', default: 'indoor-wall', choices: [
      { id: 'indoor-wall', label: 'Indoor Wall', prompt: 'hung on a clean interior wall in a gallery or home setting' },
      { id: 'outdoor-wall', label: 'Outdoor Wall', prompt: 'mounted on an outdoor exterior wall with urban character' },
      { id: 'gallery', label: 'Gallery', prompt: 'displayed in a minimalist art gallery with white walls and track lighting' },
      { id: 'cafe', label: 'Cafe / Shop', prompt: 'displayed on a wall inside a trendy cafe or retail space' },
    ]},
    { key: 'people', label: 'People', default: 'none', choices: [
      { id: 'none', label: 'None', prompt: '' },
      { id: 'blurred-walking', label: 'Blurred Walking', prompt: 'with blurred silhouettes of people walking past in the foreground, creating motion and scale' },
      { id: 'viewing', label: 'Viewing', prompt: 'with a person standing nearby viewing the poster, establishing scale' },
    ]},
    { key: 'size', label: 'Print Size', default: 'a2', choices: [
      { id: 'a3', label: 'A3', prompt: 'at A3 size (297x420mm)' },
      { id: 'a2', label: 'A2', prompt: 'at A2 poster size (420x594mm)' },
      { id: 'a1', label: 'A1', prompt: 'at large A1 size (594x841mm)' },
      { id: 'a0', label: 'A0', prompt: 'at monumental A0 size (841x1189mm)' },
    ]},
  ],

  'notebook': [
    { key: 'closure', label: 'Closure', default: 'elastic', choices: [
      { id: 'elastic', label: 'Elastic Band', prompt: 'with an elastic closure band wrapped around the cover' },
      { id: 'strap', label: 'Leather Strap', prompt: 'with a leather wrap-around strap closure' },
      { id: 'none', label: 'None', prompt: 'with no closure, cover edge visible' },
    ]},
    { key: 'binding', label: 'Binding', default: 'stitched', choices: [
      { id: 'stitched', label: 'Stitched', prompt: 'with exposed coptic stitch binding at the spine' },
      { id: 'spiral', label: 'Spiral', prompt: 'with a metal spiral coil binding' },
      { id: 'perfect', label: 'Perfect Bound', prompt: 'with a clean perfect-bound glued spine' },
    ]},
    { key: 'page-style', label: 'Page Style', default: 'blank', choices: [
      { id: 'blank', label: 'Blank', prompt: 'with blank unlined pages faintly visible at the edges' },
      { id: 'lined', label: 'Lined', prompt: 'with ruled lined pages faintly visible at the edges' },
      { id: 'dot-grid', label: 'Dot Grid', prompt: 'with dot-grid pages faintly visible at the edges' },
    ]},
  ],

  'vinyl-cd': [
    { key: 'format', label: 'Format', default: 'vinyl-12in', choices: [
      { id: 'vinyl-12in', label: '12" Vinyl', prompt: 'as a full-size 12-inch vinyl record with large sleeve artwork' },
      { id: 'vinyl-7in', label: '7" Vinyl', prompt: 'as a 7-inch single vinyl record with compact sleeve' },
      { id: 'cd', label: 'CD', prompt: 'as a compact disc with jewel case packaging' },
      { id: 'cassette', label: 'Cassette', prompt: 'as a retro cassette tape with printed J-card insert' },
    ]},
    { key: 'sleeve', label: 'Sleeve Type', default: 'single', choices: [
      { id: 'gatefold', label: 'Gatefold', prompt: 'with a gatefold sleeve opened to reveal inner artwork' },
      { id: 'single', label: 'Single Sleeve', prompt: 'with a standard single sleeve' },
    ]},
  ],

  // ── PACKAGING ──────────────────────────────────────────────
  'product-box': [
    { key: 'box-type', label: 'Box Type', default: 'tuck-end', choices: [
      { id: 'tuck-end', label: 'Tuck End', prompt: 'as a standard tuck-end box with folded closure flaps' },
      { id: 'magnetic', label: 'Magnetic', prompt: 'as a premium magnetic closure box with rigid walls' },
      { id: 'sleeve', label: 'Sleeve', prompt: 'as a sliding sleeve box with inner tray' },
      { id: 'rigid', label: 'Rigid', prompt: 'as a luxury rigid setup box with lift-off lid' },
    ]},
    { key: 'window', label: 'Window', default: 'none', choices: [
      { id: 'none', label: 'Solid', prompt: 'with solid opaque panels on all sides' },
      { id: 'die-cut-window', label: 'Die-Cut Window', prompt: 'with a die-cut window revealing the product inside' },
      { id: 'clear-lid', label: 'Clear Lid', prompt: 'with a transparent clear lid showing contents from above' },
    ]},
  ],

  'shopping-bag': [
    { key: 'handle-type', label: 'Handle Type', default: 'rope', choices: [
      { id: 'rope', label: 'Rope', prompt: 'with thick cotton rope handles' },
      { id: 'ribbon', label: 'Ribbon', prompt: 'with flat satin ribbon handles' },
      { id: 'die-cut', label: 'Die-Cut', prompt: 'with die-cut integral handles punched from the bag material' },
      { id: 'twisted-paper', label: 'Twisted Paper', prompt: 'with twisted kraft paper handles' },
    ]},
    { key: 'bag-material', label: 'Bag Material', default: 'kraft', choices: [
      { id: 'kraft', label: 'Kraft', prompt: 'made from natural brown kraft paper with visible fiber texture' },
      { id: 'matte-laminate', label: 'Matte Laminate', prompt: 'with a smooth matte laminated finish' },
      { id: 'glossy', label: 'Glossy', prompt: 'with a high-gloss laminated surface reflecting light sharply' },
    ]},
  ],

  // ── FABRIC ─────────────────────────────────────────────────
  'tshirt': [
    { key: 'fit', label: 'Fit', default: 'regular', choices: [
      { id: 'regular', label: 'Regular', prompt: 'in a classic regular fit silhouette' },
      { id: 'oversized', label: 'Oversized', prompt: 'in a relaxed oversized boxy fit' },
      { id: 'fitted', label: 'Fitted', prompt: 'in a slim fitted cut close to the body' },
      { id: 'cropped', label: 'Cropped', prompt: 'in a cropped length cut above the waist' },
    ]},
    { key: 'presentation', label: 'Presentation', default: 'folded', choices: [
      { id: 'folded', label: 'Folded', prompt: 'neatly folded in a retail-style presentation' },
      { id: 'flat-lay', label: 'Flat Lay', prompt: 'laid completely flat in a top-down flat lay' },
      { id: 'on-hanger', label: 'On Hanger', prompt: 'hanging on a premium wooden hanger' },
      { id: 'on-torso', label: 'On Torso', prompt: 'worn on an invisible mannequin torso showing natural drape' },
    ]},
    { key: 'collar', label: 'Collar', default: 'crew', choices: [
      { id: 'crew', label: 'Crew Neck', prompt: 'with a ribbed crew neck collar' },
      { id: 'v-neck', label: 'V-Neck', prompt: 'with a V-neck collar' },
      { id: 'henley', label: 'Henley', prompt: 'with a henley collar featuring two-button placket' },
    ]},
    { key: 'technique', label: 'Print Technique', default: 'screen-print', choices: [
      { id: 'screen-print', label: 'Screen Print', prompt: 'with visible screen-printed ink texture sitting on top of the fabric' },
      { id: 'dtg', label: 'DTG Print', prompt: 'with DTG direct-to-garment printing showing ink absorbed into fibers' },
      { id: 'embroidery', label: 'Embroidery', prompt: 'with detailed thread embroidery stitching creating textured dimensional design' },
      { id: 'heat-press', label: 'Heat Press', prompt: 'with heat-pressed vinyl transfer showing smooth glossy finish' },
      { id: 'sublimation', label: 'Sublimation', prompt: 'with all-over sublimation dye printing fused into the fabric' },
    ]},
  ],

  'tote-bag': [
    { key: 'handle-color', label: 'Handle Color', default: 'matching', choices: [
      { id: 'matching', label: 'Matching', prompt: 'with handles in matching canvas color' },
      { id: 'contrast', label: 'Contrast', prompt: 'with contrasting colored handles for visual pop' },
      { id: 'leather', label: 'Leather', prompt: 'with premium brown leather handles' },
    ]},
    { key: 'canvas-weight', label: 'Canvas Weight', default: 'medium', choices: [
      { id: 'light', label: 'Light', prompt: 'in lightweight canvas with soft drape' },
      { id: 'medium', label: 'Medium', prompt: 'in medium-weight structured canvas' },
      { id: 'heavy', label: 'Heavy', prompt: 'in heavy-duty thick canvas with rigid body' },
    ]},
    { key: 'gusset', label: 'Gusset', default: 'none', choices: [
      { id: 'none', label: 'Flat', prompt: 'with a flat construction and no gusset' },
      { id: 'bottom', label: 'Bottom', prompt: 'with a bottom gusset creating a flat base' },
      { id: 'side-bottom', label: 'Side & Bottom', prompt: 'with side and bottom gussets for extra volume' },
    ]},
    { key: 'technique', label: 'Print Technique', default: 'screen-print', choices: [
      { id: 'screen-print', label: 'Screen Print', prompt: 'with screen-printed design on the canvas' },
      { id: 'embroidery', label: 'Embroidery', prompt: 'with embroidered stitched design showing thread texture' },
      { id: 'heat-press', label: 'Heat Press', prompt: 'with heat-pressed vinyl transfer design' },
    ]},
  ],

  // ── SCREEN ─────────────────────────────────────────────────
  'phone-screen': [
    { key: 'phone-model', label: 'Phone Model', default: 'generic', choices: [
      { id: 'generic', label: 'Generic', prompt: 'on a generic modern smartphone with thin bezels' },
      { id: 'iphone', label: 'iPhone-style', prompt: 'on an iPhone-style device with Dynamic Island and rounded stainless frame' },
      { id: 'pixel', label: 'Pixel-style', prompt: 'on a Pixel-style device with camera bar and soft rounded edges' },
      { id: 'samsung', label: 'Samsung-style', prompt: 'on a Samsung Galaxy-style device with edge-curved display' },
    ]},
    { key: 'orientation', label: 'Orientation', default: 'portrait', choices: [
      { id: 'portrait', label: 'Portrait', prompt: 'held in portrait vertical orientation' },
      { id: 'landscape', label: 'Landscape', prompt: 'rotated to landscape horizontal orientation' },
    ]},
    { key: 'bezel', label: 'Bezel', default: 'thin', choices: [
      { id: 'thin', label: 'Thin Bezel', prompt: 'with modern thin bezels around the display' },
      { id: 'none', label: 'Borderless', prompt: 'with an edge-to-edge borderless display' },
      { id: 'notch', label: 'With Notch', prompt: 'with a visible top notch for the front camera' },
    ]},
  ],

  'laptop-screen': [
    { key: 'laptop-style', label: 'Laptop Style', default: 'macbook', choices: [
      { id: 'macbook', label: 'MacBook-style', prompt: 'on a MacBook-style aluminum unibody laptop with slim profile' },
      { id: 'generic-thin', label: 'Thin Generic', prompt: 'on a modern ultra-thin laptop with minimal branding' },
      { id: 'generic-thick', label: 'Classic', prompt: 'on a standard-thickness professional laptop' },
    ]},
    { key: 'lid-angle', label: 'Lid Angle', default: '120deg', choices: [
      { id: '90deg', label: '90 degrees', prompt: 'with the lid opened to exactly 90 degrees' },
      { id: '120deg', label: '120 degrees', prompt: 'with the lid opened to a natural 120-degree viewing angle' },
      { id: '135deg', label: '135 degrees', prompt: 'with the lid opened wide to 135 degrees, leaning back' },
    ]},
    { key: 'keyboard-visible', label: 'Keyboard Visible', default: 'yes', choices: [
      { id: 'yes', label: 'Yes', prompt: 'with keyboard and trackpad visible in the frame' },
      { id: 'no', label: 'Screen Only', prompt: 'framed tightly on the screen only, keyboard cropped out' },
    ]},
  ],

  // ── HARD SURFACE ───────────────────────────────────────────
  'coffee-mug': [
    { key: 'mug-type', label: 'Mug Type', default: 'classic', choices: [
      { id: 'classic', label: 'Classic', prompt: 'as a classic cylindrical ceramic mug with C-handle' },
      { id: 'travel', label: 'Travel', prompt: 'as a double-walled travel mug with sliding lid' },
      { id: 'espresso', label: 'Espresso', prompt: 'as a small espresso cup with saucer' },
      { id: 'camp', label: 'Camp', prompt: 'as a speckled enamel camp mug with metal rim' },
    ]},
    { key: 'ceramic-finish', label: 'Finish', default: 'glossy', choices: [
      { id: 'glossy', label: 'Glossy Glaze', prompt: 'with a smooth high-gloss glaze finish' },
      { id: 'matte', label: 'Matte', prompt: 'with a soft matte ceramic finish' },
      { id: 'speckled', label: 'Speckled', prompt: 'with a handmade speckled stoneware finish' },
      { id: 'enamel', label: 'Enamel', prompt: 'with a classic enamel coating and visible metal rim' },
    ]},
    { key: 'steam', label: 'Steam', default: 'light', choices: [
      { id: 'none', label: 'None', prompt: '' },
      { id: 'light', label: 'Light Wisps', prompt: 'with subtle light steam wisps rising from the surface' },
      { id: 'heavy', label: 'Heavy Steam', prompt: 'with dramatic thick steam rising and curling in the air' },
    ]},
  ],

  'bottle-label': [
    { key: 'bottle-type', label: 'Bottle Type', default: 'wine', choices: [
      { id: 'wine', label: 'Wine', prompt: 'as an elegant wine bottle with elongated neck' },
      { id: 'beer', label: 'Beer', prompt: 'as a standard beer bottle' },
      { id: 'spirits', label: 'Spirits', prompt: 'as a premium spirits bottle with heavy glass base' },
      { id: 'sauce', label: 'Sauce', prompt: 'as a gourmet sauce bottle with wide body' },
      { id: 'water', label: 'Water', prompt: 'as a minimal water bottle with clean silhouette' },
    ]},
    { key: 'bottle-material', label: 'Bottle Material', default: 'clear-glass', choices: [
      { id: 'clear-glass', label: 'Clear Glass', prompt: 'in clear transparent glass showing liquid color' },
      { id: 'amber-glass', label: 'Amber Glass', prompt: 'in amber-tinted glass with warm glow' },
      { id: 'matte-ceramic', label: 'Ceramic', prompt: 'in opaque matte ceramic with tactile surface' },
      { id: 'frosted', label: 'Frosted Glass', prompt: 'in frosted translucent glass with soft diffused visibility' },
    ]},
    { key: 'cap', label: 'Cap Type', default: 'cork', choices: [
      { id: 'cork', label: 'Cork', prompt: 'sealed with a natural cork stopper' },
      { id: 'screw', label: 'Screw Cap', prompt: 'with a metal screw cap' },
      { id: 'crown', label: 'Crown Cap', prompt: 'with a crimped metal crown cap' },
      { id: 'swing-top', label: 'Swing-Top', prompt: 'with a ceramic swing-top flip closure' },
    ]},
  ],

  // ── SIGNAGE ────────────────────────────────────────────────
  'signage': [
    { key: 'sign-type', label: 'Sign Type', default: 'wall-mounted', choices: [
      { id: 'wall-mounted', label: 'Wall-Mounted', prompt: 'as a wall-mounted sign with visible mounting hardware' },
      { id: 'hanging', label: 'Hanging', prompt: 'as a hanging sign suspended from an overhead bracket' },
      { id: 'freestanding', label: 'Freestanding', prompt: 'as a freestanding floor sign on a weighted base' },
      { id: 'a-frame', label: 'A-Frame', prompt: 'as a sidewalk A-frame sandwich board' },
      { id: 'window-decal', label: 'Window Decal', prompt: 'as a vinyl window decal applied to glass with subtle transparency' },
    ]},
    { key: 'sign-material', label: 'Material', default: 'acrylic', choices: [
      { id: 'acrylic', label: 'Acrylic', prompt: 'made from cut acrylic with clean laser-cut edges' },
      { id: 'wood', label: 'Wood', prompt: 'carved from natural wood with visible grain' },
      { id: 'metal', label: 'Metal', prompt: 'fabricated from brushed metal with industrial character' },
      { id: 'neon', label: 'Neon', prompt: 'as a glowing neon tube sign with warm luminous glow' },
      { id: 'backlit', label: 'Backlit', prompt: 'as a backlit lightbox sign with even edge-lit illumination' },
    ]},
  ],

  'billboard': [
    { key: 'bb-format', label: 'Format', default: 'standard', choices: [
      { id: 'standard', label: 'Standard', prompt: 'as a traditional large-format printed billboard' },
      { id: 'digital', label: 'Digital', prompt: 'as a bright LED digital billboard with screen glow' },
      { id: 'subway', label: 'Subway', prompt: 'as a subway station advertising poster behind glass' },
    ]},
    { key: 'environment', label: 'Environment', default: 'urban-street', choices: [
      { id: 'highway', label: 'Highway', prompt: 'positioned alongside a highway with open sky background' },
      { id: 'urban-street', label: 'Urban Street', prompt: 'on a busy urban street with city buildings' },
      { id: 'building-wall', label: 'Building Wall', prompt: 'mounted on the side of a building wall' },
    ]},
    { key: 'time-of-day', label: 'Time of Day', default: 'day', choices: [
      { id: 'day', label: 'Day', prompt: 'photographed in bright daylight with natural shadows' },
      { id: 'night', label: 'Night', prompt: 'photographed at night with artificial lighting and city glow' },
      { id: 'dusk', label: 'Dusk', prompt: 'photographed at dusk with warm orange sky and early streetlights' },
    ]},
    { key: 'people', label: 'People', default: 'none', choices: [
      { id: 'none', label: 'None', prompt: '' },
      { id: 'blurred-walking', label: 'Blurred Pedestrians', prompt: 'with motion-blurred pedestrians walking past below, adding urban life and scale' },
      { id: 'crowd', label: 'Crowd', prompt: 'with a crowd of people visible below the billboard, showing real-world context' },
    ]},
  ],

  // ── NEW SCREEN OBJECTS ─────────────────────────────────────
  'desktop-monitor': [
    { key: 'monitor-style', label: 'Monitor Style', default: 'ultrawide', choices: [
      { id: 'ultrawide', label: 'Ultrawide', prompt: 'on a curved ultrawide monitor with thin bezels and cinematic aspect ratio' },
      { id: 'standard', label: 'Standard 27"', prompt: 'on a standard 27-inch flat monitor with minimal bezels' },
      { id: 'vertical', label: 'Vertical / Portrait', prompt: 'on a monitor rotated to portrait vertical orientation' },
      { id: 'dual', label: 'Dual Setup', prompt: 'displayed across a dual-monitor desktop setup' },
    ]},
    { key: 'stand', label: 'Stand', default: 'default', choices: [
      { id: 'default', label: 'Default Stand', prompt: 'on the monitor\'s default adjustable stand' },
      { id: 'arm', label: 'Monitor Arm', prompt: 'mounted on a sleek articulating monitor arm, floating above the desk' },
      { id: 'none', label: 'No Stand (Wall)', prompt: 'wall-mounted with no visible stand, flush against the surface' },
    ]},
    { key: 'keyboard-visible', label: 'Keyboard Visible', default: 'yes', choices: [
      { id: 'yes', label: 'Yes', prompt: 'with keyboard and mouse visible on the desk below' },
      { id: 'no', label: 'Screen Only', prompt: 'framed tightly on the screen, desk cropped out' },
    ]},
  ],

  'imac': [
    { key: 'imac-model', label: 'Model', default: 'current', choices: [
      { id: 'current', label: 'Current (M-series)', prompt: 'on a current-generation Apple iMac with thin profile, colored aluminum back, and white bezels' },
      { id: 'classic', label: 'Classic (Intel)', prompt: 'on a classic Intel iMac with aluminum unibody and thin black bezels' },
      { id: 'pro-display', label: 'Pro Display XDR', prompt: 'on an Apple Pro Display XDR with nano-texture glass and aluminum Pro Stand' },
    ]},
    { key: 'imac-color', label: 'Color', default: 'silver', choices: [
      { id: 'silver', label: 'Silver', prompt: 'in silver/white finish' },
      { id: 'blue', label: 'Blue', prompt: 'in the blue colorway' },
      { id: 'green', label: 'Green', prompt: 'in the green colorway' },
      { id: 'pink', label: 'Pink', prompt: 'in the pink colorway' },
      { id: 'orange', label: 'Orange', prompt: 'in the orange colorway' },
    ]},
    { key: 'peripherals', label: 'Peripherals', default: 'matching', choices: [
      { id: 'matching', label: 'Matching Set', prompt: 'with matching Apple keyboard and trackpad in front' },
      { id: 'minimal', label: 'Minimal', prompt: 'with minimal desk accessories' },
      { id: 'none', label: 'iMac Only', prompt: 'showing only the iMac, no peripherals visible' },
    ]},
  ],

  // ── RESTAURANT & FOOD SERVICE ──────────────────────────────
  'restaurant-menu': [
    { key: 'menu-format', label: 'Format', default: 'bi-fold', choices: [
      { id: 'single', label: 'Single Page', prompt: 'as a single-page menu card' },
      { id: 'bi-fold', label: 'Bi-Fold', prompt: 'as a bi-fold menu opened flat showing two panels' },
      { id: 'tri-fold', label: 'Tri-Fold', prompt: 'as a tri-fold menu showing all three panels' },
      { id: 'booklet', label: 'Booklet', prompt: 'as a multi-page stapled booklet menu' },
      { id: 'clipboard', label: 'On Clipboard', prompt: 'clipped to a wooden or leather menu clipboard' },
    ]},
    { key: 'menu-setting', label: 'Table Setting', default: 'on-table', choices: [
      { id: 'on-table', label: 'On Table', prompt: 'resting on a restaurant table with ambient dining atmosphere' },
      { id: 'held', label: 'Being Held', prompt: 'being held open by hands as if reading at a restaurant' },
      { id: 'stand', label: 'In Stand', prompt: 'displayed in a tabletop menu stand or holder' },
      { id: 'flat', label: 'Flat Lay', prompt: 'in a flat lay arrangement with cutlery and napkin nearby' },
    ]},
    { key: 'menu-material', label: 'Material', default: 'coated', choices: [
      { id: 'coated', label: 'Coated Card', prompt: 'printed on coated card stock with soft sheen' },
      { id: 'kraft', label: 'Kraft Paper', prompt: 'printed on rustic kraft paper with artisan character' },
      { id: 'leather-cover', label: 'Leather Cover', prompt: 'encased in a premium leather menu cover with gold corner accents' },
    ]},
  ],

  // ── OUTDOOR ADVERTISING ────────────────────────────────────
  'bus-ad': [
    { key: 'bus-placement', label: 'Placement', default: 'side', choices: [
      { id: 'side', label: 'Bus Side', prompt: 'as a full-side advertisement on the exterior of a city bus' },
      { id: 'rear', label: 'Bus Rear', prompt: 'as a rear panel advertisement on the back of a bus' },
      { id: 'interior', label: 'Interior Panel', prompt: 'as an interior overhead advertising panel inside the bus' },
      { id: 'wrap', label: 'Full Wrap', prompt: 'as a full vinyl bus wrap covering the entire vehicle' },
    ]},
    { key: 'bus-environment', label: 'Environment', default: 'in-motion', choices: [
      { id: 'in-motion', label: 'In Motion', prompt: 'with the bus in motion on a city street, slight motion blur on background' },
      { id: 'stopped', label: 'At Stop', prompt: 'with the bus stopped at a bus stop, passengers nearby' },
      { id: 'parked', label: 'Parked', prompt: 'with the bus parked showing the full advertisement clearly' },
    ]},
    { key: 'time-of-day', label: 'Time of Day', default: 'day', choices: [
      { id: 'day', label: 'Day', prompt: 'in bright daylight with clear visibility' },
      { id: 'night', label: 'Night', prompt: 'at night with streetlights and city glow illuminating the ad' },
      { id: 'rainy', label: 'Rainy', prompt: 'on a rainy day with wet reflections on the street adding atmosphere' },
    ]},
  ],

  'bus-stop': [
    { key: 'shelter-type', label: 'Shelter Type', default: 'modern', choices: [
      { id: 'modern', label: 'Modern Glass', prompt: 'in a modern glass and steel bus shelter with clean lines' },
      { id: 'classic', label: 'Classic', prompt: 'in a traditional covered bus stop shelter' },
      { id: 'minimal', label: 'Pole Only', prompt: 'as a standalone advertising panel on a street pole' },
    ]},
    { key: 'backlit', label: 'Backlit', default: 'yes', choices: [
      { id: 'yes', label: 'Backlit', prompt: 'with the advertisement backlit and glowing, visible from a distance' },
      { id: 'no', label: 'Not Backlit', prompt: 'as a non-illuminated printed poster in the shelter' },
    ]},
    { key: 'people', label: 'People', default: 'none', choices: [
      { id: 'none', label: 'None', prompt: '' },
      { id: 'waiting', label: 'People Waiting', prompt: 'with people waiting at the bus stop near the advertisement' },
      { id: 'blurred-walking', label: 'Blurred Walking', prompt: 'with blurred pedestrians walking past the bus stop' },
    ]},
    { key: 'time-of-day', label: 'Time of Day', default: 'day', choices: [
      { id: 'day', label: 'Day', prompt: 'in daylight with natural shadows' },
      { id: 'evening', label: 'Evening', prompt: 'in the evening with the backlit panel glowing against the dimming sky' },
      { id: 'night', label: 'Night', prompt: 'at night with the illuminated panel as a focal light source' },
    ]},
  ],

  'flag': [
    { key: 'flag-type', label: 'Flag Type', default: 'vertical', choices: [
      { id: 'vertical', label: 'Vertical Banner', prompt: 'as a tall vertical hanging banner flag' },
      { id: 'horizontal', label: 'Horizontal Flag', prompt: 'as a horizontal flag on a flagpole' },
      { id: 'feather', label: 'Feather Flag', prompt: 'as a curved feather flag on a flexible pole' },
      { id: 'teardrop', label: 'Teardrop', prompt: 'as a teardrop-shaped flag on a spring base' },
      { id: 'pennant', label: 'Pennant', prompt: 'as a triangular pennant banner on a string' },
    ]},
    { key: 'wind', label: 'Wind', default: 'gentle', choices: [
      { id: 'still', label: 'Still', prompt: 'hanging still with no wind, fully visible design' },
      { id: 'gentle', label: 'Gentle Breeze', prompt: 'with a gentle breeze creating natural flowing movement in the fabric' },
      { id: 'strong', label: 'Strong Wind', prompt: 'flapping dramatically in strong wind with dynamic fabric motion' },
    ]},
    { key: 'flag-material', label: 'Material', default: 'polyester', choices: [
      { id: 'polyester', label: 'Polyester', prompt: 'made from lightweight polyester with vibrant dye-sublimation print' },
      { id: 'canvas', label: 'Canvas', prompt: 'made from heavy canvas fabric with screen-printed design' },
      { id: 'satin', label: 'Satin', prompt: 'made from satin fabric with glossy sheen catching the light' },
    ]},
  ],

  'pull-up-banner': [
    { key: 'banner-size', label: 'Size', default: 'standard', choices: [
      { id: 'standard', label: 'Standard (85x200cm)', prompt: 'at standard roll-up banner size (85x200cm)' },
      { id: 'wide', label: 'Wide (120x200cm)', prompt: 'as a wide format roll-up banner (120x200cm)' },
      { id: 'mini', label: 'Mini Desktop', prompt: 'as a mini desktop pull-up banner for tabletop display' },
    ]},
    { key: 'banner-setting', label: 'Setting', default: 'event', choices: [
      { id: 'event', label: 'Event / Conference', prompt: 'displayed at a conference or trade show event space' },
      { id: 'lobby', label: 'Office Lobby', prompt: 'standing in a corporate office lobby or reception area' },
      { id: 'retail', label: 'Retail Store', prompt: 'positioned inside a retail store entrance' },
      { id: 'studio', label: 'Studio', prompt: 'photographed in a clean studio setting on its own' },
    ]},
    { key: 'banner-count', label: 'Count', default: 'single', choices: [
      { id: 'single', label: 'Single', prompt: 'as a single standalone pull-up banner' },
      { id: 'pair', label: 'Pair', prompt: 'as a matching pair of pull-up banners flanking an entrance' },
      { id: 'row', label: 'Row of Three', prompt: 'as a row of three coordinated pull-up banners creating a backdrop' },
    ]},
  ],
};
