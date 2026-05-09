import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { TenantCardProps } from "./types";

/**
 * TenantCard - Composable card component for tenants
 * 
 * Usage:
 * ```tsx
 * <TenantCard isSelected={true} onClick={handleSelect}>
 *   <TenantCardHeader title="School Name" subtitle="Campus" showCheckmark />
 *   <TenantCardContent>
 *     <TenantCardField label="Code" value="TNT001" />
 *   </TenantCardContent>
 * </TenantCard>
 * ```
 */
export function TenantCard({
  isSelected = false,
  onClick,
  onEdit,
  className,
  children,
}: TenantCardProps) {
  const interactive = Boolean(onClick);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick();
  };

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={cn(
        "group rounded-xl border p-4 text-left transition-all duration-200",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
        interactive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60",
        isSelected
          ? "border-foreground bg-[var(--app-card-bg)] shadow-lg"
          : "border-zinc-200 bg-white",
        className
      )}
      style={{
        boxShadow: isSelected ? "0 0 0 2px var(--app-brand)" : undefined,
      }}
    >
      {children}
    </div>
  );
}
