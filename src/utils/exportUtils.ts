import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Participant, TournamentConfig } from '../types/tournament';
import {
  buildParticipantExportRows,
  buildTournamentExportSummary,
} from './tournamentUtils';

interface ExportOptions {
  participants: Participant[];
  config: TournamentConfig;
  isAdminExport: boolean;
}

/**
 * Generates and downloads a formatted multi-page PDF roster using jsPDF + autoTable.
 */
export function exportParticipantsToPDF({
  participants,
  config,
  isAdminExport,
}: ExportOptions): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rows = buildParticipantExportRows(participants, {
    includeAdminReceiptLinks: isAdminExport,
    origin,
  });
  const summary = buildTournamentExportSummary(participants, config);
  const nowStr = new Date().toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Header Banner
  doc.setFillColor(11, 51, 32); // Emerald 950
  doc.rect(0, 0, 297, 30, 'F');
  doc.setFillColor(250, 204, 21); // Amber 400 accent line
  doc.rect(0, 30, 297, 2, 'F');

  doc.setTextColor(253, 224, 71);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${(config.titulo || 'TORNEO DEL PAVO 2.0').toUpperCase()}`, 14, 13);

  doc.setTextColor(220, 252, 231);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `${config.club} · ${config.fecha} · ${config.hora} · ${config.lugar}`,
    14,
    20
  );
  doc.setFontSize(8.5);
  doc.text(
    `${isAdminExport ? 'REPORTE ADMINISTRATIVO CONFIDENCIAL (CON COMPROBANTES)' : 'PADRÓN OFICIAL PÚBLICO DE INSCRITOS'} · Generado: ${nowStr}`,
    14,
    26
  );

  // KPI Summary Strip
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, 36, 269, 14, 2, 2, 'FD');

  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const kpiLine = isAdminExport
    ? `Inscritos: ${summary.totalInscritos}/${summary.cupoMaximo}   |   Pagados: ${summary.totalPagados}   |   Pendientes: ${summary.totalPendientes}   |   Con Recibo: ${summary.totalConRecibo}   |   Juvenil: ${summary.totalJuvenil}   |   Libre: ${summary.totalLibre}   |   Recaudado: $${summary.recaudacionConfirmada.toLocaleString('es-MX')} MXN`
    : `Total Inscritos: ${summary.totalInscritos}/${summary.cupoMaximo}   |   Confirmados: ${summary.totalPagados}   |   Pendientes: ${summary.totalPendientes}   |   Juvenil: ${summary.totalJuvenil}   |   Libre: ${summary.totalLibre}   |   Aficionados: ${summary.totalAficionados}   |   Femenil: ${summary.totalFemenil}`;
  doc.text(kpiLine, 18, 44.5);

  // Table Columns & Body
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
          'Recibo / Link Admin',
        ],
      ]
    : [
        [
          '#',
          'Folio',
          'Nombre Completo',
          'Categoría',
          'Edad',
          'Distinciones',
          'Estatus Pago',
          'Fecha Registro',
        ],
      ];

  const body = rows.map((r, index) => {
    const distinctions = [
      r.aficionado === 'Sí' ? 'Aficionado' : '',
      r.femenil === 'Sí' ? 'Femenil' : '',
    ]
      .filter(Boolean)
      .join(', ') || '-';

    if (isAdminExport) {
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
    }

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
          4: { cellWidth: 20 },
          5: { cellWidth: 36 },
          6: { cellWidth: 28 },
          7: { cellWidth: 43 },
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
 * Generates and downloads a real multi-sheet Excel (.xlsx) workbook using SheetJS.
 */
export function exportParticipantsToExcel({
  participants,
  config,
  isAdminExport,
}: ExportOptions): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rows = buildParticipantExportRows(participants, {
    includeAdminReceiptLinks: isAdminExport,
    origin,
  });
  const summary = buildTournamentExportSummary(participants, config);

  const toSheetObject = (r: (typeof rows)[number], idx: number) => {
    const base: Record<string, string | number> = {
      '#': idx + 1,
      Folio: r.folio,
      'Nombre Completo': r.nombre,
      Categoría: r.categoria,
      Edad: r.edad,
      'Fecha Nacimiento': r.fechaNacimiento,
      'Postulado Mejor Aficionado': r.aficionado,
      'Postulada Mejor Femenil': r.femenil,
      'Estatus Pago': r.estatusPago,
      'Fecha Registro': r.fechaRegistro,
    };

    if (isAdminExport) {
      return {
        '#': idx + 1,
        Folio: r.folio,
        'Nombre Completo': r.nombre,
        Categoría: r.categoria,
        Edad: r.edad,
        'Fecha Nacimiento': r.fechaNacimiento,
        'Mejor Aficionado': r.aficionado,
        'Mejor Femenil': r.femenil,
        WhatsApp: r.whatsapp,
        'Correo Electrónico': r.correo,
        'Estatus Pago': r.estatusPago,
        'Recibo Subido': r.reciboEstado,
        'Link Recibo (Solo Admin)': r.reciboLink || 'Sin comprobante',
        'Fecha Registro': r.fechaRegistro,
      };
    }

    return base;
  };

  const wb = XLSX.utils.book_new();

  // Sheet 1: All participants
  const allData = rows.map(toSheetObject);
  const wsAll = XLSX.utils.json_to_sheet(allData.length > 0 ? allData : [{ Aviso: 'Sin registros aún' }]);
  wsAll['!cols'] = isAdminExport
    ? [
        { wch: 5 },
        { wch: 14 },
        { wch: 32 },
        { wch: 14 },
        { wch: 10 },
        { wch: 15 },
        { wch: 16 },
        { wch: 14 },
        { wch: 15 },
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 52 },
        { wch: 20 },
      ]
    : [
        { wch: 5 },
        { wch: 14 },
        { wch: 34 },
        { wch: 15 },
        { wch: 10 },
        { wch: 16 },
        { wch: 22 },
        { wch: 20 },
        { wch: 14 },
        { wch: 20 },
      ];
  XLSX.utils.book_append_sheet(wb, wsAll, 'Todos los Inscritos');

  // Sheet 2: Juvenil
  const juvenilRows = rows.filter((r) => r.categoria === 'Juvenil' || r.categoria === 'Niños');
  const wsJuvenil = XLSX.utils.json_to_sheet(
    juvenilRows.length > 0 ? juvenilRows.map(toSheetObject) : [{ Aviso: 'Sin registros en Juvenil' }]
  );
  XLSX.utils.book_append_sheet(wb, wsJuvenil, 'Categoría Juvenil');

  // Sheet 3: Libre
  const libreRows = rows.filter(
    (r) =>
      r.categoria === 'Libre' ||
      r.categoria.startsWith('Libre') ||
      r.categoria === 'Aficionados' ||
      r.categoria === 'Rankeado'
  );
  const wsLibre = XLSX.utils.json_to_sheet(
    libreRows.length > 0 ? libreRows.map(toSheetObject) : [{ Aviso: 'Sin registros en Libre' }]
  );
  XLSX.utils.book_append_sheet(wb, wsLibre, 'Categoría Libre');

  // Sheet 4: Summary
  const summaryRows = [
    { Indicador: 'Torneo', Valor: config.titulo },
    { Indicador: 'Club Organizador', Valor: config.club },
    { Indicador: 'Fecha del Evento', Valor: `${config.fecha} · ${config.hora}` },
    { Indicador: 'Sede', Valor: config.lugar },
    { Indicador: 'Total Inscritos', Valor: summary.totalInscritos },
    { Indicador: 'Cupo Máximo', Valor: summary.cupoMaximo },
    { Indicador: 'Lugares Disponibles', Valor: summary.lugaresDisponibles },
    { Indicador: 'Pagados / Confirmados', Valor: summary.totalPagados },
    { Indicador: 'Pendientes de Validación', Valor: summary.totalPendientes },
    { Indicador: 'Con Recibo Adjunto', Valor: summary.totalConRecibo },
    { Indicador: 'Categoría Juvenil', Valor: summary.totalJuvenil },
    { Indicador: 'Categoría Libre', Valor: summary.totalLibre },
    { Indicador: 'Postulados Mejor Aficionado', Valor: summary.totalAficionados },
    { Indicador: 'Postuladas Mejor Femenil', Valor: summary.totalFemenil },
    ...(isAdminExport
      ? [
          {
            Indicador: 'Recaudación Confirmada (MXN)',
            Valor: `$${summary.recaudacionConfirmada.toLocaleString('es-MX')}`,
          },
          {
            Indicador: 'Recaudación Proyectada Total (MXN)',
            Valor: `$${summary.recaudacionEsperada.toLocaleString('es-MX')}`,
          },
        ]
      : []),
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 46 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = isAdminExport
    ? `Torneo_del_Pavo_2.0_Admin_Inscritos_${dateSlug}.xlsx`
    : `Torneo_del_Pavo_2.0_Padron_Oficial_${dateSlug}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

/**
 * Generates and downloads a UTF-8 BOM CSV file.
 */
export function exportParticipantsToCSV({
  participants,
  isAdminExport,
}: Omit<ExportOptions, 'config'>): void {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rows = buildParticipantExportRows(participants, {
    includeAdminReceiptLinks: isAdminExport,
    origin,
  });

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
        'Recibo',
        'Link Recibo (Solo Admin)',
        'Fecha Registro',
      ]
    : [
        'Folio',
        'Nombre Completo',
        'Categoría',
        'Edad',
        'Aficionado',
        'Femenil',
        'Estatus Pago',
        'Fecha Registro',
      ];

  const csvRows = rows.map((r) => {
    const escape = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    if (isAdminExport) {
      return [
        escape(r.folio),
        escape(r.nombre),
        escape(r.categoria),
        escape(r.edad),
        escape(r.fechaNacimiento),
        escape(r.aficionado),
        escape(r.femenil),
        escape(r.whatsapp),
        escape(r.correo),
        escape(r.estatusPago),
        escape(r.reciboEstado),
        escape(r.reciboLink || ''),
        escape(r.fechaRegistro),
      ].join(',');
    }
    return [
      escape(r.folio),
      escape(r.nombre),
      escape(r.categoria),
      escape(r.edad),
      escape(r.aficionado),
      escape(r.femenil),
      escape(r.estatusPago),
      escape(r.fechaRegistro),
    ].join(',');
  });

  const blob = new Blob(['\uFEFF' + [headers.join(','), ...csvRows].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateSlug = new Date().toISOString().slice(0, 10);
  link.download = isAdminExport
    ? `Torneo_del_Pavo_2.0_Admin_Inscritos_${dateSlug}.csv`
    : `Torneo_del_Pavo_2.0_Padron_Oficial_${dateSlug}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
