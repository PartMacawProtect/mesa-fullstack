import React, { useRef, useEffect } from "react";

interface OtpContainerProps {
  value: string[];
  onChange: (value: string[]) => void;
  onSubmit?: () => void;
}

export default function OtpContainer({ value, onChange, onSubmit }: OtpContainerProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto focus the first input on mount
    setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 100);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    // Allow only numeric digit
    const cleanedVal = val.replace(/[^0-9]/g, "");
    
    const newValue = [...value];
    newValue[index] = cleanedVal.slice(-1); // Take only the last digit typed
    onChange(newValue);

    if (cleanedVal && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        const newValue = [...value];
        newValue[index - 1] = "";
        onChange(newValue);
        inputsRef.current[index - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (pasteData) {
      const newValue = [...value];
      for (let i = 0; i < pasteData.length; i++) {
        newValue[i] = pasteData[i];
      }
      onChange(newValue);
      
      const lastIndex = Math.min(pasteData.length, 5);
      inputsRef.current[lastIndex]?.focus();
    }
  };

  return (
    <div className="flex justify-between items-center gap-2 sm:gap-3 w-full" id="otp-container">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          maxLength={1}
          inputMode="numeric"
          pattern="[0-9]"
          value={value[i] || ""}
          onChange={(e) => handleInputChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          className="otp-input w-11 sm:w-12 h-12 sm:h-14 rounded-lg bg-surface-container-low border border-outline-variant text-center text-xl font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-all duration-200"
          required
        />
      ))}
    </div>
  );
}
