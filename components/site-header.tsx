'use client';

import Link from 'next/link';
import { useCart } from './cart-provider';

export function SiteHeader() {
  const { count } = useCart();
  return (
    <>
      <div className="announcement">
        <span>Hechas a mano en Colombia</span><span className="announcement-dot" aria-hidden="true" />
        <span>Envíos calculados según tu ciudad</span>
      </div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Celestial, inicio">
          <img src="/images/products/logo-celestial.webp" alt="" />
          <span><b>Celestial</b><small>Velas artesanales</small></span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/#artesania">Nuestra esencia</Link>
          <Link href="/#cuidados">Cuidados</Link>
        </nav>
        <div className="header-actions">
          <Link className="text-action" href="/cuenta">Mi cuenta</Link>
          <Link className="bag-action" href="/carrito" aria-label={`Abrir carrito, ${count} productos`}>
            <span>Bolsa</span><b aria-hidden="true">{count}</b>
          </Link>
        </div>
      </header>
    </>
  );
}
