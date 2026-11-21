import { formatReset, usagePercent } from './Ui.jsx';

export default function QuotaMeter({ label, used, limit, resetAt, detail }) {
  const percentage = usagePercent(used, limit);
  return <div className="quota-meter">
    <div className="quota-meter-top"><div><strong>{label}</strong><span>{detail}</span></div><strong>{percentage}%</strong></div>
    <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={limit} aria-valuenow={used}>
      <span style={{ width: `${percentage}%` }}/>
    </div>
    <div className="quota-meter-bottom"><span>{Number(used).toLocaleString()} used of {Number(limit).toLocaleString()}</span><span>Resets {formatReset(resetAt)}</span></div>
  </div>;
}
