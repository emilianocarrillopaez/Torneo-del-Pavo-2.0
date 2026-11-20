import React, { useState, useEffect } from 'react';
import { TournamentConfig } from '../../types/tournament';
import { updateTournamentConfig } from '../../services/tournamentService';
import { Save, Loader2, Calendar, CreditCard, FileText, ToggleLeft, ToggleRight } from 'lucide-react';

interface AdminContentTabProps {
  config: TournamentConfig;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const AdminContentTab: React.FC<AdminContentTabProps> = ({ config, onNotify }) => {
  const [form, setForm] = useState<TournamentConfig>(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTournamentConfig({
        ...form,
        costo: Number(form.costo) || 200,
        cupoMaximo: Number(form.cupoMaximo) || 100,
      });
      onNotify('Configuración y textos de la convocatoria guardados en tiempo real.', 'success');
    } catch {
      onNotify('Error al guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 text-xs">
      {/* General & Countdown Settings */}
      <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/80 pb-3">
          <div className="flex items-center gap-2 text-yellow-300 font-festive text-lg">
            <Calendar size={18} className="text-amber-400" />
            <span>Datos Generales y Contador del Evento</span>
          </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Título del Torneo</label>
            <input
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Club Organizador</label>
            <input
              type="text"
              value={form.club}
              onChange={(e) => setForm({ ...form, club: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">
              Fecha/Hora ISO (Contador en Vivo)
            </label>
            <input
              type="text"
              value={form.fechaIso || '2026-12-19T16:30:00-06:00'}
              onChange={(e) => setForm({ ...form, fechaIso: e.target.value })}
              placeholder="2026-12-19T16:30:00-06:00"
              className="w-full bg-emerald-950 border border-amber-400/50 rounded-xl px-3 py-2 text-amber-200 font-mono"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Fecha visible</label>
            <input
              type="text"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Horario visible</label>
            <input
              type="text"
              value={form.hora}
              onChange={(e) => setForm({ ...form, hora: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-emerald-300 font-bold block mb-1">Costo ($ MXN)</label>
              <input
                type="number"
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-emerald-300 font-bold block mb-1">Cupo Máximo</label>
              <input
                type="number"
                value={form.cupoMaximo}
                onChange={(e) => setForm({ ...form, cupoMaximo: Number(e.target.value) })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-emerald-300 font-bold block mb-1">Lugar / Sede</label>
            <input
              type="text"
              value={form.lugar}
              onChange={(e) => setForm({ ...form, lugar: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">WhatsApp Contacto</label>
            <input
              type="text"
              value={form.whatsappContacto}
              onChange={(e) => setForm({ ...form, whatsappContacto: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-yellow-300 font-festive text-lg border-b border-emerald-800/80 pb-2">
          <CreditCard size={18} className="text-amber-400" />
          <span>Datos Bancarios de Inscripción</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Banco</label>
            <input
              type="text"
              value={form.banco}
              onChange={(e) => setForm({ ...form, banco: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Titular</label>
            <input
              type="text"
              value={form.titular}
              onChange={(e) => setForm({ ...form, titular: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">CLABE Interbancaria</label>
            <input
              type="text"
              value={form.clabe}
              onChange={(e) => setForm({ ...form, clabe: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-amber-200 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Convocatoria Text Blocks */}
      <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-yellow-300 font-festive text-lg border-b border-emerald-800/80 pb-2">
          <FileText size={18} className="text-amber-400" />
          <span>Textos Oficiales de la Convocatoria</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Premiación</label>
            <textarea
              rows={5}
              value={form.premiacionTexto}
              onChange={(e) => setForm({ ...form, premiacionTexto: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl p-3 text-white"
            />
          </div>
          <div>
            <label className="text-emerald-300 font-bold block mb-1">Sistema de Competencia</label>
            <textarea
              rows={5}
              value={form.sistemaCompetenciaTexto}
              onChange={(e) => setForm({ ...form, sistemaCompetenciaTexto: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl p-3 text-white"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="text-emerald-300 font-bold block mb-1">Transitorios</label>
            <textarea
              rows={4}
              value={form.transitoriosTexto}
              onChange={(e) => setForm({ ...form, transitoriosTexto: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl p-3 text-white"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
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
  );
};
