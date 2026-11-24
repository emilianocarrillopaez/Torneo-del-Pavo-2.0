import React, { useEffect, useRef, useState } from 'react';
import { Sponsor } from '../../types/tournament';
import { saveSponsor, deleteSponsor } from '../../services/tournamentService';
import { processReceiptFile } from '../../utils/receiptUtils';
import { safeHttpUrl } from '../../utils/tournamentUtils';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { AdminConfirmDialog } from './AdminParticipantModals';
import { Plus, Trash2, Edit2, Eye, EyeOff, Upload, Loader2, X } from 'lucide-react';

interface AdminSponsorsTabProps {
  sponsors: Sponsor[];
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onModalOpenChange?: (isOpen: boolean) => void;
}

export const AdminSponsorsTab: React.FC<AdminSponsorsTabProps> = ({
  sponsors,
  onNotify,
  onModalOpenChange,
}) => {
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmDeleteSponsor, setConfirmDeleteSponsor] = useState<Sponsor | null>(null);

  const editModalRef = useRef<HTMLFormElement>(null);
  useFocusTrap(editModalRef, () => setEditing(null), Boolean(editing));

  useEffect(() => {
    onModalOpenChange?.(Boolean(editing || confirmDeleteSponsor));
  }, [editing, confirmDeleteSponsor, onModalOpenChange]);

  const openNew = () => {
    setEditing({
      nombre: '',
      logo: '',
      enlace: '',
      categoriaSponsor: 'Patrocinador Oficial',
      activo: true,
      orden: sponsors.length + 1,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.nombre.trim()) return;

    const rawLink = editing.enlace?.trim() || '#';
    const validatedLink = safeHttpUrl(rawLink, { allowHash: true });
    if (!validatedLink) {
      onNotify('El enlace del patrocinador debe comenzar con https:// o ser #.', 'error');
      return;
    }

    const rawLogo = (editing.logo || '').trim();
    const isValidLogo =
      rawLogo === '' ||
      Boolean(safeHttpUrl(rawLogo)) ||
      /^data:image\/(jpeg|png|webp|svg\+xml)(;base64,|;charset=UTF-8,)/i.test(rawLogo);
    if (!isValidLogo) {
      onNotify('El logo debe ser una URL https:// o una imagen subida válida.', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveSponsor({
        ...editing,
        nombre: editing.nombre.trim(),
        logo: rawLogo,
        enlace: validatedLink,
      });
      setEditing(null);
      onNotify('Patrocinador guardado y actualizado en el carrusel.', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'No se pudo guardar el patrocinador.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (sp: Sponsor) => {
    try {
      await saveSponsor({ ...sp, activo: sp.activo === false });
      onNotify(
        `Patrocinador ${sp.activo === false ? 'activado' : 'ocultado'} en el carrusel.`,
        'success'
      );
    } catch {
      onNotify('Error al actualizar el estado del patrocinador.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteSponsor?.id) return;
    setSaving(true);
    try {
      await deleteSponsor(confirmDeleteSponsor.id);
      setConfirmDeleteSponsor(null);
      onNotify('Patrocinador eliminado.', 'success');
    } catch {
      onNotify('Error al eliminar patrocinador.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-festive text-xl text-yellow-300">
            Patrocinadores del Carrusel ({sponsors.length})
          </h3>
          <p className="text-xs text-emerald-300">
            Sube logos optimizados directamente desde tu dispositivo o usa una URL externa.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-4 py-2.5 rounded-xl text-xs shadow cursor-pointer"
        >
          <Plus size={15} />
          <span>Agregar Patrocinador</span>
        </button>
      </div>

      {sponsors.length === 0 ? (
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-8 text-center text-xs text-emerald-300">
          No hay patrocinadores registrados aún. Puedes agregar uno manualmente o restaurar los valores por defecto en la pestaña Convocatoria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sponsors.map((sp, idx) => (
            <div
              key={sp.id || `${sp.nombre}-${idx}`}
              className={`bg-[#092b1a] rounded-2xl p-4 border flex items-center gap-3 ${
                sp.activo === false
                  ? 'border-emerald-900 opacity-55'
                  : 'border-emerald-700/80'
              }`}
            >
              <div className="w-16 h-16 rounded-xl bg-black/40 border border-emerald-800 flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                {sp.logo ? (
                  <img
                    src={sp.logo}
                    alt={`Logo de ${sp.nombre}`}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                ) : (
                  <span className="text-xs font-bold text-amber-300">
                    {sp.nombre.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-xs sm:text-sm truncate">{sp.nombre}</p>
                <p className="text-[11px] text-emerald-400 truncate">
                  {sp.categoriaSponsor || 'Patrocinador Oficial'}
                </p>

                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...sp })}
                    className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 cursor-pointer"
                    aria-label={`Editar patrocinador ${sp.nombre}`}
                    title="Editar"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(sp)}
                    className="p-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-800 text-amber-300 border border-emerald-700 cursor-pointer"
                    aria-label={`${sp.activo === false ? 'Mostrar' : 'Ocultar'} patrocinador ${sp.nombre}`}
                    title={sp.activo === false ? 'Mostrar' : 'Ocultar'}
                  >
                    {sp.activo === false ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  {sp.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSponsor(sp)}
                      className="p-1.5 rounded-lg bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-800 cursor-pointer"
                      aria-label={`Eliminar patrocinador ${sp.nombre}`}
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Sponsor Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sponsor-modal-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar modal de patrocinador"
            onClick={() => setEditing(null)}
            className="fixed inset-0 bg-transparent cursor-default"
          />
          <form
            ref={editModalRef}
            tabIndex={-1}
            onSubmit={(e) => void handleSave(e)}
            className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-2xl max-w-md w-full p-5 space-y-3 text-white shadow-2xl text-xs focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
              <h4 id="sponsor-modal-title" className="font-festive text-lg text-yellow-300">
                {editing.id ? 'Editar Patrocinador' : 'Nuevo Patrocinador'}
              </h4>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Cerrar modal de patrocinador"
                className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label htmlFor="sp-nombre" className="text-emerald-300 font-bold block mb-1">
                Nombre
              </label>
              <input
                id="sp-nombre"
                type="text"
                required
                value={editing.nombre}
                onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label htmlFor="sp-giro" className="text-emerald-300 font-bold block mb-1">
                  Giro / Subtítulo
                </label>
                <input
                  id="sp-giro"
                  type="text"
                  value={editing.categoriaSponsor || ''}
                  onChange={(e) => setEditing({ ...editing, categoriaSponsor: e.target.value })}
                  placeholder="Ej. Restaurante, Cafetería"
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label htmlFor="sp-orden" className="text-emerald-300 font-bold block mb-1">
                  Orden
                </label>
                <input
                  id="sp-orden"
                  type="number"
                  min={1}
                  value={editing.orden ?? 1}
                  onChange={(e) => setEditing({ ...editing, orden: Number(e.target.value) || 1 })}
                  className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sp-logo-url" className="text-emerald-300 font-bold block mb-1">
                Logo (Subir imagen o pegar URL)
              </label>
              <div className="flex gap-2 mb-2">
                <label className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl cursor-pointer">
                  {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span>Subir Logo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploadingLogo(true);
                      try {
                        const processed = await processReceiptFile(f);
                        setEditing((prev) => (prev ? { ...prev, logo: processed.dataUrl } : prev));
                      } catch (err) {
                        onNotify(
                          err instanceof Error ? err.message : 'Error al procesar imagen.',
                          'error'
                        );
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                  />
                </label>
              </div>
              <input
                id="sp-logo-url"
                type="text"
                value={editing.logo}
                onChange={(e) => setEditing({ ...editing, logo: e.target.value })}
                placeholder="https://... o imagen subida"
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono text-[11px]"
              />
            </div>

            <div>
              <label htmlFor="sp-enlace" className="text-emerald-300 font-bold block mb-1">
                Enlace web / red social
              </label>
              <input
                id="sp-enlace"
                type="text"
                value={editing.enlace || ''}
                onChange={(e) => setEditing({ ...editing, enlace: e.target.value })}
                placeholder="https://instagram.com/... o #"
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black cursor-pointer"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteSponsor && (
        <AdminConfirmDialog
          title="¿Eliminar patrocinador?"
          description={`Se eliminará a "${confirmDeleteSponsor.nombre}" del carrusel público de patrocinadores.`}
          confirmLabel="Sí, eliminar"
          danger
          saving={saving}
          onConfirm={() => void handleDelete()}
          onClose={() => setConfirmDeleteSponsor(null)}
        />
      )}
    </div>
  );
};
