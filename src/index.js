import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';

// Import modules
import { isValidDisplayName, toNpmPackageName } from './validators/validators.js';
import { promptUserConfiguration } from './prompts/user-config.js';
import { cloneTemplate } from './template/cloner.js';
import { replaceTokens } from './template/token-replacer.js';
import { handleCIFiles } from './template/ci-configurator.js';
import { generateAppConfig } from './config/app-config-generator.js';
import { installDependencies } from './scaffold/dependency-installer.js';
import { initializeGit } from './scaffold/git-initializer.js';
import { printHeader, printSuccessMessage, printError } from './ui/messages.js';

/**
 * Main function to create an Angular starter project
 * @param {string} projectName - Name of the project to create
 * @param {object} options - Command line options
 */
async function createAngularStarter(projectName, options) {
  printHeader();

  try {
    // Validate project name
    if (!projectName || projectName.trim() === '') {
      console.error(chalk.red('❌ Project name is required!'));
      process.exit(1);
    }

    // Validate that display name can be converted to valid package name
    if (!isValidDisplayName(projectName)) {
      console.error(chalk.red('❌ Project name must contain at least one alphanumeric character'));
      process.exit(1);
    }

    // Convert display name to npm-friendly package name
    const displayName = projectName.trim();
    const packageName = toNpmPackageName(displayName);

    console.log(chalk.cyan(`📦 Project name: ${displayName}`));
    console.log(chalk.gray(`   Package name: ${packageName}\n`));

    // Determine project path (use package name for directory)
    const targetPath = path.resolve(options.path || '.', packageName);

    // Check if directory already exists
    if (fs.existsSync(targetPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Directory "${packageName}" already exists. Overwrite?`,
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('Aborted.'));
        process.exit(0);
      }

      // Remove existing directory
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    // Get configuration from user
    const config = await promptUserConfiguration(displayName, packageName);

    // Get template URL
    const templateUrl =
      options.template || 'https://github.com/Spokay/angular-starter-app-template.git';

    // Clone template repository
    const spinner = ora('Cloning template repository...').start();

    try {
      cloneTemplate(templateUrl, targetPath);
      spinner.succeed(chalk.green('Template cloned successfully!'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to clone template'));
      throw error;
    }

    // Replace tokens in template
    await replaceTokens(targetPath, config);

    // Handle CI file selection
    handleCIFiles(targetPath, config.vcsHost);

    // Generate app-config.json
    generateAppConfig(targetPath, config);

    // Install dependencies
    await installDependencies(targetPath, config);

    // Initialize git repository
    await initializeGit(targetPath);

    // Success message
    printSuccessMessage(packageName, config);
  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}

export { createAngularStarter };
