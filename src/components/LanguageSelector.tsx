import { useState, useEffect, useRef } from "react";
import { Language } from "../types";

interface LanguageSelectorProps {
  language: Language;
  onChange: (lang: Language) => void;
}

export default function LanguageSelector({ language, onChange }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative cursor-pointer active:scale-95 duration-200 flex items-center gap-1 text-on-surface-variant hover:bg-surface-container px-3 py-1 rounded-full transition-colors"
      onClick={() => setIsOpen(!isOpen)}
    >
      <span className="material-symbols-outlined text-[20px]">language</span>
      <span className="text-sm font-semibold tracking-wider font-sans">{language}</span>
      <span className="material-symbols-outlined text-[16px]">expand_more</span>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-surface-container-lowest shadow-lg rounded-xl border border-surface-container overflow-hidden transition-all duration-200 z-50 origin-top-right">
          <div className="flex flex-col py-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange("EN");
                setIsOpen(false);
              }}
              className={`px-4 py-2 text-left text-sm font-semibold flex justify-between items-center w-full transition-colors ${
                language === "EN" 
                  ? "text-primary bg-primary-fixed/30" 
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              English
              {language === "EN" && (
                <span className="material-symbols-outlined text-[16px] text-primary">check</span>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange("RU");
                setIsOpen(false);
              }}
              className={`px-4 py-2 text-left text-sm font-semibold flex justify-between items-center w-full transition-colors ${
                language === "RU" 
                  ? "text-primary bg-primary-fixed/30" 
                  : "text-on-surface-variant hover:bg-surface-container-low"
              }`}
            >
              Русский
              {language === "RU" && (
                <span className="material-symbols-outlined text-[16px] text-primary">check</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
