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

  // ── Mensaje cuando el cliente YA reservó (manda el mensaje de la app) ──
  // Se responde con un agradecimiento en vez de reenviar el link.
  reservationThankYou:
    process.env.RESERVATION_THANKYOU ||
    `¡Muchas gracias por elegirnos! 🙌\n\n` +
    `Tu reserva quedó registrada. En breve la confirmamos. 🎉\n\n` +
    `¡Te esperamos pronto en *La Canchita del Cani*! ⚽🎂`,

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

  // ── 🤖 Respuestas con IA (Claude) ──
  // Si la persona SIGUE escribiendo después del mensaje automático y no coincide
  // ninguna palabra clave, Claude responde con la info del negocio.
  // Requiere la variable ANTHROPIC_API_KEY en Railway. Si no está, se desactiva solo.
  aiEnabled: process.env.AI_ENABLED !== "false",

  // Instrucciones para la IA (lo que sabe y cómo responde). Editable desde el dashboard.
  aiSystemPrompt:
    process.env.AI_SYSTEM_PROMPT ||
    `Sos el asistente de WhatsApp de "La Canchita del Cani", un complejo en Argentina que alquila una cancha de Fútbol 5 y un salón para cumpleaños/eventos.\n\n` +
    `DATOS DEL NEGOCIO:\n` +
    `- ⚽ Fútbol 5: $20.000 el turno de 1 hora. Se paga en el local. Horarios de 9 a 23hs.\n` +
    `- 🎂 Eventos/Cumpleaños: salón completo. 2 horas $80.000 o 3 horas $100.000. Requiere seña del 50% por transferencia. Horarios de 10 a 22hs.\n` +
    `- El salón incluye: mesas, +25 sillas, asador, 2 heladeras, cocina, horno eléctrico, pava eléctrica, panchera y wifi.\n` +
    `- Para reservar (ver disponibilidad en vivo y elegir día/hora) se usa la app: {APP_URL}\n\n` +
    `CÓMO RESPONDER:\n` +
    `- Hablá en español rioplatense, amable y breve (2-4 líneas máximo). Usá algún emoji.\n` +
    `- Si preguntan precios, horarios, cómo reservar, qué incluye, etc., respondé con los datos de arriba.\n` +
    `- SIEMPRE que tenga sentido, invitá a reservar pasando el link de la app: {APP_URL}\n` +
    `- Si te preguntan algo que no sabés (algo muy específico o personal), decí que en breve los atiende una persona del local.\n` +
    `- No inventes datos, precios ni horarios que no estén acá.\n` +
    `- IMPORTANTE: si el mensaje indica que la persona YA hizo una reserva (menciona "Reserva #", seña, comprobante, o que ya reservó), NO le mandes el link de nuevo. Agradecele cálidamente por elegirnos y decile que la reserva quedó registrada y que la esperamos pronto.`,

  // Modelo de Claude (Haiku = el más económico)
  aiModel: process.env.AI_MODEL || "claude-haiku-4-5",
};
