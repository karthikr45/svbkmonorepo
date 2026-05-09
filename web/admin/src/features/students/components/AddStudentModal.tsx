"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { createStudentApi, type CreateStudentPayload } from "@/features/students/api/students.api";
import { getApiErrorMessage } from "@/lib/api-client";

const TERMS = [
  "1st Term Fee",
  "2nd Term Fee",
  "3rd Term Fee",
  "4th Term Fee",
  "5th Term Fee",
] as const;

const TERM_LABELS = ["1st", "2nd", "3rd", "4th", "5th"] as const;

interface Props {
  open: boolean;
  defaultAcademicYear?: string;
  defaultBranch?: string;
  onClose: () => void;
  onCreated: () => void;
}

interface TermInput {
  enabled: boolean;
  amount: string;
  discount: string;
}

const emptyTerms: TermInput[] = TERMS.map(() => ({
  enabled: false,
  amount: "",
  discount: "",
}));

export function AddStudentModal({
  open,
  defaultAcademicYear = "",
  defaultBranch = "",
  onClose,
  onCreated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    branch: defaultBranch,
    academicYear: defaultAcademicYear,
    admissionNumber: "",
    name: "",
    email: "",
    phoneNumber: "",
    class: "",
    section: "",
    rollNo: "",
  });
  const [terms, setTerms] = useState<TermInput[]>(emptyTerms);

  if (!open) return null;

  function reset() {
    setForm({
      branch: defaultBranch,
      academicYear: defaultAcademicYear,
      admissionNumber: "",
      name: "",
      email: "",
      phoneNumber: "",
      class: "",
      section: "",
      rollNo: "",
    });
    setTerms(emptyTerms);
    setError(null);
  }

  function setTerm(i: number, patch: Partial<TermInput>) {
    setTerms((curr) => curr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Basic client-side checks
    const required = ["academicYear", "admissionNumber", "name", "email", "phoneNumber", "class", "section", "rollNo"] as const;
    for (const k of required) {
      if (!form[k]?.toString().trim()) {
        setError(`${k} is required`);
        return;
      }
    }

    const payloadTerms: CreateStudentPayload["terms"] = [];
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      if (!t.enabled) continue;
      const amount = Number(t.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setError(`${TERM_LABELS[i]} term fee must be a positive number`);
        return;
      }
      const discount = t.discount === "" ? 0 : Number(t.discount);
      if (!Number.isFinite(discount) || discount < 0) {
        setError(`${TERM_LABELS[i]} term discount must be 0 or more`);
        return;
      }
      if (discount > amount) {
        setError(`${TERM_LABELS[i]} term discount cannot exceed fee`);
        return;
      }
      payloadTerms.push({ term: TERMS[i], amount, discount });
    }

    setSubmitting(true);
    try {
      await createStudentApi({
        ...form,
        branch: form.branch || undefined,
        terms: payloadTerms.length ? payloadTerms : undefined,
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create student"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl my-auto"
        style={{
          boxShadow: "0 32px 80px -16px rgba(15,23,42,0.25)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--app-text-primary)]">
              Add student
            </h2>
            <p className="text-xs text-[var(--app-text-secondary)] mt-0.5">
              Create one student and (optionally) up to 5 term fees in one go.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 max-h-[calc(100vh-140px)] overflow-y-auto">
          {/* Identity */}
          <SectionHeading>Identity</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Field label="Academic year" required>
              <input
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                placeholder="2025-2026"
                className="form-input"
                required
              />
            </Field>
            <Field label="Branch">
              <input
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="defaults to your branch"
                className="form-input"
              />
            </Field>
            <Field label="Admission number" required>
              <input
                value={form.admissionNumber}
                onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })}
                placeholder="ADM-2024-001"
                className="form-input"
                required
              />
            </Field>
            <Field label="Name" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Arjun Kumar"
                className="form-input"
                required
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="arjun@example.com"
                className="form-input"
                required
              />
            </Field>
            <Field label="Phone" required>
              <input
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="+91 9876543210"
                className="form-input"
                required
              />
            </Field>
            <Field label="Class" required>
              <input
                value={form.class}
                onChange={(e) => setForm({ ...form, class: e.target.value })}
                placeholder="7"
                className="form-input"
                required
              />
            </Field>
            <Field label="Section" required>
              <input
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                placeholder="A"
                className="form-input"
                required
              />
            </Field>
            <Field label="Roll No" required>
              <input
                value={form.rollNo}
                onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
                placeholder="1"
                className="form-input"
                required
              />
            </Field>
          </div>

          {/* Terms */}
          <SectionHeading>
            Term fees{" "}
            <span className="text-xs font-normal text-[var(--app-text-secondary)]">
              (optional — toggle each term you want to set)
            </span>
          </SectionHeading>
          <div className="flex flex-col gap-2 mb-6">
            {TERM_LABELS.map((label, i) => (
              <div
                key={label}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-lg bg-slate-50 border border-slate-100"
              >
                <label className="flex items-center gap-2 sm:col-span-3 text-sm font-semibold text-[var(--app-text-primary)]">
                  <input
                    type="checkbox"
                    checked={terms[i].enabled}
                    onChange={(e) => setTerm(i, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--app-brand)] focus:ring-[var(--app-brand)]"
                  />
                  {label} Term Fee
                </label>
                <input
                  type="number"
                  min={0}
                  value={terms[i].amount}
                  onChange={(e) => setTerm(i, { amount: e.target.value })}
                  placeholder="Amount"
                  disabled={!terms[i].enabled}
                  className="form-input form-input-tight sm:col-span-4 disabled:opacity-50"
                />
                <input
                  type="number"
                  min={0}
                  value={terms[i].discount}
                  onChange={(e) => setTerm(i, { discount: e.target.value })}
                  placeholder="Discount (optional)"
                  disabled={!terms[i].enabled}
                  className="form-input form-input-tight sm:col-span-3 disabled:opacity-50"
                />
                <span className="sm:col-span-2 text-right text-xs font-bold text-[var(--app-text-muted)] tabular-nums">
                  {terms[i].enabled && terms[i].amount
                    ? `Net ₹${Math.max(0, Number(terms[i].amount) - Number(terms[i].discount || 0)).toLocaleString("en-IN")}`
                    : ""}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save student
            </Button>
          </div>

          <style jsx>{`
            :global(.form-input) {
              height: 40px;
              padding: 0 12px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              background: #ffffff;
              font-size: 14px;
              color: #0f172a;
              outline: none;
              width: 100%;
              transition: border-color 0.15s, box-shadow 0.15s;
            }
            :global(.form-input:focus) {
              border-color: var(--app-brand);
              box-shadow: 0 0 0 3px rgb(11 84 171 / 0.15);
            }
            :global(.form-input::placeholder) {
              color: #94a3b8;
            }
            :global(.form-input-tight) {
              height: 36px;
              font-size: 13px;
            }
          `}</style>
        </form>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--app-text-muted)] mb-3">
      {children}
    </h3>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[var(--app-text-secondary)]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
