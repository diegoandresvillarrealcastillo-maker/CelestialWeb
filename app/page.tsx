import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { catalogFacts, products } from '@/data/catalog';

const featured = products.filter((product) => product.featured).slice(0, 4);
const popular = products.filter((product) => product.popular).slice(0, 4);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const organizationData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Celestial Velas Artesanales',
  alternateName: ['Celestial Velas', 'Velas Celestial'],
  url: siteUrl,
  logo: `${siteUrl}/og.png`,
  telephone: '+57 320 527 9249',
  areaServed: { '@type': 'Country', name: 'Colombia' },
  sameAs: ['https://instagram.com/celestialvelasart'],
};
const categoryTiles = [
  { name: 'Velas aromáticas', copy: 'Aromas que transforman espacios', image: '/images/products/vela-aromatica-300g.webp', href: '/catalogo?category=velas-aromaticas' },
  { name: 'Bouquets', copy: 'Flores que iluminan para siempre', image: '/images/products/bouquet-velas.webp', href: '/catalogo?category=bouquets' },
  { name: 'Recordatorios', copy: 'Pequeños gestos, grandes memorias', image: '/images/products/recordatorios-flores.webp', href: '/catalogo?category=recordatorios' },
];

export default function Home() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData).replace(/</g, '\\u003c') }} />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Aromas que guardan momentos</p>
          <h1>Luz hecha<br />con <em>intención.</em></h1>
          <p className="hero-lede">En Celestial Velas creamos piezas artesanales que convierten un espacio cotidiano en un recuerdo: cera vegetal, aromas envolventes y detalles hechos para ti.</p>
          <div className="hero-actions"><Link className="button button-primary" href="/catalogo">Explorar colección <span>↗</span></Link><Link className="button button-quiet" href="#artesania">Conoce el proceso</Link></div>
          <dl className="hero-facts"><div><dt>100%</dt><dd>Cera vegetal</dd></div><div><dt>{catalogFacts.productCount}</dt><dd>Diseños artesanales</dd></div><div><dt>Hecho</dt><dd>Bajo pedido</dd></div></dl>
        </div>
        <div className="hero-visual" aria-label="Colección de velas aromáticas Celestial"><div className="hero-image-wrap"><img src="/images/products/hero-general.webp" alt="Velas Celestial decoradas con café, canela, flores y naranja" /></div><div className="hero-note"><span>01</span><p><b>Café</b><br />El favorito de la casa</p></div><div className="hero-seal" aria-hidden="true"><span>✦</span><small>ARTE · AROMA · CALMA</small></div></div>
      </section>

      <section className="featured-section" aria-labelledby="featured-heading">
        <div className="section-heading"><div><p className="eyebrow"><span /> Selección Celestial</p><h2 id="featured-heading">Detalles que encienden emociones</h2></div><Link href="/catalogo">Ver los {catalogFacts.productCount} productos <span>→</span></Link></div>
        <div className="product-grid">{featured.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div>
      </section>

      <section className="categories-section" aria-labelledby="categories-heading">
        <div className="center-heading"><p className="eyebrow"><span /> Encuentra tu momento</p><h2 id="categories-heading">Una vela para cada historia</h2><p>Diseños creados a mano para acompañar la calma, una celebración o ese detalle que quieres hacer inolvidable.</p></div>
        <div className="category-grid">{categoryTiles.map((tile) => <Link className="category-tile" href={tile.href} key={tile.name}><img src={tile.image} alt="" loading="lazy" /><div><p>{tile.copy}</p><h3>{tile.name}</h3><span>Explorar ↗</span></div></Link>)}</div>
      </section>

      <section className="craft-section" id="artesania">
        <div className="craft-collage"><div className="craft-main"><img src="/images/products/vela-postre-chantilli.webp" alt="Detalle de vela artesanal Celestial" loading="lazy" /></div><div className="craft-small"><img src="/images/products/recordatorios-animales-b.webp" alt="Recordatorios artesanales" loading="lazy" /></div><span className="craft-mark">C</span></div>
        <div className="craft-copy"><p className="eyebrow"><span /> Compromiso Celestial</p><h2>No fabricamos objetos.<br /><em>Creamos atmósferas.</em></h2><p>Cada pieza nace de una elaboración consciente, con ingredientes seleccionados por su pureza, simbolismo y poder evocador.</p><ul><li><b>01</b><span><strong>Artesanía consciente</strong>Hechas a mano con cera 100% vegetal.</span></li><li><b>02</b><span><strong>Inspiración emocional</strong>Aromas pensados para evocar estados de ánimo positivos.</span></li><li><b>03</b><span><strong>Cercanía auténtica</strong>Colores, aromas y detalles adaptados contigo.</span></li></ul><Link className="text-link" href="/catalogo">Descubrir nuestras piezas →</Link></div>
      </section>

      <section className="season-banner">
        <img src="/images/products/hero-navidad.webp" alt="" loading="lazy" />
        <div><p className="eyebrow"><span /> Edición especial</p><h2>Navidad, encendida<br />a mano.</h2><p>Pinos, copos, renos y aromas de temporada para regalar más que un detalle: luz, amor y arte.</p><Link className="button button-light" href="/catalogo?collection=navidad">Ver colección navideña ↗</Link></div>
        <span className="season-year">2026</span>
      </section>

      <section className="popular-section"><div className="section-heading"><div><p className="eyebrow"><span /> Los más elegidos</p><h2>Favoritos de la casa</h2></div><Link href="/catalogo">Explorar todo <span>→</span></Link></div><div className="product-grid">{popular.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div></section>

      <section className="care-section" id="cuidados"><div className="care-title"><p className="eyebrow"><span /> Ritual de cuidado</p><h2>Haz que tu luz<br /><em>dure más.</em></h2><div className="care-orbit" aria-hidden="true">✦</div></div><ol>{catalogFacts.care.map((tip, index) => <li key={tip}><span>{String(index + 1).padStart(2, '0')}</span><p>{tip}</p></li>)}</ol></section>

      <section className="benefits-strip" aria-label="Beneficios"><div><span>✦</span><b>Personalización</b><p>Color, aroma y detalles a elección</p></div><div><span>◌</span><b>Cera vegetal</b><p>Materiales seleccionados con cuidado</p></div><div><span>⌂</span><b>Hecho en Colombia</b><p>Producción artesanal bajo pedido</p></div><div><span>♡</span><b>Atención cercana</b><p>Te acompañamos en cada elección</p></div></section>

      <section className="faq-section" id="faq"><div><p className="eyebrow"><span /> Preguntas frecuentes</p><h2>Antes de encender<br />tu próxima historia.</h2><p>¿Aún tienes dudas? Escríbenos y diseñamos contigo el detalle ideal.</p><a className="text-link" href="https://wa.me/573205279249" target="_blank" rel="noreferrer">Hablar con Celestial →</a></div><div className="faq-list"><details open><summary>¿Puedo elegir el color y el aroma?<span>+</span></summary><p>Sí. Cada producto muestra las opciones disponibles en el catálogo. Los diseños bajo pedido se confirman antes de elaborar.</p></details><details><summary>¿Cuánto tarda mi pedido?<span>+</span></summary><p>Para la colección navideña, entre 2 y 10 días hábiles según ubicación y cantidad. Los demás pedidos se confirman individualmente.</p></details><details><summary>¿El envío está incluido?<span>+</span></summary><p>No. Se calcula según la ciudad, el peso y la cantidad del pedido.</p></details><details><summary>¿Cómo confirmo la compra?<span>+</span></summary><p>Arma tu bolsa, crea el pedido y recibirás la confirmación. También puedes consultar directamente por WhatsApp.</p></details></div></section>
    </main>
  );
}
