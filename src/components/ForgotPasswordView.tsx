import React, { useState } from "react";
import { Screen, Language } from "../types";
import { translations } from "../locales";
import LanguageSelector from "./LanguageSelector";

interface ForgotPasswordViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onNavigate: (screen: Screen) => void;
  onResetRequested: (email: string, debugCode?: string) => void;
}

export default function ForgotPasswordView({ language, onLanguageChange, onNavigate, onResetRequested }: ForgotPasswordViewProps) {
  const t = translations[language];
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError(t.validationError);
      return;
    }
    setError("");
    setIsLoading(true);

    fetch("/api/auth/reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Пользователь не найден.");
          });
        }
        return res.json();
      })
      .then((data) => {
        setIsLoading(false);
        onResetRequested(email, data.debugCode || "");
      })
      .catch((err: any) => {
        setIsLoading(false);
        setError(err.message || "Ошибка соединения с сервером.");
      });
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-sans antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Top Navigation */}
      <header className="flex justify-between items-center w-full px-[20px] md:px-[40px] h-16 bg-surface shrink-0 z-10">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-[28px] filled">bubble_chart</span>
          <span className="text-xl font-bold text-primary tracking-tight font-sans">Mesa</span>
        </div>
        <LanguageSelector language={language} onChange={onLanguageChange} />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-[20px] relative">
        {/* Ambient background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center z-0">
          <div className="w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl"></div>
        </div>

        {/* Card and Forms */}
        <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-[0_8px_32px_rgba(45,50,130,0.06)] border border-outline-variant/20 p-8 md:p-10 flex flex-col gap-8 z-10">
          
          {/* Headline block */}
          <div className="flex flex-col gap-1 text-center">
            {/* Display on desktop and mobile differently as designed */}
            <h1 className="font-bold text-2xl md:text-3xl text-on-surface">
              {t.forgotPasswordTitle}
            </h1>
            <p className="text-sm font-sans text-on-surface-variant mt-2 max-w-[280px] mx-auto">
              {t.forgotPasswordPrompt}
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            {error && (
              <div className="text-xs text-error bg-error-container p-3 rounded-lg font-semibold text-center border border-error/20">
                {error}
              </div>
            )}

            {/* Email field */}
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
                mail
              </span>
              <input
                className="w-full h-12 pl-12 pr-4 bg-surface rounded-full border border-outline-variant/60 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-base text-on-surface placeholder:text-on-surface-variant/40"
                placeholder={t.emailLabel}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Action button */}
            <button
              className="w-full h-12 bg-primary text-on-primary rounded-full flex items-center justify-center gap-2 hover:bg-on-primary-fixed-variant active:scale-95 transition-all duration-200 mt-2 cursor-pointer shadow-sm font-semibold text-sm disabled:opacity-50"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
              ) : (
                <>
                  <span>{t.nextButton}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Back Navigation footer */}
          <div className="flex justify-center mt-3 pt-3 border-t border-outline-variant/20">
            <button
              onClick={() => onNavigate(Screen.LOGIN)}
              className="text-sm font-semibold text-primary hover:text-on-primary-fixed-variant transition-colors flex items-center gap-1.5 py-2 px-4 rounded-full hover:bg-primary-container/20 active:scale-95 duration-200 focus:outline-none cursor-pointer"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                arrow_back
              </span>
              {t.backToLogin}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
