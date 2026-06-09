"use client"

import dynamic from "next/dynamic"

const DashboardChart = dynamic(
  () => import("./dashboard-chart").then((module) => ({ default: module.DashboardChart })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mt-4 h-[250px] w-full min-h-[250px] min-w-0 animate-pulse rounded-md bg-staff-100"
        aria-hidden
      />
    ),
  },
)

export function DashboardChartLazy({ total, approved }: { total: number; approved: number }) {
  return <DashboardChart total={total} approved={approved} />
}
