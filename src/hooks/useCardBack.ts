"use client";
import { useEffect, useState } from "react";
import type { CardBackId } from "@/lib/themes";

const KEY = "showdown:cardBack";
const DEFAULT: CardBackId = "classic-blue";

export function useCardBack() {
  const [cardBack, setCardBack] = useState<CardBackId>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCardBack(raw as CardBackId);
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, cardBack);
    } catch {}
  }, [cardBack, loaded]);

  return { cardBack, setCardBack, loaded };
}
