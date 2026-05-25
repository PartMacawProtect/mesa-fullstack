import React, { useState } from "react";
import { Screen, Language } from "../types";
import { translations } from "../locales";
import LanguageSelector from "./LanguageSelector";

interface RegisterViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onNavigate: (screen: Screen) => void;
  onRegisterSuccess: (email: string, username: string, debugCode?: string) => void;
}

export default function RegisterView({ language, onLanguageChange, onNavigate, onRegisterSuccess }: RegisterViewProps) {
  const t = translations[language];
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !username || !password) {
      setError(t.validationError);
      return;
    }
    setError("");
    setIsLoading(true);

    fetch("/api/auth/register-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Ошибка при регистрации.");
          });
        }
        return res.json();
      })
      .then((data) => {
        setIsLoading(false);
        onRegisterSuccess(email, username, data.debugCode || "");
      })
      .catch((err: any) => {
        setIsLoading(false);
        setError(err.message || "Ошибка соединения с сервером.");
      });
  };

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-sans antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Transactional Header */}
      <header className="flex justify-between items-center w-full px-[20px] md:px-[40px] h-16 bg-surface shrink-0 z-10">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-[28px] filled">bubble_chart</span>
          <span className="text-xl font-bold text-primary tracking-tight font-sans">Mesa</span>
        </div>
        <LanguageSelector language={language} onChange={onLanguageChange} />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-[20px] md:p-[40px] relative">
        {/* Ambient background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center z-0">
          <div className="w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl"></div>
        </div>

        {/* Center Register Card */}
        <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl shadow-[0_8px_32px_rgba(45,50,130,0.06)] border border-outline-variant/30 p-8 md:p-10 flex flex-col gap-8 transform transition-all z-10">
          
          {/* Header */}
          <div className="flex flex-col gap-1 text-center items-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
              {t.createAccount}
            </h1>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {error && (
              <div className="text-xs text-error bg-error-container p-3 rounded-lg font-semibold text-center border border-error/20">
                {error}
              </div>
            )}
            
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface pl-1" htmlFor="email">
                {t.emailLabel}
              </label>
              <div className="relative flex items-center group">
                <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors">
                  mail
                </span>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-xl py-3.5 pl-12 pr-4 text-base text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  id="email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Username Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface pl-1" htmlFor="username">
                {t.usernameLabel}
              </label>
              <div className="relative flex items-center group">
                <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors">
                  person
                </span>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-xl py-3.5 pl-12 pr-4 text-base text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  id="username"
                  type="text"
                  placeholder={t.usernamePlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface pl-1" htmlFor="password">
                {t.passwordLabel}
              </label>
              <div className="relative flex items-center group">
                <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors">
                  lock
                </span>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-xl py-3.5 pl-12 pr-12 text-base text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  aria-label="Toggle password visibility"
                  className="absolute right-4 text-outline hover:text-on-surface-variant transition-colors flex items-center"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            {/* Register Action Button */}
            <div className="mt-4">
              <button
                className="w-full bg-primary text-on-primary h-12 rounded-xl text-sm font-semibold hover:bg-on-primary-fixed-variant transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                ) : (
                  <>
                    <span>{t.registerButton}</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* footer redirect to login */}
          <div className="text-center pt-2 border-t border-outline-variant/10 text-xs font-semibold text-on-surface-variant">
            <span>{t.alreadyHaveAccount} </span>
            <button
              onClick={() => onNavigate(Screen.LOGIN)}
              className="text-primary hover:text-on-primary-fixed-variant underline focus:outline-none font-bold"
            >
              {t.loginLink}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
