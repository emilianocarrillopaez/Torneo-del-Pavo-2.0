import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  X,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Participant, TournamentConfig } from '../types/tournament';
import { formatWhatsAppUrl } from '../utils/tournamentUtils';
import { copyTextSafely, isPlaceholderPaymentConfig } from '../utils/paymentConfig';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface RegistrationSuccessModalProps {
  participant: Participant;
  config: TournamentConfig;
  onClose: () => void;
}

export const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({
  participant,
  config,
  onClose,
}) => {
  const [copiedClabe, setCopiedClabe] = useState(false);
  const [copiedFolio, setCopiedFolio] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(dialogRef, onClose);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#facc15', '#ef4444', '#10b981', '#3b82f6'],
      });
    }
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopyClabe = async () => {
    const ok = await copyTextSafely(config.clabe);
    if (!ok) return;
    setCopiedClabe(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedClabe(false), 2500);
  };

  const handleCopyFolio = async () => {
    const ok = await copyTextSafely(participant.folio || '');
    if (!ok) return;
    setCopiedFolio(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedFolio(false), 2500);
  };

  const isPlaceholder = isPlaceholderPaymentConfig(config);
  const whatsappMessage = [
    `Hola! Me acabo de registrar al ${config.titulo || 'Torneo del Pavo 2.0'}.`,
    `*Folio:* ${participant.folio}`,
    `*Nombre:* ${participant.nombre}`,
    `*Categoría:* ${participant.categoria}`,
    `Ya subí mi comprobante de pago de $${config.costo} MXN en la plataforma para su validación.`,
  ].join('\n');
  const safeWhatsappHref = formatWhatsAppUrl(config.whatsappContacto, whatsappMessage);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar resumen de registro"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl my-8 text-white"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar resumen de registro"
          className="absolute top-4 right-4 text-emerald-400 hover:text-white p-2 rounded-full hover:bg-emerald-800 transition-colors cursor-pointer"
        >
          <X size={22} />
        </button>

        {/* Header Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-amber-400 border-2 border-amber-400/60 mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 size={36} />
          </div>
          <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">
            ¡Registro y Comprobante Recibidos!
          </span>
          <h3
            id="success-modal-title"
            className="font-festive text-2xl sm:text-3xl text-yellow-300 uppercase"
          >
            ¡BIENVENIDO AL {config.titulo || 'TORNEO DEL PAVO 2.0'}!
          </h3>
          <p className="text-emerald-200 text-xs sm:text-sm mt-1">
            Tu lugar ha sido registrado y tu recibo de pago fue enviado de forma privada al comité para su validación.
          </p>
        </div>

        {/* Folio Highlight con botón de copia */}
        <div className="bg-emerald-950/90 rounded-2xl p-4 border border-emerald-700/80 text-center mb-5 space-y-2">
          <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider block">
            Tu Folio de Registro
          </span>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-2xl sm:text-3xl font-black text-amber-300 tracking-widest">
              {participant.folio}
            </span>
            <button
              type="button"
              onClick={handleCopyFolio}
              aria-label="Copiar folio de registro"
              className="inline-flex items-center gap-1 bg-emerald-900 hover:bg-emerald-800 text-amber-200 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-700 cursor-pointer"
            >
              {copiedFolio ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copiedFolio ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <span className="text-[11px] text-emerald-300 block">
            Guarda este número o toma captura de pantalla para cualquier aclaración el día del evento.
          </span>
        </div>

        {/* Receipt Stored Confirmation */}
        {participant.tieneRecibo && (
          <div className="bg-emerald-500/15 border border-emerald-400/40 rounded-2xl p-3.5 mb-5 flex items-start gap-2.5 text-xs text-emerald-100">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-emerald-300 block">Comprobante resguardado con éxito</strong>
              <span>
                Archivo:{' '}
                <span className="font-mono text-white">
                  {participant.reciboNombreArchivo || 'recibo.jpg'}
                </span>
                . Solo el administrador puede visualizarlo para confirmar tu pago.
              </span>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-[#0e3b26] rounded-2xl p-4 border border-emerald-700/60 text-xs sm:text-sm space-y-2 mb-5">
          <div className="flex justify-between py-1 border-b border-emerald-800/80 gap-2">
            <span className="text-emerald-300">Participante:</span>
            <span className="font-bold text-white text-right">{participant.nombre}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-emerald-800/80 gap-2">
            <span className="text-emerald-300">Categoría:</span>
            <span className="font-bold text-amber-300 text-right">
              {participant.categoria === 'Libre'
                ? 'Libre (Ranqueados y Aficionados)'
                : participant.categoria}
            </span>
          </div>
          {(participant.esAficionado || participant.esFemenil) && (
            <div className="flex justify-between py-1 border-b border-emerald-800/80 gap-2">
              <span className="text-emerald-300">Distinciones:</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {participant.esAficionado && (
                  <span className="bg-amber-400/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-400/30">
                    Premio Mejor Aficionado
                  </span>
                )}
                {participant.esFemenil && (
                  <span className="bg-pink-500/20 text-pink-300 text-[10px] font-bold px-2 py-0.5 rounded border border-pink-500/30">
                    Premio Mejor Femenil
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-emerald-800/80 gap-2">
            <span className="text-emerald-300">WhatsApp:</span>
            <span className="font-mono text-white">{participant.whatsapp}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-emerald-800/80 gap-2">
            <span className="text-emerald-300">Correo:</span>
            <span className="text-white truncate max-w-[240px]">{participant.correo}</span>
          </div>
          <div className="flex justify-between py-1 font-bold">
            <span className="text-emerald-200">Cuota de recuperación:</span>
            <span className="text-amber-300 font-festive text-base">${config.costo} MXN</span>
          </div>
        </div>

        {/* Bank Reference */}
        {!isPlaceholder && (
          <div className="bg-emerald-950/80 rounded-2xl p-3.5 border border-emerald-700 mb-6 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-emerald-300">
                Cuenta {config.banco} · {config.titular}
              </span>
              <button
                type="button"
                onClick={handleCopyClabe}
                className="inline-flex items-center gap-1 text-amber-300 hover:text-white font-bold cursor-pointer"
              >
                {copiedClabe ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedClabe ? 'CLABE copiada' : config.clabe}</span>
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {safeWhatsappHref && (
            <a
              href={safeWhatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm shadow-lg text-center flex items-center justify-center gap-2 transition-all"
            >
              <span>Avisar por WhatsApp</span>
              <ExternalLink size={15} />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Cerrar resumen
          </button>
        </div>
      </div>
    </div>
  );
};
