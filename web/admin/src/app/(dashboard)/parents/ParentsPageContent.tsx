"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createParentApi,
  deleteParentApi,
  listParentsApi,
} from "@/features/parents/api/parents.api";
import type { CreateParentInput, Parent } from "@/features/parents/types";
import { getApiErrorMessage } from "@/lib/api-client";

const EMPTY_FORM: CreateParentInput = {
  name: "",
  email: "",
  phoneNumber: "",
  isActive: true,
  students: [
    { branch: "", admissionNumber: "", relationship: "guardian", isPrimary: true },
  ],
};

export function ParentsPageContent() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateParentInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listParentsApi()
      .then((data) => setParents(data))
      .catch((err) => setError(getApiErrorMessage(err, "Could not load parents")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function updateStudent(
    i: number,
    patch: Partial<CreateParentInput["students"][number]>,
  ) {
    setForm((f) => ({
      ...f,
      students: f.students.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  }

  function addStudentRow() {
    setForm((f) => ({
      ...f,
      students: [
        ...f.students,
        { branch: "", admissionNumber: "", relationship: "guardian", isPrimary: false },
      ],
    }));
  }

  function removeStudentRow(i: number) {
    setForm((f) => ({
      ...f,
      students: f.students.filter((_, idx) => idx !== i),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Name and email are required.");
      return;
    }
    if (form.students.some((s) => !s.branch.trim() || !s.admissionNumber.trim())) {
      setFormError("Every student row needs a branch and admission number.");
      return;
    }
    setSubmitting(true);
    try {
      await createParentApi(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Could not create parent"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this parent? This cannot be undone.")) return;
    try {
      await deleteParentApi(id);
      reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete parent"));
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parents</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage parents and link them to their children's admission numbers.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="h-10 px-4 rounded-lg text-white text-sm font-bold"
          style={{ backgroundColor: "#0b54ab" }}
        >
          {showForm ? "Cancel" : "+ Add parent"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-5 bg-white rounded-xl border border-slate-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name *">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Email *">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phoneNumber ?? ""}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Active">
              <select
                value={form.isActive ? "true" : "false"}
                onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}
                className="input"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-700 mb-2">Children</p>
            <div className="flex flex-col gap-2">
              {form.students.map((s, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    placeholder="Branch"
                    value={s.branch}
                    onChange={(e) => updateStudent(i, { branch: e.target.value })}
                    className="input sm:col-span-3"
                  />
                  <input
                    placeholder="Admission number"
                    value={s.admissionNumber}
                    onChange={(e) => updateStudent(i, { admissionNumber: e.target.value })}
                    className="input sm:col-span-3"
                  />
                  <select
                    value={s.relationship}
                    onChange={(e) => updateStudent(i, { relationship: e.target.value as "father" | "mother" | "guardian" })}
                    className="input sm:col-span-2"
                  >
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="guardian">Guardian</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={!!s.isPrimary}
                      onChange={(e) => updateStudent(i, { isPrimary: e.target.checked })}
                    />
                    Primary
                  </label>
                  <button
                    type="button"
                    onClick={() => removeStudentRow(i)}
                    disabled={form.students.length === 1}
                    className="text-xs text-red-600 sm:col-span-2 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStudentRow}
              className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
            >
              + Add another child
            </button>
          </div>

          {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-9 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-lg text-white text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: "#0b54ab" }}
            >
              {submitting ? "Saving…" : "Save parent"}
            </button>
          </div>

          <style jsx>{`
            .input {
              height: 40px;
              padding: 0 12px;
              border-radius: 8px;
              border: 1px solid #cbd5e1;
              background: #f8fafc;
              font-size: 14px;
              color: #0f172a;
              outline: none;
              width: 100%;
            }
          `}</style>
        </form>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : parents.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No parents yet. Click <strong>Add parent</strong> to create one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Phone</th>
                <th className="text-left px-4 py-3 font-semibold">Children</th>
                <th className="text-left px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.email}</td>
                  <td className="px-4 py-3 text-slate-600">{p.phoneNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {(p.studentLinks ?? [])
                      .map((l) => `${l.admissionNumber} (${l.branch})`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${p.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-slate-700 font-semibold">{label}</span>
      {children}
    </label>
  );
}
