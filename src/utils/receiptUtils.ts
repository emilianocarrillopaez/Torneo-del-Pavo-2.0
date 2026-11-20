import { validateReceiptFileMeta } from './tournamentUtils';

export interface ProcessedReceiptFile {
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
}

const MAX_FIRESTORE_DATA_URL_LENGTH = 850_000; // Safe margin below Firestore 1MB limit

/**
 * Compresses image receipts client-side using Canvas so they remain sharp,
 * load fast for admins, and fit reliably in the private Firestore vault.
 * PDFs under the size limit are encoded directly.
 */
export async function processReceiptFile(file: File): Promise<ProcessedReceiptFile> {
  const validationError = validateReceiptFileMeta(file.type, file.size);
  if (validationError) {
    throw new Error(validationError);
  }

  // Handle PDF receipts
  if (file.type === 'application/pdf') {
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl.length > MAX_FIRESTORE_DATA_URL_LENGTH) {
      throw new Error(
        'El PDF del recibo es demasiado pesado (máx. 600 KB para PDF). Te recomendamos subir una captura de pantalla (JPG/PNG) del comprobante.'
      );
    }
    return {
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      dataUrl,
    };
  }

  // Handle images with progressive canvas compression
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const maxDimensions = [1280, 1024, 820];
  const qualities = [0.8, 0.68, 0.55];

  for (let i = 0; i < maxDimensions.length; i++) {
    const compressed = compressImageToJpeg(img, maxDimensions[i], qualities[i]);
    if (compressed.length <= MAX_FIRESTORE_DATA_URL_LENGTH) {
      return {
        fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
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

  // Fill white background in case of transparent PNG screenshots
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Triggers a clean download of a stored receipt data URL (Admin only).
 */
export function downloadReceiptDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName || 'comprobante-pago.jpg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
