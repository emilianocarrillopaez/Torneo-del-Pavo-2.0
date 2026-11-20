import React from 'react';
import { PhoneCall, MapPin, Mail, Shield, Heart } from 'lucide-react';
import { TournamentConfig } from '../types/tournament';

interface FooterProps {
  config: TournamentConfig;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({ config, onOpenAdmin }) => {
  return (
    <footer id="contacto" className="bg-[#05170d] text-emerald-200 border-t-2 border-emerald-800/80 pt-16 pb-12 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-emerald-900">
          {/* Col 1: Brand & Club info */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-emerald-950 font-black text-2xl shadow-lg border border-yellow-300">
                🦃
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
                <a href="#inicio" className="hover:text-amber-300 transition-colors">Inicio & Presentación</a>
              </li>
              <li>
                <a href="#participantes" className="text-amber-300 font-bold hover:text-yellow-200 transition-colors">👥 Lista de Participantes</a>
              </li>
              <li>
                <a href="#info" className="hover:text-amber-300 transition-colors">Sede y Horarios</a>
              </li>
              <li>
                <a href="#categorias" className="hover:text-amber-300 transition-colors">Categorías de Juego</a>
              </li>
              <li>
                <a href="#reglas" className="hover:text-amber-300 transition-colors">Sistema y Desempates</a>
              </li>
              <li>
                <a href="#premiacion" className="hover:text-amber-300 transition-colors">Premios y Pavos</a>
              </li>
              <li>
                <a href="#registro" className="hover:text-amber-300 transition-colors font-bold text-amber-400">
                  Formulario de Inscripción
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Direct WhatsApp Chat */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="font-festive text-sm uppercase text-amber-300 tracking-wider">
              Atención y Soporte
            </h4>
            <p className="text-xs text-emerald-300 leading-relaxed">
              ¿Dudas sobre inscripciones, transferencias o el reglamento? Contáctanos de inmediato por WhatsApp:
            </p>

            <a
              href={`https://wa.me/52${config.whatsappContacto}?text=${encodeURIComponent(
                'Hola, tengo una pregunta sobre el Torneo del Pavo 2026 de ajedrez en Durango.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-3.5 px-5 rounded-2xl text-sm shadow-lg hover:shadow-green-500/20 transition-all transform active:scale-95"
            >
              <PhoneCall size={18} />
              <span>WhatsApp Directo: {config.whatsappContacto}</span>
            </a>

            <div className="pt-2">
              <button
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-amber-300 transition-colors"
              >
                <Shield size={14} />
                <span>Acceso exclusivo comité organizador (/admin)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-emerald-400/80 gap-3">
          <p>© 2026 Club de Ajedrez Don Gonzalo · Durango, Dgo., México. Todos los derechos reservados.</p>
          <div className="flex items-center gap-1">
            <span>Hecho con</span>
            <Heart size={13} className="text-red-400 fill-red-400" />
            <span>para el ajedrez duranguense</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
