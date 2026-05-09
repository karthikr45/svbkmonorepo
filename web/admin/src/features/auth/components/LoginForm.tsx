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
  const [errors, setErrors] = useState<Partial<Record<keyof LoginCredentials, string>>>({});

  const validate = (): boolean => {
    const next: Partial<Record<keyof LoginCredentials, string>> = {};
    const u = validateUsername(values.email);
    if (!u.valid) next.email = u.message;
    const p = validatePassword(values.password);
    if (!p.valid) next.password = p.message;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (field: keyof LoginCredentials) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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

      <h1 className="text-2xl font-bold tracking-tight text-[var(--auth-label-default)] sm:text-3xl">
        Welcome back
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="login-email" accent required>
            Username / Email / Mobile
          </FormLabel>
          <InputBordered
            id="login-email"
            type="text"
            placeholder="Enter username, email or mobile"
            value={values.email}
            onChange={handleChange("email")}
            autoComplete="username email"
            error={errors.email}
            fullWidth
          />
        </div>

        <div className="flex flex-col gap-2">
          <FormLabel htmlFor="login-password" required>
            Password
          </FormLabel>
          <PasswordInput
            id="login-password"
            placeholder="Enter your password"
            value={values.password}
            onChange={handleChange("password")}
            autoComplete="current-password"
            error={errors.password}
            fullWidth
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="auth"
          size="lg"
          fullWidth
          isLoading={isLoading}
        >
          Sign in
        </Button>
      </form>
    </div>
  );
}
