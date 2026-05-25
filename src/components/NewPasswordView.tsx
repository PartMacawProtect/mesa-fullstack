import React, { useState } from "react";
import { Screen, Language } from "../types";
import { translations } from "../locales";
import LanguageSelector from "./LanguageSelector";

interface NewPasswordViewProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onNavigate: (screen: Screen) => void;
  onResetSuccess: () => void;
  email: string;
}

export default function NewPasswordView({ language, onLanguageChange, onNavigate, onResetSuccess, email }: NewPasswordViewProps) {
  const t = translations[language];
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError(t.validationError);
      return;
    }
    if (password !== confirmPassword) {
      setError(language === "EN" ? "Passwords do not match." : "Пароли не совпадают.");
      return;
    }
    setError("");
    setIsLoading(true);

    fetch("/api/auth/reset-complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.error || "Ошибка сохранения нового пароля.");
          });
        }
        return res.json();
      })
      .then(() => {
        setIsLoading(false);
        onResetSuccess();
      })
      .catch((err: any) => {
        setIsLoading(false);
        setError(err.message || "Ошибка соединения.");
      });
  };

  return (
    <div className="bg-background min-h-screen flex flex-col antialiased selection:bg-primary-fixed selection:text-on-primary-fixed font-sans">
      {/* Transactional Header */}
      <header className="flex justify-between items-center w-full px-[20px] md:px-[40px] h-16 bg-surface shrink-0 z-10">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-primary text-[28px] filled">bubble_chart</span>
          <span className="text-xl font-bold text-primary tracking-tight font-sans">Mesa</span>
        </div>
        <LanguageSelector language={language} onChange={onLanguageChange} />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-[20px] md:p-[40px] relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center z-0">
          <div className="w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl"></div>
        </div>

        {/* Center Card */}
        <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-2xl shadow-[0_8px_32px_rgba(45,50,130,0.06)] border border-outline-variant/30 p-8 md:p-10 flex flex-col gap-8 transform transition-all z-10">
          
          {/* Header Text */}
          <div className="flex flex-col gap-1 text-center items-center">
            <div className="w-16 h-16 bg-primary-fixed/30 text-primary rounded-full flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[32px]">token</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface">
              {t.newPasswordTitle}
            </h1>
            <p className="text-sm font-sans text-on-surface-variant mt-2 max-w-[280px]">
              {t.newPasswordPrompt}
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {error && (
              <div className="text-xs text-error bg-error-container p-3 rounded-lg font-semibold text-center border border-error/20">
                {error}
              </div>
            )}

            {/* New Password Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface pl-1" htmlFor="new_password">
                {t.newPasswordLabel}
              </label>
              <div className="relative flex items-center group">
                <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors">
                  lock
                </span>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-xl py-3.5 pl-12 pr-12 text-base text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t.newPasswordPlaceholder}
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

            {/* Confirm Password Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-on-surface pl-1" htmlFor="confirm_password">
                {t.confirmPasswordLabel}
              </label>
              <div className="relative flex items-center group">
                <span className="material-symbols-outlined absolute left-4 text-outline group-focus-within:text-primary transition-colors">
                  lock
                </span>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-xl py-3.5 pl-12 pr-12 text-base text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t.confirmPasswordPlaceholder}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  aria-label="Toggle password visibility"
                  className="absolute right-4 text-outline hover:text-on-surface-variant transition-colors flex items-center"
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-3">
              <button
                className="w-full bg-primary text-on-primary h-12 rounded-xl text-sm font-semibold hover:bg-on-primary-fixed-variant transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                ) : (
                  <span>{t.doneButton}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
