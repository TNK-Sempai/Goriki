interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export default function KPICard({ label, value, sub, accent = false }: KPICardProps) {
  return (
    <div className="admin-kpi">
      <span className="admin-kpi-label">{label}</span>
      <span className={`admin-kpi-val${accent ? ' amber' : ''}`}>{value}</span>
      {sub && <span className="admin-kpi-sub">{sub}</span>}
    </div>
  )
}
