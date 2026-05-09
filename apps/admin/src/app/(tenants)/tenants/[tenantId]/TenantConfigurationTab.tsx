"use client";

import { useState } from "react";
import { TenantCardHeader } from "@/components/common";
import { TenantCard } from "@/components/common/TenantCard/TenantCard";
import { Modal } from "@/components/common/Modal";
import {
  getTenantConfigRecordId,
  type SaveTenantConfigPayload,
} from "@/features/tenants/api/tenants.api";
import { Button } from "@/components/ui/Button";
import { useParams, useRouter } from "next/navigation";

type DeleteDialogState =
  | { open: false }
  | { open: true; mode: "confirm"; config: SaveTenantConfigPayload }
  | { open: true; mode: "noId" };

function normalizeEnvKey(apiEnvType: string | undefined): string {
  return (apiEnvType ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

function pickConfigString(c: SaveTenantConfigPayload, keys: string[]): string {
  const r = c as unknown as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function routeEnvIdForConfig(c: SaveTenantConfigPayload): string {
  const raw = pickConfigString(c, ["envType", "env_type", "environmentType", "environment"]);
  const k = normalizeEnvKey(raw);
  if (k === "qa" || k === "qualityassurance") return "qa";
  if (k === "production" || k === "prod") return "production";
  return "development";
}

function savedConfigCardTitle(c: SaveTenantConfigPayload): string {
  return (
    pickConfigString(c, ["configName", "config_name", "name", "configurationName", "title"]) ||
    pickConfigString(c, ["envType", "env_type", "environmentType"]) ||
    "Configuration"
  );
}

function savedConfigCardSubtitle(c: SaveTenantConfigPayload): string {
  const env = pickConfigString(c, ["envType", "env_type", "environmentType", "environment"]);
  return env || "Saved for this tenant — open to edit";
}

type TenantConfigurationTabProps = {
  configs: SaveTenantConfigPayload[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onDeleteConfig: (config: SaveTenantConfigPayload) => void | Promise<void>;
};

export default function TenantConfigurationTab({
  configs,
  loading,
  loadError,
  onRetry,
  onDeleteConfig,
}: TenantConfigurationTabProps) {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false });

  const closeDeleteDialog = () => setDeleteDialog({ open: false });

  const openConfigEditor = (c: SaveTenantConfigPayload) => {
    const envId = routeEnvIdForConfig(c);
    const recordId = getTenantConfigRecordId(c);
    const path = `/tenants/${tenantId}/config/${envId}`;
    router.push(recordId ? `${path}?configId=${encodeURIComponent(recordId)}` : path);
  };

  function handleDeleteConfig(c: SaveTenantConfigPayload): void {
    const recordId = getTenantConfigRecordId(c);
    if (!recordId) {
      setDeleteDialog({ open: true, mode: "noId" });
      return;
    }
    setDeleteDialog({ open: true, mode: "confirm", config: c });
  }

  function confirmDelete(): void {
    if (!deleteDialog.open || deleteDialog.mode !== "confirm") return;
    const cfg = deleteDialog.config;
    closeDeleteDialog();
    void onDeleteConfig(cfg);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--app-text-primary)]">Saved configurations</h2>
        <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
          Each card shows the environmen with the configuration name below. Click a card to open that
          environment&apos;s editor.
        </p>
        {loadError && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            <span>{loadError}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void onRetry()}>
              Retry
            </Button>
          </div>
        )}
        {loading && !loadError && (
          <p className="mt-3 text-sm text-[var(--app-text-secondary)]">Loading saved configurations…</p>
        )}
        {!loading && !loadError && configs.length === 0 && (
          <p className="mt-3 text-sm text-[var(--app-text-secondary)]">
            No configurations saved yet. Use &quot;Add Configuration&quot; to create one.
          </p>
        )}
        {!loading && configs.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {configs.map((c, idx) => (
              <TenantCard
                key={getTenantConfigRecordId(c) ?? `${savedConfigCardTitle(c)}-${idx}`}
                isSelected={false}
                onClick={() => openConfigEditor(c)}
              >
                <TenantCardHeader
                  title={savedConfigCardSubtitle(c)}
                  subtitle={savedConfigCardTitle(c)}
                  showCheckmark={false}
                  onEdit={() => openConfigEditor(c)}
                  onDelete={() => handleDeleteConfig(c)}
                />
              </TenantCard>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={deleteDialog.open}
        onClose={closeDeleteDialog}
        title={deleteDialog.open && deleteDialog.mode === "noId" ? "Cannot delete" : "Delete configuration?"}
        size="sm"
        footer={
          deleteDialog.open && deleteDialog.mode === "noId" ? (
            <Button type="button" variant="primary" size="sm" onClick={closeDeleteDialog}>
              OK
            </Button>
          ) : deleteDialog.open && deleteDialog.mode === "confirm" ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </Button>
            </>
          ) : null
        }
      >
        {deleteDialog.open && deleteDialog.mode === "noId" && (
          <p className="text-sm text-[var(--app-text-secondary)]">
            This configuration has no id from the server, so it cannot be deleted. If the problem continues,
            refresh the page or contact support.
          </p>
        )}
        {deleteDialog.open && deleteDialog.mode === "confirm" && (
          <p className="text-sm text-[var(--app-text-secondary)]">
            <span className="font-medium text-[var(--app-text-primary)]">{savedConfigCardTitle(deleteDialog.config)}</span>
            {" — "}
            {savedConfigCardSubtitle(deleteDialog.config)} will be removed. This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
