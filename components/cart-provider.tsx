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
  removeItem(id: string): void;
  setQuantity(id: string, quantity: number): void;
  clear(): void;
};

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = 'celestial_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as CartItem[];
          if (Array.isArray(parsed)) setItems(parsed.slice(0, 30));
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
        const found = current.find((line) => line.id === item.id && JSON.stringify(line.selectedOptions) === JSON.stringify(item.selectedOptions));
        if (found) return current.map((line) => line === found ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line);
        return [...current, { ...item, quantity: Math.min(99, Math.max(1, quantity)) }];
      });
    },
    removeItem(id) { setItems((current) => current.filter((item) => item.id !== id)); },
    setQuantity(id, quantity) {
      setItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.min(99, Math.max(1, quantity)) } : item));
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
