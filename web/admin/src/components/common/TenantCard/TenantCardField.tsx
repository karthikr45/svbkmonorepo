import { cn } from "@/lib/utils";
import type { TenantCardFieldProps } from "./types";

const sizeStyles = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

/**
 * TenantCardField - Individual field in TenantCard with label and value
 * 
 * Usage:
 * ```tsx
 * <TenantCardField label="School Code" value="SHS001" size="sm" />
 * ```
 */
export function TenantCardField({
  label,
  value,
  size = "sm",
  className,
}: TenantCardFieldProps) {
  return (
    <p className={cn("text-[var(--app-text-secondary)]", sizeStyles[size], className)}>
      <span className="font-medium text-[var(--app-text-primary)]">{label}:</span> {value}
    </p>
  );
}
