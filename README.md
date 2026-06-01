# 🤖 Bot de WhatsApp — La Canchita del Cani

Bot que responde **automáticamente** los mensajes de WhatsApp con el link de la app.
Corre **24/7 en Railway**. Lo controlás **desde tu dashboard** (ahí ves el QR y editás los mensajes).

> Proyecto **independiente** de la app (canchita-app). No comparten código.

---

## 🧠 Cómo está armado

```
   [ Tu celular ]  ──escanea QR──►  [ Bot en Railway 24/7 ]  ◄──QR + mensajes──  [ Tu Dashboard (Vercel) ]
                                            │
                                     responde solo a los
                                     clientes que escriben
```

- **Railway** = el motor (corre siempre, aunque tu PC esté apagada).
- **Dashboard** = el panel de control: ves el QR para vincular y editás los mensajes.

---

## 🚀 Puesta en marcha (una sola vez)

### 1. Subir el bot a Railway
- **Con GitHub (recomendado):** subí esta carpeta a un repo y en Railway → **New Project → Deploy from GitHub repo**.
- **Con CLI:** `npm i -g @railway/cli && railway login && railway init && railway up`

### 2. Configurar variables en Railway
En Railway → tu servicio → **Variables**:
| Variable | Valor |
|----------|-------|
| `BOT_TOKEN` | Un secreto que inventes (ej: `cani-secreto-2026`). Anotalo. |
| `APP_URL` | `https://canchita-app.vercel.app` (opcional, ya viene por defecto) |
| `AUTH_DIR` | `auth` (opcional) |

### 3. Agregar un Volume (para no re-escanear el QR nunca más)
Railway → servicio → **Settings → Volumes** → Mount path: **`/app/auth`**

### 4. Conseguir la URL pública del bot
Railway → **Settings → Networking → Generate Domain**. Te da una URL tipo
`https://canchita-bot-production.up.railway.app`. Copiala.

### 5. Conectar el dashboard con el bot
En **Vercel** (proyecto canchita-app) → **Settings → Environment Variables**:
| Variable | Valor |
|----------|-------|
| `BOT_API_URL` | La URL del bot de Railway (paso 4) |
| `BOT_TOKEN` | El **mismo** secreto que pusiste en Railway |

Redesplegá la app de Vercel.

### 6. Vincular WhatsApp desde el dashboard
1. Entrá a tu **dashboard** → sección **🤖 Bot de WhatsApp** → desplegala.
2. Aparece el **QR**. Desde el celular de la canchita:
   **WhatsApp → Ajustes ⚙️ → Dispositivos vinculados → Vincular un dispositivo** → escaneá.
3. Cuando cambie a **✅ WhatsApp conectado**, ya responde solo.

---

## ✏️ Editar los mensajes
Todo desde el dashboard, en la misma sección **🤖 Bot de WhatsApp**:
- Mensaje de bienvenida
- Respuestas por palabra clave (precio, horario, evento, ubicación…)
- Cada cuántas horas vuelve a responder a la misma persona

Tocás **Guardar mensajes** y el bot los usa al instante (no hay que reiniciar nada).

> También podés editar los textos por defecto en `config.js` antes de subirlo.

---

## ❓ Preguntas frecuentes
- **¿Anda con la PC apagada?** Sí, corre en Railway (la nube).
- **¿Mi número se sigue usando normal?** Sí, el bot es un dispositivo vinculado más.
- **¿Cuándo re-escaneo el QR?** Solo si tocás "Desvincular" o cerrás la sesión desde el celular. Con el Volume, los reinicios normales no piden re-escanear.
- **Nota:** usa una conexión no oficial de WhatsApp. Para pocos mensajes el riesgo es bajo, pero tenelo presente.
