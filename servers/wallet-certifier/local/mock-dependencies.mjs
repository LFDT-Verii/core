import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT ?? 14082);
const publicUrl = process.env.PUBLIC_URL ?? `http://localhost:${port}`;
const credentials = new Map();
const depotCredentials = new Map();
const exchanges = new Map();
const presentations = new Map();

const json = (response, statusCode, body) => {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

const html = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
  });
  response.end(body);
};

const bodyJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const jwtFor = (credential) => {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'ES256', typ: 'JWT' })}.${encode({ vc: credential })}.local-signature`;
};

const now = () => new Date().toISOString();

const exchangeFor = (depotId, phase) => {
  const exchange = {
    id: `exchange-${randomUUID()}`,
    depotId,
    serviceId:
      phase === 'issue'
        ? 'local-issuer-service'
        : 'local-relying-party-service',
    type: phase === 'issue' ? 'ISSUING' : 'DISCLOSURE',
    protocol: 'VN_API',
    state: 'NEW',
    events: [{ state: 'NEW', timestamp: now() }],
    credentialIds: phase === 'issue' ? [depotCredentials.get(depotId)] : [],
    presentationIds: [],
    createdAt: now(),
  };
  exchanges.set(depotId, exchange);
  return exchange;
};

const walletPage = (depotId, phase) => {
  const issueActions = `
    <button data-action="accept">Accept credential</button>
    <button class="secondary" data-action="reject">Reject credential</button>`;
  const disclosureActions = `
    <button data-action="share">Share credentials</button>
    <button class="secondary" data-action="share-without-setup">Share without setup badge</button>`;
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Local Test Wallet</title>
      <style>
        *{box-sizing:border-box}
        body{margin:0;background:#f4f0e7;color:#0d0d0c;font-family:Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
        main{width:min(580px,100%);border-top:1px solid #0d0d0c;border-bottom:1px solid #0d0d0c;padding:40px 0}
        small{font:700 10px monospace;letter-spacing:.12em;text-transform:uppercase}
        h1{font:400 clamp(48px,11vw,84px)/.92 Georgia,serif;letter-spacing:-.055em;margin:24px 0}p{color:#5f5b54;line-height:1.55;max-width:500px}
        nav{display:flex;flex-wrap:wrap;gap:10px;margin-top:32px}
        button{border:1px solid #0d0d0c;background:#0d0d0c;color:#fff;padding:15px 18px;font-weight:700;cursor:pointer}
        button.secondary{background:transparent;color:#0d0d0c}
        button:hover{background:#2cff84;color:#0d0d0c}
        #status{margin-top:24px;font:700 11px monospace;color:#0d0d0c}
      </style>
    </head>
    <body>
      <main>
        <small>Local wallet simulator / ${phase}</small>
        <h1>${phase === 'issue' ? 'Credential offer.' : 'Presentation request.'}</h1>
        <p>Choose a deterministic outcome. This simulator changes only the local Credentialing Hub state.</p>
        <nav>
          ${phase === 'issue' ? issueActions : disclosureActions}
          <button class="secondary" data-action="error">Raise exchange error</button>
        </nav>
        <div id="status" role="status"></div>
      </main>
      <script>
        document.querySelectorAll('button').forEach((button) => button.addEventListener('click', async () => {
          const response = await fetch('/scenario', {
            method: 'POST',
            headers: {'content-type':'application/json'},
            body: JSON.stringify({depotId:'${depotId}', phase:'${phase}', action:button.dataset.action})
          });
          const result = await response.json();
          document.getElementById('status').textContent = result.message;
          document.querySelectorAll('button').forEach((item) => { item.disabled = true; });
        }));
      </script>
    </body>
  </html>`;
};

const passingCredential = (jwt, w3cCredential) => ({
  format: 'JWT_VC',
  credential: jwt,
  w3cCredential,
  verified: true,
  tamperCheck: 'PASS',
  trustedIssuerCheck: 'PASS',
  trustedHolderCheck: 'PASS',
  revocationCheck: 'PASS',
  expiryCheck: 'PASS',
});

const acceptCredential = (depotId) => {
  const credentialId = depotCredentials.get(depotId);
  const credential = credentials.get(credentialId);
  const accepted = {
    ...credential,
    acceptedAt: now(),
    jwtVc: jwtFor(credential.content),
  };
  credentials.set(credentialId, accepted);
  const exchange = exchanges.get(depotId);
  exchanges.set(depotId, {
    ...exchange,
    state: 'COMPLETE',
    events: [...exchange.events, { state: 'COMPLETE', timestamp: now() }],
  });
};

const rejectCredential = (depotId) => {
  const credentialId = depotCredentials.get(depotId);
  const credential = credentials.get(credentialId);
  credentials.set(credentialId, {
    ...credential,
    rejectedAt: now(),
    rejectedReason: 'declined',
  });
};

const sharePresentation = (depotId, includeSetup) => {
  const setupCredential = credentials.get(depotCredentials.get(depotId));
  const setupJwt = includeSetup
    ? setupCredential.jwtVc
    : jwtFor({ ...setupCredential.content, id: 'different-setup-badge' });
  const otherContent = {
    id: `employment-${randomUUID()}`,
    type: ['VerifiableCredential', 'EmploymentCredential'],
    credentialSubject: { role: 'Wallet engineer' },
  };
  const presentation = {
    id: `presentation-${randomUUID()}`,
    depotId,
    scenarioCredentials: [
      {
        jwt: setupJwt,
        content: includeSetup
          ? setupCredential.content
          : { type: ['OpenBadgeCredential'], id: 'different-setup-badge' },
      },
      { jwt: jwtFor(otherContent), content: otherContent },
    ],
    verifications: [],
  };
  presentations.set(presentation.id, presentation);
  const exchange = exchanges.get(depotId);
  exchanges.set(depotId, {
    ...exchange,
    state: 'COMPLETE',
    presentationIds: [presentation.id],
    events: [...exchange.events, { state: 'COMPLETE', timestamp: now() }],
  });
};

const raiseError = (depotId) => {
  const exchange = exchanges.get(depotId);
  exchanges.set(depotId, {
    ...exchange,
    state: 'CLIENT_ERROR',
    error: {
      code: 'client_error',
      message: 'The wallet reported a protocol error.',
    },
    events: [...exchange.events, { state: 'CLIENT_ERROR', timestamp: now() }],
  });
};

const applyScenario = ({ depotId, action }) => {
  if (action === 'accept') {
    acceptCredential(depotId);
    return 'Credential accepted. Return to the certifier tab.';
  }
  if (action === 'reject') {
    rejectCredential(depotId);
    return 'Credential rejected. Return to the certifier tab.';
  }
  if (action === 'share') {
    sharePresentation(depotId, true);
    return 'Credentials shared. Return to the certifier tab.';
  }
  if (action === 'share-without-setup') {
    sharePresentation(depotId, false);
    return 'Alternate credential shared. Return to the certifier tab.';
  }
  raiseError(depotId);
  return 'Exchange error recorded. Return to the certifier tab.';
};

const registrarSearch = {
  result: [
    {
      id: 'did:web:velocity-test-wallet.example',
      name: 'Velocity Test Wallet Company',
      logo: undefined,
      service: [
        {
          id: 'did:web:velocity-test-wallet.example#wallet',
          name: 'Velocity Test Wallet',
          type: 'HolderAppProvider',
          supportedExchangeProtocols: ['VN_API'],
        },
      ],
    },
    {
      id: 'did:web:dual-test-wallet.example',
      name: 'Dual Protocol Wallet Company',
      service: [
        {
          id: 'did:web:dual-test-wallet.example#wallet',
          name: 'Dual Protocol Wallet',
          type: 'HolderAppProvider',
          supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
        },
      ],
    },
    {
      id: 'did:web:openid-test-wallet.example',
      name: 'OpenID-only Wallet Company',
      service: [
        {
          id: 'did:web:openid-test-wallet.example#wallet',
          name: 'OpenID-only Wallet',
          type: 'HolderAppProvider',
          supportedExchangeProtocols: ['OPENID4VC'],
        },
      ],
    },
  ],
};

const routeGet = (url, response) => {
  if (url.pathname === '/health') {
    return json(response, 200, { status: 'ok' });
  }
  if (url.pathname === '/api/v0.6/organizations/search-profiles') {
    return json(response, 200, registrarSearch);
  }
  if (url.pathname === '/operator/credentials/get') {
    const credential = credentials.get(url.searchParams.get('credentialId'));
    return json(response, 200, { credentials: credential ? [credential] : [] });
  }
  if (url.pathname === '/operator/exchanges/get') {
    const exchange = exchanges.get(url.searchParams.get('depotId'));
    return exchange
      ? json(response, 200, { exchange })
      : json(response, 404, { error: 'exchange_not_found' });
  }
  if (url.pathname === '/operator/presentations/get') {
    const exchange = exchanges.get(url.searchParams.get('depotId'));
    const results = (exchange?.presentationIds ?? [])
      .map((id) => presentations.get(id))
      .filter(Boolean);
    return json(response, 200, { presentations: results });
  }
  if (url.pathname === '/app-redirect') {
    return html(
      response,
      200,
      walletPage(
        url.searchParams.get('depotId'),
        url.searchParams.get('phase'),
      ),
    );
  }
  return json(response, 404, { error: 'not_found' });
};

const createDepot = (body, response) => {
  const depot = {
    id: `depot-${randomUUID()}`,
    userReference: body.depot.userReference,
  };
  return json(response, 200, { depot });
};

const createCredential = (body, response) => {
  const credential = {
    id: `credential-${randomUUID()}`,
    depotId: body.depotId,
    credentialReference: body.credential.credentialReference,
    content: body.credential.content,
  };
  credentials.set(credential.id, credential);
  depotCredentials.set(body.depotId, credential.id);
  return json(response, 200, { credential });
};

const refreshLink = (body, response, phase) => {
  exchangeFor(body.depotId, phase);
  return json(response, 200, {
    redirectUrl: `${publicUrl}/app-redirect?depotId=${encodeURIComponent(body.depotId)}&phase=${phase}`,
    vnProtocolLink: `velocity-network://${phase}/${encodeURIComponent(body.depotId)}`,
    openid4vcUri: `openid4vc://${phase}/${encodeURIComponent(body.depotId)}`,
  });
};

const verify = (body, response) => {
  const presentation = presentations.get(body.presentationId);
  if (!presentation) {
    return json(response, 404, { error: 'presentation_not_found' });
  }
  const verification = {
    verified: true,
    tamperCheck: 'PASS',
    credentials: presentation.scenarioCredentials.map(({ jwt, content }) =>
      passingCredential(jwt, content),
    ),
  };
  presentations.set(presentation.id, {
    ...presentation,
    verifications: [verification],
  });
  return json(response, 200, { verification });
};

const routePost = async (url, request, response) => {
  const body = await bodyJson(request);
  if (url.pathname === '/operator/depots/create') {
    return createDepot(body, response);
  }
  if (url.pathname === '/operator/credentials/create') {
    return createCredential(body, response);
  }
  if (url.pathname === '/operator/issue-links/refresh') {
    return refreshLink(body, response, 'issue');
  }
  if (url.pathname === '/operator/presentation-links/refresh') {
    return refreshLink(body, response, 'disclosure');
  }
  if (url.pathname === '/operator/presentations/verify') {
    return verify(body, response);
  }
  if (url.pathname === '/scenario') {
    return json(response, 200, { message: applyScenario(body) });
  }
  return json(response, 404, { error: 'not_found' });
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, publicUrl);
  if (request.method === 'GET') {
    return routeGet(url, response);
  }
  if (request.method === 'POST') {
    return routePost(url, request, response);
  }
  return json(response, 405, { error: 'method_not_allowed' });
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Wallet Certifier dependencies listening on ${port}\n`);
});
