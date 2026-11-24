import React, { useEffect, useState } from 'react';
import { AdminMember } from '../../types/tournament';
import {
  subscribeToAdminMembers,
  addAdminMember,
  removeAdminMember,
} from '../../services/tournamentService';
import { useAuth } from '../../context/AuthContext';
import { AdminConfirmDialog } from './AdminParticipantModals';
import { ShieldCheck, UserPlus, Trash2, KeyRound, CheckCircle2, Info, Clock } from 'lucide-react';

interface AdminAccessTabProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  onModalOpenChange?: (isOpen: boolean) => void;
}

export const AdminAccessTab: React.FC<AdminAccessTabProps> = ({
  onNotify,
  onModalOpenChange,
}) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('Árbitro / Comité');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<AdminMember | null>(null);

  useEffect(() => {
    const unsub = subscribeToAdminMembers(
      (list) => setMembers(list),
      () => onNotify('No se pudo cargar la lista de administradores.', 'error')
    );
    return () => unsub();
  }, [onNotify]);

  useEffect(() => {
    onModalOpenChange?.(Boolean(confirmRemove));
  }, [confirmRemove, onModalOpenChange]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await addAdminMember({ email, nombre, rol });
      setEmail('');
      setNombre('');
      setRol('Árbitro / Comité');
      onNotify('Correo autorizado como administrador con Google Sign-In.', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'No se pudo agregar el administrador.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemove) return;
    setSaving(true);
    try {
      await removeAdminMember(confirmRemove.id || confirmRemove.email, user?.email);
      setConfirmRemove(null);
      onNotify('Acceso de administrador revocado.', 'success');
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Error al revocar el acceso.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Authenticated Session */}
      <div className="bg-[#092b1a] border border-emerald-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-400 block">
              Sesión Activa Verificada
            </span>
            <span className="text-sm font-bold text-white">{user?.email || 'Administrador'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/35">
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>Google Verificado</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-400/35">
            <Clock size={14} aria-hidden="true" />
            <span>Cierre automático: 30 min inactivo</span>
          </span>
        </div>
      </div>

      {/* Add New Authorized Google Admin */}
      <form
        onSubmit={(e) => void handleAdd(e)}
        className="bg-[#092b1a] border border-amber-400/40 rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserPlus size={18} className="text-amber-400" aria-hidden="true" />
          <h3 className="font-festive text-lg text-yellow-300">
            Autorizar Nuevo Administrador (Acceso con Google)
          </h3>
        </div>
        <p className="text-xs text-emerald-200">
          Agrega el correo de Google verificado de cualquier miembro del comité o árbitro. En cuanto inicie sesión con Google, tendrá acceso al panel y a la bóveda privada de comprobantes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="admin-add-email" className="text-emerald-300 font-bold block mb-1 text-xs">
              Correo de Google
            </label>
            <input
              id="admin-add-email"
              type="email"
              required
              placeholder="correo.comite@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label htmlFor="admin-add-name" className="text-emerald-300 font-bold block mb-1 text-xs">
              Nombre completo
            </label>
            <input
              id="admin-add-name"
              type="text"
              required
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label htmlFor="admin-add-role" className="text-emerald-300 font-bold block mb-1 text-xs">
              Rol
            </label>
            <input
              id="admin-add-role"
              type="text"
              placeholder="Rol (ej. Árbitro, Tesorero)"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-4 py-2.5 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus size={15} />
          <span>{saving ? 'Autorizando...' : 'Autorizar Administrador'}</span>
        </button>
      </form>

      {/* Dynamic Admin List + Root Bootstrap Explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <KeyRound size={16} aria-hidden="true" />
            <span>Modelo de Autorización Sin Credenciales Fijas</span>
          </div>
          <p className="text-xs text-emerald-200 leading-relaxed">
            Ningún correo ni contraseña administrativa está almacenado en el código público de la aplicación. El acceso raíz se asigna directamente en la consola segura de Firestore mediante documentos en{' '}
            <span className="font-mono text-white">/admins</span> (por UID) y esta lista dinámica en{' '}
            <span className="font-mono text-white">/admins_by_email</span>.
          </p>
        </div>

        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Administradores Autorizados por Correo ({members.length})</span>
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-emerald-400 py-4">
              Aún no hay correos adicionales registrados en{' '}
              <span className="font-mono text-white">/admins_by_email</span>. Usa el formulario superior para dar acceso a otros organizadores con su cuenta de Google.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id || m.email}
                  className="bg-emerald-950/90 border border-emerald-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">{m.nombre}</span>
                    <span className="font-mono text-[11px] text-emerald-300 block truncate">
                      {m.email}
                    </span>
                    <span className="text-[10px] text-amber-300">{m.rol}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(m)}
                    className="p-2 rounded-lg bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-800 cursor-pointer shrink-0"
                    title="Revocar acceso"
                    aria-label={`Revocar acceso de ${m.email}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security & Auth Architecture Note */}
      <div className="bg-emerald-950/80 border border-emerald-800 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-200">
        <Info size={18} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <strong className="text-amber-300 block">Protección de Datos en Firestore Rules</strong>
          <p className="text-[11px] leading-relaxed">
            Tanto <span className="font-mono text-white">/participantes</span> como{' '}
            <span className="font-mono text-white">/comprobantes</span> bloquean toda lectura pública desde los servidores de Firebase. Solo cuentas con correo verificado (
            <span className="font-mono text-white">email_verified == true</span>) incluidas en la lista de administradores pueden consultar o descargar esta información, y el sistema impide revocar al último administrador activo.
          </p>
        </div>
      </div>

      {confirmRemove && (
        <AdminConfirmDialog
          title="¿Revocar acceso de administrador?"
          description={`La cuenta "${confirmRemove.email}" dejará de tener acceso al panel administrativo y a los comprobantes privados. El sistema impide eliminar al último administrador activo.`}
          confirmLabel="Sí, revocar acceso"
          danger
          saving={saving}
          onConfirm={() => void handleConfirmRemove()}
          onClose={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
};
