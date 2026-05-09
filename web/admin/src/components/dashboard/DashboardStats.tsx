"use client";

import React, { useEffect, useState } from "react";
import { getDashboardStatsApi } from "@/features/fees/api/fees.api";
import type { DashboardStatsData, DashboardStatItem } from "@/features/fees/types";

function IconUsers() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function IconPayments() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function TrendIcon({ positive }: { positive: boolean }) {
  return positive ? (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ) : (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
    </svg>
  );
}

function formatChange(percentageChange: number): string {
  const abs = Math.abs(percentageChange);
  return `${percentageChange >= 0 ? "+" : "-"}${abs}%`;
}

function isPositive(stat: DashboardStatItem): boolean {
  return stat.trend !== "decrease";
}

function StatCard({
  label,
  value,
  stat,
  iconBg,
  Icon,
}: {
  label: string;
  value: string;
  stat: DashboardStatItem | null;
  iconBg: string;
  Icon: () => React.ReactElement;
}) {
  const positive = stat ? isPositive(stat) : true;

  return (
    <div className="rounded-[var(--app-card-radius)] border border-[var(--app-sidebar-border)] bg-[var(--app-card-bg)] p-4 sm:p-6 shadow-[var(--app-card-shadow)] transition-shadow hover:shadow-[0 4px 16px -4px rgb(0 0 0 / 0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--app-text-secondary)]">{label}</p>
          <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--app-text-primary)]">
            {value}
          </p>
          {stat && (
            <p
              className={`mt-2 flex items-center gap-1 text-sm font-medium ${
                positive ? "text-[var(--app-success)]" : "text-[var(--app-danger)]"
              }`}
            >
              <TrendIcon positive={positive} />
              {formatChange(stat.percentageChange)}
            </p>
          )}
        </div>
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: iconBg }}
        >
          <Icon />
        </div>
      </div>
    </div>
  );
}

export function DashboardStats() {
  const [data, setData] = useState<DashboardStatsData | null>(null);

  useEffect(() => {
    getDashboardStatsApi()
      .then((res: any) => setData(res.data))
      .catch(() => {});
  }, []);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label="Total Students"
        value={data ? data.students.total.toLocaleString() : "—"}
        stat={data?.students ?? null}
        iconBg="var(--app-stat-icon-blue)"
        Icon={IconUsers}
      />
      <StatCard
        label="Active Penalties"
        value={data ? data.penalty.total.toLocaleString() : "—"}
        stat={data?.penalty ?? null}
        iconBg="var(--app-stat-icon-orange)"
        Icon={IconWarning}
      />
      <StatCard
        label="Fees"
        value={data ? `₹${data.amount.total.toLocaleString()}` : "—"}
        stat={data?.amount ?? null}
        iconBg="var(--app-brand, #0b54ab)"
        Icon={IconPayments}
      />
    </div>
  );
}
