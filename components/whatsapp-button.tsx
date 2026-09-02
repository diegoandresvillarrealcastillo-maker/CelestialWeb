import { FaWhatsapp } from 'react-icons/fa';

const companyNumber = '573205279249';
const greeting = 'Hola, visité la tienda Celestial y quiero información sobre sus velas artesanales.';

export function WhatsAppButton() {
  const contactUrl = `https://wa.me/${companyNumber}?text=${encodeURIComponent(greeting)}`;

  return (
    <a
      className="whatsapp-float"
      href={contactUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar a Celestial por WhatsApp"
      title="Hablar con Celestial por WhatsApp"
    >
      <FaWhatsapp aria-hidden="true" />
      <span>¿Te ayudamos?</span>
    </a>
  );
}
