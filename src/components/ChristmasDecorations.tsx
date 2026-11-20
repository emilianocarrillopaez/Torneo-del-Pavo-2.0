import React, { useEffect, useState } from 'react';
import { Snowflake, Sparkles } from 'lucide-react';

export const ChristmasDecorations: React.FC = () => {
  const [snowflakes, setSnowflakes] = useState<Array<{ id: number; left: number; duration: number; delay: number; size: number; opacity: number }>>([]);
  const [snowEnabled, setSnowEnabled] = useState(true);

  useEffect(() => {
    // Generate 18 gentle snowflakes for good performance even on mobile devices
    const flakes = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      left: Math.random() * 98,
      duration: 6 + Math.random() * 8, // 6 to 14s fall time
      delay: Math.random() * 5,
      size: 10 + Math.random() * 14,
      opacity: 0.3 + Math.random() * 0.5,
    }));
    setSnowflakes(flakes);
  }, []);

  const bulbColors = [
    'text-red-500 bg-red-500 shadow-[0_0_12px_#ef4444]',
    'text-amber-400 bg-amber-400 shadow-[0_0_12px_#f59e0b]',
    'text-emerald-400 bg-emerald-400 shadow-[0_0_12px_#10b981]',
    'text-blue-400 bg-blue-400 shadow-[0_0_12px_#3b82f6]',
    'text-yellow-300 bg-yellow-300 shadow-[0_0_12px_#fde047]',
    'text-pink-500 bg-pink-500 shadow-[0_0_12px_#ec4899]',
  ];

  return (
    <>
      {/* Christmas fairy lights garland */}
      <div className="w-full relative z-30 overflow-hidden pointer-events-none select-none bg-black/20">
        <div className="w-full flex justify-between items-start px-2 py-1 max-w-7xl mx-auto">
          {Array.from({ length: 24 }).map((_, i) => {
            const colorClass = bulbColors[i % bulbColors.length];
            const delay = (i * 0.18).toFixed(2);
            return (
              <div key={i} className="flex flex-col items-center">
                {/* Wire socket */}
                <div className="w-1.5 h-1.5 bg-emerald-950 rounded-t-xs" />
                {/* Light bulb */}
                <div
                  className={`w-2.5 h-3.5 rounded-full light-bulb ${colorClass}`}
                  style={{ animationDelay: `${delay}s` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating snowflakes */}
      {snowEnabled && (
        <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
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

      {/* Subtle snow toggle button fixed in corner for user convenience */}
      <button
        onClick={() => setSnowEnabled(!snowEnabled)}
        title={snowEnabled ? 'Pausar animación de nieve' : 'Activar animación de nieve'}
        className="fixed bottom-4 right-4 z-40 bg-emerald-900/80 hover:bg-emerald-800 text-amber-300 backdrop-blur-md text-xs px-2.5 py-1.5 rounded-full border border-emerald-600/40 shadow-lg flex items-center gap-1.5 transition-all opacity-80 hover:opacity-100"
      >
        <Sparkles size={13} className={snowEnabled ? 'text-amber-300' : 'text-slate-400'} />
        <span className="hidden sm:inline">{snowEnabled ? 'Nieve activa' : 'Nieve pausada'}</span>
      </button>
    </>
  );
};
