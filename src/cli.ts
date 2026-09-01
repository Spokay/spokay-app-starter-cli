#!/usr/bin/env node

/**
 * CLI entry point for spokay-app-starter.
 */

import { readFileSync } from 'fs';

import chalk from 'chalk';
import { program } from 'commander';
import type { Command } from 'commander';

import { createProject } from './commands/create.js';
import { createFullstack } from './commands/fullstack.js';
import { getTemplate, templateIds } from './templates/registry.js';
import type { CreateOptions } from './types.js';

// This file and its compiled counterpart both sit one level under the package root, so the
// same relative URL finds package.json from `src/` and from `dist/`.
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

/** Options every create-style command accepts, so any run can be fully unattended. */
const withCommonOptions = (command: Command): Command =>
  command
    .option('-p, --path <path>', 'Directory to create the project in', '.')
    .option('-t, --template <url>', 'Override the template repository URL')
    .option('--oidc-authority <url>', 'OIDC authority URL')
    .option('--client-id <id>', 'OIDC client ID')
    .option('--frontend-url <url>', 'Where the frontend is served')
    .option('--backend-url <url>', 'Where the resource server is served')
    .option('--vcs <host>', 'github or gitlab')
    .option('--pkg <manager>', 'npm, pnpm or yarn')
    .option('--node-version <version>', 'Node.js version for CI')
    .option('--no-proxy', 'Call the backend directly instead of via the dev proxy')
    .option('--group-id <id>', 'Maven groupId')
    .option('--base-package <package>', 'Base Java package')
    .option('--java-version <version>', 'Java version')
    .option('--context-path <path>', 'Servlet context path')
    .option('-y, --yes', 'Take defaults for anything not supplied as a flag')
    .option('--force', 'Overwrite the target directory if it exists')
    .option('--no-git', 'Skip git initialisation');

program
  .name('spokay-app-starter')
  .description('Scaffold OIDC-ready starter projects: Angular, Spring Boot, or both')
  .version(packageJson.version);

const create = program.command('create').description('Create a new project from a template');

for (const id of templateIds) {
  withCommonOptions(
    create
      .command(`${id} <project-name>`)
      .description(getTemplate(id).label)
      .action((projectName: string, options: CreateOptions, command: Command) =>
        createProject(id, projectName, options, command),
      ),
  );
}

withCommonOptions(
  create
    .command('fullstack <project-name>')
    .description('Angular SPA + Spring Boot resource server, wired to each other')
    .action((projectName: string, options: CreateOptions, command: Command) =>
      createFullstack(projectName, options, command),
    ),
);

program
  .command('list')
  .description('List the available templates')
  .action(() => {
    console.log(chalk.cyan.bold('\nAvailable templates:\n'));
    for (const id of templateIds) {
      const template = getTemplate(id);
      console.log(`  ${chalk.green(id.padEnd(16))} ${template.label}`);
      console.log(`  ${' '.repeat(16)} ${chalk.gray(template.repo)}`);
    }
    console.log(`\n  ${chalk.green('fullstack'.padEnd(16))} both of the above, wired together\n`);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
