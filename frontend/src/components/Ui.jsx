import { Link } from 'react-router';
import Icon from './Icon.jsx';

export function Brand({ compact = false }) {
  return <Link className={`brand${compact ? ' brand-compact' : ''}`} to="/" aria-label="Meterline home">
    <span className="brand-mark"><span/><span/><span/></span>
    {!compact && <span>meterline</span>}
  </Link>;
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action && <div className="page-heading-action">{action}</div>}
  </div>;
}

export function Card({ children, className = '', title, action, ...props }) {
  return <section className={`card ${className}`} {...props}>
    {(title || action) && <div className="card-heading">{title && <h2>{title}</h2>}{action}</div>}
    {children}
  </section>;
}

export function LoadingState({ label = 'Loading data' }) {
  return <div className="loading-state" role="status"><span className="spinner"/><span>{label}</span></div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="error-state" role="alert"><span>{message}</span>{onRetry && <button className="button button-small button-quiet" onClick={onRetry}>Try again</button>}</div>;
}

export function EmptyState({ title, children, action }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="layers" size={22}/></div><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}

export function StatCard({ label, value, detail, icon, tone = 'blue' }) {
  return <div className="stat-card"><div className={`stat-icon tone-${tone}`}><Icon name={icon}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{detail && <div className="stat-detail">{detail}</div>}</div>;
}

export function StatusPill({ admitted, status }) {
  const isActive = status ? status === 'active' : admitted;
  const label = status || (admitted ? 'Admitted' : 'Rejected');
  return <span className={`status-pill ${isActive ? 'status-good' : 'status-muted'}`}><span/>{label}</span>;
}

export function ActivityTable({ rows = [], emptyTitle = 'No activity yet' }) {
  if (!rows.length) return <EmptyState title={emptyTitle}>Requests made with your API keys will appear here.</EmptyState>;
  return <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Endpoint</th><th>API key</th><th>Status</th><th>Latency</th><th>When</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}>
      <td><code>{row.endpoint}</code></td><td>{row.apiKeyName || row.apiKeyId}</td>
      <td><StatusPill admitted={row.admitted}/></td><td>{row.latencyMs} ms</td>
      <td>{formatRelative(row.createdAt)}</td>
    </tr>)}</tbody>
  </table></div>;
}

export function formatRelative(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatReset(value) {
  if (!value) return 'Starts with first request';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function usagePercent(used, total) {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}
