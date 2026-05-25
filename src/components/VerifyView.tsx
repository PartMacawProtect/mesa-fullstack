import React, { useState } from "react";
import { Screen, Language } from "../types";
import { translations } from "../locales";
import OtpContainer from "./OtpContainer";
import LanguageSelector from "./LanguageSelector";

interface VerifyViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  email: string;
  isPasswordReset: boolean; // True if resetting password, false if registering email
  onNavigate: (screen: Screen) => void;
  onVerifySuccess: () => void;
  initialDebugCode?: string;
}

export default function VerifyView({
  language,
  onLanguageChange,
  email,
  isPasswordReset,
  onNavigate,
  onVerifySuccess,
  initialDebugCode = "",
}: VerifyViewProps) {
  const t = translations[language];
  const [otpValue, setOtpValue] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [debugCode, setDebugCode] = useState<string>(initialDebugCode);

  const handleResend = () => {
    setIsLoading(true);
    fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, type: isPasswordReset ? "reset" : "register" }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Не удалось отправить код.");
          });
        }
        return res.json();
      })
      .then((data) => {
        setIsLoading(false);
        setToastMessage(t.codeResent);
        if (data.debugCode) {
          setDebugCode(data.debugCode);
        }
        setTimeout(() => {
          setToastMessage("");
        }, 4000);
      })
      .catch((err: any) => {
        setIsLoading(false);
        setToastMessage(err.message || "Ошибка соединения.");
        setTimeout(() => {
          setToastMessage("");
        }, 4000);
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpValue.join("");
    if (code.length < 6) {
      return;
    }

    setIsLoading(true);
    const endpoint = isPasswordReset ? "/api/auth/reset-verify" : "/api/auth/register-verify";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Неверный код подтверждения.");
          });
        }
        return res.json();
      })
      .then(() => {
        setIsLoading(false);
        onVerifySuccess();
      })
      .catch((err: any) => {
        setIsLoading(false);
        setToastMessage(err.message || "Ошибка проверки кода.");
        setTimeout(() => {
          setToastMessage("");
        }, 4000);
      });
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-sans antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Top Header */}
      <header className="flex justify-between items-center w-full px-[20px] md:px-[40px] h-16 bg-surface shrink-0 z-10">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-[28px] filled">bubble_chart</span>
          <span className="text-xl font-bold text-primary tracking-tight font-sans">Mesa</span>
        </div>
        <LanguageSelector language={language} onChange={onLanguageChange} />
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center p-[20px] md:p-[40px] relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center z-0">
          <div className="w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl"></div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl ambient-shadow p-8 md:p-10 flex flex-col items-center z-10 border border-outline-variant/30">
          
          {/* Email Icon Indicator */}
          <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-primary text-3xl filled">
              mail
            </span>
          </div>

          {/* Success toast notification */}
          {toastMessage && (
            <div className="mb-4 w-full bg-primary-fixed/50 text-on-primary-fixed p-3 rounded-lg text-xs font-semibold text-center animate-fade-in border border-primary/20">
              {toastMessage}
            </div>
          )}

          {/* Debug Code Helper Banner for offline test environments */}
          {debugCode && (
            <div className="mb-6 w-full bg-surface-container-low border border-dashed border-primary/40 p-4 rounded-xl text-center">
              <span className="block text-[10px] font-extrabold text-primary tracking-wider uppercase mb-1">
                {language === "EN" ? "Developer Verification Helper" : "Помощник отладки Mesa"}
              </span>
              <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed mb-2">
                {language === "EN" 
                  ? "SMTP settings not configured in .env. Here is your generated verification code:" 
                  : "Для локального тестирования (SMTP не задан) ваш сгенерированный код подтверждения:"}
              </p>
              <div className="inline-block bg-primary text-on-primary font-mono text-lg font-bold px-4 py-1 rounded-md select-text tracking-widest">
                {debugCode}
              </div>
            </div>
          )}

          {/* Header texts */}
          <h1 className="text-2xl md:text-3xl font-bold text-on-surface mb-2">
            {isPasswordReset ? t.verifyCodeTitle : t.verifyEmailTitle}
          </h1>
          <p className="text-sm text-center text-on-surface-variant mb-8 max-w-[320px]">
            {isPasswordReset ? t.verifyCodePrompt : t.verifyEmailPrompt}
            {email && <span className="block text-primary font-bold mt-1 text-xs">{email}</span>}
          </p>

          {/* Verification Form */}
          <form className="w-full flex flex-col gap-6" onSubmit={handleSubmit}>
            <OtpContainer 
              value={otpValue} 
              onChange={setOtpValue} 
              onSubmit={() => {
                if (otpValue.join("").length === 6) {
                  const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                  handleSubmit(fakeEvent);
                }
              }}
            />

            {/* Submit Button */}
            <div className="flex flex-col gap-4">
              <button
                className="w-full bg-primary hover:bg-on-primary-fixed-variant text-on-primary text-sm font-semibold rounded-full h-12 shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
                type="submit"
                disabled={otpValue.join("").length < 6 || isLoading}
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">
                    sync
                  </span>
                ) : (
                  <span>{isPasswordReset ? t.resetButton : t.verifyButton}</span>
                )}
              </button>

              {/* Resend code option */}
              <div className="text-center mt-2">
                <span className="text-xs font-semibold text-on-surface-variant">
                  {t.didntReceive}{" "}
                </span>
                <button
                  onClick={handleResend}
                  type="button"
                  className="text-sm font-bold text-primary hover:text-on-primary-fixed-variant transition-colors cursor-pointer bg-transparent border-none focus:outline-none"
                >
                  {t.resendLink}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
