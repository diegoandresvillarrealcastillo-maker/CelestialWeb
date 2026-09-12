'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = {
  id: string; slug: string; name: string; image: string; priceCop: number;
  quantity: number; selectedOptions?: Record<string, string>;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalCop: number;
  addItem(item: Omit<CartItem, 'quantity'>, quantity?: number): void;
  removeItem(id: string, selectedOptions?: Record<string, string>): void;
  setQuantity(id: string, quantity: number, selectedOptions?: Record<string, string>): void;
  clear(): void;
};

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = 'celestial_cart_v1';
const optionKey = (options?: Record<string, string>) => JSON.stringify(Object.entries(options ?? {}).sort(([left], [right]) => left.localeCompare(right)));
const sameLine = (a: { id: string; selectedOptions?: Record<string, string> }, id: string, selectedOptions?: Record<string, string>) =>
  a.id === id && optionKey(a.selectedOptions) === optionKey(selectedOptions);

function validStoredItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const options = item.selectedOptions;
  const validOptions = options === undefined || (
    options !== null && typeof options === 'object' && !Array.isArray(options)
    && Object.entries(options).length <= 3
    && Object.entries(options).every(([key, option]) => ['color', 'fragrance', 'option'].includes(key) && typeof option === 'string' && option.length <= 100)
  );
  return typeof item.id === 'string' && /^[a-zA-Z0-9-]{3,80}$/.test(item.id)
    && typeof item.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) && item.slug.length <= 140
    && typeof item.name === 'string' && item.name.length <= 160
    && typeof item.image === 'string' && item.image.length <= 500
    && (/^\/images\/[a-zA-Z0-9_./-]+$/.test(item.image) || /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/[a-zA-Z0-9_./-]+$/.test(item.image))
    && Number.isInteger(item.priceCop) && Number(item.priceCop) >= 1 && Number(item.priceCop) <= 100_000_000
    && Number.isInteger(item.quantity) && Number(item.quantity) >= 1 && Number(item.quantity) <= 99
    && validOptions;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as unknown;
          if (Array.isArray(parsed)) setItems(parsed.filter(validStoredItem).slice(0, 30));
        }
      } catch { /* An invalid local cart is discarded. */ }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCop: items.reduce((sum, item) => sum + item.priceCop * item.quantity, 0),
    addItem(item, quantity = 1) {
      setItems((current) => {
        const found = current.find((line) => sameLine(line, item.id, item.selectedOptions));
        if (found) return current.map((line) => line === found ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line);
        return [...current, { ...item, quantity: Math.min(99, Math.max(1, quantity)) }];
      });
    },
    removeItem(id, selectedOptions) { setItems((current) => current.filter((item) => !sameLine(item, id, selectedOptions))); },
    setQuantity(id, quantity, selectedOptions) {
      setItems((current) => current.map((item) => sameLine(item, id, selectedOptions) ? { ...item, quantity: Math.min(99, Math.max(1, quantity)) } : item));
    },
    clear() { setItems([]); },
  }), [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
