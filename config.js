/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   CONFIGURACIÓN DEL BOT — Editá los mensajes acá              ║
 * ║   Podés cambiar todo desde este archivo o desde las           ║
 * ║   "Variables" de Railway (tienen prioridad si las definís).   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * En cualquier mensaje, escribí {APP_URL} y el bot lo reemplaza por el link de la app.
 */

const APP_URL = process.env.APP_URL || "https://canchita-app.vercel.app";

module.exports = {
  appUrl: APP_URL,

  // ── Mensaje principal (se envía automáticamente al primer contacto) ──
  welcomeMessage:
    process.env.WELCOME_MESSAGE ||
    `¡Hola! 👋 Gracias por escribir a *La Canchita del Cani*.\n\n` +
    `Podés reservar tu turno de *⚽ Fútbol 5* o el *🎂 salón para eventos* de forma online y al instante acá 👇\n\n` +
    `{APP_URL}\n\n` +
    `📅 Elegís día y horario, ves la disponibilidad en vivo y listo.\n\n` +
    `_Si necesitás algo más, en breve te responde una persona._ 🙌`,

  // ── No repetir el auto-mensaje a la misma persona por X horas ──
  // (evita spamear a quien escribe varios mensajes seguidos)
  cooldownHours: Number(process.env.COOLDOWN_HOURS || 6),

  // ── Respuestas por palabra clave (opcional) ──
  // Si el mensaje del cliente CONTIENE alguna de esas palabras, responde ESE texto
  // en lugar del mensaje de bienvenida. El primero que coincida gana.
  keywordReplies: [
    {
      keywords: ["precio", "precios", "cuanto", "cuánto", "sale", "valor", "cuesta"],
      reply:
        `💰 *Precios:*\n` +
        `• ⚽ Fútbol 5: *$20.000* el turno (1 hora)\n` +
        `• 🎂 Eventos: desde *$80.000* (2h) o *$100.000* (3h), con seña del 50%\n\n` +
        `Reservá y mirá los horarios disponibles acá 👇\n{APP_URL}`,
    },
    {
      keywords: ["horario", "horarios", "disponible", "disponibilidad", "turno", "turnos", "reservar", "reserva", "cancha"],
      reply:
        `📅 Mirá los horarios disponibles y reservá al instante acá 👇\n{APP_URL}\n\n` +
        `Elegís el día, ves qué horarios están libres y reservás en segundos.`,
    },
    {
      keywords: ["cumple", "cumpleaños", "evento", "salon", "salón", "fiesta"],
      reply:
        `🎂 ¡Genial! Para *cumpleaños y eventos* tenemos el salón completo (mesas, sillas, asador, cocina, wifi y más).\n\n` +
        `Mirá disponibilidad y reservá con seña acá 👇\n{APP_URL}`,
    },
    {
      keywords: ["ubicacion", "ubicación", "donde", "dónde", "direccion", "dirección", "como llego", "cómo llego"],
      reply:
        `📍 Te esperamos en *La Canchita del Cani*.\n\n` +
        `Reservá tu turno online acá 👇\n{APP_URL}`,
    },
  ],

  // ── Horario en el que el bot responde (opcional) ──
  // Dejá null para que responda SIEMPRE (24hs).
  // Ejemplo para responder solo de 8 a 24: { start: 8, end: 24 }
  businessHours: null,

  // Ignorar mensajes de grupos (recomendado true)
  ignoreGroups: true,
};
