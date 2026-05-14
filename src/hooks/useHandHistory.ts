"use client";
import { useEffect, useState } from "react";
import { subscribeHandHistory, type HandRecord } from "@/lib/handHistory";

export function useHandHistory(code: string | null): HandRecord[] {
  const [list, setList] = useState<HandRecord[]>([]);
  useEffect(() => {
    if (!code) {
      setList([]);
      return;
    }
    return subscribeHandHistory(code, setList);
  }, [code]);
  return list;
}
