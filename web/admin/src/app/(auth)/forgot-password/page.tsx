import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-lg dark:border-zinc-700/50 dark:bg-zinc-900/95">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Forgot password?
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Password reset flow can be added here.
      </p>
      <Link
        href="/login"
        className="mt-4 inline-block text-sm font-medium text-[var(--brand)] underline-offset-2 hover:underline"
      >
        Back to Login
      </Link>
    </div>
  );
}
