import React, { useState, useRef } from 'react';
import { Participant, TournamentCategory, TournamentConfig } from '../types/tournament';
import { registerParticipant, checkDuplicateRegistration } from '../services/tournamentService';
import { RegistrationSuccessModal } from './RegistrationSuccessModal';
import {
  calculateAgeAtTournament,
  validateRegistrationInput,
  RegistrationValidationErrors,
} from '../utils/tournamentUtils';
import { processReceiptFile, ProcessedReceiptFile } from '../utils/receiptUtils';
import {
  AlertCircle,
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
} from 'lucide-react';

interface RegistrationFormProps {
  config: TournamentConfig;
  totalRegistered: number;
  preselectedCategory?: TournamentCategory | null;
  onRegistrationSuccess?: () => void;
}

interface FormState {
  paterno: string;
  materno: string;
  nombre: string;
  fechaNacimiento: string;
  whatsapp: string;
  correo: string;
  categoria: TournamentCategory | '';
  esFemenil: boolean;
  esAficionado: boolean;
  website: string; // Honeypot
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  config,
  totalRegistered,
  preselectedCategory,
  onRegistrationSuccess,
}) => {
  const [formData, setFormData] = useState<FormState>({
    paterno: '',
    materno: '',
    nombre: '',
    fechaNacimiento: '',
    whatsapp: '',
    correo: '',
    categoria: preselectedCategory || '',
    esFemenil: false,
    esAficionado: false,
    website: '',
  });

  const [receiptFile, setReceiptFile] = useState<ProcessedReceiptFile | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [copiedClabe, setCopiedClabe] = useState(false);
  const [errors, setErrors] = useState<RegistrationValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredParticipant, setRegisteredParticipant] = useState<Participant | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (preselectedCategory) {
      setFormData((prev) => ({ ...prev, categoria: preselectedCategory }));
    }
  }, [preselectedCategory]);

  const placesLeft = Math.max(0, config.cupoMaximo - totalRegistered);
  const isClosed = !config.inscripcionesAbiertas || placesLeft <= 0;

  const handleCopyClabe = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(config.clabe).catch(() => {});
    }
    setCopiedClabe(true);
    setTimeout(() => setCopiedClabe(false), 2200);
  };

  const handleReceiptSelected = async (file: File | null | undefined) => {
    if (!file) return;
    setProcessingReceipt(true);
    setErrors((prev) => ({ ...prev, recibo: undefined }));
    try {
      const processed = await processReceiptFile(file);
      setReceiptFile(processed);
    } catch (err) {
      setReceiptFile(null);
      setErrors((prev) => ({
        ...prev,
        recibo:
          err instanceof Error
            ? err.message
            : 'No se pudo procesar el comprobante. Sube una imagen JPG, PNG o PDF.',
      }));
    } finally {
      setProcessingReceipt(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const newErrors = validateRegistrationInput({
      paterno: formData.paterno,
      materno: formData.materno,
      nombre: formData.nombre,
      fechaNacimiento: formData.fechaNacimiento,
      whatsapp: formData.whatsapp,
      correo: formData.correo,
      categoria: formData.categoria,
      hasReceipt: Boolean(receiptFile),
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isClosed) {
      setErrors({ general: 'Las inscripciones están actualmente cerradas o el cupo se ha agotado.' });
      return;
    }

    if (formData.website) {
      console.warn('Bot submission blocked via honeypot');
      return;
    }

    if (!validate() || !receiptFile) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const fullName = `${formData.paterno.trim()} ${formData.materno.trim()} ${formData.nombre.trim()}`.replace(
        /\s+/g,
        ' '
      );
      const cleanWhatsapp = formData.whatsapp.replace(/\D/g, '');

      // Check duplicates
      const dupCheck = await checkDuplicateRegistration(formData.correo, cleanWhatsapp);
      if (dupCheck.isDuplicate) {
        setErrors({ general: dupCheck.message || 'Ya existe un registro con este correo o WhatsApp.' });
        setIsSubmitting(false);
        return;
      }

      const res = await registerParticipant(
        {
          nombre: fullName,
          fechaNacimiento: formData.fechaNacimiento,
          whatsapp: cleanWhatsapp,
          correo: formData.correo.trim().toLowerCase(),
          categoria: formData.categoria as TournamentCategory,
          esFemenil: formData.esFemenil,
          esAficionado: formData.categoria === 'Libre' ? formData.esAficionado : false,
        },
        receiptFile
      );

      const fullParticipant: Participant = {
        id: res.id,
        folio: res.folio,
        nombre: fullName,
        fechaNacimiento: formData.fechaNacimiento,
        whatsapp: cleanWhatsapp,
        correo: formData.correo.trim().toLowerCase(),
        categoria: formData.categoria as TournamentCategory,
        esFemenil: formData.esFemenil,
        esAficionado: formData.categoria === 'Libre' ? formData.esAficionado : false,
        estatusPago: 'pendiente',
        fechaRegistro: new Date().toISOString(),
        tieneRecibo: true,
        reciboId: res.reciboId,
        reciboNombreArchivo: receiptFile.fileName,
      };

      setRegisteredParticipant(fullParticipant);
      if (onRegistrationSuccess) onRegistrationSuccess();

      // Reset form & receipt
      setFormData({
        paterno: '',
        materno: '',
        nombre: '',
        fechaNacimiento: '',
        whatsapp: '',
        correo: '',
        categoria: '',
        esFemenil: false,
        esAficionado: false,
        website: '',
      });
      setReceiptFile(null);
    } catch (err: unknown) {
      console.error('Registration error:', err);
      setErrors({
        general:
          'Hubo un error al procesar tu inscripción y guardar tu comprobante. Verifica tu conexión e intenta de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedAge = calculateAgeAtTournament(formData.fechaNacimiento);

  return (
    <section id="registro" className="py-16 bg-[#072012] relative border-t border-emerald-800/80">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Title Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-400/30">
            <Sparkles size={14} />
            <span>Aparta tu lugar oficial</span>
          </div>
          <h2 className="font-festive text-3xl sm:text-4xl md:text-5xl text-yellow-300 drop-shadow">
            FORMULARIO DE REGISTRO
          </h2>
          <p className="mt-2 text-emerald-200 text-xs sm:text-sm font-round">
            Completa tus datos y adjunta tu recibo de pago. Todos los campos marcados con asterisco (
            <span className="text-red-400">*</span>) son obligatorios.
          </p>
        </div>

        {/* Closed Banner */}
        {isClosed ? (
          <div className="bg-red-950/80 border-2 border-red-500 rounded-3xl p-8 text-center text-white shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-800/80 text-white mx-auto flex items-center justify-center">
              <Lock size={32} />
            </div>
            <h3 className="font-festive text-2xl text-red-200">Inscripciones Cerradas</h3>
            <p className="text-sm text-red-100 max-w-md mx-auto">
              {!config.inscripcionesAbiertas
                ? 'El periodo de inscripciones ha sido cerrado por el comité organizador.'
                : 'Se ha completado el cupo de participantes para esta edición.'}
            </p>
            <p className="text-xs text-amber-300 font-semibold">
              Si deseas consultar lista de espera, comunícate directamente por WhatsApp al {config.whatsappContacto}.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-[#0b3320] border-2 border-emerald-600/60 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6"
          >
            {/* General Error Banner */}
            {errors.general && (
              <div className="bg-red-950/90 border border-red-500 text-red-200 p-4 rounded-2xl flex items-start gap-3 text-xs sm:text-sm">
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
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
              <label className="block text-sm sm:text-base font-bold text-white mb-1">
                NOMBRE COMPLETO DEL PARTICIPANTE <span className="text-red-400">*</span>
              </label>
              <span className="text-xs text-emerald-300 block mb-3 font-normal">
                (Apellidos Paterno, Materno, Nombre)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Apellido Paterno"
                  value={formData.paterno}
                  onChange={(e) => setFormData({ ...formData, paterno: e.target.value })}
                  className="w-full bg-emerald-950/80 text-white placeholder-emerald-600 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  placeholder="Apellido Materno"
                  value={formData.materno}
                  onChange={(e) => setFormData({ ...formData, materno: e.target.value })}
                  className="w-full bg-emerald-950/80 text-white placeholder-emerald-600 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  placeholder="Nombre(s)"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full bg-emerald-950/80 text-white placeholder-emerald-600 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {errors.nombre && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5">
                  <AlertCircle size={14} />
                  <span>{errors.nombre}</span>
                </div>
              )}
            </div>

            {/* Field 2: Fecha de Nacimiento */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <div className="flex justify-between items-start mb-1">
                <label className="block text-sm sm:text-base font-bold text-white">
                  FECHA DE NACIMIENTO <span className="text-red-400">*</span>
                </label>
                {calculatedAge !== null && (
                  <span className="text-xs bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-400/30">
                    Edad al torneo: {calculatedAge} años
                  </span>
                )}
              </div>
              <span className="text-xs text-emerald-300 block mb-3 font-normal">
                Indispensable para validar categoría Juvenil (18 años o menos)
              </span>

              <input
                type="date"
                value={formData.fechaNacimiento}
                onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                className="w-full sm:w-64 bg-emerald-950/80 text-white placeholder-emerald-600 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              />

              {errors.fechaNacimiento && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5">
                  <AlertCircle size={14} />
                  <span>{errors.fechaNacimiento}</span>
                </div>
              )}
            </div>

            {/* Field 3: WhatsApp (10 dígitos) */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <label className="block text-sm sm:text-base font-bold text-white mb-1">
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
                  type="tel"
                  maxLength={10}
                  placeholder="Ej. 6181234567"
                  value={formData.whatsapp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, whatsapp: val });
                  }}
                  className="w-full bg-emerald-950/80 text-white placeholder-emerald-600 border border-emerald-700 rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              {errors.whatsapp && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5">
                  <AlertCircle size={14} />
                  <span>{errors.whatsapp}</span>
                </div>
              )}
            </div>

            {/* Field 4: Correo Electrónico */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <label className="block text-sm sm:text-base font-bold text-white mb-1">
                CORREO ELECTRÓNICO <span className="text-red-400">*</span>
              </label>
              <span className="text-xs text-emerald-300 block mb-3 font-normal">
                Recibirás tu confirmación de inscripción
              </span>

              <input
                type="email"
                placeholder="tu_correo@ejemplo.com"
                value={formData.correo}
                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                className="w-full bg-emerald-950/80 text-white placeholder-emerald-600 border border-emerald-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-400"
              />

              {errors.correo && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold mt-2.5">
                  <AlertCircle size={14} />
                  <span>{errors.correo}</span>
                </div>
              )}
            </div>

            {/* Field 5: Categoría */}
            <div className="bg-[#0e3b26] p-5 rounded-2xl border border-emerald-700/60 transition-colors focus-within:border-amber-400">
              <label className="block text-sm sm:text-base font-bold text-white mb-1">
                CATEGORÍA DE JUEGO <span className="text-red-400">*</span>
              </label>
              <span className="text-xs text-emerald-300 block mb-4 font-normal">
                Selecciona tu categoría según tu edad y nivel
              </span>

              <div className="space-y-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    formData.categoria === 'Juvenil'
                      ? 'bg-amber-400/20 border-amber-400 text-white shadow-md'
                      : 'bg-emerald-950/60 border-emerald-800 text-emerald-200 hover:border-emerald-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="categoria"
                    value="Juvenil"
                    checked={formData.categoria === 'Juvenil'}
                    onChange={() => setFormData({ ...formData, categoria: 'Juvenil' })}
                    className="mt-1 w-4 h-4 text-amber-500 border-emerald-700 focus:ring-amber-400 bg-emerald-900"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-festive text-sm sm:text-base text-yellow-300 font-bold">
                        JUVENIL (INFANTIL-JUVENIL)
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-300">
                        18 años o menos
                      </span>
                    </div>
                    <p className="text-xs text-emerald-300/90 mt-0.5">
                      Para niñas, niños y jóvenes ajedrecistas. Premiación y trofeos a los primeros 3 lugares.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    formData.categoria === 'Libre'
                      ? 'bg-amber-400/20 border-amber-400 text-white shadow-md'
                      : 'bg-emerald-950/60 border-emerald-800 text-emerald-200 hover:border-emerald-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="categoria"
                    value="Libre"
                    checked={formData.categoria === 'Libre'}
                    onChange={() => setFormData({ ...formData, categoria: 'Libre' })}
                    className="mt-1 w-4 h-4 text-amber-500 border-emerald-700 focus:ring-amber-400 bg-emerald-900"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-festive text-sm sm:text-base text-yellow-300 font-bold">
                        LIBRE (RANQUEADOS Y AFICIONADOS)
                      </span>
                      <span className="text-[11px] font-semibold text-amber-300">
                        Categoría Principal
                      </span>
                    </div>
                    <p className="text-xs text-emerald-300/90 mt-0.5">
                      Una sola categoría que reúne a jugadores ranqueados y aficionados. Disputa $2,500 en efectivo al 1.er lugar y premios al podio.
                    </p>
                  </div>
                </label>
              </div>

              {errors.categoria && (
                <div className="flex items-start gap-1.5 text-red-400 text-xs font-semibold mt-3 p-2.5 bg-red-950/50 rounded-lg border border-red-800/80">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errors.categoria}</span>
                </div>
              )}
            </div>

            {/* Special Recognitions Checkboxes */}
            <div className="space-y-3">
              <div className="bg-[#0e3b26] p-4 rounded-2xl border border-emerald-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Award size={18} className="text-amber-400 shrink-0" />
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
              </div>

              <div className="bg-[#0e3b26] p-4 rounded-2xl border border-emerald-700/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Star size={18} className="text-pink-400 shrink-0" />
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
              </div>
            </div>

            {/* Field 6: Mandatory Payment Receipt Upload (Admin-only storage) */}
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

              {/* Compact Bank Details Reminder */}
              <div className="bg-emerald-950/90 border border-emerald-800 rounded-xl p-3.5 mb-4 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <CreditCard size={14} />
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
                    onClick={handleCopyClabe}
                    className="inline-flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    {copiedClabe ? (
                      <>
                        <Check size={12} className="text-emerald-300" />
                        <span>Copiada</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-emerald-300/90">
                  También puedes subir foto de tu recibo de pago en efectivo hecho en <strong>Tatuajes Durango</strong>.
                </p>
              </div>

              {/* File Dropzone or Preview */}
              <input
                ref={fileInputRef}
                id="reciboPagoInput"
                data-testid="receipt-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => handleReceiptSelected(e.target.files?.[0])}
                className="sr-only"
              />

              {processingReceipt ? (
                <div className="border-2 border-dashed border-amber-400/60 bg-emerald-950/60 rounded-2xl p-6 text-center flex flex-col items-center gap-2">
                  <Loader2 size={28} className="animate-spin text-amber-400" />
                  <p className="text-xs sm:text-sm font-bold text-amber-200">
                    Optimizando tu comprobante de pago...
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
                        <FileText size={32} className="mx-auto" />
                        <span className="text-[10px] font-bold block mt-1">PDF</span>
                      </div>
                    ) : (
                      <img
                        src={receiptFile.dataUrl}
                        alt="Vista previa de tu recibo"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 mb-1">
                      <FileImage size={14} />
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
                      className="bg-red-950/80 hover:bg-red-900 text-red-300 p-2 rounded-xl border border-red-700/70 transition-colors cursor-pointer"
                      title="Quitar recibo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleReceiptSelected(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-600/80 hover:border-amber-400 bg-emerald-950/60 hover:bg-emerald-950/90 rounded-2xl p-6 text-center cursor-pointer transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/15 text-amber-300 border border-amber-400/35 mx-auto flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Upload size={22} />
                  </div>
                  <p className="text-sm font-bold text-white">
                    Haz clic aquí o arrastra la foto de tu recibo de pago
                  </p>
                  <p className="text-xs text-emerald-300 mt-1">
                    Formatos aceptados: JPG, PNG, WEBP o PDF (máx. 8 MB)
                  </p>
                </div>
              )}

              {/* Privacy Assurance */}
              <div className="mt-3 flex items-start gap-2 text-[11px] text-emerald-300/90 bg-emerald-950/60 px-3 py-2 rounded-xl border border-emerald-800/70">
                <ShieldCheck size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Almacenamiento privado:</strong> Tu recibo y su enlace directo se guardan en una bóveda segura visible <strong>únicamente para los administradores</strong> del torneo. Nunca se publica en el padrón.
                </span>
              </div>

              {errors.recibo && (
                <div
                  data-testid="receipt-error"
                  className="flex items-start gap-1.5 text-red-400 text-xs font-semibold mt-3 p-2.5 bg-red-950/50 rounded-lg border border-red-800/80"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errors.recibo}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || processingReceipt}
                data-testid="submit-registration-btn"
                className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-50 text-emerald-950 font-festive font-black py-4 px-6 rounded-2xl text-lg sm:text-xl shadow-[0_6px_25px_rgba(250,204,21,0.4)] transition-all flex items-center justify-center gap-2 transform active:scale-98 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={22} className="animate-spin text-emerald-950" />
                    <span>Guardando inscripción y recibo...</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Registro y Comprobante</span>
                    <span>♟️</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-emerald-400/80 mt-3">
                Al enviar aceptas las bases del torneo y el uso de tus datos exclusivamente para la logística del evento.
              </p>
            </div>
          </form>
        )}
      </div>

      {/* Success Modal */}
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
