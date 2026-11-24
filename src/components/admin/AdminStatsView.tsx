import React from 'react';
import { Participant, TournamentConfig, WaitlistEntry } from '../../types/tournament';
import { buildTournamentExportSummary } from '../../utils/tournamentUtils';
import { Users, CheckCircle2, Clock, Coins, UserCheck, Trophy, Receipt, Hourglass } from 'lucide-react';

interface AdminStatsViewProps {
  participants: Participant[];
  waitlist: WaitlistEntry[];
  config: TournamentConfig;
}

export const AdminStatsView: React.FC<AdminStatsViewProps> = ({
  participants,
  waitlist,
  config,
}) => {
  const summary = buildTournamentExportSummary(participants, config);
  const cupoPct =
    summary.cupoMaximo > 0
      ? Math.min(100, Math.round((summary.totalInscritos / summary.cupoMaximo) * 100))
      : 0;
  const paidPct =
    summary.totalInscritos > 0
      ? Math.round((summary.totalPagados / summary.totalInscritos) * 100)
      : 0;
  const checkinPct =
    summary.totalInscritos > 0
      ? Math.round((summary.totalAsistencias / summary.totalInscritos) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cupo Total */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Ocupación del Torneo
            </span>
            <Users size={18} className="text-amber-400" aria-hidden="true" />
          </div>
          <p className="font-festive text-3xl text-yellow-300 tabular-nums">
            {summary.totalInscritos} <span className="text-sm text-emerald-400">/ {summary.cupoMaximo}</span>
          </p>
          <div className="w-full h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-800">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${cupoPct}%` }} />
          </div>
          <p className="text-[11px] text-emerald-300">
            {cupoPct}% ocupado · <strong>{summary.lugaresDisponibles}</strong> lugares disponibles
          </p>
        </div>

        {/* Pagos */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Estatus de Pagos
            </span>
            <CheckCircle2 size={18} className="text-emerald-400" aria-hidden="true" />
          </div>
          <div className="flex items-baseline gap-4 tabular-nums">
            <div>
              <span className="font-festive text-3xl text-emerald-300">{summary.totalPagados}</span>
              <span className="text-[11px] text-emerald-400 block">Pagados</span>
            </div>
            <div>
              <span className="font-festive text-2xl text-amber-300">{summary.totalPendientes}</span>
              <span className="text-[11px] text-amber-300/80 block">Pendientes</span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-800">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${paidPct}%` }} />
          </div>
          <p className="text-[11px] text-emerald-300">
            {paidPct}% validados · Con comprobante adjunto: <strong>{summary.totalConRecibo}</strong>
          </p>
        </div>

        {/* Recaudación */}
        <div className="bg-[#092b1a] border border-amber-400/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Recaudación (MXN)
            </span>
            <Coins size={18} className="text-amber-300" aria-hidden="true" />
          </div>
          <p className="font-festive text-3xl text-amber-300 tabular-nums">
            ${summary.recaudacionConfirmada.toLocaleString('es-MX')}
          </p>
          <p className="text-xs text-emerald-200 tabular-nums">
            Proyección si pagan todos los inscritos:{' '}
            <strong className="text-white">
              ${summary.recaudacionEsperada.toLocaleString('es-MX')} MXN
            </strong>
          </p>
          <p className="text-[11px] text-emerald-400">
            Calculado con cuota vigente de ${Number(config.costo || 200).toLocaleString('es-MX')} MXN.
          </p>
        </div>

        {/* Categorías y Distinciones */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Categorías y Premios Especiales
            </span>
            <Trophy size={18} className="text-amber-400" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="bg-emerald-950/90 border border-emerald-800 rounded-xl p-2.5">
              <span className="text-emerald-400 text-[10px] uppercase block">Juvenil (≤18)</span>
              <strong className="text-lg text-white tabular-nums">{summary.totalJuvenil}</strong>
            </div>
            <div className="bg-emerald-950/90 border border-emerald-800 rounded-xl p-2.5">
              <span className="text-emerald-400 text-[10px] uppercase block">Libre</span>
              <strong className="text-lg text-amber-300 tabular-nums">{summary.totalLibre}</strong>
            </div>
            <div className="bg-emerald-950/90 border border-emerald-800 rounded-xl p-2.5">
              <span className="text-emerald-400 text-[10px] uppercase block">★ Aficionado</span>
              <strong className="text-lg text-sky-300 tabular-nums">{summary.totalAficionados}</strong>
            </div>
            <div className="bg-emerald-950/90 border border-emerald-800 rounded-xl p-2.5">
              <span className="text-emerald-400 text-[10px] uppercase block">♀ Femenil</span>
              <strong className="text-lg text-pink-300 tabular-nums">{summary.totalFemenil}</strong>
            </div>
          </div>
        </div>

        {/* Check-in Día del Torneo */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Check-in Día del Torneo
            </span>
            <UserCheck size={18} className="text-sky-300" aria-hidden="true" />
          </div>
          <p className="font-festive text-3xl text-sky-300 tabular-nums">
            {summary.totalAsistencias}{' '}
            <span className="text-sm text-emerald-400">presentes</span>
          </p>
          <div className="w-full h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-800">
            <div className="h-full bg-sky-400 transition-all" style={{ width: `${checkinPct}%` }} />
          </div>
          <p className="text-[11px] text-emerald-300">
            {checkinPct}% de jugadores activos han confirmado presencia en mesa.
          </p>
        </div>

        {/* Comprobantes & Lista de Espera */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Comprobantes y Espera
            </span>
            <Receipt size={18} className="text-amber-300" aria-hidden="true" />
          </div>
          <div className="space-y-2 text-xs pt-1">
            <div className="flex items-center justify-between bg-emerald-950/90 border border-emerald-800 rounded-xl px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-emerald-200">
                <Clock size={14} className="text-amber-300" />
                Sin comprobante adjunto
              </span>
              <strong className="text-amber-300 tabular-nums">
                {Math.max(0, summary.totalInscritos - summary.totalConRecibo)}
              </strong>
            </div>
            <div className="flex items-center justify-between bg-emerald-950/90 border border-emerald-800 rounded-xl px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-emerald-200">
                <Hourglass size={14} className="text-sky-300" />
                En lista de espera
              </span>
              <strong className="text-sky-300 tabular-nums">{waitlist.length}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
