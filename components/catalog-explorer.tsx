'use client';

import { useMemo, useState } from 'react';
import type { CatalogProduct } from '@/data/catalog';
import { ProductCard } from './product-card';

type Sort = 'popular' | 'price-asc' | 'price-desc' | 'name';

export function CatalogExplorer({ initialProducts, initialCategory }: { initialProducts: CatalogProduct[]; initialCategory?: string }) {
  const availableCategories = useMemo(() => [...new Set(initialProducts.map((product) => product.category))].sort((a, b) => a.localeCompare(b, 'es')), [initialProducts]);
  const priceCeiling = Math.max(1_000, Math.ceil(Math.max(0, ...initialProducts.map((product) => product.priceCop)) / 1_000) * 1_000);
  const [search, setSearch] = useState('');
  const categoryFromSlug = availableCategories.find((item) => item.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === initialCategory);
  const [category, setCategory] = useState(categoryFromSlug ?? 'Todos');
  const [sort, setSort] = useState<Sort>('popular');
  const [maxPrice, setMaxPrice] = useState(priceCeiling);

  const filtered = useMemo(() => {
    const words = search.toLocaleLowerCase('es').split(/\s+/).filter(Boolean);
    return initialProducts
      .filter((product) => category === 'Todos' || product.category === category)
      .filter((product) => product.priceCop <= maxPrice)
      .filter((product) => words.every((word) => [product.name, product.category, product.description, ...(product.features ?? [])].join(' ').toLocaleLowerCase('es').includes(word)))
      .sort((a, b) => {
        if (sort === 'price-asc') return a.priceCop - b.priceCop;
        if (sort === 'price-desc') return b.priceCop - a.priceCop;
        if (sort === 'name') return a.name.localeCompare(b.name, 'es');
        return Number(Boolean(b.popular)) - Number(Boolean(a.popular)) || Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      });
  }, [category, initialProducts, maxPrice, search, sort]);

  return (
    <div className="catalog-layout">
      <aside className="filters" aria-label="Filtros del catálogo">
        <label className="search-field"><span>Buscar</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Aroma, nombre, detalle…" /><b aria-hidden="true">⌕</b></label>
        <fieldset><legend>Categoría</legend>{['Todos', ...availableCategories].map((item) => <label key={item}><input type="radio" name="category" checked={category === item} onChange={() => setCategory(item)} /><span>{item}</span></label>)}</fieldset>
        <label className="range-field"><span><b>Precio máximo</b><output>${maxPrice.toLocaleString('es-CO')}</output></span><input type="range" min="0" max={priceCeiling} step="1000" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} /></label>
      </aside>
      <div className="catalog-results">
        <div className="catalog-toolbar"><p><b>{filtered.length}</b> piezas encontradas</p><label>Ordenar <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="popular">Más populares</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="name">Nombre</option></select></label></div>
        {filtered.length ? <div className="product-grid catalog-grid">{filtered.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div> : <div className="empty-state"><span>✦</span><h2>No encontramos esa combinación</h2><p>Prueba otro nombre o abre el rango de precio.</p><button onClick={() => { setSearch(''); setCategory('Todos'); setMaxPrice(priceCeiling); }}>Limpiar filtros</button></div>}
      </div>
    </div>
  );
}
