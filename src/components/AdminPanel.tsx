import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Participant, TournamentConfig, Sponsor } from '../types/tournament';
import {
  subscribeToParticipants,
  updateParticipant,
} from '../services/tournamentService';
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
  const [viewerReceipt, setViewerReceipt] = useState<{
    reciboId: string;
    participant?: Participant | null;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Subscribe to participants only when verified as admin
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeToParticipants(
      (list) => setParticipants(list),
      () => notify('No se pudo sincronizar la lista de participantes.', 'error')
    );
    return () => unsub();
  }, [isAdmin, notify]);

  // Support direct admin deep-link `#admin-recibo=<id>`
  useEffect(() => {
    if (isAdmin && initialReceiptId) {
      const matched = participants.find((p) => p.reciboId === initialReceiptId) || null;
      setViewerReceipt({ reciboId: initialReceiptId, participant: matched });
    }
  }, [isAdmin, initialReceiptId, participants]);

  // Keep modal participant synced when payment status updates
  const currentModalParticipant = viewerReceipt
    ? participants.find(
        (p) =>
          (viewerReceipt.participant?.id && p.id === viewerReceipt.participant.id) ||
          p.reciboId === viewerReceipt.reciboId
      ) || viewerReceipt.participant
    : null;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
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

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'participantes',
      label: 'Inscritos y Recibos',
      icon: <Users size={15} />,
      badge: participants.length,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#072012] border-2 border-amber-400/80 rounded-3xl w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#092b1a] via-[#0e3f27] to-[#092b1a] px-4 sm:px-6 py-4 border-b border-emerald-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-300 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-festive text-xl sm:text-2xl text-yellow-300 leading-none">
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
              onClick={signOut}
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
        <div className="bg-[#092b1a] px-4 sm:px-6 py-2.5 border-b border-emerald-800 flex items-center gap-2 overflow-x-auto shrink-0">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
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

        {/* Inline Toast Banner */}
        {toast && (
          <div
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
              config={config}
              onViewReceipt={(reciboId, participant) =>
                setViewerReceipt({ reciboId, participant })
              }
              onNotify={notify}
            />
          )}

          {activeTab === 'contenido' && (
            <AdminContentTab config={config} onNotify={notify} />
          )}

          {activeTab === 'patrocinadores' && (
            <AdminSponsorsTab sponsors={sponsors} onNotify={notify} />
          )}

          {activeTab === 'accesos' && <AdminAccessTab onNotify={notify} />}
        </div>
      </div>

      {/* Private Receipt Lightbox Modal */}
      {viewerReceipt && (
        <ReceiptViewerModal
          reciboId={viewerReceipt.reciboId}
          participant={currentModalParticipant}
          onClose={() => setViewerReceipt(null)}
          onTogglePayment={async (p) => {
            if (!p.id) return;
            const nextStatus = p.estatusPago === 'pagado' ? 'pendiente' : 'pagado';
            await updateParticipant(p.id, { estatusPago: nextStatus });
            notify(
              `${p.nombre} marcado como ${nextStatus === 'pagado' ? 'Pagado' : 'Pendiente'}.`,
              'success'
            );
          }}
          onReceiptUpdated={() => notify('Comprobante actualizado en bóveda privada.', 'success')}
        />
      )}
    </div>
  );
};
