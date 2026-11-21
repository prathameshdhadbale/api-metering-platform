import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { once } from 'node:events';
import { closeTestEnvironment, getTestApp, resetTestDatabase, waitForUsageEvents } from '../../../tests/helpers/database.js';
import { renderApp } from './renderApp.jsx';

let server;
let origin;
let nativeFetch;

beforeAll(async () => {
  await resetTestDatabase();
  const app = await getTestApp();
  server = app.listen(0, '127.0.0.1');
  if (!server.listening) await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  nativeFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (url, options) => nativeFetch(new URL(url, origin), options));
});

afterEach(cleanup);

afterAll(async () => {
  try {
    if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await resetTestDatabase();
  } finally {
    vi.unstubAllGlobals();
    await closeTestEnvironment();
  }
});

describe('dashboard against the live backend', () => {
  it('registers, creates a key, displays real metered analytics, and revokes the key', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn(() => true));
    renderApp('/register');

    await user.type(await screen.findByLabelText('Your name'), 'Live Workflow');
    await user.type(await screen.findByLabelText('Work email'), `live-${Date.now()}@example.test`);
    await user.type(await screen.findByLabelText('Password'), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/Good to see you, Live/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: /api keys/i })[0]);
    await user.click(await screen.findByRole('button', { name: /create api key/i }));
    await user.type(await screen.findByLabelText('Key name'), 'Live dashboard key');
    await user.selectOptions(await screen.findByLabelText('Subscription plan'), '1');
    await user.click(screen.getByRole('button', { name: /generate api key/i }));
    const rawKey = (await screen.findByText(/^[a-f0-9]{64}$/)).textContent;

    const metered = await nativeFetch(`${origin}/api/test`, { headers: { 'x-api-key': rawKey } });
    expect(metered.status).toBe(200);
    await waitForUsageEvents(1);

    await user.click(screen.getAllByRole('link', { name: /analytics/i })[0]);
    expect(await screen.findByRole('heading', { name: 'Usage analytics' })).toBeInTheDocument();
    expect(await screen.findAllByText('/api/test')).toHaveLength(2);
    expect(await screen.findAllByText('Live dashboard key')).toHaveLength(2);

    await user.click(screen.getAllByRole('link', { name: /api keys/i })[0]);
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('revoked', { selector: '.status-pill' })).toBeInTheDocument();
    const afterRevoke = await nativeFetch(`${origin}/api/test`, { headers: { 'x-api-key': rawKey } });
    expect(afterRevoke.status).toBe(401);
  });
});
