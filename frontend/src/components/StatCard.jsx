export function StatCard({ title, value, meta, icon: Icon, iconBg = '#eff6ff', iconColor = '#0284c7' }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{title}</span>
        {Icon && (
          <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>
            <Icon size={19} />
          </div>
        )}
      </div>
      <div className="kpi-value tabular">{value}</div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}
