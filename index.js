/**
 * Bot de WhatsApp — La Canchita del Cani
 * ───────────────────────────────────────
 * - Se conecta a WhatsApp como dispositivo vinculado (QR).
 * - Responde automáticamente con el link de la app.
 * - Expone una mini API HTTP para que el DASHBOARD muestre el QR y edite los mensajes.
 *
 * Corre 24/7 en Railway. El dashboard (en Vercel) es el panel de control.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const pino = require("pino");
const Anthropic = require("@anthropic-ai/sdk");
const store = require("./store");

// Cliente de Claude — solo si está la API key
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const AUTH_DIR = process.env.AUTH_DIR || "auth";
const WA_AUTH = path.join(AUTH_DIR, "wa");          // credenciales de WhatsApp
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN || "";          // secreto compartido con el dashboard

// Estado en memoria
let runtime = store.load();      // config (mensajes) actual
let sock = null;
let currentQR = null;            // QR como data URL (PNG)
let connected = false;
const lastReply = new Map();     // anti-spam por contacto (último auto-mensaje)
// Estado de conversación por contacto: { welcomed, lastTs, history, pausedUntil }
const conversations = new Map();
// IDs de mensajes que mandó el BOT (para no confundirlos con respuestas manuales del admin)
const botSentIds = new Set();

// ─── Lógica de respuestas ─────────────────────────────────────────────
function withinBusinessHours() {
  if (!runtime.businessHours) return true;
  const h = new Date().getHours();
  return h >= runtime.businessHours.start && h < runtime.businessHours.end;
}

// Busca una respuesta por palabra clave (instantánea y gratis)
function matchKeyword(textLower) {
  for (const rule of runtime.keywordReplies || []) {
    if ((rule.keywords || []).some((k) => textLower.includes(String(k).toLowerCase()))) {
      return rule.reply.replaceAll("{APP_URL}", runtime.appUrl);
    }
  }
  return null;
}

function welcomeText() {
  return runtime.welcomeMessage.replaceAll("{APP_URL}", runtime.appUrl);
}

// Detecta el mensaje automático que manda la app cuando alguien YA reservó
// (trae "Reserva #", "Seña enviada", "comprobante" o "pago en efectivo").
function isReservationMessage(textLower) {
  const markers = ["reserva #", "seña enviada", "sena enviada", "comprobante", "pago en efectivo", "quiero reservar el salón", "quiero reservar el salon"];
  return markers.some((m) => textLower.includes(m));
}

function thankYouText() {
  return (runtime.reservationThankYou || "¡Muchas gracias por elegirnos! 🙌 Tu reserva quedó registrada. Te esperamos pronto 🎉")
    .replaceAll("{APP_URL}", runtime.appUrl);
}

function onCooldown(jid) {
  const last = lastReply.get(jid);
  if (!last) return false;
  return (Date.now() - last) / 3600000 < runtime.cooldownHours;
}

// Respuesta con IA (Claude) usando la info del negocio. Devuelve texto o null.
async function aiReply(jid, userText) {
  if (!anthropic || runtime.aiEnabled === false) return null;
  const conv = conversations.get(jid) || { welcomed: true, history: [] };

  // Historial corto (últimos 6 turnos) para dar contexto
  const history = (conv.history || []).slice(-6);
  history.push({ role: "user", content: userText });

  const system = runtime.aiSystemPrompt.replaceAll("{APP_URL}", runtime.appUrl);

  try {
    const res = await anthropic.messages.create({
      model: runtime.aiModel || "claude-haiku-4-5",
      max_tokens: 320,
      // El system prompt es estable → se cachea (más barato en repeticiones)
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: history,
    });
    const text = res.content.find((b) => b.type === "text")?.text?.trim();
    if (!text) return null;

    // Guardar en el historial de la conversación
    history.push({ role: "assistant", content: text });
    conv.history = history;
    conversations.set(jid, conv);
    return text;
  } catch (err) {
    console.error("Error de Claude:", err?.message || err);
    return null;
  }
}

// ─── Conexión a WhatsApp ──────────────────────────────────────────────
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(WA_AUTH);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connected = false;
      currentQR = await QRCode.toDataURL(qr).catch(() => null);
      console.log("📱 Nuevo QR generado — escanealo desde el dashboard o desde estos logs:");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "open") {
      connected = true;
      currentQR = null;
      console.log("✅ Bot conectado y funcionando 24/7.");
    }

    if (connection === "close") {
      connected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`⚠️  Conexión cerrada (code ${code}).`, loggedOut ? "Sesión cerrada." : "Reconectando...");
      if (!loggedOut) startSock();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        const jid = msg.key.remoteJid || "";
        if (jid === "status@broadcast") continue;
        if (runtime.ignoreGroups && jid.endsWith("@g.us")) continue;

        // ── Mensaje SALIENTE (lo mandó el bot o el admin desde el celu) ──
        if (msg.key.fromMe) {
          const id = msg.key.id;
          if (id && botSentIds.has(id)) {
            botSentIds.delete(id);   // lo mandó el bot → ignorar
          } else {
            // Lo mandó el ADMIN manualmente → pausar el bot en esa conversación
            const handoffH = Number(runtime.handoffHours ?? 12);
            const conv = conversations.get(jid) || { welcomed: true, history: [] };
            conv.pausedUntil = Date.now() + handoffH * 3600000;
            conversations.set(jid, conv);
            console.log(`👤 Intervención humana en ${jid.split("@")[0]} — bot en pausa ${handoffH}h`);
          }
          continue;
        }

        // De acá para abajo, solo mensajes ENTRANTES nuevos
        if (type !== "notify") continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption || "";
        const textLower = text.toLowerCase().trim();
        if (!text) continue;

        if (!withinBusinessHours()) continue;

        const conv = conversations.get(jid) || { welcomed: false, history: [] };

        // Si vos interviniste manualmente hace poco → el bot no responde (lo atendés vos)
        if (conv.pausedUntil && Date.now() < conv.pausedUntil) {
          console.log(`🤫 Bot en pausa (atención humana) para ${jid.split("@")[0]}`);
          continue;
        }

        let reply = null;
        let tag = "";

        // 0) El cliente YA reservó (mandó el mensaje de la app) → agradecer, NO mandar el link
        if (isReservationMessage(textLower)) {
          reply = thankYouText();
          tag = " (agradecimiento reserva)";
        }
        // 1) Palabra clave → respuesta instantánea (gratis)
        else if (matchKeyword(textLower)) {
          reply = matchKeyword(textLower);
          tag = " (palabra clave)";
        }
        // 2) Primer contacto → mensaje de bienvenida automático
        else if (!conv.welcomed) {
          reply = welcomeText();
          tag = " (bienvenida)";
        }
        // 3) Ya saludado y sigue escribiendo → responde la IA (Claude) SOLO si está activada.
        //    Si la IA está apagada, el bot no responde (lo atiende una persona).
        else {
          const aiOn = anthropic && runtime.aiEnabled !== false;
          if (aiOn) { reply = await aiReply(jid, text); tag = " (IA)"; }
          // Si la IA está apagada o no disponible → no responder.
        }

        if (!reply) continue;

        conv.welcomed = true;
        conversations.set(jid, conv);

        await new Promise((r) => setTimeout(r, 800));
        const sent = await sock.sendMessage(jid, { text: reply });
        if (sent?.key?.id) botSentIds.add(sent.key.id);   // marcar como enviado por el bot
        lastReply.set(jid, Date.now());
        console.log(`💬 Respondido a ${msg.pushName || jid.split("@")[0]}${tag}`);
      } catch (err) {
        console.error("Error procesando mensaje:", err?.message || err);
      }
    }
  });
}

// ─── API HTTP (la usa el dashboard) ───────────────────────────────────
function sendJSON(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function authorized(req) {
  if (!TOKEN) return true; // si no configuraste token, no exige (no recomendado en producción)
  return req.headers["x-bot-token"] === TOKEN;
}

const server = http.createServer((req, res) => {
  // CORS abierto (el dashboard llega vía proxy, pero por las dudas)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bot-token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = (req.url || "").split("?")[0];

  if (url === "/health") return sendJSON(res, 200, { ok: true });

  if (!authorized(req)) return sendJSON(res, 401, { error: "unauthorized" });

  // Estado de conexión + QR
  if (url === "/status" && req.method === "GET") {
    return sendJSON(res, 200, { connected, qr: connected ? null : currentQR });
  }

  // Leer config de mensajes
  if (url === "/config" && req.method === "GET") {
    return sendJSON(res, 200, runtime);
  }

  // Guardar config de mensajes
  if (url === "/config" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        runtime = store.save(JSON.parse(body || "{}"));
        sendJSON(res, 200, runtime);
      } catch {
        sendJSON(res, 400, { error: "json inválido" });
      }
    });
    return;
  }

  // Desvincular (borra la sesión y genera un QR nuevo)
  if (url === "/logout" && req.method === "POST") {
    try { fs.rmSync(WA_AUTH, { recursive: true, force: true }); } catch {}
    connected = false;
    currentQR = null;
    sendJSON(res, 200, { ok: true });
    if (sock) { try { sock.end(); } catch {} }
    setTimeout(startSock, 1000); // re-inicia → nuevo QR
    return;
  }

  sendJSON(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`🌐 API del bot escuchando en puerto ${PORT}`));

startSock().catch((e) => {
  console.error("Error fatal al iniciar el bot:", e);
  process.exit(1);
});
