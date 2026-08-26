interface KPICardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export default function KPICard({ label, value, sub, accent = false }: KPICardProps) {
  return (
    <div className="gk-kpi">
      <span className="gk-kpi-label">{label}</span>
      <span className={`gk-kpi-val${accent ? ' amber' : ''}`}>{value}</span>
      {sub && <span className="gk-kpi-sub">{sub}</span>}
    </div>
  )
}
