import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function UsageChartImplementation({ rows }) {
  const chartRows = rows.map((row) => {
    const date = new Date(row.usage_date);
    return {
      ...row,
      label: Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', timeZone: 'UTC'
      })
    };
  });
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
    <defs><linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5b78e8" stopOpacity={0.22}/><stop offset="100%" stopColor="#5b78e8" stopOpacity={0.01}/></linearGradient></defs>
    <CartesianGrid stroke="#edf0f5" vertical={false}/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b94a6', fontSize: 11 }}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8b94a6', fontSize: 11 }}/>
    <Tooltip contentStyle={{ border: '1px solid #e7eaf0', borderRadius: 12, boxShadow: '0 10px 30px #101a2a12' }}/>
    <Area type="monotone" dataKey="admitted_requests" name="Admitted" stroke="#5b78e8" strokeWidth={2.5} fill="url(#usageFill)"/>
    <Area type="monotone" dataKey="rejected_requests" name="Rejected" stroke="#f09a6b" strokeWidth={2} fill="transparent"/>
  </AreaChart></ResponsiveContainer>;
}
