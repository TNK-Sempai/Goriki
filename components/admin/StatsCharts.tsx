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
  pending:   '#6b665f',
  paid:      '#c8f060',
  preparing: '#dcf78f',
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
      <div className="gk-panneau" style={{ padding: 18 }}>
        <h3 className="gk-label" style={{ display: 'block', marginBottom: 14 }}>Chiffre d&apos;affaires (6 mois)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyRevenue}>
            <defs>
              <linearGradient id="gkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c8f060" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c8f060" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fill: '#6b665f', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b665f', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
            <Tooltip
              contentStyle={{ background: '#0e0e15', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6 }}
              labelStyle={{ color: '#ede8df', fontSize: 12 }}
              itemStyle={{ color: '#c8f060', fontSize: 12 }}
              formatter={(v) => [`${Number(v).toFixed(2)} €`, 'CA']}
            />
            <Area type="monotone" dataKey="total" stroke="#c8f060" strokeWidth={2} fill="url(#gkGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Commandes par statut */}
      <div className="gk-panneau" style={{ padding: 18 }}>
        <h3 className="gk-label" style={{ display: 'block', marginBottom: 14 }}>Commandes par statut</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#6b665f'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0e0e15', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 6 }}
                itemStyle={{ color: '#ede8df', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="gk-vide" style={{ height: 220 }}>Aucune commande</div>
        )}
      </div>
    </div>
  )
}
