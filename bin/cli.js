#!/usr/bin/env node

/**
 * CLI entry point for spokay-app-starter.
 */

import chalk from 'chalk';
import { program } from 'commander';

import packageJson from '../package.json' with { type: 'json' };
import { createProject } from '../src/commands/create.js';
import { createFullstack } from '../src/commands/fullstack.js';
import { templateIds, templates } from '../src/templates/registry.js';

/** Options every create-style command accepts, so any run can be fully unattended. */
const withCommonOptions = (command) =>
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
      .description(templates[id].label)
      .action((projectName, options, command) => createProject(id, projectName, options, command)),
  );
}

withCommonOptions(
  create
    .command('fullstack <project-name>')
    .description('Angular SPA + Spring Boot resource server, wired to each other')
    .action((projectName, options, command) => createFullstack(projectName, options, command)),
);

program
  .command('list')
  .description('List the available templates')
  .action(() => {
    console.log(chalk.cyan.bold('\nAvailable templates:\n'));
    for (const id of templateIds) {
      console.log(`  ${chalk.green(id.padEnd(16))} ${templates[id].label}`);
      console.log(`  ${' '.repeat(16)} ${chalk.gray(templates[id].repo)}`);
    }
    console.log(`\n  ${chalk.green('fullstack'.padEnd(16))} both of the above, wired together\n`);
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
