#!/usr/bin/env node

/**
 * CLI entry point for angular-starter-oidc-cli
 */

import { program } from 'commander';
import { createAngularStarter } from '../src/index.js';
import packageJson from '../package.json' with { type: 'json' };

program
  .name('angular-starter-oidc')
  .description('CLI to create Angular starter applications from templates with OIDC support')
  .version(packageJson.version);

program
  .command('create <project-name>')
  .description('Create a new Angular starter project')
  .option('-t, --template <url>', 'Template repository URL')
  .option('-p, --path <path>', 'Path where project should be created', '.')
  .action((projectName, options) => {
    createAngularStarter(projectName, options);
  });

program.parse(process.argv);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
