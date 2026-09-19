"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

export interface CartItemOption {
  optionValueId: string;
  nameAr: string;
  nameEn: string;
  priceDeltaMinor: number;
}

export interface CartItem {
  cartLineId: string;
  productId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  basePriceMinor: number;
  quantity: number;
  options: CartItemOption[];
  note?: string;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; cartLineId: string }
  | { type: "SET_QUANTITY"; cartLineId: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

const STORAGE_KEY = "pizza-house-cart-v1";

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD":
      return { items: [...state.items, action.item] };
    case "REMOVE":
      return { items: state.items.filter((i) => i.cartLineId !== action.cartLineId) };
    case "SET_QUANTITY":
      return {
        items: state.items.map((i) =>
          i.cartLineId === action.cartLineId ? { ...i, quantity: Math.max(1, action.quantity) } : i
        ),
      };
    case "CLEAR":
      return { items: [] };
    case "HYDRATE":
      return { items: action.items };
    default:
      return state;
  }
}

export function unitPriceMinor(item: CartItem): number {
  return item.basePriceMinor + item.options.reduce((sum, o) => sum + o.priceDeltaMinor, 0);
}

export function lineTotalMinor(item: CartItem): number {
  return unitPriceMinor(item) * item.quantity;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "cartLineId">) => void;
  removeItem: (cartLineId: string) => void;
  setQuantity: (cartLineId: string, quantity: number) => void;
  clear: () => void;
  subtotalMinor: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", items: JSON.parse(raw) });
    } catch {
      // ignore corrupt local storage
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // storage may be unavailable (private mode); cart just won't persist
    }
  }, [state.items]);

  const value = useMemo<CartContextValue>(() => {
    const subtotalMinor = state.items.reduce((sum, i) => sum + lineTotalMinor(i), 0);
    const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
    return {
      items: state.items,
      addItem: (item) =>
        dispatch({
          type: "ADD",
          item: { ...item, cartLineId: `${item.productId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
        }),
      removeItem: (cartLineId) => dispatch({ type: "REMOVE", cartLineId }),
      setQuantity: (cartLineId, quantity) => dispatch({ type: "SET_QUANTITY", cartLineId, quantity }),
      clear: () => dispatch({ type: "CLEAR" }),
      subtotalMinor,
      itemCount,
    };
  }, [state.items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
