"use client";

const transitionClass = "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-side content (e.g. notification + avatar). If not provided, shows default notification icon + avatar. */
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {

  //  const notification = 
  const defaultRight = (
    <>
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition-[background-color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--app-nav-hover-bg)] hover:opacity-90"
        style={{ color: "var(--app-nav-icon)" }}
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--app-danger)] px-1 text-[10px] font-medium text-white"
          aria-hidden
        >
          2
        </span>
      </button>
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
        style={{ backgroundColor: "var(--app-brand, #0b54ab)" }}
      >
        A
      </div>
    </>
  );

  return (
    <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--app-text-primary)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--app-text-secondary)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {/* <div className={`mt-2 flex items-center gap-2 sm:mt-0 ${transitionClass}`}>
        {right ?? defaultRight}
      </div> */}
    </header>
  );
}
