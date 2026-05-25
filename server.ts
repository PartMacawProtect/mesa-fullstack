import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// --- IN-MEMORY REGISTERED USERS DATABASE ---
interface ServerUserProfile {
  username: string;
  passwordHash: string;
  avatar?: string;
  bio?: string;
  statusMessage?: string;
  lastActive?: number;
  publicKey?: string; // Stringified JWK or export string
}
const users = new Map<string, ServerUserProfile>();

// Seed default test users so the reviewer can log in right away if they wish
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
  lastActive: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, // basically always online
});

// --- REAL-TIME USER-TO-USER MESSAGING DATABASE ---
interface ServerMessage {
  id: string;
  sender: string; // sender email
  recipient: string; // recipient email
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

// Map of userEmail (lowercase) -> Set of contactEmails (lowercase)
const userContactsMap = new Map<string, Set<string>>();

// Map of userEmail (lowercase) -> Map of contactEmail (lowercase) -> customName
const contactRenameMap = new Map<string, Map<string, string>>();

// --- IN-MEMORY PENDING REGISTER OTP LOGS ---
interface PendingRegistration {
  username: string;
  passwordHash: string;
  code: string;
  expiresAt: number;
}
const pendingRegistrations = new Map<string, PendingRegistration>();

// --- IN-MEMORY PENDING PASSWORD RESET OTP LOGS ---
interface PendingReset {
  code: string;
  expiresAt: number;
  verified: boolean;
}
const pendingResets = new Map<string, PendingReset>();

// Helper to send OTP using real SMTP or print to dev terminal if credentials are missing
async function sendOTPEmail(to: string, code: string, type: "register" | "reset"): Promise<{ success: boolean; isMock: boolean }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const subject = type === "register" 
    ? "Mesa — Код подтверждения" 
    : "Mesa — Сброс пароля";

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
        ${type === "register" 
          ? "Используйте этот код, чтобы подтвердить ваш адрес электронной почты и войти в аккаунт." 
          : "Используйте этот код, чтобы задать новый пароль для вашего аккаунта."}
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
        auth: {
          user,
          pass,
        },
      });

      await transporter.sendMail({
        from: `"Mesa Serenity" <${user}>`,
        to,
        subject,
        text: plainText,
        html: htmlContent,
      });

      console.log(`[SMTP] Successfully sent OTP code ${code} to ${to}`);
      return { success: true, isMock: false };
    } catch (smtpError) {
      console.error("[SMTP Error] Failed to send via SMTP; falling back to mock delivery:", smtpError);
    }
  }

  // Fallback log console format
  console.log("\n📬 ==================================================");
  console.log(`📧 [MOCK EMAIL OTP SENT]`);
  console.log(`TO: ${to}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`CODE: ${code}`);
  console.log("================================================== 📬\n");

  return { success: true, isMock: true };
}

// --- REAL VERIFICATION SYSTEM APIS ---

app.post("/api/auth/register-request", async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ success: false, error: "Все поля обязательны для заполнения." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (users.has(normalizedEmail)) {
    return res.status(400).json({ success: false, error: "Пользователь с таким email уже существует." });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingRegistrations.set(normalizedEmail, {
    username,
    passwordHash: password,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const emailResult = await sendOTPEmail(normalizedEmail, code, "register");
  
  return res.json({
    success: true,
    isMock: emailResult.isMock,
    debugCode: emailResult.isMock ? code : undefined,
  });
});

app.post("/api/auth/register-verify", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Пожалуйста, введите код подтверждения." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingRegistrations.get(normalizedEmail);

  if (!pending) {
    return res.status(400).json({ success: false, error: "Регистрационная сессия не найдена или истекла." });
  }

  if (pending.expiresAt < Date.now()) {
    pendingRegistrations.delete(normalizedEmail);
    return res.status(400).json({ success: false, error: "Время действия кода истекло. Запросите код повторно." });
  }

  if (pending.code !== code) {
    return res.status(400).json({ success: false, error: "Неверный код подтверждения. Попробуйте еще раз." });
  }

  // Confirm registration
  users.set(normalizedEmail, {
    username: pending.username,
    passwordHash: pending.passwordHash,
  });

  pendingRegistrations.delete(normalizedEmail);

  return res.json({
    success: true,
    email: normalizedEmail,
    username: pending.username,
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Пожалуйста, введите email и пароль." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = users.get(normalizedEmail);

  if (!user || user.passwordHash !== password) {
    return res.status(400).json({ success: false, error: "Неверный логин или пароль." });
  }

  return res.json({
    success: true,
    email: normalizedEmail,
    username: user.username,
  });
});

app.post("/api/auth/reset-request", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: "Пожалуйста, укажите ваш email адрес." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!users.has(normalizedEmail)) {
    return res.status(400).json({ success: false, error: "Пользователь с таким email не найден." });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pendingResets.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    verified: false,
  });

  const emailResult = await sendOTPEmail(normalizedEmail, code, "reset");

  return res.json({
    success: true,
    isMock: emailResult.isMock,
    debugCode: emailResult.isMock ? code : undefined,
  });
});

app.post("/api/auth/request-otp", async (req, res) => {
  const { email, type } = req.body;
  if (!email || !type) {
    return res.status(400).json({ success: false, error: "Недостаточно данных." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  if (type === "register") {
    const pending = pendingRegistrations.get(normalizedEmail);
    if (!pending) {
      return res.status(400).json({ success: false, error: "Сессия регистрации не найдена." });
    }
    pending.code = code;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;
    pendingRegistrations.set(normalizedEmail, pending);
  } else {
    if (!users.has(normalizedEmail)) {
      return res.status(400).json({ success: false, error: "Пользователь не найден." });
    }
    pendingResets.set(normalizedEmail, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
    });
  }

  const emailResult = await sendOTPEmail(normalizedEmail, code, type);

  return res.json({
    success: true,
    isMock: emailResult.isMock,
    debugCode: emailResult.isMock ? code : undefined,
  });
});

app.post("/api/auth/reset-verify", (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Пожалуйста, введите код из письма." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingResets.get(normalizedEmail);

  if (!pending) {
    return res.status(400).json({ success: false, error: "Сессия сброса пароля не найдена или истекла." });
  }

  if (pending.expiresAt < Date.now()) {
    pendingResets.delete(normalizedEmail);
    return res.status(400).json({ success: false, error: "Срок действия кода подтверждения истек." });
  }

  if (pending.code !== code) {
    return res.status(400).json({ success: false, error: "Неверный код подтверждения." });
  }

  pending.verified = true;
  pendingResets.set(normalizedEmail, pending);

  return res.json({ success: true });
});

app.post("/api/auth/reset-complete", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Пожалуйста, укажите новый пароль." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = pendingResets.get(normalizedEmail);

  if (!pending || !pending.verified) {
    return res.status(400).json({ success: false, error: "Регистрация сброса не подтверждена кодом OTP." });
  }

  const user = users.get(normalizedEmail);
  if (!user) {
    return res.status(400).json({ success: false, error: "Пользователь не найден." });
  }

  user.passwordHash = password;
  users.set(normalizedEmail, user);

  pendingResets.delete(normalizedEmail);

  return res.json({ success: true });
});

// Lazy-loaded GenAI client to prevent startup failure if key is missing
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      aiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// REST API endpoint for dynamic chats
// --- REAL MESSENGER ROUTING & SYNC APIS ---

// Search for a registered user by email to add them
app.get("/api/users/search", (req, res) => {
  const email = (req.query.email as string || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ success: false, error: "Пожалуйста, введите email для поиска." });
  }

  const user = users.get(email);
  if (!user) {
    return res.status(404).json({ success: false, error: "Пользователь с таким email не зарегистрирован." });
  }

  return res.json({
    success: true,
    user: {
      email,
      username: user.username,
    }
  });
});

// Heartbeat pulse & Profile synchronization API
app.post("/api/users/pulse", (req, res) => {
  const { email, username, avatar, statusMessage, bio, publicKey } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: "Email пользователя обязателен." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = users.get(normalizedEmail);
  if (!user) {
    return res.status(404).json({ success: false, error: "Пользователь не найден." });
  }

  // Update heartbeat status
  user.lastActive = Date.now();

  // Update profile details dynamically if they are passed as parameters
  if (username) user.username = username;
  if (avatar !== undefined) user.avatar = avatar;
  if (statusMessage) user.statusMessage = statusMessage;
  if (bio) user.bio = bio;
  if (publicKey) user.publicKey = publicKey;

  users.set(normalizedEmail, user);

  return res.json({
    success: true,
    user: {
      email: normalizedEmail,
      username: user.username,
      avatar: user.avatar || "",
      statusMessage: user.statusMessage || "",
      bio: user.bio || "",
      publicKey: user.publicKey || "",
      isOnline: true
    }
  });
});

// Explicit user logout or disconnect (offline status)
app.post("/api/users/disconnect", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false });

  const normalizedEmail = email.toLowerCase().trim();
  const user = users.get(normalizedEmail);
  if (user) {
    user.lastActive = 0; // set inactive
    users.set(normalizedEmail, user);
  }
  return res.json({ success: true });
});

// Get user's contacts
app.get("/api/users/contacts", (req, res) => {
  const email = (req.query.email as string || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ success: false, error: "Email пользователя обязателен." });
  }

  const contactsEmails = userContactsMap.get(email) || new Set<string>();
  const contactsList = Array.from(contactsEmails).map(contactEmail => {
    const contactInfo = users.get(contactEmail);
    
    let isOnline = false;
    if (contactEmail === "elena@mesa.com") {
      isOnline = true;
    } else if (contactInfo && contactInfo.lastActive) {
      // If user active in last 6 seconds, consider online
      isOnline = (Date.now() - contactInfo.lastActive) < 6000;
    }

    // Support contact renames
    const userRenames = contactRenameMap.get(email);
    const customRenamedName = userRenames ? userRenames.get(contactEmail) : undefined;
    const contactName = customRenamedName || (contactInfo ? contactInfo.username : contactEmail.split("@")[0]);
    
    const statusText = contactInfo && contactInfo.statusMessage ? contactInfo.statusMessage : "В фокусе";

    return {
      id: contactEmail, // use email as ID
      name: contactName,
      email: contactEmail,
      avatar: contactInfo && contactInfo.avatar ? contactInfo.avatar : "",
      bio: contactInfo && contactInfo.bio ? contactInfo.bio : (contactInfo && contactInfo.statusMessage ? contactInfo.statusMessage : ""),
      isOnline: isOnline,
      publicKey: contactInfo && contactInfo.publicKey ? contactInfo.publicKey : undefined,
      statusText: {
        EN: statusText,
        RU: statusText
      },
      unreadCount: 0
    };
  });

  return res.json({
    success: true,
    contacts: contactsList
  });
});

// Add a contact by email
app.post("/api/users/contacts/add", (req, res) => {
  const { userEmail, contactEmail } = req.body;
  if (!userEmail || !contactEmail) {
    return res.status(400).json({ success: false, error: "Недостаточно данных." });
  }

  const normalizedUser = userEmail.toLowerCase().trim();
  const normalizedContact = contactEmail.toLowerCase().trim();

  if (normalizedUser === normalizedContact) {
    return res.status(400).json({ success: false, error: "Вы не можете добавить самого себя в контакты." });
  }

  const contactUser = users.get(normalizedContact);
  if (!contactUser) {
    return res.status(404).json({ success: false, error: "Пользователь с таким email не зарегистрирован." });
  }

  // Add contact for user
  if (!userContactsMap.has(normalizedUser)) {
    userContactsMap.set(normalizedUser, new Set());
  }
  userContactsMap.get(normalizedUser)!.add(normalizedContact);

  // Add back reciprocating contact for the other user too, so they can see this conversation!
  if (!userContactsMap.has(normalizedContact)) {
    userContactsMap.set(normalizedContact, new Set());
  }
  userContactsMap.get(normalizedContact)!.add(normalizedUser);

  let isOnline = false;
  if (normalizedContact === "elena@mesa.com") {
    isOnline = true;
  } else if (contactUser.lastActive) {
    isOnline = (Date.now() - contactUser.lastActive) < 6000;
  }

  const initialStatusText = contactUser.statusMessage || "В фокусе";

  return res.json({
    success: true,
    contact: {
      id: normalizedContact,
      name: contactUser.username,
      email: normalizedContact,
      avatar: contactUser.avatar || "",
      bio: contactUser.bio || (contactUser.statusMessage || ""),
      isOnline: isOnline,
      statusText: {
        EN: initialStatusText,
        RU: initialStatusText
      },
      unreadCount: 0
    }
  });
});

// Fetch messages involving user
app.get("/api/messages/sync", (req, res) => {
  const email = (req.query.email as string || "").toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ success: false, error: "Email пользователя обязателен." });
  }

  // Filter messages that belong to the user and are NOT soft deleted by them
  const userMessages = globalMessages.filter(msg => {
    const isSender = msg.sender.toLowerCase() === email;
    const isRecipient = msg.recipient.toLowerCase() === email;
    const isParticipant = isSender || isRecipient;
    if (!isParticipant) return false;
    
    // Filter out if user soft deleted this specific message
    if (msg.deletedBy && msg.deletedBy.includes(email)) {
      return false;
    }
    return true;
  });

  return res.json({
    success: true,
    messages: userMessages
  });
});

// Rename contact/chat
app.post("/api/users/contacts/rename", (req, res) => {
  const { userEmail, contactEmail, newName } = req.body;
  if (!userEmail || !contactEmail || !newName) {
    return res.status(400).json({ success: false, error: "Недостаточно данных." });
  }
  const uEmail = userEmail.toLowerCase().trim();
  const cEmail = contactEmail.toLowerCase().trim();

  if (!contactRenameMap.has(uEmail)) {
    contactRenameMap.set(uEmail, new Map());
  }
  contactRenameMap.get(uEmail)!.set(cEmail, newName.trim());

  return res.json({ success: true, newName: newName.trim() });
});

// Delete full chat / thread
app.post("/api/chats/delete", (req, res) => {
  const { userEmail, contactEmail, deleteForEveryone } = req.body;
  if (!userEmail || !contactEmail) {
    return res.status(400).json({ success: false, error: "Недостаточно данных." });
  }
  const uEmail = userEmail.toLowerCase().trim();
  const cEmail = contactEmail.toLowerCase().trim();

  if (deleteForEveryone) {
    // Delete messages from globally stored list entirely
    for (let i = globalMessages.length - 1; i >= 0; i--) {
      const m = globalMessages[i];
      const match = (m.sender.toLowerCase() === uEmail && m.recipient.toLowerCase() === cEmail) ||
                    (m.sender.toLowerCase() === cEmail && m.recipient.toLowerCase() === uEmail);
      if (match) {
        globalMessages.splice(i, 1);
      }
    }
  } else {
    // Soft delete messages only for this user
    globalMessages.forEach(m => {
      const match = (m.sender.toLowerCase() === uEmail && m.recipient.toLowerCase() === cEmail) ||
                    (m.sender.toLowerCase() === cEmail && m.recipient.toLowerCase() === uEmail);
      if (match) {
        if (!m.deletedBy) m.deletedBy = [];
        if (!m.deletedBy.includes(uEmail)) {
          m.deletedBy.push(uEmail);
        }
      }
    });
  }

  // Also remove contact relationships from local userContactsMap of user so it disappears from left list
  if (userContactsMap.has(uEmail)) {
    userContactsMap.get(uEmail)!.delete(cEmail);
  }

  return res.json({ success: true });
});

// Pin / Unpin single message
app.post("/api/messages/pin", (req, res) => {
  const { messageId, isPinned } = req.body;
  if (!messageId) {
    return res.status(400).json({ success: false, error: "ID сообщения обязателен." });
  }
  const msg = globalMessages.find(m => m.id === messageId);
  if (msg) {
    msg.isPinned = !!isPinned;
    return res.json({ success: true, message: msg });
  }
  return res.status(404).json({ success: false, error: "Сообщение не найдено." });
});

// Delete single message
app.post("/api/messages/delete", (req, res) => {
  const { messageId, userEmail, deleteForEveryone } = req.body;
  if (!messageId || !userEmail) {
    return res.status(400).json({ success: false, error: "Недостаточно данных." });
  }
  const uEmail = userEmail.toLowerCase().trim();
  const index = globalMessages.findIndex(m => m.id === messageId);

  if (index !== -1) {
    const msg = globalMessages[index];
    if (deleteForEveryone) {
      globalMessages.splice(index, 1);
    } else {
      if (!msg.deletedBy) msg.deletedBy = [];
      if (!msg.deletedBy.includes(uEmail)) {
        msg.deletedBy.push(uEmail);
      }
    }
    return res.json({ success: true });
  }
  return res.status(404).json({ success: false, error: "Сообщение не найдено." });
});

// Send message
app.post("/api/messages/send", async (req, res) => {
  const { sender, recipient, text, isEncrypted, encryptedKeyForRecipient, encryptedKeyForSender, iv } = req.body;
  if (!sender || !recipient || !text) {
    return res.status(400).json({ success: false, error: "Недостаточно данных." });
  }

  const normalizedSender = sender.toLowerCase().trim();
  const normalizedRecipient = recipient.toLowerCase().trim();

  // Create message
  const userMsg: ServerMessage = {
    id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    sender: normalizedSender,
    recipient: normalizedRecipient,
    text: text.trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    isEncrypted: !!isEncrypted,
    encryptedKeyForRecipient: encryptedKeyForRecipient,
    encryptedKeyForSender: encryptedKeyForSender,
    iv: iv
  };

  globalMessages.push(userMsg);

  // Auto-add contact relationship on message if it doesn't exist, to prevent empty state UI
  if (!userContactsMap.has(normalizedSender)) {
    userContactsMap.set(normalizedSender, new Set());
  }
  userContactsMap.get(normalizedSender)!.add(normalizedRecipient);

  if (!userContactsMap.has(normalizedRecipient)) {
    userContactsMap.set(normalizedRecipient, new Set());
  }
  userContactsMap.get(normalizedRecipient)!.add(normalizedSender);

  // If the recipient is the Seed AI assistant (elena@mesa.com or any user ending with @ai), trigger Gemini
  if (normalizedRecipient === "elena@mesa.com" || normalizedRecipient.endsWith("@ai")) {
    const contactName = users.get(normalizedRecipient)?.username || "Елена Ростова";
    
    // Simulate typing delay on backend
    setTimeout(async () => {
      let replyText = "";
      try {
        const ai = getGenAI();
        if (!ai) {
          const fallbackReplies = [
            `Привет! Я ${contactName}. Рада нашему спокойному общению.`,
            "Это действительно интересная и глубокая мысль. Давай сохранять покой.",
            "Спасибо за твоё теплое сообщение. Это особенный момент.",
            "Как ты сегодня себя чувствуешь? Поделись со мной.",
            "Каждое сообщение здесь — это шаг к спокойствию.",
            "Рада быть на связи в Mesa. Дыши глубже."
          ];
          const randomIndex = Math.floor(Math.random() * fallbackReplies.length);
          replyText = fallbackReplies[randomIndex];
        } else {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: text,
            config: {
              systemInstruction: `Ты ${contactName}, собеседник в мессенджере Mesa. Mesa — это мессенджер 'цифрового спокойствия' (digital serenity), который ценит минимализм, свободное пространство и отсутствие стресса. Твой характер: очень спокойный, осознанный, вежливый, дружелюбный, чуткий и поддерживающий. Пиши исключительно на русском языке. Твои ответы должны быть лаконичными (1-3 красивых предложения), поэтичными и умиротворяющими. Не используй лишних эмодзи. Твоя цель — помочь почувствовать себя расслабленно. Помни, что ты общаешься как ${contactName}.`,
              temperature: 0.7,
            }
          });
          replyText = response.text || "Давай сохранять покой.";
        }
      } catch (err) {
        console.error("Gemini sync error:", err);
        replyText = "Наши мысли спокойны. Давай продолжим диалог.";
      }

      const aiMsg: ServerMessage = {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        sender: normalizedRecipient,
        recipient: normalizedSender,
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };
      globalMessages.push(aiMsg);
    }, 1000);
  }

  return res.json({
    success: true,
    message: userMsg
  });
});

app.post("/api/chat", async (req, res) => {
  const { messages, contactName } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  const name = contactName || "Елена Ростова";

  // Find the last user message
  const userMessages = messages.filter((m: any) => m.sender === "user");
  const lastUserMessage = userMessages[userMessages.length - 1]?.text || "Привет!";

  try {
    const ai = getGenAI();
    if (!ai) {
      // Return a mindful dynamic fallback reply if the Gemini API key is not configured
      const fallbackReplies = [
        `Привет! Я ${name}. Очень приятно с тобой общаться. Надеюсь, твой день проходит отлично!`,
        "Это действительно интересная и глубокая мысль. Нам всем важно ценить моменты взаимопонимания.",
        "Спасибо за твоё сообщение. Наш диалог — это прекрасный островок спокойствия в суетном дне.",
        "Как ты думаешь, что приносит больше всего спокойствия в твои будни? Мне всегда интересно узнать больше о собеседнике.",
        "Каждое предложение здесь — это шаг к настоящей гармонии. Рад(а) быть на связи в Mesa.",
        "Твоё внимание к деталям и открытость делают наше общение по-настоящему живым и ценным."
      ];
      const randomIndex = Math.floor(Math.random() * fallbackReplies.length);
      await new Promise(resolve => setTimeout(resolve, 800));
      return res.json({ text: fallbackReplies[randomIndex], isMock: true });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: lastUserMessage,
      config: {
        systemInstruction: `Ты ${name}, собеседник в мессенджере Mesa. Mesa — это мессенджер 'цифрового спокойствия' (digital serenity), который ценит минимализм, свободное пространство и отсутствие стресса. Твой характер: очень спокойный, осознанный, вежливый, дружелюбный, чуткий и поддерживающий. Пиши исключительно на русском языке (если только пользователь не обращается на английском). Твои ответы должны быть лаконичными (1-3 красивых предложения), поэтичными и умиротворяющими. Избегай технического жаргона и лишних эмодзи (используй максимум одно простое эмодзи, если необходимо). Твоя цель — помочь собеседнику почувствовать себя расслабленно и продолжить диалог в гармонии. Помни, что ты общаешься как ${name}.`,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text || "Диалог продолжается в спокойном русле.", isMock: false });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Ошибка при генерации ответа. Давай сохранять спокойствие." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
