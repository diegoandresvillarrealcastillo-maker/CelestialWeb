const configuredWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '573205279249';

export const whatsappNumber = /^\d{8,15}$/.test(configuredWhatsApp) ? configuredWhatsApp : '573205279249';

export const whatsappDisplayNumber = whatsappNumber.startsWith('57') && whatsappNumber.length === 12
  ? `+57 ${whatsappNumber.slice(2, 5)} ${whatsappNumber.slice(5, 8)} ${whatsappNumber.slice(8)}`
  : `+${whatsappNumber}`;

export function whatsappUrl(message?: string) {
  return `https://wa.me/${whatsappNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
