import React, { useEffect, useState, useRef } from 'react';
import { Participant, PaymentReceipt } from '../../types/tournament';
import {
  getReceiptById,
  attachReceiptToParticipant,
} from '../../services/tournamentService';
import {
  downloadReceiptDataUrl,
  processReceiptFile,
} from '../../utils/receiptUtils';
import { buildAdminReceiptLink } from '../../utils/tournamentUtils';
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
} from 'lucide-react';

interface ReceiptViewerModalProps {
  reciboId: string;
  participant?: Participant | null;
  onClose: () => void;
  onTogglePayment?: (participant: Participant) => Promise<void>;
  onReceiptUpdated?: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  reciboId,
  participant,
  onClose,
  onTogglePayment,
  onReceiptUpdated,
}) => {
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [uploadingReplacement, setUploadingReplacement] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipt = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReceiptById(reciboId);
      if (!data) {
        setError('No se encontró el archivo del comprobante en la bóveda privada.');
      } else {
        setReceipt(data);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar el comprobante (verifica permisos de administrador).'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipt();
    setZoomed(false);
    setRotation(0);
  }, [reciboId]);

  const adminLink = buildAdminReceiptLink(
    reciboId,
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(adminLink).catch(() => {});
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
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
      setError(
        err instanceof Error ? err.message : 'No se pudo reemplazar el comprobante.'
      );
    } finally {
      setUploadingReplacement(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isPaid = participant?.estatusPago === 'pagado';

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-[#0b3320] border-2 border-amber-400/90 rounded-3xl shadow-2xl overflow-hidden text-white my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="bg-[#072415] px-5 py-4 border-b border-emerald-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-festive text-lg sm:text-xl text-yellow-300 truncate">
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
            {receipt && (
              <>
                <button
                  type="button"
                  onClick={() => downloadReceiptDataUrl(receipt.imageDataUrl, receipt.fileName)}
                  className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  <span>Descargar</span>
                </button>

                {receipt.mimeType !== 'application/pdf' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setZoomed((z) => !z)}
                      className="inline-flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-600 cursor-pointer"
                    >
                      {zoomed ? <ZoomOut size={14} /> : <ZoomIn size={14} />}
                      <span>{zoomed ? 'Ajustar' : 'Ampliar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="inline-flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-600 cursor-pointer"
                    >
                      <RotateCw size={14} />
                      <span>Rotar</span>
                    </button>
                  </>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
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
                  onChange={(e) => handleReplaceFile(e.target.files?.[0])}
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

          {participant && onTogglePayment && (
            <button
              type="button"
              disabled={updatingPayment}
              onClick={handleTogglePaymentClick}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black border transition-colors cursor-pointer ${
                isPaid
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 hover:bg-amber-500/20 hover:text-amber-200'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 border-emerald-300'
              }`}
            >
              {updatingPayment ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isPaid ? (
                <CheckCircle2 size={14} />
              ) : (
                <Clock size={14} />
              )}
              <span>{isPaid ? 'Pago Confirmado (Revertir)' : 'Aprobar y Marcar Pagado'}</span>
            </button>
          )}
        </div>

        {/* Receipt Body */}
        <div className="p-5 max-h-[70vh] overflow-auto bg-[#061c10] flex flex-col items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-emerald-300 py-12">
              <Loader2 size={32} className="animate-spin text-amber-400" />
              <span className="text-sm font-semibold">Cargando comprobante desde bóveda privada...</span>
            </div>
          ) : error ? (
            <div className="max-w-md text-center space-y-3 py-10">
              <AlertCircle size={36} className="text-red-400 mx-auto" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          ) : receipt ? (
            <>
              {receipt.mimeType === 'application/pdf' ? (
                <div className="w-full space-y-3">
                  <iframe
                    src={receipt.imageDataUrl}
                    title={receipt.fileName}
                    className="w-full h-[55vh] rounded-xl border border-emerald-700 bg-white"
                  />
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => downloadReceiptDataUrl(receipt.imageDataUrl, receipt.fileName)}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:underline font-bold"
                    >
                      <FileText size={14} />
                      <span>Si tu navegador no previsualiza el PDF, descárgalo aquí ({receipt.fileName})</span>
                    </button>
                  </div>
                </div>
              ) : (
                <img
                  src={receipt.imageDataUrl}
                  alt={`Comprobante de pago de ${receipt.participantNombre}`}
                  style={{ transform: `rotate(${rotation}deg)` }}
                  className={`rounded-xl border border-emerald-700/80 shadow-2xl transition-all duration-200 ${
                    zoomed ? 'max-w-none w-[150%] sm:w-[130%]' : 'max-h-[60vh] max-w-full object-contain'
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
