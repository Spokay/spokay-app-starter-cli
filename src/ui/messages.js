const chalk = require('chalk');

/**
 * Print success message with next steps
 * @param {string} projectName - Name of the project
 * @param {object} config - Configuration object
 */
function printSuccessMessage(projectName, config) {
  console.log(chalk.green.bold('\n✓ Project "' + projectName + '" created successfully!\n'));

  console.log(chalk.cyan.bold('Next steps:'));
  console.log(chalk.white(`  cd ${projectName}`));
  console.log(chalk.white(`  ${config.pkgMgrRun} start          # Start dev server`));
  console.log(
    chalk.white(`  ${config.pkgMgrRun} commit         # Make a commit (uses commitizen)`),
  );

  console.log(chalk.cyan.bold('\nConfiguration:'));
  console.log(chalk.white(`  - OIDC: ${config.oidcAuthority}`));
  console.log(chalk.white(`  - Resource Server: ${config.resourceServerUrl}`));
  console.log(chalk.white(`  - Proxy: ${config.useProxy ? 'enabled' : 'disabled'}`));
  console.log(chalk.white('  - Edit public/assets/app-config.json to change runtime config'));

  console.log(chalk.cyan.bold('\nDocumentation:'));
  console.log(chalk.white('  See README.md\n'));
}

/**
 * Print CLI header
 */
function printHeader() {
  console.log(chalk.blue.bold('\n🚀 Angular Starter CLI\n'));
}

/**
 * Print error message
 * @param {string} message - Error message
 */
function printError(message) {
  console.error(chalk.red(`\n❌ Error: ${message}\n`));
}

module.exports = {
  printSuccessMessage,
  printHeader,
  printError,
};
