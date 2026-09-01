#!/usr/bin/env node
/**
 * run-spokay-app-starter-cli driver
 *
 * The CLI now has non-interactive flags, but the prompt layer is still where the
 * interesting breakage lives (inquirer 14 dropping the `list` type was invisible to
 * everything except a real TTY). So this driver keeps two ways in:
 *
 *   scaffold : calls generate() from the build output directly with an answers object.
 *              Fast, no TTY. The path for changes to the registry, token-replacer or
 *              generator.
 *   tui      : drives the real `dist/cli.js` through tmux send-keys, answering the actual
 *              prompts. The path for changes to prompts/ or cli.ts.
 *
 * The CLI is TypeScript, so every mode below runs against `dist/`; the driver rebuilds it
 * first rather than testing whatever happened to be built last.
 *
 * Both templates are served over a local dumb-HTTP git server built from the sibling
 * checkouts, so runs are offline and test the CLI against the templates it must stay in
 * sync with. (A filesystem path is rejected by isValidGitUrl -- it only accepts https?://,
 * git://, git@ -- and `git daemon` is not installed here.)
 *
 * Commands:
 *   node driver.mjs scaffold [angular|resource-server] [--proxy false] [--vcs gitlab]
 *   node driver.mjs fullstack [--proxy false]
 *   node driver.mjs matrix        every template, plus the proxy x vcs matrix for angular
 *   node driver.mjs tui [angular|resource-server|fullstack] [--vcs gitlab]
 *   node driver.mjs flags         prove a fully-flagged run needs no TTY at all
 *   node driver.mjs serve | clean
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const UNIT = path.resolve(SKILL_DIR, '../../..'); // the CLI repo
const WORKSPACE = process.env.WORKSPACE ?? path.join(os.tmpdir(), 'run-spokay-app-starter-cli');
const GIT_PORT = Number(process.env.GIT_PORT ?? 8899);
const OUT = path.join(WORKSPACE, 'out');

// Sibling template checkouts. Bare-cloned and served, so the CLI exercises the templates as
// they are committed right now.
const TEMPLATE_SRC = {
  angular: process.env.ANGULAR_SRC ?? path.resolve(UNIT, '..', 'angular-starter-app-template'),
  'resource-server':
    process.env.RESOURCE_SERVER_SRC ?? path.resolve(UNIT, '..', 'resource-server-template'),
};
const templateUrl = (id) => `http://localhost:${GIT_PORT}/${id}.git`;

const rest = process.argv.slice(3).filter((a) => !a.startsWith('-') === false || true);
const flag = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
};

// ------------------------------------------------------------ fixtures ------

const DISPLAY_NAME = 'My Test App';
const PACKAGE_NAME = 'my-test-app';
const SHARED = {
  oidcAuthority: 'http://localhost:9999/realms/demo',
  oidcClientId: 'angular-starter',
  frontendUrl: 'http://localhost:4200',
  resourceServerUrl: 'http://localhost:8080',
};
const ANGULAR_ANSWERS = { vcsHost: 'github', packageManager: 'npm', nodeVersion: '24', useProxy: true };
const RS_ANSWERS = {
  groupId: 'com.acme',
  basePackage: 'com.acme.api',
  javaVersion: '25',
  contextPath: '/api',
};

// --------------------------------------------------- local git over HTTP ----

function prepareTemplateRepos() {
  fs.mkdirSync(WORKSPACE, { recursive: true });
  for (const [id, src] of Object.entries(TEMPLATE_SRC)) {
    if (!fs.existsSync(path.join(src, '.git')))
      throw new Error(`no git checkout at ${src} (set ${id === 'angular' ? 'ANGULAR_SRC' : 'RESOURCE_SERVER_SRC'})`);
    const bare = path.join(WORKSPACE, `${id}.git`);
    fs.rmSync(bare, { recursive: true, force: true });
    execFileSync('git', ['clone', '--bare', '-q', src, bare]);
    execFileSync('git', ['-C', bare, 'update-server-info']);
  }
}

function serveDir() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    const file = path.join(WORKSPACE, rel);
    if (!file.startsWith(WORKSPACE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('nope');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(GIT_PORT, '127.0.0.1', () => resolve(server));
  });
}

/**
 * The server MUST live in a separate process: cloner.js clones with spawnSync, which blocks
 * this process's event loop, so an in-process server would never answer git.
 */
function startGitServer() {
  const child = fork(fileURLToPath(import.meta.url), ['serve-only'], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env: { ...process.env, WORKSPACE, GIT_PORT: String(GIT_PORT) },
  });
  return new Promise((resolve, reject) => {
    child.on('message', (m) => m === 'ready' && resolve({ close: () => child.kill('SIGKILL') }));
    child.on('exit', (code) => reject(new Error(`git server exited with ${code}`)));
  });
}

// ------------------------------------------------------------- checks -------

// Files that legitimately contain `__SOMETHING__` without it being a template placeholder:
// documentation *about* the templating, and vendored third-party scripts. The Maven
// wrapper uses __MVNW_CMD__ / __MVNW_ERROR__ as internal batch variables.
const NOT_PLACEHOLDERS = ['CLAUDE.md', '.prettierignore', 'mvnw', 'mvnw.cmd'];

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ ok: true, name });
    console.log(`✓ ${name}${detail ? `  ${detail}` : ''}`);
  } catch (e) {
    results.push({ ok: false, name, err: e.message });
    console.log(`✗ ${name}\n    ${e.message}`);
  }
}
const eq = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const read = (dir, p) => fs.readFileSync(path.join(dir, p), 'utf8');
const json = (dir, p) => JSON.parse(read(dir, p));
const props = (dir, p) =>
  Object.fromEntries(
    read(dir, p)
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );

function noTokensLeft(dir) {
  const out = execFileSync('bash', [
    '-c',
    `grep -rlE '__[A-Z_]+__' --exclude-dir=node_modules --exclude-dir=.git ${JSON.stringify(dir)} || true`,
  ]).toString();
  const files = out.split('\n').filter(Boolean).map((f) => path.relative(dir, f));
  const unexpected = files.filter((f) => !NOT_PLACEHOLDERS.includes(f) && !f.startsWith('.mvn/'));
  if (unexpected.length) throw new Error(`tokens survive in ${unexpected.join(', ')}`);
  return `(only in docs/vendored: ${files.join(', ') || 'nowhere'})`;
}

async function verifyAngular(dir, answers) {
  await check('angular: development artifacts of the template are not inherited', () => {
    if (fs.existsSync(path.join(dir, '.git', 'refs', 'remotes', 'origin')))
      throw new Error('origin refs survived');
    if (fs.existsSync(path.join(dir, '.claude'))) throw new Error('.claude survived');
  });
  await check('angular: package.json and lock file name replaced', () => {
    eq(json(dir, 'package.json').name, answers.packageName, 'package.json name');
    eq(json(dir, 'package-lock.json').name, answers.packageName, 'lock name');
  });
  await check('angular: angular.json is valid JSON again', () => {
    const a = json(dir, 'angular.json');
    const opts = a.projects[answers.packageName].architect.serve.options;
    eq(opts.proxyConfig, answers.useProxy ? 'src/proxy.conf.json' : undefined, 'proxyConfig');
    return `proxyConfig=${JSON.stringify(opts.proxyConfig)}`;
  });
  await check('angular: app-config.json matches the answers', () =>
    eq(
      json(dir, 'public/assets/app-config.json'),
      {
        oidc: {
          authority: answers.oidcAuthority,
          clientId: answers.oidcClientId,
          redirectUrl: answers.frontendUrl,
          postLogoutRedirectUri: answers.frontendUrl,
          scope: 'openid profile email',
          responseType: 'code',
          secureRoutes: answers.useProxy ? ['/api'] : [answers.resourceServerUrl],
        },
        resourceServer: { baseUrl: answers.resourceServerUrl },
      },
      'app-config.json',
    ));
  await check(`angular: CI configured for ${answers.vcsHost}`, () => {
    const gh = fs.existsSync(path.join(dir, '.github/workflows/ci.yml'));
    const gl = fs.existsSync(path.join(dir, '.gitlab-ci.yml'));
    eq({ gh, gl }, answers.vcsHost === 'github' ? { gh: true, gl: false } : { gh: false, gl: true }, 'CI files');
    const ci = read(dir, answers.vcsHost === 'github' ? '.github/workflows/ci.yml' : '.gitlab-ci.yml');
    if (!ci.includes(answers.nodeVersion)) throw new Error('node version not replaced');
  });
  await check('angular: proxy config present only when the proxy is on', () => {
    const exists = fs.existsSync(path.join(dir, 'src/proxy.conf.json'));
    eq(exists, answers.useProxy, 'src/proxy.conf.json exists');
    if (exists) eq(json(dir, 'src/proxy.conf.json')['/api/*'].target, answers.resourceServerUrl, 'proxy target');
  });
  await check('angular: no unexpected __TOKEN__ left', () => noTokensLeft(dir));
}

async function verifyResourceServer(dir, answers) {
  const pkgPath = answers.basePackage.split('.').join('/');
  await check('resource-server: package directory expanded from the token', () => {
    if (fs.existsSync(path.join(dir, 'src/main/java/__BASE_PACKAGE__')))
      throw new Error('__BASE_PACKAGE__ directory still present');
    if (!fs.existsSync(path.join(dir, 'src/main/java', pkgPath, 'Application.java')))
      throw new Error(`expected src/main/java/${pkgPath}/Application.java`);
    return pkgPath;
  });
  await check('resource-server: sources declare the chosen package', () => {
    const src = read(dir, `src/main/java/${pkgPath}/Application.java`);
    if (!src.includes(`package ${answers.basePackage};`))
      throw new Error(`package declaration is ${src.split('\n')[0]}`);
  });
  await check('resource-server: pom coordinates replaced', () => {
    const pom = read(dir, 'pom.xml');
    for (const [needle, what] of [
      [`<groupId>${answers.groupId}</groupId>`, 'groupId'],
      [`<artifactId>${answers.packageName}</artifactId>`, 'artifactId'],
      [`<java.version>${answers.javaVersion}</java.version>`, 'java.version'],
    ])
      if (!pom.includes(needle)) throw new Error(`${what} not replaced`);
  });
  await check('resource-server: application.properties wired to the answers', () => {
    const p = props(dir, 'src/main/resources/application.properties');
    eq(p['server.port'], new URL(answers.resourceServerUrl).port, 'server.port');
    eq(p['server.servlet.context-path'], answers.contextPath, 'context-path');
    eq(p['spring.application.name'], answers.packageName, 'application name');
    eq(p['cors.allowed-origins'], answers.frontendUrl, 'cors.allowed-origins');
    if (!p['oauth2.jwk-set-uri'].includes(answers.oidcAuthority))
      throw new Error(`jwk-set-uri is ${p['oauth2.jwk-set-uri']}`);
  });
  await check('resource-server: no unexpected __TOKEN__ left', () => noTokensLeft(dir));
}

// ---------------------------------------------------------- scaffolding -----

async function withTemplates(run) {
  prepareTemplateRepos();
  const server = await startGitServer();
  try {
    return await run();
  } finally {
    server.close();
  }
}

const load = (rel) => import(pathToFileURL(path.join(UNIT, rel)).href);

/** Compile the CLI. Every mode reads `dist/`, so a stale build would test the wrong code. */
const build = () => execFileSync('npm', ['run', 'build'], { cwd: UNIT, stdio: 'inherit' });

async function scaffoldOne(id, answers, targetPath) {
  const { getTemplate } = await load('dist/templates/registry.js');
  const { generate } = await load('dist/generator.js');
  return generate(getTemplate(id), answers, targetPath, { templateUrl: templateUrl(id) });
}

function answersFor(id, overrides = {}) {
  const base = { displayName: DISPLAY_NAME, packageName: PACKAGE_NAME, ...SHARED };
  const perTemplate = id === 'angular' ? ANGULAR_ANSWERS : id === 'resource-server' ? RS_ANSWERS : { ...ANGULAR_ANSWERS, ...RS_ANSWERS };
  return { ...base, ...perTemplate, ...overrides };
}

async function scaffold(id, overrides) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const answers = answersFor(id, overrides);
  const dir = path.join(OUT, PACKAGE_NAME);
  console.log(`template  : ${templateUrl(id)}`);
  await scaffoldOne(id, answers, dir);
  console.log(`\nverifying ${dir}`);
  await (id === 'angular' ? verifyAngular : verifyResourceServer)(dir, answers);
  return dir;
}

async function fullstack(overrides) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const answers = answersFor('fullstack', overrides);
  const root = path.join(OUT, PACKAGE_NAME);
  const frontend = path.join(root, 'frontend');
  const backend = path.join(root, 'backend');

  // The real composition, so the cross-wiring and the root README are what ship.
  const { generateFullstack } = await load('dist/commands/fullstack.js');
  await generateFullstack(answers, root, {
    angularUrl: templateUrl('angular'),
    resourceServerUrl: templateUrl('resource-server'),
  });

  console.log(`\nverifying ${root}`);
  await verifyAngular(frontend, { ...answers, packageName: `${PACKAGE_NAME}-frontend` });
  await verifyResourceServer(backend, { ...answers, packageName: `${PACKAGE_NAME}-backend` });

  // The point of the command: one set of answers, two projects that agree.
  check('fullstack: both sides point at the same OIDC authority', () => {
    const front = json(frontend, 'public/assets/app-config.json').oidc.authority;
    const back = props(backend, 'src/main/resources/application.properties')['oauth2.jwk-set-uri'];
    if (!back.includes(front)) throw new Error(`frontend ${front} vs backend ${back}`);
    return front;
  });
  await check('fullstack: both sides use the same client id', () => {
    const front = json(frontend, 'public/assets/app-config.json').oidc.clientId;
    const back = props(backend, 'src/main/resources/application.properties')['oauth2.client-id'];
    if (!back.includes(front)) throw new Error(`frontend ${front} vs backend ${back}`);
    return front;
  });
  await check("fullstack: the backend's port is where the frontend expects it", () => {
    const expected = new URL(json(frontend, 'public/assets/app-config.json').resourceServer.baseUrl).port;
    eq(props(backend, 'src/main/resources/application.properties')['server.port'], expected, 'server.port');
    return expected;
  });
  await check("fullstack: the backend allows the frontend's origin", () =>
    eq(
      props(backend, 'src/main/resources/application.properties')['cors.allowed-origins'],
      answers.frontendUrl,
      'cors.allowed-origins',
    ));
  await check('fullstack: a root README explains how to run both', () => {
    const readme = read(root, 'README.md');
    if (!readme.includes(answers.oidcAuthority)) throw new Error('README does not name the authority');
  });
  return root;
}

// --------------------------------------------------------------- tui --------

const SESSION = 'run-cli';
const sh = (...args) => execFileSync('tmux', args, { encoding: 'utf8' });
const pane = () => sh('capture-pane', '-t', SESSION, '-p');

async function waitFor(marker, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pane().includes(marker)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(pane());
  throw new Error(`timed out waiting for ${JSON.stringify(marker)}`);
}
const answer = async (marker, { text = '', keys = [], timeout } = {}) => {
  await waitFor(marker, timeout);
  if (text) sh('send-keys', '-t', SESSION, '-l', text);
  for (const k of keys) sh('send-keys', '-t', SESSION, k);
  sh('send-keys', '-t', SESSION, 'Enter');
};

/** End to end through the real interactive CLI, over a real TTY. */
async function tui(id) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  try { sh('kill-session', '-t', SESSION); } catch { /* no session */ }
  sh('new-session', '-d', '-s', SESSION, '-x', '200', '-y', '50');

  const command = id === 'fullstack'
    ? `cd ${UNIT} && node dist/cli.js create fullstack ${JSON.stringify(DISPLAY_NAME)} --path ${OUT}`
    : `cd ${UNIT} && node dist/cli.js create ${id} ${JSON.stringify(DISPLAY_NAME)} --template ${templateUrl(id)} --path ${OUT}`;
  sh('send-keys', '-t', SESSION, command, 'Enter');

  await answer('OIDC authority URL', { text: SHARED.oidcAuthority });
  await answer('OIDC client ID', { text: SHARED.oidcClientId });
  await answer('Where will the frontend be served', {});
  await answer('Where will the resource server be served', {});

  if (id === 'angular' || id === 'fullstack') {
    await answer('Use proxy for development', {});
    await answer('Which VCS host', {});
    await answer('Which package manager', {});
    await answer('Which Node.js version', {});
  }
  if (id === 'resource-server' || id === 'fullstack') {
    // Typed rather than defaulted, so the verification below asserts the same values as the
    // scaffold path and the text-input prompts are actually exercised.
    await answer('Maven groupId', { text: RS_ANSWERS.groupId });
    await answer('Base Java package', { text: RS_ANSWERS.basePackage });
    await answer('Which Java version', {});
    await answer('Servlet context path', {});
  }
  // npm install runs here for anything with an Angular side
  await answer('Initialize git repository', { timeout: 420_000 });
  await answer('Add git remote', {});
  await waitFor('created successfully', 420_000).catch(() => waitFor('wired together', 60_000));
  console.log(pane().split('\n').filter((l) => l.trim()).slice(-14).join('\n'));

  try { sh('kill-session', '-t', SESSION); } catch { /* gone */ }
  return path.join(OUT, PACKAGE_NAME);
}

// -------------------------------------------------------------- flags -------

/**
 * Run the real binary with every answer supplied as a flag, stdin not a TTY. Proves the
 * unattended path: if any prompt still fires, inquirer throws instead of hanging forever.
 */
async function flagsRun() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const dir = path.join(OUT, PACKAGE_NAME);

  const args = [
    'dist/cli.js', 'create', 'resource-server', DISPLAY_NAME,
    '--template', templateUrl('resource-server'),
    '--path', OUT,
    '--oidc-authority', SHARED.oidcAuthority,
    '--client-id', SHARED.oidcClientId,
    '--frontend-url', SHARED.frontendUrl,
    '--backend-url', SHARED.resourceServerUrl,
    '--group-id', RS_ANSWERS.groupId,
    '--base-package', RS_ANSWERS.basePackage,
    '--java-version', RS_ANSWERS.javaVersion,
    '--context-path', RS_ANSWERS.contextPath,
    '--yes', '--no-git',
  ];
  const out = execFileSync('node', args, { cwd: UNIT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(out.split('\n').filter((l) => l.trim()).slice(-6).join('\n'));

  console.log(`\nverifying ${dir}`);
  await verifyResourceServer(dir, answersFor('resource-server'));
  await check('flags: --no-git left the project without a repository', () => {
    if (fs.existsSync(path.join(dir, '.git'))) throw new Error('.git was created despite --no-git');
  });
  return dir;
}

// ---------------------------------------------------------------- e2e -------

/**
 * Scaffold a fullstack pair, run both, log in, and call the generated backend with the
 * token the generated frontend obtained. This is the only check that proves the two halves
 * work *together* rather than agreeing on paper.
 */
async function e2e() {
  const e = await import(pathToFileURL(path.join(SKILL_DIR, 'e2e.mjs')).href);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const root = path.join(OUT, PACKAGE_NAME);
  const frontend = path.join(root, 'frontend');
  const backend = path.join(root, 'backend');
  const answers = {
    displayName: DISPLAY_NAME,
    packageName: PACKAGE_NAME,
    oidcAuthority: e.AUTHORITY,
    oidcClientId: e.CLIENT_ID,
    frontendUrl: e.FRONTEND_URL,
    resourceServerUrl: e.BACKEND_URL,
    ...ANGULAR_ANSWERS,
    ...RS_ANSWERS,
  };

  const idp = await e.startIdp();
  console.log(`stub IdP  : ${e.AUTHORITY}`);

  console.log('scaffolding (installs the frontend\'s dependencies, this is the slow part)…');
  const { generateFullstack } = await load('dist/commands/fullstack.js');
  await generateFullstack(answers, root, {
    angularUrl: templateUrl('angular'),
    resourceServerUrl: templateUrl('resource-server'),
  });

  const api = e.startBackend(backend, path.join(WORKSPACE, 'backend.log'));
  const web = e.startFrontend(frontend, path.join(WORKSPACE, 'frontend.log'));
  let cdp;
  const cleanup = () => {
    try { cdp?.close(); } catch { /* gone */ }
    for (const child of [api, web]) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
    }
    idp.close();
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    console.log(`backend   : ${e.BACKEND_URL}  (log: ${WORKSPACE}/backend.log)`);
    await e.waitForHttp(`${e.BACKEND_URL}/api/musics`, 240_000, 'generated backend');
    console.log(`frontend  : ${e.FRONTEND_URL}  (log: ${WORKSPACE}/frontend.log)`);
    await e.waitForHttp(e.FRONTEND_URL, 240_000, 'generated frontend');
    console.log('both up\n');

    await check('backend rejects an unauthenticated call', async () => {
      const res = await fetch(`${e.BACKEND_URL}/api/musics`);
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    });

    cdp = await e.Cdp.launch(WORKSPACE);
    await cdp.send('Page.navigate', { url: e.FRONTEND_URL });
    await cdp.waitFor(`document.querySelector('app-login-page button')`, { label: 'login page' });
    await cdp.shot(path.join(WORKSPACE, 'shots'), 'e2e-01-login');

    await cdp.eval(`document.querySelector('app-login-page button').click()`);
    await cdp.waitFor(`location.pathname === '/home'`, { label: 'redirect to /home' });
    await cdp.waitFor(`document.body.innerText.includes('Is Authenticated: true')`, {
      label: 'authenticated home',
    });
    await check('the generated frontend completes a login against the generated backend\'s IdP', () => true);
    await cdp.shot(path.join(WORKSPACE, 'shots'), 'e2e-02-home');

    await check('the frontend shows the identity the IdP issued', async () => {
      const body = await cdp.eval('document.body.innerText');
      if (!body.includes(e.USER.name)) throw new Error(`"${e.USER.name}" not rendered`);
    });

    // The payoff: a token minted by the IdP the *frontend* logged into, presented to the
    // *backend* the CLI wired to that same IdP, through the dev proxy the CLI configured.
    const apiResult = await cdp.eval(`(async () => {
      const key = Object.keys(sessionStorage).find(k => (sessionStorage.getItem(k) || '').includes('access_token'));
      const token = JSON.parse(sessionStorage.getItem(key))?.authnResult?.access_token;
      if (!token) return { error: 'no access token in session storage' };
      const res = await fetch('/api/musics', { headers: { Authorization: 'Bearer ' + token } });
      return { status: res.status, body: await res.text() };
    })()`);

    await check('the backend accepts the access token the frontend obtained', () => {
      if (apiResult.error) throw new Error(apiResult.error);
      if (apiResult.status !== 200) throw new Error(`got ${apiResult.status}: ${apiResult.body}`);
      return `via the dev proxy -> ${apiResult.body}`;
    });
    await check('the proxied response is the backend\'s data', () => {
      if (apiResult.body !== '["Music 1","Music 2","Music 3"]')
        throw new Error(`unexpected body ${apiResult.body}`);
    });
  } finally {
    cleanup();
  }
  console.log(`\nscreenshots in ${WORKSPACE}/shots`);
  return root;
}

// -------------------------------------------------------------- main --------

const cmd = process.argv[2];
const proxyFlag = flag('proxy', 'true') !== 'false';
const vcsFlag = flag('vcs', 'github');
const overrides = { useProxy: proxyFlag, vcsHost: vcsFlag };

// The CLI is TypeScript: every mode that touches it reads `dist/`, so compile first rather
// than testing whatever was built last. `serve-only` is the forked git server, and
// `serve`/`clean` never load the CLI.
if (!['serve-only', 'serve', 'clean'].includes(cmd)) build();

const finish = () => {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
};

switch (cmd) {
  case 'serve-only': // internal: forked by startGitServer()
    await serveDir();
    process.send?.('ready');
    break;
  case 'scaffold':
    await withTemplates(() => scaffold(process.argv[3]?.startsWith('-') ? 'angular' : process.argv[3] ?? 'angular', overrides));
    finish();
    break;
  case 'fullstack':
    await withTemplates(() => fullstack(overrides));
    finish();
    break;
  case 'flags':
    await withTemplates(() => flagsRun());
    finish();
    break;
  case 'e2e':
    await withTemplates(() => e2e());
    finish();
    break;
  case 'matrix':
    await withTemplates(async () => {
      for (const proxy of [true, false])
        for (const vcs of ['github', 'gitlab'])
          await scaffold('angular', { useProxy: proxy, vcsHost: vcs });
      await scaffold('resource-server', {});
      await fullstack({ useProxy: true });
      await fullstack({ useProxy: false });
    });
    finish();
    break;
  case 'tui': {
    const id = process.argv[3]?.startsWith('-') ? 'angular' : (process.argv[3] ?? 'angular');
    const dir = await withTemplates(() => tui(id));
    if (id === 'fullstack') {
      await verifyAngular(path.join(dir, 'frontend'), answersFor('fullstack', { packageName: `${PACKAGE_NAME}-frontend` }));
      await verifyResourceServer(path.join(dir, 'backend'), answersFor('fullstack', { packageName: `${PACKAGE_NAME}-backend` }));
    } else {
      await (id === 'angular' ? verifyAngular : verifyResourceServer)(dir, answersFor(id));
    }
    finish();
    break;
  }
  case 'serve':
    prepareTemplateRepos();
    await serveDir();
    for (const id of Object.keys(TEMPLATE_SRC)) console.log(`${id.padEnd(16)} ${templateUrl(id)}`);
    break;
  case 'clean':
    fs.rmSync(WORKSPACE, { recursive: true, force: true });
    console.log(`removed ${WORKSPACE}`);
    break;
  default:
    console.log('usage: driver.mjs <scaffold|fullstack|matrix|tui|flags|e2e|serve|clean> [angular|resource-server|fullstack]');
    process.exit(2);
}
