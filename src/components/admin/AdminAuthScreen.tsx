import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  Shield,
  ShieldAlert,
  LogIn,
  LogOut,
  X,
  Loader2,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

interface AdminAuthScreenProps {
  onClose: () => void;
}

export const AdminAuthScreen: React.FC<AdminAuthScreenProps> = ({ onClose }) => {
  const {
    user,
    isAdmin,
    authPending,
    signInWithGoogle,
    signOut,
    refreshAdminStatus,
    error,
    clearError,
  } = useAuth();

  const [checkingRole, setCheckingRole] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, onClose, true);

  const handleRecheck = async () => {
    setCheckingRole(true);
    try {
      await refreshAdminStatus();
    } finally {
      setCheckingRole(false);
    }
  };

  // Case 1: User is signed in, but NOT authorized as admin
  if (user && !isAdmin) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-restricted-title"
      >
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="bg-[#0b3320] border-2 border-red-500/80 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center text-white relative focus:outline-none"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-emerald-300 hover:text-white p-2 rounded-full hover:bg-emerald-800 cursor-pointer"
            aria-label="Cerrar panel de acceso"
          >
            <X size={20} />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/50 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert size={34} aria-hidden="true" />
          </div>

          <h2 id="admin-restricted-title" className="font-festive text-2xl text-red-300 mb-2">
            Acceso Restringido
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200 mb-4 leading-relaxed">
            Tu cuenta no tiene permisos de administrador. Pide al organizador que te agregue.
          </p>

          <div className="bg-emerald-950/90 border border-emerald-800 rounded-2xl p-3.5 text-left text-xs text-emerald-300 mb-5 space-y-1">
            <p className="font-bold text-amber-300">Sesión actual</p>
            <p className="font-mono text-white break-all">{user.email || 'Cuenta sin correo verificado'}</p>
            <p className="pt-1">
              Si ya fuiste autorizado recientemente por el organizador, presiona{' '}
              <strong>Verificar permisos nuevamente</strong> o cambia de cuenta de Google.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={checkingRole}
              className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-emerald-600 cursor-pointer"
            >
              {checkingRole ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>Verificar permisos nuevamente</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                clearError();
                await signOut();
                await signInWithGoogle();
              }}
              disabled={authPending}
              className="w-full bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn size={16} />
              <span>Cambiar de cuenta con Google</span>
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full bg-red-950/70 hover:bg-red-900 text-red-200 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-red-800 cursor-pointer"
            >
              <LogOut size={14} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Not signed in (Google Sign-In únicamente, con correo verificado)
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-[#0b3320] border-2 border-amber-400 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-white relative focus:outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-emerald-300 hover:text-white p-2 rounded-full hover:bg-emerald-800 cursor-pointer"
          aria-label="Cerrar panel de acceso"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/20 text-amber-300 border-2 border-amber-400/50 mx-auto flex items-center justify-center mb-3">
            <Shield size={32} aria-hidden="true" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
            Acceso Privado · Comité Organizador
          </span>
          <h2 id="admin-login-title" className="font-festive text-2xl sm:text-3xl text-yellow-300 mt-1">
            PANEL ADMINISTRADOR
          </h2>
          <p className="text-xs text-emerald-200 mt-1">
            Gestiona inscritos, valida recibos privados, exporta PDF/Excel y edita la convocatoria.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-950/90 border border-red-500/80 text-red-200 p-3 rounded-xl text-xs mb-4 leading-relaxed"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            clearError();
            void signInWithGoogle();
          }}
          disabled={authPending}
          data-testid="admin-google-signin"
          className="w-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60 text-emerald-950 font-black py-3.5 px-4 rounded-2xl text-sm shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer mb-4"
        >
          {authPending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Conectando con Google...</span>
            </>
          ) : (
            <>
              <LogIn size={18} />
              <span>Ingresar con Google</span>
            </>
          )}
        </button>

        <div className="bg-emerald-950/90 border border-emerald-800 rounded-2xl p-3.5 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <KeyRound size={14} aria-hidden="true" />
            <span>Control de Acceso Verificado</span>
          </div>
          <p className="text-[11px] text-emerald-200 leading-relaxed">
            Por seguridad, el acceso administrativo requiere autenticación con cuenta Google verificada autorizada en la lista interna del comité. La sesión se cierra automáticamente tras 30 minutos de inactividad.
          </p>
        </div>
      </div>
    </div>
  );
};
