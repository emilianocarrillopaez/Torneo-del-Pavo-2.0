import {
  CLABE_18_REGEX,
  PHONE_10_REGEX,
  PLACEHOLDER_PAYMENT_VALUES,
} from '../constants/tournament';
import { TournamentConfig } from '../types/tournament';

export interface PaymentConfigStatus {
  isComplete: boolean;
  isPlaceholderClabe: boolean;
  isPlaceholderTitular: boolean;
  isPlaceholderWhatsapp: boolean;
  isPlaceholderBanco: boolean;
  missingFields: string[];
}

export function evaluatePaymentConfig(
  config: Pick<TournamentConfig, 'clabe' | 'banco' | 'titular' | 'whatsappContacto'> | null | undefined
): PaymentConfigStatus {
  if (!config) {
    return {
      isComplete: false,
      isPlaceholderClabe: true,
      isPlaceholderTitular: true,
      isPlaceholderWhatsapp: true,
      isPlaceholderBanco: true,
      missingFields: ['CLABE', 'Banco', 'Titular', 'WhatsApp de contacto'],
    };
  }

  const cleanClabe = String(config.clabe || '').replace(/\s+/g, '');
  const cleanTitular = String(config.titular || '').trim();
  const cleanBanco = String(config.banco || '').trim();
  const cleanWhatsapp = String(config.whatsappContacto || '').replace(/\D/g, '');

  const isPlaceholderClabe =
    !cleanClabe ||
    cleanClabe === PLACEHOLDER_PAYMENT_VALUES.CLABE ||
    /^0+$/.test(cleanClabe) ||
    !CLABE_18_REGEX.test(cleanClabe);

  const isPlaceholderBanco =
    !cleanBanco ||
    cleanBanco.toLowerCase().includes('configurar en panel admin');

  const isPlaceholderTitular =
    !cleanTitular ||
    cleanTitular === PLACEHOLDER_PAYMENT_VALUES.TITULAR ||
    cleanTitular.toLowerCase().includes('configurar en panel admin');

  const isPlaceholderWhatsapp =
    !cleanWhatsapp ||
    cleanWhatsapp === PLACEHOLDER_PAYMENT_VALUES.WHATSAPP ||
    /^0+$/.test(cleanWhatsapp) ||
    !PHONE_10_REGEX.test(cleanWhatsapp);

  const missingFields: string[] = [];
  if (isPlaceholderClabe) missingFields.push('CLABE interbancaria (18 dígitos)');
  if (isPlaceholderBanco) missingFields.push('Banco');
  if (isPlaceholderTitular) missingFields.push('Titular de la cuenta');
  if (isPlaceholderWhatsapp) missingFields.push('WhatsApp de contacto (10 dígitos)');

  return {
    isComplete: missingFields.length === 0,
    isPlaceholderClabe,
    isPlaceholderTitular,
    isPlaceholderWhatsapp,
    isPlaceholderBanco,
    missingFields,
  };
}

export function isPlaceholderPaymentConfig(
  config: Pick<TournamentConfig, 'clabe' | 'banco' | 'titular' | 'whatsappContacto'> | null | undefined
): boolean {
  return !evaluatePaymentConfig(config).isComplete;
}

/**
 * Copia texto al portapapeles con respaldo `execCommand('copy')` para navegadores móviles/Safari.
 */
export async function copyTextSafely(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Continuar con fallback de textarea
    }
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
