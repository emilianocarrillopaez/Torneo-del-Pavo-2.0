import React, { useMemo, useState, useRef } from 'react';
import { Participant, TournamentCategory, TournamentConfig } from '../../types/tournament';
import {
  updateParticipant,
  deleteParticipant,
  createParticipantAsAdmin,
  attachReceiptToParticipant,
} from '../../services/tournamentService';
import {
  calculateAgeAtTournament,
  buildTournamentExportSummary,
  buildAdminReceiptLink,
} from '../../utils/tournamentUtils';
import {
  exportParticipantsToPDF,
  exportParticipantsToExcel,
  exportParticipantsToCSV,
} from '../../utils/exportUtils';
import { processReceiptFile, ProcessedReceiptFile } from '../../utils/receiptUtils';
import {
  Search,
  FileText,
  FileSpreadsheet,
  Download,
  UserPlus,
  CheckCircle2,
  Clock,
  Eye,
  Copy,
  Check,
  Edit2,
  Trash2,
  X,
  Upload,
  Loader2,
  Receipt,
  AlertTriangle,
} from 'lucide-react';

interface AdminParticipantsTabProps {
  participants: Participant[];
  config: TournamentConfig;
  onViewReceipt: (reciboId: string, participant: Participant) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const AdminParticipantsTab: React.FC<AdminParticipantsTabProps> = ({
  participants,
  config,
  onViewReceipt,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [paymentFilter, setPaymentFilter] = useState<'Todos' | 'pagado' | 'pendiente'>('Todos');
  const [receiptFilter, setReceiptFilter] = useState<'Todos' | 'con' | 'sin'>('Todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit / Create / Delete modal state
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<Participant | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick receipt upload for existing participant missing one
  const [attachingForId, setAttachingForId] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachTarget, setAttachTarget] = useState<Participant | null>(null);

  // Create form state
  const [newForm, setNewForm] = useState({
    nombre: '',
    fechaNacimiento: '2000-01-01',
    whatsapp: '',
    correo: '',
    categoria: 'Libre' as TournamentCategory,
    estatusPago: 'pagado' as 'pendiente' | 'pagado',
    esAficionado: false,
    esFemenil: false,
  });
  const [newReceipt, setNewReceipt] = useState<ProcessedReceiptFile | null>(null);

  const summary = useMemo(
    () => buildTournamentExportSummary(participants, config),
    [participants, config]
  );

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
        (categoryFilter === 'Libre' && p.categoria.startsWith('Libre'));

      const matchesPayment = paymentFilter === 'Todos' || p.estatusPago === paymentFilter;

      const hasReceipt = Boolean(p.tieneRecibo || p.reciboId);
      const matchesReceipt =
        receiptFilter === 'Todos' ||
        (receiptFilter === 'con' && hasReceipt) ||
        (receiptFilter === 'sin' && !hasReceipt);

      return matchesSearch && matchesCategory && matchesPayment && matchesReceipt;
    });
  }, [participants, searchTerm, categoryFilter, paymentFilter, receiptFilter]);

  const handleTogglePayment = async (p: Participant) => {
    if (!p.id) return;
    const nextStatus = p.estatusPago === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await updateParticipant(p.id, { estatusPago: nextStatus });
      onNotify(
        `${p.nombre} marcado como ${nextStatus === 'pagado' ? 'Pagado' : 'Pendiente'}.`,
        'success'
      );
    } catch {
      onNotify('No se pudo actualizar el estatus de pago.', 'error');
    }
  };

  const handleCopyReceiptLink = (reciboId: string) => {
    const link = buildAdminReceiptLink(
      reciboId,
      typeof window !== 'undefined' ? window.location.origin : ''
    );
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    setCopiedId(reciboId);
    onNotify('Enlace privado del recibo (solo admin) copiado al portapapeles.', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAttachReceiptFile = async (file: File | undefined) => {
    if (!file || !attachTarget || !attachTarget.id) return;
    setAttachingForId(attachTarget.id);
    try {
      const processed = await processReceiptFile(file);
      await attachReceiptToParticipant(attachTarget, processed);
      onNotify(`Recibo adjuntado a ${attachTarget.nombre}.`, 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Error al subir el comprobante.',
        'error'
      );
    } finally {
      setAttachingForId(null);
      setAttachTarget(null);
      if (attachInputRef.current) attachInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant || !editingParticipant.id) return;
    setSaving(true);
    try {
      await updateParticipant(editingParticipant.id, {
        nombre: editingParticipant.nombre.trim(),
        fechaNacimiento: editingParticipant.fechaNacimiento,
        whatsapp: editingParticipant.whatsapp.replace(/\D/g, ''),
        correo: editingParticipant.correo.trim().toLowerCase(),
        categoria: editingParticipant.categoria,
        estatusPago: editingParticipant.estatusPago,
        esAficionado: Boolean(editingParticipant.esAficionado),
        esFemenil: Boolean(editingParticipant.esFemenil),
      });
      setEditingParticipant(null);
      onNotify('Participante actualizado correctamente.', 'success');
    } catch {
      onNotify('Error al actualizar participante. Revisa los datos (WhatsApp 10 dígitos).', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newForm.whatsapp.replace(/\D/g, '');
    if (newForm.nombre.trim().length < 3 || cleanPhone.length !== 10 || !newForm.correo.includes('@')) {
      onNotify('Completa nombre, WhatsApp de 10 dígitos y correo válido.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createParticipantAsAdmin(
        {
          nombre: newForm.nombre.trim(),
          fechaNacimiento: newForm.fechaNacimiento,
          whatsapp: cleanPhone,
          correo: newForm.correo.trim().toLowerCase(),
          categoria: newForm.categoria,
          estatusPago: newForm.estatusPago,
          esAficionado: newForm.esAficionado,
          esFemenil: newForm.esFemenil,
        },
        newReceipt
      );
      setShowCreateModal(false);
      setNewForm({
        nombre: '',
        fechaNacimiento: '2000-01-01',
        whatsapp: '',
        correo: '',
        categoria: 'Libre',
        estatusPago: 'pagado',
        esAficionado: false,
        esFemenil: false,
      });
      setNewReceipt(null);
      onNotify('Participante registrado manualmente con éxito.', 'success');
    } catch {
      onNotify('No se pudo registrar el participante.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget || !confirmDeleteTarget.id) return;
    setSaving(true);
    try {
      await deleteParticipant(confirmDeleteTarget.id, confirmDeleteTarget.reciboId);
      setConfirmDeleteTarget(null);
      onNotify('Participante y comprobante eliminados.', 'success');
    } catch {
      onNotify('Error al eliminar participante.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hidden input for attaching receipt to an existing row */}
      <input
        ref={attachInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={(e) => handleAttachReceiptFile(e.target.files?.[0])}
      />

      {/* Optimized Admin KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-emerald-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block">Inscritos</span>
          <span className="font-festive text-2xl text-yellow-300 font-bold tabular-nums">
            {summary.totalInscritos}
            <span className="text-xs text-emerald-400 font-normal">/{config.cupoMaximo}</span>
          </span>
        </div>

        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-emerald-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block">Pagados</span>
          <span className="font-festive text-2xl text-emerald-300 font-bold tabular-nums">
            {summary.totalPagados}
          </span>
        </div>

        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-emerald-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block">Pendientes</span>
          <span className="font-festive text-2xl text-amber-400 font-bold tabular-nums">
            {summary.totalPendientes}
          </span>
        </div>

        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-emerald-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block">Con Recibo</span>
          <span className="font-festive text-2xl text-sky-300 font-bold tabular-nums">
            {summary.totalConRecibo}
          </span>
        </div>

        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-emerald-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block">Categorías</span>
          <div className="text-xs font-bold text-white mt-1 tabular-nums">
            <span>Juv: {summary.totalJuvenil}</span> ·{' '}
            <span className="text-amber-300">Libre: {summary.totalLibre}</span>
          </div>
        </div>

        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-amber-400/40">
          <span className="text-[10px] font-bold uppercase text-amber-300 block">Recaudado</span>
          <span className="font-festive text-xl text-amber-300 font-black tabular-nums">
            ${summary.recaudacionConfirmada.toLocaleString('es-MX')}
          </span>
        </div>
      </div>

      {/* Action & Export Toolbar */}
      <div className="bg-[#092b1a] p-4 rounded-2xl border border-emerald-800 flex flex-col lg:flex-row gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
            <input
              type="text"
              placeholder="Buscar folio, nombre, teléfono o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-emerald-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-emerald-950 border border-emerald-700 rounded-xl px-2.5 py-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
          >
            <option value="Todas">Todas cat.</option>
            <option value="Juvenil">Juvenil</option>
            <option value="Libre">Libre</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as 'Todos' | 'pagado' | 'pendiente')}
            className="bg-emerald-950 border border-emerald-700 rounded-xl px-2.5 py-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
          >
            <option value="Todos">Todos pagos</option>
            <option value="pagado">Pagados</option>
            <option value="pendiente">Pendientes</option>
          </select>

          <select
            value={receiptFilter}
            onChange={(e) => setReceiptFilter(e.target.value as 'Todos' | 'con' | 'sin')}
            className="bg-emerald-950 border border-emerald-700 rounded-xl px-2.5 py-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
          >
            <option value="Todos">Todos recibos</option>
            <option value="con">Con recibo</option>
            <option value="sin">Sin recibo</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (filtered.length === 0) {
                onNotify('No hay registros para exportar.', 'error');
                return;
              }
              exportParticipantsToPDF({
                participants: filtered,
                config,
                isAdminExport: true,
              });
              onNotify('Reporte PDF Administrativo descargado (con links a recibos).', 'success');
            }}
            data-testid="admin-export-pdf"
            className="inline-flex items-center gap-1.5 bg-red-800 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl text-xs border border-red-600 cursor-pointer"
          >
            <FileText size={14} className="text-amber-300" />
            <span>PDF Admin</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (filtered.length === 0) {
                onNotify('No hay registros para exportar.', 'error');
                return;
              }
              exportParticipantsToExcel({
                participants: filtered,
                config,
                isAdminExport: true,
              });
              onNotify('Excel Administrativo (.xlsx) descargado con 4 hojas y links de recibos.', 'success');
            }}
            data-testid="admin-export-excel"
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-xs border border-emerald-500 cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-yellow-300" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (filtered.length === 0) {
                onNotify('No hay registros para exportar.', 'error');
                return;
              }
              exportParticipantsToCSV({ participants: filtered, isAdminExport: true });
              onNotify('CSV Administrativo descargado.', 'success');
            }}
            className="inline-flex items-center gap-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-200 font-bold px-2.5 py-2 rounded-xl text-xs border border-emerald-700 cursor-pointer"
          >
            <Download size={14} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-3.5 py-2 rounded-xl text-xs cursor-pointer"
          >
            <UserPlus size={14} />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#092b1a] rounded-2xl border border-emerald-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#061e12] border-b border-emerald-800 text-emerald-300 text-[11px] uppercase font-bold">
                <th className="px-3 py-3">Folio</th>
                <th className="px-3 py-3">Participante</th>
                <th className="px-3 py-3">Categoría / Edad</th>
                <th className="px-3 py-3">Contacto</th>
                <th className="px-3 py-3">Recibo (Solo Admin)</th>
                <th className="px-3 py-3">Pago</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-emerald-400">
                    No se encontraron participantes con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isPaid = p.estatusPago === 'pagado';
                  const age = calculateAgeAtTournament(p.fechaNacimiento);
                  const isAttaching = attachingForId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-emerald-900/35 transition-colors">
                      <td className="px-3 py-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                        {p.folio || 'S/F'}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-bold text-white block">{p.nombre}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">{p.correo}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-bold text-amber-200 block">{p.categoria}</span>
                        <span className="text-[10px] text-emerald-300">
                          {age !== null ? `${age} años` : p.fechaNacimiento}
                          {p.esAficionado ? ' · ★ Afic.' : ''}
                          {p.esFemenil ? ' · ♀ Fem.' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-emerald-200 whitespace-nowrap">
                        <a
                          href={`https://wa.me/52${p.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-amber-300 hover:underline"
                        >
                          {p.whatsapp}
                        </a>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {p.reciboId ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewReceipt(p.reciboId!, p)}
                              className="inline-flex items-center gap-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>Ver Foto</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyReceiptLink(p.reciboId!)}
                              className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-amber-300 border border-emerald-700 cursor-pointer"
                              title="Copiar enlace privado de recibo"
                            >
                              {copiedId === p.reciboId ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isAttaching}
                            onClick={() => {
                              setAttachTarget(p);
                              attachInputRef.current?.click();
                            }}
                            className="inline-flex items-center gap-1 bg-emerald-950 hover:bg-emerald-800 text-emerald-300 border border-emerald-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            {isAttaching ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Upload size={12} />
                            )}
                            <span>Subir recibo</span>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePayment(p)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-amber-500/20 hover:text-amber-300'
                              : 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-emerald-500/20 hover:text-emerald-300'
                          }`}
                        >
                          {isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          <span>{isPaid ? 'Pagado' : 'Pendiente'}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingParticipant({ ...p })}
                            className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTarget(p)}
                            className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-800 cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingParticipant && (
        <div
          className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditingParticipant(null)}
        >
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b3320] border-2 border-amber-400 rounded-2xl max-w-md w-full p-5 space-y-3 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
              <h4 className="font-festive text-lg text-yellow-300">Editar Participante</h4>
              <button type="button" onClick={() => setEditingParticipant(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-emerald-300 font-bold block mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={editingParticipant.nombre}
                  onChange={(e) =>
                    setEditingParticipant({ ...editingParticipant, nombre: e.target.value })
                  }
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-emerald-300 font-bold block mb-1">Fecha nacimiento</label>
                  <input
                    type="date"
                    required
                    value={editingParticipant.fechaNacimiento}
                    onChange={(e) =>
                      setEditingParticipant({
                        ...editingParticipant,
                        fechaNacimiento: e.target.value,
                      })
                    }
                    className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-emerald-300 font-bold block mb-1">WhatsApp (10 dig.)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    value={editingParticipant.whatsapp}
                    onChange={(e) =>
                      setEditingParticipant({
                        ...editingParticipant,
                        whatsapp: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-emerald-300 font-bold block mb-1">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={editingParticipant.correo}
                  onChange={(e) =>
                    setEditingParticipant({ ...editingParticipant, correo: e.target.value })
                  }
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-emerald-300 font-bold block mb-1">Categoría</label>
                  <select
                    value={editingParticipant.categoria}
                    onChange={(e) =>
                      setEditingParticipant({
                        ...editingParticipant,
                        categoria: e.target.value as TournamentCategory,
                      })
                    }
                    className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Juvenil">Juvenil</option>
                    <option value="Libre">Libre</option>
                  </select>
                </div>
                <div>
                  <label className="text-emerald-300 font-bold block mb-1">Estatus pago</label>
                  <select
                    value={editingParticipant.estatusPago}
                    onChange={(e) =>
                      setEditingParticipant({
                        ...editingParticipant,
                        estatusPago: e.target.value as 'pendiente' | 'pagado',
                      })
                    }
                    className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="pagado">Pagado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingParticipant.esAficionado)}
                    onChange={(e) =>
                      setEditingParticipant({
                        ...editingParticipant,
                        esAficionado: e.target.checked,
                      })
                    }
                  />
                  <span>Mejor Aficionado</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingParticipant.esFemenil)}
                    onChange={(e) =>
                      setEditingParticipant({
                        ...editingParticipant,
                        esFemenil: e.target.checked,
                      })
                    }
                  />
                  <span>Mejor Femenil</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingParticipant(null)}
                className="px-4 py-2 rounded-xl bg-emerald-900 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-amber-400 text-emerald-950 text-xs font-black"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Participant Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onSubmit={handleCreateSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b3320] border-2 border-amber-400 rounded-2xl max-w-md w-full p-5 space-y-3 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
              <h4 className="font-festive text-lg text-yellow-300">Registro Manual (Admin)</h4>
              <button type="button" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <input
                type="text"
                required
                placeholder="Nombre completo del jugador"
                value={newForm.nombre}
                onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required
                  value={newForm.fechaNacimiento}
                  onChange={(e) => setNewForm({ ...newForm, fechaNacimiento: e.target.value })}
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                />
                <input
                  type="tel"
                  maxLength={10}
                  required
                  placeholder="WhatsApp 10 dígitos"
                  value={newForm.whatsapp}
                  onChange={(e) =>
                    setNewForm({ ...newForm, whatsapp: e.target.value.replace(/\D/g, '') })
                  }
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <input
                type="email"
                required
                placeholder="Correo electrónico"
                value={newForm.correo}
                onChange={(e) => setNewForm({ ...newForm, correo: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newForm.categoria}
                  onChange={(e) =>
                    setNewForm({ ...newForm, categoria: e.target.value as TournamentCategory })
                  }
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Juvenil">Juvenil</option>
                  <option value="Libre">Libre</option>
                </select>
                <select
                  value={newForm.estatusPago}
                  onChange={(e) =>
                    setNewForm({
                      ...newForm,
                      estatusPago: e.target.value as 'pendiente' | 'pagado',
                    })
                  }
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>

              {/* Optional receipt upload */}
              <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-3">
                <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1 mb-1.5">
                  <Receipt size={13} />
                  <span>Foto de recibo (opcional en alta manual)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const processed = await processReceiptFile(f);
                      setNewReceipt(processed);
                    } catch (err) {
                      onNotify(
                        err instanceof Error ? err.message : 'Archivo no válido.',
                        'error'
                      );
                    }
                  }}
                  className="text-[11px] text-emerald-200 w-full"
                />
                {newReceipt && (
                  <p className="text-[10px] text-emerald-400 mt-1">
                    Listo: {newReceipt.fileName} ({Math.round(newReceipt.fileSize / 1024)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-emerald-900 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-amber-400 text-emerald-950 text-xs font-black"
              >
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Delete Confirmation Modal (No window.confirm) */}
      {confirmDeleteTarget && (
        <div
          className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b3320] border-2 border-red-500 rounded-2xl max-w-sm w-full p-5 text-center space-y-4 text-white shadow-2xl"
          >
            <AlertTriangle size={34} className="text-red-400 mx-auto" />
            <h4 className="font-festive text-xl text-red-200">¿Eliminar registro?</h4>
            <p className="text-xs text-emerald-200">
              Se eliminará a <strong className="text-white">{confirmDeleteTarget.nombre}</strong> ({confirmDeleteTarget.folio}) y su comprobante de pago privado de forma permanente.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setConfirmDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-emerald-900 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black cursor-pointer"
              >
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
