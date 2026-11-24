import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const ADMIN_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  authPending: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: (reasonMessage?: string) => Promise<void>;
  refreshAdminStatus: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Verifica privilegios de administrador exclusivamente contra Firestore (/admins/{uid} y /admins_by_email/{email}),
 * exigiendo correo verificado (emailVerified === true). Sin correos hardcodeados en el bundle del cliente.
 */
async function checkIsAdminUser(currentUser: User | null): Promise<boolean> {
  if (!currentUser || !currentUser.email || !currentUser.emailVerified) {
    return false;
  }

  const userEmailLower = currentUser.email.trim().toLowerCase();

  try {
    const uidDoc = await getDoc(doc(db, 'admins', currentUser.uid));
    if (uidDoc.exists()) return true;
  } catch {
    // Continuar con verificación por correo
  }

  try {
    const emailDoc = await getDoc(doc(db, 'admins_by_email', userEmailLower));
    if (emailDoc.exists()) return true;
  } catch {
    // No autorizado
  }

  return false;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authPending, setAuthPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const authLockRef = useRef<boolean>(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const signOut = useCallback(
    async (reasonMessage?: string) => {
      clearInactivityTimer();
      setError(reasonMessage || null);
      try {
        await firebaseSignOut(auth);
      } catch {
        // Ignorar errores transitorios al cerrar sesión
      } finally {
        setUser(null);
        setIsAdmin(false);
      }
    },
    [clearInactivityTimer]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const adminStatus = await checkIsAdminUser(currentUser);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cierre de sesión automático por inactividad (30 minutos) cuando hay sesión admin activa
  useEffect(() => {
    if (!isAdmin) {
      clearInactivityTimer();
      return;
    }

    const resetTimer = () => {
      clearInactivityTimer();
      inactivityTimerRef.current = setTimeout(() => {
        signOut('Tu sesión de administrador se cerró automáticamente tras 30 minutos de inactividad.');
      }, ADMIN_INACTIVITY_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'click',
      'touchstart',
      'scroll',
    ];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearInactivityTimer();
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isAdmin, clearInactivityTimer, signOut]);

  const refreshAdminStatus = async () => {
    if (!auth.currentUser) {
      setIsAdmin(false);
      return;
    }
    const adminStatus = await checkIsAdminUser(auth.currentUser);
    setIsAdmin(adminStatus);
  };

  const signInWithGoogle = async () => {
    if (authLockRef.current) return;
    authLockRef.current = true;
    setAuthPending(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const adminStatus = await checkIsAdminUser(result.user);
      setIsAdmin(adminStatus);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Inicio de sesión cancelado. Vuelve a intentarlo cuando estés listo.');
        return;
      }
      if (code === 'auth/popup-blocked') {
        setError(
          'El navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes para continuar.'
        );
        return;
      }
      if (code === 'auth/unauthorized-domain') {
        setError('Este dominio aún no está autorizado para iniciar sesión.');
        return;
      }
      setError('No se pudo iniciar sesión con Google. Intenta de nuevo en unos momentos.');
    } finally {
      authLockRef.current = false;
      setAuthPending(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading,
        authPending,
        signInWithGoogle,
        signOut: () => signOut(),
        refreshAdminStatus,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
