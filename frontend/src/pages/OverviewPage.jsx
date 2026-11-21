import { useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { ActivityTable, Card, EmptyState, ErrorState, LoadingState, PageHeading, StatCard } from '../components/Ui.jsx';
import UsageChart from '../components/UsageChart.jsx';
import QuotaMeter from '../components/QuotaMeter.jsx';
import Icon from '../components/Icon.jsx';
import { useResource } from '../hooks/useResource.js';

export default function OverviewPage() {
  const { api, user } = useAuth();
  const load = useCallback(async () => {
    const [summaryResult, dailyResult, activityResult, keyResult] = await Promise.all([
      api.get('/analytics/summary'), api.get('/analytics/daily?days=7'),
      api.get('/analytics/recent?limit=6'), api.get('/keys')
    ]);
    return { summary: summaryResult.summary, daily: dailyResult.dailyUsage, activity: activityResult.activity, keys: keyResult };
  }, [api]);
  const { data, loading, error, reload } = useResource(load);

  return <>
    <PageHeading eyebrow="OVERVIEW · API USAGE" title={`Good to see you${user?.name ? `, ${user.name.split(' ')[0]}` : ''}.`} description="Here's what's happening across your API keys." action={<Link className="button button-primary" to="/keys"><Icon name="plus"/> Create API key</Link>}/>
    {loading ? <LoadingState label="Loading your usage overview"/> : error ? <ErrorState message={error} onRetry={reload}/> : <>
      <div className="stats-grid">
        <StatCard label="Total requests" value={Number(data.summary.total_requests).toLocaleString()} detail="All time across your keys" icon="chart" tone="blue"/>
        <StatCard label="Admitted" value={Number(data.summary.admitted_requests).toLocaleString()} detail="Requests served successfully" icon="check" tone="green"/>
        <StatCard label="Rejected" value={Number(data.summary.rejected_requests).toLocaleString()} detail="Requests over a configured limit" icon="close" tone="amber"/>
        <StatCard label="Admission rate" value={`${Number(data.summary.admission_rate_percent).toFixed(1)}%`} detail="Admitted requests / all requests" icon="layers" tone="violet"/>
      </div>
      <div className="overview-grid">
        <Card className="chart-card" title="Request volume" action={<span className="card-caption">Last 7 days · UTC</span>}>
          <div className="chart-legend"><span><i className="legend-blue"/> Admitted</span><span><i className="legend-orange"/> Rejected</span></div>
          <UsageChart rows={data.daily} height={250}/>
        </Card>
        <Card className="quota-card" title="Plan & quota">
          {data.keys.length ? <div className="overview-quota-list">{data.keys.slice(0, 2).map((key) => <div className="overview-key-quota" key={key.id}>
            <div className="key-plan-heading"><span className="key-plan-icon"><Icon name="key" size={15}/></span><span><strong>{key.name}</strong><small>{key.plan_name} plan</small></span></div>
            <QuotaMeter label="Six-hour limit" used={key.rate_limit_used} limit={key.rate_limit_requests} resetAt={key.rate_limit_reset_at} detail={`${key.rate_limit_remaining} left`}/>
            <QuotaMeter label="Daily quota" used={key.daily_used} limit={key.daily_quota} resetAt={key.daily_reset_at} detail={`${key.daily_remaining} left`}/>
          </div>)}</div> : <EmptyState title="No API keys yet">Create a key to see plan limits and live quota usage.</EmptyState>}
        </Card>
      </div>
      <Card className="activity-card" title="Recent API activity" action={<Link className="text-link" to="/analytics">View analytics <Icon name="arrow" size={15}/></Link>}>
        <ActivityTable rows={data.activity}/>
      </Card>
      <Card className="key-summary-card" title="API key usage" action={<Link className="text-link" to="/keys">Manage keys <Icon name="arrow" size={15}/></Link>}>
        {data.keys.length ? <div className="key-summary-list">{data.keys.slice(0, 4).map((key) => <div className="key-summary-row" key={key.id}><span className="key-summary-icon"><Icon name="key" size={16}/></span><span className="key-summary-name"><strong>{key.name}</strong><small>{key.key_prefix}•••• · {key.plan_name}</small></span><span className="key-summary-usage">{Number(key.daily_used).toLocaleString()} <small>today</small></span><span className="key-summary-state"><i className={key.status === 'active' ? 'state-active' : ''}/>{key.status}</span></div>)}</div> : <EmptyState title="Nothing to summarize">Your key usage will show here once you create a key.</EmptyState>}
      </Card>
    </>}
  </>;
}
