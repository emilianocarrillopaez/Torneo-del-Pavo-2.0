import React, { useState, useEffect } from 'react';
import { TournamentConfig } from '../../types/tournament';
import {
  updateTournamentConfig,
  restoreDefaultConfigAndSponsors,
} from '../../services/tournamentService';
import { safeHttpUrl, deriveAgeCutoffs } from '../../utils/tournamentUtils';
import { AdminConfirmDialog } from './AdminParticipantModals';
import {
  Save,
  Loader2,
  Calendar,
  CreditCard,
  FileText,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
} from 'lucide-react';

interface AdminContentTabProps {
  config: TournamentConfig;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onModalOpenChange?: (isOpen: boolean) => void;
}

export const AdminContentTab: React.FC<AdminContentTabProps> = ({
  config,
  onNotify,
  onModalOpenChange,
}) => {
  const [form, setForm] = useState<TournamentConfig>(config);
  const [saving, setSaving] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const [prevConfig, setPrevConfig] = useState<TournamentConfig>(config);
  if (prevConfig !== config) {
    setPrevConfig(config);
    setForm(config);
  }

  useEffect(() => {
    onModalOpenChange?.(showRestoreConfirm);
  }, [showRestoreConfirm, onModalOpenChange]);

  const cutoffs = deriveAgeCutoffs(form.fechaIso);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeMapa = form.mapaUrl ? safeHttpUrl(form.mapaUrl, { allowHash: true }) : '';
    if (form.mapaUrl && safeMapa === null) {
      onNotify('La URL del mapa debe comenzar con https:// o ser #.', 'error');
      return;
    }

    if (form.fechaLimiteIso && Number.isNaN(Date.parse(form.fechaLimiteIso))) {
      onNotify('El formato de fecha límite ISO no es válido (ej. 2026-12-19T15:30:00-06:00).', 'error');
      return;
    }

    if (form.fechaIso && Number.isNaN(Date.parse(form.fechaIso))) {
      onNotify('El formato de fecha del evento ISO no es válido (ej. 2026-12-19T16:30:00-06:00).', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateTournamentConfig({
        ...form,
        mapaUrl: safeMapa || '',
        costo: Number(form.costo) || 200,
        cupoMaximo: Number(form.cupoMaximo) || 100,
      });
      onNotify('Configuración y textos de la convocatoria guardados en tiempo real.', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Error al guardar la configuración.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRestore = async () => {
    setSaving(true);
    try {
      const res = await restoreDefaultConfigAndSponsors();
      setShowRestoreConfirm(false);
      onNotify(
        `Valores por defecto restaurados y ${res.sponsorsSeeded} patrocinadores sincronizados (se respetaron tus datos bancarios reales).`,
        'success'
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'No se pudieron restaurar los valores por defecto.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={(e) => void handleSave(e)} className="space-y-6 text-xs">
        {/* General & Countdown Settings */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/80 pb-3">
            <div className="flex items-center gap-2 text-yellow-300 font-festive text-lg">
              <Calendar size={18} className="text-amber-400" aria-hidden="true" />
              <span>Datos Generales y Contador del Evento</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    habilitarListaEspera: !(prev.habilitarListaEspera ?? true),
                  }))
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold border cursor-pointer transition-colors ${
                  form.habilitarListaEspera !== false
                    ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                    : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                }`}
              >
                {form.habilitarListaEspera !== false ? (
                  <ToggleRight size={17} />
                ) : (
                  <ToggleLeft size={17} />
                )}
                <span>
                  {form.habilitarListaEspera !== false
                    ? 'Lista de espera activa'
                    : 'Lista de espera desactivada'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    inscripcionesAbiertas: !prev.inscripcionesAbiertas,
                  }))
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold border cursor-pointer transition-colors ${
                  form.inscripcionesAbiertas
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                    : 'bg-red-500/20 text-red-300 border-red-500/50'
                }`}
              >
                {form.inscripcionesAbiertas ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                <span>
                  {form.inscripcionesAbiertas ? 'Inscripciones Abiertas' : 'Inscripciones Cerradas'}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label htmlFor="cfg-titulo" className="text-emerald-300 font-bold block mb-1">
                Título del Torneo
              </label>
              <input
                id="cfg-titulo"
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-club" className="text-emerald-300 font-bold block mb-1">
                Club Organizador
              </label>
              <input
                id="cfg-club"
                type="text"
                value={form.club}
                onChange={(e) => setForm({ ...form, club: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-fechaIso" className="text-emerald-300 font-bold block mb-1">
                Fecha/Hora ISO (Contador en Vivo)
              </label>
              <input
                id="cfg-fechaIso"
                type="text"
                value={form.fechaIso || '2026-12-19T16:30:00-06:00'}
                onChange={(e) => setForm({ ...form, fechaIso: e.target.value })}
                placeholder="2026-12-19T16:30:00-06:00"
                className="w-full bg-emerald-950 border border-amber-400/50 rounded-xl px-3 py-2 text-amber-200 font-mono"
              />
            </div>
            <div>
              <label htmlFor="cfg-fecha" className="text-emerald-300 font-bold block mb-1">
                Fecha visible
              </label>
              <input
                id="cfg-fecha"
                type="text"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-hora" className="text-emerald-300 font-bold block mb-1">
                Horario visible
              </label>
              <input
                id="cfg-hora"
                type="text"
                value={form.hora}
                onChange={(e) => setForm({ ...form, hora: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cfg-costo" className="text-emerald-300 font-bold block mb-1">
                  Costo ($ MXN)
                </label>
                <input
                  id="cfg-costo"
                  type="number"
                  value={form.costo}
                  onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })}
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor="cfg-cupo" className="text-emerald-300 font-bold block mb-1">
                  Cupo Máximo
                </label>
                <input
                  id="cfg-cupo"
                  type="number"
                  value={form.cupoMaximo}
                  onChange={(e) => setForm({ ...form, cupoMaximo: Number(e.target.value) })}
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cfg-lugar" className="text-emerald-300 font-bold block mb-1">
                Lugar / Sede
              </label>
              <input
                id="cfg-lugar"
                type="text"
                value={form.lugar}
                onChange={(e) => setForm({ ...form, lugar: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-whatsapp" className="text-emerald-300 font-bold block mb-1">
                WhatsApp Contacto (10 dígitos)
              </label>
              <input
                id="cfg-whatsapp"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={form.whatsappContacto}
                onChange={(e) =>
                  setForm({ ...form, whatsappContacto: e.target.value.replace(/\D/g, '') })
                }
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label htmlFor="cfg-fechaLimite" className="text-emerald-300 font-bold block mb-1">
                Fecha límite visible
              </label>
              <input
                id="cfg-fechaLimite"
                type="text"
                value={form.fechaLimite}
                onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-fechaLimiteIso" className="text-emerald-300 font-bold block mb-1">
                Fecha límite ISO (Cierre en Firestore Rules)
              </label>
              <input
                id="cfg-fechaLimiteIso"
                type="text"
                value={form.fechaLimiteIso || '2026-12-19T15:30:00-06:00'}
                onChange={(e) => setForm({ ...form, fechaLimiteIso: e.target.value })}
                placeholder="2026-12-19T15:30:00-06:00"
                className="w-full bg-emerald-950 border border-amber-400/50 rounded-xl px-3 py-2 text-amber-200 font-mono"
              />
            </div>
            <div>
              <label htmlFor="cfg-mapa" className="text-emerald-300 font-bold block mb-1">
                URL Google Maps (https://)
              </label>
              <input
                id="cfg-mapa"
                type="url"
                value={form.mapaUrl}
                onChange={(e) => setForm({ ...form, mapaUrl: e.target.value })}
                placeholder="https://maps.app.goo.gl/..."
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-3 text-[11px] text-emerald-200 flex flex-wrap gap-x-6 gap-y-1">
            <span>
              Corte automático Juvenil (≤ 18): nacidos desde{' '}
              <strong className="text-amber-300">{cutoffs.juvenilMinBirthSpanish}</strong> (corte en reglas:{' '}
              <code className="text-white">{cutoffs.fechaCorteJuvenil}</code>)
            </span>
            <span>
              Corte mayoría de edad (18 años):{' '}
              <code className="text-white">{cutoffs.fechaCorteMayoriaEdad}</code>
            </span>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-yellow-300 font-festive text-lg border-b border-emerald-800/80 pb-2">
            <CreditCard size={18} className="text-amber-400" aria-hidden="true" />
            <span>Datos Bancarios de Inscripción</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="cfg-banco" className="text-emerald-300 font-bold block mb-1">
                Banco
              </label>
              <input
                id="cfg-banco"
                type="text"
                value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-titular" className="text-emerald-300 font-bold block mb-1">
                Titular
              </label>
              <input
                id="cfg-titular"
                type="text"
                value={form.titular}
                onChange={(e) => setForm({ ...form, titular: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-clabe" className="text-emerald-300 font-bold block mb-1">
                CLABE Interbancaria (18 dígitos)
              </label>
              <input
                id="cfg-clabe"
                type="text"
                inputMode="numeric"
                maxLength={18}
                value={form.clabe}
                onChange={(e) => setForm({ ...form, clabe: e.target.value.replace(/\D/g, '') })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-amber-200 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Convocatoria Text Blocks & Refund Policy */}
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-yellow-300 font-festive text-lg border-b border-emerald-800/80 pb-2">
            <FileText size={18} className="text-amber-400" aria-hidden="true" />
            <span>Textos Oficiales de la Convocatoria</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cfg-premiacion" className="text-emerald-300 font-bold block mb-1">
                Premiación
              </label>
              <textarea
                id="cfg-premiacion"
                rows={5}
                value={form.premiacionTexto}
                onChange={(e) => setForm({ ...form, premiacionTexto: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-sistema" className="text-emerald-300 font-bold block mb-1">
                Sistema de Competencia
              </label>
              <textarea
                id="cfg-sistema"
                rows={5}
                value={form.sistemaCompetenciaTexto}
                onChange={(e) => setForm({ ...form, sistemaCompetenciaTexto: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-transitorios" className="text-emerald-300 font-bold block mb-1">
                Transitorios
              </label>
              <textarea
                id="cfg-transitorios"
                rows={4}
                value={form.transitoriosTexto}
                onChange={(e) => setForm({ ...form, transitoriosTexto: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl p-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="cfg-devolucion" className="text-emerald-300 font-bold block mb-1">
                Política de Devolución / Cancelación (Borrador para FAQ)
              </label>
              <textarea
                id="cfg-devolucion"
                rows={4}
                value={form.politicaDevolucionTexto || ''}
                onChange={(e) => setForm({ ...form, politicaDevolucionTexto: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl p-3 text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowRestoreConfirm(true)}
            className="inline-flex items-center gap-2 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>Restaurar valores por defecto</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-6 py-3 rounded-xl text-sm shadow-lg cursor-pointer"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'Guardando...' : 'Guardar Cambios de Convocatoria'}</span>
          </button>
        </div>
      </form>

      {showRestoreConfirm && (
        <AdminConfirmDialog
          title="¿Restaurar valores por defecto?"
          description="Se restaurarán los textos base de la convocatoria y los patrocinadores iniciales con IDs fijos (sin duplicarlos). Tus datos reales de pago (CLABE, banco, titular y WhatsApp) NO serán sobrescritos si ya los configuraste."
          confirmLabel="Sí, restaurar valores"
          saving={saving}
          onConfirm={() => void handleConfirmRestore()}
          onClose={() => setShowRestoreConfirm(false)}
        />
      )}
    </>
  );
};
