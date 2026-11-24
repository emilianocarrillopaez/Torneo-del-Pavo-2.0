import React from 'react';
import { FileText, Camera, Clock, AlertCircle } from 'lucide-react';
import { TournamentConfig } from '../types/tournament';

interface TransitoriosProps {
  config: TournamentConfig;
}

export const TransitoriosSection: React.FC<TransitoriosProps> = ({ config }) => {
  return (
    <section id="transitorios" className="py-14 bg-[#082415] relative border-t border-emerald-800/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0b3320] rounded-3xl p-6 sm:p-8 border border-emerald-700/60 shadow-xl">
          <div className="flex items-center gap-3 mb-6 border-b border-emerald-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <span className="text-xs text-amber-400 font-bold uppercase tracking-wider block">Artículos Generales · 2.ª Edición</span>
              <h3 className="font-festive text-2xl sm:text-3xl text-yellow-300">TRANSITORIOS & AVISOS IMPORTANTES</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-950/70 p-4 rounded-xl border border-emerald-800 flex items-start gap-3">
              <Clock size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block mb-1">Traer Material Propio</span>
                <span className="text-xs text-emerald-200">
                  Los participantes deberán traer su propio ajedrez y reloj, en caso de contar con ellos. El comité no se hace responsable por la falta de estos materiales.
                </span>
              </div>
            </div>

            <div className="bg-emerald-950/70 p-4 rounded-xl border border-emerald-800 flex items-start gap-3">
              <Camera size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block mb-1">Fotografía y Video</span>
                <span className="text-xs text-emerald-200">
                  El Comité podrá realizar tomas fotográficas y de video durante el evento para difusión oficial en redes sociales del club y patrocinadores.
                </span>
              </div>
            </div>

            <div className="bg-emerald-950/70 p-4 rounded-xl border border-emerald-800 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block mb-1">Casos No Previstos</span>
                <span className="text-xs text-emerald-200">
                  Los casos no previstos en la presente convocatoria serán resueltos por el Comité Organizador del Torneo del Pavo 2026.
                </span>
              </div>
            </div>
          </div>

          {/* Committee Signatories */}
          <div className="pt-4 border-t border-emerald-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-800">
                <span className="font-festive text-sm sm:text-base text-yellow-300 block">
                  {config.presidente || 'Eduardo Roqueta'}
                </span>
                <span className="text-xs text-emerald-300">Presidente del Club de Ajedrez Don Gonzalo</span>
              </div>

              <div className="bg-emerald-950/60 p-4 rounded-xl border border-emerald-800">
                <span className="font-festive text-sm sm:text-base text-yellow-300 block">
                  {config.vicepresidente || 'Emiliano Carrillo'}
                </span>
                <span className="text-xs text-emerald-300">Vicepresidente del Club de Ajedrez Don Gonzalo</span>
              </div>
            </div>

            <p className="text-center text-xs text-amber-300/90 font-medium italic mt-4">
              "Fomentando el pensamiento, la estrategia y la sana competencia."
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
