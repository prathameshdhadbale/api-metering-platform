import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, jsonResponse, dashboardPayload } from './renderApp.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function loginResponse() {
  return jsonResponse({ id: 12, name: 'Jordan Kim', email: 'jordan@example.test', token: 'session-token' });
}

async function signIn(user) {
  await user.type(await screen.findByLabelText('Work email'), 'jordan@example.test');
  await user.type(await screen.findByLabelText('Password'), 'long-enough-password');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  await screen.findByText('24');
}

describe('dashboard integration states', () => {
  it('shows loading and API error states with a retry action', async () => {
    const user = userEvent.setup();
    let fail = true;
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const path = String(url);
      if (path.endsWith('/auth/login')) return loginResponse();
      if (path.endsWith('/analytics/summary') && fail) return jsonResponse({ error: 'Analytics service unavailable' }, 500);
      return jsonResponse(dashboardPayload(path) ?? []);
    }));
    renderApp('/login');
    await user.type(await screen.findByLabelText('Work email'), 'jordan@example.test');
    await user.type(await screen.findByLabelText('Password'), 'long-enough-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics service unavailable');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('24')).toBeInTheDocument();
  });

  it('renders real analytics results and date-range options', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const path = String(url);
      if (path.endsWith('/auth/login')) return loginResponse();
      if (path.endsWith('/analytics/summary')) return jsonResponse({ summary: { total_requests: 24, admitted_requests: 22, rejected_requests: 2, admission_rate_percent: '91.67' } });
      if (path.includes('/analytics/daily')) return jsonResponse({ dailyUsage: [{ usage_date: '2026-11-17', total_requests: 10, admitted_requests: 8, rejected_requests: 2 }] });
      if (path.endsWith('/analytics/keys')) return jsonResponse({ apiKeys: [{ api_key_id: 4, api_key_name: 'Production', key_prefix: 'a1b2c3d4', status: 'active', total_requests: 10, admitted_requests: 8, rejected_requests: 2 }] });
      if (path.endsWith('/analytics/endpoints')) return jsonResponse({ endpoints: [{ endpoint: '/api/test', total_requests: 10, admitted_requests: 8, rejected_requests: 2, average_latency_ms: '12.5', max_latency_ms: 22 }] });
      if (path.endsWith('/analytics/recent')) return jsonResponse({ activity: [{ id: '1', endpoint: '/api/test', apiKeyId: 4, apiKeyName: 'Production', statusCode: 200, latencyMs: 12, admitted: true, createdAt: '2026-11-17T10:00:00.000Z' }] });
      return jsonResponse([]);
    }));
    renderApp('/login');
    await signIn(user);
    await user.click(screen.getAllByRole('link', { name: /analytics/i })[0]);
    expect(await screen.findByRole('heading', { name: 'Usage analytics' })).toBeInTheDocument();
    expect(await screen.findByText('/api/test')).toBeInTheDocument();
    expect(screen.getByLabelText('Date range')).toHaveValue('30');
    await user.selectOptions(screen.getByLabelText('Date range'), '7');
    expect(screen.getByLabelText('Date range')).toHaveValue('7');
  });

  it('creates and revokes a key, showing the raw secret only in the creation notice', async () => {
    const user = userEvent.setup();
    const rawKey = 'raw-key-visible-once';
    let keys = [];
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const path = String(url);
      const method = options.method || 'GET';
      if (path.endsWith('/auth/login')) return loginResponse();
      if (path.endsWith('/plans')) return jsonResponse({ plans: [{ id: 2, name: 'Premium', dailyQuota: 50000, rateLimit: { requests: 1000, windowSeconds: 21600 } }] });
      if (path.endsWith('/keys') && method === 'GET') return jsonResponse(keys);
      if (path.endsWith('/keys') && method === 'POST') {
        const body = JSON.parse(options.body);
        keys = [{ id: 8, name: body.name, key_prefix: '0a1b2c3d', plan_id: body.planId, plan_name: 'Premium', status: 'active', daily_quota: 50000, daily_used: 0, daily_remaining: 50000, rate_limit_requests: 1000, rate_limit_used: 0, rate_limit_remaining: 1000, created_at: '2026-11-17T10:00:00Z' }];
        return jsonResponse({ key: rawKey, apiKeyDetails: { id: 8 } }, 201);
      }
      if (path.endsWith('/keys/8/revoke') && method === 'PATCH') {
        keys = [{ ...keys[0], status: 'revoked' }];
        return jsonResponse({ id: 8, status: 'revoked' });
      }
      return jsonResponse(dashboardPayload(path) ?? []);
    }));

    renderApp('/login');
    await signIn(user);
    await user.click(screen.getAllByRole('link', { name: /api keys/i })[0]);
    await user.click(await screen.findByRole('button', { name: /create api key/i }));
    await user.type(screen.getByLabelText('Key name'), 'Production worker');
    await user.selectOptions(screen.getByLabelText('Subscription plan'), '2');
    await user.click(screen.getByRole('button', { name: /generate api key/i }));
    expect(await screen.findByText(rawKey)).toBeInTheDocument();
    expect(screen.getByText(/only shown once/i)).toBeInTheDocument();
    expect(await screen.findByText('Production worker')).toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('revoked', { selector: '.status-pill' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText(rawKey)).not.toBeInTheDocument();
  });
});
