import React from 'react';
import { Clock, Shield, Award, Users, AlertTriangle } from 'lucide-react';
import { TournamentConfig } from '../types/tournament';

interface RulesSectionProps {
  config: TournamentConfig;
}

export const RulesSection: React.FC<RulesSectionProps> = ({ config: _config }) => {
  const tieBreakers = [
    { rank: '1°', name: 'Puntos Acumulados', desc: 'Suma total de puntos obtenidos en las 5 rondas (1 pt victoria, 0.5 pt tablas).' },
    { rank: '2°', name: 'Bucholtz Total', desc: 'Suma de los puntos obtenidos por todos los rivales enfrentados.' },
    { rank: '3°', name: 'Bucholtz Mediano', desc: 'Bucholtz excluyendo el mejor y el peor resultado de los oponentes.' },
    { rank: '4°', name: 'Resultado Particular', desc: 'Resultado del enfrentamiento directo individual entre los empatados.' },
    { rank: '5°', name: 'Mayor Número de Victorias', desc: 'Premia al jugador con mayor cantidad de partidas ganadas.' },
    { rank: '6°', name: 'Sonneborn-Berger', desc: 'Suma de puntuaciones ponderada de los rivales vencidos y empatados.' },
  ];

  return (
    <section id="reglas" className="py-16 bg-[#082415] relative border-t border-emerald-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-amber-400 font-festive text-sm uppercase tracking-widest block mb-1">
            Reglamento Oficial FIDE
          </span>
          <h2 className="font-festive text-3xl sm:text-4xl md:text-5xl text-yellow-300 drop-shadow">
            SISTEMA DE COMPETENCIA
          </h2>
          <div className="w-24 h-1 bg-amber-400 mx-auto mt-3 rounded-full" />
          <p className="mt-3 text-emerald-200 text-sm sm:text-base font-round">
            Conoce el formato de emparejamiento, el ritmo de reloj y los criterios técnicos oficiales del torneo.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          {/* Main Pillars */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#0c3924] p-6 rounded-2xl border border-emerald-700/60 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Users size={22} />
                </div>
                <h3 className="font-festive text-xl text-yellow-300">Sistema Suizo a 5 Rondas</h3>
              </div>
              <p className="text-emerald-100 text-sm leading-relaxed mb-3">
                Se jugará bajo el Sistema Suizo oficial a 5 rondas, emparejando jugadores con puntuaciones similares en cada fase (ajustable según el total de inscritos). Nadie queda eliminado; todos juegan las 5 partidas.
              </p>
              <div className="inline-flex items-center gap-2 text-xs text-amber-300 bg-emerald-950 px-3 py-1.5 rounded-lg border border-emerald-800 font-semibold">
                <span>♟️ Emparejamientos computarizados oficiales</span>
              </div>
            </div>

            <div className="bg-[#0c3924] p-6 rounded-2xl border border-emerald-700/60 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Clock size={22} />
                </div>
                <h3 className="font-festive text-xl text-yellow-300">Ritmo Rápido Fischer (10 min + 3 s)</h3>
              </div>
              <p className="text-emerald-100 text-sm leading-relaxed mb-3">
                Cada jugador dispondrá de 10 minutos para toda la partida, con un incremento de 3 segundos por jugada desde el movimiento 1. Un ritmo dinámico, emocionante y reglamentario.
              </p>
              <div className="inline-flex items-center gap-2 text-xs text-amber-300 bg-emerald-950 px-3 py-1.5 rounded-lg border border-emerald-800 font-semibold">
                <span>⏱️ Reloj digital con incremento obligatorio</span>
              </div>
            </div>

            <div className="bg-[#0c3924] p-6 rounded-2xl border border-emerald-700/60 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                  <AlertTriangle size={22} />
                </div>
                <h3 className="font-festive text-xl text-red-300">Tolerancia de 5 Minutos (Forfeit)</h3>
              </div>
              <p className="text-emerald-100 text-sm leading-relaxed mb-2">
                El tiempo de tolerancia para presentarse ante el tablero será de 5 minutos a partir de que el árbitro dé la orden de inicio de ronda.
              </p>
              <p className="text-xs text-red-200/90 font-medium bg-red-950/40 p-2.5 rounded-lg border border-red-800/50">
                Al agotarse los 5 minutos sin que el competidor esté en su mesa, se decretará incomparecencia (partida perdida por default).
              </p>
            </div>

            <div className="bg-[#0c3924] p-6 rounded-2xl border border-emerald-700/60 shadow-xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                  <Shield size={22} />
                </div>
                <h3 className="font-festive text-xl text-yellow-300">Cuerpo Arbitral Acreditado</h3>
              </div>
              <p className="text-emerald-100 text-sm leading-relaxed">
                El torneo contará con un Árbitro Oficial designado por el Comité Organizador del Club de Ajedrez Don Gonzalo, con facultades plenas para resolver incidencias técnicas y aplicar leyes FIDE vigentes.
              </p>
            </div>
          </div>

          {/* Tiebreaker Criteria Card */}
          <div className="lg:col-span-5 bg-[#0b3320] p-6 sm:p-7 rounded-3xl border-2 border-amber-400/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-emerald-700/80 pb-3">
              <Award size={22} className="text-amber-400" />
              <h3 className="font-festive text-2xl text-yellow-300">Criterios de Desempate</h3>
            </div>

            <p className="text-xs sm:text-sm text-emerald-200 leading-relaxed">
              En caso de empate en la puntuación final de cualquier categoría, se aplicarán estrictamente los siguientes criterios en orden de prelación:
            </p>

            <div className="space-y-2.5 pt-2">
              {tieBreakers.map((tb) => (
                <div
                  key={tb.rank}
                  className="bg-emerald-950/80 p-3 rounded-xl border border-emerald-800/80 hover:border-amber-400/50 transition-colors flex items-start gap-3"
                >
                  <span className="shrink-0 font-festive text-sm text-amber-300 bg-emerald-900 px-2 py-0.5 rounded-md border border-emerald-700">
                    {tb.rank}
                  </span>
                  <div>
                    <span className="font-bold text-white text-xs sm:text-sm block">{tb.name}</span>
                    <span className="text-[11px] sm:text-xs text-emerald-300/80 leading-normal block">
                      {tb.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
