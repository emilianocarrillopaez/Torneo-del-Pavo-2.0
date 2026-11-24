import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Participant, TournamentCategory, TournamentConfig } from '../types/tournament';
import {
  createRegistrationAttemptIds,
  registerParticipant,
  registerWaitlistEntry,
} from '../services/tournamentService';
import {
  buildParticipantNames,
  calculateAgeAtTournament,
  validateRegistrationInput,
  RegistrationValidationErrors,
  PRIVACY_NOTICE_VERSION,
} from '../utils/tournamentUtils';
import { processReceiptFile, ProcessedReceiptFile } from '../utils/receiptUtils';
import { classifyAndFormatError } from '../utils/errorMessages';
import { copyTextSafely } from '../utils/paymentConfig';
import { SESSION_DRAFT_STORAGE_KEY } from '../constants/tournament';

export interface RegistrationFormState {
  paterno: string;
  materno: string;
  nombre: string;
  fechaNacimiento: string;
  whatsapp: string;
  correo: string;
  categoria: TournamentCategory | '';
  esFemenil: boolean;
  esAficionado: boolean;
  aceptoAviso: boolean;
  consentimientoTutor: boolean;
  nombreTutor: string;
  website: string; // Honeypot
}

const EMPTY_FORM: RegistrationFormState = {
  paterno: '',
  materno: '',
  nombre: '',
  fechaNacimiento: '',
  whatsapp: '',
  correo: '',
  categoria: '',
  esFemenil: false,
  esAficionado: false,
  aceptoAviso: false,
  consentimientoTutor: false,
  nombreTutor: '',
  website: '',
};

const MAX_SUBMIT_ATTEMPTS_PER_SESSION = 5;
const ERROR_COOLDOWN_MS = 3500;

function loadSessionDraft(preselected?: TournamentCategory | null): RegistrationFormState {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { ...EMPTY_FORM, categoria: preselected || '' };
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_DRAFT_STORAGE_KEY);
    if (!raw) return { ...EMPTY_FORM, categoria: preselected || '' };
    const parsed = JSON.parse(raw) as Partial<RegistrationFormState>;
    return {
      ...EMPTY_FORM,
      paterno: String(parsed.paterno || ''),
      materno: String(parsed.materno || ''),
      nombre: String(parsed.nombre || ''),
      fechaNacimiento: String(parsed.fechaNacimiento || ''),
      whatsapp: String(parsed.whatsapp || ''),
      correo: String(parsed.correo || ''),
      categoria: preselected || (parsed.categoria === 'Juvenil' || parsed.categoria === 'Libre' ? parsed.categoria : ''),
      esFemenil: Boolean(parsed.esFemenil),
      esAficionado: Boolean(parsed.esAficionado),
      nombreTutor: String(parsed.nombreTutor || ''),
    };
  } catch {
    return { ...EMPTY_FORM, categoria: preselected || '' };
  }
}

export function useRegistrationForm(options: {
  config: TournamentConfig;
  totalRegistered: number;
  preselectedCategory?: TournamentCategory | null;
  onRegistrationSuccess?: () => void;
  paymentBlocked: boolean;
}) {
  const { config, totalRegistered, preselectedCategory, onRegistrationSuccess, paymentBlocked } =
    options;

  const [formData, setFormData] = useState<RegistrationFormState>(() =>
    loadSessionDraft(preselectedCategory)
  );
  const [receiptFile, setReceiptFile] = useState<ProcessedReceiptFile | null>(null);
  const [processingReceipt, setProcessingReceipt] = useState(false);
  const [copiedClabe, setCopiedClabe] = useState(false);
  const [errors, setErrors] = useState<RegistrationValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewStep, setShowReviewStep] = useState(false);
  const [registeredParticipant, setRegisteredParticipant] = useState<Participant | null>(null);
  const [waitlistFolio, setWaitlistFolio] = useState<string | null>(null);

  const submitLockRef = useRef<boolean>(false);
  const sessionAttemptsRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptIdsRef = useRef<{ participantId: string; reciboId: string; folio: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevPreselected, setPrevPreselected] = useState(preselectedCategory);
  if (preselectedCategory !== prevPreselected) {
    setPrevPreselected(preselectedCategory);
    if (preselectedCategory) {
      setFormData((prev) => ({ ...prev, categoria: preselectedCategory }));
    }
  }

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Autoguardado del borrador solo en sessionStorage (se limpia al cerrar pestaña, nunca guarda recibos)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const { website: _w, aceptoAviso: _a, consentimientoTutor: _c, ...draft } = formData;
      window.sessionStorage.setItem(SESSION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }, [formData]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const placesLeft = Math.max(0, config.cupoMaximo - totalRegistered);
  const deadlineMs = config.fechaLimiteIso ? Date.parse(config.fechaLimiteIso) : Number.NaN;
  const deadlinePassed = !Number.isNaN(deadlineMs) && nowMs > deadlineMs;
  const isFull = placesLeft <= 0;
  const isWaitlistMode =
    config.inscripcionesAbiertas &&
    !deadlinePassed &&
    isFull &&
    config.habilitarListaEspera !== false;
  const isClosed = !config.inscripcionesAbiertas || deadlinePassed || (isFull && !isWaitlistMode);

  const calculatedAge = calculateAgeAtTournament(formData.fechaNacimiento, config.fechaIso);
  const isMinor = calculatedAge !== null && calculatedAge < 18;

  // Cálculo simple de progreso del formulario (5 hitos visibles)
  const completedSteps = [
    Boolean(formData.paterno.trim() && formData.nombre.trim()),
    Boolean(formData.fechaNacimiento && (!isMinor || (formData.consentimientoTutor && formData.nombreTutor.trim().length >= 3))),
    Boolean(formData.whatsapp.replace(/\D/g, '').length === 10 && formData.correo.includes('@')),
    Boolean(formData.categoria),
    isWaitlistMode ? formData.aceptoAviso : Boolean(receiptFile && formData.aceptoAviso),
  ].filter(Boolean).length;
  const progressPercent = Math.round((completedSteps / 5) * 100);

  const handleCopyClabe = useCallback(async () => {
    const ok = await copyTextSafely(config.clabe);
    if (ok) {
      setCopiedClabe(true);
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedClabe(false), 2200);
    }
  }, [config.clabe]);

  const handleReceiptSelected = async (file: File | null | undefined) => {
    if (!file) return;
    setProcessingReceipt(true);
    setErrors((prev) => ({ ...prev, recibo: undefined }));
    try {
      const processed = await processReceiptFile(file);
      setReceiptFile(processed);
      // Reiniciar ids solo cuando se cambia de comprobante
      attemptIdsRef.current = null;
    } catch (err) {
      setReceiptFile(null);
      const classified = classifyAndFormatError(err);
      setErrors((prev) => ({ ...prev, recibo: classified.message }));
    } finally {
      setProcessingReceipt(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    attemptIdsRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validate = (): boolean => {
    const newErrors = validateRegistrationInput(
      {
        paterno: formData.paterno,
        materno: formData.materno,
        nombre: formData.nombre,
        fechaNacimiento: formData.fechaNacimiento,
        whatsapp: formData.whatsapp,
        correo: formData.correo,
        categoria: formData.categoria,
        hasReceipt: Boolean(receiptFile),
        aceptoAviso: formData.aceptoAviso,
        consentimientoTutor: formData.consentimientoTutor,
        nombreTutor: formData.nombreTutor,
        requireReceipt: !isWaitlistMode,
      },
      config.fechaIso
    );
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const requestReviewStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (isClosed) {
      setErrors({
        general: deadlinePassed
          ? 'El plazo límite de inscripciones ha concluido.'
          : 'Las inscripciones están actualmente cerradas o el cupo se ha agotado.',
      });
      return;
    }
    if (!isWaitlistMode && paymentBlocked) {
      setErrors({
        general:
          'Los datos bancarios de pago aún no están configurados. Contacta al organizador antes de inscribirte.',
      });
      return;
    }
    if (formData.website) return;
    if (!validate()) return;
    setErrors({});
    setShowReviewStep(true);
  };

  const confirmAndSubmit = async () => {
    if (submitLockRef.current) return;
    if (isClosed || (!isWaitlistMode && paymentBlocked) || formData.website) return;

    if (Date.now() < cooldownUntilRef.current) {
      setErrors({ general: 'Por favor espera unos segundos antes de volver a intentarlo.' });
      setShowReviewStep(false);
      return;
    }

    if (sessionAttemptsRef.current >= MAX_SUBMIT_ATTEMPTS_PER_SESSION) {
      setErrors({
        general:
          'Alcanzaste el límite de intentos en esta sesión. Recarga la página o comunícate por WhatsApp con el comité.',
      });
      setShowReviewStep(false);
      return;
    }

    if (!validate() || (!isWaitlistMode && !receiptFile)) {
      setShowReviewStep(false);
      return;
    }

    submitLockRef.current = true;
    sessionAttemptsRef.current += 1;
    setIsSubmitting(true);
    setErrors({});

    try {
      const { privateName: fullName } = buildParticipantNames({
        paterno: formData.paterno,
        materno: formData.materno,
        nombre: formData.nombre,
      });
      const cleanWhatsapp = formData.whatsapp.replace(/\D/g, '');
      const cleanEmail = formData.correo.trim().toLowerCase();
      const consentTime = new Date().toISOString();

      if (isWaitlistMode) {
        const res = await registerWaitlistEntry(
          {
            nombre: fullName,
            fechaNacimiento: formData.fechaNacimiento,
            whatsapp: cleanWhatsapp,
            correo: cleanEmail,
            categoria: formData.categoria as TournamentCategory,
            esFemenil: formData.esFemenil,
            esAficionado: formData.categoria === 'Libre' ? formData.esAficionado : false,
            aceptoAviso: true,
            aceptoAvisoVersion: PRIVACY_NOTICE_VERSION,
            fechaConsentimiento: consentTime,
            ...(isMinor
              ? {
                  consentimientoTutor: formData.consentimientoTutor,
                  nombreTutor: formData.nombreTutor.trim(),
                }
              : {}),
          },
          config.fechaIso
        );
        setWaitlistFolio(res.folio);
      } else if (receiptFile) {
        if (!attemptIdsRef.current) {
          attemptIdsRef.current = createRegistrationAttemptIds();
        }
        const idempotencyIds = attemptIdsRef.current;

        const res = await registerParticipant(
          {
            nombre: fullName,
            fechaNacimiento: formData.fechaNacimiento,
            whatsapp: cleanWhatsapp,
            correo: cleanEmail,
            categoria: formData.categoria as TournamentCategory,
            esFemenil: formData.esFemenil,
            esAficionado: formData.categoria === 'Libre' ? formData.esAficionado : false,
            aceptoAviso: true,
            aceptoAvisoVersion: PRIVACY_NOTICE_VERSION,
            fechaConsentimiento: consentTime,
            ...(isMinor
              ? {
                  consentimientoTutor: formData.consentimientoTutor,
                  nombreTutor: formData.nombreTutor.trim(),
                }
              : {}),
          },
          receiptFile,
          { idempotencyIds, eventFechaIso: config.fechaIso }
        );

        const fullParticipant: Participant = {
          id: res.id,
          folio: res.folio,
          nombre: fullName,
          fechaNacimiento: formData.fechaNacimiento,
          whatsapp: cleanWhatsapp,
          correo: cleanEmail,
          categoria: formData.categoria as TournamentCategory,
          esFemenil: formData.esFemenil,
          esAficionado: formData.categoria === 'Libre' ? formData.esAficionado : false,
          estatusPago: 'pendiente',
          fechaRegistro: consentTime,
          tieneRecibo: true,
          reciboId: res.reciboId,
          reciboNombreArchivo: receiptFile.fileName,
          aceptoAviso: true,
          aceptoAvisoVersion: PRIVACY_NOTICE_VERSION,
          fechaConsentimiento: consentTime,
          ...(isMinor
            ? {
                consentimientoTutor: formData.consentimientoTutor,
                nombreTutor: formData.nombreTutor.trim(),
              }
            : {}),
        };
        setRegisteredParticipant(fullParticipant);
        attemptIdsRef.current = null;
      }

      if (onRegistrationSuccess) onRegistrationSuccess();
      setFormData(EMPTY_FORM);
      setReceiptFile(null);
      setShowReviewStep(false);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
      }
    } catch (err: unknown) {
      cooldownUntilRef.current = Date.now() + ERROR_COOLDOWN_MS;
      const classified = classifyAndFormatError(err);
      setErrors({ general: classified.message });
      setShowReviewStep(false);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
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
    placesLeft,
    deadlinePassed,
    isFull,
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
  };
}
