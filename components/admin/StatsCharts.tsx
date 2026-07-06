'use client'

import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

interface StatsChartsProps {
  monthlyRevenue: { label: string; total: number }[]
  statusCounts: Record<string, number>
}

const STATUS_COLORS: Record<string, string> = {
  pending:   '#7A6E5C',
  paid:      '#D4900C',
  preparing: '#F0AB24',
  shipped:   '#4ade80',
  delivered: '#22c55e',
  cancelled: '#f87171',
  refunded:  '#ef4444',
}

export default function StatsCharts({ monthlyRevenue, statusCounts }: StatsChartsProps) {
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CA mensuel */}
      <div className="card">
        <h3 className="text-sm font-medium text-cream mb-4">Chiffre d&apos;affaires (6 mois)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyRevenue}>
            <defs>
              <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#D4900C" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#D4900C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: '#7A6E5C', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#7A6E5C', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
            <Tooltip
              contentStyle={{ background: '#141108', border: '1px solid rgba(212,144,12,0.18)', borderRadius: 6 }}
              labelStyle={{ color: '#EEE4CC', fontSize: 12 }}
              itemStyle={{ color: '#D4900C', fontSize: 12 }}
              formatter={(v) => [`${Number(v).toFixed(2)} €`, 'CA']}
            />
            <Area type="monotone" dataKey="total" stroke="#D4900C" strokeWidth={2} fill="url(#amberGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Commandes par statut */}
      <div className="card">
        <h3 className="text-sm font-medium text-cream mb-4">Commandes par statut</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#7A6E5C'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#141108', border: '1px solid rgba(212,144,12,0.18)', borderRadius: 6 }}
                itemStyle={{ color: '#EEE4CC', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-muted text-sm">Aucune commande</div>
        )}
      </div>
    </div>
  )
}
