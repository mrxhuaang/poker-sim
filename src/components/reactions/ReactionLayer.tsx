"use client";
import { useMemo } from "react";
import type { Reaction } from "@/lib/reactions";

type Props = {
  reactions: Reaction[];
};

// Floating emoji burst layer covering the table area
export function ReactionLayer({ reactions }: Props) {
  const items = useMemo(() => {
    return reactions.map((r) => {
      // Deterministic position from id hash so position is stable across re-renders
      let h = 0;
      for (let i = 0; i < r.id.length; i++) h = (h * 31 + r.id.charCodeAt(i)) | 0;
      const x = 20 + (Math.abs(h) % 60); // 20%-80%
      return { ...r, x };
    });
  }, [reactions]);

  if (items.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[55]">
      {items.map((r) => (
        <span
          key={r.id}
          className="absolute bottom-24 text-4xl reaction-float select-none"
          style={{ left: `${r.x}%` }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
