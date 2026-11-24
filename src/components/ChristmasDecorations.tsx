import React, { useMemo, useState } from 'react';
import { Snowflake, Sparkles } from 'lucide-react';

interface SnowflakeItem {
  id: number;
  left: number;
  duration: number;
  delay: number;
  size: number;
  opacity: number;
}

const BULB_COLORS = [
  'text-red-500 bg-red-500 shadow-[0_0_12px_#ef4444]',
  'text-amber-400 bg-amber-400 shadow-[0_0_12px_#f59e0b]',
  'text-emerald-400 bg-emerald-400 shadow-[0_0_12px_#10b981]',
  'text-blue-400 bg-blue-400 shadow-[0_0_12px_#3b82f6]',
  'text-yellow-300 bg-yellow-300 shadow-[0_0_12px_#fde047]',
  'text-pink-500 bg-pink-500 shadow-[0_0_12px_#ec4899]',
];

function getInitialReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function seededFraction(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const ChristmasDecorations: React.FC = () => {
  const prefersReducedMotion = useMemo(() => getInitialReducedMotion(), []);
  const [snowEnabled, setSnowEnabled] = useState<boolean>(() => !prefersReducedMotion);

  const snowflakes = useMemo<SnowflakeItem[]>(() => {
    if (prefersReducedMotion) return [];
    const cores =
      typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
        ? navigator.hardwareConcurrency
        : 8;
    const count = cores <= 4 ? 8 : 16;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: seededFraction(i * 5 + 1) * 98,
      duration: 6 + seededFraction(i * 5 + 2) * 8,
      delay: seededFraction(i * 5 + 3) * 5,
      size: 10 + seededFraction(i * 5 + 4) * 14,
      opacity: 0.3 + seededFraction(i * 5 + 5) * 0.5,
    }));
  }, [prefersReducedMotion]);

  return (
    <>
      {/* Christmas fairy lights garland */}
      <div
        aria-hidden="true"
        className="w-full relative z-30 overflow-hidden pointer-events-none select-none bg-black/20"
      >
        <div className="w-full flex justify-between items-start px-2 py-1 max-w-7xl mx-auto">
          {Array.from({ length: 24 }).map((_, i) => {
            const colorClass = BULB_COLORS[i % BULB_COLORS.length];
            const delay = (i * 0.18).toFixed(2);
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="w-1.5 h-1.5 bg-emerald-950 rounded-t-xs" />
                <div
                  className={`w-2.5 h-3.5 rounded-full ${prefersReducedMotion ? '' : 'light-bulb'} ${colorClass}`}
                  style={prefersReducedMotion ? undefined : { animationDelay: `${delay}s` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating snowflakes */}
      {snowEnabled && snowflakes.length > 0 && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-20 overflow-hidden"
        >
          {snowflakes.map((f) => (
            <div
              key={f.id}
              className="snowflake"
              style={{
                left: `${f.left}%`,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
                opacity: f.opacity,
              }}
            >
              <Snowflake
                size={f.size}
                className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Snow toggle button */}
      {!prefersReducedMotion && (
        <button
          type="button"
          onClick={() => setSnowEnabled((prev) => !prev)}
          aria-label={snowEnabled ? 'Pausar animación de nieve' : 'Activar animación de nieve'}
          aria-pressed={snowEnabled}
          title={snowEnabled ? 'Pausar animación de nieve' : 'Activar animación de nieve'}
          className="fixed bottom-4 right-4 z-40 bg-emerald-900/85 hover:bg-emerald-800 text-amber-300 backdrop-blur-md text-xs px-2.5 py-1.5 rounded-full border border-emerald-600/40 shadow-lg flex items-center gap-1.5 transition-all opacity-85 hover:opacity-100 cursor-pointer"
        >
          <Sparkles size={13} className={snowEnabled ? 'text-amber-300' : 'text-slate-400'} />
          <span className="hidden sm:inline">{snowEnabled ? 'Nieve activa' : 'Nieve pausada'}</span>
        </button>
      )}
    </>
  );
};
