import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import App from '../App.jsx';

export function renderApp(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function dashboardPayload(path) {
  if (path.endsWith('/analytics/summary')) return { summary: { total_requests: 24, admitted_requests: 22, rejected_requests: 2, admission_rate_percent: '91.67' } };
  if (path.includes('/analytics/daily')) return { dailyUsage: [{ usage_date: '2026-11-17', admitted_requests: 8, rejected_requests: 1, total_requests: 9 }] };
  if (path.includes('/analytics/recent')) return { activity: [] };
  if (path.endsWith('/analytics/keys')) return { apiKeys: [] };
  if (path.endsWith('/keys')) return [];
  if (path.endsWith('/plans')) return { plans: [] };
  return null;
}
