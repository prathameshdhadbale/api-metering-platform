import { useCallback } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { Card, EmptyState, ErrorState, LoadingState, PageHeading, formatReset } from '../components/Ui.jsx';
import QuotaMeter from '../components/QuotaMeter.jsx';
import Icon from '../components/Icon.jsx';
import { useResource } from '../hooks/useResource.js';

export default function PlansPage() {
  const { api } = useAuth();
  const load = useCallback(async () => {
    const [keys, result] = await Promise.all([api.get('/keys'), api.get('/plans')]);
    return { keys, plans: result.plans };
  }, [api]);
  const { data, loading, error, reload } = useResource(load);

  return <>
    <PageHeading eyebrow="CAPACITY · LIMITS" title="Plans & quotas" description="Plan limits and remaining capacity are read directly from your account." action={<Link to="/keys" className="button button-secondary">Manage API keys <Icon name="arrow" size={16}/></Link>}/>
    {loading ? <LoadingState label="Loading plan and quota details"/> : error ? <ErrorState message={error} onRetry={reload}/> : <>
      <Card className="current-plan-card" title="Current usage by key" action={<span className="card-caption">Quota resets at midnight UTC</span>}>
        {data.keys.length ? <div className="quota-key-grid">{data.keys.map((key) => <article className="quota-key-card" key={key.id}>
          <div className="quota-key-heading"><span className="key-plan-icon"><Icon name="key" size={16}/></span><div><h3>{key.name}</h3><span>{key.plan_name} plan · <code>{key.key_prefix}••••</code></span></div><span className={`key-state ${key.status === 'active' ? 'key-state-active' : ''}`}>{key.status}</span></div>
          <div className="quota-number-row"><div><small>Remaining today</small><strong>{Number(key.daily_remaining).toLocaleString()} <span>/ {Number(key.daily_quota).toLocaleString()}</span></strong></div><div className="quota-reset"><small>Daily reset</small><strong>{formatReset(key.daily_reset_at)}</strong></div></div>
          <QuotaMeter label="Daily quota" used={key.daily_used} limit={key.daily_quota} resetAt={key.daily_reset_at} detail={`${Number(key.daily_remaining).toLocaleString()} remaining`}/>
          <QuotaMeter label="Rolling six-hour limit" used={key.rate_limit_used} limit={key.rate_limit_requests} resetAt={key.rate_limit_reset_at} detail={`${Number(key.rate_limit_remaining).toLocaleString()} remaining`}/>
        </article>)}</div> : <EmptyState title="No active usage yet" action={<Link className="button button-primary" to="/keys"><Icon name="plus"/> Create an API key</Link>}>Quota information appears after you create a key.</EmptyState>}
      </Card>
      <Card className="plans-catalog" title="Available plans" action={<span className="card-caption">Values supplied by the API</span>}>
        <div className="plan-catalog-grid">{data.plans.map((plan, index) => <article key={plan.id} className={`plan-catalog-card${index === 1 ? ' plan-featured' : ''}`}>
          <div className="plan-catalog-top"><span className="plan-symbol"><Icon name="layers"/></span>{index === 1 && <span className="popular-label">HIGHER CAPACITY</span>}</div>
          <h3>{plan.name}</h3><p>{plan.name === 'Free' ? 'A clear starting point for your integration.' : 'More room for production workloads.'}</p>
          <div className="plan-limit"><strong>{Number(plan.rateLimit.requests).toLocaleString()}</strong><span>requests / rolling {Math.round(plan.rateLimit.windowSeconds / 3600)} hours</span></div>
          <div className="plan-limit"><strong>{Number(plan.dailyQuota).toLocaleString()}</strong><span>requests per UTC day</span></div>
          <Link className="plan-link" to="/keys">Use this plan <Icon name="arrow" size={15}/></Link>
        </article>)}</div>
      </Card>
    </>}
  </>;
}
