import React, { useRef } from 'react';
import { X, ShieldCheck, Lock } from 'lucide-react';
import { TournamentConfig } from '../types/tournament';
import {
  deriveAgeCutoffs,
  formatWhatsAppUrl,
  PRIVACY_NOTICE_VERSION,
} from '../utils/tournamentUtils';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface PrivacyNoticeModalProps {
  config: TournamentConfig;
  onClose: () => void;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({ config, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, onClose);

  const cutoffs = deriveAgeCutoffs(config.fechaIso);
  const whatsappUrl = formatWhatsAppUrl(
    config.whatsappContacto,
    `Hola, quiero ejercer mis derechos ARCO respecto a mis datos personales en el ${config.titulo || 'Torneo del Pavo 2.0'}.`
  );

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar aviso de privacidad"
        onClick={onClose}
        className="fixed inset-0 bg-transparent cursor-default"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative z-10 bg-[#0b3320] border-2 border-amber-400 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-emerald-100 my-auto space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-emerald-300 hover:text-white p-2 rounded-full hover:bg-emerald-800 cursor-pointer"
          aria-label="Cerrar aviso de privacidad"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-amber-300 block">
              Versión {PRIVACY_NOTICE_VERSION} · Borrador sujeto a revisión del organizador
            </span>
            <h3 id="privacy-modal-title" className="font-festive text-2xl text-yellow-300">
              Aviso de Privacidad Integral
            </h3>
          </div>
        </div>

        <div className="bg-amber-400/10 border border-amber-400/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2">
          <Lock size={15} className="text-amber-300 shrink-0 mt-0.5" />
          <span>
            <strong>Aviso importante:</strong> Este texto es un{' '}
            <em>borrador sujeto a revisión y aprobación del comité organizador</em> antes de la publicación definitiva del torneo.
          </span>
        </div>

        <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-emerald-100">
          <section>
            <h4 className="font-bold text-amber-300">1. Responsable del tratamiento</h4>
            <p>
              El <strong>{config.club || 'Club de Ajedrez Don Gonzalo'}</strong>, con sede de actividades en{' '}
              {config.lugar}, es responsable del uso y protección de tus datos personales recabados con motivo del{' '}
              <strong>{config.titulo || 'Torneo del Pavo 2.0'}</strong> (evento del{' '}
              {cutoffs.eventDateSpanish}).
            </p>
          </section>

          <section>
            <h4 className="font-bold text-amber-300">2. Datos personales que recabamos</h4>
            <p>
              Nombre completo, fecha de nacimiento (para validar la categoría Juvenil ≤ 18 años al{' '}
              {cutoffs.eventDateSpanish}), número de WhatsApp, correo electrónico, categoría y distinciones deportivas, comprobante de pago y, en el caso de menores de 18 años, nombre completo y autorización expresa de su madre, padre o tutor.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-amber-300">3. Finalidades del tratamiento</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gestionar tu inscripción o lugar en lista de espera, folio de registro y validación de cuota de recuperación.</li>
              <li>Asignar correctamente la categoría de juego y premios especiales.</li>
              <li>Enviar avisos operativos, emparejamientos o aclaraciones sobre tu participación.</li>
              <li>Publicar el padrón deportivo limitado (folio, nombre con apellidos abreviados, categoría, rango de edad, distinciones y estatus de pago).</li>
            </ul>
          </section>

          <section>
            <h4 className="font-bold text-amber-300">4. Confidencialidad y transferencia de datos</h4>
            <p>
              Tus datos de contacto (correo y WhatsApp), fecha de nacimiento exacta, nombre de tutor y comprobantes de pago <strong>no se venden ni transfieren a terceros</strong> y permanecen en colecciones restringidas visibles únicamente para los administradores autorizados del torneo. Para menores de 18 años no se publica su edad exacta en el padrón público.
            </p>
          </section>

          <section>
            <h4 className="font-bold text-amber-300">5. Derechos ARCO y medio de contacto</h4>
            <p>
              Puedes solicitar el Acceso, Rectificación, Cancelación u Oposición (ARCO) respecto a tus datos personales o revocar tu consentimiento comunicándote directamente con el comité organizador
              {whatsappUrl ? (
                <>
                  {' '}vía{' '}
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-300 underline font-bold"
                  >
                    WhatsApp oficial ({config.whatsappContacto})
                  </a>
                  .
                </>
              ) : (
                ' por los canales de contacto oficiales publicados por el club.'
              )}
            </p>
          </section>

          <section>
            <h4 className="font-bold text-amber-300">6. Tiempo de conservación y purga</h4>
            <p>
              Al concluir el torneo ({cutoffs.eventDateSpanish}) y cerrarse la conciliación de pagos, el comité organizador ejecutará desde el panel administrativo la acción de <strong>«Purgar comprobantes»</strong> (eliminación definitiva de imágenes y PDFs de pago) y posteriormente la de <strong>«Anonimizar post-torneo»</strong> (reemplazo de nombres, correos, teléfonos, fechas de nacimiento, datos de tutor y borrado de llaves anti-duplicados), conservando únicamente estadísticas e historial deportivo anónimo.
            </p>
          </section>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
