import { MockupConfig, CustomAngle, PRINT_OBJECTS, FABRIC_OBJECTS, SCREEN_OBJECTS, OBJECT_OPTIONS } from '@/types/mockup';

const CORE_STYLE = "Professional high-end studio photography, shot on Hasselblad H6D-100c with Phase One IQ4 digital back, 100 megapixels. Extreme detail, editorial lighting, cinematic depth of field, minimalist composition.";

const RATIO_PROMPTS: Record<string, string> = {
  '1:1': "Square 1:1 aspect ratio composition, perfectly balanced on all sides.",
  '4:5': "Portrait 4:5 aspect ratio, slightly taller than wide, ideal for social media.",
  '4:3': "Classic 4:3 aspect ratio with traditional photographic proportions.",
  '3:2': "Standard 3:2 photo aspect ratio with natural horizontal balance.",
  '16:9': "Cinematic wide 16:9 aspect ratio with expansive horizontal composition.",
  '21:9': "Ultra-wide 21:9 panoramic aspect ratio with dramatic horizontal sweep.",
  '9:16': "Vertical 9:16 aspect ratio, tall and narrow, optimized for mobile screens.",
  '2:3': "Tall 2:3 portrait aspect ratio with generous vertical space.",
};

const OBJECT_PROMPTS: Record<string, string> = {
  'business-cards': "A set of premium business cards, elegantly arranged with precise spacing, showing front and back designs with crisp edges and embossed details.",
  'letterhead': "A complete brand stationery set including letterhead, envelope, and business card, arranged in a clean editorial flat lay composition.",
  'phone-screen': "A modern smartphone displaying a vibrant UI design, screen glowing with sharp pixel-perfect detail, phone body with realistic reflections.",
  'laptop-screen': "A sleek laptop with thin bezels displaying a website design, screen at optimal viewing angle with realistic ambient light on the display.",
  'book-magazine': "A hardcover book or magazine with a bold cover design, pages slightly fanned, spine visible, showcasing print quality and binding detail.",
  'product-box': "Premium product packaging box with clean minimalist design, showing multiple faces of the box with crisp fold lines and print fidelity.",
  'shopping-bag': "A luxury shopping bag with rope handles, standing upright with subtle creases, brand logo prominently displayed on the front face.",
  'tshirt': "A folded premium cotton t-shirt with screen-printed design, fabric texture visible, natural soft creases adding authenticity.",
  'tote-bag': "A canvas tote bag laid flat or hanging naturally, showing the full print area with fabric texture and stitching details visible.",
  'poster-print': "A large format poster print, either mounted on a wall or rolled with one corner lifting, showing vivid color reproduction and paper texture.",
  'coffee-mug': "A ceramic coffee mug with wrap-around brand design, subtle steam wisps, showing the curve of the handle and glaze finish.",
  'bottle-label': "A glass or matte bottle with a detailed label design, liquid visible through the glass, cap and neck details sharp and realistic.",
  'signage': "Wall-mounted or freestanding signage with dimensional lettering, showing how the brand appears at scale in an architectural context.",
  'notebook': "A premium notebook or journal with embossed cover, elastic closure band, and rounded corners, pages faintly visible at the edges.",
  'brand-identity': "A comprehensive brand identity spread including business cards, letterhead, envelope, and branded items arranged in a cohesive editorial layout.",
  'vinyl-cd': "A vinyl record or CD with sleeve and disc visible, showing the artwork at full scale with reflective disc surface catching light.",
  'billboard': "A large-scale billboard or outdoor advertisement mockup in an urban environment, showing the design at monumental scale with perspective depth.",
  'desktop-monitor': "A modern desktop monitor on a clean desk setup, displaying a crisp high-resolution UI design with accurate color reproduction and sharp text rendering.",
  'imac': "An Apple iMac all-in-one computer displaying a website or application design, with its iconic aluminum and glass design language, sitting on a clean workspace.",
  'restaurant-menu': "A professionally printed restaurant menu showing food and drink offerings, with elegant typography and appetizing layout design.",
  'bus-ad': "A city bus displaying a large-format advertisement, the design wrapping the vehicle body with bold graphics visible from the street.",
  'bus-stop': "A bus stop shelter with an advertising panel displaying a poster design, set in an urban street environment with realistic city context.",
  'flag': "A branded flag or banner displaying a logo and design, fabric flowing naturally with realistic textile texture and movement.",
  'pull-up-banner': "A retractable pull-up roller banner standing on its aluminum base, displaying a vertical promotional design at full height.",
  'postcard': "A premium printed postcard with vivid full-color printing, showing both the design face and the addressed back, with sharp print quality and clean cut edges.",
  'tablet-apple': "An Apple iPad tablet displaying a vivid app design or website, the sleek aluminum body and Retina display showing sharp pixel-perfect content with realistic screen glow.",
  'tablet-android': "An Android tablet displaying a vibrant UI design, with modern thin bezels and the screen showing crisp high-resolution content with realistic ambient reflections.",
  'newspaper': "A printed newspaper with a prominently placed advertisement, the newsprint texture visible with realistic ink coverage, folded authentically with natural creases.",
  'magazine-ad': "A glossy magazine opened to a full-page advertisement, the high-quality print showing rich colors and sharp detail, magazine pages slightly curving at the spine.",
  'exhibition-stand': "A professional exhibition stand or trade show booth displaying branded graphics, with structural elements visible and large-format prints creating an immersive brand environment.",
  'tri-fold-flyer': "A tri-fold brochure flyer with three panels visible, showing the design across connected panels with clean fold lines and professional print quality on coated paper.",
  'envelope': "A premium printed envelope with brand logo and addressing, showing the paper texture, clean edges, and professional print registration with visible flap detail.",
};

const CAMERA_PROMPTS: Record<string, string> = {
  'top-down': "Shot from directly above in a perfect top-down flat lay perspective, creating a clean geometric composition with no perspective distortion.",
  'three-quarter': "Captured at a 45-degree three-quarter angle, showing depth and dimension while revealing multiple faces of the subject.",
  'eye-level': "Shot straight-on at eye level, creating a direct and confrontational composition that emphasizes the front face of the subject.",
  'low-angle': "Photographed from a low angle looking upward, creating a heroic and imposing perspective that adds drama and grandeur.",
  'macro': "Extreme macro close-up shot revealing fine textures, print details, and material qualities at intimate magnification.",
  'isometric': "Captured in an isometric perspective with equal angles on all axes, creating a technical yet elegant dimensional view.",
  'dutch-tilt': "Shot with a subtle Dutch tilt angle, adding dynamic energy and visual tension to the composition.",
  'custom': "", // handled by customAngleToPrompt
};

function customAngleToPrompt(angle: CustomAngle): string {
  const { pitch, yaw } = angle;

  // Vertical description
  let vertical = '';
  if (pitch > 70) vertical = 'from directly above (bird\'s eye view)';
  else if (pitch > 45) vertical = 'from a steep overhead angle';
  else if (pitch > 20) vertical = `from above at approximately ${Math.round(pitch)}°`;
  else if (pitch > 5) vertical = 'from slightly above eye level';
  else if (pitch > -5) vertical = 'at eye level';
  else if (pitch > -20) vertical = 'from slightly below eye level';
  else if (pitch > -45) vertical = `from below at approximately ${Math.round(Math.abs(pitch))}°`;
  else vertical = 'from a dramatic low angle looking upward';

  // Horizontal description
  let horizontal = '';
  const absYaw = Math.abs(yaw);
  if (absYaw < 10) horizontal = 'facing straight on';
  else if (absYaw < 30) horizontal = `rotated slightly to the ${yaw > 0 ? 'right' : 'left'}`;
  else if (absYaw < 60) horizontal = `turned ${Math.round(absYaw)}° to the ${yaw > 0 ? 'right' : 'left'}`;
  else if (absYaw < 100) horizontal = `viewed from the ${yaw > 0 ? 'right' : 'left'} side`;
  else if (absYaw < 150) horizontal = `seen mostly from the ${yaw > 0 ? 'right' : 'left'} rear quarter`;
  else horizontal = 'viewed from nearly behind';

  return `Camera positioned ${vertical}, ${horizontal}. Custom perspective creating a unique editorial composition.`;
}

const SURFACE_PROMPTS: Record<string, string> = {
  'white-marble': "resting on a pristine white Carrara marble surface with subtle gray veining",
  'terrazzo': "placed on a speckled terrazzo surface with colorful stone chips embedded in a light cement base",
  'concrete': "set on a smooth polished concrete surface with subtle industrial character",
  'dark-slate': "arranged on a deep dark slate surface with natural cleft texture and matte finish",
  'light-oak': "positioned on a warm light oak wood surface with visible natural grain patterns",
  'dark-walnut': "placed on a rich dark walnut wood surface with deep grain and satin finish",
  'linen-fabric': "laid on a natural linen fabric surface with visible cross-hatch weave texture",
  'leather': "resting on a premium full-grain leather surface with subtle pebble texture and warm patina",
  'kraft-paper': "set on raw kraft paper with visible fiber texture and natural brown tone",
  'ceramic-tile': "placed on a large-format ceramic tile surface with clean edges and subtle glaze",
  'brushed-metal': "arranged on a brushed stainless steel surface with fine directional grain catching light",
  'glass': "floating above a clear glass surface with sharp reflections and refractive edges visible beneath",
};

const SETTING_PROMPTS: Record<string, string> = {
  'white-studio': "Set in a minimal all-white photography studio with seamless backdrop, clean and distraction-free with soft ambient fill.",
  'dark-studio': "Set in a dark moody studio environment with deep charcoal backdrop, dramatic contrast, and focused pools of light.",
  'sunlit-natural': "Set in a sunlit natural environment with warm daylight streaming in, organic shadows, and a fresh airy atmosphere.",
  'cafe-table': "Set on a café or restaurant table with ambient background blur of the interior, warm and lived-in atmosphere.",
  'office-desk': "Set on a modern office desk with minimal accessories in the background, professional and clean workspace atmosphere.",
  'kitchen-counter': "Set on a kitchen countertop with soft domestic background, warm and inviting with natural materials visible.",
  'botanical': "Set among lush botanical elements with tropical leaves, small plants, and organic natural textures framing the scene.",
  'urban': "Set in an urban architectural environment with concrete, glass, and geometric structures providing a modern backdrop.",
  'gradient-backdrop': "Set against a smooth gradient backdrop transitioning between two complementary tones, creating an ethereal floating effect.",
  'plaster-wall': "Set against a textured plaster wall with subtle imperfections and warm Mediterranean character, adding depth and authenticity.",
};

const LIGHTING_PROMPTS: Record<string, string> = {
  'window-pane': "Natural sunlight coming from the side, cast through a window pane creating sharp geometric gobo shadows across the scene.",
  'tree-dappled': "Soft dappled sunlight filtering through tree leaves, creating organic leaf-shaped gobo shadows with gentle movement.",
  'venetian-blinds': "Hard directional light sliced through venetian blinds, creating dramatic parallel shadow lines across the subject.",
  'soft-arch': "Soft diffused lighting with a gentle architectural arch shadow framing the focal point, adding subtle depth.",
  'ring-light': "Even frontal ring light illumination with a characteristic circular catchlight, reducing shadows for a clean commercial look.",
  'golden-hour': "Warm golden hour sunlight with long soft shadows, rich amber tones, and a romantic cinematic atmosphere.",
  'clean-studio': "Clean, even studio lighting with multiple softboxes, minimal shadows, professional commercial photography setup.",
  'neon-glow': "Atmospheric neon lighting with colored glow from nearby neon signs, casting vivid pink, blue, or purple tints across the scene.",
  'candlelight': "Warm, intimate candlelight with flickering orange tones, deep shadows, and a cozy romantic atmosphere.",
  'overcast': "Soft, even overcast daylight with no harsh shadows, creating a naturally diffused and flattering illumination.",
  'harsh-midday': "Intense harsh midday sunlight with strong directional shadows, high contrast, and bright highlights.",
  'backlit-silhouette': "Strong backlighting from behind the subject, creating a rim-lit silhouette effect with glowing edges and lens flare.",
  'spotlight': "A focused theatrical spotlight illuminating the subject from above, dramatic pool of light against a darker surrounding.",
  'fluorescent': "Cool fluorescent overhead lighting with a slightly clinical blue-white tone, typical of commercial or office environments.",
};

const MATERIAL_PROMPTS: Record<string, string> = {
  matte: "premium matte finish with zero sheen and velvety tactile quality",
  linen: "sophisticated cross-hatch linen texture with subtle tactile depth",
  recycled: "raw organic recycled paper texture with visible fibers and natural imperfections",
  glass: "perfectly clear crystalline glass with sharp refractive edges and pristine clarity",
  metal: "brushed anodized metal surface with fine grain and directional highlights",
};

const ASSET_INPUT_PROMPTS: Record<string, string> = {
  'transparent-logo': "The provided asset is a transparent PNG logo, placed cleanly onto the surface with precise registration, no white box or background visible. The logo must be reproduced EXACTLY as provided — do not redraw, reinterpret, or generate new text or symbols.",
  'screenshot': "The provided asset is a UI screenshot, displayed pixel-perfectly on the device screen at native resolution with realistic screen rendering. The screenshot content must appear EXACTLY as provided with zero modifications — every word, icon, layout element, and color must be faithfully preserved.",
  'design-custom': "The provided asset is a custom design composition, mapped accurately onto the surface maintaining original proportions and color fidelity. The design must be reproduced EXACTLY as provided — do not alter, redraw, or reinterpret any element.",
};

const PROP_PROMPTS: Record<string, string> = {
  'coffee-cup': "a ceramic coffee cup with latte art",
  'plant': "a small potted succulent or plant",
  'pen-pencil': "a premium pen and pencil set",
  'glasses': "a pair of designer reading glasses",
  'watch': "a luxury wristwatch",
  'phone': "a smartphone lying face-down",
  'flowers': "a small bouquet of dried or fresh flowers",
  'fabric-swatch': "folded fabric swatches in coordinating tones",
  'color-chips': "scattered Pantone color chips",
  'keyboard': "a minimal wireless keyboard",
  'book': "a hardcover book with a neutral cover",
  'candle': "a scented soy candle in a minimal vessel",
  'fruit': "a few pieces of fresh fruit (lemon, fig, or olive branch)",
  'stones': "smooth river stones or pebbles",
  'headphones': "premium over-ear headphones",
  'camera': "a vintage film camera",
};

const HAND_PROMPTS: Record<string, string> = {
  'none': "",
  'holding': "A realistic human hand is gently holding the main object, fingers naturally wrapped around it with visible skin texture, natural nails, and soft shadow from the hand.",
  'near': "A realistic human hand rests nearby on the surface, fingers relaxed, as if the person just set the object down or is about to pick it up.",
  'placing': "A realistic human hand is in the act of placing the object down onto the surface, caught mid-motion with natural finger positioning and subtle motion feel.",
};

const SCREEN_EFFECT_PROMPTS: Record<string, string> = {
  'reflection': "The screen shows realistic environmental reflections — subtle mirror of the room and lighting visible on the glass surface.",
  'glare': "A natural light glare catches across the screen surface, creating a realistic bright spot that reinforces the photographic authenticity.",
  'light-leak': "A warm cinematic light leak washes across the edge of the screen, adding an analog film quality to the digital display.",
};

const IMPERFECTION_PROMPTS: Record<string, string> = {
  'surface-dust': "A barely-visible fine layer of dust particles catching the light on the surface, adding photographic realism.",
  'fingerprints': "Extremely subtle fingerprint smudges barely visible on the surface at certain angles, adding human touch authenticity.",
  'water-ring': "A very faint circular water ring mark on the surface nearby, a discreet lived-in detail.",
  'micro-scratches': "Microscopic surface scratches only visible at the right light angle, adding genuine material wear.",
  'screen-scratches': "Ultra-fine hairline scratches on the screen glass, barely perceptible except under direct light — super discreet.",
  'screen-smudge': "An extremely faint finger smudge on the screen edge, almost invisible, adding realism to the glass surface.",
  'fabric-lint': "Minuscule lint particles and tiny fabric fibers on the textile surface, visible only in macro — hyper-realistic detail.",
  'loose-thread': "A single barely-visible loose thread at the hem or seam, a subtle sign of real handmade craftsmanship.",
  'pilling': "Microscopic fabric pilling on the surface texture, adding authentic textile character without looking worn.",
  'paper-dog-ear': "The tiniest hint of a soft corner on one edge of the paper, a barely-there sign of handling.",
  'ink-bleed': "Extremely subtle ink bleed at the edges of the printed design where ink meets uncoated paper, a sign of real offset printing.",
  'paper-aging': "The faintest warm yellowing at the paper edges, suggesting natural aging and giving the paper character.",
  'scuff-marks': "Barely-visible micro scuff marks on the hard surface, adding authentic material wear and real-world character.",
  'patina': "A subtle natural patina developing on the material surface, suggesting quality aging and genuine use.",
  'chipped-edge': "A minuscule chip on one edge of the hard surface, an almost imperceptible detail that sells realism.",
};

export function generateMockupPrompt(config: MockupConfig): string {
  const {
    object, camera, customAngle, surface, setting, lighting, intensity,
    material, assetDescription, colorPalette, imageRatio, assetInput,
    assetDimensions, props, hand, screenEffects, imperfections, infiniteBackground, infiniteBgColor,
  } = config;

  const parts: string[] = [];

  // Core style
  parts.push(CORE_STYLE);

  // Image ratio
  parts.push(RATIO_PROMPTS[imageRatio]);

  // Object
  parts.push(OBJECT_PROMPTS[object]);

  // Object-specific details
  const objDefs = OBJECT_OPTIONS[object] ?? [];
  if (objDefs.length > 0) {
    const fragments = objDefs.map(def => {
      const selectedId = config.objectDetails?.[def.key] ?? def.default;
      return def.choices.find(c => c.id === selectedId)?.prompt ?? '';
    }).filter(Boolean);
    if (fragments.length > 0) parts.push(fragments.join(', ') + '.');
  }

  // Camera angle
  if (camera === 'custom' && customAngle) {
    parts.push(customAngleToPrompt(customAngle));
  } else if (camera !== 'custom') {
    parts.push(CAMERA_PROMPTS[camera]);
  }

  // Infinite background OR surface + setting
  if (infiniteBackground) {
    const colorDesc = infiniteBgColor && infiniteBgColor !== '#ffffff'
      ? `in ${infiniteBgColor} tone`
      : 'in a clean neutral tone';
    parts.push(`The subject floats on a seamless infinite background ${colorDesc}, with no visible horizon line, edges, or surface boundaries. Pure, endless backdrop extending in all directions.`);
  } else {
    parts.push(`The subject is ${SURFACE_PROMPTS[surface]}.`);
    parts.push(SETTING_PROMPTS[setting]);
  }

  // Lighting
  parts.push(`Lighting: ${LIGHTING_PROMPTS[lighting]} Shadow intensity at ${intensity}%.`);

  // Material (only for print/packaging objects)
  if (PRINT_OBJECTS.includes(object)) {
    parts.push(`Material finish: ${MATERIAL_PROMPTS[material]}.`);
  }

  // Asset input type
  parts.push(ASSET_INPUT_PROMPTS[assetInput]);
  if (assetInput === 'design-custom' && assetDimensions) {
    parts.push(`The design dimensions are ${assetDimensions}.`);
  }

  // Asset ratio / proportions
  const { assetRatio, customAssetRatio } = config;
  if (assetRatio && assetRatio !== 'auto') {
    const ratioStr = assetRatio === 'custom' && customAssetRatio?.trim()
      ? customAssetRatio.trim()
      : assetRatio;
    parts.push(`IMPORTANT — INPUT ASSET PROPORTIONS: The provided input asset has a ${ratioStr} aspect ratio. When placing this asset onto the mockup object, you MUST preserve this exact ${ratioStr} proportion. Scale the asset uniformly to fit the mockup surface — do NOT stretch, squeeze, or crop it to fill a different shape. If the mockup surface has different proportions, the asset should be centered with appropriate margins rather than distorted to fit.`);
  }

  // CRITICAL: Asset preservation instructions
  parts.push("CRITICAL INSTRUCTION — ASSET FIDELITY: The attached/referenced image or design asset MUST be reproduced with absolute pixel-level accuracy. DO NOT alter, redraw, regenerate, distort, warp, stretch, compress, or reinterpret ANY part of the provided asset. ALL text in the asset must remain EXACTLY as written — same words, same spelling, same font, same size, same spacing, same capitalization. DO NOT invent new text, change existing text, add text that is not in the original, or render text in a different language. ALL proportions, aspect ratios, and spatial relationships within the asset must be preserved EXACTLY — no stretching, squishing, cropping, or geometric distortion of any kind. The asset should be applied to the mockup surface using correct perspective mapping only, as if it were a real printed/displayed piece photographed in the scene. Treat the provided asset as a sacred, unmodifiable reference that must appear in the final image exactly as supplied.");

  // Asset description
  if (assetDescription) {
    parts.push(`The design features ${assetDescription}.`);
  } else {
    parts.push('The design features a minimalist abstract logo with clean typography.');
  }

  // Props
  if (props.length > 0) {
    const propList = props.map(p => PROP_PROMPTS[p]).join(', ');
    parts.push(`Accompanying props arranged tastefully nearby: ${propList}. Props are secondary to the hero object, adding editorial context without competing for attention.`);
  }

  // Hand
  if (hand !== 'none') {
    parts.push(HAND_PROMPTS[hand]);
  }

  // Screen effects (only for screen-based objects)
  if (SCREEN_OBJECTS.includes(object) && screenEffects.length > 0) {
    const effects = screenEffects.map(e => SCREEN_EFFECT_PROMPTS[e]).join(' ');
    parts.push(effects);
  }

  // Imperfections
  if (imperfections.length > 0) {
    const imperfTexts = imperfections.map(i => IMPERFECTION_PROMPTS[i]).filter(Boolean);
    parts.push(`Subtle realistic imperfections for authenticity: ${imperfTexts.join(' ')}`);
  }

  // Color palette
  const { swatchColors } = config;
  if (swatchColors.length > 0) {
    const hexList = swatchColors.join(', ');
    parts.push(`Color palette defined by exact hex values: ${hexList}. These colors should dominate the scene's brand elements and overall tone.`);
  }
  if (colorPalette) {
    parts.push(`Color mood: ${colorPalette}.`);
  }
  if (swatchColors.length === 0 && !colorPalette) {
    parts.push('Neutral color palette of warm off-whites and soft grays.');
  }

  // Render suffix
  parts.push("Unreal Engine 5 render style, photorealistic, 8k, ray tracing, global illumination.");

  return parts.join(" ");
}
