import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sponsor } from '../types/tournament';
import { safeHttpUrl } from '../utils/tournamentUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Handshake,
  FileText,
  X,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react';

interface SponsorsCarouselProps {
  sponsors: Sponsor[];
}

const AUTOPLAY_MS = 4200;

function buildFallbackLogo(nombre: string): string {
  const words = nombre.trim().split(/\s+/);
  const initials =
    words.length >= 2
      ? `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
      : nombre.slice(0, 2).toUpperCase();
  const safeName = nombre.slice(0, 26).toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeInitials = initials.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="260" viewBox="0 0 440 260">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="100%" stop-color="#022c22"/>
      </linearGradient>
    </defs>
    <rect width="440" height="260" rx="22" fill="url(#bg)"/>
    <rect x="14" y="14" width="412" height="232" rx="16" fill="none" stroke="#facc15" stroke-opacity="0.5" stroke-width="2"/>
    <circle cx="220" cy="102" r="50" fill="#facc15" fill-opacity="0.16" stroke="#facc15" stroke-width="2.5"/>
    <text x="220" y="118" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="40" fill="#fde047">${safeInitials}</text>
    <text x="220" y="190" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="16" letter-spacing="1.4" fill="#ffffff">${safeName}</text>
    <text x="220" y="218" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="600" font-size="11" letter-spacing="2" fill="#facc15">PATROCINADOR OFICIAL</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 180 : -180,
    opacity: 0,
    scale: 0.82,
    rotateY: direction >= 0 ? -18 : 18,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    rotateY: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 230,
      damping: 24,
      mass: 0.9,
    },
  },
  exit: (direction: number) => ({
    x: direction >= 0 ? -180 : 180,
    opacity: 0,
    scale: 0.82,
    rotateY: direction >= 0 ? 18 : -18,
    transition: {
      duration: 0.34,
      ease: 'easeInOut' as const,
    },
  }),
};

export const SponsorsCarousel: React.FC<SponsorsCarouselProps> = ({ sponsors }) => {
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const [shuffleSeed] = useState(() => Math.floor(Math.random() * 100_000) + 1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [showOfficialBanner, setShowOfficialBanner] = useState(false);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const bannerModalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(bannerModalRef, () => setShowOfficialBanner(false), showOfficialBanner);

  // Filtrar activos y respetar orden explícito si existe; aleatorio determinista por sesión entre empates
  const orderedSponsors = useMemo(() => {
    const activeList = sponsors.filter((s) => s.activo !== false);
    const hasCustomOrder = activeList.some((s) => typeof s.orden === 'number');
    if (hasCustomOrder) {
      return [...activeList].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
    }
    const arr = [...activeList];
    let s = shuffleSeed;
    for (let i = arr.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [sponsors, shuffleSeed]);

  const total = orderedSponsors.length;
  const safeActiveIndex = total > 0 ? activeIndex % total : 0;
  const isPaused = isHovered || isManuallyPaused || prefersReducedMotion;

  const paginate = useCallback(
    (delta: number) => {
      if (total <= 1) return;
      setDirection(delta >= 0 ? 1 : -1);
      setActiveIndex((prev) => (prev + delta + total) % total);
    },
    [total]
  );

  const goToIndex = useCallback(
    (targetIdx: number) => {
      if (targetIdx === safeActiveIndex || total <= 1) return;
      setDirection(targetIdx > safeActiveIndex ? 1 : -1);
      setActiveIndex(targetIdx);
    },
    [safeActiveIndex, total]
  );

  useEffect(() => {
    if (isPaused || total <= 1) return;
    const timer = window.setInterval(() => {
      paginate(1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, total, paginate]);

  const getLogoSrc = useCallback(
    (sponsor: Sponsor, key: string) => {
      const logo = (sponsor.logo || '').trim();
      const isAllowedLogo =
        Boolean(safeHttpUrl(logo)) ||
        /^data:image\/(jpeg|png|webp|svg\+xml)(;base64,|;charset=UTF-8,)/i.test(logo);
      if (!logo || !isAllowedLogo || failedLogos[key]) {
        return buildFallbackLogo(sponsor.nombre);
      }
      return logo;
    },
    [failedLogos]
  );

  const handleLogoError = useCallback((key: string) => {
    setFailedLogos((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const { prevSponsor, currentSponsor, nextSponsor, prevKey, currentKey, nextKey } = useMemo(() => {
    if (total === 0) {
      return {
        prevSponsor: null,
        currentSponsor: null,
        nextSponsor: null,
        prevKey: '',
        currentKey: '',
        nextKey: '',
      };
    }
    const prevIdx = (safeActiveIndex - 1 + total) % total;
    const nextIdx = (safeActiveIndex + 1) % total;
    const prev = orderedSponsors[prevIdx];
    const curr = orderedSponsors[safeActiveIndex] || orderedSponsors[0];
    const next = orderedSponsors[nextIdx];
    return {
      prevSponsor: total > 1 ? prev : null,
      currentSponsor: curr,
      nextSponsor: total > 1 ? next : null,
      prevKey: prev.id || `${prev.nombre}-${prevIdx}`,
      currentKey: curr.id || `${curr.nombre}-${safeActiveIndex}`,
      nextKey: next.id || `${next.nombre}-${nextIdx}`,
    };
  }, [orderedSponsors, safeActiveIndex, total]);

  return (
    <section
      id="patrocinadores"
      data-testid="sponsors-carousel"
      className="py-20 bg-gradient-to-b from-[#082617] via-[#0c3823] to-[#082617] relative border-t border-emerald-700/70 overflow-hidden"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[780px] h-[420px] bg-amber-400/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300 bg-emerald-950/90 px-4 py-1.5 rounded-full border border-amber-400/40 mb-3 shadow">
            <Handshake size={15} className="text-amber-400" aria-hidden="true" />
            <span>
              {total === 0
                ? 'Aliados del Torneo'
                : total === 1
                ? 'Agradecimiento Especial · 1 Patrocinador Oficial'
                : `Agradecimiento Especial · ${total} Patrocinadores`}
            </span>
          </div>
          <h2 className="font-festive text-3xl sm:text-5xl text-yellow-300 drop-shadow-[0_3px_10px_rgba(0,0,0,0.6)]">
            PATROCINADORES OFICIALES
          </h2>
          <p className="mt-2 text-emerald-200 text-sm sm:text-base">
            Gracias al respaldo del comercio local y los amigos del ajedrez en Durango que hacen posible más de $10,000 en premios.
          </p>
        </div>

        {/* Estado vacío (0 patrocinadores) */}
        {total === 0 || !currentSponsor ? (
          <div className="max-w-xl mx-auto bg-[#0b3320] border border-emerald-700/70 rounded-3xl p-8 text-center space-y-3 shadow-xl mb-8">
            <Handshake size={36} className="text-amber-400 mx-auto" aria-hidden="true" />
            <h3 className="font-festive text-xl text-yellow-300">
              Aliados Comerciales en Actualización
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200">
              Muy pronto publicaremos aquí la galería interactiva de patrocinadores del Torneo del Pavo 2.0.
            </p>
          </div>
        ) : (
          <div
            className="relative max-w-6xl mx-auto mb-8"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setIsHovered(false)}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
          >
            <div
              className="relative grid grid-cols-1 lg:grid-cols-12 items-center gap-5 min-h-[370px] sm:min-h-[430px]"
              style={{ perspective: '1200px' }}
            >
              {/* Left Flanking Preview Card */}
              <div className="hidden lg:flex lg:col-span-3 justify-end">
                {prevSponsor && total > 1 && (
                  <motion.button
                    type="button"
                    key={`prev-${prevKey}`}
                    onClick={() => paginate(-1)}
                    whileHover={prefersReducedMotion ? undefined : { scale: 0.92, opacity: 0.95 }}
                    className="w-full max-w-[240px] bg-[#0a301e]/90 border border-emerald-700/70 hover:border-amber-400/70 rounded-3xl p-4 text-center shadow-xl opacity-65 transition-all cursor-pointer transform -rotate-y-6"
                    aria-label={`Ver patrocinador anterior: ${prevSponsor.nombre}`}
                  >
                    <div className="w-full h-36 rounded-2xl bg-black/45 border border-emerald-800/80 overflow-hidden flex items-center justify-center p-2 mb-3">
                      <img
                        src={getLogoSrc(prevSponsor, prevKey)}
                        alt={`Logo de ${prevSponsor.nombre}`}
                        width={220}
                        height={144}
                        loading="lazy"
                        decoding="async"
                        onError={() => handleLogoError(prevKey)}
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                    </div>
                    <p className="font-festive text-sm text-emerald-100 truncate">
                      {prevSponsor.nombre}
                    </p>
                  </motion.button>
                )}
              </div>

              {/* Center Spotlight Card */}
              <div className="lg:col-span-6 relative flex items-center justify-center">
                {total > 1 && (
                  <button
                    type="button"
                    onClick={() => paginate(-1)}
                    data-testid="carousel-prev"
                    className="absolute -left-2 sm:-left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-emerald-950/95 hover:bg-amber-400 text-amber-300 hover:text-emerald-950 border-2 border-amber-400/70 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all hover:scale-105 cursor-pointer"
                    aria-label="Patrocinador anterior"
                  >
                    <ChevronLeft size={26} />
                  </button>
                )}

                <div className="w-full max-w-xl overflow-visible px-4 sm:px-6">
                  <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                      key={currentKey}
                      custom={direction}
                      variants={prefersReducedMotion ? undefined : slideVariants}
                      initial={prefersReducedMotion ? undefined : 'enter'}
                      animate={prefersReducedMotion ? undefined : 'center'}
                      exit={prefersReducedMotion ? undefined : 'exit'}
                      data-testid="active-sponsor-card"
                      className="relative bg-gradient-to-b from-[#0f452b] via-[#0c3722] to-[#082717] rounded-3xl p-5 sm:p-7 border-2 border-amber-400/90 shadow-[0_22px_60px_rgba(0,0,0,0.65)] overflow-hidden"
                    >
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-amber-300 to-red-500" />

                      <div className="flex items-center justify-between mb-4">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/15 px-3 py-1 rounded-full border border-amber-400/35">
                          <Sparkles size={12} aria-hidden="true" />
                          <span>
                            {currentSponsor.categoriaSponsor || 'Patrocinador Oficial'}
                          </span>
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-300">
                          {String(safeActiveIndex + 1).padStart(2, '0')} /{' '}
                          {String(total).padStart(2, '0')}
                        </span>
                      </div>

                      <div className="w-full h-52 sm:h-64 rounded-2xl bg-gradient-to-br from-black/50 via-emerald-950/70 to-black/50 border border-emerald-700/80 flex items-center justify-center overflow-hidden p-4 mb-5 shadow-inner">
                        <img
                          src={getLogoSrc(currentSponsor, currentKey)}
                          alt={`Logotipo oficial de ${currentSponsor.nombre}`}
                          width={440}
                          height={260}
                          loading="lazy"
                          decoding="async"
                          onError={() => handleLogoError(currentKey)}
                          className="max-h-full max-w-full object-contain rounded-xl drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
                        />
                      </div>

                      <div className="text-center space-y-2.5">
                        <h3 className="font-festive text-2xl sm:text-3xl text-yellow-300 drop-shadow leading-tight">
                          {currentSponsor.nombre}
                        </h3>

                        {(() => {
                          const safeHref = safeHttpUrl(currentSponsor.enlace, { allowHash: true });
                          return safeHref && safeHref !== '#' ? (
                            <a
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg transition-transform hover:scale-105"
                            >
                              <span>Visitar Patrocinador</span>
                              <ExternalLink size={15} aria-hidden="true" />
                            </a>
                          ) : (
                            <p className="text-xs sm:text-sm text-emerald-200 font-medium">
                              Orgulloso aliado del Torneo del Pavo 2.0 · Durango, Dgo.
                            </p>
                          );
                        })()}
                      </div>

                      {total > 1 && (
                        <div className="mt-5 h-1.5 w-full bg-emerald-950 rounded-full overflow-hidden border border-emerald-800/80">
                          {!isPaused ? (
                            <motion.div
                              key={`progress-${safeActiveIndex}`}
                              initial={{ width: '0%' }}
                              animate={{ width: '100%' }}
                              transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
                              className="h-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400"
                            />
                          ) : (
                            <div className="h-full w-1/3 bg-amber-400/50" />
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {total > 1 && (
                  <button
                    type="button"
                    onClick={() => paginate(1)}
                    data-testid="carousel-next"
                    className="absolute -right-2 sm:-right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-emerald-950/95 hover:bg-amber-400 text-amber-300 hover:text-emerald-950 border-2 border-amber-400/70 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-all hover:scale-105 cursor-pointer"
                    aria-label="Siguiente patrocinador"
                  >
                    <ChevronRight size={26} />
                  </button>
                )}
              </div>

              {/* Right Flanking Preview Card */}
              <div className="hidden lg:flex lg:col-span-3 justify-start">
                {nextSponsor && total > 1 && (
                  <motion.button
                    type="button"
                    key={`next-${nextKey}`}
                    onClick={() => paginate(1)}
                    whileHover={prefersReducedMotion ? undefined : { scale: 0.92, opacity: 0.95 }}
                    className="w-full max-w-[240px] bg-[#0a301e]/90 border border-emerald-700/70 hover:border-amber-400/70 rounded-3xl p-4 text-center shadow-xl opacity-65 transition-all cursor-pointer transform rotate-y-6"
                    aria-label={`Ver siguiente patrocinador: ${nextSponsor.nombre}`}
                  >
                    <div className="w-full h-36 rounded-2xl bg-black/45 border border-emerald-800/80 overflow-hidden flex items-center justify-center p-2 mb-3">
                      <img
                        src={getLogoSrc(nextSponsor, nextKey)}
                        alt={`Logo de ${nextSponsor.nombre}`}
                        width={220}
                        height={144}
                        loading="lazy"
                        decoding="async"
                        onError={() => handleLogoError(nextKey)}
                        className="max-h-full max-w-full object-contain rounded-lg"
                      />
                    </div>
                    <p className="font-festive text-sm text-emerald-100 truncate">
                      {nextSponsor.nombre}
                    </p>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Thumbnail Strip (solo cuando hay > 1) */}
            {total > 1 && (
              <div className="mt-8 max-w-5xl mx-auto flex items-center justify-start gap-2.5 overflow-x-auto pb-2 px-2">
                {orderedSponsors.map((sp, idx) => {
                  const key = sp.id || `${sp.nombre}-${idx}`;
                  const isActive = idx === safeActiveIndex;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => goToIndex(idx)}
                      aria-label={`Mostrar patrocinador ${sp.nombre}`}
                      aria-current={isActive ? 'true' : undefined}
                      title={sp.nombre}
                      className={`shrink-0 h-14 w-20 sm:h-16 sm:w-24 rounded-xl overflow-hidden border-2 p-1 transition-all cursor-pointer ${
                        isActive
                          ? 'border-amber-400 bg-amber-400/15 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.45)]'
                          : 'border-emerald-800 bg-emerald-950/80 opacity-60 hover:opacity-100 hover:border-emerald-500'
                      }`}
                    >
                      <img
                        src={getLogoSrc(sp, key)}
                        alt={sp.nombre}
                        width={96}
                        height={64}
                        onError={() => handleLogoError(key)}
                        className="w-full h-full object-contain rounded-md"
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Playback Controls + Official Convocatoria Button */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {total > 1 && !prefersReducedMotion && (
            <button
              type="button"
              onClick={() => setIsManuallyPaused((p) => !p)}
              aria-pressed={isManuallyPaused}
              className="inline-flex items-center gap-1.5 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {isManuallyPaused ? (
                <Play size={14} className="text-amber-400" aria-hidden="true" />
              ) : (
                <Pause size={14} className="text-amber-400" aria-hidden="true" />
              )}
              <span>{isManuallyPaused ? 'Reanudar carrusel' : 'Pausar carrusel'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowOfficialBanner(true)}
            className="inline-flex items-center gap-2 bg-emerald-900/70 hover:bg-emerald-800 text-amber-300 border border-amber-400/40 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow transition-colors cursor-pointer"
          >
            <FileText size={16} aria-hidden="true" />
            <span>Ver Carta Convocatoria con todos los logos oficiales</span>
          </button>
        </div>

        {total > 1 && (
          <p className="text-center text-[11px] text-emerald-400/80 mt-3">
            {isPaused
              ? 'Carrusel en pausa · Usa las flechas o miniaturas para navegar'
              : 'Pasa el cursor o enfoca la tarjeta para pausar el carrusel'}
          </p>
        )}
      </div>

      {/* Official Banner Modal */}
      {showOfficialBanner && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sponsors-banner-modal-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar convocatoria con logos de patrocinadores"
            onClick={() => setShowOfficialBanner(false)}
            className="fixed inset-0 bg-transparent cursor-default"
          />
          <div
            ref={bannerModalRef}
            tabIndex={-1}
            className="relative z-10 max-w-3xl w-full max-h-[94vh] overflow-y-auto bg-emerald-950 p-4 rounded-2xl border-2 border-amber-400 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-emerald-800">
              <h3 id="sponsors-banner-modal-title" className="font-festive text-lg text-yellow-300">
                Patrocinadores Oficiales · Convocatoria 2.ª Edición
              </h3>
              <button
                type="button"
                onClick={() => setShowOfficialBanner(false)}
                aria-label="Cerrar convocatoria con logos de patrocinadores"
                className="bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-white rounded-xl overflow-hidden p-2">
              <img
                src="/assets/convocatoria.webp"
                alt="Convocatoria Oficial y Patrocinadores Torneo del Pavo 2026"
                width={1080}
                height={1398}
                loading="lazy"
                decoding="async"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
