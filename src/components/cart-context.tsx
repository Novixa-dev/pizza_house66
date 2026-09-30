"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";

// Cart state.
//
// The cart lives in localStorage, not on the server: a guest has no account
// to hang it on, and the server re-prices everything at checkout anyway, so
// there is nothing here worth protecting or synchronizing. What *is* worth
// care is that a corrupt or stale stored cart must never crash the app —
// hence the validation on hydrate.

export interface CartItemOption {
  optionValueId: string;
  groupNameAr: string;
  groupNameEn: string;
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
  imageUrl: string | null;
  basePriceMinor: number;
  quantity: number;
  options: CartItemOption[];
  note?: string;
}

interface CartState {
  items: CartItem[];
  hydrated: boolean;
}

type CartAction =
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; cartLineId: string }
  | { type: "SET_QUANTITY"; cartLineId: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

const STORAGE_KEY = "pizza-house-cart-v2";
const MAX_QUANTITY = 20;

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      // Adding the same product with identical options bumps the existing
      // line rather than stacking duplicates the customer then has to tidy up.
      const existing = state.items.find((item) => isSameConfiguration(item, action.item));
      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.cartLineId === existing.cartLineId
              ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + action.item.quantity) }
              : item
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case "REMOVE":
      return { ...state, items: state.items.filter((item) => item.cartLineId !== action.cartLineId) };
    case "SET_QUANTITY":
      return {
        ...state,
        items: state.items.map((item) =>
          item.cartLineId === action.cartLineId
            ? { ...item, quantity: Math.min(MAX_QUANTITY, Math.max(1, action.quantity)) }
            : item
        ),
      };
    case "CLEAR":
      return { ...state, items: [] };
    case "HYDRATE":
      return { items: action.items, hydrated: true };
    default:
      return state;
  }
}

function isSameConfiguration(a: CartItem, b: CartItem): boolean {
  if (a.productId !== b.productId) return false;
  if ((a.note ?? "") !== (b.note ?? "")) return false;
  const optionsOf = (item: CartItem) =>
    item.options
      .map((option) => option.optionValueId)
      .sort()
      .join("|");
  return optionsOf(a) === optionsOf(b);
}

export function unitPriceMinor(item: CartItem): number {
  return item.options.reduce((sum, option) => sum + option.priceDeltaMinor, item.basePriceMinor);
}

export function lineTotalMinor(item: CartItem): number {
  return unitPriceMinor(item) * item.quantity;
}

/** Guards against a stored cart written by an older build or hand-edited. */
function parseStoredCart(raw: string): CartItem[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((candidate): candidate is CartItem => {
    if (typeof candidate !== "object" || candidate === null) return false;
    const item = candidate as Partial<CartItem>;
    return (
      typeof item.cartLineId === "string" &&
      typeof item.productId === "string" &&
      typeof item.basePriceMinor === "number" &&
      typeof item.quantity === "number" &&
      item.quantity > 0 &&
      Array.isArray(item.options)
    );
  });
}

interface CartContextValue {
  items: CartItem[];
  hydrated: boolean;
  addItem: (item: Omit<CartItem, "cartLineId">) => void;
  removeItem: (cartLineId: string) => void;
  setQuantity: (cartLineId: string, quantity: number) => void;
  clear: () => void;
  subtotalMinor: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [], hydrated: false });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      dispatch({ type: "HYDRATE", items: raw ? parseStoredCart(raw) : [] });
    } catch {
      // Private mode, disabled storage, or corrupt JSON: start empty rather
      // than leaving the app stuck behind an unhydrated cart.
      dispatch({ type: "HYDRATE", items: [] });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return; // don't overwrite storage with the empty initial state
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      // Storage may be full or unavailable; the cart simply won't persist.
    }
  }, [state.items, state.hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "cartLineId">) => {
    dispatch({
      type: "ADD",
      item: { ...item, cartLineId: crypto.randomUUID() },
    });
  }, []);

  const removeItem = useCallback((cartLineId: string) => {
    dispatch({ type: "REMOVE", cartLineId });
  }, []);

  const setQuantity = useCallback((cartLineId: string, quantity: number) => {
    dispatch({ type: "SET_QUANTITY", cartLineId, quantity });
  }, []);

  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      hydrated: state.hydrated,
      addItem,
      removeItem,
      setQuantity,
      clear,
      subtotalMinor: state.items.reduce((sum, item) => sum + lineTotalMinor(item), 0),
      itemCount: state.items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [state.items, state.hydrated, addItem, removeItem, setQuantity, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
