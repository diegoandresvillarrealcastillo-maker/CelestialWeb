import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Política de privacidad', description: 'Cómo Celestial Velas Artesanales recopila, usa y protege tus datos.' };

export default function PrivacyPolicyPage() {
  return (
    <main className="subpage legal-page">
      <p className="eyebrow"><span /> Celestial Velas Artesanales</p>
      <h1>Política de privacidad</h1>
      <p className="legal-updated">Última actualización: septiembre de 2026.</p>

      <h2>Qué información recopilamos</h2>
      <ul>
        <li>Si creas una cuenta: tu nombre, correo electrónico y, opcionalmente, tu teléfono.</li>
        <li>Si inicias sesión con Google: tu nombre, correo electrónico y foto de perfil, según lo que Google comparta con nuestro permiso.</li>
        <li>Al hacer un pedido, con o sin cuenta: nombre, teléfono, dirección de entrega y ciudad.</li>
        <li>Si realizas el pago por transferencia: el comprobante que subas (imagen).</li>
        <li>Datos técnicos básicos para seguridad, como tu dirección IP (guardada de forma cifrada, nunca en texto plano).</li>
      </ul>

      <h2>Para qué usamos tu información</h2>
      <ul>
        <li>Procesar y confirmar tus pedidos.</li>
        <li>Verificar manualmente los comprobantes de pago.</li>
        <li>Comunicarnos contigo sobre tu pedido, por correo o WhatsApp.</li>
        <li>Proteger la tienda contra fraude y accesos indebidos.</li>
      </ul>

      <h2>Con quién compartimos tu información</h2>
      <p>No vendemos ni alquilamos tus datos a terceros. Usamos proveedores de infraestructura para operar la tienda (base de datos y almacenamiento de archivos, servidores de la aplicación) que procesan la información únicamente para prestarnos ese servicio.</p>

      <h2>Cómo protegemos tu información</h2>
      <p>Las contraseñas nunca se guardan en texto plano, las sesiones usan cookies seguras, y el acceso a los datos está restringido por reglas de seguridad a nivel de base de datos. Los comprobantes de pago se almacenan de forma privada y solo el equipo de Celestial puede consultarlos para verificar tu pago.</p>

      <h2>Tus opciones</h2>
      <p>Puedes pedirnos en cualquier momento que corrijamos o eliminemos tu información de cuenta escribiéndonos por WhatsApp o al correo con el que te registraste.</p>

      <h2>Contacto</h2>
      <p>¿Preguntas sobre esta política? Escríbenos por <a href="https://wa.me/573112801363?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20acerca%20de%20la%20pol%C3%ADtica%20de%20sus%20datos." target="_blank" rel="noreferrer">WhatsApp</a>.</p>
    </main>
  );
}
