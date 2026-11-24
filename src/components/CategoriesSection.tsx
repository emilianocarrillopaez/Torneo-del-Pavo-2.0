import React, { useState } from 'react';
import { TournamentCategory, TournamentConfig } from '../types/tournament';
import {
  deriveAgeCutoffs,
  extractEventDateParts,
  getDynamicCategoryDetails,
} from '../utils/tournamentUtils';
import { CheckCircle2, Award, HelpCircle, ArrowRight, Star } from 'lucide-react';

interface CategoriesSectionProps {
  config: TournamentConfig;
  onSelectCategory: (category: TournamentCategory) => void;
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  config,
  onSelectCategory,
}) => {
  const [testYear, setTestYear] = useState<string>('');
  const [hasRating, setHasRating] = useState<boolean | null>(null);
  const [recommendation, setRecommendation] = useState<{
    category: TournamentCategory;
    reason: string;
  } | null>(null);

  const eventParts = extractEventDateParts(config.fechaIso);
  const cutoffs = deriveAgeCutoffs(config.fechaIso);
  const dynamicDetails = getDynamicCategoryDetails(config.fechaIso);

  const calculateRecommendation = () => {
    const year = parseInt(testYear, 10);
    if (Number.isNaN(year) || year < 1920 || year > eventParts.year) {
      setRecommendation(null);
      return;
    }

    const approximateAge = eventParts.year - year;

    if (approximateAge <= 18) {
      setRecommendation({
        category: 'Juvenil',
        reason: `Con aproximadamente ${approximateAge} años calificas directamente para la categoría Juvenil (18 años o menos al ${cutoffs.eventDateSpanish}).`,
      });
    } else {
      setRecommendation({
        category: 'Libre',
        reason: hasRating
          ? `Al ser mayor de 18 años y contar con experiencia/rating, compites en la categoría Libre por los $2,500 en efectivo del 1.er lugar y el podio general.`
          : `Al ser aficionado, compites en la categoría Libre y además calificas para el premio especial a Mejor Aficionado.`,
      });
    }
  };

  const handleApplyCategory = (cat: TournamentCategory) => {
    onSelectCategory(cat);
    const formElement = document.querySelector('#registro');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="categorias" className="py-16 bg-[#0a2e1d] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-amber-400 font-festive text-sm uppercase tracking-widest block mb-1">
            Bases Oficiales {eventParts.year}
          </span>
          <h2 className="font-festive text-3xl sm:text-4xl md:text-5xl text-yellow-300 drop-shadow">
            CATEGORÍAS DE COMPETENCIA
          </h2>
          <div className="w-24 h-1 bg-amber-400 mx-auto mt-3 rounded-full" />
          <p className="mt-3 text-emerald-200 text-sm sm:text-base font-round">
            Encuentro amistoso y competitivo para jugadores de todas las edades y niveles.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
          {/* Card 1: Juvenil */}
          <div className="bg-[#0e3b26] rounded-3xl p-6 sm:p-8 border-2 border-emerald-600/40 hover:border-amber-400/80 transition-all duration-300 shadow-xl flex flex-col justify-between group hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl" aria-hidden="true">
                  ♞
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full border bg-emerald-600/30 text-emerald-300 border-emerald-500/40">
                  18 años o menos
                </span>
              </div>

              <h3 className="font-festive text-2xl sm:text-3xl text-white group-hover:text-amber-300 transition-colors mb-2">
                {dynamicDetails.Juvenil.title}
              </h3>

              <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed mb-5">
                {dynamicDetails.Juvenil.description}
              </p>

              <div className="bg-emerald-950/70 p-4 rounded-2xl border border-emerald-800 text-xs text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <span aria-hidden="true">♟️</span>
                  <span>Requisito Oficial:</span>
                </div>
                <p className="text-emerald-200 pl-5">
                  Tener {dynamicDetails.Juvenil.ageRequirement}
                </p>
                <div className="pt-1 text-[11px] text-amber-300 font-semibold pl-5">
                  • Premiación a los primeros 3 lugares
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() => handleApplyCategory('Juvenil')}
                className="w-full bg-emerald-800/90 hover:bg-amber-400 hover:text-emerald-950 text-emerald-100 font-bold py-3 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <span>Inscribirme en Juvenil</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Card 2: Libre */}
          <div className="bg-[#0e3b26] rounded-3xl p-6 sm:p-8 border-2 border-amber-500/50 hover:border-amber-400 transition-all duration-300 shadow-xl flex flex-col justify-between group hover:-translate-y-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-yellow-500 text-emerald-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow">
              Categoría Principal
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl" aria-hidden="true">
                  ♚
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full border bg-amber-400/20 text-yellow-300 border-amber-400/40">
                  Ranqueados & Aficionados
                </span>
              </div>

              <h3 className="font-festive text-2xl sm:text-3xl text-yellow-300 group-hover:text-amber-200 transition-colors mb-2">
                Categoría Libre
              </h3>

              <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed mb-5">
                {dynamicDetails.Libre.description}
              </p>

              <div className="bg-emerald-950/70 p-4 rounded-2xl border border-emerald-800 text-xs text-emerald-300 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold">
                  <span aria-hidden="true">🏆</span>
                  <span>Premios y Reconocimientos:</span>
                </div>
                <ul className="text-emerald-200 pl-5 space-y-1">
                  <li>
                    • <strong className="text-yellow-300">$2,500 MXN en efectivo</strong>{' '}
                    garantizados para el 1.er Lugar.
                  </li>
                  <li>• Premiación a los primeros 3 lugares de la categoría.</li>
                  <li>
                    • Premio especial a la{' '}
                    <strong className="text-pink-300">Mejor Femenil</strong>.
                  </li>
                  <li>
                    • Premio especial al{' '}
                    <strong className="text-amber-300">Mejor Aficionado</strong> (sin rating oficial).
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                onClick={() => handleApplyCategory('Libre')}
                className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-emerald-950 font-black py-3 px-4 rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <span>Inscribirme en Categoría Libre</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Special Recognitions Banner */}
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-emerald-950 via-[#0e3c25] to-emerald-950 border border-amber-400/40 rounded-2xl p-4 sm:p-5 text-center mb-10 shadow-lg flex flex-col sm:flex-row items-center justify-around gap-3">
          <div className="flex items-center gap-2">
            <Star className="text-amber-400" size={18} aria-hidden="true" />
            <span className="text-xs sm:text-sm font-bold text-yellow-300">
              Premio Especial Mejor Femenil (Categoría Libre)
            </span>
          </div>
          <div className="hidden sm:block w-[1px] h-6 bg-emerald-700" />
          <div className="flex items-center gap-2">
            <Award className="text-amber-400" size={18} aria-hidden="true" />
            <span className="text-xs sm:text-sm font-bold text-yellow-300">
              Premio Especial Mejor Aficionado (Categoría Libre)
            </span>
          </div>
        </div>

        {/* Interactive Category Helper */}
        <div className="bg-[#082316] rounded-2xl p-6 sm:p-8 border border-emerald-700/60 max-w-3xl mx-auto shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
              <HelpCircle size={20} aria-hidden="true" />
            </div>
            <div>
              <h4 className="font-festive text-xl text-yellow-300">
                ¿Tienes dudas sobre qué categoría elegir?
              </h4>
              <p className="text-xs text-emerald-300">
                Ingresa tu año de nacimiento y te indicamos tu categoría reglamentaria al{' '}
                {cutoffs.eventDateSpanish}:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-5">
              <label
                htmlFor="category-helper-year"
                className="text-xs text-emerald-200 block mb-1 font-medium"
              >
                Año de nacimiento:
              </label>
              <input
                id="category-helper-year"
                type="number"
                inputMode="numeric"
                placeholder="Ej. 2010"
                min={1920}
                max={eventParts.year}
                value={testYear}
                onChange={(e) => setTestYear(e.target.value)}
                className="w-full bg-emerald-950 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-4">
              <span className="text-xs text-emerald-200 block mb-1 font-medium">
                ¿Tienes rating FIDE/FENAMAC?
              </span>
              <div className="flex gap-2" role="group" aria-label="¿Tienes rating FIDE/FENAMAC?">
                <button
                  type="button"
                  onClick={() => setHasRating(false)}
                  aria-pressed={hasRating === false}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    hasRating === false
                      ? 'bg-amber-400 text-emerald-950 border-amber-400'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:border-emerald-500'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setHasRating(true)}
                  aria-pressed={hasRating === true}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    hasRating === true
                      ? 'bg-amber-400 text-emerald-950 border-amber-400'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:border-emerald-500'
                  }`}
                >
                  Sí
                </button>
              </div>
            </div>

            <div className="sm:col-span-3 sm:pt-5">
              <button
                type="button"
                onClick={calculateRecommendation}
                disabled={!testYear}
                className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-emerald-950 font-black py-2.5 px-3 rounded-xl text-xs sm:text-sm shadow transition-colors cursor-pointer"
              >
                Verificar
              </button>
            </div>
          </div>

          {recommendation && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 p-4 rounded-xl bg-emerald-900/60 border border-amber-400/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn"
            >
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-amber-400" aria-hidden="true" />
                  <span className="font-festive text-base text-yellow-300">
                    Tu categoría: <span className="underline">{recommendation.category}</span>
                  </span>
                </div>
                <p className="text-xs text-emerald-200 mt-1">{recommendation.reason}</p>
              </div>

              <button
                type="button"
                onClick={() => handleApplyCategory(recommendation.category)}
                className="shrink-0 bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-bold px-4 py-2 rounded-xl text-xs shadow cursor-pointer"
              >
                Inscribirme en {recommendation.category}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
