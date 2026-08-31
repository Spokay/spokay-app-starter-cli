import path from 'path';

import chalk from 'chalk';

import { ask } from '../prompts/ask.js';
import { sharedQuestions } from '../prompts/shared.js';
import { ensureTarget, generate, resolveNames } from '../generator.js';
import { getTemplate } from '../templates/registry.js';
import { initializeGit } from '../scaffold/git-initializer.js';
import { printHeader, printError } from '../ui/messages.js';
import { isValidDisplayName } from '../validators/validators.js';

/**
 * `create <template> <project-name>` — scaffold a single template.
 */
async function createProject(templateId, projectName, options, command) {
  printHeader();

  try {
    if (!projectName || !isValidDisplayName(projectName)) {
      throw new Error('Project name must contain at least one alphanumeric character');
    }

    const template = getTemplate(templateId);
    const { displayName, packageName } = resolveNames(projectName);

    console.log(chalk.cyan(`📦 ${template.label}`));
    console.log(chalk.cyan(`   Project: ${displayName}`));
    console.log(chalk.gray(`   Directory: ${packageName}\n`));

    const answers = {
      displayName,
      packageName,
      ...(await ask(
        [...sharedQuestions, ...template.questions],
        presetsFrom(options, command),
        options.yes,
      )),
    };

    const targetPath = path.resolve(options.path || '.', packageName);
    ensureTarget(targetPath, { force: options.force });
    await generate(template, answers, targetPath, { templateUrl: options.template });

    // commander's --no-git sets `git: false`; there is no `noGit`.
    if (options.git !== false) await initializeGit(targetPath, { assumeYes: options.yes });

    printNextSteps(template, packageName, answers);
  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}

/**
 * Flags win over prompts, so a fully-flagged invocation never asks anything.
 *
 * Only options the user actually typed count. Negated flags like `--no-proxy` are given a
 * default by commander, so reading the value alone would silently answer the proxy question
 * on every run and the prompt would never appear.
 */
function presetsFrom(options, command) {
  const map = {
    oidcAuthority: 'oidcAuthority',
    clientId: 'oidcClientId',
    frontendUrl: 'frontendUrl',
    backendUrl: 'resourceServerUrl',
    proxy: 'useProxy',
    vcs: 'vcsHost',
    pkg: 'packageManager',
    nodeVersion: 'nodeVersion',
    groupId: 'groupId',
    basePackage: 'basePackage',
    javaVersion: 'javaVersion',
    contextPath: 'contextPath',
  };
  const presets = {};
  const suppliedOnCli = (flag) =>
    command ? command.getOptionValueSource(flag) === 'cli' : options[flag] !== undefined;
  for (const [flag, answer] of Object.entries(map)) {
    if (suppliedOnCli(flag)) presets[answer] = options[flag];
  }
  return presets;
}

function printNextSteps(template, dirName, answers) {
  console.log(chalk.green.bold(`\n✓ Project "${dirName}" created successfully!\n`));
  console.log(chalk.cyan.bold('Next steps:'));
  console.log(chalk.white(`  cd ${dirName}`));
  if (template.id === 'angular') {
    const run = { npm: 'npm run', pnpm: 'pnpm', yarn: 'yarn' }[answers.packageManager];
    console.log(chalk.white(`  ${run} start`));
  } else {
    console.log(chalk.white('  ./mvnw spring-boot:run'));
  }
  console.log(chalk.cyan.bold('\nConfiguration:'));
  console.log(chalk.white(`  - OIDC: ${answers.oidcAuthority}`));
  console.log(chalk.white(`  - Client: ${answers.oidcClientId}`));
  console.log('');
}

export { createProject, presetsFrom, printNextSteps };
