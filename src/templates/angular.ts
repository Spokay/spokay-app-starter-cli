import fs from 'fs';
import path from 'path';

import { validateRequired } from '../validators/validators.js';
import { extractRealm } from '../template/token-replacer.js';
import { apiBaseUrl, generateAppConfig } from '../config/app-config-generator.js';
import { handleCIFiles } from '../template/ci-configurator.js';
import { PACKAGE_MANAGERS, VCS_HOSTS } from '../types.js';
import type { TemplateDescriptor } from '../types.js';

const angularTemplate = {
  id: 'angular',
  label: 'Angular 22 SPA with OIDC authentication',
  repo: 'https://github.com/Spokay/angular-starter-app-template.git',

  questions: [
    {
      type: 'confirm',
      name: 'useProxy',
      flag: 'proxy',
      message: 'Use proxy for development? (recommended to avoid CORS issues)',
      default: true,
    },
    {
      type: 'select',
      name: 'vcsHost',
      flag: 'vcs',
      message: 'Which VCS host are you using?',
      choices: VCS_HOSTS,
      default: 'github',
    },
    {
      type: 'select',
      name: 'packageManager',
      flag: 'pkg',
      message: 'Which package manager would you like to use?',
      choices: PACKAGE_MANAGERS,
      default: 'npm',
    },
    {
      type: 'input',
      name: 'nodeVersion',
      flag: 'nodeVersion',
      // Angular 22 engines are ^22.22.3 || ^24.15.0 || >=26; anything older installs fine
      // and then refuses to build, so the default must not be 20.
      message: 'Which Node.js version?',
      default: '24',
      validate: (input) => validateRequired(input, 'Node version'),
    },
  ],

  files: (answers) => [
    'package.json',
    // carries "name": "__APP_NAME__" at the root and under packages[""]. Rewriting it keeps
    // the generated project's dependency tree reproducible; deleting the lock file would
    // hand every new project a fresh, untested resolution instead.
    'package-lock.json',
    'angular.json',
    'src/app/app.spec.ts',
    'src/index.html',
    'src/app/layout/header/header.html',
    'src/app/layout/footer/footer.html',
    'README.md',
    'public/assets/app-config.json',
    'src/proxy.conf.json',
    answers.vcsHost === 'gitlab' ? '.gitlab-ci.yml' : '.github/workflows/ci.yml',
  ],

  tokens: (answers) => ({
    __APP_NAME__: answers.packageName,
    __APP_DISPLAY_NAME__: answers.displayName,
    __OIDC_AUTHORITY__: answers.oidcAuthority,
    __CLIENT_ID__: answers.oidcClientId,
    __REDIRECT_URL__: answers.frontendUrl,
    __POST_LOGOUT_REDIRECT_URL__: answers.frontendUrl,
    // The proxy target has to stay the server's origin; everything the app itself calls
    // goes through the API root instead.
    __BACKEND_URL__: answers.resourceServerUrl,
    __API_BASE_URL__: apiBaseUrl(answers),
    // Bare, not quoted: the template already has the token inside a JSON string. The old
    // quoted value produced invalid JSON, which only went unnoticed because the post-step
    // below rewrites app-config.json wholesale.
    __SECURE_ROUTES__: apiBaseUrl(answers),
    __PROXY_CONFIG__: answers.useProxy ? ',\n            "proxyConfig": "src/proxy.conf.json"' : '',
    __REALM__: extractRealm(answers.oidcAuthority),
    __NODE_VERSION__: answers.nodeVersion,
    __PKG_MGR__: answers.packageManager,
    __PKG_MGR_RUN__: { npm: 'npm run', pnpm: 'pnpm', yarn: 'yarn' }[answers.packageManager],
    __CLI_PACKAGE__: 'spokay-app-starter-cli',
  }),

  postSteps: [
    (targetPath, answers) => handleCIFiles(targetPath, answers.vcsHost),
    (targetPath, answers) => generateAppConfig(targetPath, answers),
    // The dev proxy config is dead weight when the app calls the backend directly.
    (targetPath, answers) => {
      if (answers.useProxy) return;
      fs.rmSync(path.join(targetPath, 'src/proxy.conf.json'), { force: true });
    },
  ],

  install: (answers) => answers.packageManager,
} satisfies TemplateDescriptor;

export { angularTemplate };
