require("dotenv").config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const AUTH_FOLDER = process.env.AUTH_FOLDER || "./auth_info_baileys";

let sock = null;
let currentQR = null;
let status = "disconnected"; // disconnected | connecting | ready
let connectedPhone = null;
let connectedAt = null;
let _io = null; // socket.io instance injected after init
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 3000; // 3 seconds

function setIo(io) {
  _io = io;
}

function getStatus() {
  return { status, phone: connectedPhone, connected_at: connectedAt, has_qr: !!currentQR };
}

function getQR() {
  return currentQR;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  let e164 = digits;
  
  // Handle common phone number formats
  if (digits.length === 10) {
    // 10 digits: assume Indian (prepend 91)
    e164 = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // 11 digits starting with 1: assume US (remove leading 1, prepend 1)
    e164 = `1${digits.slice(1)}`;
  } else if (digits.length === 9) {
    // 9 digits: try to guess - could be missing country code
    console.warn(`[WA] Phone number "${phone}" has 9 digits - may be missing country code`);
  }
  
  if (!e164 || e164.length < 10 || e164.length > 15) {
    console.error(`[WA] Invalid phone number format: ${phone} (normalized: ${e164})`);
    return null;
  }
  
  return `${e164}@s.whatsapp.net`;
}

async function sendMessage(phone, text, imagePath = null) {
  if (status !== "ready" || !sock) {
    throw new Error("WhatsApp not connected");
  }
  const jid = normalizePhone(phone);
  if (!jid) throw new Error("Invalid phone number");
  
  try {
    const defaultAdPath = path.resolve(__dirname, "../ad.jpeg");
    const activeImagePath = imagePath || (fs.existsSync(defaultAdPath) ? defaultAdPath : null);
    
    let result;
    if (activeImagePath && fs.existsSync(activeImagePath)) {
      console.log(`[WA] Sending media message to ${phone} using image: ${activeImagePath}`);
      result = await sock.sendMessage(jid, {
        image: { url: activeImagePath },
        caption: text
      });
    } else {
      console.log(`[WA] Sending plain text message to ${phone}...`);
      result = await sock.sendMessage(jid, { text });
    }
    
    const messageId = result?.key?.id;
    if (!messageId) {
      console.warn("[WA] Warning: message sent but no ID returned", result);
    }
    return { success: true, message_id: messageId };
  } catch (err) {
    console.error("[WA] Failed to send message:", err.message);
    throw err;
  }
}

async function disconnect() {
  if (sock) {
    await sock.logout();
    sock = null;
  }
  status = "disconnected";
  connectedPhone = null;
  currentQR = null;
  if (_io) _io.emit("whatsapp:disconnected");
}

async function initClient() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(
      path.resolve(AUTH_FOLDER)
    );
    const { version } = await fetchLatestBaileysVersion();

    status = "connecting";

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
      },
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Zari CRM", "Chrome", "1.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      try {
        if (qr) {
          // Generate base64 QR image
          const qrBase64 = await QRCode.toDataURL(qr);
          currentQR = qrBase64;
          if (_io) _io.emit("whatsapp:qr", { qr: qrBase64 });
          console.log("[WA] New QR code generated — scan with WhatsApp");
        }

        if (connection === "open") {
          status = "ready";
          reconnectAttempts = 0;
          currentQR = null;
          connectedPhone = sock.user?.id?.split(":")[0] || sock.user?.id;
          connectedAt = new Date().toISOString();
          console.log(`[WA] Connected as ${connectedPhone}`);
          if (_io) _io.emit("whatsapp:ready", { phone: connectedPhone, connected_at: connectedAt });
        }

        if (connection === "close") {
          const code = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = code !== DisconnectReason.loggedOut;
          console.log(`[WA] Connection closed (code ${code}), reconnect: ${shouldReconnect}`);
          status = "disconnected";
          if (_io) _io.emit("whatsapp:disconnected", { code });
          if (shouldReconnect) {
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
              console.log(`[WA] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
              setTimeout(() => {
                initClient().catch((err) => {
                  console.error("[WA] Failed to reconnect:", err.message);
                });
              }, delay);
            } else {
              console.error("[WA] Max reconnection attempts reached. Service waiting for manual restart.");
              sock = null;
              currentQR = null;
              connectedPhone = null;
              status = "disconnected";
            }
          } else {
            reconnectAttempts = 0;
            sock = null;
            currentQR = null;
            connectedPhone = null;
            console.log("[WA] Session logged out. Delete auth_info_baileys/ to re-authenticate.");
          }
        }
      } catch (err) {
        console.error("[WA] Error in connection.update handler:", err.message);
      }
    });

    // Handle errors on the socket
    sock.ev.on("error", (err) => {
      console.error("[WA] Socket error event:", err.message);
    });

    // Track message delivery receipts
    sock.ev.on("messages.update", (updates) => {
      try {
        for (const update of updates) {
          if (update.update?.status && _io) {
            _io.emit("whatsapp:message_status", {
              message_id: update.key.id,
              status: update.update.status, // 1=pending, 2=server, 3=delivered, 4=read
              to: update.key.remoteJid,
            });
          }
        }
      } catch (err) {
        console.error("[WA] Error in messages.update handler:", err.message);
      }
    });

    console.log("[WA] Client initialized. Waiting for connection...");
  } catch (err) {
    console.error("[WA] Failed to initialize WhatsApp client:", err.message);
    status = "disconnected";
    sock = null;
    throw err;
  }
}

module.exports = { initClient, sendMessage, disconnect, getStatus, getQR, setIo };
