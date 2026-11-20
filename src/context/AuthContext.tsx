import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  authPending: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAdminStatus: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AUTHORIZED_ADMIN_EMAILS = [
  'emilianocarrillopaez@gmail.com',
  'arbitro@torneodelpavo.com',
  'comite@torneodelpavo.com',
  'eduardoroqueta.ajedrez@gmail.com',
];

async function checkIsAdminUser(currentUser: User | null): Promise<boolean> {
  if (!currentUser || !currentUser.email) return false;
  const userEmailLower = currentUser.email.trim().toLowerCase();

  // 1. Check built-in authorized emails
  const isEmailAdmin = AUTHORIZED_ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase() === userEmailLower
  );
  if (isEmailAdmin) return true;

  // 2. Check /admins/{uid}
  try {
    const uidDoc = await getDoc(doc(db, 'admins', currentUser.uid));
    if (uidDoc.exists()) return true;
  } catch {
    // Continue to email check
  }

  // 3. Check /admins_by_email/{email} (for dynamically authorized Google admins)
  try {
    const emailDoc = await getDoc(doc(db, 'admins_by_email', userEmailLower));
    if (emailDoc.exists()) return true;
  } catch {
    // Not authorized
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
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user') ||
        err?.message?.includes('cancelled-popup-request')
      ) {
        setError('Inicio de sesión cancelado (ventana cerrada). Vuelve a intentarlo cuando estés listo.');
        return;
      }
      if (err?.code === 'auth/popup-blocked') {
        const msg =
          'El navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes en este sitio e intenta de nuevo.';
        setError(msg);
        return;
      }
      if (err?.code === 'auth/unauthorized-domain') {
        const msg =
          'Este dominio aún no está autorizado en Firebase Authentication (Authorized domains).';
        setError(msg);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión con Google';
      setError(msg);
    } finally {
      authLockRef.current = false;
      setAuthPending(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (authLockRef.current) return;
    authLockRef.current = true;
    setAuthPending(true);
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const adminStatus = await checkIsAdminUser(result.user);
      setIsAdmin(adminStatus);
    } catch (err: any) {
      const code = err?.code || '';
      let msg = 'Error al iniciar sesión con correo y contraseña.';
      if (code === 'auth/operation-not-allowed') {
        msg =
          'El método de Correo/Contraseña no está activado en Firebase Console. Usa el botón "Continuar con Google" o activa Correo/Contraseña en Firebase Authentication.';
      } else if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        msg = 'Correo o contraseña incorrectos. Verifica tus credenciales o ingresa con Google.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos fallidos. Espera unos minutos antes de reintentar.';
      }
      setError(msg);
      throw new Error(msg);
    } finally {
      authLockRef.current = false;
      setAuthPending(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string) => {
    if (authLockRef.current) return;
    authLockRef.current = true;
    setAuthPending(true);
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const adminStatus = await checkIsAdminUser(result.user);
      setIsAdmin(adminStatus);
    } catch (err: any) {
      const code = err?.code || '';
      const msg =
        code === 'auth/operation-not-allowed'
          ? 'El registro por Correo/Contraseña no está activado en Firebase Console. Ingresa directamente con Google.'
          : err instanceof Error
          ? err.message
          : 'Error al crear cuenta.';
      setError(msg);
      throw new Error(msg);
    } finally {
      authLockRef.current = false;
      setAuthPending(false);
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      setIsAdmin(false);
    } catch (err) {
      console.error('Sign out error:', err);
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
        signInWithEmail,
        registerWithEmail,
        signOut,
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
