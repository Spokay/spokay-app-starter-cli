/**
 * End-to-end proof for `create fullstack`: scaffold the pair, run both, log in, and call the
 * generated backend with the token the generated frontend actually obtained.
 *
 * Everything the two projects talk to is stubbed locally -- a full OIDC provider
 * (discovery, JWKS, authorize, token with PKCE, userinfo) signing with a key the backend
 * fetches from that same stub. No Keycloak, no Docker, no network.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const IDP_PORT = Number(process.env.IDP_PORT ?? 9999);
const APP_PORT = Number(process.env.APP_PORT ?? 4200);
const API_PORT = Number(process.env.API_PORT ?? 8080);
const CDP_PORT = Number(process.env.CDP_PORT ?? 9222);

const REALM = 'demo';
const AUTHORITY = `http://localhost:${IDP_PORT}/realms/${REALM}`;
const CLIENT_ID = 'fullstack-client';
const FRONTEND_URL = `http://localhost:${APP_PORT}`;
const BACKEND_URL = `http://localhost:${API_PORT}`;

// --------------------------------------------------------------- stub IdP ---

const KID = 'e2e-key';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const b64u = (b) => Buffer.from(b).toString('base64url');
const USER = {
  sub: 'e2e-0000-1111-2222',
  preferred_username: 'ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
};

function jwt(claims, expIn = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const head = { alg: 'RS256', typ: 'JWT', kid: KID };
  const body = { iss: AUTHORITY, aud: CLIENT_ID, azp: CLIENT_ID, iat: now, exp: now + expIn, ...claims };
  const input = `${b64u(JSON.stringify(head))}.${b64u(JSON.stringify(body))}`;
  return `${input}.${b64u(crypto.createSign('RSA-SHA256').update(input).sign(privateKey))}`;
}

const codes = new Map();

function startIdp() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${IDP_PORT}`);
    const p = url.pathname.replace(`/realms/${REALM}`, '');
    const json = (code, body) => {
      res.writeHead(code, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
      });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
      });
      return res.end();
    }

    if (p === '/.well-known/openid-configuration')
      return json(200, {
        issuer: AUTHORITY,
        authorization_endpoint: `${AUTHORITY}/protocol/openid-connect/auth`,
        token_endpoint: `${AUTHORITY}/protocol/openid-connect/token`,
        userinfo_endpoint: `${AUTHORITY}/protocol/openid-connect/userinfo`,
        end_session_endpoint: `${AUTHORITY}/protocol/openid-connect/logout`,
        revocation_endpoint: `${AUTHORITY}/protocol/openid-connect/revoke`,
        jwks_uri: `${AUTHORITY}/protocol/openid-connect/certs`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        scopes_supported: ['openid', 'profile', 'email', 'musics:read'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
      });

    if (p === '/protocol/openid-connect/certs')
      return json(200, {
        keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' }],
      });

    if (p === '/protocol/openid-connect/auth') {
      const q = url.searchParams;
      const code = crypto.randomUUID();
      codes.set(code, { nonce: q.get('nonce') });
      const back = new URL(q.get('redirect_uri'));
      back.searchParams.set('code', code);
      back.searchParams.set('state', q.get('state') ?? '');
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }

    if (p === '/protocol/openid-connect/token') {
      const body = await new Promise((r) => {
        let d = '';
        req.on('data', (c) => (d += c));
        req.on('end', () => r(new URLSearchParams(d)));
      });
      const entry = codes.get(body.get('code')) ?? {};
      return json(200, {
        // The scope and role claims the generated backend authorizes on.
        access_token: jwt({
          ...USER,
          scope: 'openid profile email musics:read',
          [`${CLIENT_ID}.roles`]: ['ADMIN'],
        }),
        id_token: jwt({ ...USER, nonce: entry.nonce ?? undefined }),
        refresh_token: jwt({ typ: 'Refresh' }, 7200),
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid profile email musics:read',
      });
    }

    if (p === '/protocol/openid-connect/userinfo') return json(200, USER);
    if (p === '/protocol/openid-connect/revoke') return json(200, {});
    if (p === '/protocol/openid-connect/logout') {
      res.writeHead(302, { location: url.searchParams.get('post_logout_redirect_uri') ?? FRONTEND_URL });
      return res.end();
    }
    json(404, { error: 'not_found', path: p });
  });
  return new Promise((r) => server.listen(IDP_PORT, '127.0.0.1', () => r(server)));
}

// -------------------------------------------------------------------- CDP ---

class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();

  static async launch(workspace) {
    const profile = path.join(workspace, 'chrome-profile');
    fs.rmSync(profile, { recursive: true, force: true });
    const chrome = spawn(
      'google-chrome',
      [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--window-size=1280,900',
        'about:blank',
      ],
      { stdio: 'ignore', detached: true },
    );
    let target;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
        target = list.find((t) => t.type === 'page');
        if (target) break;
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!target) throw new Error('chrome never exposed a page target');
    const cdp = new Cdp();
    await cdp.#connect(target.webSocketDebuggerUrl);
    cdp.chrome = chrome;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    return cdp;
  }

  #connect(url) {
    return new Promise((resolve, reject) => {
      this.#ws = new WebSocket(url);
      this.#ws.onopen = () => resolve();
      this.#ws.onerror = (e) => reject(new Error(`cdp ws error: ${e.message ?? e.type}`));
      this.#ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.#pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.#pending.get(msg.id);
          this.#pending.delete(msg.id);
          msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = ++this.#id;
    this.#ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }));
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result.value;
  }

  async waitFor(expression, { timeout = 45_000, label = expression } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await this.eval(`!!(${expression})`)) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(
      `timed out waiting for ${label}\n  url: ${await this.eval('location.href')}\n  body: ${await this.eval('document.body.innerText.slice(0,300)')}`,
    );
  }

  async shot(dir, name) {
    fs.mkdirSync(dir, { recursive: true });
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(dir, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`   screenshot -> ${file}`);
    return file;
  }

  close() {
    try { this.#ws.close(); } catch { /* closed */ }
    try { process.kill(-this.chrome.pid, 'SIGKILL'); } catch { /* gone */ }
  }
}

// ------------------------------------------------------------------ procs ---

function startBackend(dir, logPath) {
  const child = spawn('./mvnw', ['-B', '-q', 'spring-boot:run'], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // mvnw forks a JVM; kill the group or :8080 leaks
  });
  const log = fs.createWriteStream(logPath);
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

function startFrontend(dir, logPath) {
  const child = spawn('npx', ['ng', 'serve', '--port', String(APP_PORT)], {
    cwd: dir,
    env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const log = fs.createWriteStream(logPath);
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

async function waitForHttp(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`timed out waiting for ${label} at ${url}`);
}

export { AUTHORITY, CLIENT_ID, FRONTEND_URL, BACKEND_URL, APP_PORT, API_PORT, USER };
export { startIdp, startBackend, startFrontend, waitForHttp, Cdp };
