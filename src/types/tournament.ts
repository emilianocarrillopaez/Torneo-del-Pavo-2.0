export type TournamentCategory = 'Juvenil' | 'Libre';

export type LegacyTournamentCategory =
  | TournamentCategory
  | 'Libre - Aficionados'
  | 'Libre - Rankeado'
  | 'Niños'
  | 'Aficionados'
  | 'Rankeado';

export function normalizeCategory(category: string | undefined | null): TournamentCategory {
  if (category === 'Juvenil' || category === 'Niños' || category === 'Infantil-Juvenil') {
    return 'Juvenil';
  }
  return 'Libre';
}

export interface ParticipantHistoryEntry {
  accion: string;
  fecha: string;
  autor: string;
  detalle?: string;
}

export interface Participant {
  id?: string;
  nombre: string;
  fechaNacimiento: string;
  whatsapp: string;
  correo: string;
  categoria: TournamentCategory | LegacyTournamentCategory;
  estatusPago: 'pendiente' | 'pagado';
  fechaRegistro: string;
  folio: string;
  esFemenil?: boolean;
  esAficionado?: boolean;
  tieneRecibo?: boolean;
  reciboId?: string;
  reciboNombreArchivo?: string;
  notas?: string;
  website?: string; // Honeypot field
  aceptoAviso?: boolean;
  aceptoAvisoVersion?: string;
  consentimientoTutor?: boolean;
  nombreTutor?: string;
  fechaConsentimiento?: string;
  // Auditoría, check-in y borrado suave (solo admin)
  pagadoPor?: string;
  pagadoEn?: string;
  historial?: ParticipantHistoryEntry[];
  asistencia?: boolean;
  asistenciaEn?: string;
  eliminado?: boolean;
  eliminadoEn?: string;
  eliminadoPor?: string;
}

export interface PublicParticipant {
  id?: string;
  folio: string;
  nombre: string;
  categoria: TournamentCategory;
  esAficionado: boolean;
  esFemenil: boolean;
  estatusPago: 'pendiente' | 'pagado';
  rangoEdad?: string;
  edad?: number;
  fechaRegistro: string;
}

export interface WaitlistEntry {
  id?: string;
  nombre: string;
  fechaNacimiento: string;
  whatsapp: string;
  correo: string;
  categoria: TournamentCategory;
  esFemenil?: boolean;
  esAficionado?: boolean;
  estatus: 'en_espera' | 'contactado' | 'convertido';
  fechaRegistro: string;
  folio: string;
  aceptoAviso?: boolean;
  aceptoAvisoVersion?: string;
  consentimientoTutor?: boolean;
  nombreTutor?: string;
  fechaConsentimiento?: string;
  notas?: string;
  website?: string;
}

export interface PaymentReceipt {
  id?: string;
  participantId?: string;
  folio: string;
  participantNombre: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  imageDataUrl: string;
  uploadedAt: string;
}

export interface AdminMember {
  id?: string;
  email: string;
  nombre: string;
  rol: string;
  agregadoEn?: string;
}

export interface TournamentConfig {
  titulo: string;
  edicion?: string;
  slogan?: string;
  club: string;
  fecha: string;
  fechaIso: string;
  hora: string;
  lugar: string;
  referencia: string;
  mapaUrl: string;
  costo: number;
  cupoMaximo: number;
  totalInscritos?: number;
  fechaLimite: string;
  fechaLimiteIso?: string;
  fechaLimiteTimestamp?: unknown;
  fechaCorteMayoriaEdad?: string;
  fechaCorteJuvenil?: string;
  habilitarListaEspera?: boolean;
  politicaDevolucionTexto?: string;
  inscripcionesAbiertas: boolean;
  clabe: string;
  banco: string;
  titular: string;
  whatsappContacto: string;
  bolsaPremios?: string;
  primerLugarEfectivo?: string;
  presidente?: string;
  vicepresidente?: string;
  premiacionTexto: string;
  sistemaCompetenciaTexto: string;
  transitoriosTexto: string;
  indicacionesPago: string;
}

export interface Sponsor {
  id?: string;
  nombre: string;
  logo: string;
  enlace?: string;
  activo: boolean;
  orden?: number;
  categoriaSponsor?: string;
}

export const CATEGORY_DETAILS: Record<
  TournamentCategory,
  {
    title: string;
    subtitle: string;
    description: string;
    ageRequirement: string;
    icon: string;
    badgeColor: string;
  }
> = {
  Juvenil: {
    title: 'Juvenil (Infantil-Juvenil)',
    subtitle: '18 años o menos',
    description: 'Para niñas, niños y jóvenes de hasta 18 años cumplidos al día del evento.',
    ageRequirement: '18 años o menos cumplidos al día del evento.',
    icon: '♞',
    badgeColor: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
  },
  Libre: {
    title: 'Libre',
    subtitle: 'Ranqueados y Aficionados',
    description:
      'Ranqueados y aficionados apasionados por este deporte-ciencia. Disputan el podio general, los $2,500 en efectivo para el 1.er lugar, y los premios especiales a Mejor Aficionado y Mejor Femenil.',
    ageRequirement: 'Abierta a todas las edades y niveles de experiencia.',
    icon: '♚',
    badgeColor: 'bg-amber-600/30 text-amber-300 border-amber-500/40',
  },
};

/**
 * Plantilla de configuración sin datos bancarios ni teléfonos reales en código fuente (H14).
 * Los datos reales de pago y contacto viven únicamente en Firestore (/configuracion/general).
 */
export const DEFAULT_CONFIG: TournamentConfig = {
  titulo: 'Torneo del Pavo 2.0',
  edicion: 'Edición 2.0',
  slogan: '¡Vivamos juntos la posada del ajedrez!',
  club: 'Club de Ajedrez Don Gonzalo',
  fecha: 'Sábado 19 de diciembre de 2026',
  fechaIso: '2026-12-19T16:30:00-06:00',
  hora: '16:30 horas (4:30 PM)',
  lugar: 'Corredor Constitución, Zona Centro, Durango, Dgo.',
  referencia:
    'A la altura de la placita de Constitución, entre las calles Aquiles Serdán y Coronado (frente a Tatuajes Durango)',
  mapaUrl: 'https://maps.app.goo.gl/zk8y6hJt8R4jpUQZ8',
  costo: 200,
  cupoMaximo: 100,
  totalInscritos: 0,
  fechaLimite: 'Sábado 19 de diciembre de 2026 a las 15:30 hrs',
  fechaLimiteIso: '2026-12-19T15:30:00-06:00',
  fechaCorteMayoriaEdad: '2008-12-19',
  fechaCorteJuvenil: '2007-12-19',
  habilitarListaEspera: true,
  politicaDevolucionTexto:
    'Borrador sujeto a confirmación del Comité Organizador: Las inscripciones son personales e intransferibles una vez cerrado el registro. En caso de cancelación por causa de fuerza mayor del jugador antes de las 48 horas previas al evento, o en caso de reprogramación/suspensión oficial del torneo por causas climáticas o de sede, se podrá solicitar revisión de reembolso o transferencia de lugar contactando directamente al comité organizador con su folio y comprobante.',
  inscripcionesAbiertas: true,
  clabe: '000000000000000000',
  banco: 'Configurar en Panel Admin',
  titular: 'Comité Organizador (Configurar en Panel Admin)',
  whatsappContacto: '0000000000',
  bolsaPremios: 'Más de $10,000 en premios',
  primerLugarEfectivo: '$2,500 en efectivo al 1.er Lugar',
  presidente: 'Eduardo Roqueta',
  vicepresidente: 'Emiliano Carrillo',
  premiacionTexto: `• ¡MÁS DE $10,000 EN PREMIOS! (Incluye tarjetas de regalo de patrocinadores).
• $2,500.00 MXN en efectivo para el 1.er lugar absoluto.
• Se premiará a los primeros 3 lugares de cada categoría.
• Premio especial a la Mejor Femenil de la categoría Libre.
• Premio especial al Mejor Aficionado de la categoría Libre.
• Reconocimientos oficiales y sorpresas para los mejores jugadores de cada categoría.
• Los premios y patrocinadores oficiales serán anunciados por los canales oficiales del Club de Ajedrez Don Gonzalo.`,
  sistemaCompetenciaTexto: `• Sistema Suizo a 5 rondas a ritmo rápido: 10 minutos por jugador para toda la partida, con incremento de 3 segundos por jugada (10 min + 3 s).
• (El número de rondas podría ajustarse según el número de participantes inscritos).
• Tolerancia: Una vez iniciada cada ronda, se otorgará un tiempo máximo de tolerancia de 5 minutos. Si el jugador no se presenta en ese lapso, se declarará partida perdida por inasistencia.
• Criterios de Desempate en estricto orden: 1. Puntos acumulados, 2. Buchholz, 3. Buchholz mediano, 4. Partida individual, 5. Mayor número de victorias, 6. Sonneborn-Berger.
• Arbitraje: Designado por el comité organizador.`,
  transitoriosTexto: `• Los casos no previstos en la presente convocatoria serán resueltos por el Comité Organizador del Torneo del Pavo 2026.
• El Comité podrá realizar tomas fotográficas y de video durante el evento, que podrán publicarse en las redes sociales del Club de Ajedrez Don Gonzalo, así como en medios de comunicación y plataformas de los patrocinadores.
• Los participantes deberán traer su propio ajedrez y reloj, en caso de contar con ellos. El Comité no se hace responsable por la falta de estos materiales.
• "Fomentando el pensamiento, la estrategia y la sana competencia."`,
  indicacionesPago: `Realiza tu aportación de $200.00 MXN en efectivo en sede autorizada o por transferencia bancaria SPEI a la cuenta oficial configurada por el comité. Sube la foto o captura de tu comprobante de pago al momento de inscribirte.`,
};

function createSponsorBadgeSvg(
  initials: string,
  subtitle: string,
  bgFrom: string,
  bgTo: string,
  accent: string
): string {
  const safeInitials = initials.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeSub = subtitle.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgFrom}"/>
        <stop offset="100%" stop-color="${bgTo}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="240" rx="20" fill="url(#g)"/>
    <rect x="12" y="12" width="376" height="216" rx="14" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="2"/>
    <circle cx="200" cy="96" r="46" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-width="2.5"/>
    <text x="200" y="111" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="38" fill="${accent}">${safeInitials}</text>
    <text x="200" y="176" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="16" letter-spacing="1.5" fill="#ffffff">${safeSub}</text>
    <text x="200" y="202" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="500" font-size="11" letter-spacing="2" fill="${accent}" fill-opacity="0.9">PATROCINADOR OFICIAL</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const INITIAL_SPONSORS: Sponsor[] = [
  { id: 'sponsor-01', nombre: 'Tatuajes Durango', categoriaSponsor: 'Estudio & Sede de Registro', logo: createSponsorBadgeSvg('TD', 'TATUAJES DURANGO', '#18181b', '#27272a', '#facc15'), enlace: 'https://www.facebook.com/tatuajesdurango', activo: true, orden: 1 },
  { id: 'sponsor-02', nombre: 'Omega Producciones', categoriaSponsor: 'Audio e Iluminación', logo: createSponsorBadgeSvg('Ω', 'OMEGA PRODUCCIONES', '#0f172a', '#1e1b4b', '#38bdf8'), enlace: '#', activo: true, orden: 2 },
  { id: 'sponsor-03', nombre: 'Durango Incode Paranoc', categoriaSponsor: 'Deporte & Comunidad', logo: createSponsorBadgeSvg('IP', 'INCODE PARANOC', '#064e3b', '#022c22', '#fbbf24'), enlace: '#', activo: true, orden: 3 },
  { id: 'sponsor-04', nombre: 'Muscari Floristería', categoriaSponsor: 'Diseño Floral', logo: createSponsorBadgeSvg('MF', 'MUSCARI FLORISTERÍA', '#3b0764', '#1e1b4b', '#f9a8d4'), enlace: '#', activo: true, orden: 4 },
  { id: 'sponsor-05', nombre: 'K-awiil Fabricamos tus ideas', categoriaSponsor: 'Creatividad & Diseño', logo: createSponsorBadgeSvg('KA', 'K-AWIIL IDEAS', '#450a0a', '#7f1d1d', '#fde047'), enlace: '#', activo: true, orden: 5 },
  { id: 'sponsor-06', nombre: 'Marcos Constitución', categoriaSponsor: 'Enmarcado & Arte', logo: createSponsorBadgeSvg('MC', 'MARCOS CONSTITUCIÓN', '#0c4a6e', '#082f49', '#7dd3fc'), enlace: '#', activo: true, orden: 6 },
  { id: 'sponsor-07', nombre: 'Efrén Alejandro Poe', categoriaSponsor: 'Desde 2016', logo: createSponsorBadgeSvg('EP', 'EFRÉN ALEJANDRO POE', '#1c1917', '#292524', '#f59e0b'), enlace: '#', activo: true, orden: 7 },
  { id: 'sponsor-08', nombre: 'Librería Plaza', categoriaSponsor: 'Cultura desde 1950', logo: createSponsorBadgeSvg('LP', 'LIBRERÍA PLAZA', '#422006', '#713f12', '#fde68a'), enlace: '#', activo: true, orden: 8 },
  { id: 'sponsor-09', nombre: 'Corredor Constitución', categoriaSponsor: 'Empresarios Zona Centro', logo: createSponsorBadgeSvg('CC', 'CORREDOR CONSTITUCIÓN', '#14532d', '#052e16', '#facc15'), enlace: 'https://durango.gob.mx', activo: true, orden: 9 },
  { id: 'sponsor-10', nombre: 'Taco Full', categoriaSponsor: 'Gastronomía Local', logo: createSponsorBadgeSvg('TF', 'TACO FULL', '#7c2d12', '#431407', '#fbbf24'), enlace: '#', activo: true, orden: 10 },
  { id: 'sponsor-11', nombre: 'Gabino Restaurante', categoriaSponsor: 'Cocina Duranguense', logo: createSponsorBadgeSvg('GR', 'GABINO RESTAURANTE', '#1f2937', '#111827', '#eab308'), enlace: '#', activo: true, orden: 11 },
  { id: 'sponsor-12', nombre: 'Kupuri', categoriaSponsor: 'Arte & Cultura', logo: createSponsorBadgeSvg('KP', 'KUPURI', '#292524', '#1c1917', '#fbbf24'), enlace: '#', activo: true, orden: 12 },
  { id: 'sponsor-13', nombre: 'Metal Storm Rock Shop', categoriaSponsor: 'Música & Estilo', logo: createSponsorBadgeSvg('MS', 'METAL STORM', '#18181b', '#3f0f1c', '#f87171'), enlace: '#', activo: true, orden: 13 },
  { id: 'sponsor-14', nombre: 'Killer Sushi', categoriaSponsor: 'Sushi Bar', logo: createSponsorBadgeSvg('KS', 'KILLER SUSHI', '#0f172a', '#1e293b', '#f43f5e'), enlace: '#', activo: true, orden: 14 },
  { id: 'sponsor-15', nombre: 'Ramen Kuri', categoriaSponsor: 'Cocina Japonesa', logo: createSponsorBadgeSvg('RK', 'RAMEN KURI', '#7f1d1d', '#450a0a', '#fca5a5'), enlace: '#', activo: true, orden: 15 },
  { id: 'sponsor-16', nombre: 'Chimoca', categoriaSponsor: 'Sabores Artesanales', logo: createSponsorBadgeSvg('CH', 'CHIMOCA', '#4c1d95', '#2e1065', '#fcd34d'), enlace: '#', activo: true, orden: 16 },
  { id: 'sponsor-17', nombre: 'Monsters Bar', categoriaSponsor: 'Entretenimiento', logo: createSponsorBadgeSvg('MB', 'MONSTERS BAR', '#1e1b4b', '#312e81', '#a78bfa'), enlace: '#', activo: true, orden: 17 },
  { id: 'sponsor-18', nombre: 'Corleone Pizza', categoriaSponsor: 'Pizzería Artesanal', logo: createSponsorBadgeSvg('CP', 'CORLEONE PIZZA', '#7c2d12', '#450a0a', '#fde047'), enlace: '#', activo: true, orden: 18 },
  { id: 'sponsor-19', nombre: 'Durango Gift Souvenirs', categoriaSponsor: 'Regalos & Recuerdos', logo: createSponsorBadgeSvg('DG', 'DURANGO GIFT', '#065f46', '#064e3b', '#facc15'), enlace: '#', activo: true, orden: 19 },
  { id: 'sponsor-20', nombre: 'Corona Wings', categoriaSponsor: 'Alitas & Grill', logo: createSponsorBadgeSvg('CW', 'CORONA WINGS', '#78350f', '#451a03', '#fbbf24'), enlace: '#', activo: true, orden: 20 },
  { id: 'sponsor-21', nombre: "California's Sport Bar", categoriaSponsor: 'Sports & Food', logo: createSponsorBadgeSvg('CS', "CALIFORNIA'S BAR", '#1e3a8a', '#172554', '#facc15'), enlace: '#', activo: true, orden: 21 },
  { id: 'sponsor-22', nombre: 'Paletas del Rey', categoriaSponsor: 'Paletería Tradicional', logo: createSponsorBadgeSvg('PR', 'PALETAS DEL REY', '#0c4a6e', '#0369a1', '#fde047'), enlace: '#', activo: true, orden: 22 },
  { id: 'sponsor-23', nombre: 'Café Madrid', categoriaSponsor: 'Tradición desde 1946', logo: createSponsorBadgeSvg('CM', 'CAFÉ MADRID 1946', '#451a03', '#271002', '#fcd34d'), enlace: '#', activo: true, orden: 23 },
  { id: 'sponsor-24', nombre: 'Ámbar Café', categoriaSponsor: 'Cafetería de Especialidad', logo: createSponsorBadgeSvg('AC', 'ÁMBAR CAFÉ', '#78350f', '#451a03', '#fde68a'), enlace: '#', activo: true, orden: 24 },
  { id: 'sponsor-25', nombre: 'Conservas Bacifia', categoriaSponsor: 'Productos Regionales', logo: createSponsorBadgeSvg('CB', 'CONSERVAS BACIFIA', '#7f1d1d', '#450a0a', '#fcd34d'), enlace: '#', activo: true, orden: 25 },
];
