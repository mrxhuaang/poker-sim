"use client";
import React, { useMemo, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { NormalSeat, BettingRound, SidePot } from "@/lib/betting";
import { formatChips } from "@/lib/betting";
import type { Card } from "@/lib/poker";
import { Avatar } from "@/components/players/Avatar";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { getTableTheme, type TableThemeId } from "@/lib/themes";

interface RoundPokerTableProps {
  seats: NormalSeat[];
  community: Card[];
  betting: BettingRound;
  winners?: string[];
  theme?: TableThemeId;
  roomCode?: string;
  isTournament?: boolean;
  selfUid?: string | null;
  ownHole?: [Card, Card] | null;
  revealedHoles?: Record<string, [Card, Card]>;
  cardBack?: string;
}

export function RoundPokerTable({
  seats,
  community,
  betting,
  winners = [],
  theme = "emerald",
  roomCode,
  isTournament = false,
  selfUid,
  ownHole,
  revealedHoles,
  cardBack,
}: RoundPokerTableProps) {
  const [showQR, setShowQR] = useState(false);
  const t = getTableTheme(theme);

  const joinUrl =
    typeof window !== "undefined" && roomCode
      ? `${window.location.origin}/play/${isTournament ? "torneo" : "normal"}/${roomCode}`
      : "";

  // 10 positions for a PokerNow style table
  const positions = useMemo(() => {
    return [
      { x: 50, y: 92 },  // 0: Bottom center
      { x: 15, y: 85 },  // 1: Bottom left
      { x: 5, y: 60 },   // 2: Middle left bottom
      { x: 5, y: 35 },   // 3: Middle left top
      { x: 15, y: 12 },  // 4: Top left
      { x: 50, y: 5 },   // 5: Top center
      { x: 85, y: 12 },  // 6: Top right
      { x: 95, y: 35 },  // 7: Middle right top
      { x: 95, y: 60 },  // 8: Middle right bottom
      { x: 85, y: 85 },  // 9: Bottom right
    ];
  }, []);

  return (
    <div className="relative w-full max-w-[1500px] aspect-[16/8] mx-auto select-none">
      {/* Table Surface */}
      <div 
        className="absolute inset-x-[5%] inset-y-[15%] rounded-[200px] shadow-[inset_0_0_120px_rgba(0,0,0,0.6),0_40px_100px_-30px_rgba(0,0,0,0.8)] overflow-hidden"
        style={{ 
          background: t.feltGradient,
          boxShadow: `inset 0 0 120px rgba(0,0,0,0.6), 0 40px 100px -30px rgba(0,0,0,0.8), 0 0 0 12px #27272a, 0 0 0 14px #3f3f46`
        }}
      >
        {/* Subtle wood grain or texture could go here */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {/* Central Area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {/* Pot Display */}
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500 mb-2">
            <div className="px-6 py-2 rounded-xl bg-black/60 backdrop-blur-md ring-1 ring-white/10 flex flex-col items-center gap-0.5">
              <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold">Total Pot</span>
              <span className="text-2xl font-bold text-white tabular-nums">{formatChips(betting.pot)}</span>
            </div>
            {betting.sidePots.length > 1 && (
              <div className="flex gap-2 mt-2">
                {betting.sidePots.map((sp, i) => (
                  <div key={i} className="px-2 py-1 rounded bg-black/40 text-[10px] text-zinc-400 ring-1 ring-white/5 tabular-nums">
                    Side {i+1}: {formatChips(sp.amount)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Community Cards */}
          <div className="flex items-center gap-3">
            {community.map((c, i) => (
              <div key={c.id + i} className="animate-in slide-in-from-bottom-2 fade-in duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                <PlayingCard card={c} faceUp size="md" dealIn={false} />
              </div>
            ))}
            {Array.from({ length: 5 - community.length }).map((_, i) => (
              <div key={`empty-${i}`} className="opacity-10">
                <div className="w-14 h-20 sm:w-20 sm:h-28 rounded-xl border-2 border-dashed border-white/40" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seats */}
      {seats.map((seat, i) => {
        const pos = positions[i] || positions[0];
        const isToAct = betting.toActId === seat.id;
        const isWinner = winners.includes(seat.id);
        const isDealer = betting.dealerIdx === i;
        
        // Calculate bet position (towards center)
        const targetX = 50;
        const targetY = 50;
        const dx_center = targetX - pos.x;
        const dy_center = targetY - pos.y;
        const dist = Math.sqrt(dx_center * dx_center + dy_center * dy_center);
        
        const betDist = 14; // Fixed distance from seat towards center
        const bx = pos.x + (dx_center / dist) * betDist;
        const by = pos.y + (dy_center / dist) * (betDist * 0.8); // Adjust for perspective

        // Dealer button position
        const dDist = 18;
        const dx = pos.x + (dx_center / dist) * dDist + (dy_center/dist)*5;
        const dy = pos.y + (dy_center / dist) * dDist - (dx_center/dist)*5;

        const isSelf = !!selfUid && seat.id === selfUid;
        const isDealt =
          (seat.status === "active" ||
            seat.status === "all-in" ||
            seat.status === "folded") &&
          betting.handNum > 0;
        const showFaceUp =
          isDealt &&
          ((isSelf && ownHole) ||
            (seat.revealed && revealedHoles && revealedHoles[seat.id]));
        const faceUpCards: [Card, Card] | null = showFaceUp
          ? isSelf && ownHole
            ? ownHole
            : revealedHoles
              ? revealedHoles[seat.id] ?? null
              : null
          : null;

        return (
          <React.Fragment key={seat.id}>
            {/* Seat Box (PokerNow Style) */}
            <div
              className={`absolute flex flex-col items-center transition-all duration-300 ${isToAct ? 'z-30' : 'z-20'}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* Hole cards above avatar */}
              {isDealt && (
                <div className={`absolute -top-20 left-1/2 -translate-x-1/2 flex gap-0.5 z-0 ${seat.status === 'folded' ? 'opacity-30 grayscale' : ''}`}>
                  {faceUpCards ? (
                    faceUpCards.map((c, ci) => (
                      <div
                        key={c.id + ci}
                        style={{
                          transform: `rotate(${ci === 0 ? -6 : 6}deg) translateY(${ci === 0 ? 0 : -2}px)`,
                        }}
                      >
                        <PlayingCard card={c} faceUp size="sm" cardBack={cardBack as never} />
                      </div>
                    ))
                  ) : (
                    [0, 1].map((ci) => (
                      <div
                        key={ci}
                        style={{
                          transform: `rotate(${ci === 0 ? -6 : 6}deg) translateY(${ci === 0 ? 0 : -2}px)`,
                        }}
                      >
                        <PlayingCard
                          card={{ id: `back-${seat.id}-${ci}`, rank: "A", suit: "S" } as Card}
                          faceUp={false}
                          size="sm"
                          cardBack={cardBack as never}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Avatar above seat */}
              <div className={`absolute -top-7 left-1/2 -translate-x-1/2 z-10 rounded-full ring-2 transition-all ${
                isToAct
                  ? 'ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.5)]'
                  : isWinner
                    ? 'ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                    : 'ring-zinc-700'
              } ${seat.status === 'folded' ? 'opacity-40 grayscale' : ''}`}>
                <div className="rounded-full overflow-hidden bg-zinc-900">
                  <Avatar seed={seat.seed} size={40} />
                </div>
              </div>

              <div className={`relative min-w-[100px] sm:min-w-[120px] rounded-lg overflow-hidden transition-all duration-500 border-2 mt-3 ${
                isToAct
                  ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                  : isWinner
                    ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]'
                    : 'border-zinc-700 shadow-xl'
              }`}>
                <div className={`flex flex-col bg-zinc-900/95 backdrop-blur-md ${seat.status === 'folded' ? 'opacity-40 grayscale' : ''}`}>
                  {/* Name Area */}
                  <div className={`px-2 pt-2 pb-1.5 border-b border-white/5 text-center ${isToAct ? 'bg-emerald-500/10' : ''}`}>
                    <span className="text-xs font-bold text-zinc-100 truncate block">{seat.name}</span>
                  </div>
                  {/* Chips Area */}
                  <div className="px-2 py-2 text-center bg-black/40">
                    <span className="text-[11px] sm:text-xs text-white font-mono font-black tabular-nums">{formatChips(seat.chips)}</span>
                  </div>
                  {/* Timer Bar */}
                  {isToAct && (
                    <div className="w-full h-1 bg-zinc-800">
                      <div className="h-full bg-emerald-400 animate-[timer_15s_linear_infinite]" />
                    </div>
                  )}
                </div>

                {/* Status Overlays */}
                {seat.status === 'folded' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fold</span>
                  </div>
                )}
                {seat.status === 'sit-out' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Away</span>
                  </div>
                )}
              </div>
              
              {/* Winner Icon */}
              {isWinner && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 animate-bounce">
                  <div className="bg-amber-400 text-amber-950 p-1 rounded-full shadow-lg">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  </div>
                </div>
              )}
            </div>

            {/* Bet Display (PokerNow style chips) */}
            {seat.bet > 0 && (
              <div 
                className="absolute animate-in zoom-in fade-in duration-300 z-10"
                style={{ left: `${bx}%`, top: `${by}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/20 shadow-2xl flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20 shadow-[inset_0_0_2px_rgba(255,255,255,0.5)]" />
                    <span className="text-[11px] sm:text-xs font-black text-white tabular-nums leading-none">
                      {formatChips(seat.bet)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Dealer Button */}
            {isDealer && (
              <div 
                className="absolute z-20 animate-in fade-in duration-500"
                style={{ left: `${dx}%`, top: `${dy}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-lg ring-2 ring-zinc-500 flex items-center justify-center">
                  <span className="text-[11px] sm:text-[12px] font-black text-black leading-none">D</span>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* QR Button (Small corner) */}
      {roomCode && (
        <button
          onClick={() => setShowQR(true)}
          className="absolute top-2 right-2 p-2 rounded-lg glass hover:bg-white/10 transition text-zinc-500 hover:text-white z-50"
          title="Show Invite"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-900 rounded-3xl p-8 ring-1 ring-white/10 relative max-w-sm w-full shadow-2xl">
            <button
              onClick={() => setShowQR(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-zinc-500 hover:text-white transition"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-zinc-100">Invitación a la mesa</h3>
                <p className="text-sm text-zinc-400 mt-1">Escanea para unirte a jugar</p>
              </div>
              <div className="p-4 bg-white rounded-2xl">
                <QRCodeSVG value={joinUrl} size={240} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-[0.3em] text-zinc-500 font-bold">Código de sala</span>
                <span className="text-4xl font-mono font-black text-emerald-400 tracking-[0.2em]">{roomCode}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes timer {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
