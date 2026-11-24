import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  ExternalLink,
  Copy,
  Check,
  Info,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { TournamentConfig } from '../types/tournament';
import { safeHttpUrl, formatWhatsAppUrl } from '../utils/tournamentUtils';
import { copyTextSafely, isPlaceholderPaymentConfig } from '../utils/paymentConfig';

interface InfoSectionProps {
  config: TournamentConfig;
  totalRegistered: number;
  isCountLoading?: boolean;
}

export const InfoSection: React.FC<InfoSectionProps> = ({
  config,
  totalRegistered,
  isCountLoading = false,
}) => {
  const [copiedClabe, setCopiedClabe] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const placesLeft = Math.max(0, config.cupoMaximo - totalRegistered);
  const safeMapUrl = safeHttpUrl(config.mapaUrl) || 'https://maps.app.goo.gl/zk8y6hJt8R4jpUQZ8';
  const paymentBlocked = isPlaceholderPaymentConfig(config);
  const safeWhatsappHref = formatWhatsAppUrl(
    config.whatsappContacto,
    `Hola! Me registré al ${config.titulo || 'Torneo del Pavo 2.0'} y quiero enviar mi comprobante de pago de $${config.costo} MXN.`
  );

  const handleCopyClabe = async () => {
    if (paymentBlocked) return;
    const ok = await copyTextSafely(config.clabe);
    if (!ok) return;
    setCopiedClabe(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedClabe(false), 2500);
  };

  return (
    <section id="info" className="py-16 bg-[#082415] relative border-t border-emerald-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-amber-400 font-festive text-sm uppercase tracking-widest block mb-1">
            Convocatoria 2.ª Edición
          </span>
          <h2 className="font-festive text-3xl sm:text-4xl md:text-5xl text-yellow-300 drop-shadow">
            INFORMACIÓN GENERAL DEL TORNEO
          </h2>
          <div className="w-24 h-1 bg-amber-400 mx-auto mt-3 rounded-full" />
          <p className="mt-3 text-emerald-200 text-sm sm:text-base font-round">
            El Club de Ajedrez Don Gonzalo invita cordialmente a todos los entusiastas del ajedrez a participar en el {config.titulo || 'Torneo del Pavo 2.0'}.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Card 1: Lugar */}
          <div className="bg-[#0c3924] rounded-2xl p-6 border border-emerald-600/40 shadow-xl flex flex-col justify-between hover:border-amber-400/60 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-800/80 text-amber-300 flex items-center justify-center mb-4 shadow">
                <MapPin size={26} aria-hidden="true" />
              </div>
              <h3 className="font-festive text-xl text-yellow-300 mb-2">Sede Oficial</h3>
              <p className="text-white font-semibold text-sm sm:text-base mb-1">{config.lugar}</p>
              <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed mb-4">
                {config.referencia}
              </p>
            </div>
            <a
              href={safeMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 bg-emerald-900/80 hover:bg-emerald-800 px-3 py-2 rounded-lg border border-emerald-600/50 transition-colors w-fit"
            >
              <span>Ubicación en Google Maps</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>

          {/* Card 2: Fecha & Horario */}
          <div className="bg-[#0c3924] rounded-2xl p-6 border border-emerald-600/40 shadow-xl flex flex-col justify-between hover:border-amber-400/60 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-800/80 text-amber-300 flex items-center justify-center mb-4 shadow">
                <Calendar size={26} aria-hidden="true" />
              </div>
              <h3 className="font-festive text-xl text-yellow-300 mb-2">Fecha & Hora</h3>
              <p className="text-white font-semibold text-base mb-1">{config.fecha}</p>
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-sm mb-2">
                <Clock size={16} className="text-amber-400" aria-hidden="true" />
                <span>{config.hora}</span>
              </div>
              <p className="text-emerald-300/80 text-xs leading-relaxed">
                Confirmación de asistencia a partir de las 16:00 hrs. Ronda 1 arranca en punto.
              </p>
            </div>
            <div className="text-xs text-amber-300 font-semibold mt-4">
              Tolerancia: 5 minutos por ronda
            </div>
          </div>

          {/* Card 3: Cuota de Recuperación */}
          <div className="bg-[#0c3924] rounded-2xl p-6 border border-emerald-600/40 shadow-xl flex flex-col justify-between hover:border-amber-400/60 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-800/80 text-amber-300 flex items-center justify-center mb-4 shadow">
                <DollarSign size={26} aria-hidden="true" />
              </div>
              <h3 className="font-festive text-xl text-yellow-300 mb-2">Inscripción</h3>
              <div className="text-3xl font-festive text-amber-300 font-black mb-1">
                ${config.costo} <span className="text-sm font-normal text-emerald-200">MXN</span>
              </div>
              <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed mb-2">
                Aportación por concepto de recuperación para la organización, premiación y logística del evento.
              </p>
            </div>
            <div className="text-xs text-emerald-300 bg-emerald-950/60 p-2 rounded-lg border border-emerald-800">
              Pago presencial o SPEI
            </div>
          </div>

          {/* Card 4: Premios Destacados */}
          <div className="bg-[#0c3924] rounded-2xl p-6 border border-emerald-600/40 shadow-xl flex flex-col justify-between hover:border-amber-400/60 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center mb-4 shadow">
                <Award size={26} aria-hidden="true" />
              </div>
              <h3 className="font-festive text-xl text-yellow-300 mb-2">Premiación</h3>
              <div className="text-2xl font-festive text-yellow-300 mb-1">+ $10,000 MXN</div>
              <p className="text-emerald-200 text-xs sm:text-sm leading-relaxed mb-2">
                Bolsa en premios y certificados de regalo, más{' '}
                <strong className="text-white">$2,500 en efectivo</strong> al 1.er lugar.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-between text-xs">
              <span className="text-emerald-200 font-medium">Cupo:</span>
              <span className="text-amber-300 font-festive text-sm font-bold">
                {isCountLoading
                  ? 'Consultando...'
                  : placesLeft > 0
                  ? `${placesLeft} lugares disp.`
                  : 'Cupo lleno'}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Payment Instructions Box */}
        <div className="bg-[#0b3320] rounded-3xl p-6 sm:p-8 border-2 border-amber-400/50 shadow-2xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-3 py-1 rounded-full border border-amber-400/30">
                <Info size={14} aria-hidden="true" />
                <span>¿Cómo realizar tu aportación?</span>
              </div>
              <h3 className="font-festive text-2xl sm:text-3xl text-white">
                Opciones para pagar tu inscripción (${config.costo}.00 MXN)
              </h3>
              <p className="text-emerald-200 text-sm sm:text-base leading-relaxed">
                {config.indicacionesPago}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm">
                <div className="bg-emerald-950/70 p-3 rounded-xl border border-emerald-800">
                  <span className="font-bold text-amber-300 block mb-0.5">
                    Opción 1: En Efectivo (Presencial)
                  </span>
                  <span className="text-emerald-200">
                    Directo en el local de <strong className="text-white">Tatuajes Durango</strong>{' '}
                    (Corredor Constitución, entre Coronado y Aquiles Serdán).
                  </span>
                </div>
                <div className="bg-emerald-950/70 p-3 rounded-xl border border-emerald-800">
                  <span className="font-bold text-amber-300 block mb-0.5">
                    Opción 2: Transferencia SPEI
                  </span>
                  <span className="text-emerald-200">
                    {paymentBlocked ? (
                      'Los datos bancarios oficiales se confirmarán directamente con el organizador.'
                    ) : (
                      <>
                        A la cuenta oficial {config.banco} a nombre de{' '}
                        <strong className="text-white">{config.titular}</strong>. Sube tu comprobante en el formulario.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank Data Card — nunca mostrar cuenta de ejemplo */}
            <div className="w-full lg:w-80 bg-emerald-950/90 p-5 rounded-2xl border border-emerald-700 shadow-xl shrink-0 space-y-3">
              {paymentBlocked ? (
                <div
                  data-testid="info-payment-pending"
                  className="space-y-2.5 text-xs text-amber-100"
                >
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <AlertTriangle size={16} aria-hidden="true" />
                    <span>Datos bancarios por confirmar</span>
                  </div>
                  <p className="leading-relaxed text-emerald-200">
                    Datos de pago no disponibles en línea todavía; contacta al comité organizador o acude presencialmente a Tatuajes Durango.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                      Datos Bancarios
                    </span>
                    <span className="text-xs font-bold text-amber-300">{config.banco}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-emerald-400 block font-medium">
                      A nombre de (Titular)
                    </span>
                    <span className="text-sm font-bold text-white block">{config.titular}</span>
                  </div>

                  <div>
                    <span className="text-[11px] text-emerald-400 block font-medium">
                      CLABE Interbancaria
                    </span>
                    <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-emerald-800/80 mt-1">
                      <span className="font-mono text-xs sm:text-sm text-yellow-300 font-bold tracking-wider">
                        {config.clabe}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyClabe()}
                        aria-label="Copiar CLABE interbancaria"
                        className="p-1.5 hover:bg-emerald-800 rounded text-emerald-300 hover:text-white transition-colors cursor-pointer"
                        title="Copiar CLABE"
                      >
                        {copiedClabe ? (
                          <Check size={16} className="text-green-400" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                    {copiedClabe && (
                      <span
                        role="status"
                        aria-live="polite"
                        className="text-[11px] text-emerald-400 font-semibold block mt-1"
                      >
                        ¡CLABE copiada al portapapeles!
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="pt-1">
                {safeWhatsappHref && !paymentBlocked ? (
                  <a
                    href={safeWhatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow"
                  >
                    <span>WhatsApp: {config.whatsappContacto}</span>
                  </a>
                ) : (
                  <div className="w-full text-center bg-emerald-900/70 text-emerald-300 font-bold py-2.5 px-3 rounded-xl text-xs border border-emerald-800">
                    Contacto WhatsApp por confirmar
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
