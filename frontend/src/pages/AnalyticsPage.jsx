import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ActivityTable, Card, EmptyState, ErrorState, LoadingState, PageHeading, usagePercent } from '../components/Ui.jsx';
import UsageChart from '../components/UsageChart.jsx';
import { useResource } from '../hooks/useResource.js';

export default function AnalyticsPage() {
  const { api } = useAuth();
  const [days, setDays] = useState(30);
  const load = useCallback(async () => {
    const [dailyResult, keysResult, endpointsResult, activityResult] = await Promise.all([
      api.get(`/analytics/daily?days=${days}`), api.get('/analytics/keys'),
      api.get('/analytics/endpoints'), api.get('/analytics/recent?limit=10')
    ]);
    return { daily: dailyResult.dailyUsage, keys: keysResult.apiKeys, endpoints: endpointsResult.endpoints, activity: activityResult.activity };
  }, [api, days]);
  const { data, loading, error, reload } = useResource(load);

  return <>
    <PageHeading eyebrow="INSIGHTS · PERFORMANCE" title="Usage analytics" description="Understand request volume, adoption, and endpoint performance." action={<label className="filter-control"><span>Date range</span><select aria-label="Date range" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>}/>
    {loading ? <LoadingState label="Loading usage analytics"/> : error ? <ErrorState message={error} onRetry={reload}/> : <>
      <Card className="chart-card analytics-chart-card" title="Daily requests" action={<span className="card-caption">UTC calendar days</span>}>
        <div className="chart-legend"><span><i className="legend-blue"/> Admitted</span><span><i className="legend-orange"/> Rejected</span></div>
        <UsageChart rows={data.daily} height={310}/>
      </Card>
      <div className="analytics-grid">
        <Card title="Usage by API key" className="analytics-table-card">
          {data.keys.length ? <div className="analytics-key-list">{data.keys.map((key) => {
            const percent = usagePercent(key.admitted_requests, key.total_requests);
            return <div className="analytics-key-row" key={key.api_key_id}><div className="analytics-key-copy"><span><strong>{key.api_key_name}</strong><code>{key.key_prefix}••••</code></span><span className="analytics-key-total">{Number(key.total_requests).toLocaleString()}<small> total</small></span></div><div className="micro-track"><span style={{ width: `${percent}%` }}/></div><div className="analytics-key-meta"><span>{Number(key.admitted_requests).toLocaleString()} admitted · {Number(key.rejected_requests).toLocaleString()} rejected</span><span>{key.status}</span></div></div>;
          })}</div> : <EmptyState title="No keys to analyze">Create an API key to start collecting usage data.</EmptyState>}
        </Card>
        <Card title="Usage by endpoint" className="analytics-table-card">
          {data.endpoints.length ? <div className="endpoint-list">{data.endpoints.map((endpoint) => <div className="endpoint-row" key={endpoint.endpoint}><div className="endpoint-name"><code>{endpoint.endpoint}</code><span>{Number(endpoint.total_requests).toLocaleString()} requests</span></div><div className="endpoint-latency"><strong>{Number(endpoint.average_latency_ms).toFixed(1)}<small> ms avg</small></strong><span>{Number(endpoint.max_latency_ms).toLocaleString()} ms max</span></div><div className="endpoint-split"><span>{Number(endpoint.admitted_requests).toLocaleString()} admitted</span><span>{Number(endpoint.rejected_requests).toLocaleString()} rejected</span></div></div>)}</div> : <EmptyState title="No endpoint activity">Authenticated requests will be grouped here.</EmptyState>}
        </Card>
      </div>
      <Card className="activity-card" title="Recent activity" action={<span className="card-caption">Latest 10 requests</span>}><ActivityTable rows={data.activity}/></Card>
    </>}
  </>;
}
