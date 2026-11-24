import React, { useRef, useState } from 'react';
import { Participant, TournamentCategory } from '../../types/tournament';
import { ProcessedReceiptFile, processReceiptFile } from '../../utils/receiptUtils';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { X, Receipt, AlertTriangle, History, KeyRound } from 'lucide-react';

interface EditModalProps {
  participant: Participant;
  saving: boolean;
  onChange: (next: Participant) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const AdminEditParticipantModal: React.FC<EditModalProps> = ({
  participant,
  saving,
  onChange,
  onSubmit,
  onClose,
}) => {
  const ref = useRef<HTMLFormElement>(null);
  useFocusTrap(ref, onClose, true);

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-participant-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar modal de edición"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <form
        ref={ref}
        tabIndex={-1}
        onSubmit={onSubmit}
        className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-2xl max-w-md w-full p-5 space-y-3 text-white shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
          <h4 id="edit-participant-title" className="font-festive text-lg text-yellow-300">
            Editar Participante
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de edición"
            className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          <div>
            <label htmlFor="edit-nombre" className="text-emerald-300 font-bold block mb-1">
              Nombre completo
            </label>
            <input
              id="edit-nombre"
              type="text"
              required
              value={participant.nombre}
              onChange={(e) => onChange({ ...participant, nombre: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="edit-dob" className="text-emerald-300 font-bold block mb-1">
                Fecha nacimiento
              </label>
              <input
                id="edit-dob"
                type="date"
                required
                value={participant.fechaNacimiento}
                onChange={(e) => onChange({ ...participant, fechaNacimiento: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="edit-wa" className="text-emerald-300 font-bold block mb-1">
                WhatsApp (10 dig.)
              </label>
              <input
                id="edit-wa"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                value={participant.whatsapp}
                onChange={(e) =>
                  onChange({ ...participant, whatsapp: e.target.value.replace(/\D/g, '') })
                }
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-email" className="text-emerald-300 font-bold block mb-1">
              Correo electrónico
            </label>
            <input
              id="edit-email"
              type="email"
              required
              value={participant.correo}
              onChange={(e) => onChange({ ...participant, correo: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="edit-cat" className="text-emerald-300 font-bold block mb-1">
                Categoría
              </label>
              <select
                id="edit-cat"
                value={participant.categoria}
                onChange={(e) =>
                  onChange({ ...participant, categoria: e.target.value as TournamentCategory })
                }
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="Juvenil">Juvenil</option>
                <option value="Libre">Libre</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-pago" className="text-emerald-300 font-bold block mb-1">
                Estatus pago
              </label>
              <select
                id="edit-pago"
                value={participant.estatusPago}
                onChange={(e) =>
                  onChange({ ...participant, estatusPago: e.target.value as 'pendiente' | 'pagado' })
                }
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label htmlFor="edit-afic" className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                id="edit-afic"
                type="checkbox"
                checked={Boolean(participant.esAficionado)}
                onChange={(e) => onChange({ ...participant, esAficionado: e.target.checked })}
              />
              <span>Mejor Aficionado</span>
            </label>
            <label htmlFor="edit-fem" className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                id="edit-fem"
                type="checkbox"
                checked={Boolean(participant.esFemenil)}
                onChange={(e) => onChange({ ...participant, esFemenil: e.target.checked })}
              />
              <span>Mejor Femenil</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs font-black cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface CreateModalProps {
  saving: boolean;
  newForm: {
    nombre: string;
    fechaNacimiento: string;
    whatsapp: string;
    correo: string;
    categoria: TournamentCategory;
    estatusPago: 'pendiente' | 'pagado';
    esAficionado: boolean;
    esFemenil: boolean;
    nombreTutor: string;
  };
  newReceipt: ProcessedReceiptFile | null;
  onChangeForm: (next: CreateModalProps['newForm']) => void;
  onChangeReceipt: (next: ProcessedReceiptFile | null) => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const AdminCreateParticipantModal: React.FC<CreateModalProps> = ({
  saving,
  newForm,
  newReceipt,
  onChangeForm,
  onChangeReceipt,
  onNotify,
  onSubmit,
  onClose,
}) => {
  const ref = useRef<HTMLFormElement>(null);
  useFocusTrap(ref, onClose, true);

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-participant-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar modal de registro manual"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <form
        ref={ref}
        tabIndex={-1}
        onSubmit={onSubmit}
        className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-2xl max-w-md w-full p-5 space-y-3 text-white shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
          <h4 id="create-participant-title" className="font-festive text-lg text-yellow-300">
            Registro Manual (Admin)
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de registro manual"
            className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          <div>
            <label htmlFor="new-nombre" className="text-emerald-300 font-bold block mb-1">
              Nombre completo
            </label>
            <input
              id="new-nombre"
              type="text"
              required
              placeholder="Nombre completo del jugador"
              value={newForm.nombre}
              onChange={(e) => onChangeForm({ ...newForm, nombre: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="new-dob" className="text-emerald-300 font-bold block mb-1">
                Nacimiento
              </label>
              <input
                id="new-dob"
                type="date"
                required
                value={newForm.fechaNacimiento}
                onChange={(e) => onChangeForm({ ...newForm, fechaNacimiento: e.target.value })}
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="new-wa" className="text-emerald-300 font-bold block mb-1">
                WhatsApp (10 dig.)
              </label>
              <input
                id="new-wa"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                placeholder="6181234567"
                value={newForm.whatsapp}
                onChange={(e) =>
                  onChangeForm({ ...newForm, whatsapp: e.target.value.replace(/\D/g, '') })
                }
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>
          </div>
          <div>
            <label htmlFor="new-email" className="text-emerald-300 font-bold block mb-1">
              Correo electrónico
            </label>
            <input
              id="new-email"
              type="email"
              required
              placeholder="correo@ejemplo.com"
              value={newForm.correo}
              onChange={(e) => onChangeForm({ ...newForm, correo: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="new-cat" className="text-emerald-300 font-bold block mb-1">
                Categoría
              </label>
              <select
                id="new-cat"
                value={newForm.categoria}
                onChange={(e) =>
                  onChangeForm({ ...newForm, categoria: e.target.value as TournamentCategory })
                }
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="Juvenil">Juvenil</option>
                <option value="Libre">Libre</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-pago" className="text-emerald-300 font-bold block mb-1">
                Estatus de pago
              </label>
              <select
                id="new-pago"
                value={newForm.estatusPago}
                onChange={(e) =>
                  onChangeForm({
                    ...newForm,
                    estatusPago: e.target.value as 'pendiente' | 'pagado',
                  })
                }
                className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="new-tutor" className="text-emerald-300 font-bold block mb-1">
              Madre, padre o tutor (si es menor de 18)
            </label>
            <input
              id="new-tutor"
              type="text"
              placeholder="Nombre completo del tutor"
              value={newForm.nombreTutor}
              onChange={(e) => onChangeForm({ ...newForm, nombreTutor: e.target.value })}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div className="bg-emerald-950/80 border border-emerald-800 rounded-xl p-3">
            <label
              htmlFor="new-receipt-file"
              className="text-[11px] font-bold text-amber-300 flex items-center gap-1 mb-1.5"
            >
              <Receipt size={13} aria-hidden="true" />
              <span>Foto de recibo (opcional en alta manual)</span>
            </label>
            <input
              id="new-receipt-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const processed = await processReceiptFile(f);
                  onChangeReceipt(processed);
                } catch (err) {
                  onNotify(err instanceof Error ? err.message : 'Archivo no válido.', 'error');
                }
              }}
              className="text-[11px] text-emerald-200 w-full"
            />
            {newReceipt && (
              <p className="text-[10px] text-emerald-400 mt-1">
                Listo: {newReceipt.fileName} ({Math.round(newReceipt.fileSize / 1024)} KB)
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs font-black cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const AdminHistoryModal: React.FC<{
  participant: Participant;
  onClose: () => void;
}> = ({ participant, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose, true);
  const history = Array.isArray(participant.historial) ? participant.historial : [];

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar historial"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <div
        ref={ref}
        tabIndex={-1}
        className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-2xl max-w-lg w-full p-5 space-y-3 text-white shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
          <h4
            id="history-modal-title"
            className="font-festive text-lg text-yellow-300 flex items-center gap-2"
          >
            <History size={18} aria-hidden="true" />
            <span>Bitácora · {participant.folio}</span>
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
            className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-emerald-200">
          Participante: <strong className="text-white">{participant.nombre}</strong>
        </p>

        {participant.pagadoPor && (
          <div className="bg-emerald-950/90 border border-emerald-700 rounded-xl p-3 text-xs text-emerald-200">
            <strong className="text-emerald-300 block">Validación de pago</strong>
            <span>
              Confirmado por <strong className="text-white">{participant.pagadoPor}</strong>{' '}
              {participant.pagadoEn
                ? `el ${new Date(participant.pagadoEn).toLocaleString('es-MX', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}`
                : ''}
            </span>
          </div>
        )}

        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {history.length === 0 ? (
            <p className="text-xs text-emerald-400 py-4 text-center">
              Sin movimientos administrativos registrados aún.
            </p>
          ) : (
            [...history].reverse().map((entry, idx) => (
              <div
                key={`${entry.fecha}-${idx}`}
                className="bg-[#092b1a] border border-emerald-800 rounded-xl px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-amber-300">{entry.accion}</strong>
                  <span className="text-[10px] text-emerald-400">
                    {new Date(entry.fecha).toLocaleString('es-MX', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-200 block">Por: {entry.autor}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminReleaseKeyModal: React.FC<{
  saving: boolean;
  onRelease: (input: { correo?: string; whatsapp?: string }) => Promise<void>;
  onClose: () => void;
}> = ({ saving, onRelease, onClose }) => {
  const ref = useRef<HTMLFormElement>(null);
  const [correo, setCorreo] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  useFocusTrap(ref, onClose, true);

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-key-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar modal de liberación de llave"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <form
        ref={ref}
        tabIndex={-1}
        onSubmit={async (e) => {
          e.preventDefault();
          await onRelease({ correo, whatsapp });
        }}
        className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-2xl max-w-md w-full p-5 space-y-3 text-white shadow-2xl focus:outline-none text-xs"
      >
        <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
          <h4
            id="release-key-title"
            className="font-festive text-lg text-yellow-300 flex items-center gap-2"
          >
            <KeyRound size={18} aria-hidden="true" />
            <span>Liberar correo o WhatsApp</span>
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de liberación de llave"
            className="text-emerald-300 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-emerald-200 leading-relaxed">
          Si un jugador reporta que su correo o WhatsApp aparece bloqueado como duplicado tras un intento fallido, puedes liberar su llave en{' '}
          <span className="font-mono text-white">/registro_llaves</span>.
        </p>

        <div>
          <label htmlFor="release-email" className="text-emerald-300 font-bold block mb-1">
            Correo electrónico (opcional)
          </label>
          <input
            id="release-email"
            type="email"
            placeholder="jugador@ejemplo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white"
          />
        </div>

        <div>
          <label htmlFor="release-wa" className="text-emerald-300 font-bold block mb-1">
            WhatsApp 10 dígitos (opcional)
          </label>
          <input
            id="release-wa"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="6181234567"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2 text-white font-mono"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || (!correo.trim() && whatsapp.length !== 10)}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-emerald-950 font-black cursor-pointer"
          >
            {saving ? 'Liberando...' : 'Liberar llave'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const AdminConfirmDialog: React.FC<{
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  saving?: boolean;
  progressText?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}> = ({
  title,
  description,
  confirmLabel,
  danger = false,
  saving = false,
  progressText = null,
  onConfirm,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose, true);

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar diálogo de confirmación"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative z-10 bg-[#0b3320] border-2 ${
          danger ? 'border-red-500' : 'border-amber-400'
        } rounded-2xl max-w-md w-full p-5 text-center space-y-4 text-white shadow-2xl focus:outline-none`}
      >
        <AlertTriangle
          size={34}
          className={`${danger ? 'text-red-400' : 'text-amber-400'} mx-auto`}
          aria-hidden="true"
        />
        <h4
          id="confirm-dialog-title"
          className={`font-festive text-xl ${danger ? 'text-red-200' : 'text-yellow-300'}`}
        >
          {title}
        </h4>
        <p className="text-xs text-emerald-200 leading-relaxed">{description}</p>
        {saving && progressText && (
          <p
            role="status"
            aria-live="polite"
            className="text-xs font-bold text-amber-300 bg-emerald-950/90 border border-amber-400/40 rounded-xl py-2 px-3"
          >
            {progressText}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-50 text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-black cursor-pointer ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-amber-400 hover:bg-amber-300 text-emerald-950'
            }`}
          >
            {saving ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
