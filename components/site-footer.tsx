import Link from 'next/link';
import { catalogFacts } from '@/data/catalog';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <p className="eyebrow"><span /> Encendamos un recuerdo</p>
        <h2>Tu momento merece<br /><em>su propia luz.</em></h2>
        <a className="button button-light" href={`https://wa.me/573205279249`} target="_blank" rel="noreferrer">Hablar por WhatsApp ↗</a>
      </div>
      <div className="footer-links">
        <div><b>Explora</b><Link href="/catalogo">Todos los productos</Link><Link href="/catalogo?collection=navidad">Navidad</Link><Link href="/catalogo?category=bouquets">Bouquets</Link></div>
        <div><b>Ayuda</b><Link href="/cuenta">Mi cuenta</Link><Link href="/carrito">Mi bolsa</Link><Link href="/#cuidados">Cuida tu vela</Link></div>
        <div><b>Encuéntranos</b><a href="https://instagram.com/celestialvelasart" target="_blank" rel="noreferrer">{catalogFacts.instagram}</a><a href="tel:+573205279249">{catalogFacts.contactPhone}</a><span>Colombia</span></div>
      </div>
      <div className="footer-bottom"><span>© 2026 Celestial Velas Artesanales</span><Link href="/politica-de-privacidad">Política de privacidad</Link><span>Hecho con intención en Colombia</span></div>
    </footer>
  );
}
