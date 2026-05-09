import { cn } from "@/lib/utils";

export interface KeyValueFieldProps {
  label: string;
  value: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * KeyValueField - Display field showing label and value
 * Commonly used for read-only information display
 * 
 * Usage:
 * ```tsx
 * <KeyValueField label="School Name" value="Sunrise High School" />
 * ```
 */
export function KeyValueField({
  label,
  value,
  className,
  size = "md",
}: KeyValueFieldProps) {
  const sizeStyles = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4",
        sizeStyles[size],
        className
      )}
      style={{
        borderColor: "var(--app-divider)",
        backgroundColor: "var(--app-card-bg)",
      }}
    >
      <span className="text-xs uppercase tracking-wide text-[var(--app-text-secondary)]">
        {label}
      </span>
      <span className="font-medium text-[var(--app-text-primary)]">
        {value || "-"}
      </span>
    </div>
  );
}
