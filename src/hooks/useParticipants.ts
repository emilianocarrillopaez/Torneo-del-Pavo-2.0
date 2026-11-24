import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PublicParticipant, TournamentConfig, normalizeCategory } from '../types/tournament';
import {
  subscribeToPublicParticipants,
  updateParticipant,
} from '../services/tournamentService';
import { buildTournamentExportSummary } from '../utils/tournamentUtils';
import {
  exportParticipantsToPDF,
  exportParticipantsToExcel,
  exportParticipantsToCSV,
} from '../utils/exportUtils';

export function useParticipants(
  config: TournamentConfig,
  isAdmin: boolean,
  actorName?: string | null
) {
  const [participants, setParticipants] = useState<PublicParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [paymentFilter, setPaymentFilter] = useState<'Todos' | 'pagado' | 'pendiente'>('Todos');
  const [distinctionFilter, setDistinctionFilter] = useState<'Todas' | 'aficionado' | 'femenil'>(
    'Todas'
  );
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const startSubscription = () => {
      if (unsubscribe || (typeof document !== 'undefined' && document.hidden)) return;
      unsubscribe = subscribeToPublicParticipants(
        (docs) => {
          setParticipants(docs);
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
    };

    const stopSubscription = () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stopSubscription();
      } else {
        startSubscription();
      }
    };

    startSubscription();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stopSubscription();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (noticeTimerRef.current !== null) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showNotice = useCallback((msg: string) => {
    if (noticeTimerRef.current !== null) {
      clearTimeout(noticeTimerRef.current);
    }
    setExportNotice(msg);
    noticeTimerRef.current = setTimeout(() => {
      setExportNotice(null);
      noticeTimerRef.current = null;
    }, 3200);
  }, []);

  const handleTogglePayment = async (p: PublicParticipant) => {
    if (!isAdmin || !p.id) return;
    const newStatus = p.estatusPago === 'pagado' ? 'pendiente' : 'pagado';
    try {
      await updateParticipant(
        p.id,
        { estatusPago: newStatus },
        actorName || 'Administrador',
        config.fechaIso
      );
    } catch {
      showNotice('No fue posible actualizar el estatus de pago.');
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return participants.filter((p) => {
      const matchesSearch =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        (p.folio && p.folio.toLowerCase().includes(term));

      const normalizedCat = normalizeCategory(p.categoria);
      const matchesCategory = categoryFilter === 'Todas' || normalizedCat === categoryFilter;

      const matchesPayment = paymentFilter === 'Todos' || p.estatusPago === paymentFilter;

      const matchesDistinction =
        distinctionFilter === 'Todas' ||
        (distinctionFilter === 'aficionado' && p.esAficionado) ||
        (distinctionFilter === 'femenil' && p.esFemenil);

      return matchesSearch && matchesCategory && matchesPayment && matchesDistinction;
    });
  }, [participants, searchTerm, categoryFilter, paymentFilter, distinctionFilter]);

  const summary = useMemo(
    () => buildTournamentExportSummary(participants, config),
    [participants, config]
  );

  const handleExportPDF = async () => {
    if (participants.length === 0) {
      showNotice('Aún no hay participantes registrados para exportar.');
      return;
    }
    await exportParticipantsToPDF({
      participants: filtered.length > 0 ? filtered : participants,
      config,
      isAdminExport: false,
    });
    showNotice('Archivo PDF generado correctamente.');
  };

  const handleExportExcel = async () => {
    if (participants.length === 0) {
      showNotice('Aún no hay participantes registrados para exportar.');
      return;
    }
    await exportParticipantsToExcel({
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

  return {
    participants,
    filtered,
    summary,
    loading,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    paymentFilter,
    setPaymentFilter,
    distinctionFilter,
    setDistinctionFilter,
    exportNotice,
    handleTogglePayment,
    handleExportPDF,
    handleExportExcel,
    handleExportCSV,
  };
}
