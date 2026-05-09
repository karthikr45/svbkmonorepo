"use client";

import { useState } from "react";
import {
  BackLink,
  Button,
  FormLabel,
  InputBordered,
  PasswordInput,
} from "@/components/ui";
import { useLogin } from "@/features/auth/hooks/useLogin";
import type { LoginCredentials } from "@/features/auth/types";
import { validatePassword, validateUsername } from "@/lib/validation";

const initialValues: LoginCredentials = {
  email: "",
  password: "",
};

/**
 * Login form – UI only. Calls useLogin hook; no direct API or service.
 * Set showBackLink={false} when login is the only page (e.g. at "/").
 */
export function LoginForm({ showBackLink = true }: { showBackLink?: boolean }) {
  const { login, isLoading, error } = useLogin();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] =
    useState<Partial<Record<keyof LoginCredentials, string>>>({});

  const validate = (): boolean => {
    const next: Partial<Record<keyof LoginCredentials, string>> = {};
    const u = validateUsername(values.email);
    if (!u.valid) next.email = u.message;
    const p = validatePassword(values.password);
    if (!p.valid) next.password = p.message;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange =
    (field: keyof LoginCredentials) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    login(values);
  };

  return (
    <div className="w-full">
      {showBackLink && <BackLink href="/" />}

      <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight leading-[1.1] text-slate-900">
        Welcome back
      </h1>
      <p className="mt-2 text-[14.5px] text-slate-500">
        Sign in to continue to your console
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 flex flex-col gap-5"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <FormLabel htmlFor="login-email" required>
            Email or username
          </FormLabel>
          <InputBordered
            id="login-email"
            type="text"
            placeholder="you@svbk.com"
            value={values.email}
            onChange={handleChange("email")}
            autoComplete="username email"
            error={errors.email}
            fullWidth
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <FormLabel htmlFor="login-password" required>
              Password
            </FormLabel>
            <a
              href="/forgot-password"
              className="text-xs font-semibold text-[#0b54ab] hover:underline"
            >
              Forgot password?
            </a>
          </div>
          <PasswordInput
            id="login-password"
            placeholder="Your password"
            value={values.password}
            onChange={handleChange("password")}
            autoComplete="current-password"
            error={errors.password}
            fullWidth
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border px-3 py-2.5 text-sm"
            style={{
              backgroundColor: "#fef2f2",
              borderColor: "#fee2e2",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isLoading}
          className="mt-1"
        >
          Sign in
          {!isLoading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </Button>

        <p className="text-center text-xs text-slate-400 mt-2">
          Protected by SVBK · By signing in you agree to the terms of service.
        </p>
      </form>
    </div>
  );
}
