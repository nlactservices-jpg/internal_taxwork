"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared client favourites store. Persists to localStorage under the same key
 * used by the Clients page, so a client starred in either place is reflected
 * everywhere. Favourites are not tied to a user account or device.
 */
export const CLIENT_FAVORITES_STORAGE_KEY = "clients.favorites";

export function useClientFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [onlyFav, setOnlyFav] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(CLIENT_FAVORITES_STORAGE_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        setFavorites(stored.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CLIENT_FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  return { favorites, toggleFav, onlyFav, setOnlyFav };
}
