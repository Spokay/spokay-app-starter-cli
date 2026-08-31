const chalk = require('chalk');
const ora = require('ora');
const { spawnSync } = require('child_process');

/**
 * Install project dependencies using the specified package manager
 * @param {string} targetPath - Path of the project
 * @param {object} config - Configuration object with packageManager
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function installDependencies(targetPath, config) {
  // Check if package manager is installed
  const pkgMgrCheck = spawnSync(config.packageManager, ['--version'], {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (pkgMgrCheck.error || pkgMgrCheck.status !== 0) {
    console.log(
      chalk.yellow(`\n⚠️  Warning: ${config.packageManager} is not installed on your system.`),
    );
    console.log(
      chalk.yellow(
        `Please install ${config.packageManager} and run '${config.packageManager} install' manually.\n`,
      ),
    );
    return false;
  }

  // Install dependencies
  const installSpinner = ora(`Installing dependencies with ${config.packageManager}...`).start();

  try {
    const installArgs = ['install'];
    const installResult = spawnSync(config.packageManager, installArgs, {
      cwd: targetPath,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (installResult.error || installResult.status !== 0) {
      installSpinner.fail(chalk.red('Failed to install dependencies'));
      console.log(
        chalk.yellow(
          `\nPlease run '${config.packageManager} install' manually in the project directory.\n`,
        ),
      );
      return false;
    } else {
      installSpinner.succeed(chalk.green('Dependencies installed!'));
      return true;
    }
  } catch {
    installSpinner.fail(chalk.red('Failed to install dependencies'));
    console.log(chalk.yellow(`\nPlease run '${config.packageManager} install' manually.\n`));
    return false;
  }
}

module.exports = {
  installDependencies,
};
