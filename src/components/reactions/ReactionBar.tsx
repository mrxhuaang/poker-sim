"use client";
import { useState } from "react";
import { Smile, X } from "lucide-react";
import { REACTIONS, sendReaction } from "@/lib/reactions";

type Props = {
  code: string | null;
  uid: string | null;
};

export function ReactionBar({ code, uid }: Props) {
  const [open, setOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  async function emit(emoji: string) {
    if (!code || !uid || cooldown) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 800);
    await sendReaction(code, uid, emoji).catch(() => {});
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-3 rounded-2xl glass hover:bg-white/10 ring-1 ring-white/10 text-zinc-300 transition btn-press shadow-xl"
        title="Reaccionar"
      >
        <Smile className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-zinc-900/95 ring-1 ring-white/10 shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-150">
      {REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => emit(e)}
          disabled={cooldown || !uid}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-xl hover:bg-white/10 disabled:opacity-40 transition btn-press"
          title={e}
        >
          {e}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="ml-1 p-1.5 rounded-xl text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
