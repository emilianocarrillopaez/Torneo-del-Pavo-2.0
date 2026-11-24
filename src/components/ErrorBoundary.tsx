import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // No imprimir detalles técnicos ni datos personales en consola de producción
  }

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
      window.location.href = '/';
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen bg-[#072012] text-slate-100 flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-[#0b3320] border-2 border-amber-400 rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/50 text-amber-300 mx-auto flex items-center justify-center">
              <AlertTriangle size={34} />
            </div>
            <h1 className="font-festive text-2xl sm:text-3xl text-yellow-300">
              Algo salió mal
            </h1>
            <p className="text-sm text-emerald-200 leading-relaxed">
              Ocurrió un problema inesperado al cargar esta vista. Recarga la página o regresa al inicio de la convocatoria.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-4 py-3 rounded-xl text-sm cursor-pointer"
              >
                <RotateCcw size={16} />
                <span>Recargar la página</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-900 hover:bg-emerald-800 text-emerald-100 font-bold px-4 py-3 rounded-xl text-sm border border-emerald-700 cursor-pointer"
              >
                <Home size={16} />
                <span>Volver al inicio</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
