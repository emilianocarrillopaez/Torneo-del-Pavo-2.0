import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Participant, PaymentReceipt } from '../../types/tournament';
import {
  getReceiptById,
  attachReceiptToParticipant,
} from '../../services/tournamentService';
import {
  downloadReceiptDataUrl,
  processReceiptFile,
  isSafeReceiptDataUrl,
  createSafePdfBlobUrl,
} from '../../utils/receiptUtils';
import { buildAdminReceiptLink } from '../../utils/tournamentUtils';
import { copyTextSafely } from '../../utils/paymentConfig';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  X,
  Download,
  Copy,
  Check,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  FileText,
  ArrowRight,
} from 'lucide-react';

interface ReceiptViewerModalProps {
  reciboId: string;
  participant?: Participant | null;
  pendingReceiptsCount?: number;
  onClose: () => void;
  onTogglePayment?: (participant: Participant) => Promise<void>;
  onApproveAndNext?: (participant: Participant) => Promise<void>;
  onReceiptUpdated?: () => void;
}

const ZOOM_STEPS = [100, 135, 175] as const;

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  reciboId,
  participant,
  pendingReceiptsCount = 0,
  onClose,
  onTogglePayment,
  onApproveAndNext,
  onReceiptUpdated,
}) => {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [uploadingReplacement, setUploadingReplacement] = useState(false);

  const [prevReciboId, setPrevReciboId] = useState(reciboId);
  if (reciboId !== prevReciboId) {
    setPrevReciboId(reciboId);
    setZoomIndex(0);
    setRotation(0);
    setReceipt(null);
    setError(null);
    setLoading(true);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(dialogRef, onClose, true);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const fetchValidatedReceipt = useCallback(async (id: string) => {
    const data = await getReceiptById(id);
    if (!data) {
      return {
        receipt: null,
        error: 'No se encontró el archivo del comprobante en la bóveda privada.',
      };
    }
    if (!isSafeReceiptDataUrl(data.imageDataUrl, data.mimeType)) {
      return {
        receipt: null,
        error: 'El formato del comprobante almacenado no cumple los requisitos de seguridad.',
      };
    }
    return { receipt: data, error: null };
  }, []);

  const loadReceipt = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const result = await fetchValidatedReceipt(reciboId);
      setReceipt(result.receipt);
      setError(result.error);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el comprobante en este momento.'
      );
    } finally {
      setLoading(false);
    }
  }, [fetchValidatedReceipt, reciboId]);

  useEffect(() => {
    let cancelled = false;
    fetchValidatedReceipt(reciboId)
      .then((result) => {
        if (cancelled) return;
        setReceipt(result.receipt);
        setError(result.error);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el comprobante en este momento.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchValidatedReceipt, reciboId]);

  const pdfBlobUrl = useMemo(() => {
    if (
      receipt?.mimeType === 'application/pdf' &&
      isSafeReceiptDataUrl(receipt.imageDataUrl, 'application/pdf')
    ) {
      return createSafePdfBlobUrl(receipt.imageDataUrl);
    }
    return null;
  }, [receipt]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  const adminLink = buildAdminReceiptLink(
    reciboId,
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  const handleCopyLink = async () => {
    const ok = await copyTextSafely(adminLink);
    if (ok) {
      setCopiedLink(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const handleTogglePaymentClick = async () => {
    if (!participant || !onTogglePayment) return;
    setUpdatingPayment(true);
    try {
      await onTogglePayment(participant);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleApproveAndNextClick = async () => {
    if (!participant || !onApproveAndNext) return;
    setUpdatingPayment(true);
    try {
      await onApproveAndNext(participant);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleReplaceFile = async (file: File | undefined) => {
    if (!file || !participant) return;
    setUploadingReplacement(true);
    setError(null);
    try {
      const processed = await processReceiptFile(file);
      await attachReceiptToParticipant(participant, processed);
      await loadReceipt();
      if (onReceiptUpdated) onReceiptUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reemplazar el comprobante.');
    } finally {
      setUploadingReplacement(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isPaid = participant?.estatusPago === 'pagado';
  const hasSafeData = receipt ? isSafeReceiptDataUrl(receipt.imageDataUrl, receipt.mimeType) : false;
  const zoomPercent = ZOOM_STEPS[zoomIndex];

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-viewer-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar visor de comprobante"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-4xl bg-[#0b3320] border-2 border-amber-400/90 rounded-3xl shadow-2xl overflow-hidden text-white my-auto focus:outline-none"
      >
        {/* Top Bar */}
        <div className="bg-[#072415] px-5 py-4 border-b border-emerald-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="receipt-viewer-title" className="font-festive text-lg sm:text-xl text-yellow-300 truncate">
                Comprobante Privado · {receipt?.folio || participant?.folio || reciboId.slice(0, 8)}
              </h3>
              <p className="text-xs text-emerald-300 truncate">
                {receipt?.participantNombre || participant?.nombre || 'Bóveda Solo Administradores'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="bg-red-600/90 hover:bg-red-500 text-white p-2 rounded-full transition-colors cursor-pointer"
            aria-label="Cerrar visor de comprobante"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-3 bg-[#092b1a] border-b border-emerald-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {receipt && hasSafeData && (
              <>
                <button
                  type="button"
                  onClick={() => downloadReceiptDataUrl(receipt.imageDataUrl, receipt.fileName)}
                  className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Download size={14} aria-hidden="true" />
                  <span>Descargar</span>
                </button>

                {receipt.mimeType !== 'application/pdf' && (
                  <div className="inline-flex items-center rounded-xl border border-emerald-600 overflow-hidden bg-emerald-800">
                    <button
                      type="button"
                      disabled={zoomIndex === 0}
                      onClick={() => setZoomIndex((idx) => Math.max(0, idx - 1))}
                      className="px-2 py-1.5 hover:bg-emerald-700 disabled:opacity-40 text-white cursor-pointer"
                      aria-label="Alejar zoom"
                    >
                      <ZoomOut size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomIndex((idx) => (idx + 1) % ZOOM_STEPS.length)}
                      className="px-2.5 py-1.5 text-xs font-bold text-white border-x border-emerald-600 hover:bg-emerald-700 cursor-pointer tabular-nums"
                      aria-label={`Cambiar zoom, actual ${zoomPercent}%`}
                    >
                      {zoomPercent}%
                    </button>
                    <button
                      type="button"
                      disabled={zoomIndex === ZOOM_STEPS.length - 1}
                      onClick={() => setZoomIndex((idx) => Math.min(ZOOM_STEPS.length - 1, idx + 1))}
                      className="px-2 py-1.5 hover:bg-emerald-700 disabled:opacity-40 text-white cursor-pointer"
                      aria-label="Acercar zoom"
                    >
                      <ZoomIn size={14} />
                    </button>
                  </div>
                )}

                {receipt.mimeType !== 'application/pdf' && (
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="inline-flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-600 cursor-pointer"
                    aria-label="Rotar imagen 90 grados"
                  >
                    <RotateCw size={14} aria-hidden="true" />
                    <span>Rotar</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="inline-flex items-center gap-1.5 bg-emerald-950 hover:bg-emerald-900 text-amber-300 font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-700 cursor-pointer"
              title={adminLink}
            >
              {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedLink ? 'Link Admin Copiado' : 'Copiar Link Admin'}</span>
            </button>

            {participant && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  aria-label="Seleccionar archivo de reemplazo para el comprobante"
                  onChange={(e) => void handleReplaceFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={uploadingReplacement}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-700 cursor-pointer"
                >
                  {uploadingReplacement ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  <span>Reemplazar</span>
                </button>
              </>
            )}
          </div>

          {participant && (
            <div className="flex flex-wrap items-center gap-2">
              {!isPaid && onApproveAndNext && (
                <button
                  type="button"
                  disabled={updatingPayment}
                  onClick={() => void handleApproveAndNextClick()}
                  data-testid="approve-and-next-receipt"
                  className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 px-3.5 py-1.5 rounded-xl text-xs font-black border border-amber-300 cursor-pointer"
                >
                  {updatingPayment ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>Aprobar y siguiente</span>
                  {pendingReceiptsCount > 1 && (
                    <span className="inline-flex items-center gap-0.5 bg-emerald-950/15 px-1.5 py-0.5 rounded-full text-[10px]">
                      <ArrowRight size={10} />
                      {pendingReceiptsCount - 1}
                    </span>
                  )}
                </button>
              )}

              {onTogglePayment && (
                <button
                  type="button"
                  disabled={updatingPayment}
                  onClick={() => void handleTogglePaymentClick()}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black border transition-colors cursor-pointer ${
                    isPaid
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 hover:bg-amber-500/20 hover:text-amber-200'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                  }`}
                >
                  {updatingPayment ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isPaid ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Clock size={14} />
                  )}
                  <span>{isPaid ? 'Pago Confirmado (Revertir)' : 'Marcar Pagado'}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Receipt Body */}
        <div className="p-5 max-h-[70vh] overflow-auto bg-[#061c10] flex flex-col items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-emerald-300 py-12" role="status">
              <Loader2 size={32} className="animate-spin text-amber-400" />
              <span className="text-sm font-semibold">Cargando comprobante desde bóveda privada...</span>
            </div>
          ) : error ? (
            <div className="max-w-md text-center space-y-3 py-10" role="alert">
              <AlertCircle size={36} className="text-red-400 mx-auto" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          ) : receipt && hasSafeData ? (
            <>
              {receipt.mimeType === 'application/pdf' ? (
                <div className="w-full space-y-3">
                  {pdfBlobUrl && (
                    <iframe
                      src={pdfBlobUrl}
                      sandbox=""
                      referrerPolicy="no-referrer"
                      title={receipt.fileName}
                      className="w-full h-[55vh] rounded-xl border border-emerald-700 bg-white"
                    />
                  )}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => downloadReceiptDataUrl(receipt.imageDataUrl, receipt.fileName)}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:underline font-bold cursor-pointer"
                    >
                      <FileText size={14} />
                      <span>
                        Si tu navegador bloquea la vista previa, descarga el PDF aquí ({receipt.fileName})
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <img
                  src={receipt.imageDataUrl}
                  alt={`Comprobante de pago de ${receipt.participantNombre}`}
                  referrerPolicy="no-referrer"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    width: zoomPercent === 100 ? undefined : `${zoomPercent}%`,
                  }}
                  className={`rounded-xl border border-emerald-700/80 shadow-2xl transition-all duration-200 ${
                    zoomPercent === 100
                      ? 'max-h-[60vh] max-w-full object-contain'
                      : 'max-w-none'
                  }`}
                />
              )}

              {/* Metadata Footer */}
              <div className="mt-4 w-full bg-[#0b3320] rounded-xl p-3 border border-emerald-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-300">
                <span>
                  Archivo: <strong className="text-white font-mono">{receipt.fileName}</strong>
                </span>
                <span>
                  Peso:{' '}
                  <strong className="text-white">
                    {receipt.fileSize ? `${Math.max(1, Math.round(receipt.fileSize / 1024))} KB` : 'N/D'}
                  </strong>
                </span>
                <span>
                  Subido:{' '}
                  <strong className="text-white">
                    {receipt.uploadedAt
                      ? new Date(receipt.uploadedAt).toLocaleString('es-MX', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : 'N/D'}
                  </strong>
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
