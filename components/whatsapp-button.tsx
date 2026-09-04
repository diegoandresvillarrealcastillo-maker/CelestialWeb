import { FaWhatsapp } from 'react-icons/fa';

const companyNumber = '573205279249';
const greeting = '¡Hola! ✨ Estuve viendo su tienda online Celestial y me encantaron varios productos. ¿Me podrían ayudar a completar mi compra por aquí? 🛍️';

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
