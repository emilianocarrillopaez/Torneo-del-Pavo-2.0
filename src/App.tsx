import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ChristmasDecorations } from './components/ChristmasDecorations';
import { TopRibbon } from './components/TopRibbon';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { InfoSection } from './components/InfoSection';
import { CategoriesSection } from './components/CategoriesSection';
import { RulesSection } from './components/RulesSection';
import { PrizesSection } from './components/PrizesSection';
import { TransitoriosSection } from './components/TransitoriosSection';
import { SponsorsCarousel } from './components/SponsorsCarousel';
import { FaqSection } from './components/FaqSection';
import { RegistrationForm } from './components/RegistrationForm';
import { Footer } from './components/Footer';
import { ParticipantsPage } from './components/ParticipantsPage';
import { PrivacyNoticeModal } from './components/PrivacyNoticeModal';
import {
  TournamentConfig,
  Sponsor,
  DEFAULT_CONFIG,
  INITIAL_SPONSORS,
  TournamentCategory,
} from './types/tournament';
import {
  subscribeToConfig,
  subscribeToSponsors,
  fetchPublicParticipantsCount,
} from './services/tournamentService';
import { testConnection } from './lib/firebase';
import { AlertCircle, Loader2, X } from 'lucide-react';

// Carga diferida del panel administrativo (incluye jsPDF y ExcelJS bajo demanda)
const AdminPanel = lazy(() =>
  import('./components/AdminPanel').then((mod) => ({ default: mod.AdminPanel }))
);

function parseAdminReceiptFromHash(hash: string): {
  matched: boolean;
  receiptId: string | null;
  malformed: boolean;
} {
  if (!hash.startsWith('#admin-recibo=')) {
    return { matched: false, receiptId: null, malformed: false };
  }
  const raw = hash.slice('#admin-recibo='.length).trim();
  if (!raw) {
    return { matched: true, receiptId: null, malformed: true };
  }
  try {
    const decoded = decodeURIComponent(raw).trim();
    if (!decoded) {
      return { matched: true, receiptId: null, malformed: true };
    }
    return { matched: true, receiptId: decoded, malformed: false };
  } catch {
    return { matched: true, receiptId: null, malformed: true };
  }
}

function readInitialRouteState(): {
  showAdmin: boolean;
  initialReceiptId: string | null;
  urlErrorNotice: string | null;
  currentView: 'home' | 'participantes';
  shouldReplaceRoot: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      showAdmin: false,
      initialReceiptId: null,
      urlErrorNotice: null,
      currentView: 'home',
      shouldReplaceRoot: false,
    };
  }
  const hash = window.location.hash;
  const path = window.location.pathname;
  const receiptParse = parseAdminReceiptFromHash(hash);
  if (receiptParse.matched) {
    if (receiptParse.malformed) {
      return {
        showAdmin: false,
        initialReceiptId: null,
        urlErrorNotice:
          'El enlace del comprobante está incompleto o tiene un formato inválido. Se abrió el inicio de forma segura.',
        currentView: 'home',
        shouldReplaceRoot: true,
      };
    }
    return {
      showAdmin: true,
      initialReceiptId: receiptParse.receiptId,
      urlErrorNotice: null,
      currentView: 'home',
      shouldReplaceRoot: false,
    };
  }
  const showAdmin = path === '/admin' || hash === '#admin';
  const currentView =
    path === '/participantes' || hash === '#participantes' || hash === '#registrados'
      ? 'participantes'
      : 'home';
  return {
    showAdmin,
    initialReceiptId: null,
    urlErrorNotice: null,
    currentView,
    shouldReplaceRoot: false,
  };
}

export function TournamentApp() {
  const [initialRoute] = useState(readInitialRouteState);
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [sponsors, setSponsors] = useState<Sponsor[]>(INITIAL_SPONSORS);
  const [totalRegistered, setTotalRegistered] = useState<number>(0);
  const [isCountLoading, setIsCountLoading] = useState<boolean>(true);
  const [showAdmin, setShowAdmin] = useState<boolean>(initialRoute.showAdmin);
  const [initialReceiptId, setInitialReceiptId] = useState<string | null>(
    initialRoute.initialReceiptId
  );
  const [urlErrorNotice, setUrlErrorNotice] = useState<string | null>(initialRoute.urlErrorNotice);
  const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'participantes'>(
    initialRoute.currentView
  );
  const [showPrivacyModal, setShowPrivacyModal] = useState<boolean>(false);
  const currentViewRef = useRef(currentView);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const refreshRegisteredCount = useCallback(async () => {
    try {
      const count = await fetchPublicParticipantsCount();
      setTotalRegistered(count);
    } catch {
      // Conservar último valor seguro sin romper la interfaz
    } finally {
      setIsCountLoading(false);
    }
  }, []);

  // Sincronización unificada de ruta y estado (pathname + compatibilidad #hash)
  const syncStateFromLocation = useCallback(() => {
    const hash = window.location.hash;
    const path = window.location.pathname;

    const receiptParse = parseAdminReceiptFromHash(hash);
    if (receiptParse.matched) {
      if (receiptParse.malformed) {
        setUrlErrorNotice(
          'El enlace del comprobante está incompleto o tiene un formato inválido. Se abrió el inicio de forma segura.'
        );
        setInitialReceiptId(null);
        setShowAdmin(false);
        window.history.replaceState(null, '', '/');
        return;
      }
      setInitialReceiptId(receiptParse.receiptId);
      setShowAdmin(true);
      return;
    }

    if (path === '/admin' || hash === '#admin') {
      setShowAdmin(true);
    } else {
      setShowAdmin(false);
      setInitialReceiptId(null);
    }

    if (path === '/participantes' || hash === '#participantes' || hash === '#registrados') {
      setCurrentView('participantes');
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } else {
      setCurrentView('home');
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (initialRoute.shouldReplaceRoot) {
      window.history.replaceState(null, '', '/');
    }

    void testConnection();
    void fetchPublicParticipantsCount()
      .then((count) => {
        if (active) setTotalRegistered(count);
      })
      .catch(() => {
        // Conservar último valor seguro sin romper la interfaz
      })
      .finally(() => {
        if (active) setIsCountLoading(false);
      });

    window.addEventListener('hashchange', syncStateFromLocation);
    window.addEventListener('popstate', syncStateFromLocation);

    const unsubConfig = subscribeToConfig((updated) => {
      setConfig(updated);
    });

    const unsubSponsors = subscribeToSponsors((updated) => {
      setSponsors(updated);
    });

    // Refresco ocasional de cupo (cada 90 s si la pestaña está visible y no está abierta la vista de padrón)
    const countInterval = window.setInterval(() => {
      if (
        typeof document !== 'undefined' &&
        !document.hidden &&
        currentViewRef.current !== 'participantes'
      ) {
        void refreshRegisteredCount();
      }
    }, 90_000);

    return () => {
      active = false;
      window.removeEventListener('hashchange', syncStateFromLocation);
      window.removeEventListener('popstate', syncStateFromLocation);
      window.clearInterval(countInterval);
      unsubConfig();
      unsubSponsors();
    };
  }, [initialRoute.shouldReplaceRoot, refreshRegisteredCount, syncStateFromLocation]);

  // Etiqueta noindex dinámica cuando /admin está abierto
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-admin-meta="true"]');
    if (showAdmin) {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.name = 'robots';
        robotsMeta.setAttribute('data-admin-meta', 'true');
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.content = 'noindex, nofollow';
    } else if (robotsMeta) {
      robotsMeta.remove();
    }
  }, [showAdmin]);

  // Datos estructurados SportsEvent JSON-LD actualizados desde config
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const scriptEl = document.getElementById('sports-event-jsonld');
    if (!scriptEl) return;

    const configuredSiteUrl = (import.meta.env.VITE_SITE_URL || '').trim().replace(/\/$/, '');
    const origin = configuredSiteUrl || window.location.origin;
    const isClosed =
      !config.inscripcionesAbiertas ||
      (!isCountLoading && config.cupoMaximo - totalRegistered <= 0);

    const ldJson = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${config.titulo || 'Torneo del Pavo 2.0'} · ${config.club || 'Club de Ajedrez Don Gonzalo'}`,
      startDate: config.fechaIso || DEFAULT_CONFIG.fechaIso,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      sport: 'Chess',
      location: {
        '@type': 'Place',
        name: config.lugar || 'Corredor Constitución, Durango',
        address: {
          '@type': 'PostalAddress',
          streetAddress: config.referencia || 'Corredor Constitución',
          addressLocality: 'Victoria de Durango',
          addressRegion: 'Durango',
          addressCountry: 'MX',
        },
      },
      organizer: {
        '@type': 'Organization',
        name: config.club || 'Club de Ajedrez Don Gonzalo',
      },
      image: [`${origin}/assets/cartel-2026-og.jpg`],
      offers: {
        '@type': 'Offer',
        price: String(config.costo || 200),
        priceCurrency: 'MXN',
        availability: isClosed ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        url: `${origin}/#registro`,
      },
    };
    scriptEl.textContent = JSON.stringify(ldJson);
  }, [config, isCountLoading, totalRegistered]);

  const handleOpenAdmin = () => {
    setShowAdmin(true);
    if (window.location.pathname !== '/admin' && !window.location.hash.startsWith('#admin-recibo=')) {
      window.history.pushState({ view: 'admin' }, '', '/admin');
    }
  };

  const handleCloseAdmin = () => {
    setShowAdmin(false);
    setInitialReceiptId(null);
    const targetPath = currentView === 'participantes' ? '/participantes' : '/';
    if (
      window.location.pathname === '/admin' ||
      window.location.hash === '#admin' ||
      window.location.hash.startsWith('#admin-recibo=')
    ) {
      window.history.replaceState(null, '', targetPath);
    }
  };

  const handleGoHome = () => {
    setShowAdmin(false);
    setInitialReceiptId(null);
    setCurrentView('home');
    if (window.location.pathname !== '/' || window.location.hash) {
      window.history.pushState({ view: 'home' }, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewParticipants = () => {
    setShowAdmin(false);
    setInitialReceiptId(null);
    setCurrentView('participantes');
    if (window.location.pathname !== '/participantes') {
      window.history.pushState({ view: 'participantes' }, '', '/participantes');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const placesLeft = isCountLoading
    ? undefined
    : Math.max(0, config.cupoMaximo - totalRegistered);

  return (
    <div className="min-h-screen bg-[#072012] text-slate-100 flex flex-col selection:bg-amber-400 selection:text-emerald-950">
      <ChristmasDecorations />
      <TopRibbon clubName={config.club || 'CLUB DE AJEDREZ DON GONZALO'} />

      <Navbar
        onOpenAdmin={handleOpenAdmin}
        onViewParticipants={handleViewParticipants}
        onGoHome={handleGoHome}
        currentView={currentView}
        placesLeft={placesLeft}
        isCountLoading={isCountLoading}
      />

      {urlErrorNotice && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-950/95 border-b border-amber-400/60 text-amber-100 px-4 py-2.5 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 max-w-7xl mx-auto">
            <AlertCircle size={16} className="text-amber-300 shrink-0" />
            <span>{urlErrorNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setUrlErrorNotice(null)}
            aria-label="Cerrar aviso de enlace inválido"
            className="text-amber-300 hover:text-white p-1 rounded cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <main className="flex-1">
        {currentView === 'participantes' ? (
          <ParticipantsPage
            config={config}
            onBack={handleGoHome}
            onRegisterClick={() => {
              handleGoHome();
              window.setTimeout(() => {
                const reg = document.querySelector('#registro');
                if (reg) reg.scrollIntoView({ behavior: 'smooth' });
              }, 200);
            }}
            onOpenAdmin={handleOpenAdmin}
          />
        ) : (
          <>
            <Hero
              config={config}
              totalRegistered={totalRegistered}
              isCountLoading={isCountLoading}
              onViewParticipants={handleViewParticipants}
            />

            <InfoSection
              config={config}
              totalRegistered={totalRegistered}
              isCountLoading={isCountLoading}
            />

            <CategoriesSection
              config={config}
              onSelectCategory={(cat) => setSelectedCategory(cat)}
            />

            <RulesSection config={config} />

            <PrizesSection config={config} />

            <TransitoriosSection config={config} />

            <SponsorsCarousel sponsors={sponsors} />

            <FaqSection config={config} />

            <RegistrationForm
              config={config}
              totalRegistered={totalRegistered}
              isCountLoading={isCountLoading}
              preselectedCategory={selectedCategory}
              onRegistrationSuccess={() => void refreshRegisteredCount()}
            />
          </>
        )}
      </main>

      <Footer
        config={config}
        onOpenAdmin={handleOpenAdmin}
        onOpenPrivacy={() => setShowPrivacyModal(true)}
        onViewParticipants={handleViewParticipants}
      />

      {showPrivacyModal && (
        <PrivacyNoticeModal config={config} onClose={() => setShowPrivacyModal(false)} />
      )}

      {showAdmin && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#0b3320] border border-amber-400/60 rounded-2xl p-8 text-center text-emerald-200 flex flex-col items-center gap-3">
                <Loader2 size={32} className="animate-spin text-amber-400" />
                <span className="font-festive text-lg text-yellow-300">
                  Cargando panel administrativo...
                </span>
              </div>
            </div>
          }
        >
          <AdminPanel
            config={config}
            sponsors={sponsors}
            initialReceiptId={initialReceiptId}
            onClose={handleCloseAdmin}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TournamentApp />
    </AuthProvider>
  );
}
