import { validateReceiptFileMeta } from './tournamentUtils';
import { MAX_FIRESTORE_DATA_URL_LENGTH } from '../constants/tournament';

export interface ProcessedReceiptFile {
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
}

const SAFE_RECEIPT_DATA_URL_RE =
  /^data:(image\/(jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;

/**
 * Valida que un data URL de comprobante corresponda estrictamente a imagen/PDF base64 permitido.
 */
export function isSafeReceiptDataUrl(
  dataUrl: string | undefined | null,
  expectedMimeType?: string
): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  if (!SAFE_RECEIPT_DATA_URL_RE.test(dataUrl)) return false;
  if (expectedMimeType) {
    return dataUrl.startsWith(`data:${expectedMimeType};base64,`);
  }
  return true;
}

/**
 * Limpia el nombre de archivo eliminando separadores de ruta y caracteres problemáticos.
 */
export function sanitizeReceiptFileName(name: string): string {
  const base = (name || 'comprobante')
    .replace(/[/\\]+/g, '_')
    .replace(/[^\w.\-()\sáéíóúÁÉÍÓÚñÑ]/g, '_')
    .trim();
  return (base || 'comprobante').slice(0, 180);
}

/**
 * Verifica la firma binaria real (magic bytes) del archivo para evitar extensiones/MIME falsos.
 */
export function validateReceiptMagicBytes(
  bytes: Uint8Array,
  declaredMimeType: string
): boolean {
  if (bytes.length < 4) return false;

  // JPEG: FF D8 FF
  if (declaredMimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (declaredMimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  // WEBP: RIFF....WEBP
  if (declaredMimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && // R
      bytes[1] === 0x49 && // I
      bytes[2] === 0x46 && // F
      bytes[3] === 0x46 && // F
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50 // P
    );
  }

  // PDF: %PDF
  if (declaredMimeType === 'application/pdf') {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }

  return false;
}

/**
 * Convierte un data URL PDF validado en un Blob URL seguro para previsualizar en iframe sandbox.
 */
export function createSafePdfBlobUrl(dataUrl: string): string | null {
  if (!isSafeReceiptDataUrl(dataUrl, 'application/pdf')) return null;
  const base64 = dataUrl.split(',')[1];
  if (!base64) return null;
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Procesa y valida magic bytes, comprime imágenes mediante Canvas y codifica PDFs ligeros.
 */
export async function processReceiptFile(file: File): Promise<ProcessedReceiptFile> {
  const validationError = validateReceiptFileMeta(file.type, file.size);
  if (validationError) {
    throw new Error(validationError);
  }

  const headerBuffer = await file.slice(0, 16).arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);
  if (!validateReceiptMagicBytes(headerBytes, file.type)) {
    throw new Error(
      'El contenido del archivo no coincide con una imagen JPG/PNG/WEBP o PDF válido.'
    );
  }

  const cleanFileName = sanitizeReceiptFileName(file.name);

  if (file.type === 'application/pdf') {
    const dataUrl = await readFileAsDataUrl(file);
    if (!isSafeReceiptDataUrl(dataUrl, 'application/pdf')) {
      throw new Error('El archivo PDF no tiene una estructura válida.');
    }
    if (dataUrl.length > MAX_FIRESTORE_DATA_URL_LENGTH) {
      throw new Error(
        'El PDF del recibo es demasiado pesado (máx. 600 KB para PDF). Te recomendamos subir una captura de pantalla (JPG/PNG) del comprobante.'
      );
    }
    return {
      fileName: cleanFileName,
      mimeType: file.type,
      fileSize: file.size,
      dataUrl,
    };
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const maxDimensions = [1280, 1024, 820];
  const qualities = [0.8, 0.68, 0.55];

  for (let i = 0; i < maxDimensions.length; i++) {
    const compressed = compressImageToJpeg(img, maxDimensions[i], qualities[i]);
    if (
      compressed.length <= MAX_FIRESTORE_DATA_URL_LENGTH &&
      isSafeReceiptDataUrl(compressed, 'image/jpeg')
    ) {
      return {
        fileName: sanitizeReceiptFileName(cleanFileName.replace(/\.[^.]+$/, '') + '.jpg'),
        mimeType: 'image/jpeg',
        fileSize: Math.round((compressed.length * 3) / 4),
        dataUrl: compressed,
      };
    }
  }

  throw new Error(
    'No fue posible comprimir la imagen por debajo del límite permitido. Toma una captura más clara o recórtala.'
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer el archivo del comprobante.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo del comprobante.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
    img.src = src;
  });
}

function compressImageToJpeg(img: HTMLImageElement, maxDim: number, quality: number): string {
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el compresor de imágenes.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Triggers a clean download of a validated receipt data URL (Admin only).
 */
export function downloadReceiptDataUrl(dataUrl: string, fileName: string): void {
  if (!isSafeReceiptDataUrl(dataUrl)) {
    throw new Error('Formato de comprobante inválido para descarga.');
  }
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = sanitizeReceiptFileName(fileName || 'comprobante-pago');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
