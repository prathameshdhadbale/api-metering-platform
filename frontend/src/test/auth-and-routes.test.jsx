import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, jsonResponse, dashboardPayload } from './renderApp.jsx';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('authentication and protected routes', () => {
  it('redirects a signed-out user to login when opening a protected route', async () => {
    renderApp('/analytics');
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Work email')).toBeInTheDocument();
  });

  it('validates the login form and signs in against the real API contract', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url, options = {}) => {
      const path = String(url);
      if (path.endsWith('/auth/login')) return jsonResponse({ id: 4, name: 'Riley Morgan', email: 'riley@example.test', token: 'memory-token' });
      const payload = dashboardPayload(path);
      return jsonResponse(payload ?? { keys: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp('/login');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
    await user.type(screen.getByLabelText('Work email'), 'riley@example.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('24')).toBeInTheDocument();
    expect(screen.getByText(/Good to see you, Riley/i)).toBeInTheDocument();
    const loginCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/login'));
    expect(loginCall[1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(loginCall[1].body)).toEqual({ email: 'riley@example.test', password: 'correct-horse-battery-staple' });
    const summaryCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/analytics/summary'));
    expect(summaryCall[1].headers.Authorization).toBe('Bearer memory-token');
  });

  it('registers, signs in, and keeps credentials only in the live session', async () => {
    const user = userEvent.setup();
    const calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      const path = String(url);
      calls.push([path, options]);
      if (path.endsWith('/auth/register')) return jsonResponse({ id: 7, name: 'Sam Lee', email: 'sam@example.test' }, 201);
      if (path.endsWith('/auth/login')) return jsonResponse({ id: 7, name: 'Sam Lee', email: 'sam@example.test', token: 'temporary-jwt' });
      return jsonResponse(dashboardPayload(path) ?? { keys: [] });
    }));
    renderApp('/register');
    await user.type(await screen.findByLabelText('Your name'), 'Sam Lee');
    await user.type(await screen.findByLabelText('Work email'), 'sam@example.test');
    await user.type(await screen.findByLabelText('Password'), 'long-enough-password');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('24')).toBeInTheDocument();
    expect(calls.some(([url]) => url.endsWith('/auth/register'))).toBe(true);
    expect(calls.some(([url]) => url.endsWith('/auth/login'))).toBe(true);
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('returns to login when the API reports an expired session', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const path = String(url);
      if (path.endsWith('/auth/login')) return jsonResponse({ id: 4, name: 'Riley', email: 'riley@example.test', token: 'expired' });
      if (path.endsWith('/analytics/summary')) return jsonResponse({ error: 'Invalid or expired token' }, 401);
      return jsonResponse(dashboardPayload(path) ?? { keys: [] });
    }));
    renderApp('/login');
    await user.type(await screen.findByLabelText('Work email'), 'riley@example.test');
    await user.type(await screen.findByLabelText('Password'), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
  });
});
