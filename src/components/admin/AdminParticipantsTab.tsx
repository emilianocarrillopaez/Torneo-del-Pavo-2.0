import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Participant,
  TournamentCategory,
  TournamentConfig,
  WaitlistEntry,
  normalizeCategory,
} from '../../types/tournament';
import {
  updateParticipant,
  deleteParticipant,
  createParticipantAsAdmin,
  attachReceiptToParticipant,
  purgeAllReceipts,
  anonymizeAllParticipantsPostEvent,
  syncPublicRosterFromPrivate,
  batchMarkParticipantsPaid,
  toggleParticipantAttendance,
  softDeleteParticipant,
  restoreParticipant,
  releaseRegistrationKey,
  fetchPublicRosterIds,
  updateWaitlistStatus,
  deleteWaitlistEntry,
  purgeOldWaitlistEntries,
} from '../../services/tournamentService';
import { WAITLIST_PURGE_DAYS } from '../../constants/tournament';
import {
  calculateAgeAtTournament,
  buildTournamentExportSummary,
  buildAdminReceiptLink,
  formatWhatsAppUrl,
  findPossibleDuplicates,
  PRIVACY_NOTICE_VERSION,
} from '../../utils/tournamentUtils';
import { copyTextSafely } from '../../utils/paymentConfig';
import {
  exportParticipantsToPDF,
  exportParticipantsToExcel,
  exportParticipantsToCSV,
  exportSwissPairingCSV,
  exportFullBackupJson,
} from '../../utils/exportUtils';
import { processReceiptFile, ProcessedReceiptFile } from '../../utils/receiptUtils';
import { AdminStatsView } from './AdminStatsView';
import {
  AdminEditParticipantModal,
  AdminCreateParticipantModal,
  AdminHistoryModal,
  AdminReleaseKeyModal,
  AdminConfirmDialog,
} from './AdminParticipantModals';
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
  Upload,
  Loader2,
  RefreshCw,
  Eraser,
  ShieldOff,
  History,
  UserCheck,
  RotateCcw,
  KeyRound,
  AlertTriangle,
  DatabaseBackup,
  BarChart3,
  Archive,
  Hourglass,
  Users,
  Swords,
} from 'lucide-react';

interface AdminParticipantsTabProps {
  participants: Participant[];
  waitlist: WaitlistEntry[];
  config: TournamentConfig;
  actorName: string;
  onViewReceipt: (reciboId: string, participant: Participant) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onModalOpenChange?: (isOpen: boolean) => void;
}

type SubView = 'activos' | 'espera' | 'papelera' | 'estadisticas';

type ConfirmActionState =
  | { kind: 'soft_delete'; participant: Participant }
  | { kind: 'hard_delete'; participant: Participant }
  | { kind: 'delete_waitlist'; entry: WaitlistEntry }
  | { kind: 'purge_waitlist' }
  | { kind: 'purge_receipts' }
  | { kind: 'anonymize' }
  | { kind: 'sync_public' }
  | { kind: 'batch_paid'; targets: Participant[] }
  | { kind: 'backup_json' }
  | null;

export const AdminParticipantsTab: React.FC<AdminParticipantsTabProps> = ({
  participants,
  waitlist,
  config,
  actorName,
  onViewReceipt,
  onNotify,
  onModalOpenChange,
}) => {
  const [subView, setSubView] = useState<SubView>('activos');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [paymentFilter, setPaymentFilter] = useState<'Todos' | 'pagado' | 'pendiente'>('Todos');
  const [receiptFilter, setReceiptFilter] = useState<'Todos' | 'con' | 'sin'>('Todos');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [publicRosterIds, setPublicRosterIds] = useState<Set<string> | null>(null);

  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Participant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReleaseKeyModal, setShowReleaseKeyModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState>(null);
  const [saving, setSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ processed: number; total: number } | null>(
    null
  );

  const [attachingForId, setAttachingForId] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachTarget, setAttachTarget] = useState<Participant | null>(null);

  const [newForm, setNewForm] = useState({
    nombre: '',
    fechaNacimiento: '2000-01-01',
    whatsapp: '',
    correo: '',
    categoria: 'Libre' as TournamentCategory,
    estatusPago: 'pagado' as 'pendiente' | 'pagado',
    esAficionado: false,
    esFemenil: false,
    nombreTutor: '',
  });
  const [newReceipt, setNewReceipt] = useState<ProcessedReceiptFile | null>(null);

  const refreshPublicRosterIds = useCallback(async () => {
    const ids = await fetchPublicRosterIds();
    setPublicRosterIds(ids);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchPublicRosterIds().then((ids) => {
      if (active) setPublicRosterIds(ids);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const anyModalOpen = Boolean(
      editingParticipant ||
        historyTarget ||
        showCreateModal ||
        showReleaseKeyModal ||
        confirmAction
    );
    onModalOpenChange?.(anyModalOpen);
  }, [
    editingParticipant,
    historyTarget,
    showCreateModal,
    showReleaseKeyModal,
    confirmAction,
    onModalOpenChange,
  ]);

  const activeParticipants = useMemo(
    () => participants.filter((p) => !p.eliminado),
    [participants]
  );

  const trashedParticipants = useMemo(
    () => participants.filter((p) => Boolean(p.eliminado)),
    [participants]
  );

  const duplicatesMap = useMemo(
    () => findPossibleDuplicates(activeParticipants),
    [activeParticipants]
  );

  const summary = useMemo(
    () => buildTournamentExportSummary(activeParticipants, config),
    [activeParticipants, config]
  );

  const missingPublicCount = useMemo(() => {
    if (!publicRosterIds) return 0;
    return activeParticipants.filter((p) => p.id && !publicRosterIds.has(p.id)).length;
  }, [activeParticipants, publicRosterIds]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return activeParticipants.filter((p) => {
      const matchesSearch =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        (p.folio && p.folio.toLowerCase().includes(term)) ||
        p.whatsapp.includes(term) ||
        p.correo.toLowerCase().includes(term);

      const normCat = normalizeCategory(p.categoria);
      const matchesCategory = categoryFilter === 'Todas' || normCat === categoryFilter;
      const matchesPayment = paymentFilter === 'Todos' || p.estatusPago === paymentFilter;

      const hasReceipt = Boolean(p.tieneRecibo || p.reciboId);
      const matchesReceipt =
        receiptFilter === 'Todos' ||
        (receiptFilter === 'con' && hasReceipt) ||
        (receiptFilter === 'sin' && !hasReceipt);

      const matchesDup = !onlyDuplicates || (p.id ? duplicatesMap.has(p.id) : false);

      return matchesSearch && matchesCategory && matchesPayment && matchesReceipt && matchesDup;
    });
  }, [
    activeParticipants,
    searchTerm,
    categoryFilter,
    paymentFilter,
    receiptFilter,
    onlyDuplicates,
    duplicatesMap,
  ]);

  const selectedTargets = useMemo(
    () => filtered.filter((p) => p.id && selectedIds.has(p.id)),
    [filtered, selectedIds]
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => p.id && selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id).filter((id): id is string => Boolean(id))));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTogglePayment = async (p: Participant) => {
    if (!p.id) return;
    const nextStatus = p.estatusPago === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await updateParticipant(p.id, { estatusPago: nextStatus }, actorName, config.fechaIso);
      onNotify(
        `${p.nombre} marcado como ${nextStatus === 'pagado' ? 'Pagado' : 'Pendiente'}.`,
        'success'
      );
    } catch {
      onNotify('No se pudo actualizar el estatus de pago.', 'error');
    }
  };

  const handleToggleAttendance = async (p: Participant) => {
    try {
      await toggleParticipantAttendance(p, actorName);
      onNotify(
        `${p.nombre}: ${!p.asistencia ? 'Check-in confirmado' : 'Check-in desmarcado'}.`,
        'success'
      );
    } catch {
      onNotify('No se pudo actualizar la asistencia.', 'error');
    }
  };

  const handleCopyReceiptLink = async (reciboId: string) => {
    const link = buildAdminReceiptLink(
      reciboId,
      typeof window !== 'undefined' ? window.location.origin : ''
    );
    const ok = await copyTextSafely(link);
    if (ok) {
      setCopiedId(reciboId);
      onNotify('Enlace privado del recibo (solo admin) copiado al portapapeles.', 'success');
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    } else {
      onNotify('No se pudo copiar el enlace al portapapeles.', 'error');
    }
  };

  const handleAttachReceiptFile = async (file: File | undefined) => {
    if (!file || !attachTarget || !attachTarget.id) return;
    setAttachingForId(attachTarget.id);
    try {
      const processed = await processReceiptFile(file);
      await attachReceiptToParticipant(attachTarget, processed);
      onNotify(`Recibo adjuntado a ${attachTarget.nombre}.`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Error al subir el comprobante.', 'error');
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
      await updateParticipant(
        editingParticipant.id,
        {
          nombre: editingParticipant.nombre.trim(),
          fechaNacimiento: editingParticipant.fechaNacimiento,
          whatsapp: editingParticipant.whatsapp.replace(/\D/g, ''),
          correo: editingParticipant.correo.trim().toLowerCase(),
          categoria: normalizeCategory(editingParticipant.categoria),
          estatusPago: editingParticipant.estatusPago,
          esAficionado: Boolean(editingParticipant.esAficionado),
          esFemenil: Boolean(editingParticipant.esFemenil),
        },
        actorName,
        config.fechaIso
      );
      setEditingParticipant(null);
      await refreshPublicRosterIds();
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
      const nowIso = new Date().toISOString();
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
          aceptoAviso: true,
          aceptoAvisoVersion: PRIVACY_NOTICE_VERSION,
          fechaConsentimiento: nowIso,
          ...(newForm.nombreTutor.trim()
            ? { nombreTutor: newForm.nombreTutor.trim(), consentimientoTutor: true }
            : {}),
        },
        newReceipt,
        { actorName, eventFechaIso: config.fechaIso }
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
        nombreTutor: '',
      });
      setNewReceipt(null);
      await refreshPublicRosterIds();
      onNotify('Participante registrado manualmente con éxito.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'No se pudo registrar el participante.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (p: Participant) => {
    try {
      await restoreParticipant(p, actorName, config.fechaIso);
      await refreshPublicRosterIds();
      onNotify(`${p.nombre} restaurado al padrón activo.`, 'success');
    } catch {
      onNotify('No se pudo restaurar el participante.', 'error');
    }
  };

  const handleExecuteConfirm = async () => {
    if (!confirmAction) return;
    setSaving(true);
    setBatchProgress(null);
    const onProgress = (processed: number, total: number) =>
      setBatchProgress({ processed, total });
    try {
      if (confirmAction.kind === 'soft_delete') {
        await softDeleteParticipant(confirmAction.participant, actorName);
        await refreshPublicRosterIds();
        onNotify(`${confirmAction.participant.nombre} movido a la papelera.`, 'success');
      } else if (confirmAction.kind === 'hard_delete') {
        await deleteParticipant(confirmAction.participant);
        await refreshPublicRosterIds();
        onNotify('Participante, padrón público, llaves y comprobante eliminados definitivamente.', 'success');
      } else if (confirmAction.kind === 'delete_waitlist') {
        if (confirmAction.entry.id) {
          await deleteWaitlistEntry(confirmAction.entry.id);
        }
        onNotify('Registro de lista de espera eliminado.', 'success');
      } else if (confirmAction.kind === 'purge_waitlist') {
        const count = await purgeOldWaitlistEntries(waitlist, WAITLIST_PURGE_DAYS, onProgress);
        onNotify(
          count > 0
            ? `Se eliminaron ${count} entrada(s) convertida(s) o antigua(s) de la lista de espera.`
            : 'No había entradas convertidas ni con más de 30 días para limpiar.',
          'success'
        );
      } else if (confirmAction.kind === 'purge_receipts') {
        const count = await purgeAllReceipts(participants, onProgress);
        onNotify(`Se purgaron ${count} comprobantes de la bóveda privada.`, 'success');
      } else if (confirmAction.kind === 'anonymize') {
        const count = await anonymizeAllParticipantsPostEvent(participants, onProgress);
        await refreshPublicRosterIds();
        onNotify(`Se anonimizaron ${count} registros y se limpiaron datos personales.`, 'success');
      } else if (confirmAction.kind === 'sync_public') {
        const count = await syncPublicRosterFromPrivate(
          participants,
          config.fechaIso,
          onProgress
        );
        await refreshPublicRosterIds();
        onNotify(`Padrón público sincronizado (${count} participantes).`, 'success');
      } else if (confirmAction.kind === 'batch_paid') {
        const count = await batchMarkParticipantsPaid(
          confirmAction.targets,
          actorName,
          config.fechaIso,
          onProgress
        );
        setSelectedIds(new Set());
        onNotify(`Se marcaron como pagados ${count} participantes seleccionados.`, 'success');
      } else if (confirmAction.kind === 'backup_json') {
        exportFullBackupJson(participants, waitlist, config);
        onNotify('Respaldo JSON administrativo descargado.', 'success');
      }
      setConfirmAction(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'No se pudo completar la operación solicitada.',
        'error'
      );
    } finally {
      setSaving(false);
      setBatchProgress(null);
    }
  };

  const exportSubset = selectedTargets.length > 0 ? selectedTargets : filtered;

  const handleExportPdf = async (rows: Participant[]) => {
    if (rows.length === 0) {
      onNotify('No hay registros para exportar.', 'error');
      return;
    }
    try {
      await exportParticipantsToPDF({
        participants: rows,
        config,
        isAdminExport: true,
      });
      onNotify('Reporte PDF Administrativo descargado (con links a recibos).', 'success');
    } catch {
      onNotify('No se pudo generar el archivo PDF administrativo.', 'error');
    }
  };

  const handleExportExcel = async (rows: Participant[]) => {
    if (rows.length === 0) {
      onNotify('No hay registros para exportar.', 'error');
      return;
    }
    try {
      await exportParticipantsToExcel({
        participants: rows,
        config,
        isAdminExport: true,
      });
      onNotify('Excel Administrativo (.xlsx) descargado con 4 hojas y links de recibos.', 'success');
    } catch {
      onNotify('No se pudo generar el archivo Excel.', 'error');
    }
  };

  const confirmDialogConfig = (() => {
    if (!confirmAction) return null;
    switch (confirmAction.kind) {
      case 'soft_delete':
        return {
          title: '¿Mover a la papelera?',
          description: `Se retirará a ${confirmAction.participant.nombre} (${confirmAction.participant.folio}) del padrón público y de la lista activa. Podrás restaurarlo desde la pestaña Papelera.`,
          confirmLabel: 'Sí, mover a papelera',
          danger: true,
        };
      case 'hard_delete':
        return {
          title: '¿Eliminar definitivamente?',
          description: `Se borrará permanentemente a ${confirmAction.participant.nombre} (${confirmAction.participant.folio}), su comprobante privado y sus llaves anti-duplicados. Esta acción no se puede deshacer.`,
          confirmLabel: 'Eliminar permanente',
          danger: true,
        };
      case 'delete_waitlist':
        return {
          title: '¿Eliminar de lista de espera?',
          description: `Se eliminará a ${confirmAction.entry.nombre} (${confirmAction.entry.folio}) de la lista de espera.`,
          confirmLabel: 'Sí, eliminar',
          danger: true,
        };
      case 'purge_waitlist':
        return {
          title: '¿Limpiar lista de espera?',
          description: `Se eliminarán todas las entradas marcadas como «Convertido» y los registros con más de ${WAITLIST_PURGE_DAYS} días de antigüedad.`,
          confirmLabel: 'Limpiar convertidos / antiguos',
          danger: false,
        };
      case 'purge_receipts':
        return {
          title: '¿Purgar todos los comprobantes?',
          description:
            'Esta acción eliminará permanentemente todas las imágenes y PDFs de comprobantes en /comprobantes para minimizar datos personales después del torneo. Conserva nombres, folios y estatus de pago.',
          confirmLabel: 'Sí, purgar comprobantes',
          danger: false,
        };
      case 'anonymize':
        return {
          title: '¿Anonimizar participantes post-torneo?',
          description:
            'Esta acción irreversible reemplazará nombres, correos, teléfonos, fechas de nacimiento, datos de tutor y borrará todos los comprobantes y llaves de duplicados tras concluir el torneo.',
          confirmLabel: 'Sí, anonimizar todo',
          danger: true,
        };
      case 'sync_public':
        return {
          title: '¿Sincronizar padrón público?',
          description:
            'Se actualizará la colección pública /participantes_publicos a partir de los registros activos aplicando el formato de privacidad configurado.',
          confirmLabel: 'Sincronizar ahora',
          danger: false,
        };
      case 'batch_paid':
        return {
          title: `¿Marcar ${confirmAction.targets.length} como pagados?`,
          description:
            'Se actualizarán los registros seleccionados con tu nombre de administrador y la fecha/hora actual de validación, sincronizando el padrón público.',
          confirmLabel: 'Confirmar pagos en lote',
          danger: false,
        };
      case 'backup_json':
        return {
          title: 'Advertencia de Confidencialidad',
          description:
            'El respaldo JSON contiene datos personales completos (correos, teléfonos, fechas de nacimiento y lista de espera). Guárdalo en un dispositivo seguro del comité y no lo compartas públicamente.',
          confirmLabel: 'Entiendo, descargar JSON',
          danger: false,
        };
    }
  })();

  const missingReceiptCount = Math.max(0, summary.totalInscritos - summary.totalConRecibo);

  return (
    <div className="space-y-5">
      <input
        ref={attachInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        aria-label="Adjuntar comprobante a participante"
        onChange={(e) => void handleAttachReceiptFile(e.target.files?.[0])}
      />

      {/* KPI Cards */}
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
          <span className="text-[10px] font-bold uppercase text-emerald-400 block">Recibos</span>
          <span className="font-festive text-xl text-sky-300 font-bold tabular-nums">
            {summary.totalConRecibo}{' '}
            <span className="text-[11px] text-amber-300 font-sans font-normal">
              ({missingReceiptCount} sin)
            </span>
          </span>
        </div>

        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-emerald-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block">Check-in</span>
          <span className="font-festive text-2xl text-emerald-200 font-bold tabular-nums">
            {summary.totalAsistencias}
          </span>
        </div>

        <div className="bg-[#092b1a] p-3.5 rounded-2xl border border-amber-400/40">
          <span className="text-[10px] font-bold uppercase text-amber-300 block">Recaudado</span>
          <span className="font-festive text-xl text-amber-300 font-black tabular-nums">
            ${summary.recaudacionConfirmada.toLocaleString('es-MX')}
          </span>
        </div>
      </div>

      {/* Sub-view Tabs + Migration / Duplicate Counters */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#092b1a] px-4 py-2.5 rounded-2xl border border-emerald-800">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Vistas de participantes">
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'activos'}
            onClick={() => setSubView('activos')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              subView === 'activos'
                ? 'bg-amber-400 text-emerald-950'
                : 'bg-emerald-950 text-emerald-200 hover:bg-emerald-900 border border-emerald-800'
            }`}
          >
            <Users size={13} />
            <span>Activos ({activeParticipants.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subView === 'espera'}
            onClick={() => setSubView('espera')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              subView === 'espera'
                ? 'bg-amber-400 text-emerald-950'
                : 'bg-emerald-950 text-emerald-200 hover:bg-emerald-900 border border-emerald-800'
            }`}
          >
            <Hourglass size={13} />
            <span>Lista de espera ({waitlist.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subView === 'papelera'}
            onClick={() => setSubView('papelera')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              subView === 'papelera'
                ? 'bg-amber-400 text-emerald-950'
                : 'bg-emerald-950 text-emerald-200 hover:bg-emerald-900 border border-emerald-800'
            }`}
          >
            <Archive size={13} />
            <span>Papelera ({trashedParticipants.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subView === 'estadisticas'}
            onClick={() => setSubView('estadisticas')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              subView === 'estadisticas'
                ? 'bg-amber-400 text-emerald-950'
                : 'bg-emerald-950 text-emerald-200 hover:bg-emerald-900 border border-emerald-800'
            }`}
          >
            <BarChart3 size={13} />
            <span>Estadísticas</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {missingPublicCount > 0 && (
            <span className="bg-amber-500/20 text-amber-200 border border-amber-400/50 px-2.5 py-1 rounded-full font-bold">
              Faltan {missingPublicCount} en padrón público
            </span>
          )}
          {duplicatesMap.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setSubView('activos');
                setOnlyDuplicates((v) => !v);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold border cursor-pointer ${
                onlyDuplicates
                  ? 'bg-red-500 text-white border-red-300'
                  : 'bg-red-500/20 text-red-200 border-red-400/50 hover:bg-red-500/30'
              }`}
            >
              <AlertTriangle size={12} />
              <span>{duplicatesMap.size} posibles duplicados</span>
            </button>
          )}
        </div>
      </div>

      {subView === 'estadisticas' && (
        <AdminStatsView participants={activeParticipants} waitlist={waitlist} config={config} />
      )}

      {subView === 'activos' && (
        <>
          {/* Action & Export Toolbar */}
          <div className="bg-[#092b1a] p-4 rounded-2xl border border-emerald-800 flex flex-col xl:flex-row gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  aria-label="Buscar participante por folio, nombre, teléfono o correo"
                  placeholder="Buscar folio, nombre, teléfono o correo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-emerald-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <select
                aria-label="Filtrar por categoría"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-emerald-950 border border-emerald-700 rounded-xl px-2.5 py-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Todas">Todas cat.</option>
                <option value="Juvenil">Juvenil</option>
                <option value="Libre">Libre</option>
              </select>

              <select
                aria-label="Filtrar por estatus de pago"
                value={paymentFilter}
                onChange={(e) =>
                  setPaymentFilter(e.target.value as 'Todos' | 'pagado' | 'pendiente')
                }
                className="bg-emerald-950 border border-emerald-700 rounded-xl px-2.5 py-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Todos">Todos pagos</option>
                <option value="pagado">Pagados</option>
                <option value="pendiente">Pendientes</option>
              </select>

              <select
                aria-label="Filtrar por recibo"
                value={receiptFilter}
                onChange={(e) => setReceiptFilter(e.target.value as 'Todos' | 'con' | 'sin')}
                className="bg-emerald-950 border border-emerald-700 rounded-xl px-2.5 py-2 text-xs text-emerald-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Todos">Todos recibos</option>
                <option value="con">Con recibo</option>
                <option value="sin">Sin recibo</option>
              </select>

              <button
                type="button"
                onClick={() => setOnlyDuplicates((d) => !d)}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  onlyDuplicates
                    ? 'bg-red-600 text-white border-red-400'
                    : 'bg-emerald-950 text-emerald-200 border-emerald-700 hover:bg-emerald-900'
                }`}
              >
                Posibles duplicados
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportPdf(exportSubset)}
                data-testid="admin-export-pdf"
                className="inline-flex items-center gap-1.5 bg-red-800 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl text-xs border border-red-600 cursor-pointer"
              >
                <FileText size={14} className="text-amber-300" />
                <span>PDF{selectedTargets.length > 0 ? ` (${selectedTargets.length})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleExportExcel(exportSubset)}
                data-testid="admin-export-excel"
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-xs border border-emerald-500 cursor-pointer"
              >
                <FileSpreadsheet size={14} className="text-yellow-300" />
                <span>Excel{selectedTargets.length > 0 ? ` (${selectedTargets.length})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (exportSubset.length === 0) {
                    onNotify('No hay registros para exportar.', 'error');
                    return;
                  }
                  exportParticipantsToCSV({
                    participants: exportSubset,
                    isAdminExport: true,
                    eventFechaIso: config.fechaIso,
                  });
                  onNotify('CSV Administrativo descargado.', 'success');
                }}
                className="inline-flex items-center gap-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-200 font-bold px-2.5 py-2 rounded-xl text-xs border border-emerald-700 cursor-pointer"
              >
                <Download size={14} />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (exportSubset.length === 0) {
                    onNotify('No hay registros para exportar a emparejamiento suizo.', 'error');
                    return;
                  }
                  exportSwissPairingCSV(exportSubset);
                  onNotify('Archivo CSV para sistema Suizo descargado.', 'success');
                }}
                className="inline-flex items-center gap-1 bg-emerald-900 hover:bg-emerald-800 text-amber-200 font-bold px-2.5 py-2 rounded-xl text-xs border border-emerald-700 cursor-pointer"
              >
                <Swords size={14} />
                <span>Suizo</span>
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

          {/* Batch Selection Bar */}
          {selectedTargets.length > 0 && (
            <div className="bg-amber-400/15 border border-amber-400/60 px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-200">
                {selectedTargets.length} participante(s) seleccionado(s)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction({ kind: 'batch_paid', targets: selectedTargets })}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  Marcar pagados (lote)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
                >
                  Limpiar selección
                </button>
              </div>
            </div>
          )}

          {/* Privacy, Migration & Maintenance Controls */}
          <div className="bg-[#092b1a]/80 px-4 py-3 rounded-2xl border border-emerald-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-emerald-300 font-semibold">
              Operación, privacidad y respaldo:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction({ kind: 'sync_public' })}
                className="inline-flex items-center gap-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Sincronizar padrón</span>
              </button>
              <button
                type="button"
                onClick={() => setShowReleaseKeyModal(true)}
                className="inline-flex items-center gap-1.5 bg-emerald-950 hover:bg-emerald-900 text-sky-200 border border-emerald-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              >
                <KeyRound size={13} />
                <span>Liberar correo/WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({ kind: 'backup_json' })}
                className="inline-flex items-center gap-1.5 bg-emerald-950 hover:bg-emerald-900 text-amber-200 border border-emerald-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              >
                <DatabaseBackup size={13} />
                <span>Respaldo JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({ kind: 'purge_receipts' })}
                className="inline-flex items-center gap-1.5 bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-700/70 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              >
                <Eraser size={13} />
                <span>Purgar comprobantes</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction({ kind: 'anonymize' })}
                className="inline-flex items-center gap-1.5 bg-red-950/70 hover:bg-red-900 text-red-200 border border-red-800 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              >
                <ShieldOff size={13} />
                <span>Anonimizar post-torneo</span>
              </button>
            </div>
          </div>

          {/* Active Table */}
          <div className="bg-[#092b1a] rounded-2xl border border-emerald-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#061e12] border-b border-emerald-800 text-emerald-300 text-[11px] uppercase font-bold">
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos los participantes visibles"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-3">Folio</th>
                    <th className="px-3 py-3">Participante</th>
                    <th className="px-3 py-3">Categoría / Edad</th>
                    <th className="px-3 py-3">Contacto</th>
                    <th className="px-3 py-3">Recibo (Solo Admin)</th>
                    <th className="px-3 py-3">Pago</th>
                    <th className="px-3 py-3">Check-in</th>
                    <th className="px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-800/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-emerald-400">
                        No se encontraron participantes con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const isPaid = p.estatusPago === 'pagado';
                      const age = calculateAgeAtTournament(p.fechaNacimiento, config.fechaIso);
                      const isAttaching = attachingForId === p.id;
                      const dupReasons = p.id ? duplicatesMap.get(p.id) : undefined;
                      const isSelected = Boolean(p.id && selectedIds.has(p.id));
                      const normCat = normalizeCategory(p.categoria);

                      return (
                        <tr key={p.id} className="hover:bg-emerald-900/35 transition-colors">
                          <td className="px-3 py-3">
                            {p.id && (
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar a ${p.nombre}`}
                                checked={isSelected}
                                onChange={() => toggleSelectOne(p.id!)}
                              />
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                            {p.folio || 'S/F'}
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-bold text-white block">{p.nombre}</span>
                            <span className="text-[10px] text-emerald-400 font-mono block">
                              {p.correo}
                            </span>
                            {p.nombreTutor && (
                              <span className="text-[10px] text-amber-300/90 block">
                                Tutor: {p.nombreTutor}
                              </span>
                            )}
                            {dupReasons && (
                              <span className="inline-flex items-center gap-1 mt-1 bg-red-500/20 text-red-200 border border-red-400/50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                <AlertTriangle size={10} />
                                {dupReasons.join(' · ')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-bold text-amber-200 block">{normCat}</span>
                            <span className="text-[10px] text-emerald-300">
                              {age !== null ? `${age} años` : p.fechaNacimiento}
                              {p.esAficionado ? ' · ★ Afic.' : ''}
                              {p.esFemenil ? ' · ♀ Fem.' : ''}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-emerald-200 whitespace-nowrap">
                            {(() => {
                              const waHref = formatWhatsAppUrl(p.whatsapp);
                              return waHref ? (
                                <a
                                  href={waHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-amber-300 hover:underline"
                                >
                                  {p.whatsapp}
                                </a>
                              ) : (
                                <span className="text-emerald-500">{p.whatsapp || 'N/D'}</span>
                              );
                            })()}
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
                                  onClick={() => void handleCopyReceiptLink(p.reciboId!)}
                                  className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-amber-300 border border-emerald-700 cursor-pointer"
                                  aria-label={`Copiar enlace privado de recibo de ${p.nombre}`}
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
                              onClick={() => void handleTogglePayment(p)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors ${
                                isPaid
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-amber-500/20 hover:text-amber-300'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-emerald-500/20 hover:text-emerald-300'
                              }`}
                            >
                              {isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              <span>{isPaid ? 'Pagado' : 'Pendiente'}</span>
                            </button>
                            {p.pagadoPor && isPaid && (
                              <span className="block text-[9px] text-emerald-400 mt-0.5 truncate max-w-[120px]">
                                Por: {p.pagadoPor}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void handleToggleAttendance(p)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${
                                p.asistencia
                                  ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                                  : 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:text-white'
                              }`}
                            >
                              <UserCheck size={12} />
                              <span>{p.asistencia ? 'Presente' : 'Pendiente'}</span>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setHistoryTarget(p)}
                                className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-amber-300 border border-emerald-700 cursor-pointer"
                                aria-label={`Ver bitácora de ${p.nombre}`}
                                title="Historial"
                              >
                                <History size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingParticipant({
                                    ...p,
                                    categoria: normalizeCategory(p.categoria),
                                  })
                                }
                                className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 cursor-pointer"
                                aria-label={`Editar a ${p.nombre}`}
                                title="Editar"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({ kind: 'soft_delete', participant: p })
                                }
                                className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-800 cursor-pointer"
                                aria-label={`Mover a papelera a ${p.nombre}`}
                                title="Mover a papelera"
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
        </>
      )}

      {subView === 'espera' && (
        <div className="space-y-3">
          {waitlist.length > 0 && (
            <div className="bg-[#092b1a] px-4 py-3 rounded-2xl border border-emerald-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-emerald-300">
                Total en lista de espera: <strong className="text-white">{waitlist.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setConfirmAction({ kind: 'purge_waitlist' })}
                className="inline-flex items-center gap-1.5 bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-700/70 px-3 py-1.5 rounded-xl font-bold cursor-pointer"
              >
                <Eraser size={13} />
                <span>Vaciar convertidos / antiguos</span>
              </button>
            </div>
          )}
          <div className="bg-[#092b1a] rounded-2xl border border-emerald-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#061e12] border-b border-emerald-800 text-emerald-300 text-[11px] uppercase font-bold">
                  <th className="px-3 py-3">Folio</th>
                  <th className="px-3 py-3">Interesado</th>
                  <th className="px-3 py-3">Categoría</th>
                  <th className="px-3 py-3">Contacto</th>
                  <th className="px-3 py-3">Estatus</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/60">
                {waitlist.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-emerald-400">
                      No hay personas registradas en lista de espera.
                    </td>
                  </tr>
                ) : (
                  waitlist.map((entry) => {
                    const waHref = formatWhatsAppUrl(
                      entry.whatsapp,
                      `¡Hola ${entry.nombre}! Se liberó un lugar para el Torneo del Pavo 2.0 (folio de espera ${entry.folio}).`
                    );
                    return (
                      <tr key={entry.id} className="hover:bg-emerald-900/35">
                        <td className="px-3 py-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                          {entry.folio}
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-white block">{entry.nombre}</span>
                          <span className="text-[10px] text-emerald-400 font-mono block">
                            {entry.correo}
                          </span>
                          {entry.nombreTutor && (
                            <span className="text-[10px] text-amber-300 block">
                              Tutor: {entry.nombreTutor}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-amber-200 font-bold">{entry.categoria}</td>
                        <td className="px-3 py-3 font-mono">
                          {waHref ? (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-200 hover:text-amber-300 hover:underline"
                            >
                              {entry.whatsapp}
                            </a>
                          ) : (
                            entry.whatsapp
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            aria-label={`Estatus de lista de espera para ${entry.nombre}`}
                            value={entry.estatus}
                            onChange={async (e) => {
                              if (!entry.id) return;
                              try {
                                await updateWaitlistStatus(
                                  entry.id,
                                  e.target.value as WaitlistEntry['estatus']
                                );
                                onNotify('Estatus de lista de espera actualizado.', 'success');
                              } catch {
                                onNotify('No se pudo actualizar el estatus.', 'error');
                              }
                            }}
                            className="bg-emerald-950 border border-emerald-700 rounded-lg px-2 py-1 text-xs text-white"
                          >
                            <option value="en_espera">En espera</option>
                            <option value="contactado">Contactado</option>
                            <option value="convertido">Convertido</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ kind: 'delete_waitlist', entry })}
                            className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-800 cursor-pointer"
                            aria-label={`Eliminar de lista de espera a ${entry.nombre}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {subView === 'papelera' && (
        <div className="bg-[#092b1a] rounded-2xl border border-emerald-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#061e12] border-b border-emerald-800 text-emerald-300 text-[11px] uppercase font-bold">
                  <th className="px-3 py-3">Folio</th>
                  <th className="px-3 py-3">Participante</th>
                  <th className="px-3 py-3">Movido a papelera</th>
                  <th className="px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/60">
                {trashedParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-emerald-400">
                      La papelera está vacía.
                    </td>
                  </tr>
                ) : (
                  trashedParticipants.map((p) => (
                    <tr key={p.id} className="hover:bg-emerald-900/35">
                      <td className="px-3 py-3 font-mono font-bold text-amber-300">{p.folio}</td>
                      <td className="px-3 py-3">
                        <span className="font-bold text-white block">{p.nombre}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">{p.correo}</span>
                      </td>
                      <td className="px-3 py-3 text-emerald-300">
                        {p.eliminadoPor || 'Administrador'}{' '}
                        {p.eliminadoEn
                          ? `· ${new Date(p.eliminadoEn).toLocaleString('es-MX', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}`
                          : ''}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleRestore(p)}
                            className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
                          >
                            <RotateCcw size={12} />
                            <span>Restaurar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({ kind: 'hard_delete', participant: p })
                            }
                            className="inline-flex items-center gap-1 bg-red-700 hover:bg-red-600 text-white font-bold px-2.5 py-1.5 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Eliminar definitivo</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingParticipant && (
        <AdminEditParticipantModal
          participant={editingParticipant}
          saving={saving}
          onChange={setEditingParticipant}
          onSubmit={(e) => void handleSaveEdit(e)}
          onClose={() => setEditingParticipant(null)}
        />
      )}

      {showCreateModal && (
        <AdminCreateParticipantModal
          saving={saving}
          newForm={newForm}
          newReceipt={newReceipt}
          onChangeForm={setNewForm}
          onChangeReceipt={setNewReceipt}
          onNotify={onNotify}
          onSubmit={(e) => void handleCreateSubmit(e)}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {historyTarget && (
        <AdminHistoryModal participant={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}

      {showReleaseKeyModal && (
        <AdminReleaseKeyModal
          saving={saving}
          onClose={() => setShowReleaseKeyModal(false)}
          onRelease={async (input) => {
            setSaving(true);
            try {
              const count = await releaseRegistrationKey(input);
              setShowReleaseKeyModal(false);
              onNotify(`Se liberaron ${count} llave(s) de duplicado en Firestore.`, 'success');
            } catch (err) {
              onNotify(
                err instanceof Error ? err.message : 'No se pudo liberar la llave.',
                'error'
              );
            } finally {
              setSaving(false);
            }
          }}
        />
      )}

      {confirmAction && confirmDialogConfig && (
        <AdminConfirmDialog
          title={confirmDialogConfig.title}
          description={confirmDialogConfig.description}
          confirmLabel={confirmDialogConfig.confirmLabel}
          danger={confirmDialogConfig.danger}
          saving={saving}
          progressText={
            batchProgress
              ? `Procesados ${batchProgress.processed} de ${batchProgress.total}...`
              : null
          }
          onConfirm={() => void handleExecuteConfirm()}
          onClose={() => !saving && setConfirmAction(null)}
        />
      )}
    </div>
  );
};
