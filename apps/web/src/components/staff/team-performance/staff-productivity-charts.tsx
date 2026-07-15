"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { StaffProductivityActivityDay, StaffProductivityFieldSaves } from "@/lib/api/staff-api"

const FIELD_COLORS = {
  caption: "#1a2540",
  whoIsInPicture: "#c07c0a",
  keywords: "#263460",
  headline: "#9a6108",
  description: "#6b7280",
} as const

const FIELD_LABELS: Record<keyof StaffProductivityFieldSaves, string> = {
  caption: "Caption",
  whoIsInPicture: "Who in picture",
  keywords: "Keywords",
  headline: "Headline",
  description: "Description",
}

interface StaffProductivityChartsProps {
  activityByDay: StaffProductivityActivityDay[]
  uniqueAssetsByField: StaffProductivityFieldSaves
  fieldSaves: StaffProductivityFieldSaves
}

export function StaffProductivityCharts({
  activityByDay,
  uniqueAssetsByField,
  fieldSaves,
}: StaffProductivityChartsProps) {
  const pieData = (Object.keys(FIELD_LABELS) as Array<keyof StaffProductivityFieldSaves>)
    .map((key) => ({
      key,
      name: FIELD_LABELS[key],
      value: uniqueAssetsByField[key],
      color: FIELD_COLORS[key],
    }))
    .filter((entry) => entry.value > 0)

  const barData = (Object.keys(FIELD_LABELS) as Array<keyof StaffProductivityFieldSaves>).map((key) => ({
    name: FIELD_LABELS[key],
    uniqueAssets: uniqueAssetsByField[key],
    saves: fieldSaves[key],
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Activity over time</h3>
        <p className="mt-1 text-xs text-muted-foreground">Unique assets touched and saves per day (UTC)</p>
        <div className="mt-4 h-64">
          {activityByDay.length === 0 ? (
            <EmptyChart message="No daily activity in this range." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ede9e0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="uniqueAssetsTouched" name="Assets touched" stroke="#1a2540" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="saves" name="Saves" stroke="#c07c0a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Field mix (unique assets)</h3>
        <p className="mt-1 text-xs text-muted-foreground">Share of assets touched by field</p>
        <div className="mt-4 h-64">
          {pieData.length === 0 ? (
            <EmptyChart message="No field changes in this range." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
        <h3 className="text-sm font-medium text-foreground">Field breakdown</h3>
        <p className="mt-1 text-xs text-muted-foreground">Unique assets vs save events per field</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ede9e0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Legend />
              <Bar dataKey="uniqueAssets" name="Unique assets" fill="#1a2540" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saves" name="Saves" fill="#c07c0a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{message}</div>
}
