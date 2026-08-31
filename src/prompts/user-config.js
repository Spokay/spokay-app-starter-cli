const chalk = require('chalk');
const inquirer = require('inquirer');
const {
  validateOidcAuthority,
  validateClientId,
  validateUrl,
  validateRequired,
} = require('../validators/validators');

/**
 * Prompt user for all configuration values
 * @param {string} displayName - User-friendly display name
 * @param {string} packageName - npm-friendly package name
 * @returns {Promise<object>} Configuration object
 */
async function promptUserConfiguration(displayName, packageName) {
  console.log(chalk.cyan('Please provide the following configuration:\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'oidcAuthority',
      message: 'What is your OIDC authority URL?',
      validate: validateOidcAuthority,
    },
    {
      type: 'input',
      name: 'oidcClientId',
      message: 'What is your OIDC client ID?',
      validate: validateClientId,
    },
    {
      type: 'input',
      name: 'redirectUrl',
      message: 'What is your OIDC redirect URL?',
      default: 'http://localhost:4200',
      validate: (input) => validateUrl(input, 'Redirect URL'),
    },
    {
      type: 'input',
      name: 'resourceServerUrl',
      message: 'What is your resource server URL?',
      default: 'http://localhost:8080',
      validate: (input) => validateUrl(input, 'Resource server URL'),
    },
    {
      type: 'confirm',
      name: 'useProxy',
      message: 'Use proxy for development? (recommended to avoid CORS issues)',
      default: true,
    },
    {
      type: 'list',
      name: 'vcsHost',
      message: 'Which VCS host are you using?',
      choices: ['github', 'gitlab'],
      default: 'github',
    },
    {
      type: 'list',
      name: 'packageManager',
      message: 'Which package manager would you like to use?',
      choices: ['npm', 'pnpm', 'yarn'],
      default: 'npm',
    },
    {
      type: 'input',
      name: 'nodeVersion',
      message: 'Which Node.js version?',
      default: '20',
      validate: (input) => validateRequired(input, 'Node version'),
    },
  ]);

  // Derive package manager run command
  const pkgMgrRun = {
    npm: 'npm run',
    pnpm: 'pnpm',
    yarn: 'yarn',
  }[answers.packageManager];

  return {
    displayName, // User-friendly display name
    packageName, // npm-friendly package name
    oidcAuthority: answers.oidcAuthority,
    oidcClientId: answers.oidcClientId,
    redirectUrl: answers.redirectUrl,
    resourceServerUrl: answers.resourceServerUrl,
    useProxy: answers.useProxy,
    vcsHost: answers.vcsHost,
    packageManager: answers.packageManager,
    pkgMgrRun,
    nodeVersion: answers.nodeVersion,
    cliPackage: 'angular-starter-oidc-cli', // Our CLI package name
  };
}

module.exports = {
  promptUserConfiguration,
};
