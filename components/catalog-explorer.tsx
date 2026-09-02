'use client';

import { useMemo, useState } from 'react';
import { categories, type CatalogProduct } from '@/data/catalog';
import { ProductCard } from './product-card';

type Sort = 'popular' | 'price-asc' | 'price-desc' | 'name';

export function CatalogExplorer({ initialProducts, initialCollection, initialCategory }: { initialProducts: CatalogProduct[]; initialCollection?: string; initialCategory?: string }) {
  const [search, setSearch] = useState('');
  const categoryFromSlug: Record<string, string> = { 'velas-aromaticas': 'Velas aromáticas', 'wax-melts': 'Wax melts', bouquets: 'Bouquets', recordatorios: 'Recordatorios', navidad: 'Navidad' };
  const [category, setCategory] = useState(categoryFromSlug[initialCategory ?? ''] ?? 'Todos');
  const [collection, setCollection] = useState(['general', 'navidad'].includes(initialCollection ?? '') ? initialCollection! : 'todas');
  const [sort, setSort] = useState<Sort>('popular');
  const [maxPrice, setMaxPrice] = useState(150000);

  const filtered = useMemo(() => {
    const words = search.toLocaleLowerCase('es').split(/\s+/).filter(Boolean);
    return initialProducts
      .filter((product) => category === 'Todos' || product.category === category)
      .filter((product) => collection === 'todas' || product.collection === collection)
      .filter((product) => product.priceCop <= maxPrice)
      .filter((product) => words.every((word) => [product.name, product.category, product.description, ...(product.features ?? [])].join(' ').toLocaleLowerCase('es').includes(word)))
      .sort((a, b) => {
        if (sort === 'price-asc') return a.priceCop - b.priceCop;
        if (sort === 'price-desc') return b.priceCop - a.priceCop;
        if (sort === 'name') return a.name.localeCompare(b.name, 'es');
        return Number(Boolean(b.popular)) - Number(Boolean(a.popular)) || Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      });
  }, [category, collection, initialProducts, maxPrice, search, sort]);

  return (
    <div className="catalog-layout">
      <aside className="filters" aria-label="Filtros del catálogo">
        <label className="search-field"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Aroma, nombre, detalle…" /><b aria-hidden="true">⌕</b></label>
        <fieldset><legend>Categoría</legend>{['Todos', ...categories].map((item) => <label key={item}><input type="radio" name="category" checked={category === item} onChange={() => setCategory(item)} /><span>{item}</span></label>)}</fieldset>
        <fieldset><legend>Colección</legend><label><input type="radio" name="collection" checked={collection === 'todas'} onChange={() => setCollection('todas')} /><span>Todas</span></label><label><input type="radio" name="collection" checked={collection === 'general'} onChange={() => setCollection('general')} /><span>Esenciales</span></label><label><input type="radio" name="collection" checked={collection === 'navidad'} onChange={() => setCollection('navidad')} /><span>Navidad</span></label></fieldset>
        <label className="range-field"><span><b>Precio máximo</b><output>${maxPrice.toLocaleString('es-CO')}</output></span><input type="range" min="12000" max="150000" step="1000" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /></label>
      </aside>
      <div className="catalog-results">
        <div className="catalog-toolbar"><p><b>{filtered.length}</b> piezas encontradas</p><label>Ordenar <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="popular">Más populares</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre</option></select></label></div>
        {filtered.length ? <div className="product-grid catalog-grid">{filtered.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div> : <div className="empty-state"><span>✦</span><h2>No encontramos esa combinación</h2><p>Prueba otro nombre o abre el rango de precio.</p><button onClick={() => { setSearch(''); setCategory('Todos'); setCollection('todas'); setMaxPrice(150000); }}>Limpiar filtros</button></div>}
      </div>
    </div>
  );
}
