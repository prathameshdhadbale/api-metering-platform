import { Card, PageHeading } from '../components/Ui.jsx';
import Icon from '../components/Icon.jsx';

const requestExample = `curl -X GET http://localhost:3000/api/test \\
  -H "x-api-key: YOUR_API_KEY"`;

const successExample = `{
  "message": "Request accepted",
  "apiKeyId": 42,
  "ownerId": 7,
  "planId": 1,
  "rateLimit": { "limit": 200, "remaining": 199 },
  "dailyQuota": { "limit": 1000, "remaining": 999 }
}`;

const rejectedExample = `{
  "error": "Rate limit exceeded",
  "limit": 200,
  "remaining": 0,
  "resetAt": "2026-11-18T12:00:00.000Z"
}`;

export default function ApiGuidePage() {
  return <>
    <PageHeading eyebrow="DEVELOPERS · REFERENCE" title="API guide" description="Authenticate requests and understand how usage limits are applied." action={<a href="https://github.com/prathameshdhadbale/api-metering-platform" target="_blank" rel="noreferrer" className="button button-secondary">Project repository <Icon name="arrow" size={15}/></a>}/>
    <div className="guide-grid">
      <Card className="guide-main" title="Authenticate with an API key">
        <p className="guide-copy">Send the key in the <code>x-api-key</code> request header. Keys are shown only once at creation and are stored as hashes, so keep a secure copy before closing the one-time notice.</p>
        <div className="code-label">REQUEST</div><pre className="code-block"><code>{requestExample}</code><button className="code-copy" aria-label="Copy request example" onClick={() => navigator.clipboard?.writeText(requestExample)}><Icon name="copy" size={15}/></button></pre>
        <div className="code-label">SUCCESS · 200 OK</div><pre className="code-block"><code>{successExample}</code></pre>
        <div className="code-label">LIMIT EXCEEDED · 429 TOO MANY REQUESTS</div><pre className="code-block code-block-warn"><code>{rejectedExample}</code></pre>
      </Card>
      <aside className="guide-aside">
        <Card title="Request headers"><div className="header-reference"><code>x-api-key</code><span>Your generated API key</span></div><div className="header-reference"><code>Accept</code><span>application/json</span></div></Card>
        <Card title="How limits work"><div className="guide-rule"><span>01</span><div><strong>Rolling six-hour window</strong><p>Starts when the first request is admitted. Each key has an independent window.</p></div></div><div className="guide-rule"><span>02</span><div><strong>Daily quota</strong><p>Counts admitted requests and resets at midnight UTC.</p></div></div><div className="guide-rule"><span>03</span><div><strong>Both limits apply</strong><p>A request is admitted only when both limits have capacity. Rejected requests do not consume either counter.</p></div></div></Card>
        <div className="guide-security"><Icon name="key"/><div><strong>Protect your key</strong><p>Never commit a key to source control or send it to an untrusted client.</p></div></div>
      </aside>
    </div>
  </>;
}
