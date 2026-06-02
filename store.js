/**
 * Guarda y carga la configuración editable del bot (mensajes) en un archivo JSON
 * dentro del volumen, para que los cambios hechos desde el dashboard persistan.
 */
const fs = require("fs");
const path = require("path");
const defaults = require("./config");

const AUTH_DIR = process.env.AUTH_DIR || "auth";
const FILE = path.join(AUTH_DIR, "bot-config.json");

// Campos que se pueden editar desde el dashboard
const EDITABLE = ["appUrl", "welcomeMessage", "reservationThankYou", "cooldownHours", "handoffHours", "keywordReplies", "businessHours", "aiEnabled", "aiSystemPrompt"];

function ensureDir() {
  try { fs.mkdirSync(AUTH_DIR, { recursive: true }); } catch {}
}

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

function save(patch) {
  ensureDir();
  const current = load();
  const next = { ...current };
  for (const key of EDITABLE) {
    if (patch[key] !== undefined) next[key] = patch[key];
  }
  const toSave = {};
  for (const key of EDITABLE) toSave[key] = next[key];
  fs.writeFileSync(FILE, JSON.stringify(toSave, null, 2));
  return next;
}

module.exports = { load, save, EDITABLE };
