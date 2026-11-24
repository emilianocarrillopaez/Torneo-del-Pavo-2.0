import React from 'react';
import { Award, Star, Trophy, Sparkles, DollarSign, CheckCircle2 } from 'lucide-react';
import { TournamentConfig } from '../types/tournament';

interface PrizesSectionProps {
  config: TournamentConfig;
}

export const PrizesSection: React.FC<PrizesSectionProps> = ({ config: _config }) => {
  return (
    <section id="premiacion" className="py-16 bg-[#0a2e1d] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-amber-400 font-festive text-sm uppercase tracking-widest block mb-1">
            Bolsa de Premios Oficial
          </span>
          <h2 className="font-festive text-3xl sm:text-4xl md:text-5xl text-yellow-300 drop-shadow">
            PREMIACIÓN & SORPRESAS
          </h2>
          <div className="w-24 h-1 bg-amber-400 mx-auto mt-3 rounded-full" />
          <p className="mt-3 text-emerald-200 text-sm sm:text-base font-round">
            ¡Más de $10,000 MXN en premios, $2,500 en efectivo al campeón, pavos navideños y tarjetas de regalo de patrocinadores!
          </p>
        </div>

        {/* Highlighted Banner */}
        <div className="bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 rounded-3xl p-6 sm:p-10 text-emerald-950 shadow-2xl border-4 border-yellow-200 mb-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 bg-emerald-950 text-amber-300 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} />
                <span>Edición Vísperas Navideñas 2026</span>
              </div>

              <h3 className="font-festive text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-950 leading-tight">
                ¡MÁS DE $10,000 EN PREMIOS!
              </h3>

              <div className="space-y-2 text-emerald-950 font-medium text-xs sm:text-sm sm:leading-relaxed bg-amber-300/60 p-4 rounded-2xl border border-amber-600/30">
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-950 shrink-0 mt-0.5" />
                  <span><strong>$2,500.00 MXN en efectivo</strong> garantizados para el 1.er lugar del torneo.</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-950 shrink-0 mt-0.5" />
                  <span>Se premiará a los <strong>primeros 3 lugares</strong> de cada categoría (podio con trofeos y reconocimientos).</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-950 shrink-0 mt-0.5" />
                  <span>Premio especial a la <strong>Mejor Femenil</strong> de la categoría Libre.</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-950 shrink-0 mt-0.5" />
                  <span>Premio especial al <strong>Mejor Aficionado</strong> de la categoría Libre.</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-950 shrink-0 mt-0.5" />
                  <span>Tarjetas de regalo, cortesías y sorpresas de los comercios y patrocinadores de Durango.</span>
                </p>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center justify-center p-6 bg-emerald-950 rounded-3xl border-2 border-emerald-800 text-amber-300 shadow-2xl w-full sm:w-72 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-400/20 text-yellow-300 flex items-center justify-center mb-2 border border-amber-400/40">
                <DollarSign size={36} />
              </div>
              <span className="font-festive text-3xl text-yellow-300 font-bold">$2,500</span>
              <span className="text-xs uppercase font-bold text-amber-200 tracking-wider">En Efectivo</span>
              <span className="text-[11px] text-emerald-200 mt-2 bg-emerald-900/80 px-3 py-1 rounded-full border border-emerald-700">
                1.er Lugar Absoluto
              </span>
            </div>
          </div>
        </div>

        {/* Prize Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0c3924] p-6 rounded-2xl border border-emerald-700/60 shadow-xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center mb-4">
              <Trophy size={28} />
            </div>
            <h4 className="font-festive text-xl text-yellow-300 mb-2">Primeros 3 Lugares</h4>
            <p className="text-xs sm:text-sm text-emerald-200 leading-relaxed">
              Premiación oficial a los tres mejores clasificados de cada categoría (Juvenil y Libre).
            </p>
          </div>

          <div className="bg-[#0c3924] p-6 rounded-2xl border border-emerald-700/60 shadow-xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center mb-4">
              <Star size={28} />
            </div>
            <h4 className="font-festive text-xl text-pink-300 mb-2">Mejor Femenil</h4>
            <p className="text-xs sm:text-sm text-emerald-200 leading-relaxed">
              Premio y reconocimiento especial a la jugadora mejor ubicada en la categoría Libre para impulsar el ajedrez femenil en Durango.
            </p>
          </div>

          <div className="bg-[#0c3924] p-6 rounded-2xl border border-emerald-700/60 shadow-xl text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-emerald-400/20 text-emerald-300 flex items-center justify-center mb-4">
              <Award size={28} />
            </div>
            <h4 className="font-festive text-xl text-yellow-300 mb-2">Mejor Aficionado</h4>
            <p className="text-xs sm:text-sm text-emerald-200 leading-relaxed">
              Premio especial exclusivo para los jugadores sin Elo FIDE oficial que destaquen en la categoría Libre.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
