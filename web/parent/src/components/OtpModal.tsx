"use client";

import { useEffect, useRef, useState } from "react";
import { sendOtp, verifyOtp } from "@/lib/parent-portal";
import { apiErrorMessage } from "@/lib/api";

interface OtpModalProps {
  email: string;
  onVerified: () => void;
  onClose: () => void;
}

const OTP_LENGTH = 6;
const RESEND_SECONDS = 120; // 2 minutes

export function OtpModal({ email, onVerified, onClose }: OtpModalProps) {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start countdown
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Auto-focus first input on open
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setError(null);
    const char = value.slice(-1);
    const next = [...otp];
    next[index] = char;
    setOtp(next);
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const next = [...otp];
        next[index] = "";
        setOtp(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...otp];
        next[index - 1] = "";
        setOtp(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      onVerified();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not verify OTP. Try again."));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setOtp(Array(OTP_LENGTH).fill(""));
    setError(null);
    try {
      await sendOtp(email);
      setTimer(RESEND_SECONDS);
      setCanResend(false);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not resend OTP."));
    }
  };

  const isFilled = otp.join("").length === OTP_LENGTH;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Verify Your Email</h2>
            <p className="mt-1 text-sm text-slate-500">
              We sent a 6-digit OTP to
            </p>
            <p className="text-sm font-semibold text-[#0b54ab] break-all">{email}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M14 4L4 14M4 4l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* OTP icon strip */}
        <div className="mx-6 h-px bg-slate-100" />

        <div className="px-6 py-6">
          {/* OTP boxes */}
          <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`otp-input${digit ? " filled" : ""}`}
                aria-label={`OTP digit ${i + 1}`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-3 text-center text-sm text-red-600" role="alert">{error}</p>
          )}

          {/* Timer / Resend */}
          <div className="mt-4 text-center">
            {canResend ? (
              <button
                onClick={handleResend}
                className="text-sm font-semibold text-[#0b54ab] hover:underline"
              >
                Resend OTP
              </button>
            ) : (
              <p className="text-sm text-slate-500">
                Resend OTP in{" "}
                <span className="font-semibold text-slate-700">{formatTimer(timer)}</span>
              </p>
            )}
          </div>

          {/* Verify button */}
          <button
            onClick={handleVerify}
            disabled={!isFilled || isVerifying}
            className="mt-5 w-full h-12 rounded-xl font-bold text-white text-sm tracking-wide transition-all"
            style={{
              backgroundColor: isFilled && !isVerifying ? "#0b54ab" : "#94a3b8",
              cursor: isFilled && !isVerifying ? "pointer" : "not-allowed",
            }}
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Verifying…
              </span>
            ) : (
              "Verify OTP"
            )}
          </button>

          <p className="mt-4 text-center text-xs text-slate-400">
            Enter the 6-digit code sent to your email. With <code>DEMO_MODE=true</code> on the API, any 6 digits will be accepted.
          </p>
        </div>
      </div>
    </div>
  );
}
