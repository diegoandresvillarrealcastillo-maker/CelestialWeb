import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="subpage cart-empty">
      <span>✦</span>
      <h1>No encontramos esa página</h1>
      <p>Puede que el enlace haya cambiado o que el producto ya no esté disponible.</p>
      <Link className="button button-primary" href="/catalogo">Volver al catálogo</Link>
    </main>
  );
}
