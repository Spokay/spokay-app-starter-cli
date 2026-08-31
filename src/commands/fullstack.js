import fs from 'fs';
import path from 'path';

import chalk from 'chalk';

import { ask } from '../prompts/ask.js';
import { sharedQuestions } from '../prompts/shared.js';
import { ensureTarget, generate, resolveNames } from '../generator.js';
import { getTemplate } from '../templates/registry.js';
import { initializeGit } from '../scaffold/git-initializer.js';
import { presetsFrom } from './create.js';
import { printHeader, printError } from '../ui/messages.js';
import { isValidDisplayName } from '../validators/validators.js';

/**
 * `create fullstack <project-name>` — both templates under one directory, wired to each
 * other. The shared OIDC questions are asked once, which is the whole point: a hand-wired
 * pair drifts the moment one side's authority or client id is edited.
 */
async function createFullstack(projectName, options, command) {
  printHeader();

  try {
    if (!projectName || !isValidDisplayName(projectName)) {
      throw new Error('Project name must contain at least one alphanumeric character');
    }

    const angular = getTemplate('angular');
    const resourceServer = getTemplate('resource-server');
    const { displayName, packageName } = resolveNames(projectName);

    console.log(chalk.cyan(`📦 Fullstack: ${angular.label} + ${resourceServer.label}`));
    console.log(chalk.cyan(`   Project: ${displayName}`));
    console.log(chalk.gray(`   Directory: ${packageName}/{frontend,backend}\n`));

    const presets = presetsFrom(options, command);
    const answers = await ask(
      [...sharedQuestions, ...angular.questions, ...resourceServer.questions],
      presets,
      options.yes,
    );

    const root = path.resolve(options.path || '.', packageName);
    ensureTarget(root, { force: options.force });
    await generateFullstack({ ...answers, displayName, packageName }, root);

    if (options.git !== false) await initializeGit(root, { assumeYes: options.yes });

    console.log(
      chalk.green.bold(`\n✓ "${packageName}" created — frontend and backend wired together\n`),
    );
    console.log(chalk.cyan.bold('Next steps:'));
    console.log(chalk.white(`  cd ${packageName}/backend && ./mvnw spring-boot:run`));
    const run = { npm: 'npm run', pnpm: 'pnpm', yarn: 'yarn' }[answers.packageManager];
    console.log(chalk.white(`  cd ${packageName}/frontend && ${run} start`));
    console.log('');
  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}

/**
 * Generate both projects under `root` and the README tying them together.
 *
 * Separate from the command so the run skill's driver exercises the real composition --
 * including the cross-wiring the README documents -- without needing a TTY.
 */
async function generateFullstack(answers, root, options = {}) {
  const angular = getTemplate('angular');
  const resourceServer = getTemplate('resource-server');
  fs.mkdirSync(root, { recursive: true });

  console.log(chalk.cyan('\n── frontend ──'));
  await generate(
    angular,
    { ...answers, packageName: `${answers.packageName}-frontend` },
    path.join(root, 'frontend'),
    { templateUrl: options.angularUrl },
  );

  console.log(chalk.cyan('\n── backend ──'));
  await generate(
    resourceServer,
    { ...answers, packageName: `${answers.packageName}-backend` },
    path.join(root, 'backend'),
    { templateUrl: options.resourceServerUrl },
  );

  writeRootReadme(root, answers.displayName, answers);
  return root;
}

function writeRootReadme(root, displayName, answers) {
  const backendPort = new URL(answers.resourceServerUrl).port || '8080';
  fs.writeFileSync(
    path.join(root, 'README.md'),
    `# ${displayName}

An Angular SPA and a Spring Boot resource server, scaffolded together and already pointing
at the same identity provider.

| | |
|---|---|
| Frontend | \`frontend/\` — ${answers.frontendUrl} |
| Backend | \`backend/\` — ${answers.resourceServerUrl} (context path \`${answers.contextPath}\`) |
| OIDC authority | ${answers.oidcAuthority} |
| Client id | ${answers.oidcClientId} |

## Running both

\`\`\`bash
cd backend && ./mvnw spring-boot:run      # :${backendPort}
cd frontend && ${{ npm: 'npm run', pnpm: 'pnpm', yarn: 'yarn' }[answers.packageManager]} start   # ${answers.frontendUrl}
\`\`\`

You need a running identity provider at \`${answers.oidcAuthority}\` to log in. The client
must allow \`${answers.frontendUrl}\` as a redirect URI.

## How the two are wired

${
  answers.useProxy
    ? `The frontend's dev server proxies \`/api\` to the backend, so browser requests are
same-origin and CORS does not apply in development. \`secureRoutes\` is \`/api\`, so the
access token is attached to those calls.`
    : `The frontend calls the backend directly at \`${answers.resourceServerUrl}\`, so the
backend's \`cors.allowed-origins\` is set to \`${answers.frontendUrl}\`. \`secureRoutes\` is the
backend URL, so the access token is attached to those calls.`
}

The backend reads its OIDC settings from \`application.properties\`, where the scaffolded
values are defaults — \`AUTHORITY_URL\` and \`CLIENT_ID\` in the environment override them.
`,
  );
}

export { createFullstack, generateFullstack };
