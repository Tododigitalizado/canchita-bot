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
const store = require("./store");

const AUTH_DIR = process.env.AUTH_DIR || "auth";
const WA_AUTH = path.join(AUTH_DIR, "wa");          // credenciales de WhatsApp
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_TOKEN || "";          // secreto compartido con el dashboard

// Estado en memoria
let runtime = store.load();      // config (mensajes) actual
let sock = null;
let currentQR = null;            // QR como data URL (PNG)
let connected = false;
const lastReply = new Map();     // anti-spam por contacto

// ─── Lógica de respuestas ─────────────────────────────────────────────
function withinBusinessHours() {
  if (!runtime.businessHours) return true;
  const h = new Date().getHours();
  return h >= runtime.businessHours.start && h < runtime.businessHours.end;
}

function buildReply(textLower) {
  for (const rule of runtime.keywordReplies || []) {
    if ((rule.keywords || []).some((k) => textLower.includes(String(k).toLowerCase()))) {
      return rule.reply.replaceAll("{APP_URL}", runtime.appUrl);
    }
  }
  return runtime.welcomeMessage.replaceAll("{APP_URL}", runtime.appUrl);
}

function onCooldown(jid) {
  const last = lastReply.get(jid);
  if (!last) return false;
  return (Date.now() - last) / 3600000 < runtime.cooldownHours;
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
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid || "";
        if (jid === "status@broadcast") continue;
        if (runtime.ignoreGroups && jid.endsWith("@g.us")) continue;

        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption || "";
        const textLower = text.toLowerCase().trim();

        if (!withinBusinessHours()) continue;
        if (onCooldown(jid)) continue;

        const reply = buildReply(textLower);
        await new Promise((r) => setTimeout(r, 800));
        await sock.sendMessage(jid, { text: reply });
        lastReply.set(jid, Date.now());
        console.log(`💬 Respondido a ${msg.pushName || jid.split("@")[0]}`);
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
