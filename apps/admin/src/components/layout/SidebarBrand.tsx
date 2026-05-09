import Image from "next/image";
import Link from "next/link";

const SCHOOL_LOGO_SRC = "/svbk_logo.webp";
const schoolName = "Sri Venkateswara Bala Kuteer";
const subtitle = "";

export function SidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className="flex min-w-0 items-center gap-3 overflow-hidden rounded-xl px-2 py-2.5 transition-[background-color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--app-nav-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-search-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-sidebar-bg)]"
    >
      <span
        className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5"
        style={{ backgroundColor: "var(--app-card-bg)" }}
      >
        <Image
          src={SCHOOL_LOGO_SRC}
          alt=""
          width={40}
          height={40}
          className="object-contain p-1"
          sizes="40px"
          priority
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[15px] font-semibold leading-tight tracking-tight"
          style={{ color: "var(--app-text-primary)" }}
        >
          {schoolName}
        </span>
        <span
          className="mt-0.5 block truncate text-xs font-medium"
          style={{ color: "var(--app-text-secondary)" }}
        >
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
