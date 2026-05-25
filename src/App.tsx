import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Screen, Language } from "./types";
import LoginView from "./components/LoginView";
import RegisterView from "./components/RegisterView";
import ForgotPasswordView from "./components/ForgotPasswordView";
import VerifyView from "./components/VerifyView";
import NewPasswordView from "./components/NewPasswordView";
import ChatView from "./components/ChatView";

export default function App() {
  const [screen, setScreen] = useState<Screen>(Screen.LOGIN);
  const [language, setLanguage] = useState<Language>("RU"); // Defaulting to Russian (RU) as specified
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [debugCode, setDebugCode] = useState("");

  const handleNavigate = (targetScreen: Screen) => {
    setScreen(targetScreen);
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 4500);
  };

  // 1. Reset email verification triggers
  const handleResetRequested = (email: string, code?: string) => {
    setOtpEmail(email);
    setDebugCode(code || "");
    setIsPasswordReset(true);
    setScreen(Screen.VERIFY_CODE);
  };

  // 2. Token Code matches verified for password reset screen
  const handleVerifyResetSuccess = () => {
    setScreen(Screen.NEW_PASSWORD);
  };

  // 3. Password completely reset
  const handleResetSuccess = () => {
    triggerToast(
      language === "EN" 
        ? "Password successfully restored. Log in with your credentials." 
        : "Пароль успешно восстановлен. Пожалуйста, авторизуйтесь."
    );
    setScreen(Screen.LOGIN);
  };

  // 4. Registration state saved and verify OTP triggers
  const handleRegisterSuccess = (email: string, username: string, code?: string) => {
    setOtpEmail(email);
    setUserEmail(email);
    setUserName(username);
    setDebugCode(code || "");
    setIsPasswordReset(false);
    setScreen(Screen.VERIFY_EMAIL);
  };

  // 5. Registration OTP successfully verified
  const handleVerifyEmailSuccess = () => {
    triggerToast(
      language === "EN" 
        ? "Email successfully verified! Welcome to Mesa." 
        : "Email успешно подтвержден! Добро пожаловать в Mesa."
    );
    setScreen(Screen.CHAT);
  };

  // 6. Direct standard login
  const handleLoginSuccess = (email: string, name: string) => {
    setUserEmail(email);
    setUserName(name);
    setScreen(Screen.CHAT);
  };

  const handleLogout = () => {
    setUserEmail("");
    setUserName("");
    setScreen(Screen.LOGIN);
  };

  return (
    <div className="bg-background min-h-screen font-sans overflow-x-hidden antialiased select-none">
      
      {/* Toast Notification HUD */}
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-primary text-on-primary font-semibold text-sm px-6 py-4 rounded-full shadow-2xl z-50 border border-primary-fixed-dim/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Frame Transitions with exit state animations */}
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.02, y: -10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen w-full"
        >
          {screen === Screen.LOGIN && (
            <LoginView
              language={language}
              onLanguageChange={handleLanguageChange}
              onNavigate={handleNavigate}
              onLoginSuccess={handleLoginSuccess}
            />
          )}

          {screen === Screen.REGISTER && (
            <RegisterView
              language={language}
              onLanguageChange={handleLanguageChange}
              onNavigate={handleNavigate}
              onRegisterSuccess={handleRegisterSuccess}
            />
          )}

          {screen === Screen.FORGOT_PASSWORD && (
            <ForgotPasswordView
              language={language}
              onLanguageChange={handleLanguageChange}
              onNavigate={handleNavigate}
              onResetRequested={handleResetRequested}
            />
          )}

          {screen === Screen.VERIFY_CODE && (
            <VerifyView
              language={language}
              onLanguageChange={handleLanguageChange}
              email={otpEmail}
              isPasswordReset={true}
              onNavigate={handleNavigate}
              onVerifySuccess={handleVerifyResetSuccess}
              initialDebugCode={debugCode}
            />
          )}

          {screen === Screen.VERIFY_EMAIL && (
            <VerifyView
              language={language}
              onLanguageChange={handleLanguageChange}
              email={otpEmail}
              isPasswordReset={false}
              onNavigate={handleNavigate}
              onVerifySuccess={handleVerifyEmailSuccess}
              initialDebugCode={debugCode}
            />
          )}

          {screen === Screen.NEW_PASSWORD && (
            <NewPasswordView
              language={language}
              onLanguageChange={handleLanguageChange}
              onNavigate={handleNavigate}
              onResetSuccess={handleResetSuccess}
              email={otpEmail}
            />
          )}

          {screen === Screen.CHAT && (
            <ChatView
              language={language}
              onLanguageChange={handleLanguageChange}
              userEmail={userEmail}
              userName={userName}
              onLogout={handleLogout}
              setUserName={setUserName}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
