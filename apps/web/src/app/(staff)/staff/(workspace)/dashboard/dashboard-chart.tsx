"use client"

import { useEffect, useRef, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts"

const CHART_HEIGHT = 250

export function DashboardChart({ total, approved }: { total: number; approved: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    function updateReady() {
      if (!element) return

      const { width, height } = element.getBoundingClientRect()
      setIsReady(width > 0 && height > 0)
    }

    updateReady()
    const observer = new ResizeObserver(updateReady)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

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
    },
  ]

  return (
    <div ref={containerRef} className="mt-4 h-[250px] w-full min-h-[250px] min-w-0">
      {isReady ? (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
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
              tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString())}
            />
            <Tooltip
              cursor={{ fill: "var(--color-staff-50)" }}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--color-staff-200)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--color-staff-950)",
              }}
              formatter={(value) => [Number(value).toLocaleString(), "Assets"]}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
