import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ========== CSP HEADER ==========
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com; frame-ancestors 'none';"
  );
  next();
});

// ========== CORS ==========
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ========== ТЕСТОВЫЙ API ==========
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "API работает!", timestamp: Date.now() });
});

// ========== IN-MEMORY DATABASES ==========
interface ServerUserProfile {
  username: string;
  passwordHash: string;
  avatar?: string;
  bio?: string;
  statusMessage?: string;
  lastActive?: number;
  publicKey?: string;
}
const users = new Map<string, ServerUserProfile>();

// Предустановленные пользователи
users.set("test@mesa.com", {
  username: "Тест",
  passwordHash: "test1234",
  statusMessage: "В фокусе",
  bio: "Любитель цифрового спокойствия и тишины.",
  lastActive: 0,
});
users.set("mariya@mesa.com", {
  username: "Мария Соколова",
  passwordHash: "123456",
  statusMessage: "Читаю книгу",
  bio: "Люблю тишину, классическую музыку и хороший теплый чай.",
  lastActive: 0,
});
users.set("alex@mesa.com", {
  username: "Александр Волков",
  passwordHash: "123456",
  statusMessage: "Прогулка в парке",
  bio: "Разработчик интерфейсов, ценящий чистый код и чистый разум.",
  lastActive: 0,
});
users.set("elena@mesa.com", {
  username: "Елена Ростова (ИИ)",
  passwordHash: "123456",
  statusMessage: "Спокойный собеседник",
  bio: "Ваш персональный ИИ помощник цифровой тишины и спокойствия в Mesa.",
  lastActive: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
});

interface ServerMessage {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  time: string;
  timestamp: number;
  isPinned?: boolean;
  deletedBy?: string[];
  isEncrypted?: boolean;
  encryptedKeyForRecipient?: string;
  encryptedKeyForSender?: string;
  iv?: string;
}
const globalMessages: ServerMessage[] = [];
const userContactsMap = new Map<string, Set<string>>();
const contactRenameMap = new Map<string, Map<string, string>>();

interface PendingRegistration {
  username: string;
  passwordHash: string;
  code: string;
  expiresAt: number;
}
const pendingRegistrations = new Map<string, PendingRegistration>();

interface PendingReset {
  code: string;
  expiresAt: number;
  verified: boolean;
}
const pendingResets = new Map<string, PendingReset>();

// ========== EMAIL SENDER ==========
async function sendOTPEmail(to: string, code: string, type: "register" | "reset"): Promise<{ success: boolean; isMock: boolean }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const subject = type === "register" ? "Mesa — Код подтверждения" : "Mesa — Сброс пароля";
  const plainText = type === "register"
    ? `Ваш код подтверждения для регистрации в Mesa: ${code}. Код действителен в течение 10 минут.`
    : `Ваш код для восстановления пароля в Mesa: ${code}. Код действителен в течение 10 минут.`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff; color: #18181b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 24px; font-weight: bold; color: #3b82f6; letter-spacing: -0.025em;">Mesa</span>
      </div>
      <h2 style="font-size: 18px; font-weight: bold; text-align: center; color: #18181b; margin-top: 0; margin-bottom: 8px;">
        ${type === "register" ? "Подтверждение почты" : "Восстановление доступа"}
      </h2>
      <p style="font-size: 14px; text-align: center; color: #71717a; margin-top: 0; margin-bottom: 24px; line-height: 1.5;">
        ${type === "register" ? "Используйте этот код, чтобы подтвердить ваш адрес электронной почты и войти в аккаунт." : "Используйте этот код, чтобы задать новый пароль для вашего аккаунта."}
      </p>
      <div style="background-color: #f4f4f5; border-radius: 12px; padding: 18px; margin-bottom: 24px; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 0.15em; color: #18181b; font-family: monospace;">${code}</span>
      </div>
      <p style="font-size: 11px; text-align: center; color: #a1a1aa; margin-top: 16px; border-top: 1px solid #f4f4f5; padding-top: 16px; line-height: 1.4;">
        Код действителен в течение 10 минут. Если вы не запрашивали данный код, просто проигнорируйте это сообщение.
      </p>
    </div>
  `;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from: `"Mesa Serenity" <${user}>`,
        to,
        subject,
        text: plainText,
        html: htmlContent,
      });
      console.log(`[SMTP] Sent code ${code} to ${to}`);
      return { success: true, isMock: false };
    } catch (err) {
      console.error("[SMTP Error]", err);
    }
  }

  console.log(`\n📧 [MOCK] Code for ${to}: ${code}\n`);
  return { success: true, isMock: true };
}

// ========== AUTH API ==========
app.post("/api/auth/register-request", async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ success: false, error: "Все поля обязательны." });
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (users.has(normalizedEmail)) {
    return res.status(400). json({ success: false, error: "Email уже зарегистрирован." });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingRegistrations.set(normalizedEmail, {
    username,
    passwordHash: password,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const emailResult = await sendOTPEmail(normalizedEmail, code, "register");
  res.json({ success: true, isMock: emailResult.isMock, debugCode: emailResult.isMock ? code : undefined });
});

app.post("/api/auth/register-verify", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, error: "Введите код." });
  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingRegistrations.get(normalizedEmail);
  if (!pending) return res.status(400).json({ success: false, error: "Сессия не найдена." });
  if (pending.expiresAt < Date.now()) {
    pendingRegistrations.delete(normalizedEmail);
    return res.status(400).json({ success: false, error: "Код истёк." });
  }
  if (pending.code !== code) return res.status(400).json({ success: false, error: "Неверный код." });
  users.set(normalizedEmail, {
    username: pending.username,
    passwordHash: pending.passwordHash,
  });
  pendingRegistrations.delete(normalizedEmail);
  res.json({ success: true, email: normalizedEmail, username: pending.username });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: "Введите email и пароль." });
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.get(normalizedEmail);
  if (!user || user.passwordHash !== password) {
    return res.status(400).json({ success: false, error: "Неверный логин или пароль." });
  }
  res.json({ success: true, email: normalizedEmail, username: user.username });
});

app.post("/api/auth/reset-request", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Введите email." });
  const normalizedEmail = email.toLowerCase().trim();
  if (!users.has(normalizedEmail)) return res.status(400).json({ success: false, error: "Пользователь не найден." });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingResets.set(normalizedEmail, { code, expiresAt: Date.now() + 10 * 60 * 1000, verified: false });
  const emailResult = await sendOTPEmail(normalizedEmail, code, "reset");
  res.json({ success: true, isMock: emailResult.isMock, debugCode: emailResult.isMock ? code : undefined });
});

app.post("/api/auth/request-otp", async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type) return res.status(400).json({ success: false, error: "Недостаточно данных." });
  const normalizedEmail = email.toLowerCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  if (type === "register") {
    const pending = pendingRegistrations.get(normalizedEmail);
    if (!pending) return res.status(400).json({ success: false, error: "Сессия регистрации не найдена." });
    pending.code = code;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;
    pendingRegistrations.set(normalizedEmail, pending);
  } else {
    if (!users.has(normalizedEmail)) return res.status(400).json({ success: false, error: "Пользователь не найден." });
    pendingResets.set(normalizedEmail, { code, expiresAt: Date.now() + 10 * 60 * 1000, verified: false });
  }
  const emailResult = await sendOTPEmail(normalizedEmail, code, type);
  res.json({ success: true, isMock: emailResult.isMock, debugCode: emailResult.isMock ? code : undefined });
});

app.post("/api/auth/reset-verify", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, error: "Введите код." });
  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingResets.get(normalizedEmail);
  if (!pending) return res.status(400).json({ success: false, error: "Сессия не найдена." });
  if (pending.expiresAt < Date.now()) return res.status(400).json({ success: false, error: "Код истёк." });
  if (pending.code !== code) return res.status(400).json({ success: false, error: "Неверный код." });
  pending.verified = true;
  pendingResets.set(normalizedEmail, pending);
  res.json({ success: true });
});

app.post("/api/auth/reset-complete", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: "Введите новый пароль." });
  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingResets.get(normalizedEmail);
  if (!pending || !pending.verified) return res.status(400).json({ success: false, error: "Не подтверждено." });
  const user = users.get(normalizedEmail);
  if (!user) return res.status(400).json({ success: false, error: "Пользователь не найден." });
  user.passwordHash = password;
  users.set(normalizedEmail, user);
  pendingResets.delete(normalizedEmail);
  res.json({ success: true });
});

// ========== GEMINI ==========
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ========== MESSENGER API (сокращённо, но рабочее) ==========
app.get("/api/users/search", (req, res) => {
  const email = (req.query.email as string || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false, error: "Введите email" });
  const user = users.get(email);
  if (!user) return res.status(404).json({ success: false, error: "Не зарегистрирован" });
  res.json({ success: true, user: { email, username: user.username } });
});

app.post("/api/users/pulse", (req, res) => {
  const { email, username, avatar, statusMessage, bio, publicKey } = req.body;
  if (!email) return res.status(400).json({ success: false });
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.get(normalizedEmail);
  if (!user) return res.status(404).json({ success: false });
  user.lastActive = Date.now();
  if (username) user.username = username;
  if (avatar !== undefined) user.avatar = avatar;
  if (statusMessage) user.statusMessage = statusMessage;
  if (bio) user.bio = bio;
  if (publicKey) user.publicKey = publicKey;
  users.set(normalizedEmail, user);
  res.json({
    success: true,
    user: {
      email: normalizedEmail,
      username: user.username,
      avatar: user.avatar || "",
      statusMessage: user.statusMessage || "",
      bio: user.bio || "",
      publicKey: user.publicKey || "",
      isOnline: true,
    },
  });
});

app.post("/api/users/disconnect", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false });
  const user = users.get(email.toLowerCase().trim());
  if (user) user.lastActive = 0;
  res.json({ success: true });
});

app.get("/api/users/contacts", (req, res) => {
  const email = (req.query.email as string || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false });
  const contactsEmails = userContactsMap.get(email) || new Set();
  const contactsList = Array.from(contactsEmails).map((contactEmail) => {
    const contactInfo = users.get(contactEmail);
    const isOnline = contactEmail === "elena@mesa.com"
      ? true
      : contactInfo && (Date.now() - (contactInfo.lastActive || 0)) < 6000;
    const userRenames = contactRenameMap.get(email);
    const customName = userRenames ? userRenames.get(contactEmail) : undefined;
    const name = customName || contactInfo?.username || contactEmail.split("@")[0];
    return {
      id: contactEmail,
      name,
      email: contactEmail,
      avatar: contactInfo?.avatar || "",
      bio: contactInfo?.bio || contactInfo?.statusMessage || "",
      isOnline,
      publicKey: contactInfo?.publicKey,
      statusText: { EN: contactInfo?.statusMessage || "В фокусе", RU: contactInfo?.statusMessage || "В фокусе" },
      unreadCount: 0,
    };
  });
  res.json({ success: true, contacts: contactsList });
});

app.post("/api/users/contacts/add", (req, res) => {
  const { userEmail, contactEmail } = req.body;
  if (!userEmail || !contactEmail) return res.status(400).json({ success: false });
  const u = userEmail.toLowerCase().trim();
  const c = contactEmail.toLowerCase().trim();
  if (u === c) return res.status(400).json({ success: false, error: "Нельзя добавить себя" });
  const contactUser = users.get(c);
  if (!contactUser) return res.status(404).json({ success: false, error: "Пользователь не зарегистрирован" });
  if (!userContactsMap.has(u)) userContactsMap.set(u, new Set());
  userContactsMap.get(u)!.add(c);
  if (!userContactsMap.has(c)) userContactsMap.set(c, new Set());
  userContactsMap.get(c)!.add(u);
  res.json({
    success: true,
    contact: {
      id: c,
      name: contactUser.username,
      email: c,
      avatar: contactUser.avatar || "",
      bio: contactUser.bio || "",
      isOnline: false,
      statusText: { EN: contactUser.statusMessage || "", RU: contactUser.statusMessage || "" },
      unreadCount: 0,
    },
  });
});

app.get("/api/messages/sync", (req, res) => {
  const email = (req.query.email as string || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ success: false });
  const userMessages = globalMessages.filter((msg) => {
    const isParticipant = msg.sender === email || msg.recipient === email;
    if (!isParticipant) return false;
    if (msg.deletedBy?.includes(email)) return false;
    return true;
  });
  res.json({ success: true, messages: userMessages });
});

app.post("/api/messages/send", async (req, res) => {
  const { sender, recipient, text } = req.body;
  if (!sender || !recipient || !text) return res.status(400).json({ success: false });
  const normalizedSender = sender.toLowerCase().trim();
  const normalizedRecipient = recipient.toLowerCase().trim();
  const message: ServerMessage = {
    id: `msg-${Date.now()}-${Math.random() * 1000}`,
    sender: normalizedSender,
    recipient: normalizedRecipient,
    text: text.trim(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    timestamp: Date.now(),
  };
  globalMessages.push(message);
  if (!userContactsMap.has(normalizedSender)) userContactsMap.set(normalizedSender, new Set());
  userContactsMap.get(normalizedSender)!.add(normalizedRecipient);
  if (!userContactsMap.has(normalizedRecipient)) userContactsMap.set(normalizedRecipient, new Set());
  userContactsMap.get(normalizedRecipient)!.add(normalizedSender);
  res.json({ success: true, message });
});

app.post("/api/chat", async (req, res) => {
  const { messages, contactName } = req.body;
  const name = contactName || "Елена Ростова";
  const lastUserMessage = messages?.filter((m: any) => m.sender === "user").pop()?.text || "Привет";
  const ai = getGenAI();
  if (!ai) {
    return res.json({ text: `Привет! Я ${name}. Чем могу помочь?`, isMock: true });
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: lastUserMessage,
      config: {
        systemInstruction: `Ты ${name}, собеседник в мессенджере Mesa. Отвечай коротко и умиротворяюще.`,
      },
    });
    res.json({ text: response.text || "Спокойного общения!", isMock: false });
  } catch (err) {
    res.json({ text: "Давай сохранять покой.", isMock: true });
  }
});

// ========== СТАТИКА И SPA ==========
const distPath = path.join(process.cwd(), "dist");
const indexPath = path.join(distPath, "index.html");
const fs = require("fs");

console.log(`🔍 Dist path: ${distPath}, index.html exists: ${fs.existsSync(indexPath)}`);

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ВАЖНО: этот обработчик должен быть ПОСЛЕ всех API
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send("Frontend not built");
  }
});

// ========== ЗАПУСК ==========
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 SMTP: ${process.env.SMTP_HOST ? "configured" : "not configured"}`);
});

