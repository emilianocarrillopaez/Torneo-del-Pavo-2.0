import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Participant, TournamentConfig, Sponsor, WaitlistEntry } from '../types/tournament';
import {
  subscribeToParticipants,
  subscribeToWaitlist,
  updateParticipant,
} from '../services/tournamentService';
import { evaluatePaymentConfig } from '../utils/paymentConfig';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { AdminAuthScreen } from './admin/AdminAuthScreen';
import { AdminParticipantsTab } from './admin/AdminParticipantsTab';
import { AdminContentTab } from './admin/AdminContentTab';
import { AdminSponsorsTab } from './admin/AdminSponsorsTab';
import { AdminAccessTab } from './admin/AdminAccessTab';
import { ReceiptViewerModal } from './admin/ReceiptViewerModal';
import {
  Shield,
  Users,
  FileText,
  Handshake,
  KeyRound,
  LogOut,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface AdminPanelProps {
  config: TournamentConfig;
  sponsors: Sponsor[];
  initialReceiptId?: string | null;
  onClose: () => void;
}

type AdminTab = 'participantes' | 'contenido' | 'patrocinadores' | 'accesos';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  config,
  sponsors,
  initialReceiptId,
  onClose,
}) => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('participantes');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [viewerReceipt, setViewerReceipt] = useState<{
    reciboId: string;
    participant?: Participant | null;
  } | null>(() => (initialReceiptId ? { reciboId: initialReceiptId, participant: null } : null));
  const [prevInitialReceiptId, setPrevInitialReceiptId] = useState(initialReceiptId);
  if (initialReceiptId !== prevInitialReceiptId) {
    setPrevInitialReceiptId(initialReceiptId);
    if (initialReceiptId) {
      setViewerReceipt({ reciboId: initialReceiptId, participant: null });
    }
  }
  const [hasInnerModalOpen, setHasInnerModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(
    dialogRef,
    onClose,
    Boolean(user && isAdmin && !loading && !viewerReceipt && !hasInnerModalOpen)
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Subscribe to participants and waitlist only when verified as admin
  useEffect(() => {
    if (!isAdmin) return;
    const unsubParticipants = subscribeToParticipants(
      (list) => setParticipants(list),
      () => notify('No se pudo sincronizar la lista de participantes.', 'error')
    );
    const unsubWaitlist = subscribeToWaitlist(
      (list) => setWaitlist(list),
      () => notify('No se pudo sincronizar la lista de espera.', 'error')
    );
    return () => {
      unsubParticipants();
      unsubWaitlist();
    };
  }, [isAdmin, notify]);



  // Keep modal participant synced when payment status updates
  const currentModalParticipant = viewerReceipt
    ? participants.find(
        (p) =>
          (viewerReceipt.participant?.id && p.id === viewerReceipt.participant.id) ||
          p.reciboId === viewerReceipt.reciboId
      ) || viewerReceipt.participant
    : null;

  const pendingWithReceipt = useMemo(
    () =>
      participants.filter(
        (p) => !p.eliminado && Boolean(p.reciboId) && p.estatusPago !== 'pagado'
      ),
    [participants]
  );

  const paymentStatus = useMemo(() => evaluatePaymentConfig(config), [config]);

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        role="status"
      >
        <div className="bg-[#0b3320] border border-amber-400/60 rounded-2xl p-8 text-center text-emerald-200 flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-amber-400" />
          <span className="font-festive text-lg text-yellow-300">
            Verificando sesión de administrador...
          </span>
        </div>
      </div>
    );
  }

  // Strictly enforce admin authorization gate
  if (!user || !isAdmin) {
    return <AdminAuthScreen onClose={onClose} />;
  }

  const actorName = user.displayName || user.email || 'Administrador';
  const activeCount = participants.filter((p) => !p.eliminado).length;

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'participantes',
      label: 'Inscritos y Recibos',
      icon: <Users size={15} />,
      badge: activeCount,
    },
    { id: 'contenido', label: 'Convocatoria', icon: <FileText size={15} /> },
    {
      id: 'patrocinadores',
      label: 'Patrocinadores',
      icon: <Handshake size={15} />,
      badge: sponsors.length,
    },
    { id: 'accesos', label: 'Accesos Admin', icon: <KeyRound size={15} /> },
  ];

  const handleTogglePaymentInModal = async (p: Participant) => {
    if (!p.id) return;
    const nextStatus = p.estatusPago === 'pagado' ? 'pendiente' : 'pagado';
    await updateParticipant(p.id, { estatusPago: nextStatus }, actorName, config.fechaIso);
    notify(
      `${p.nombre} marcado como ${nextStatus === 'pagado' ? 'Pagado' : 'Pendiente'}.`,
      'success'
    );
  };

  const handleApproveAndNext = async (p: Participant) => {
    if (!p.id) return;
    await updateParticipant(p.id, { estatusPago: 'pagado' }, actorName, config.fechaIso);
    const nextPending = pendingWithReceipt.find((candidate) => candidate.id !== p.id && candidate.reciboId);
    if (nextPending && nextPending.reciboId) {
      setViewerReceipt({ reciboId: nextPending.reciboId, participant: nextPending });
      notify(`${p.nombre} aprobado. Mostrando siguiente comprobante pendiente.`, 'success');
    } else {
      setViewerReceipt(null);
      notify(`${p.nombre} aprobado. ¡No quedan recibos pendientes por validar!`, 'success');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-[#072012] border-2 border-amber-400/80 rounded-3xl w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden text-white focus:outline-none"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#092b1a] via-[#0e3f27] to-[#092b1a] px-4 sm:px-6 py-4 border-b border-emerald-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-300 flex items-center justify-center">
              <Shield size={20} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="admin-panel-title"
                className="font-festive text-xl sm:text-2xl text-yellow-300 leading-none"
              >
                ADMINISTRADOR · {config.titulo || 'TORNEO DEL PAVO 2.0'}
              </h2>
              <p className="text-[11px] text-emerald-300 mt-0.5">
                Sesión verificada: <strong className="text-white">{user.email}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              <LogOut size={14} />
              <span>Salir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-emerald-900 hover:bg-emerald-800 text-white p-2 rounded-xl border border-emerald-700 cursor-pointer"
              aria-label="Cerrar panel de administración"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="bg-[#092b1a] px-4 sm:px-6 py-2.5 border-b border-emerald-800 flex items-center gap-2 overflow-x-auto shrink-0"
          role="tablist"
          aria-label="Secciones del panel de administración"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-emerald-950 shadow'
                    : 'bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 border border-emerald-800'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      active ? 'bg-emerald-950/20 text-emerald-950' : 'bg-emerald-800 text-amber-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Persistent Payment Configuration Warning Banner (3.4) */}
        {!paymentStatus.isComplete && (
          <div
            role="alert"
            className="bg-amber-950/95 border-b border-amber-500/70 px-5 py-2.5 text-xs text-amber-100 flex flex-wrap items-center justify-between gap-2 shrink-0"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-300 shrink-0" aria-hidden="true" />
              <span>
                <strong>Inscripciones públicas bloqueadas:</strong> Faltan datos reales de pago (
                {paymentStatus.missingFields.join(', ')}). Configúralos para habilitar el registro.
              </span>
            </div>
            {activeTab !== 'contenido' && (
              <button
                type="button"
                onClick={() => setActiveTab('contenido')}
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-3 py-1 rounded-lg text-[11px] cursor-pointer"
              >
                Configurar ahora
              </button>
            )}
          </div>
        )}

        {/* Inline Toast Banner */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`px-5 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 ${
              toast.type === 'error'
                ? 'bg-red-950 text-red-200 border-b border-red-700'
                : 'bg-emerald-900 text-amber-200 border-b border-amber-400/50'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Active Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'participantes' && (
            <AdminParticipantsTab
              participants={participants}
              waitlist={waitlist}
              config={config}
              actorName={actorName}
              onViewReceipt={(reciboId, participant) =>
                setViewerReceipt({ reciboId, participant })
              }
              onNotify={notify}
              onModalOpenChange={setHasInnerModalOpen}
            />
          )}

          {activeTab === 'contenido' && (
            <AdminContentTab
              config={config}
              onNotify={notify}
              onModalOpenChange={setHasInnerModalOpen}
            />
          )}

          {activeTab === 'patrocinadores' && (
            <AdminSponsorsTab
              sponsors={sponsors}
              onNotify={notify}
              onModalOpenChange={setHasInnerModalOpen}
            />
          )}

          {activeTab === 'accesos' && (
            <AdminAccessTab onNotify={notify} onModalOpenChange={setHasInnerModalOpen} />
          )}
        </div>
      </div>

      {/* Private Receipt Lightbox Modal */}
      {viewerReceipt && (
        <ReceiptViewerModal
          reciboId={viewerReceipt.reciboId}
          participant={currentModalParticipant}
          pendingReceiptsCount={pendingWithReceipt.length}
          onClose={() => setViewerReceipt(null)}
          onTogglePayment={handleTogglePaymentInModal}
          onApproveAndNext={handleApproveAndNext}
          onReceiptUpdated={() => notify('Comprobante actualizado en bóveda privada.', 'success')}
        />
      )}
    </div>
  );
};
