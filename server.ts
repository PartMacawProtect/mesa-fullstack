import express from "express";
import path from "path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { Resend } from "resend";

dotenv.config();

const app = express();
const PORT = process.env.PPORT || 3000;

app.use(express.json());

// ========== CORS ==========
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ========== ОТКЛЮЧЕНИЕ CSP ДЛЯ РАБОТЫ REACT ==========
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline';"
  );
  next();
});

// ========== ТЕСТОВЫЙ ЭНДПОИНТ ==========
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "API работает!", timestamp: Date.now() });
});

// ========== НАСТРОЙКИ ПОЧТЫ ==========
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendOTPEmail(to: string, code: string, type: "register" | "reset") {
  const subject = type === "register" ? "Mesa — Код подтверждения" : "Mesa — Сброс пароля";
  const text = `Ваш код: ${code}. Действителен 10 минут.`;
  const html = `<div style="font-family: sans-serif;"><h2>Mesa</h2><p>${text}</p></div>`;

  // ===== 1. Пробуем Gmail SMTP =====
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `"Mesa" <${smtpUser}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`[Gmail SMTP] Code sent to ${to}`);
      return { success: true, isMock: false };
    } catch (err) {
      console.error("[Gmail SMTP] Error:", err);
    }
  }

  // ===== 2. Пробуем Resend =====
  if (resend) {
    try {
      await resend.emails.send({
        from: "Mesa <onboarding@resend.dev>",
        to,
        subject,
        html,
      });
      console.log(`[Resend] Code sent to ${to}`);
      return { success: true, isMock: false };
    } catch (err) {
      console.error("[Resend] Error:", err);
    }
  }

  // ===== 3. Резерв: вывод в консоль =====
  console.log(`\n📧 [MOCK] Code for ${to}: ${code}\n`);
  return { success: true, isMock: true, debugCode: code };
}

// ========== ВРЕМЕННАЯ БАЗА ДАННЫХ ==========
const users = new Map();
users.set("test@mesa.com", { username: "Тест", passwordHash: "test1234" });

const pendingRegistrations = new Map();

// ========== API РЕГИСТРАЦИИ ==========
app.post("/api/auth/register-request", async (req, res) => {
  const { email, username, password } = req.body;
  console.log("[DEBUG] Register request:", { email, username, password });

  if (!email || !username || !password) {
    return res.status(400).json({ success: false, error: "Все поля обязательны" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (users.has(normalizedEmail)) {
    return res.status(400).json({ success: false, error: "Email уже зарегистрирован" });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingRegistrations.set(normalizedEmail, {
    username,
    passwordHash: password,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const result = await sendOTPEmail(normalizedEmail, code, "register");
  res.json({
    success: true,
    isMock: result.isMock,
    debugCode: result.debugCode,
  });
});

app.post("/api/auth/register-verify", (req, res) => {
  const { email, code } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingRegistrations.get(normalizedEmail);

  if (!pending) {
    return res.status(400).json({ success: false, error: "Сессия не найдена" });
  }
  if (pending.expiresAt < Date.now()) {
    pendingRegistrations.delete(normalizedEmail);
    return res.status(400).json({ success: false, error: "Код истёк" });
  }
  if (pending.code !== code) {
    return res.status(400).json({ success: false, error: "Неверный код" });
  }

  users.set(normalizedEmail, {
    username: pending.username,
    passwordHash: pending.passwordHash,
  });
  pendingRegistrations.delete(normalizedEmail);

  res.json({
    success: true,
    email: normalizedEmail,
    username: pending.username,
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email?.toLowerCase().trim());
  if (!user || user.passwordHash !== password) {
    return res.status(400).json({ success: false, error: "Неверный логин или пароль" });
  }
  res.json({ success: true, email, username: user.username });
});

// ========== СТАТИКА ==========
const distPath = path.join(process.cwd(), "dist");
const indexPath = path.join(distPath, "index.html");
const fs = require("fs");

console.log(`📁 Dist path: ${distPath}, index.html exists: ${fs.existsSync(indexPath)}`);

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send("Frontend not built. Run npm run build.");
  }
});

// ========== ЗАПУСК ==========
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 SMTP: ${process.env.SMTP_HOST ? "configured" : "not configured"}`);
  console.log(`✉️ Resend: ${RESEND_API_KEY ? "configured" : "not configured"}`);
});