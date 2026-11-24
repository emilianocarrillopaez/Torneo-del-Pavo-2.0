import React, { useState, useRef } from 'react';
import { TournamentCategory, TournamentConfig } from '../types/tournament';
import { RegistrationSuccessModal } from './RegistrationSuccessModal';
import { PrivacyNoticeModal } from './PrivacyNoticeModal';
import { useRegistrationForm } from '../hooks/useRegistrationForm';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { isPlaceholderPaymentConfig } from '../utils/paymentConfig';
import {
  buildParticipantNames,
  computeCountdown,
  deriveAgeCutoffs,
  extractEventDateParts,
  formatWhatsAppUrl,
} from '../utils/tournamentUtils';
import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Lock,
  Star,
  Award,
  Upload,
  FileImage,
  FileText,
  Trash2,
  ShieldCheck,
  Copy,
  Check,
  CreditCard,
  UserCheck,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';

interface RegistrationFormProps {
  config: TournamentConfig;
  totalRegistered: number;
  isCountLoading?: boolean;
  preselectedCategory?: TournamentCategory | null;
  onRegistrationSuccess?: () => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  config,
  totalRegistered,
  isCountLoading = false,
  preselectedCategory,
  onRegistrationSuccess,
}) => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const reviewDialogRef = useRef<HTMLDivElement>(null);

  const paymentBlocked = isPlaceholderPaymentConfig(config);
  const eventParts = extractEventDateParts(config.fechaIso);
  const cutoffs = deriveAgeCutoffs(config.fechaIso);

  const {
    formData,
    setFormData,
    receiptFile,
    processingReceipt,
    copiedClabe,
    errors,
    isSubmitting,
    showReviewStep,
    setShowReviewStep,
    registeredParticipant,
    setRegisteredParticipant,
    waitlistFolio,
    setWaitlistFolio,
    fileInputRef,
    deadlinePassed,
    isWaitlistMode,
    isClosed,
    calculatedAge,
    isMinor,
    progressPercent,
    handleCopyClabe,
    handleReceiptSelected,
    handleRemoveReceipt,
    requestReviewStep,
    confirmAndSubmit,
  } = useRegistrationForm({
    config,
    totalRegistered,
    preselectedCategory,
    onRegistrationSuccess,
    paymentBlocked,
  });

  useFocusTrap(
    reviewDialogRef,
    () => setShowReviewStep(false),
    showReviewStep && !showPrivacyModal
  );

  const todayYmd = new Date().toISOString().slice(0, 10);
  const maxBirthYmd = todayYmd < eventParts.ymd ? todayYmd : eventParts.ymd;

  const deadlineCountdown =
    config.fechaLimiteIso && !deadlinePassed ? computeCountdown(config.fechaLimiteIso) : null;

  const whatsappContactHref = formatWhatsAppUrl(
    config.whatsappContacto,
    `Hola, quiero confirmar información de inscripción al ${config.titulo || 'Torneo del Pavo 2.0'}.`
  );

  const { privateName: fullNamePreview } = buildParticipantNames({
    paterno: formData.paterno,
    materno: formData.materno,
    nombre: formData.nombre,
  });

  return (
    <section id="registro" className="py-16 bg-[#072012] relative border-t border-emerald-800/80">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Title Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-400/30">
            <Sparkles size={14} aria-hidden="true" />
            <span>{isWaitlistMode ? 'Lista de Espera Oficial' : 'Aparta tu lugar oficial'}</span>
          </div>
          <h2 className="font-festive text-3xl sm:text-4xl md:text-5xl text-yellow-300 drop-shadow">
            {isWaitlistMode ? 'REGISTRO EN LISTA DE ESPERA' : 'FORMULARIO DE REGISTRO'}
          </h2>
          <p className="mt-2 text-emerald-200 text-xs sm:text-sm font-round">
            {isWaitlistMode
              ? 'El cupo titular está lleno. Regístrate sin pago previo y el comité te contactará por WhatsApp si se libera un lugar.'
              : 'Completa tus datos y adjunta tu recibo de pago. Todos los campos marcados con asterisco (*) son obligatorios.'}
          </p>

          {deadlineCountdown && !deadlineCountdown.isStarted && (
            <div className="mt-3 inline-flex items-center gap-2 bg-emerald-950/90 border border-emerald-700 px-3.5 py-1.5 rounded-full text-xs text-emerald-200">
              <Clock size={14} className="text-amber-300" aria-hidden="true" />
              <span>
                Cierre de inscripciones en{' '}
                <strong className="text-amber-300">
                  {deadlineCountdown.days}d {deadlineCountdown.hours}h {deadlineCountdown.minutes}m
                </strong>{' '}
                ({config.fechaLimite})
              </span>
            </div>
          )}
        </div>

        {/* Waitlist Confirmation Banner */}
        {waitlistFolio && (
          <div
            role="status"
            aria-live="polite"
            data-testid="waitlist-success-banner"
            className="mb-8 bg-emerald-950/95 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl space-y-3"
          >
            <CheckCircle2 size={38} className="text-emerald-400 mx-auto" aria-hidden="true" />
            <h3 className="font-festive text-2xl text-yellow-300">
              ¡Lugar apartado en Lista de Espera!
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200">
              Tu folio de espera es{' '}
              <strong className="font-mono text-amber-300 text-base">{waitlistFolio}</strong>. En caso de liberarse un lugar te contactaremos por WhatsApp para completar tu pago.
            </p>
            <button
              type="button"
              onClick={() => setWaitlistFolio(null)}
              className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-5 py-2.5 rounded-xl text-xs cursor-pointer"
            >
              Entendido
            </button>
          </div>
        )}

        {/* Loading / Closed / Form */}
        {isCountLoading ? (
          <div className="bg-[#0b3320] border border-emerald-700/70 rounded-3xl p-10 text-center text-emerald-200 flex flex-col items-center gap-3 shadow-2xl">
            <Loader2 size={32} className="animate-spin text-amber-400" aria-hidden="true" />
            <p className="text-sm font-semibold">
              Consultando disponibilidad de cupo en tiempo real...
            </p>
          </div>
        ) : isClosed ? (
          <div className="bg-red-950/80 border-2 border-red-500 rounded-3xl p-8 text-center text-white shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-800/80 text-white mx-auto flex items-center justify-center">
              <Lock size={32} aria-hidden="true" />
            </div>
            <h3 className="font-festive text-2xl text-red-200">Inscripciones Cerradas</h3>
            <p className="text-sm text-red-100 max-w-md mx-auto">
              {!config.inscripcionesAbiertas || deadlinePassed
                ? 'El periodo de inscripciones ha concluido o fue cerrado por el comité organizador.'
                : 'Se ha completado el cupo de participantes para esta edición.'}
            </p>
            {whatsappContactHref && (
              <a
                href={whatsappContactHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs"
              >
                <span>Consultar por WhatsApp ({config.whatsappContacto})</span>
              </a>
            )}
          </div>
        ) : (
          <form
            onSubmit={requestReviewStep}
            noValidate
            className="bg-[#0b3320] border-2 border-emerald-600/60 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6"
          >
            {/* Placeholder payment blocker (3.4) */}
            {!isWaitlistMode && paymentBlocked && (
              <div
                role="alert"
                data-testid="payment-placeholder-blocked"
                className="bg-amber-950/90 border-2 border-amber-400 text-amber-100 p-4 rounded-2xl flex items-start gap-3 text-xs sm:text-sm"
              >
                <AlertTriangle size={20} className="text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="text-amber-300 block mb-0.5">
                    Datos de pago no disponibles; contacta al organizador
                  </strong>
                  <span>
                    El comité aún no ha publicado la CLABE bancaria definitiva en la plataforma. Por seguridad, el envío en línea se habilita en cuanto el organizador configure los datos de pago reales.
                  </span>
                </div>
              </div>
            )}

            {/* Progress indicator */}
            <div className="bg-emerald-950/80 p-3.5 rounded-2xl border border-emerald-800/80">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-emerald-300">Progreso de tu registro</span>
                <span className="text-amber-300 font-mono">{progressPercent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Progreso del formulario"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                className="w-full h-2.5 bg-[#061c10] rounded-full overflow-hidden border border-emerald-800"
              >
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-300 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* General Error Banner */}
            {errors.general && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-red-950/90 border border-red-500 text-red-200 p-4 rounded-2xl flex items-start gap-3 text-xs sm:text-sm"
              >
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Honeypot field */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>

            {/* Field 1: Nombre Completo */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <span className="block text-sm sm:text-base font-bold text-white mb-1">
                NOMBRE COMPLETO DEL PARTICIPANTE <span className="text-red-400">*</span>
              </span>
              <span className="text-xs text-emerald-300 block mb-3 font-normal">
                (Apellido paterno y nombre obligatorios; apellido materno opcional)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="reg-paterno" className="text-[11px] text-emerald-300 block mb-1">
                    Apellido Paterno *
                  </label>
                  <input
                    id="reg-paterno"
                    type="text"
                    autoComplete="family-name"
                    placeholder="Ej. García"
                    aria-invalid={Boolean(errors.nombre)}
                    aria-describedby={errors.nombre ? 'error-nombre' : undefined}
                    value={formData.paterno}
                    onChange={(e) => setFormData({ ...formData, paterno: e.target.value })}
                    className="w-full bg-emerald-950/80 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label htmlFor="reg-materno" className="text-[11px] text-emerald-300 block mb-1">
                    Apellido Materno
                  </label>
                  <input
                    id="reg-materno"
                    type="text"
                    autoComplete="additional-name"
                    placeholder="Ej. López"
                    aria-invalid={Boolean(errors.nombre)}
                    aria-describedby={errors.nombre ? 'error-nombre' : undefined}
                    value={formData.materno}
                    onChange={(e) => setFormData({ ...formData, materno: e.target.value })}
                    className="w-full bg-emerald-950/80 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label htmlFor="reg-nombre" className="text-[11px] text-emerald-300 block mb-1">
                    Nombre(s) *
                  </label>
                  <input
                    id="reg-nombre"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Ej. Sofía"
                    aria-invalid={Boolean(errors.nombre)}
                    aria-describedby={errors.nombre ? 'error-nombre' : undefined}
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full bg-emerald-950/80 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {errors.nombre && (
                <div
                  id="error-nombre"
                  role="alert"
                  className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{errors.nombre}</span>
                </div>
              )}
            </div>

            {/* Field 2: Fecha de Nacimiento */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <div className="flex justify-between items-start mb-1 gap-2">
                <label
                  htmlFor="reg-bday"
                  className="block text-sm sm:text-base font-bold text-white"
                >
                  FECHA DE NACIMIENTO <span className="text-red-400">*</span>
                </label>
                {calculatedAge !== null && (
                  <span className="text-xs bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-400/30">
                    Edad al {cutoffs.eventDateSpanish}: {calculatedAge} años
                  </span>
                )}
              </div>
              <span className="text-xs text-emerald-300 block mb-3 font-normal">
                Indispensable para validar categoría Juvenil (18 años o menos al {cutoffs.eventDateSpanish})
              </span>

              <input
                id="reg-bday"
                type="date"
                autoComplete="bday"
                min="1920-01-01"
                max={maxBirthYmd}
                aria-invalid={Boolean(errors.fechaNacimiento)}
                aria-describedby={errors.fechaNacimiento ? 'error-bday' : undefined}
                value={formData.fechaNacimiento}
                onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                className="w-full sm:w-64 bg-emerald-950/80 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              />

              {errors.fechaNacimiento && (
                <div
                  id="error-bday"
                  role="alert"
                  className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{errors.fechaNacimiento}</span>
                </div>
              )}
            </div>

            {/* Minor Parent/Guardian Consent */}
            {isMinor && (
              <div
                data-testid="minor-tutor-consent"
                className="bg-amber-950/35 p-5 rounded-2xl border-2 border-amber-400/60 space-y-3"
              >
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <UserCheck size={18} aria-hidden="true" />
                  <span>
                    Autorización de Madre, Padre o Tutor (Menor de 18 años){' '}
                    <span className="text-red-400">*</span>
                  </span>
                </div>
                <p className="text-xs text-emerald-200">
                  Al ser participante menor de edad, se requiere el nombre completo y autorización de su madre, padre o tutor legal para participar y tratar sus datos conforme al Aviso de Privacidad.
                </p>
                <label htmlFor="reg-tutor-name" className="sr-only">
                  Nombre completo de la madre, padre o tutor
                </label>
                <input
                  id="reg-tutor-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Nombre completo de la madre, padre o tutor"
                  aria-invalid={Boolean(errors.tutor)}
                  aria-describedby={errors.tutor ? 'error-tutor' : undefined}
                  value={formData.nombreTutor}
                  onChange={(e) => setFormData({ ...formData, nombreTutor: e.target.value })}
                  className="w-full bg-emerald-950/90 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                />
                <label className="flex items-start gap-2.5 text-xs text-emerald-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.consentimientoTutor}
                    aria-invalid={Boolean(errors.tutor)}
                    aria-describedby={errors.tutor ? 'error-tutor' : undefined}
                    onChange={(e) =>
                      setFormData({ ...formData, consentimientoTutor: e.target.checked })
                    }
                    className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-emerald-950 border-emerald-600 shrink-0"
                  />
                  <span>
                    Confirmo que soy madre, padre o tutor legal del participante menor de edad y autorizo su participación y el tratamiento de sus datos para el torneo.
                  </span>
                </label>
                {errors.tutor && (
                  <div
                    id="error-tutor"
                    role="alert"
                    className="flex items-center gap-1.5 text-red-400 text-xs font-semibold"
                  >
                    <AlertCircle size={14} aria-hidden="true" />
                    <span>{errors.tutor}</span>
                  </div>
                )}
              </div>
            )}

            {/* Field 3: WhatsApp */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <label
                htmlFor="reg-whatsapp"
                className="block text-sm sm:text-base font-bold text-white mb-1"
              >
                NÚMERO DE WHATSAPP <span className="text-red-400">*</span>
              </label>
              <span className="text-xs text-emerald-300 block mb-3 font-normal">
                10 dígitos para avisos de rondas y validación de tu recibo
              </span>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                  +52
                </span>
                <input
                  id="reg-whatsapp"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={14}
                  placeholder="Ej. 618 123 4567"
                  aria-invalid={Boolean(errors.whatsapp)}
                  aria-describedby={errors.whatsapp ? 'error-whatsapp' : undefined}
                  value={formData.whatsapp}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, whatsapp: digits });
                  }}
                  className="w-full bg-emerald-950/80 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              {errors.whatsapp && (
                <div
                  id="error-whatsapp"
                  role="alert"
                  className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{errors.whatsapp}</span>
                </div>
              )}
            </div>

            {/* Field 4: Correo Electrónico */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <label
                htmlFor="reg-email"
                className="block text-sm sm:text-base font-bold text-white mb-1"
              >
                CORREO ELECTRÓNICO <span className="text-red-400">*</span>
              </label>
              <span className="text-xs text-emerald-300 block mb-3 font-normal">
                Recibirás avisos y aclaraciones sobre tu inscripción
              </span>

              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="tu_correo@ejemplo.com"
                aria-invalid={Boolean(errors.correo)}
                aria-describedby={errors.correo ? 'error-correo' : undefined}
                value={formData.correo}
                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                className="w-full bg-emerald-950/80 text-white placeholder-emerald-500 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              />

              {errors.correo && (
                <div
                  id="error-correo"
                  role="alert"
                  className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{errors.correo}</span>
                </div>
              )}
            </div>

            {/* Field 5: Categoría */}
            <fieldset className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <legend className="text-sm sm:text-base font-bold text-white mb-1">
                CATEGORÍA DE JUEGO <span className="text-red-400">*</span>
              </legend>
              <span className="text-xs text-emerald-300 block mb-4 font-normal">
                Selecciona tu categoría según tu edad y nivel
              </span>

              <div
                className="space-y-3"
                role="radiogroup"
                aria-label="Categoría de juego"
                aria-invalid={Boolean(errors.categoria)}
                aria-describedby={errors.categoria ? 'error-categoria' : undefined}
              >
                <div
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                    formData.categoria === 'Juvenil'
                      ? 'bg-amber-400/20 border-amber-400 text-white shadow-md'
                      : 'bg-emerald-950/60 border-emerald-800 text-emerald-200 hover:border-emerald-600'
                  }`}
                >
                  <input
                    id="reg-cat-juvenil"
                    type="radio"
                    name="categoria"
                    value="Juvenil"
                    checked={formData.categoria === 'Juvenil'}
                    onChange={() => setFormData({ ...formData, categoria: 'Juvenil' })}
                    className="mt-1 w-4 h-4 text-amber-500 border-emerald-700 focus:ring-amber-400 bg-emerald-900 cursor-pointer"
                  />
                  <label htmlFor="reg-cat-juvenil" className="flex-1 cursor-pointer">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-festive text-sm sm:text-base text-yellow-300 font-bold">
                        JUVENIL (INFANTIL-JUVENIL)
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-300">
                        18 años o menos
                      </span>
                    </span>
                    <span className="block text-xs text-emerald-300/90 mt-0.5">
                      Nacidos a partir del {cutoffs.juvenilMinBirthSpanish}. Trofeos a los primeros 3 lugares.
                    </span>
                  </label>
                </div>

                <div
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                    formData.categoria === 'Libre'
                      ? 'bg-amber-400/20 border-amber-400 text-white shadow-md'
                      : 'bg-emerald-950/60 border-emerald-800 text-emerald-200 hover:border-emerald-600'
                  }`}
                >
                  <input
                    id="reg-cat-libre"
                    type="radio"
                    name="categoria"
                    value="Libre"
                    checked={formData.categoria === 'Libre'}
                    onChange={() => setFormData({ ...formData, categoria: 'Libre' })}
                    className="mt-1 w-4 h-4 text-amber-500 border-emerald-700 focus:ring-amber-400 bg-emerald-900 cursor-pointer"
                  />
                  <label htmlFor="reg-cat-libre" className="flex-1 cursor-pointer">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-festive text-sm sm:text-base text-yellow-300 font-bold">
                        LIBRE (RANQUEADOS Y AFICIONADOS)
                      </span>
                      <span className="text-[11px] font-semibold text-amber-300">
                        Categoría Principal
                      </span>
                    </span>
                    <span className="block text-xs text-emerald-300/90 mt-0.5">
                      Una sola categoría que reúne a jugadores ranqueados y aficionados. Disputa $2,500 en efectivo al 1.er lugar y premios al podio.
                    </span>
                  </label>
                </div>
              </div>

              {errors.categoria && (
                <div
                  id="error-categoria"
                  role="alert"
                  className="flex items-start gap-1.5 text-red-400 text-xs font-semibold mt-3 p-2.5 bg-red-950/50 rounded-lg border border-red-800/80"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{errors.categoria}</span>
                </div>
              )}
            </fieldset>

            {/* Special Recognitions Checkboxes */}
            <div className="space-y-3">
              <label
                htmlFor="aficionadoCheck"
                className="bg-[#0e3b26] p-4 rounded-2xl border border-emerald-700/60 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Award size={18} className="text-amber-400 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-white block">
                      ¿Eres jugador aficionado (sin ranking oficial)?
                    </span>
                    <span className="text-[11px] text-emerald-300">
                      Participas por el Premio Especial al Mejor Aficionado de la categoría Libre
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="aficionadoCheck"
                  checked={formData.esAficionado}
                  onChange={(e) => setFormData({ ...formData, esAficionado: e.target.checked })}
                  className="w-5 h-5 rounded text-amber-500 bg-emerald-950 border-emerald-700 focus:ring-amber-400 shrink-0"
                />
              </label>

              <label
                htmlFor="femenilCheck"
                className="bg-[#0e3b26] p-4 rounded-2xl border border-emerald-700/60 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Star size={18} className="text-pink-400 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-white block">
                      ¿Participas por el Premio Especial a la Mejor Femenil?
                    </span>
                    <span className="text-[11px] text-emerald-300">
                      Reconocimiento oficial a la mejor clasificada de la categoría Libre
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="femenilCheck"
                  checked={formData.esFemenil}
                  onChange={(e) => setFormData({ ...formData, esFemenil: e.target.checked })}
                  className="w-5 h-5 rounded text-pink-500 bg-emerald-950 border-emerald-700 focus:ring-pink-400 shrink-0"
                />
              </label>
            </div>

            {/* Field 6: Mandatory Payment Receipt Upload (omitido en Lista de Espera) */}
            {!isWaitlistMode && (
              <div
                data-testid="receipt-upload-section"
                className={`bg-[#0e3b26] p-5 rounded-2xl border-2 transition-colors ${
                  errors.recibo
                    ? 'border-red-500/90'
                    : receiptFile
                    ? 'border-emerald-400/80'
                    : 'border-amber-400/60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label
                    htmlFor="reciboPagoInput"
                    className="block text-sm sm:text-base font-bold text-white"
                  >
                    COMPROBANTE / RECIBO DE PAGO (${config.costo} MXN){' '}
                    <span className="text-red-400">*</span>
                  </label>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/40">
                    Obligatorio
                  </span>
                </div>

                {/* Datos bancarios o bloqueo por placeholder */}
                {paymentBlocked ? (
                  <div className="bg-amber-950/70 border border-amber-400/60 rounded-xl p-3.5 mb-4 text-xs text-amber-200">
                    <strong>Datos de pago pendientes de configurar:</strong> contacta al comité organizador antes de realizar tu transferencia.
                  </div>
                ) : (
                  <div className="bg-emerald-950/90 border border-emerald-800 rounded-xl p-3.5 mb-4 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                      <CreditCard size={14} aria-hidden="true" />
                      <span>Datos para tu aportación (${config.costo}.00 MXN)</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-200">
                      <span>
                        Banco: <strong className="text-white">{config.banco}</strong> · Titular:{' '}
                        <strong className="text-white">{config.titular}</strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-black/35 px-3 py-2 rounded-lg border border-emerald-800/80">
                      <span className="text-emerald-300">
                        CLABE: <strong className="font-mono text-yellow-300">{config.clabe}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyClabe()}
                        aria-label="Copiar CLABE interbancaria"
                        className="inline-flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        {copiedClabe ? (
                          <>
                            <Check size={12} className="text-emerald-300" aria-hidden="true" />
                            <span>CLABE copiada</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} aria-hidden="true" />
                            <span>Copiar CLABE</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-emerald-300/90">
                      También puedes subir foto de tu recibo de pago en efectivo hecho en{' '}
                      <strong>Tatuajes Durango</strong>.
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  id="reciboPagoInput"
                  data-testid="receipt-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  aria-invalid={Boolean(errors.recibo)}
                  aria-describedby={errors.recibo ? 'error-recibo' : undefined}
                  onChange={(e) => void handleReceiptSelected(e.target.files?.[0])}
                  className="sr-only"
                />

                {processingReceipt ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="border-2 border-dashed border-amber-400/60 bg-emerald-950/60 rounded-2xl p-6 text-center flex flex-col items-center gap-2"
                  >
                    <Loader2 size={28} className="animate-spin text-amber-400" aria-hidden="true" />
                    <p className="text-xs sm:text-sm font-bold text-amber-200">
                      Validando y optimizando tu comprobante de pago...
                    </p>
                  </div>
                ) : receiptFile ? (
                  <div
                    data-testid="receipt-preview"
                    className="bg-emerald-950/90 border border-emerald-500/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4"
                  >
                    <div className="w-24 h-24 rounded-xl bg-black/50 border border-emerald-700 overflow-hidden flex items-center justify-center shrink-0">
                      {receiptFile.mimeType === 'application/pdf' ? (
                        <div className="text-center text-amber-300">
                          <FileText size={32} className="mx-auto" aria-hidden="true" />
                          <span className="text-[10px] font-bold block mt-1">PDF</span>
                        </div>
                      ) : (
                        <img
                          src={receiptFile.dataUrl}
                          alt="Vista previa de tu recibo de pago"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 mb-1">
                        <FileImage size={14} aria-hidden="true" />
                        <span>Comprobante listo para enviar</span>
                      </div>
                      <p className="text-xs sm:text-sm text-white font-semibold truncate">
                        {receiptFile.fileName}
                      </p>
                      <p className="text-[11px] text-emerald-400">
                        Tamaño optimizado: {Math.max(1, Math.round(receiptFile.fileSize / 1024))} KB
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl border border-emerald-600 transition-colors cursor-pointer"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        aria-label="Quitar comprobante de pago"
                        className="bg-red-950/80 hover:bg-red-900 text-red-300 p-2 rounded-xl border border-red-700/70 transition-colors cursor-pointer"
                        title="Quitar recibo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void handleReceiptSelected(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-emerald-600/80 hover:border-amber-400 bg-emerald-950/60 hover:bg-emerald-950/90 rounded-2xl p-6 text-center cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-400/15 text-amber-300 border border-amber-400/35 mx-auto flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <Upload size={22} aria-hidden="true" />
                    </div>
                    <p className="text-sm font-bold text-white">
                      Haz clic aquí o arrastra la foto de tu recibo de pago
                    </p>
                    <p className="text-xs text-emerald-300 mt-1">
                      Formatos aceptados: JPG, PNG, WEBP o PDF (máx. 8 MB)
                    </p>
                  </button>
                )}

                <div className="mt-3 flex items-start gap-2 text-[11px] text-emerald-300/90 bg-emerald-950/60 px-3 py-2 rounded-xl border border-emerald-800/70">
                  <ShieldCheck size={15} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Almacenamiento privado:</strong> Tu recibo y su enlace directo se guardan en una bóveda segura visible <strong>únicamente para los administradores</strong> del torneo. Nunca se publica en el padrón.
                  </span>
                </div>

                {errors.recibo && (
                  <div
                    id="error-recibo"
                    role="alert"
                    data-testid="receipt-error"
                    className="flex items-start gap-1.5 text-red-400 text-xs font-semibold mt-3 p-2.5 bg-red-950/50 rounded-lg border border-red-800/80"
                  >
                    <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{errors.recibo}</span>
                  </div>
                )}
              </div>
            )}

            {/* Field 7: Aviso de Privacidad Obligatorio */}
            <div className="bg-[#0e3b26] p-4 rounded-2xl border border-emerald-700/60 space-y-2">
              <label className="flex items-start gap-3 text-xs sm:text-sm text-emerald-100 cursor-pointer">
                <input
                  type="checkbox"
                  id="aceptoAvisoCheck"
                  checked={formData.aceptoAviso}
                  aria-invalid={Boolean(errors.privacidad)}
                  aria-describedby={errors.privacidad ? 'error-privacidad' : undefined}
                  onChange={(e) => setFormData({ ...formData, aceptoAviso: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-amber-500 bg-emerald-950 border-emerald-600 shrink-0"
                />
                <span>
                  He leído y acepto el{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowPrivacyModal(true);
                    }}
                    className="text-amber-300 hover:text-yellow-200 underline font-bold cursor-pointer"
                  >
                    Aviso de Privacidad
                  </button>{' '}
                  y el uso de mis datos exclusivamente para la organización del torneo.{' '}
                  <span className="text-red-400">*</span>
                </span>
              </label>

              {errors.privacidad && (
                <div
                  id="error-privacidad"
                  role="alert"
                  className="flex items-center gap-1.5 text-red-400 text-xs font-semibold"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{errors.privacidad}</span>
                </div>
              )}
            </div>

            {/* Submit Button (abre paso de revisión final) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || processingReceipt || (!isWaitlistMode && paymentBlocked)}
                data-testid="submit-registration-btn"
                className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-50 text-emerald-950 font-festive font-black py-4 px-6 rounded-2xl text-lg sm:text-xl shadow-[0_6px_25px_rgba(250,204,21,0.4)] transition-all flex items-center justify-center gap-2 transform active:scale-98 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={22} className="animate-spin text-emerald-950" aria-hidden="true" />
                    <span>Guardando inscripción...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {isWaitlistMode
                        ? 'Revisar y Entrar a Lista de Espera'
                        : 'Revisar Datos y Enviar Registro'}
                    </span>
                    <span aria-hidden="true">♟️</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-emerald-400/80 mt-3">
                Borrador guardado temporalmente en esta pestaña. Tus datos de contacto nunca se publican en el padrón.
              </p>
            </div>
          </form>
        )}
      </div>

      {/* Review & Confirm Modal */}
      {showReviewStep && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar revisión de registro"
            onClick={() => !isSubmitting && setShowReviewStep(false)}
            className="fixed inset-0 bg-transparent cursor-default"
          />
          <div
            ref={reviewDialogRef}
            tabIndex={-1}
            className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl text-white space-y-4"
          >
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <h3 id="review-modal-title" className="font-festive text-xl text-yellow-300">
                {isWaitlistMode ? 'Confirmar Lista de Espera' : 'Confirma tu Inscripción'}
              </h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowReviewStep(false)}
                aria-label="Cerrar revisión de registro"
                className="text-emerald-300 hover:text-white p-1.5 rounded-full hover:bg-emerald-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#0e3b26] rounded-2xl p-4 border border-emerald-700/70 text-xs sm:text-sm space-y-2">
              <div className="flex justify-between gap-2 border-b border-emerald-800/70 pb-1.5">
                <span className="text-emerald-300">Participante:</span>
                <strong className="text-white text-right">{fullNamePreview}</strong>
              </div>
              <div className="flex justify-between gap-2 border-b border-emerald-800/70 pb-1.5">
                <span className="text-emerald-300">Categoría:</span>
                <strong className="text-amber-300">{formData.categoria}</strong>
              </div>
              <div className="flex justify-between gap-2 border-b border-emerald-800/70 pb-1.5">
                <span className="text-emerald-300">Fecha nac.:</span>
                <strong className="text-white font-mono">{formData.fechaNacimiento}</strong>
              </div>
              <div className="flex justify-between gap-2 border-b border-emerald-800/70 pb-1.5">
                <span className="text-emerald-300">WhatsApp:</span>
                <strong className="text-white font-mono">{formData.whatsapp}</strong>
              </div>
              <div className="flex justify-between gap-2 border-b border-emerald-800/70 pb-1.5">
                <span className="text-emerald-300">Correo:</span>
                <strong className="text-white truncate max-w-[230px]">
                  {formData.correo.trim().toLowerCase()}
                </strong>
              </div>
              {isMinor && (
                <div className="flex justify-between gap-2 border-b border-emerald-800/70 pb-1.5">
                  <span className="text-emerald-300">Tutor legal:</span>
                  <strong className="text-amber-200 text-right">{formData.nombreTutor}</strong>
                </div>
              )}
              {!isWaitlistMode && receiptFile && (
                <div className="flex justify-between gap-2 pt-0.5">
                  <span className="text-emerald-300">Comprobante:</span>
                  <strong className="text-emerald-300 truncate max-w-[220px]">
                    {receiptFile.fileName}
                  </strong>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowReviewStep(false)}
                className="flex-1 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm cursor-pointer"
              >
                Corregir datos
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void confirmAndSubmit()}
                data-testid="confirm-registration-btn"
                className="flex-1 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-emerald-950 font-black py-3 px-4 rounded-xl text-xs sm:text-sm shadow-lg inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <span>
                    {isWaitlistMode ? 'Confirmar Lista de Espera' : 'Confirmar y Enviar'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <PrivacyNoticeModal config={config} onClose={() => setShowPrivacyModal(false)} />
      )}

      {registeredParticipant && (
        <RegistrationSuccessModal
          participant={registeredParticipant}
          config={config}
          onClose={() => setRegisteredParticipant(null)}
        />
      )}
    </section>
  );
};
