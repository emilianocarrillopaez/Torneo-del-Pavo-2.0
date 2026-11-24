import React, { useState } from 'react';
import { ChevronDown, HelpCircle, ShieldAlert } from 'lucide-react';
import { TournamentConfig } from '../types/tournament';
import { deriveAgeCutoffs } from '../utils/tournamentUtils';

interface FaqSectionProps {
  config: TournamentConfig;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  isDraftPolicy?: boolean;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ config }) => {
  const [openId, setOpenId] = useState<string>('pago');
  const cutoffs = deriveAgeCutoffs(config.fechaIso);

  const items: FaqItem[] = [
    {
      id: 'pago',
      question: '¿Cómo realizo el pago de mi inscripción y subo mi recibo?',
      answer: `La cuota de recuperación es de $${config.costo} MXN. Puedes pagar por transferencia SPEI a la cuenta mostrada en el formulario o en efectivo en Tatuajes Durango (Corredor Constitución). Toma foto o captura de tu comprobante (JPG, PNG, WEBP o PDF) y súbelo en el formulario: queda guardado en una bóveda privada visible únicamente para el comité organizador.`,
    },
    {
      id: 'padron',
      question: '¿Por qué mi nombre aparece abreviado o cómo se protege mi privacidad?',
      answer:
        'Para proteger los datos personales de todos los jugadores (incluidos menores de edad), el padrón público muestra únicamente folio, nombre con apellidos abreviados, categoría, rango de edad y estatus de pago. Tu correo, WhatsApp, fecha de nacimiento exacta y recibo nunca son visibles al público.',
    },
    {
      id: 'juvenil',
      question: '¿Cuál es la edad límite para participar en la categoría Juvenil?',
      answer: `Pueden jugar en Juvenil quienes tengan 18 años o menos cumplidos al ${cutoffs.eventDateSpanish} (es decir, nacidos a partir del ${cutoffs.juvenilMinBirthSpanish}). Para menores de 18 años se solicita nombre y autorización de madre, padre o tutor al registrarse.`,
    },
    {
      id: 'material',
      question: '¿Debo llevar tablero y reloj de ajedrez el día del torneo?',
      answer:
        'Sí, se solicita a cada participante llevar su propio juego de ajedrez (piezas y tablero) y reloj digital con incremento si cuenta con ellos. La tolerancia de presentación por ronda es de 5 minutos.',
    },
    {
      id: 'desempates',
      question: '¿Cuántas rondas se juegan y cómo se definen los premios si hay empate?',
      answer:
        'Se juega bajo Sistema Suizo a 5 rondas a ritmo rápido de 10 minutos + 3 segundos de incremento por jugada. Nadie es eliminado. En caso de empate en puntos, aplican Bucholtz Total, Bucholtz Mediano, Resultado Particular, Mayor Número de Victorias y Sonneborn-Berger.',
    },
    {
      id: 'cancelaciones',
      question: '¿Cuál es la política de cancelaciones o devoluciones?',
      answer:
        config.politicaDevolucionTexto ||
        'Borrador sujeto a confirmación del comité organizador: las cancelaciones notificadas al menos 48 horas antes del inicio del torneo podrán solicitar reembolso o transferencia de lugar; dentro de las 48 horas previas o por inasistencia no habrá devolución, pudiendo ceder el lugar a otro jugador previa validación por WhatsApp.',
      isDraftPolicy: true,
    },
  ];

  return (
    <section id="faq" className="py-16 bg-[#092818] relative border-t border-emerald-800/70">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <span className="text-amber-400 font-festive text-sm uppercase tracking-widest block mb-1">
            Resuelve tus dudas
          </span>
          <h2 className="font-festive text-3xl sm:text-4xl text-yellow-300 drop-shadow">
            PREGUNTAS FRECUENTES
          </h2>
          <div className="w-24 h-1 bg-amber-400 mx-auto mt-3 rounded-full" />
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const isOpen = openId === item.id;
            const panelId = `faq-panel-${item.id}`;
            const btnId = `faq-btn-${item.id}`;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-colors ${
                  isOpen
                    ? 'bg-[#0c3722] border-amber-400/70 shadow-lg'
                    : 'bg-[#0b311e] border-emerald-800 hover:border-emerald-600'
                }`}
              >
                <h3>
                  <button
                    id={btnId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? '' : item.id)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5 text-sm sm:text-base font-bold text-white">
                      <HelpCircle size={18} className="text-amber-400 shrink-0" />
                      <span>{item.question}</span>
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-amber-300 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </h3>

                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    className="px-5 pb-4 pt-1 text-xs sm:text-sm text-emerald-100 leading-relaxed border-t border-emerald-800/60"
                  >
                    {item.isDraftPolicy && (
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-lg mb-2">
                        <ShieldAlert size={13} />
                        <span>Borrador sujeto a revisión y confirmación del organizador</span>
                      </div>
                    )}
                    <p>{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
