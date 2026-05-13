"use client";

import { usePathname } from "next/navigation";
import { BorderGlow } from "@/components/ui/BorderGlow";
import { PillNav } from "@/components/nav/PillNav";

const NAV_ITEMS = [
  { href: "/host", label: "Crear sala" },
  { href: "/join", label: "Unirse" },
  { href: "/players", label: "Jugadores" },
] as const;

export function Nav() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-3 py-2.5 sm:px-4">
        <BorderGlow
          className="w-full !border-white/10"
          edgeSensitivity={20}
          glowColor="152 52 48"
          backgroundColor="rgba(10, 11, 16, 0.82)"
          borderRadius={999}
          glowRadius={22}
          glowIntensity={0.85}
          coneSpread={28}
          animated={false}
          colors={["#34d399", "#6ee7b7", "#38bdf8", "#64748b"]}
          fillOpacity={0.32}
        >
          <div className="min-h-0 overflow-hidden rounded-[inherit] px-2 py-1.5 sm:px-3 sm:py-2">
            <PillNav
              logo="/logo.svg"
              logoAlt="Showdown"
              logoHref="/"
              brandTitle="Showdown"
              items={[...NAV_ITEMS]}
              activePath={path}
            />
          </div>
        </BorderGlow>
      </div>
    </header>
  );
}
