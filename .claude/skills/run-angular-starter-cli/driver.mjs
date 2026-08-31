#!/usr/bin/env node
/**
 * run-angular-starter-cli driver
 *
 * The CLI has no non-interactive flags -- every setting comes from an inquirer
 * prompt -- and piping answers into stdin does NOT work (inquirer 8 needs a TTY;
 * see the tui command and SKILL.md Gotchas). So this driver offers two paths:
 *
 *   scaffold : calls the src/ module pipeline directly with a config object.
 *              Fast (~3s), deterministic, no TTY. This is the path for a change
 *              to validators / token-replacer / app-config-generator / ci-configurator.
 *   tui      : drives the real `bin/cli.js` through tmux send-keys, answering the
 *              actual prompts. This is the path for a change to prompts/user-config.js
 *              or bin/cli.js.
 *
 * Both end in the same `verify` assertions over the generated project.
 *
 * The template is served to the CLI over a local dumb-HTTP git server built from
 * the sibling angular-starter-app-template checkout, so nothing hits GitHub and
 * the CLI is tested against the template it is supposed to stay in sync with.
 * (A plain filesystem path is rejected by isValidGitUrl -- it only accepts
 * https?://, git://, git@.)
 *
 * Commands:
 *   node driver.mjs scaffold [--proxy false] [--vcs gitlab] [--pkg pnpm] [--install]
 *   node driver.mjs tui      [--proxy false] [--vcs gitlab]
 *   node driver.mjs matrix                  scaffold every proxy x vcs combination
 *   node driver.mjs verify <project-dir> [--proxy false] [--vcs gitlab]
 *   node driver.mjs serve                   run only the git server (foreground)
 *   node driver.mjs clean
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, fork, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const UNIT = path.resolve(SKILL_DIR, '../../..'); // angular-starter-cli/
const WORKSPACE = process.env.WORKSPACE ?? path.join(os.tmpdir(), 'run-angular-starter-cli');
const TEMPLATE_SRC =
  process.env.TEMPLATE_SRC ?? path.resolve(UNIT, '..', 'angular-starter-app-template');
const GIT_PORT = Number(process.env.GIT_PORT ?? 8899);

const rest = process.argv.slice(3);
const flag = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? dflt : rest[i + 1];
};
const has = (name) => rest.includes(`--${name}`);

// ------------------------------------------------------------ fixtures ------

const DISPLAY_NAME = 'My Test App';
const PACKAGE_NAME = 'my-test-app';
const ANSWERS = {
  oidcAuthority: 'http://localhost:9999/realms/demo',
  oidcClientId: 'angular-starter',
  redirectUrl: 'http://localhost:4200',
  resourceServerUrl: 'http://localhost:8080',
  nodeVersion: '20',
};

const configFor = ({ proxy, vcs, pkg }) => ({
  displayName: DISPLAY_NAME,
  packageName: PACKAGE_NAME,
  ...ANSWERS,
  useProxy: proxy,
  vcsHost: vcs,
  packageManager: pkg,
  pkgMgrRun: { npm: 'npm run', pnpm: 'pnpm', yarn: 'yarn' }[pkg],
  cliPackage: 'angular-starter-oidc-cli',
});

// --------------------------------------------------- local git over HTTP ----

/**
 * Bare-clone the sibling template and serve it over the dumb HTTP protocol.
 * Dumb HTTP is enough for `git clone` as long as update-server-info has run.
 */
function prepareTemplateRepo() {
  if (!fs.existsSync(path.join(TEMPLATE_SRC, '.git')))
    throw new Error(`no git checkout at ${TEMPLATE_SRC} (set TEMPLATE_SRC=<path>)`);
  const bare = path.join(WORKSPACE, 'tpl.git');
  fs.rmSync(bare, { recursive: true, force: true });
  fs.mkdirSync(WORKSPACE, { recursive: true });
  execFileSync('git', ['clone', '--bare', '-q', TEMPLATE_SRC, bare]);
  execFileSync('git', ['-C', bare, 'update-server-info']);
  return bare;
}

function serveDir() {
  const root = WORKSPACE;
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
 * The server MUST live in a separate process: cloner.js clones with spawnSync,
 * which blocks this process's event loop, so an in-process HTTP server would
 * never answer git and the clone would hang forever.
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

const TEMPLATE_URL = `http://localhost:${GIT_PORT}/tpl.git`;

// ------------------------------------------------------------- verify -------

// Files that legitimately *mention* `__TOKEN__` rather than carry a placeholder to
// replace: documentation about the templating itself. Everything else must come out of
// the generator with zero tokens left.
const DOCUMENTS_TOKENS = ['CLAUDE.md', '.prettierignore'];

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
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

function verify(dir, { proxy, vcs, pkg = 'npm' }) {
  const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
  const json = (p) => JSON.parse(read(p));
  console.log(`\nverifying ${dir}  (proxy=${proxy}, vcs=${vcs})`);

  check('project directory is the package name, not the display name', () => {
    if (path.basename(dir) !== PACKAGE_NAME) throw new Error(`basename ${path.basename(dir)}`);
  });
  check("the template's own development artifacts are not inherited", () => {
    if (fs.existsSync(path.join(dir, '.git', 'refs', 'remotes', 'origin')))
      throw new Error('origin refs survived -- clone .git was not removed');
    if (fs.existsSync(path.join(dir, '.claude')))
      throw new Error(".claude survived -- that skill drives the template, not this project");
  });
  check('package.json name replaced', () => eq(json('package.json').name, PACKAGE_NAME, 'name'));
  check('package-lock.json name replaced', () => {
    const lock = json('package-lock.json');
    eq(lock.name, PACKAGE_NAME, 'lock name');
    eq(lock.packages[''].name, PACKAGE_NAME, 'lock packages[""].name');
  });
  check('angular.json is valid JSON again', () => {
    // In the template this file is NOT valid JSON: `"allowedHosts": ["localhost"]__PROXY_CONFIG__`
    const a = json('angular.json');
    eq(Object.keys(a.projects), [PACKAGE_NAME], 'projects key');
    const opts = a.projects[PACKAGE_NAME].architect.serve.options;
    eq(opts.proxyConfig, proxy ? 'src/proxy.conf.json' : undefined, 'serve.options.proxyConfig');
    return `proxyConfig=${JSON.stringify(opts.proxyConfig)}`;
  });
  check('index.html title is the display name', () => {
    if (!read('src/index.html').includes(`<title>${DISPLAY_NAME}</title>`))
      throw new Error('title not replaced');
  });
  check('footer shows the display name', () => {
    if (!read('src/app/layout/footer/footer.html').includes(DISPLAY_NAME))
      throw new Error('footer not replaced');
  });
  check('proxy.conf.json points at the resource server', () =>
    eq(json('src/proxy.conf.json')['/api/*'].target, ANSWERS.resourceServerUrl, 'target'));
  check('app-config.json matches the answers', () =>
    eq(json('public/assets/app-config.json'), {
      oidc: {
        authority: ANSWERS.oidcAuthority,
        clientId: ANSWERS.oidcClientId,
        redirectUrl: ANSWERS.redirectUrl,
        postLogoutRedirectUri: ANSWERS.redirectUrl,
        scope: 'openid profile email',
        responseType: 'code',
        secureRoutes: proxy ? ['/api'] : [ANSWERS.resourceServerUrl],
      },
      resourceServer: { baseUrl: ANSWERS.resourceServerUrl },
    }, 'app-config.json'));
  check(`CI configured for ${vcs}`, () => {
    const gh = fs.existsSync(path.join(dir, '.github/workflows/ci.yml'));
    const gl = fs.existsSync(path.join(dir, '.gitlab-ci.yml'));
    eq({ gh, gl }, vcs === 'github' ? { gh: true, gl: false } : { gh: false, gl: true }, 'CI files');
    const ci = read(vcs === 'github' ? '.github/workflows/ci.yml' : '.gitlab-ci.yml');
    if (!ci.includes(ANSWERS.nodeVersion)) throw new Error('node version not replaced in CI file');
    if (!ci.includes(pkg)) throw new Error(`package manager "${pkg}" not replaced in CI file`);
  });
  check('no unexpected __TOKEN__ left in the generated project', () => {
    const out = spawnSync(
      'grep',
      ['-rlE', '__[A-Z_]+__', '--exclude-dir=node_modules', '--exclude-dir=.git', '.'],
      { cwd: dir, encoding: 'utf8' },
    ).stdout;
    const files = out.split('\n').filter(Boolean).map((f) => f.replace(/^\.\//, ''));
    const unexpected = files.filter((f) => !DOCUMENTS_TOKENS.includes(f));
    if (unexpected.length) throw new Error(`tokens survive in ${unexpected.join(', ')}`);
    return `(only in docs: ${files.join(', ') || 'nowhere'})`;
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  return failed.length === 0;
}

// ----------------------------------------------------------- scaffold -------

/** Direct invocation: run the src/ pipeline without the prompt layer. */
async function scaffold(opts) {
  const bare = prepareTemplateRepo();
  const server = await startGitServer();
  const target = path.join(WORKSPACE, 'out', PACKAGE_NAME);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const { cloneTemplate } = require(path.join(UNIT, 'src/template/cloner.js'));
  const { replaceTokens } = require(path.join(UNIT, 'src/template/token-replacer.js'));
  const { handleCIFiles } = require(path.join(UNIT, 'src/template/ci-configurator.js'));
  const { generateAppConfig } = require(path.join(UNIT, 'src/config/app-config-generator.js'));
  const { installDependencies } = require(path.join(UNIT, 'src/scaffold/dependency-installer.js'));

  const config = configFor(opts);
  try {
    console.log(`template  : ${TEMPLATE_URL}  (bare clone of ${TEMPLATE_SRC})`);
    cloneTemplate(TEMPLATE_URL, target);
    await replaceTokens(target, config);
    handleCIFiles(target, config.vcsHost);
    generateAppConfig(target, config);
    if (has('install')) await installDependencies(target, config);
  } finally {
    server.close();
    fs.rmSync(bare, { recursive: true, force: true });
  }
  return target;
}

// --------------------------------------------------------------- tui --------

const SESSION = 'run-cli';
const sh = (...args) => execFileSync('tmux', args, { encoding: 'utf8' });
const pane = () => sh('capture-pane', '-t', SESSION, '-p');

async function waitFor(marker, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pane().includes(marker)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(pane());
  throw new Error(`timed out waiting for ${JSON.stringify(marker)}`);
}
/**
 * Wait for a prompt, then answer it.
 * `text` is sent with -l (literal) so URLs and slashes aren't parsed as key names;
 * `keys` are tmux key names (e.g. 'Down') for list prompts.
 */
const answer = async (marker, { text = '', keys = [], timeout } = {}) => {
  await waitFor(marker, timeout);
  if (text) sh('send-keys', '-t', SESSION, '-l', text);
  for (const k of keys) sh('send-keys', '-t', SESSION, k);
  sh('send-keys', '-t', SESSION, 'Enter');
};

/** End-to-end through the real interactive CLI, driven over a real TTY. */
async function tui(opts) {
  const bare = prepareTemplateRepo();
  const server = await startGitServer();
  const out = path.join(WORKSPACE, 'out');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  try { sh('kill-session', '-t', SESSION); } catch { /* no session */ }
  sh('new-session', '-d', '-s', SESSION, '-x', '200', '-y', '50');

  try {
    sh(
      'send-keys',
      '-t',
      SESSION,
      `cd ${UNIT} && node bin/cli.js create ${JSON.stringify(DISPLAY_NAME)} --template ${TEMPLATE_URL} --path ${out}`,
      'Enter',
    );

    await answer('OIDC authority URL', { text: ANSWERS.oidcAuthority });
    await answer('OIDC client ID', { text: ANSWERS.oidcClientId });
    await answer('OIDC redirect URL', {});                       // default http://localhost:4200
    await answer('resource server URL', {});                     // default http://localhost:8080
    await answer('Use proxy for development', opts.proxy ? {} : { text: 'n' });
    await answer('Which VCS host', opts.vcs === 'github' ? {} : { keys: ['Down'] });
    await answer('Which package manager', {});                   // npm
    await answer('Which Node.js version', {});                   // 20
    // `npm install` runs between these two prompts -- slow, hence the long timeout
    await answer('Initialize git repository', { timeout: 300_000 });
    await answer('Add git remote', {});                          // default No
    await waitFor('created successfully');
    console.log(pane().split('\n').filter((l) => l.trim()).slice(-16).join('\n'));
  } finally {
    server.close();
    fs.rmSync(bare, { recursive: true, force: true });
    try { sh('kill-session', '-t', SESSION); } catch { /* already gone */ }
  }
  return path.join(out, PACKAGE_NAME);
}

// -------------------------------------------------------------- main --------

const cmd = process.argv[2];
const opts = {
  proxy: flag('proxy', 'true') !== 'false',
  vcs: flag('vcs', 'github'),
  pkg: flag('pkg', 'npm'),
};

switch (cmd) {
  case 'scaffold': {
    const dir = await scaffold(opts);
    process.exit(verify(dir, opts) ? 0 : 1);
    break;
  }
  case 'tui': {
    const dir = await tui(opts);
    process.exit(verify(dir, opts) ? 0 : 1);
    break;
  }
  case 'matrix': {
    let ok = true;
    for (const proxy of [true, false])
      for (const vcs of ['github', 'gitlab']) {
        const o = { proxy, vcs, pkg: 'npm' };
        results.length = 0;
        ok = verify(await scaffold(o), o) && ok;
      }
    process.exit(ok ? 0 : 1);
    break;
  }
  case 'verify':
    process.exit(verify(path.resolve(process.argv[3]), opts) ? 0 : 1);
    break;
  case 'serve-only': // internal: forked by startGitServer()
    await serveDir();
    process.send?.('ready');
    break;
  case 'serve':
    prepareTemplateRepo();
    await serveDir();
    console.log(`git template served at ${TEMPLATE_URL}`);
    console.log(`  node bin/cli.js create "My App" --template ${TEMPLATE_URL} --path ${WORKSPACE}/out`);
    break;
  case 'clean':
    fs.rmSync(WORKSPACE, { recursive: true, force: true });
    console.log(`removed ${WORKSPACE}`);
    break;
  default:
    console.log('usage: driver.mjs <scaffold|tui|matrix|verify|serve|clean> [--proxy false] [--vcs gitlab]');
    process.exit(2);
}
