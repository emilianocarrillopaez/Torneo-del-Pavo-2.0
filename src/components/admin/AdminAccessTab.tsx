import React, { useEffect, useState } from 'react';
import { AdminMember } from '../../types/tournament';
import {
  subscribeToAdminMembers,
  addAdminMember,
  removeAdminMember,
} from '../../services/tournamentService';
import { AUTHORIZED_ADMIN_EMAILS, useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserPlus, Trash2, KeyRound, CheckCircle2, Info } from 'lucide-react';

interface AdminAccessTabProps {
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const AdminAccessTab: React.FC<AdminAccessTabProps> = ({ onNotify }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('Árbitro / Comité');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAdminMembers((list) => setMembers(list));
    return () => unsub();
  }, []);

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

  const handleRemove = async (id: string) => {
    try {
      await removeAdminMember(id);
      onNotify('Acceso de administrador revocado.', 'success');
    } catch {
      onNotify('Error al revocar el acceso.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Authenticated Session */}
      <div className="bg-[#092b1a] border border-emerald-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold text-emerald-400 block">
              Sesión Activa Verificada
            </span>
            <span className="text-sm font-bold text-white">{user?.email || 'Administrador'}</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/35">
          <CheckCircle2 size={14} />
          <span>Autenticación Firebase Activa</span>
        </span>
      </div>

      {/* Add New Authorized Google Admin */}
      <form
        onSubmit={handleAdd}
        className="bg-[#092b1a] border border-amber-400/40 rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <UserPlus size={18} className="text-amber-400" />
          <h3 className="font-festive text-lg text-yellow-300">
            Autorizar Nuevo Administrador (Acceso con Google)
          </h3>
        </div>
        <p className="text-xs text-emerald-200">
          Agrega el correo de Gmail de cualquier miembro del comité o árbitro. En cuanto inicie sesión con Google, tendrá acceso automático al panel y a la bóveda privada de comprobantes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="email"
            required
            placeholder="correo.comite@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
          />
          <input
            type="text"
            required
            placeholder="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
          />
          <input
            type="text"
            placeholder="Rol (ej. Árbitro, Tesorero)"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="bg-emerald-950 border border-emerald-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
          />
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

      {/* Built-in + Dynamic Admin Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <KeyRound size={16} />
            <span>Accesos Oficiales Preconfigurados</span>
          </div>
          <div className="space-y-2">
            {AUTHORIZED_ADMIN_EMAILS.map((admEmail, idx) => (
              <div
                key={admEmail}
                className="bg-emerald-950/90 border border-emerald-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono text-white block">{admEmail}</span>
                  <span className="text-[10px] text-emerald-400">
                    {idx === 0
                      ? 'Administrador Principal · Vicepresidencia'
                      : idx === 3
                      ? 'Presidencia · Club Don Gonzalo'
                      : 'Acceso Comité / Arbitraje'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded border border-amber-400/30">
                  Base
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#092b1a] border border-emerald-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
            <ShieldCheck size={16} />
            <span>Administradores Adicionales ({members.length})</span>
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-emerald-400 py-4">
              Aún no has agregado correos adicionales. Usa el formulario superior para dar acceso a otros organizadores con su cuenta de Google.
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
                    onClick={() => handleRemove(m.id || m.email)}
                    className="p-2 rounded-lg bg-red-950/80 hover:bg-red-800 text-red-300 border border-red-800 cursor-pointer shrink-0"
                    title="Revocar acceso"
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
        <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="text-amber-300 block">Seguridad en Firestore Rules Activa</strong>
          <p className="text-[11px] leading-relaxed">
            La colección privada <span className="font-mono text-white">/comprobantes</span> bloquea toda lectura pública desde los servidores de Firebase. Únicamente los correos verificados en esta lista pueden consultar, descargar o gestionar los recibos de pago.
          </p>
        </div>
      </div>
    </div>
  );
};
