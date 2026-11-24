export type FriendlyErrorCategory =
  | 'offline'
  | 'quota'
  | 'closed'
  | 'duplicate'
  | 'file'
  | 'rate-limit'
  | 'app-check'
  | 'auth'
  | 'unknown';

export interface FriendlyErrorResult {
  category: FriendlyErrorCategory;
  message: string;
}

/**
 * Traduce cualquier error técnico o de Firebase a un mensaje claro y accionable en español de México,
 * sin filtrar UIDs, rutas internas ni detalles del proveedor.
 */
export function classifyAndFormatError(error: unknown): FriendlyErrorResult {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      category: 'offline',
      message:
        'Sin conexión a internet. Verifica tu red Wi-Fi o datos móviles e intenta enviar nuevamente (tus datos siguen aquí).',
    };
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const lowerMsg = rawMessage.toLowerCase();

  if (
    code.includes('app-check') ||
    code.includes('appcheck') ||
    lowerMsg.includes('app check') ||
    lowerMsg.includes('app-check') ||
    lowerMsg.includes('recaptcha')
  ) {
    return {
      category: 'app-check',
      message:
        'No pudimos validar la verificación automática de seguridad (App Check / reCAPTCHA). Recarga la página e intenta de nuevo sin bloqueadores estrictos.',
    };
  }

  if (code === 'resource-exhausted' || lowerMsg.includes('demasiadas solicitudes')) {
    return {
      category: 'rate-limit',
      message:
        'Detectamos demasiados intentos seguidos en el servidor. Espera unos minutos e intenta nuevamente.',
    };
  }

  if (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    lowerMsg.includes('offline') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('conexión')
  ) {
    return {
      category: 'offline',
      message:
        'No pudimos comunicarnos con el servidor en este momento. Revisa tu conexión a internet e intenta de nuevo.',
    };
  }

  if (lowerMsg.includes('cupo') || lowerMsg.includes('lugares agotados')) {
    return {
      category: 'quota',
      message:
        'El cupo máximo del torneo se ha completado. Puedes registrarte en la lista de espera si está habilitada.',
    };
  }

  if (lowerMsg.includes('cerrad') || lowerMsg.includes('fecha límite')) {
    return {
      category: 'closed',
      message:
        'Las inscripciones están cerradas en este momento o la fecha límite ya venció.',
    };
  }

  if (code === 'already-exists' || lowerMsg.includes('duplicad') || lowerMsg.includes('ya existe')) {
    return {
      category: 'duplicate',
      message:
        'Ya existe una inscripción previa registrada con ese correo electrónico o número de WhatsApp. Si necesitas ayuda o corregir tu registro, contacta al comité organizador.',
    };
  }

  if (
    lowerMsg.includes('archivo') ||
    lowerMsg.includes('comprobante') ||
    lowerMsg.includes('formato no permitido') ||
    lowerMsg.includes('comprimir') ||
    lowerMsg.includes('8 mb') ||
    lowerMsg.includes('600 kb')
  ) {
    return {
      category: 'file',
      message:
        rawMessage ||
        'El archivo del comprobante no es válido o pesa demasiado. Sube una captura JPG, PNG, WEBP o PDF ligero.',
    };
  }

  if (code === 'unauthenticated' || code === 'permission-denied') {
    if (lowerMsg.includes('inscripciones') || lowerMsg.includes('registro')) {
      return {
        category: 'closed',
        message: rawMessage,
      };
    }
    return {
      category: 'auth',
      message:
        rawMessage ||
        'No fue posible completar la operación. Verifica tus datos o permisos e intenta nuevamente.',
    };
  }

  if (rawMessage && !/[a-zA-Z0-9_-]{20,}/.test(rawMessage) && !rawMessage.includes('FirebaseError')) {
    return {
      category: 'unknown',
      message: rawMessage,
    };
  }

  return {
    category: 'unknown',
    message:
      'Ocurrió un problema inesperado al procesar tu solicitud. Intenta de nuevo en unos momentos.',
  };
}
