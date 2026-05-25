export enum Screen {
  LOGIN = "login",
  REGISTER = "register",
  FORGOT_PASSWORD = "forgot_password",
  VERIFY_CODE = "verify_code", // Reset password OTP code
  VERIFY_EMAIL = "verify_email", // Registration email verification OTP
  NEW_PASSWORD = "new_password",
  CHAT = "chat"
}

export interface Message {
  id: string;
  sender: "user" | "elena" | string;
  text: string;
  time: string;
  isSending?: boolean;
  isPinned?: boolean;
  isEncrypted?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  email?: string;
  bio?: string;
  publicKey?: string;
  statusText: {
    EN: string;
    RU: string;
  };
  unreadCount: number;
}

export type Language = "EN" | "RU";
