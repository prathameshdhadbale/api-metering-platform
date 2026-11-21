import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Card, EmptyState, ErrorState, LoadingState, PageHeading, StatusPill, formatRelative } from '../components/Ui.jsx';
import Icon from '../components/Icon.jsx';
import { useResource } from '../hooks/useResource.js';

export default function KeysPage() {
  const { api } = useAuth();
  const load = useCallback(async () => {
    const [keys, planResult] = await Promise.all([api.get('/keys'), api.get('/plans')]);
    return { keys, plans: planResult.plans };
  }, [api]);
  const { data, loading, error, reload } = useResource(load);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', planId: '' });
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revealedKey, setRevealedKey] = useState('');
  const [copied, setCopied] = useState(false);

  async function createKey(event) {
    event.preventDefault();
    setActionError('');
    const name = form.name.trim();
    if (name.length < 3 || name.length > 50) return setActionError('Key name must be between 3 and 50 characters.');
    if (!form.planId) return setActionError('Choose a subscription plan.');
    setSubmitting(true);
    try {
      const result = await api.post('/keys', { name, planId: Number(form.planId) });
      setRevealedKey(result.key);
      setCopied(false);
      setCreating(false);
      setForm({ name: '', planId: '' });
      await reload();
    } catch (requestError) { setActionError(requestError.message); }
    finally { setSubmitting(false); }
  }

  async function revokeKey(key) {
    if (!window.confirm(`Revoke “${key.name}”? Requests using this key will stop working.`)) return;
    setActionError('');
    try { await api.patch(`/keys/${key.id}/revoke`); await reload(); }
    catch (requestError) { setActionError(requestError.message); }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
    } catch { setActionError('Clipboard access is unavailable. Select and copy the key manually.'); }
  }

  return <>
    <PageHeading eyebrow="ACCESS · CREDENTIALS" title="API keys" description="Create and manage credentials for your applications." action={<button className="button button-primary" onClick={() => { setActionError(''); setCreating((value) => !value); }}><Icon name={creating ? 'close' : 'plus'}/>{creating ? 'Close form' : 'Create API key'}</button>}/>
    {actionError && <div className="inline-alert" role="alert">{actionError}</div>}
    {revealedKey && <Card className="new-key-card" title={<span className="success-heading"><Icon name="check"/> API key created</span>} action={<button className="icon-button" onClick={() => setRevealedKey('')} aria-label="Dismiss key notice"><Icon name="close"/></button>}>
      <div className="one-time-warning"><span className="warning-mark">!</span><span><strong>Copy this key now.</strong> For your security, the full key is only shown once. It will disappear when you leave this page.</span></div>
      <div className="revealed-key-row"><code>{revealedKey}</code><button className="button button-secondary button-small" onClick={copyKey}><Icon name={copied ? 'check' : 'copy'}/>{copied ? 'Copied' : 'Copy key'}</button></div>
    </Card>}
    {creating && data && <Card className="create-key-card" title="Create a key" action={<span className="card-caption">The key is shown once after creation</span>}>
      <form className="create-key-form" onSubmit={createKey}>
        <div className="form-control"><label htmlFor="key-name">Key name</label><input id="key-name" minLength="3" maxLength="50" placeholder="e.g. Production service" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required/><small>Use a name that helps you identify where this key is used.</small></div>
        <div className="form-control"><label htmlFor="key-plan">Subscription plan</label><select id="key-plan" value={form.planId} onChange={(event) => setForm({ ...form, planId: event.target.value })} required><option value="">Select a plan</option>{data.plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · {Number(plan.dailyQuota).toLocaleString()} daily requests</option>)}</select><small>Limits are provided by your account's plan catalog.</small></div>
        <button className="button button-primary create-submit" disabled={submitting}>{submitting ? 'Creating…' : 'Generate API key'} <Icon name="arrow" size={16}/></button>
      </form>
    </Card>}
    {loading ? <LoadingState label="Loading API keys"/> : error ? <ErrorState message={error} onRetry={reload}/> : <Card className="keys-card" title={`Your keys · ${data.keys.length}`} action={<span className="card-caption">Secrets are never stored in the browser</span>}>
      {data.keys.length ? <div className="table-scroll"><table className="data-table keys-table">
        <thead><tr><th>Name</th><th>Plan</th><th>Usage today</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{data.keys.map((key) => <tr key={key.id}>
          <td><div className="key-name-cell"><span className="key-cell-icon"><Icon name="key" size={15}/></span><span><strong>{key.name}</strong><code>{key.key_prefix}••••••••</code></span></div></td>
          <td><span className="plan-chip">{key.plan_name}</span></td>
          <td><span className="usage-cell">{Number(key.daily_used).toLocaleString()} <small>/ {Number(key.daily_quota).toLocaleString()}</small></span></td>
          <td><StatusPill status={key.status}/></td><td>{formatRelative(key.created_at)}</td>
          <td>{key.status === 'active' ? <button className="button button-quiet button-small revoke-button" onClick={() => revokeKey(key)}>Revoke</button> : <span className="revoked-label">Revoked</span>}</td>
        </tr>)}</tbody>
      </table></div> : <EmptyState title="Your API keys will live here" action={<button className="button button-primary" onClick={() => setCreating(true)}><Icon name="plus"/> Create your first key</button>}>Create a key to authenticate requests to your API.</EmptyState>}
    </Card>}
    <div className="security-note"><Icon name="key" size={17}/><span><strong>Keep your keys private.</strong> Keys grant access to your API quota. Revoke any key you no longer use.</span></div>
  </>;
}
