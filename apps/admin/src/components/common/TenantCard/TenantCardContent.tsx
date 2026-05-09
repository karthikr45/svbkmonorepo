import { cn } from "@/lib/utils";
import type { TenantCardContentProps } from "./types";

/**
 * TenantCardContent - Content section of TenantCard for fields and info
 */
export function TenantCardContent({
  children,
  className,
}: TenantCardContentProps) {
  return (
    <div className={cn("mt-3 space-y-1", className)}>
      {children}
    </div>
  );
}
