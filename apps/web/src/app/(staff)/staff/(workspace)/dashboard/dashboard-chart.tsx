"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts"

export function DashboardChart({ total, approved }: { total: number; approved: number }) {
  const data = [
    {
      name: "Total",
      value: total,
      fill: "var(--color-staff-200)",
    },
    {
      name: "Approved",
      value: approved,
      fill: "var(--color-staff-900)",
    }
  ]

  return (
    <div className="h-[250px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-staff-100)" />
          <XAxis 
            dataKey="name" 
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-staff-500)", fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-staff-500)", fontSize: 12 }}
            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()}
          />
          <Tooltip 
            cursor={{ fill: "var(--color-staff-50)" }}
            contentStyle={{ 
              borderRadius: "8px", 
              border: "1px solid var(--color-staff-200)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--color-staff-950)"
            }}
            formatter={(value: number) => [value.toLocaleString(), "Assets"]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
