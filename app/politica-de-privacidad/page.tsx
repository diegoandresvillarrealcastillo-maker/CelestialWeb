import type { Metadata } from 'next';
import { whatsappUrl } from '@/lib/site-config';

export const metadata: Metadata = { title: 'Política de privacidad', description: 'Cómo Celestial Velas Artesanales recopila, usa y protege tus datos.', alternates: { canonical: '/politica-de-privacidad' } };

export default function PrivacyPolicyPage() {
  return (
    <main className="subpage legal-page">
      <p className="eyebrow"><span /> Celestial Velas Artesanales</p>
      <h1>Política de privacidad</h1>
      <p className="legal-updated">Última actualización: septiembre de 2026.</p>

      <h2>Responsable y marco aplicable</h2>
      <p>Celestial Velas Artesanales, con operación en Colombia, es responsable del tratamiento descrito aquí. Esta política se orienta por la Ley 1581 de 2012 y sus normas reglamentarias. El canal disponible para consultas y reclamos es el WhatsApp indicado al final.</p>

      <h2>Qué información recopilamos</h2>
      <ul>
        <li>No ofrecemos cuentas, registro ni contraseñas para clientes.</li>
        <li>Al hacer un pedido como invitado: nombre, correo, teléfono, dirección de entrega y ciudad.</li>
        <li>Si realizas el pago por transferencia: el comprobante que subas (imagen).</li>
        <li>Datos técnicos básicos para seguridad, como una huella irreversible de tu dirección IP; no guardamos la IP en texto plano.</li>
      </ul>

      <h2>Para qué usamos tu información</h2>
      <ul>
        <li>Procesar y confirmar tus pedidos.</li>
        <li>Verificar manualmente los comprobantes de pago.</li>
        <li>Comunicarnos contigo sobre tu pedido, por correo o WhatsApp.</li>
        <li>Proteger la tienda contra fraude y accesos indebidos.</li>
      </ul>

      <h2>Autorización</h2>
      <p>Antes de confirmar el pedido solicitamos una autorización expresa, informada y no premarcada. La fecha de esa aceptación queda asociada al pedido. No usamos los datos del checkout para publicidad sin una autorización independiente.</p>

      <h2>Con quién compartimos tu información</h2>
      <p>No vendemos ni alquilamos tus datos a terceros. Usamos proveedores de infraestructura para operar la tienda (base de datos y almacenamiento de archivos, servidores de la aplicación) que procesan la información únicamente para prestarnos ese servicio.</p>

      <h2>Cómo protegemos tu información</h2>
      <p>Los clientes no tienen contraseñas ni sesiones. El acceso administrativo usa contraseñas protegidas con un algoritmo de derivación seguro, cookies HttpOnly y reglas de acceso en la aplicación y la base de datos. Los comprobantes se almacenan de forma privada y solo las dos administradoras pueden consultarlos para verificar el pago.</p>

      <h2>Conservación</h2>
      <p>Conservamos los datos durante la preparación, entrega y atención del pedido y, después, solo por el tiempo necesario para cumplir obligaciones legales, contables o resolver reclamaciones. Al vencer esas necesidades se eliminan o anonimizan de forma segura.</p>

      <h2>Tus derechos y cómo ejercerlos</h2>
      <p>Puedes conocer, acceder, actualizar y rectificar tus datos; pedir prueba de la autorización y conocer el uso dado; solicitar su supresión o revocar la autorización cuando proceda; y presentar una queja ante la Superintendencia de Industria y Comercio después de agotar el trámite directo aplicable. Escríbenos desde el número o correo usado al comprar, identifica el pedido y explica tu solicitud. Responderemos por el mismo canal dentro de los plazos legales.</p>

      <h2>Contacto</h2>
      <p>¿Preguntas sobre esta política? Escríbenos por <a href={whatsappUrl('Hola, quiero saber más acerca de la política de datos de Celestial.')} target="_blank" rel="noreferrer">WhatsApp</a>.</p>
    </main>
  );
}
