import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Calendar, Sparkles } from 'lucide-react';
import { computeCountdown, CountdownState } from '../utils/tournamentUtils';

interface EventCountdownProps {
  targetIso: string;
  fechaLabel?: string;
  horaLabel?: string;
}

interface TimeTileProps {
  value: number;
  label: string;
  highlight?: boolean;
}

const TimeTile: React.FC<TimeTileProps> = ({ value, label, highlight }) => {
  const formatted = String(value).padStart(2, '0');

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-1.5 py-3 sm:px-5 sm:py-4 text-center shadow-lg ${
        highlight
          ? 'bg-gradient-to-b from-amber-400/20 to-emerald-950/90 border-amber-400/70'
          : 'bg-emerald-950/90 border-emerald-700/70'
      }`}
    >
      <div className="relative h-11 sm:h-14 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={formatted}
            initial={{ y: -14, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 14, opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`font-festive text-2xl sm:text-4xl md:text-5xl font-black tabular-nums leading-none ${
              highlight ? 'text-yellow-300' : 'text-white'
            }`}
          >
            {formatted}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="block mt-1 text-[9px] sm:text-xs font-bold uppercase tracking-wide sm:tracking-widest text-emerald-300 truncate">
        {label}
      </span>
    </div>
  );
};

export const EventCountdown: React.FC<EventCountdownProps> = ({
  targetIso,
  fechaLabel = 'Sábado 19 de diciembre de 2026',
  horaLabel = '16:30 hrs',
}) => {
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    computeCountdown(targetIso)
  );

  useEffect(() => {
    setCountdown(computeCountdown(targetIso));
    const timer = setInterval(() => {
      setCountdown(computeCountdown(targetIso));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetIso]);

  return (
    <div
      data-testid="event-countdown"
      className="max-w-4xl mx-auto mb-8 rounded-3xl bg-gradient-to-r from-[#082a19] via-[#0e3f27] to-[#082a19] border-2 border-amber-400/60 p-4 sm:p-6 shadow-[0_14px_36px_rgba(0,0,0,0.45)]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-emerald-800/80">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <Clock size={18} className="text-amber-400 shrink-0" />
          <span className="font-festive text-base sm:text-lg text-yellow-300 tracking-wide uppercase">
            {countdown.isStarted ? '¡El Torneo Ha Comenzado!' : 'Cuenta Regresiva Para El Torneo'}
          </span>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-1.5 text-xs text-emerald-200 font-semibold">
          <Calendar size={14} className="text-amber-300 shrink-0" />
          <span>
            {fechaLabel} · {horaLabel}
          </span>
        </div>
      </div>

      {countdown.isStarted ? (
        <div className="py-4 text-center flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 text-yellow-300 font-festive text-xl sm:text-2xl">
            <Sparkles size={22} />
            <span>¡Rondas en juego en el Corredor Constitución!</span>
            <Sparkles size={22} />
          </div>
          <p className="text-xs sm:text-sm text-emerald-200">
            Consulta el padrón oficial o acude a la mesa de arbitraje para tu emparejamiento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2.5 sm:gap-4" aria-live="polite" aria-label="Tiempo restante para el evento">
          <TimeTile value={countdown.days} label="Días" highlight />
          <TimeTile value={countdown.hours} label="Horas" />
          <TimeTile value={countdown.minutes} label="Minutos" />
          <TimeTile value={countdown.seconds} label="Segundos" highlight />
        </div>
      )}
    </div>
  );
};
