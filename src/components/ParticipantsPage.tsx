import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Participant, TournamentConfig } from '../types/tournament';
import { useAuth } from '../context/AuthContext';
import { calculateAgeAtTournament, buildTournamentExportSummary } from '../utils/tournamentUtils';
import {
  exportParticipantsToPDF,
  exportParticipantsToExcel,
  exportParticipantsToCSV,
} from '../utils/exportUtils';
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  ArrowLeft,
  UserPlus,
  Phone,
  Sparkles,
  Shield,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';

interface ParticipantsPageProps {
  config: TournamentConfig;
  onBack: () => void;
  onRegisterClick: () => void;
  onOpenAdmin: () => void;
}

export const ParticipantsPage: React.FC<ParticipantsPageProps> = ({
  config,
  onBack,
  onRegisterClick,
  onOpenAdmin,
}) => {
  const { isAdmin } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [paymentFilter, setPaymentFilter] = useState<'Todos' | 'pagado' | 'pendiente'>('Todos');
  const [distinctionFilter, setDistinctionFilter] = useState<'Todas' | 'aficionado' | 'femenil'>('Todas');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'participantes'), orderBy('fechaRegistro', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Participant[] = [];
        snapshot.forEach((d) => {
          docs.push({ id: d.id, ...(d.data() as Omit<Participant, 'id'>) });
        });
        setParticipants(docs);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching participants list:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const showNotice = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 3200);
  };

  const handleTogglePayment = async (p: Participant) => {
    if (!isAdmin || !p.id) return;
    const newStatus = p.estatusPago === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await updateDoc(doc(db, 'participantes', p.id), {
        estatusPago: newStatus,
      });
    } catch (err) {
      console.error('Error toggling payment status:', err);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return participants.filter((p) => {
      const matchesSearch =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        (p.folio && p.folio.toLowerCase().includes(term)) ||
        p.whatsapp.includes(term) ||
        p.correo.toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === 'Todas' ||
        p.categoria === categoryFilter ||
        (categoryFilter === 'Libre' && (p.categoria === 'Libre' || p.categoria.startsWith('Libre')));

      const matchesPayment = paymentFilter === 'Todos' || p.estatusPago === paymentFilter;

      const matchesDistinction =
        distinctionFilter === 'Todas' ||
        (distinctionFilter === 'aficionado' &&
          (p.esAficionado || p.categoria === 'Libre - Aficionados')) ||
        (distinctionFilter === 'femenil' && p.esFemenil);

      return matchesSearch && matchesCategory && matchesPayment && matchesDistinction;
    });
  }, [participants, searchTerm, categoryFilter, paymentFilter, distinctionFilter]);

  const summary = useMemo(
    () => buildTournamentExportSummary(participants, config),
    [participants, config]
  );

  // Public exports NEVER include private admin receipt links
  const handleExportPDF = () => {
    if (participants.length === 0) {
      showNotice('Aún no hay participantes registrados para exportar.');
      return;
    }
    exportParticipantsToPDF({
      participants: filtered.length > 0 ? filtered : participants,
      config,
      isAdminExport: false,
    });
    showNotice('Archivo PDF generado correctamente.');
  };

  const handleExportExcel = () => {
    if (participants.length === 0) {
      showNotice('Aún no hay participantes registrados para exportar.');
      return;
    }
    exportParticipantsToExcel({
      participants: filtered.length > 0 ? filtered : participants,
      config,
      isAdminExport: false,
    });
    showNotice('Libro de Excel (.xlsx) generado correctamente.');
  };

  const handleExportCSV = () => {
    if (participants.length === 0) {
      showNotice('Aún no hay participantes registrados para exportar.');
      return;
    }
    exportParticipantsToCSV({
      participants: filtered.length > 0 ? filtered : participants,
      isAdminExport: false,
    });
    showNotice('Archivo CSV generado correctamente.');
  };

  return (
    <div className="min-h-screen bg-[#072012] text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      {/* Top Controls & Navigation Bar */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 bg-emerald-900/80 hover:bg-emerald-800 text-amber-300 font-bold px-4 py-2.5 rounded-xl border border-emerald-700 transition-colors text-sm shadow cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Volver a la Convocatoria</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRegisterClick}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-emerald-950 font-black px-4 py-2.5 rounded-xl text-sm transition-all shadow cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Inscribirme</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            data-testid="public-export-pdf"
            className="inline-flex items-center gap-1.5 bg-red-900/85 hover:bg-red-800 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-red-600/80 transition-colors shadow cursor-pointer"
            title="Descargar padrón en PDF"
          >
            <FileText size={16} className="text-amber-300" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            data-testid="public-export-excel"
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-emerald-500 transition-colors shadow cursor-pointer"
            title="Descargar libro de Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} className="text-yellow-300" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white font-bold px-3 py-2.5 rounded-xl text-xs sm:text-sm border border-emerald-600 transition-colors shadow cursor-pointer"
            title="Descargar archivo CSV"
          >
            <Download size={15} className="text-amber-300" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-white font-bold px-3 py-2.5 rounded-xl text-xs sm:text-sm border border-emerald-600 transition-colors shadow cursor-pointer"
            title="Imprimir lista oficial"
          >
            <Printer size={15} className="text-amber-300" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            type="button"
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-bold px-3 py-2.5 rounded-xl text-xs border border-emerald-700 transition-colors cursor-pointer"
          >
            <Shield size={15} className={isAdmin ? 'text-amber-400' : 'text-emerald-400'} />
            <span>{isAdmin ? 'Panel Admin' : 'Admin'}</span>
          </button>
        </div>
      </div>

      {/* Inline Notice */}
      {exportNotice && (
        <div className="max-w-7xl mx-auto mb-4 bg-emerald-900/90 border border-amber-400/60 text-amber-200 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 print:hidden">
          <CheckCircle2 size={15} className="text-amber-300" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#0a2e1d] via-[#0f442b] to-[#0a2e1d] rounded-3xl p-6 sm:p-8 border-2 border-amber-400/80 shadow-2xl text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-900/80 border border-amber-400/50 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3 shadow">
            <Sparkles size={14} />
            <span>{config.club} · Durango, Dgo.</span>
          </div>

          <h1 className="font-festive text-3xl sm:text-5xl md:text-6xl text-yellow-300 drop-shadow-[0_3px_8px_rgba(0,0,0,0.8)] uppercase font-black leading-tight">
            {config.titulo || 'TORNEO DEL PAVO 2.0'}
          </h1>

          <h2 className="font-festive text-xl sm:text-2xl text-white mt-1">
            Padrón Oficial de Participantes Registrados
          </h2>

          <p className="mt-2 text-emerald-200 text-xs sm:text-sm max-w-2xl mx-auto font-round">
            {config.fecha} · {config.hora} · {config.lugar}. Consulta tu folio, estatus de confirmación y categoría oficial.
          </p>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 text-left">
            <div className="bg-[#072012]/90 p-3.5 rounded-2xl border border-emerald-700/80">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Total Inscritos</span>
              <span className="font-festive text-2xl text-yellow-300 font-bold block mt-0.5 tabular-nums">
                {summary.totalInscritos}{' '}
                <span className="text-xs font-normal text-emerald-300">/ {config.cupoMaximo}</span>
              </span>
            </div>

            <div className="bg-[#072012]/90 p-3.5 rounded-2xl border border-emerald-700/80">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Confirmados</span>
              <span className="font-festive text-2xl text-emerald-300 font-bold block mt-0.5 tabular-nums">
                {summary.totalPagados}
              </span>
            </div>

            <div className="bg-[#072012]/90 p-3.5 rounded-2xl border border-emerald-700/80">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Por Validar</span>
              <span className="font-festive text-2xl text-amber-400 font-bold block mt-0.5 tabular-nums">
                {summary.totalPendientes}
              </span>
            </div>

            <div className="bg-[#072012]/90 p-3.5 rounded-2xl border border-emerald-700/80">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">♞ Juvenil (≤ 18)</span>
              <span className="font-festive text-2xl text-white font-bold block mt-0.5 tabular-nums">
                {summary.totalJuvenil}
              </span>
            </div>

            <div className="bg-[#072012]/90 p-3.5 rounded-2xl border border-emerald-700/80">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">♚ Categoría Libre</span>
              <span className="font-festive text-2xl text-yellow-300 font-bold block mt-0.5 tabular-nums">
                {summary.totalLibre}
              </span>
            </div>

            <div className="bg-[#072012]/90 p-3.5 rounded-2xl border border-emerald-700/80">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Distinciones</span>
              <div className="text-[11px] font-bold space-y-0.5 mt-1 text-emerald-200 tabular-nums">
                <div className="text-amber-300">★ Aficionados: {summary.totalAficionados}</div>
                <div className="text-pink-300">♀ Femenil: {summary.totalFemenil}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-[#0b3320] p-4 rounded-2xl border border-emerald-700 shadow-xl flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center print:hidden">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
            <input
              type="text"
              placeholder="Buscar por folio, nombre, whatsapp o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-emerald-950 text-white placeholder-emerald-600 border border-emerald-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-emerald-950 text-emerald-200 border border-emerald-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="Todas">Todas las categorías</option>
              <option value="Juvenil">Juvenil (18 o menos)</option>
              <option value="Libre">Libre (Ranqueados y Aficionados)</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'Todos' | 'pagado' | 'pendiente')}
              className="bg-emerald-950 text-emerald-200 border border-emerald-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="Todos">Todos los pagos</option>
              <option value="pagado">Solo Confirmados</option>
              <option value="pendiente">Solo Pendientes</option>
            </select>

            <select
              value={distinctionFilter}
              onChange={(e) =>
                setDistinctionFilter(e.target.value as 'Todas' | 'aficionado' | 'femenil')
              }
              className="bg-emerald-950 text-emerald-200 border border-emerald-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="Todas">Todas las distinciones</option>
              <option value="aficionado">★ Postulados Mejor Aficionado</option>
              <option value="femenil">♀ Postuladas Mejor Femenil</option>
            </select>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300 px-1 print:hidden">
          <span>
            Mostrando {filtered.length} de {participants.length} participantes registrados
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
            <Lock size={12} className="text-amber-400" />
            <span>Las fotos de recibos son privadas y solo visibles desde el Panel Admin</span>
          </span>
        </div>

        {/* Table */}
        <div className="bg-[#0b3320] rounded-2xl border border-emerald-700 shadow-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-emerald-300 flex flex-col items-center gap-3">
              <RefreshCw className="animate-spin text-amber-400" size={32} />
              <span className="font-festive text-lg">Cargando padrón oficial de participantes...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-emerald-300 space-y-3">
              <Users size={48} className="mx-auto text-emerald-600" />
              <h3 className="font-festive text-xl text-yellow-300">No se encontraron participantes</h3>
              <p className="text-xs text-emerald-200 max-w-md mx-auto">
                No hay registros que coincidan con los filtros aplicados. Puedes inscribirte ahora o ajustar la búsqueda.
              </p>
              <button
                type="button"
                onClick={onRegisterClick}
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-4 py-2 rounded-xl text-xs shadow inline-block cursor-pointer"
              >
                Inscribirme en el Torneo del Pavo 2.0
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#072415] border-b border-emerald-800 text-emerald-300 text-[11px] uppercase font-bold tracking-wider">
                    <th className="px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3">Folio</th>
                    <th className="px-4 py-3">Nombre Completo</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Edad</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Recibo</th>
                    <th className="px-4 py-3">Estatus Pago</th>
                    <th className="px-4 py-3 text-right">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-800/60">
                  {filtered.map((p, index) => {
                    const isPaid = p.estatusPago === 'pagado';
                    const age = calculateAgeAtTournament(p.fechaNacimiento);
                    const hasReceipt = Boolean(p.tieneRecibo || p.reciboId);

                    return (
                      <tr key={p.id || index} className="hover:bg-emerald-900/40 transition-colors">
                        <td className="px-4 py-3.5 text-center text-emerald-400 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        <td className="px-4 py-3.5 font-mono font-bold text-amber-300">
                          {p.folio || `PAVO-${1000 + index}`}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-bold text-white block text-sm">{p.nombre}</span>
                          <span className="text-[10px] text-emerald-400 font-mono">{p.correo}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                p.categoria === 'Juvenil'
                                  ? 'bg-emerald-800/80 text-emerald-200 border-emerald-600'
                                  : 'bg-amber-400/20 text-yellow-300 border-amber-400/40'
                              }`}
                            >
                              {p.categoria === 'Libre'
                                ? 'Libre (Ranqueados y Aficionados)'
                                : p.categoria}
                            </span>

                            <div className="flex flex-wrap gap-1">
                              {p.esAficionado && (
                                <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-500/30">
                                  ★ Mejor Aficionado
                                </span>
                              )}
                              {p.esFemenil && (
                                <span className="bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-pink-500/30">
                                  ♀ Mejor Femenil
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="text-white font-medium block">
                            {age !== null ? `${age} años` : 'N/D'}
                          </span>
                          <span className="text-[10px] text-emerald-400">{p.fechaNacimiento}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          <a
                            href={`https://wa.me/52${p.whatsapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-emerald-300 hover:text-amber-300 inline-flex items-center gap-1.5 hover:underline"
                          >
                            <Phone size={12} className="text-emerald-400" />
                            <span>{p.whatsapp}</span>
                          </a>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              hasReceipt
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800/70 text-slate-400 border-slate-700'
                            }`}
                          >
                            <Lock size={10} />
                            <span>{hasReceipt ? 'Recibo enviado' : 'Sin recibo'}</span>
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          {isAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleTogglePayment(p)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                                isPaid
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-red-500/20 hover:text-red-300'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-emerald-500/20 hover:text-emerald-300'
                              }`}
                            >
                              {isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              <span>{isPaid ? 'Confirmado' : 'Pendiente'}</span>
                            </button>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                isPaid
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              <span>{isPaid ? 'Confirmado' : 'Por validar'}</span>
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono text-[10px] text-emerald-400">
                          {p.fechaRegistro
                            ? new Date(p.fechaRegistro).toLocaleString('es-MX', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'N/D'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="bg-[#0c3924] p-5 rounded-2xl border border-emerald-700/80 text-xs text-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <span className="font-bold text-amber-300 block">
              Comité Organizador · {config.titulo || 'Torneo del Pavo 2.0'}
            </span>
            <p className="text-[11px] text-emerald-300">
              Presidente: <strong>{config.presidente || 'Eduardo Roqueta'}</strong> · Vicepresidente:{' '}
              <strong>{config.vicepresidente || 'Emiliano Carrillo'}</strong> · Durango, Dgo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleExportPDF}
              className="bg-red-900/80 hover:bg-red-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold border border-red-600/70 transition-colors flex items-center gap-1.5 shadow cursor-pointer"
            >
              <FileText size={14} className="text-amber-300" />
              <span>Descargar PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-500 transition-colors flex items-center gap-1.5 shadow cursor-pointer"
            >
              <FileSpreadsheet size={14} className="text-yellow-300" />
              <span>Descargar Excel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
