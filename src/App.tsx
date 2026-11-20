import React, { useState, useEffect } from 'react';
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
import { RegistrationForm } from './components/RegistrationForm';
import { Footer } from './components/Footer';
import { AdminPanel } from './components/AdminPanel';
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
  seedInitialDataIfEmpty,
} from './services/tournamentService';
import { testConnection } from './lib/firebase';

import { ParticipantsPage } from './components/ParticipantsPage';

export function TournamentApp() {
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [sponsors, setSponsors] = useState<Sponsor[]>(INITIAL_SPONSORS);
  const [totalRegistered, setTotalRegistered] = useState<number>(0);
  const [showAdmin, setShowAdmin] = useState<boolean>(false);
  const [initialReceiptId, setInitialReceiptId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | null>(null);
  const [currentView, setCurrentView] = useState<'home' | 'participantes'>('home');

  // Initialize and check connection
  useEffect(() => {
    testConnection();
    seedInitialDataIfEmpty();

    // Listen to route / hash for admin panel, admin receipt deep-links, or participants page
    const checkHash = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;

      if (hash.startsWith('#admin-recibo=')) {
        const receiptId = decodeURIComponent(hash.replace('#admin-recibo=', '').trim());
        if (receiptId) {
          setInitialReceiptId(receiptId);
          setShowAdmin(true);
        }
      } else if (hash === '#admin' || path === '/admin') {
        setShowAdmin(true);
      }

      if (
        hash === '#participantes' ||
        hash === '#registrados' ||
        path === '/participantes'
      ) {
        setCurrentView('participantes');
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      } else if (hash === '#inicio' || hash === '#home') {
        setCurrentView('home');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    window.addEventListener('popstate', checkHash);

    // Subscribe to tournament config
    const unsubConfig = subscribeToConfig((updated) => {
      setConfig(updated);
      if (updated.totalInscritos !== undefined) {
        setTotalRegistered(updated.totalInscritos);
      }
    });

    // Subscribe to sponsors
    const unsubSponsors = subscribeToSponsors((updated) => {
      setSponsors(updated);
    });

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('popstate', checkHash);
      unsubConfig();
      unsubSponsors();
    };
  }, []);

  const handleOpenAdmin = () => {
    setShowAdmin(true);
  };

  const handleCloseAdmin = () => {
    setShowAdmin(false);
    setInitialReceiptId(null);
    if (window.location.hash === '#admin' || window.location.hash.startsWith('#admin-recibo=')) {
      window.history.pushState(null, '', currentView === 'participantes' ? '#participantes' : '#inicio');
    }
  };

  const handleGoHome = () => {
    setCurrentView('home');
    window.location.hash = '#inicio';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewParticipants = () => {
    setCurrentView('participantes');
    window.location.hash = '#participantes';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const placesLeft = Math.max(0, config.cupoMaximo - totalRegistered);

  return (
    <div className="min-h-screen bg-[#072012] text-slate-100 flex flex-col selection:bg-amber-400 selection:text-emerald-950">
      {/* Christmas fairy lights & falling snow effect */}
      <ChristmasDecorations />

      {/* Top Red Ribbon (fiel al flyer) */}
      <TopRibbon clubName={config.club || 'CLUB DE AJEDREZ DON GONZALO'} />

      {/* Sticky Navigation */}
      <Navbar
        onOpenAdmin={handleOpenAdmin}
        onViewParticipants={handleViewParticipants}
        onGoHome={handleGoHome}
        currentView={currentView}
        placesLeft={placesLeft}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'participantes' ? (
          <ParticipantsPage
            config={config}
            onBack={handleGoHome}
            onRegisterClick={() => {
              handleGoHome();
              setTimeout(() => {
                const reg = document.querySelector('#registro');
                if (reg) reg.scrollIntoView({ behavior: 'smooth' });
              }, 200);
            }}
            onOpenAdmin={handleOpenAdmin}
          />
        ) : (
          <>
            {/* 1. Hero */}
            <Hero
              config={config}
              totalRegistered={totalRegistered}
              onViewParticipants={handleViewParticipants}
            />

            {/* 2. Info & Venue */}
            <InfoSection config={config} totalRegistered={totalRegistered} />

            {/* 3. Categorías */}
            <CategoriesSection onSelectCategory={(cat) => setSelectedCategory(cat)} />

            {/* 4. Sistema de Competencia */}
            <RulesSection config={config} />

            {/* 5. Premiación & Pavos */}
            <PrizesSection config={config} />

            {/* 6. Transitorios */}
            <TransitoriosSection config={config} />

            {/* 7. Patrocinadores (Carrusel aleatorio) */}
            <SponsorsCarousel sponsors={sponsors} />

            {/* 8. Formulario de Registro */}
            <RegistrationForm
              config={config}
              totalRegistered={totalRegistered}
              preselectedCategory={selectedCategory}
              onRegistrationSuccess={() => {
                // Count will auto-refresh via Firestore listener
              }}
            />
          </>
        )}
      </main>

      {/* 9. Contacto & Footer */}
      <Footer config={config} onOpenAdmin={handleOpenAdmin} />

      {/* Admin Panel Modal (/admin) */}
      {showAdmin && (
        <AdminPanel
          config={config}
          sponsors={sponsors}
          initialReceiptId={initialReceiptId}
          onClose={handleCloseAdmin}
        />
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
