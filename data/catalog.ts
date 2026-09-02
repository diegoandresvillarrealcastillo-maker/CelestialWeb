export type ProductCategory =
  | 'Velas aromáticas'
  | 'Wax melts'
  | 'Bouquets'
  | 'Recordatorios'
  | 'Navidad';

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  collection: 'general' | 'navidad';
  description: string;
  priceCop: number;
  priceMaxCop?: number;
  priceLabel?: string;
  image: string;
  images?: string[];
  dimensions?: string;
  weight?: string;
  colors?: string[];
  fragrances?: string[];
  options?: string[];
  features: string[];
  availability: 'Hecho bajo pedido';
  source: { catalog: 'general' | 'navidad'; page: number };
  featured?: boolean;
  popular?: boolean;
  referenceImage?: boolean;
};

const image = (name: string) => `/images/products/${name}.webp`;

export const products: CatalogProduct[] = [
  {
    id: 'aromatica-300', slug: 'vela-aromatica-300g', name: 'Vela aromática 300 g',
    category: 'Velas aromáticas', collection: 'general',
    description: 'Vela aromática en envase de vidrio con tapa de bambú, decorada con wax melts de frutas o elementos decorativos.',
    priceCop: 40000, image: image('vela-aromatica-300g'), weight: '300 g',
    fragrances: ['Café', 'Chocolate', 'Frutos rojos', 'Naranja', 'Maracuyá', 'Eucalipto', 'Canela'],
    features: ['Cera 100% vegetal', 'Envase de vidrio', 'Tapa de bambú', 'Decoración sensorial'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 4 }, featured: true, popular: true,
  },
  {
    id: 'aromatica-150', slug: 'vela-aromatica-150g', name: 'Vela aromática 150 g',
    category: 'Velas aromáticas', collection: 'general',
    description: 'Vela aromática en envase de vidrio esmerilado negro y tapa de bambú, con wax melts de frutas o elementos decorativos.',
    priceCop: 25000, image: image('vela-aromatica-150g'), weight: '150 g',
    fragrances: ['Café', 'Chocolate', 'Frutos rojos', 'Naranja', 'Maracuyá', 'Eucalipto', 'Canela'],
    features: ['Cera 100% vegetal', 'Vidrio esmerilado negro', 'Tapa de bambú', 'Decoración sensorial'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 4 }, popular: true,
  },
  {
    id: 'wax-160', slug: 'vela-wax-melts-160g', name: 'Vela Wax Melts 160 g',
    category: 'Wax melts', collection: 'general',
    description: 'Vela aromática en envase de vidrio con tapa de bambú. Permite escoger aroma y hasta dos diseños de wax melts.',
    priceCop: 25000, image: image('vela-wax-melts-160g'), weight: '160 g',
    fragrances: ['Frutos rojos', 'Maracuyá', 'Vainilla'], options: ['Estrellas', 'Corazones', 'Nubes'],
    features: ['Hasta 2 diseños de wax melts', 'Envase de vidrio', 'Tapa de bambú', 'Cera 100% vegetal'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 5 }, featured: true,
  },
  {
    id: 'wax-100', slug: 'vela-wax-melts-100g', name: 'Vela Wax Melts 100 g',
    category: 'Wax melts', collection: 'general',
    description: 'Vela aromática en envase y tapa de vidrio. Permite escoger aroma y hasta dos diseños de wax melts.',
    priceCop: 12000, image: image('vela-wax-melts-100g'), weight: '100 g',
    fragrances: ['Frutos rojos', 'Maracuyá', 'Vainilla'], options: ['Corazones', 'Estrellas', 'Nubes'],
    features: ['Hasta 2 diseños de wax melts', 'Envase y tapa de vidrio', 'Cera 100% vegetal'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 5 },
  },
  {
    id: 'bouquet-small', slug: 'bouquet-pequeno', name: 'Bouquet pequeño',
    category: 'Bouquets', collection: 'general',
    description: 'Bouquet artesanal de velas con aroma a rosas, flores preservadas, moño, base y tarjeta personalizada.',
    priceCop: 85000, image: image('bouquet-velas'), dimensions: '15,5 × 11 cm',
    colors: ['Amarillo', 'Rojo', 'Rosado', 'Morado'],
    features: ['2 rosas', '2 peonías', '1 oso', '2 margaritas', 'Flores preservadas', 'Moño, base y tarjeta personalizada'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 7 }, featured: true,
  },
  {
    id: 'bouquet-medium', slug: 'bouquet-mediano', name: 'Bouquet mediano',
    category: 'Bouquets', collection: 'general',
    description: 'Bouquet artesanal de velas con aroma a rosas, flores preservadas, moño, base y tarjeta personalizada.',
    priceCop: 115000, image: image('bouquet-velas'), dimensions: '16 × 16 cm',
    colors: ['Amarillo', 'Rojo', 'Rosado', 'Morado'], options: ['Margaritas', 'Girasoles'],
    features: ['4 rosas', '2 peonías', '1 oso', '4 margaritas o girasoles', 'Flores preservadas', 'Moño, base y tarjeta personalizada'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 7 }, popular: true,
  },
  {
    id: 'bouquet-large', slug: 'bouquet-grande', name: 'Bouquet grande',
    category: 'Bouquets', collection: 'general',
    description: 'Bouquet artesanal de velas con aroma a rosas, flores preservadas, moño, base y tarjeta personalizada.',
    priceCop: 150000, image: image('bouquet-velas'), dimensions: '22 × 16 cm',
    colors: ['Amarillo', 'Rojo', 'Rosado', 'Morado'], options: ['Margaritas', 'Girasoles'],
    features: ['4 rosas', '4 peonías grandes', '2 peonías pequeñas', '4 margaritas o girasoles', '2 osos', 'Flores preservadas', 'Moño, base y tarjeta personalizada'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 7 },
  },
  {
    id: 'rec-animals', slug: 'recordatorios-animales', name: 'Recordatorios de animales',
    category: 'Recordatorios', collection: 'general',
    description: 'Recuerdos artesanales personalizables en color y aroma, con empaque transparente y tarjeta personalizada.',
    priceCop: 5000, priceMaxCop: 15000, priceLabel: 'Desde $5.000 hasta $15.000 c/u',
    image: image('recordatorios-animales-a'), images: [image('recordatorios-animales-a'), image('recordatorios-animales-b')],
    options: ['Jirafa', 'León', 'Pato', 'Elefante', 'Hipopótamo'],
    features: ['Color a elección', 'Aroma a elección', 'Empaque transparente', 'Tarjeta personalizada'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 9 },
  },
  {
    id: 'rec-bears-cars', slug: 'recordatorios-osos-carritos', name: 'Recordatorios osos y carritos',
    category: 'Recordatorios', collection: 'general',
    description: 'Recordatorio de osito cariñosito o carrito, personalizado con el color y aroma que prefieras.',
    priceCop: 10000, image: image('recordatorios-osos'), images: [image('recordatorios-osos'), image('recordatorios-carritos')],
    options: ['Osito cariñosito', 'Carrito'],
    features: ['Color a elección', 'Aroma a elección', 'Empaque transparente', 'Tarjeta personalizada'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 9 }, popular: true,
  },
  {
    id: 'rec-flowers', slug: 'recordatorios-florivelas', name: 'Recordatorios florivelas',
    category: 'Recordatorios', collection: 'general',
    description: 'Recordatorios florales personalizables en color y aroma, con empaque transparente y tarjeta personalizada.',
    priceCop: 5000, priceMaxCop: 15000, priceLabel: 'Desde $5.000 hasta $15.000 c/u', image: image('recordatorios-flores'),
    options: ['Margarita', 'Girasol', 'Mini peonía', 'Peonía grande', 'Rosa'],
    features: ['Color a elección', 'Aroma a elección', 'Empaque transparente', 'Tarjeta personalizada'],
    availability: 'Hecho bajo pedido', source: { catalog: 'general', page: 9 }, featured: true,
  },
  {
    id: 'nav-pine', slug: 'pino-de-navidad', name: 'Pino de Navidad', category: 'Navidad', collection: 'navidad',
    description: 'Arbolito de Navidad artesanal en verde oscuro o tonos pastel.', priceCop: 12000,
    image: image('pino-navidad'), dimensions: '12 cm de alto', colors: ['Verde oscuro', 'Tonos pastel'],
    features: ['Vela decorativa artesanal', 'Color personalizable'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 2 }, featured: true,
  },
  {
    id: 'nav-gingerbread', slug: 'galleta-de-jengibre', name: 'Galleta de jengibre', category: 'Navidad', collection: 'navidad',
    description: 'Vela artesanal con forma de galleta de jengibre.', priceCop: 10000,
    image: image('galleta-jengibre'), dimensions: '7,5 cm de alto', colors: ['Blanco', 'Café', 'Beige'],
    features: ['Vela decorativa artesanal', 'Tres colores disponibles'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 2 },
  },
  {
    id: 'nav-leaf-tree', slug: 'arbol-de-hojas', name: 'Árbol de hojas', category: 'Navidad', collection: 'navidad',
    description: 'Vela de árbol con textura de hojas en tonos pastel o efecto degradé rojo y verde.', priceCop: 15000,
    image: image('arbol-hojas'), dimensions: '8,3 cm de alto', colors: ['Tonos pastel', 'Degradé rojo y verde'],
    features: ['Textura de hojas', 'Acabado artesanal'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 3 }, popular: true,
  },
  {
    id: 'nav-snowman', slug: 'muneco-de-nieve', name: 'Muñeco de nieve', category: 'Navidad', collection: 'navidad',
    description: 'Muñeco de nieve blanco terminado con pintura artesanal.', priceCop: 14000,
    image: image('muneco-nieve'), dimensions: '9 cm de alto', colors: ['Blanco'],
    features: ['Pintura artesanal', 'Vela decorativa'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 3 },
  },
  {
    id: 'nav-reindeer', slug: 'renos-2d', name: 'Renos 2D', category: 'Navidad', collection: 'navidad',
    description: 'Reno 2D artesanal en café y blanco. La base exhibida no está incluida.', priceCop: 14000,
    image: image('renos-2d'), dimensions: '9,5 cm de alto', colors: ['Café', 'Blanco'],
    features: ['Acabado bicolor', 'No incluye base'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 4 },
  },
  {
    id: 'nav-snowflake', slug: 'copo-de-nieve', name: 'Copo de nieve', category: 'Navidad', collection: 'navidad',
    description: 'Vela blanca artesanal con forma de copo de nieve.', priceCop: 12000,
    image: image('copo-nieve'), dimensions: '3 cm de alto × 7 cm de ancho', colors: ['Blanco'],
    features: ['Diseño de copo de nieve', 'Vela decorativa'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 4 },
  },
  {
    id: 'nav-nativity-tree', slug: 'arbol-pesebre', name: 'Árbol pesebre', category: 'Navidad', collection: 'navidad',
    description: 'Vela artesanal que combina la silueta de un árbol con una escena de pesebre.', priceCop: 10000,
    image: image('arbol-pesebre'), dimensions: '8 cm de alto × 6 cm de ancho', colors: ['Tonos pastel', 'Efecto degradé'],
    features: ['Diseño de pesebre', 'Color personalizable'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 5 }, featured: true,
  },
  {
    id: 'nav-dessert', slug: 'vela-postre-chantilli', name: 'Vela postre chantillí', category: 'Navidad', collection: 'navidad',
    description: 'Vela en vaso de vidrio con efecto chantillí y decoración navideña.', priceCop: 25000,
    image: image('vela-postre-chantilli'), dimensions: '7 cm de alto',
    colors: ['Base café', 'Base blanca', 'Chantillí verde', 'Chantillí blanco'],
    features: ['Vaso de vidrio', 'Efecto chantillí', 'Decoración navideña'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 5 }, referenceImage: true,
  },
  {
    id: 'nav-wax-glass', slug: 'vaso-de-wax-melts-navidenos', name: 'Vaso de Wax Melts', category: 'Navidad', collection: 'navidad',
    description: 'Vaso de vidrio con tapa de bambú, fragancia a elección y wax melts navideños personalizables.', priceCop: 25000,
    image: image('vaso-wax-melts-navidad'),
    fragrances: ['Vainilla', 'Chocolate', 'Naranja', 'Canela'],
    options: ['Árboles navideños', 'Corazones', 'Estrellas', 'Galletas de jengibre'],
    features: ['Vaso de vidrio', 'Tapa de bambú', 'Aroma y figuras a elección'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 6 }, popular: true,
  },
  {
    id: 'nav-tree-glass', slug: 'vaso-arbolito-navideno', name: 'Vaso arbolito navideño', category: 'Navidad', collection: 'navidad',
    description: 'Vaso de policarbonato con arbolito navideño y fragancia a elección.', priceCop: 18000,
    image: image('vaso-arbolito-navideno'), dimensions: 'Vaso de 4 × 4 cm + árbol de 5 cm', colors: ['Tonos pastel', 'Base blanca'],
    features: ['Vaso de policarbonato', 'Fragancia a elección', 'Arbolito decorativo'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 6 }, referenceImage: true,
  },
  {
    id: 'nav-spiral', slug: 'velas-espiral', name: 'Velas espiral', category: 'Navidad', collection: 'navidad',
    description: 'Velas artesanales en espiral, disponibles en el tono pastel que elijas.', priceCop: 12000,
    priceLabel: '$12.000 unidad · Kit x3 $30.000', image: image('velas-espiral'), dimensions: '20 cm de alto × 1,5 cm de diámetro',
    colors: ['Tonos pastel a elección'], options: ['Unidad: $12.000', 'Kit x3: $30.000'],
    features: ['Color personalizable', 'Disponible por unidad o en kit'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 7 }, referenceImage: true,
  },
  {
    id: 'nav-ice-glass', slug: 'vaso-de-hielos', name: 'Vaso de hielos', category: 'Navidad', collection: 'navidad',
    description: 'Vela estilo bebida en vaso de policarbonato, con hielos decorativos y fragancia.', priceCop: 22000,
    image: image('vaso-hielos'), dimensions: '7 cm de alto × 6 cm de ancho',
    features: ['Vaso de policarbonato', 'Efecto bebida con hielos', 'Vela aromática'], availability: 'Hecho bajo pedido',
    source: { catalog: 'navidad', page: 7 },
  },
];

export const categories: ProductCategory[] = [
  'Velas aromáticas', 'Wax melts', 'Bouquets', 'Recordatorios', 'Navidad',
];

export const catalogFacts = {
  productCount: products.length,
  deliveryTime: '2 a 10 días hábiles para la colección navideña, según ubicación y cantidad',
  shipping: 'El envío se calcula según la ciudad y el peso o cantidad del pedido.',
  contactPhone: '+57 320 527 9249',
  instagram: '@celestialvelasart',
  care: [
    'En el primer encendido, deja que la cera se derrita hasta cubrir toda la superficie.',
    'No la uses por más de 2 o 3 horas continuas.',
    'Apágala tapando el envase, sin soplarla.',
    'Recorta un poco el pabilo antes de volver a encenderla.',
  ],
};

export const formatCop = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(value);
