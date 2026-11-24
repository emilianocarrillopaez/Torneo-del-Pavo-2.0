import React from 'react';
import { PhoneCall, MapPin, Shield, Heart, ShieldCheck } from 'lucide-react';
import { TournamentConfig } from '../types/tournament';
import { formatWhatsAppUrl } from '../utils/tournamentUtils';

interface FooterProps {
  config: TournamentConfig;
  onOpenAdmin: () => void;
  onOpenPrivacy: () => void;
  onViewParticipants?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  config,
  onOpenAdmin,
  onOpenPrivacy,
  onViewParticipants,
}) => {
  const safeWhatsappHref = formatWhatsAppUrl(
    config.whatsappContacto,
    `Hola, tengo una pregunta sobre el ${config.titulo || 'Torneo del Pavo 2.0'} de ajedrez en Durango.`
  );

  return (
    <footer
      id="contacto"
      className="bg-[#05170d] text-emerald-200 border-t-2 border-emerald-800/80 pt-16 pb-12 relative z-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-emerald-900">
          {/* Col 1: Brand & Club info */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-emerald-950 font-black text-2xl shadow-lg border border-yellow-300">
                <span aria-hidden="true">🦃</span>
              </div>
              <div>
                <h3 className="font-festive text-xl text-yellow-300 tracking-wide">
                  {config.titulo || 'TORNEO DEL PAVO 2.0'}
                </h3>
                <span className="text-xs text-emerald-400 font-semibold block">
                  {config.club}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-emerald-300/90 leading-relaxed">
              El evento ajedrecístico tradicional de fin de año en Durango. Promoviendo el talento, el juego limpio y la convivencia familiar en el emblemático Corredor Constitución.
            </p>

            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <MapPin size={16} className="text-amber-400 shrink-0" />
              <span>{config.lugar}</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-festive text-sm uppercase text-amber-300 tracking-wider">
              Navegación Rápida
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <a href="#inicio" className="hover:text-amber-300 transition-colors">
                  Inicio & Presentación
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    if (onViewParticipants) {
                      onViewParticipants();
                    } else {
                      window.location.href = '/participantes';
                    }
                  }}
                  className="text-amber-300 font-bold hover:text-yellow-200 transition-colors cursor-pointer text-left"
                >
                  Lista de Participantes
                </button>
              </li>
              <li>
                <a href="#info" className="hover:text-amber-300 transition-colors">
                  Sede y Horarios
                </a>
              </li>
              <li>
                <a href="#categorias" className="hover:text-amber-300 transition-colors">
                  Categorías de Juego
                </a>
              </li>
              <li>
                <a href="#reglas" className="hover:text-amber-300 transition-colors">
                  Sistema y Desempates
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-amber-300 transition-colors">
                  Preguntas Frecuentes y Política
                </a>
              </li>
              <li>
                <a
                  href="#registro"
                  className="hover:text-amber-300 transition-colors font-bold text-amber-400"
                >
                  Formulario de Inscripción
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Direct WhatsApp Chat & Privacy */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="font-festive text-sm uppercase text-amber-300 tracking-wider">
              Atención y Privacidad
            </h4>
            <p className="text-xs text-emerald-300 leading-relaxed">
              ¿Dudas sobre inscripciones, transferencias o el reglamento? Contáctanos de inmediato por WhatsApp:
            </p>

            {safeWhatsappHref ? (
              <a
                href={safeWhatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 w-full bg-[#1a8a43] hover:bg-[#157437] text-white font-bold py-3.5 px-5 rounded-2xl text-sm shadow-lg transition-all transform active:scale-95 border border-emerald-400/40"
              >
                <PhoneCall size={18} />
                <span>WhatsApp Directo: {config.whatsappContacto}</span>
              </a>
            ) : (
              <div className="inline-flex items-center justify-center gap-2.5 w-full bg-emerald-950 text-emerald-300 font-bold py-3.5 px-5 rounded-2xl text-xs border border-emerald-800">
                <PhoneCall size={16} />
                <span>WhatsApp oficial por confirmar por el organizador</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-yellow-200 underline font-semibold cursor-pointer w-fit"
              >
                <ShieldCheck size={14} />
                <span>Aviso de Privacidad Integral (ARCO)</span>
              </button>

              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-amber-300 transition-colors cursor-pointer w-fit"
              >
                <Shield size={14} />
                <span>Acceso exclusivo comité organizador (/admin)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-emerald-400/90 gap-3">
          <p>© 2026 Club de Ajedrez Don Gonzalo · Durango, Dgo., México. Todos los derechos reservados.</p>
          <div className="flex items-center gap-1">
            <span>Hecho con</span>
            <Heart size={13} className="text-red-400 fill-red-400" aria-hidden="true" />
            <span>para el ajedrez duranguense</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
