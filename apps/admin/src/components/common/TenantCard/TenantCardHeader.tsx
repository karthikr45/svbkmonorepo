import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { TenantCardHeaderProps } from "./types";

function stopCardActivation(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

function HeaderIconAction({
  label,
  onActivate,
  children,
  className,
}: {
  label: string;
  onActivate: () => void;
  children: ReactNode;
  className?: string;
}) {
  const onClick = (e: MouseEvent) => {
    stopCardActivation(e);
    onActivate();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    stopCardActivation(e);
    onActivate();
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[var(--app-text-secondary)] transition-colors",
        "hover:bg-zinc-100 hover:text-[var(--app-text-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * TenantCardHeader - Header section of TenantCard with title, optional checkmark, and optional edit/delete actions
 */
export function TenantCardHeader({
  title,
  subtitle,
  showCheckmark = false,
  onEdit,
  onDelete,
  className,
}: TenantCardHeaderProps) {
  const hasActions = Boolean(onEdit || onDelete || showCheckmark);

  return (
    <div className={cn("flex items-start justify-between gap-2", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-[var(--app-text-primary)]">{title}</p>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--app-text-secondary)]">{subtitle}</p>
        )}
      </div>
      {hasActions && (
        <div className="flex flex-shrink-0 items-center gap-0.5">
          {onEdit && (
            <HeaderIconAction label="Edit" onActivate={onEdit}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </HeaderIconAction>
          )}
          {onDelete && (
            <HeaderIconAction
              label="Delete"
              onActivate={onDelete}
              className="hover:text-red-600 focus-visible:ring-red-500/40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </HeaderIconAction>
          )}
          {showCheckmark && (
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background flex-shrink-0"
              aria-hidden="true"
            >
              ✓
            </span>
          )}
        </div>
      )}
    </div>
  );
}
