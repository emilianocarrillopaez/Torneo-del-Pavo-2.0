import { Participant, PublicParticipant, TournamentConfig, WaitlistEntry } from '../types/tournament';
import {
  buildParticipantExportRows,
  buildPublicExportRows,
  buildSwissPairingRows,
  buildTournamentExportSummary,
  sanitizeSpreadsheetCell,
} from './tournamentUtils';

interface AdminExportOptions {
  participants: Participant[];
  config: TournamentConfig;
  isAdminExport: true;
}

interface PublicExportOptions {
  participants: PublicParticipant[];
  config: TournamentConfig;
  isAdminExport: false;
}

type ExportOptions = AdminExportOptions | PublicExportOptions;

const CONFIDENTIAL_NOTICE =
  'CONFIDENCIAL: CONTIENE DATOS PERSONALES — USO EXCLUSIVO DEL COMITÉ ORGANIZADOR';

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates and downloads a formatted multi-page PDF roster using lazy-loaded jsPDF + autoTable.
 * Public exports strictly exclude all contact, birthdate, and receipt details.
 */
export async function exportParticipantsToPDF(options: ExportOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const { participants, config, isAdminExport } = options;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const summary = buildTournamentExportSummary(participants, config);
  const nowStr = new Date().toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Header Banner
  doc.setFillColor(11, 51, 32);
  doc.rect(0, 0, 297, 32, 'F');
  doc.setFillColor(250, 204, 21);
  doc.rect(0, 32, 297, 2, 'F');

  doc.setTextColor(253, 224, 71);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${(config.titulo || 'TORNEO DEL PAVO 2.0').toUpperCase()}`, 14, 12);

  doc.setTextColor(220, 252, 231);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`${config.club} · ${config.fecha} · ${config.hora} · ${config.lugar}`, 14, 19);

  if (isAdminExport) {
    doc.setTextColor(252, 165, 165);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`${CONFIDENTIAL_NOTICE} · Generado: ${nowStr}`, 14, 26);
  } else {
    doc.setFontSize(8.5);
    doc.text(`PADRÓN OFICIAL PÚBLICO DE INSCRITOS · Generado: ${nowStr}`, 14, 26);
  }

  // KPI Summary Strip
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, 37, 269, 13, 2, 2, 'FD');

  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const kpiLine = isAdminExport
    ? `Inscritos: ${summary.totalInscritos}/${summary.cupoMaximo}   |   Pagados: ${summary.totalPagados}   |   Pendientes: ${summary.totalPendientes}   |   Con Recibo: ${summary.totalConRecibo}   |   Juvenil: ${summary.totalJuvenil}   |   Libre: ${summary.totalLibre}   |   Recaudado: $${summary.recaudacionConfirmada.toLocaleString('es-MX')} MXN`
    : `Total Inscritos: ${summary.totalInscritos}/${summary.cupoMaximo}   |   Confirmados: ${summary.totalPagados}   |   Pendientes: ${summary.totalPendientes}   |   Juvenil: ${summary.totalJuvenil}   |   Libre: ${summary.totalLibre}   |   Aficionados: ${summary.totalAficionados}   |   Femenil: ${summary.totalFemenil}`;
  doc.text(kpiLine, 18, 45);

  const head = isAdminExport
    ? [
        [
          '#',
          'Folio',
          'Nombre Completo',
          'Cat.',
          'Edad',
          'Distinciones',
          'WhatsApp',
          'Correo',
          'Pago',
          'Recibo (Estado / Link Admin)',
        ],
      ]
    : [
        [
          '#',
          'Folio',
          'Participante',
          'Categoría',
          'Edad / Rango',
          'Distinciones',
          'Estatus Pago',
          'Fecha Registro',
        ],
      ];

  const body = isAdminExport
    ? buildParticipantExportRows(options.participants, {
        includeAdminReceiptLinks: true,
        origin,
        eventFechaIso: config.fechaIso,
      }).map((r, index) => {
        const distinctions =
          [r.aficionado === 'Sí' ? 'Aficionado' : '', r.femenil === 'Sí' ? 'Femenil' : '']
            .filter(Boolean)
            .join(', ') || '-';
        return [
          String(index + 1),
          r.folio,
          r.nombre,
          r.categoria,
          r.edad,
          distinctions,
          r.whatsapp,
          r.correo,
          r.estatusPago,
          r.reciboEstado === 'Adjunto' ? `Adjunto (${r.reciboLink})` : 'Sin recibo',
        ];
      })
    : buildPublicExportRows(options.participants).map((r, index) => {
        const distinctions =
          [r.aficionado === 'Sí' ? 'Aficionado' : '', r.femenil === 'Sí' ? 'Femenil' : '']
            .filter(Boolean)
            .join(', ') || '-';
        return [
          String(index + 1),
          r.folio,
          r.nombre,
          r.categoria,
          r.edad,
          distinctions,
          r.estatusPago,
          r.fechaRegistro,
        ];
      });

  autoTable(doc, {
    startY: 54,
    head,
    body,
    theme: 'grid',
    styles: {
      fontSize: isAdminExport ? 7.5 : 8.5,
      cellPadding: 2.5,
      overflow: 'linebreak',
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [6, 78, 59],
      textColor: [254, 240, 138],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: isAdminExport
      ? {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 22, fontStyle: 'bold' },
          2: { cellWidth: 48 },
          3: { cellWidth: 18 },
          4: { cellWidth: 15 },
          5: { cellWidth: 24 },
          6: { cellWidth: 23 },
          7: { cellWidth: 38 },
          8: { cellWidth: 18 },
          9: { cellWidth: 54, fontSize: 6.5 },
        }
      : {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 28, fontStyle: 'bold' },
          2: { cellWidth: 74 },
          3: { cellWidth: 30 },
          4: { cellWidth: 24 },
          5: { cellWidth: 34 },
          6: { cellWidth: 28 },
          7: { cellWidth: 41 },
        },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${config.club} · ${config.titulo} · Página ${data.pageNumber} de ${pageCount}`,
        14,
        203
      );
    },
  });

  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = isAdminExport
    ? `Torneo_del_Pavo_2.0_Admin_Inscritos_${dateSlug}.pdf`
    : `Torneo_del_Pavo_2.0_Padron_Oficial_${dateSlug}.pdf`;

  doc.save(fileName);
}

/**
 * Generates and downloads a multi-sheet Excel (.xlsx) workbook using lazy-loaded ExcelJS
 * with cell formula-injection sanitization and confidentiality banners.
 */
export async function exportParticipantsToExcel(options: ExportOptions): Promise<void> {
  const { participants, config, isAdminExport } = options;
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.club || 'Club de Ajedrez Don Gonzalo';
  workbook.created = new Date();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const summary = buildTournamentExportSummary(participants, config);

  const columnsAdmin = [
    { header: '#', key: 'num', width: 6 },
    { header: 'Folio', key: 'folio', width: 16 },
    { header: 'Nombre Completo', key: 'nombre', width: 32 },
    { header: 'Categoría', key: 'categoria', width: 14 },
    { header: 'Edad', key: 'edad', width: 11 },
    { header: 'Fecha Nacimiento', key: 'fechaNacimiento', width: 16 },
    { header: 'Mejor Aficionado', key: 'aficionado', width: 16 },
    { header: 'Mejor Femenil', key: 'femenil', width: 15 },
    { header: 'WhatsApp', key: 'whatsapp', width: 15 },
    { header: 'Correo Electrónico', key: 'correo', width: 28 },
    { header: 'Estatus Pago', key: 'estatusPago', width: 14 },
    { header: 'Check-in', key: 'asistencia', width: 12 },
    { header: 'Recibo Subido', key: 'reciboEstado', width: 14 },
    { header: 'Link Recibo (Solo Admin)', key: 'reciboLink', width: 52 },
    { header: 'Fecha Registro', key: 'fechaRegistro', width: 20 },
  ];

  const columnsPublic = [
    { header: '#', key: 'num', width: 6 },
    { header: 'Folio', key: 'folio', width: 16 },
    { header: 'Participante', key: 'nombre', width: 32 },
    { header: 'Categoría', key: 'categoria', width: 14 },
    { header: 'Edad / Rango', key: 'edad', width: 16 },
    { header: 'Postulado Mejor Aficionado', key: 'aficionado', width: 24 },
    { header: 'Postulada Mejor Femenil', key: 'femenil', width: 22 },
    { header: 'Estatus Pago', key: 'estatusPago', width: 14 },
    { header: 'Fecha Registro', key: 'fechaRegistro', width: 20 },
  ];

  const preparedRows = isAdminExport
    ? buildParticipantExportRows(options.participants, {
        includeAdminReceiptLinks: true,
        origin,
        eventFechaIso: config.fechaIso,
      })
    : buildPublicExportRows(options.participants);

  const addParticipantSheet = (sheetName: string, rowsSubset: typeof preparedRows) => {
    const ws = workbook.addWorksheet(sheetName);
    const cols = isAdminExport ? columnsAdmin : columnsPublic;

    const bannerText = isAdminExport
      ? `${CONFIDENTIAL_NOTICE} · ${config.titulo}`
      : `PADRÓN OFICIAL PÚBLICO · ${config.titulo} (${config.club})`;
    ws.addRow([sanitizeSpreadsheetCell(bannerText)]);
    ws.mergeCells(1, 1, 1, cols.length);
    const bannerCell = ws.getCell(1, 1);
    bannerCell.font = {
      bold: true,
      size: 11,
      color: { argb: isAdminExport ? 'FF991B1B' : 'FF064E3B' },
    };
    bannerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isAdminExport ? 'FFFEE2E2' : 'FFD1FAE5' },
    };

    const headerRow = ws.addRow(cols.map((c) => c.header));
    headerRow.font = { bold: true, color: { argb: 'FFFEF08A' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF064E3B' },
      };
    });

    cols.forEach((col, i) => {
      ws.getColumn(i + 1).width = col.width;
    });

    if (rowsSubset.length === 0) {
      ws.addRow(['Sin registros en esta categoría']);
      return;
    }

    rowsSubset.forEach((r, idx) => {
      if (isAdminExport) {
        const adminRow = r as ReturnType<typeof buildParticipantExportRows>[number];
        ws.addRow([
          idx + 1,
          sanitizeSpreadsheetCell(adminRow.folio),
          sanitizeSpreadsheetCell(adminRow.nombre),
          sanitizeSpreadsheetCell(adminRow.categoria),
          sanitizeSpreadsheetCell(adminRow.edad),
          sanitizeSpreadsheetCell(adminRow.fechaNacimiento),
          sanitizeSpreadsheetCell(adminRow.aficionado),
          sanitizeSpreadsheetCell(adminRow.femenil),
          sanitizeSpreadsheetCell(adminRow.whatsapp),
          sanitizeSpreadsheetCell(adminRow.correo),
          sanitizeSpreadsheetCell(adminRow.estatusPago),
          sanitizeSpreadsheetCell(adminRow.asistencia),
          sanitizeSpreadsheetCell(adminRow.reciboEstado),
          sanitizeSpreadsheetCell(adminRow.reciboLink || 'Sin comprobante'),
          sanitizeSpreadsheetCell(adminRow.fechaRegistro),
        ]);
      } else {
        const pubRow = r as ReturnType<typeof buildPublicExportRows>[number];
        ws.addRow([
          idx + 1,
          sanitizeSpreadsheetCell(pubRow.folio),
          sanitizeSpreadsheetCell(pubRow.nombre),
          sanitizeSpreadsheetCell(pubRow.categoria),
          sanitizeSpreadsheetCell(pubRow.edad),
          sanitizeSpreadsheetCell(pubRow.aficionado),
          sanitizeSpreadsheetCell(pubRow.femenil),
          sanitizeSpreadsheetCell(pubRow.estatusPago),
          sanitizeSpreadsheetCell(pubRow.fechaRegistro),
        ]);
      }
    });
  };

  addParticipantSheet('Todos los Inscritos', preparedRows);
  addParticipantSheet(
    'Categoría Juvenil',
    preparedRows.filter((r) => r.categoria === 'Juvenil')
  );
  addParticipantSheet(
    'Categoría Libre',
    preparedRows.filter((r) => r.categoria === 'Libre')
  );

  const wsSummary = workbook.addWorksheet('Resumen');
  wsSummary.getColumn(1).width = 36;
  wsSummary.getColumn(2).width = 48;
  if (isAdminExport) {
    const warn = wsSummary.addRow([CONFIDENTIAL_NOTICE]);
    warn.font = { bold: true, color: { argb: 'FF991B1B' } };
  }
  const summaryHead = wsSummary.addRow(['Indicador', 'Valor']);
  summaryHead.font = { bold: true };

  const summaryItems: Array<[string, string | number]> = [
    ['Torneo', config.titulo],
    ['Club Organizador', config.club],
    ['Fecha del Evento', `${config.fecha} · ${config.hora}`],
    ['Sede', config.lugar],
    ['Total Inscritos', summary.totalInscritos],
    ['Cupo Máximo', summary.cupoMaximo],
    ['Lugares Disponibles', summary.lugaresDisponibles],
    ['Pagados / Confirmados', summary.totalPagados],
    ['Pendientes de Validación', summary.totalPendientes],
    ['Categoría Juvenil', summary.totalJuvenil],
    ['Categoría Libre', summary.totalLibre],
    ['Postulados Mejor Aficionado', summary.totalAficionados],
    ['Postuladas Mejor Femenil', summary.totalFemenil],
  ];

  if (isAdminExport) {
    summaryItems.push(
      ['Asistencias Registradas (Check-in)', summary.totalAsistencias],
      ['Con Recibo Adjunto', summary.totalConRecibo],
      [
        'Recaudación Confirmada (MXN)',
        `$${summary.recaudacionConfirmada.toLocaleString('es-MX')}`,
      ],
      [
        'Recaudación Proyectada Total (MXN)',
        `$${summary.recaudacionEsperada.toLocaleString('es-MX')}`,
      ]
    );
  }

  for (const [label, val] of summaryItems) {
    wsSummary.addRow([sanitizeSpreadsheetCell(label), sanitizeSpreadsheetCell(val)]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = isAdminExport
    ? `Torneo_del_Pavo_2.0_Admin_Inscritos_${dateSlug}.xlsx`
    : `Torneo_del_Pavo_2.0_Padron_Oficial_${dateSlug}.xlsx`;

  triggerBlobDownload(blob, fileName);
}

/**
 * Generates and downloads a UTF-8 BOM CSV file with formula neutralization.
 */
export function exportParticipantsToCSV(
  options:
    | { participants: Participant[]; isAdminExport: true; eventFechaIso?: string }
    | { participants: PublicParticipant[]; isAdminExport: false }
): void {
  const { isAdminExport } = options;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const headers = isAdminExport
    ? [
        'Folio',
        'Nombre Completo',
        'Categoría',
        'Edad',
        'Fecha Nacimiento',
        'Aficionado',
        'Femenil',
        'WhatsApp',
        'Correo Electrónico',
        'Estatus Pago',
        'Check-in',
        'Recibo',
        'Link Recibo (Solo Admin)',
        'Fecha Registro',
      ]
    : [
        'Folio',
        'Participante',
        'Categoría',
        'Edad / Rango',
        'Aficionado',
        'Femenil',
        'Estatus Pago',
        'Fecha Registro',
      ];

  const escapeCsv = (val: unknown) => {
    const safe = sanitizeSpreadsheetCell(val);
    return `"${String(safe).replace(/"/g, '""')}"`;
  };

  const csvRows = isAdminExport
    ? buildParticipantExportRows(options.participants, {
        includeAdminReceiptLinks: true,
        origin,
        eventFechaIso: options.eventFechaIso,
      }).map((r) =>
        [
          escapeCsv(r.folio),
          escapeCsv(r.nombre),
          escapeCsv(r.categoria),
          escapeCsv(r.edad),
          escapeCsv(r.fechaNacimiento),
          escapeCsv(r.aficionado),
          escapeCsv(r.femenil),
          escapeCsv(r.whatsapp),
          escapeCsv(r.correo),
          escapeCsv(r.estatusPago),
          escapeCsv(r.asistencia),
          escapeCsv(r.reciboEstado),
          escapeCsv(r.reciboLink || ''),
          escapeCsv(r.fechaRegistro),
        ].join(',')
      )
    : buildPublicExportRows(options.participants).map((r) =>
        [
          escapeCsv(r.folio),
          escapeCsv(r.nombre),
          escapeCsv(r.categoria),
          escapeCsv(r.edad),
          escapeCsv(r.aficionado),
          escapeCsv(r.femenil),
          escapeCsv(r.estatusPago),
          escapeCsv(r.fechaRegistro),
        ].join(',')
      );

  const lines = isAdminExport
    ? [`"${CONFIDENTIAL_NOTICE}"`, headers.join(','), ...csvRows]
    : [headers.join(','), ...csvRows];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = isAdminExport
    ? `Torneo_del_Pavo_2.0_Admin_Inscritos_${dateSlug}.csv`
    : `Torneo_del_Pavo_2.0_Padron_Oficial_${dateSlug}.csv`;

  triggerBlobDownload(blob, fileName);
}

/**
 * Exportación CSV compatible con software de emparejamiento suizo (Swiss-Manager / Vega).
 */
export function exportSwissPairingCSV(participants: Participant[]): void {
  const rows = buildSwissPairingRows(participants);
  const escapeCsv = (val: unknown) => {
    const safe = sanitizeSpreadsheetCell(val);
    return `"${String(safe).replace(/"/g, '""')}"`;
  };

  const header = ['No', 'Name', 'FED', 'Sex', 'Birthday', 'Category', 'Folio', 'Paid'].join(',');
  const lines = rows.map((r) =>
    [
      escapeCsv(r.num),
      escapeCsv(r.name),
      escapeCsv(r.fed),
      escapeCsv(r.sex),
      escapeCsv(r.birthYear),
      escapeCsv(r.category),
      escapeCsv(r.folio),
      escapeCsv(r.paid),
    ].join(',')
  );

  const blob = new Blob(['\uFEFF' + [header, ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const dateSlug = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `Torneo_del_Pavo_2.0_Emparejamiento_Suizo_${dateSlug}.csv`);
}

/**
 * Respaldo completo en JSON (solo administrador, incluye participantes y lista de espera).
 */
export function exportFullBackupJson(
  participants: Participant[],
  waitlist: WaitlistEntry[],
  config: TournamentConfig
): void {
  const payload = {
    avisoConfidencialidad: CONFIDENTIAL_NOTICE,
    exportadoEn: new Date().toISOString(),
    configuracion: config,
    participantes: participants,
    listaEspera: waitlist,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const dateSlug = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `Torneo_del_Pavo_2.0_Respaldo_Admin_${dateSlug}.json`);
}
