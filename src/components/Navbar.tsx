import React, { useState } from 'react';
import { Menu, X, Shield, Award, Calendar, MapPin, Users, HelpCircle, PhoneCall } from 'lucide-react';

interface NavbarProps {
  onOpenAdmin: () => void;
  onViewParticipants: () => void;
  onGoHome?: () => void;
  currentView?: 'home' | 'participantes';
  placesLeft?: number;
  isCountLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAdmin,
  onViewParticipants,
  onGoHome,
  currentView = 'home',
  placesLeft,
  isCountLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Inicio', href: '#inicio', icon: Calendar },
    { name: 'Información', href: '#info', icon: MapPin },
    { name: 'Categorías', href: '#categorias', icon: Users },
    { name: 'Bases & Sistema', href: '#reglas', icon: HelpCircle },
    { name: 'Premiación', href: '#premiacion', icon: Award },
    { name: 'Patrocinadores', href: '#patrocinadores', icon: Users },
    { name: 'FAQ', href: '#faq', icon: HelpCircle },
    { name: 'Contacto', href: '#contacto', icon: PhoneCall },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsOpen(false);
    if (currentView === 'participantes' && onGoHome) {
      onGoHome();
      window.setTimeout(() => {
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return;
    }
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#092b1a]/95 backdrop-blur-md border-b border-emerald-700/50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <a
            href="#inicio"
            onClick={(e) => {
              e.preventDefault();
              if (onGoHome) onGoHome();
            }}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-emerald-950 font-black text-xl shadow-md border border-amber-300 group-hover:scale-105 transition-transform">
              <span aria-hidden="true">🦃</span>
            </div>
            <div>
              <span className="font-festive text-lg sm:text-xl font-bold tracking-wide text-amber-300 drop-shadow block leading-tight">
                PAVO 2.0
              </span>
              <span className="text-[10px] text-emerald-300 tracking-wider block font-medium">
                DURANGO AJEDREZ
              </span>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav
            aria-label="Navegación principal"
            className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-sm font-medium text-emerald-100"
          >
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="px-2 py-1.5 rounded-lg hover:text-amber-300 hover:bg-emerald-800/40 transition-colors text-xs xl:text-sm"
              >
                {link.name}
              </a>
            ))}

            <button
              type="button"
              onClick={onViewParticipants}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer ${
                currentView === 'participantes'
                  ? 'bg-amber-400 text-emerald-950 shadow-md'
                  : 'bg-emerald-900/90 text-amber-300 hover:bg-amber-400 hover:text-emerald-950 border border-amber-400/40'
              }`}
            >
              <Users size={14} />
              <span>Participantes</span>
            </button>
          </nav>

          {/* Actions */}
          <div className="hidden sm:flex items-center gap-2.5">
            {isCountLoading ? (
              <span className="hidden xl:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/40">
                Consultando cupo...
              </span>
            ) : placesLeft !== undefined ? (
              <span className="hidden xl:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-900/80 text-amber-300 border border-emerald-600/40">
                {placesLeft > 0 ? `${placesLeft} disp.` : 'Cupo lleno'}
              </span>
            ) : null}

            <button
              type="button"
              onClick={onViewParticipants}
              className="lg:hidden bg-emerald-900/90 text-amber-300 font-bold px-3 py-1.5 rounded-xl text-xs border border-amber-400/40 flex items-center gap-1 cursor-pointer"
            >
              <Users size={14} />
              <span>Padrón</span>
            </button>

            <a
              href="#registro"
              onClick={(e) => handleNavClick(e, '#registro')}
              className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-emerald-950 font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all transform active:scale-95 flex items-center gap-1.5"
            >
              <span>¡Inscríbete!</span>
              <span aria-hidden="true">♟</span>
            </a>

            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label="Abrir panel de administración"
              title="Panel de Administración"
              className="p-2 text-emerald-300 hover:text-amber-300 hover:bg-emerald-800/40 rounded-lg transition-colors border border-transparent hover:border-emerald-700 cursor-pointer"
            >
              <Shield size={18} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label="Abrir panel de administración"
              title="Panel Admin"
              className="p-2 text-emerald-300 hover:text-amber-300 cursor-pointer"
            >
              <Shield size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/60 cursor-pointer"
              aria-label={isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <nav
          aria-label="Navegación móvil"
          className="lg:hidden bg-[#0a2f1c] border-b border-emerald-700/60 px-4 pt-2 pb-6 space-y-2 shadow-2xl"
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium text-emerald-100 hover:text-amber-300 hover:bg-emerald-800/50 transition-colors"
              >
                <Icon size={18} className="text-amber-400" />
                {link.name}
              </a>
            );
          })}
          <div className="pt-3 border-t border-emerald-800/60 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onViewParticipants();
              }}
              className="w-full text-center bg-emerald-900/90 text-amber-300 font-bold py-2.5 rounded-xl text-sm border border-amber-400/50 flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              <Users size={16} />
              <span>Ver Lista de Participantes Registrados</span>
            </button>
            <a
              href="#registro"
              onClick={(e) => handleNavClick(e, '#registro')}
              className="w-full text-center bg-gradient-to-r from-amber-400 to-amber-500 text-emerald-950 font-black py-3 rounded-xl text-base shadow-lg"
            >
              ¡Regístrate al Torneo! ♟
            </a>
          </div>
        </nav>
      )}
    </header>
  );
};
