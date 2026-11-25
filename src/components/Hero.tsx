import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  ChevronDown,
  Trophy,
  Sparkles,
  ZoomIn,
  X,
  FileText,
  Gift,
  Clock,
} from 'lucide-react';
import { TournamentConfig } from '../types/tournament';
import { EventCountdown } from './EventCountdown';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface HeroProps {
  config: TournamentConfig;
  totalRegistered: number;
  isCountLoading?: boolean;
  onViewParticipants?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  config,
  totalRegistered,
  isCountLoading = false,
  onViewParticipants,
}) => {
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [showConvocatoriaModal, setShowConvocatoriaModal] = useState(false);

  const posterModalRef = useRef<HTMLDivElement>(null);
  const convocatoriaModalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(posterModalRef, () => setShowPosterModal(false), showPosterModal);
  useFocusTrap(
    convocatoriaModalRef,
    () => setShowConvocatoriaModal(false),
    showConvocatoriaModal
  );

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const placesLeft = Math.max(0, config.cupoMaximo - totalRegistered);
  const percentFilled = Math.min(
    100,
    Math.round((totalRegistered / Math.max(1, config.cupoMaximo)) * 100)
  );
  const deadlineMs = config.fechaLimiteIso ? Date.parse(config.fechaLimiteIso) : Number.NaN;
  const deadlinePassed = !Number.isNaN(deadlineMs) && nowMs > deadlineMs;
  const isWaitlist =
    config.inscripcionesAbiertas &&
    !deadlinePassed &&
    !isCountLoading &&
    placesLeft <= 0 &&
    config.habilitarListaEspera !== false;
  const isClosed =
    !config.inscripcionesAbiertas ||
    deadlinePassed ||
    (!isCountLoading && placesLeft <= 0 && !isWaitlist);

  const getStatusBadge = () => {
    if (isCountLoading) {
      return {
        label: 'Consultando disponibilidad...',
        tone: 'bg-emerald-950/90 text-emerald-200 border-emerald-600/60',
      };
    }
    if (!config.inscripcionesAbiertas || deadlinePassed) {
      return {
        label: 'Inscripciones cerradas',
        tone: 'bg-red-950/85 text-red-200 border-red-500/60',
      };
    }
    if (isWaitlist) {
      return {
        label: 'Cupo lleno · Lista de espera abierta',
        tone: 'bg-amber-950/85 text-amber-200 border-amber-400/70',
      };
    }
    if (isClosed) {
      return {
        label: 'Cupo completo',
        tone: 'bg-red-950/85 text-red-200 border-red-500/60',
      };
    }
    return {
      label: `Inscripciones abiertas · ${placesLeft} lugares disponibles`,
      tone: 'bg-amber-400/20 text-amber-200 border-amber-400/40',
    };
  };

  const statusBadge = getStatusBadge();

  return (
    <section id="inicio" className="relative pt-4 sm:pt-6 pb-16 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-80 h-80 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main Flyer Title & Slogan */}
        <div className="text-center mb-6">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-red-950/80 border border-red-500/50 text-red-200 text-xs sm:text-sm font-semibold mb-3 shadow-inner">
            <Sparkles size={14} className="text-amber-400" aria-hidden="true" />
            <span className="font-festive text-yellow-300">VÍSPERAS NAVIDEÑAS · EDICIÓN 2.0</span>
            <span className="hidden sm:inline text-red-400">·</span>
            <span>¡Vivamos juntos la posada del ajedrez!</span>
            <Sparkles size={14} className="text-amber-400" aria-hidden="true" />
          </div>

          <h1 className="font-festive text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-amber-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] uppercase leading-none mb-2">
            {config.titulo || 'TORNEO DEL PAVO 2.0'}
          </h1>

          <p className="font-round text-base sm:text-xl md:text-2xl text-emerald-200 max-w-3xl mx-auto font-medium">
            El gran encuentro amistoso y competitivo para jugadores de todas las edades en el emblemático Corredor Constitución de Durango.
          </p>
        </div>

        {/* Prize Callout Badges */}
        <div className="max-w-4xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-red-900/90 via-red-800 to-red-900 border-2 border-amber-400/80 rounded-2xl p-4 text-center shadow-xl flex items-center justify-center gap-3">
            <Gift size={28} className="text-yellow-300 shrink-0" aria-hidden="true" />
            <div className="text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 block">
                Bolsa Acumulada
              </span>
              <span className="font-festive text-2xl sm:text-3xl text-yellow-300 font-black block leading-none">
                MÁS DE $10,000
              </span>
              <span className="text-[11px] text-amber-100/90">
                En premios y tarjetas de regalo de patrocinadores
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-emerald-950 border-2 border-yellow-200 rounded-2xl p-4 text-center shadow-xl flex items-center justify-center gap-3">
            <Trophy size={32} className="text-emerald-950 shrink-0" aria-hidden="true" />
            <div className="text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 block">
                Gran Premio Absoluto
              </span>
              <span className="font-festive text-2xl sm:text-3xl text-emerald-950 font-black block leading-none">
                $2,500 EN EFECTIVO
              </span>
              <span className="text-[11px] font-bold text-emerald-900">
                Al 1.er Lugar del Torneo
              </span>
            </div>
          </div>
        </div>

        {/* Live Event Countdown Timer */}
        <EventCountdown
          targetIso={config.fechaIso || '2026-12-19T16:30:00-06:00'}
          fechaLabel={config.fecha}
          horaLabel={config.hora}
        />

        {/* Yellow Highlight Banner */}
        <div className="max-w-3xl mx-auto mb-10 transform -rotate-0.5 hover:rotate-0 transition-transform">
          <div className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 text-emerald-950 p-4 sm:p-5 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.4)] border-4 border-yellow-200 flex flex-col sm:flex-row items-center justify-around gap-4 text-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-900 text-amber-300 flex items-center justify-center shrink-0 shadow">
                <Calendar size={22} aria-hidden="true" />
              </div>
              <div className="text-left">
                <span className="block font-festive text-xs uppercase text-emerald-900 tracking-wider">
                  Fecha & Horario Oficial
                </span>
                <span className="font-festive text-lg sm:text-xl font-black text-emerald-950 block leading-tight">
                  {config.fecha}
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-800">{config.hora}</span>
              </div>
            </div>

            <div className="h-8 w-[2px] bg-emerald-900/20 hidden sm:block" />

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-900 text-amber-300 flex items-center justify-center shrink-0 shadow">
                <MapPin size={22} aria-hidden="true" />
              </div>
              <div className="text-left">
                <span className="block font-festive text-xs uppercase text-emerald-900 tracking-wider">
                  Sede Oficial
                </span>
                <span className="font-festive text-lg sm:text-xl font-black text-emerald-950 block leading-tight">
                  {config.lugar || 'Corredor Constitución'}
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-800">
                  {config.referencia || 'Placita Constitución (frente a Tatuajes Durango)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid: Poster Artwork + Quick Details & Registration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-6xl mx-auto">
          {/* Visual Poster Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group max-w-sm sm:max-w-md w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-amber-400 to-emerald-600 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse" />

              <div className="relative bg-[#0c3722] p-3 rounded-2xl border-2 border-amber-400/80 shadow-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPosterModal(true)}
                  aria-label="Ampliar cartel oficial del Torneo del Pavo 2.0"
                  className="relative block w-full rounded-xl overflow-hidden cursor-pointer text-left"
                >
                  <img
                    src="/img/cartel-2026.webp"
                    alt="Cartel Oficial Torneo del Pavo 2026 - Santa Claus jugando ajedrez con el pavo navideño en Durango"
                    width={800}
                    height={1111}
                    decoding="async"
                    fetchPriority="high"
                    className="w-full h-auto object-cover transform group-hover:scale-102 transition-transform duration-300"
                    loading="eager"
                  />
                  <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-sm backdrop-blur-xs">
                    <ZoomIn size={20} className="text-amber-300" aria-hidden="true" />
                    <span>Ampliar cartel oficial</span>
                  </span>
                </button>

                <div className="mt-3 flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-emerald-200">
                    Cartel Oficial · 2.ª Edición
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowConvocatoriaModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                  >
                    <FileText size={13} aria-hidden="true" />
                    <span>Ver Carta Convocatoria</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info & Action Center */}
          <div className="lg:col-span-7 space-y-6">
            {/* Coherent Single Status & Capacity Counter */}
            <div className="bg-[#0c3420]/90 backdrop-blur-md p-6 rounded-2xl border border-emerald-600/40 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Users className="text-amber-400" size={20} aria-hidden="true" />
                  <span className="font-festive text-amber-300 text-lg">
                    Estado de Inscripción y Cupo
                  </span>
                </div>
                <span
                  data-testid="hero-registration-status"
                  className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full border ${statusBadge.tone}`}
                >
                  {statusBadge.label}
                </span>
              </div>

              {/* Progress bar */}
              <div
                role="progressbar"
                aria-label="Ocupación del torneo"
                aria-valuemin={0}
                aria-valuemax={config.cupoMaximo}
                aria-valuenow={isCountLoading ? 0 : totalRegistered}
                className="w-full bg-emerald-950 rounded-full h-4 p-0.5 border border-emerald-700/60 overflow-hidden mb-2"
              >
                <div
                  className="bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 h-full rounded-full transition-all duration-700 shadow-inner"
                  style={{ width: `${isCountLoading ? 8 : percentFilled}%` }}
                />
              </div>

              <div className="flex justify-between text-xs text-emerald-200 font-medium">
                <span>
                  {isCountLoading
                    ? 'Sincronizando registros...'
                    : `${totalRegistered} participantes registrados`}
                </span>
                <span>Cupo máximo: {config.cupoMaximo}</span>
              </div>
            </div>

            {/* Recovery Fee & Value Props */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0b2f1d] p-4 rounded-xl border border-emerald-700/50">
                <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider block">
                  Inscripción Oficial
                </span>
                <span className="font-festive text-2xl sm:text-3xl text-amber-300 font-black block mt-1">
                  ${config.costo}{' '}
                  <span className="text-sm text-emerald-200 font-normal">MXN</span>
                </span>
                <span className="text-xs text-emerald-300/80 block mt-0.5">
                  Cuota de recuperación
                </span>
              </div>

              <div className="bg-[#0b2f1d] p-4 rounded-xl border border-emerald-700/50">
                <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider block">
                  Ritmo de Juego
                </span>
                <span className="font-festive text-xl sm:text-2xl text-yellow-300 font-black block mt-1">
                  10 min + 3 s
                </span>
                <span className="text-xs text-emerald-300/80 block mt-0.5">
                  Suizo a 5 rondas · Rápido
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a
                href="#registro"
                className="flex-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-emerald-950 font-black font-festive text-center py-4 px-6 rounded-2xl text-lg sm:text-xl shadow-[0_6px_20px_rgba(250,204,21,0.35)] hover:shadow-[0_8px_25px_rgba(250,204,21,0.5)] transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group"
              >
                <span>{isWaitlist ? 'Lista de Espera' : '¡Inscríbete Ahora!'}</span>
                <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">
                  🦃
                </span>
              </a>

              {onViewParticipants && (
                <button
                  type="button"
                  onClick={onViewParticipants}
                  className="bg-emerald-950/90 hover:bg-emerald-900 text-amber-300 font-bold py-4 px-6 rounded-2xl text-base border-2 border-amber-400/70 shadow-lg text-center flex items-center justify-center gap-2 transition-all hover:scale-102 cursor-pointer"
                >
                  <Users size={18} className="text-yellow-300" aria-hidden="true" />
                  <span>Ver Participantes</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConvocatoriaModal(true)}
                className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 font-bold py-4 px-5 rounded-2xl text-base border border-emerald-600/60 shadow-lg text-center flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <FileText size={18} className="text-amber-400" aria-hidden="true" />
                <span>Bases Oficiales</span>
              </button>
            </div>

            <p className="text-xs text-center sm:text-left text-emerald-300/90 flex items-center justify-center sm:justify-start gap-1.5">
              <Clock size={14} className="text-amber-400 shrink-0" aria-hidden="true" />
              <span>Cierre de inscripciones al alcanzar cupo o el {config.fechaLimite}</span>
            </p>
          </div>
        </div>

        {/* Scroll down prompt */}
        <div className="flex justify-center mt-12">
          <a
            href="#info"
            className="text-emerald-300 hover:text-amber-300 flex flex-col items-center gap-1 text-xs font-semibold animate-bounce"
          >
            <span>Ver bases completas, categorías y patrocinadores</span>
            <ChevronDown size={20} aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Poster Zoom Modal */}
      {showPosterModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cartel oficial ampliado"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar cartel ampliado"
            onClick={() => setShowPosterModal(false)}
            className="fixed inset-0 bg-transparent cursor-default"
          />
          <div
            ref={posterModalRef}
            tabIndex={-1}
            className="relative z-10 max-w-xl w-full max-h-[92vh] overflow-y-auto bg-emerald-950 p-2 rounded-2xl border-2 border-amber-400 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowPosterModal(false)}
              aria-label="Cerrar cartel ampliado"
              className="absolute top-4 right-4 z-10 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg cursor-pointer"
            >
              <X size={20} />
            </button>
            <img
              src="/img/cartel-2026.webp"
              alt="Cartel Oficial del Torneo del Pavo 2.0 en Durango"
              width={800}
              height={1111}
              decoding="async"
              className="w-full h-auto rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Official Convocatoria Document Modal */}
      {showConvocatoriaModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="convocatoria-modal-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar carta convocatoria"
            onClick={() => setShowConvocatoriaModal(false)}
            className="fixed inset-0 bg-transparent cursor-default"
          />
          <div
            ref={convocatoriaModalRef}
            tabIndex={-1}
            className="relative z-10 max-w-3xl w-full max-h-[94vh] overflow-y-auto bg-emerald-950 p-3 sm:p-4 rounded-2xl border-2 border-amber-400 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-emerald-800">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-amber-400" aria-hidden="true" />
                <h3
                  id="convocatoria-modal-title"
                  className="font-festive text-lg sm:text-xl text-yellow-300"
                >
                  Carta Convocatoria Oficial · Torneo del Pavo 2026 (2.ª Edición)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConvocatoriaModal(false)}
                aria-label="Cerrar carta convocatoria"
                className="bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-white rounded-xl overflow-hidden shadow-inner">
              <img
                src="/img/convocatoria.webp"
                alt="Convocatoria Oficial Carta Torneo del Pavo 2026"
                width={1080}
                height={1398}
                loading="lazy"
                decoding="async"
                className="w-full h-auto"
              />
            </div>

            <div className="mt-3 text-center">
              <a
                href="/img/convocatoria.webp"
                download="Convocatoria_Torneo_del_Pavo_2026.webp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold px-4 py-2 rounded-xl text-xs shadow"
              >
                <span>Descargar Convocatoria en Imagen</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
