import chalk from 'chalk';
import ora from 'ora';
import { spawnSync } from 'child_process';

import type { PackageManager } from '../types.js';

/**
 * Install project dependencies with the chosen package manager.
 *
 * A missing package manager is a warning, not a failure: the project is already scaffolded
 * and the user can install by hand.
 *
 * @returns whether the install actually ran and succeeded
 */
async function installDependencies(
  targetPath: string,
  config: { packageManager: PackageManager },
): Promise<boolean> {
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

  const installSpinner = ora(`Installing dependencies with ${config.packageManager}...`).start();

  try {
    const installResult = spawnSync(config.packageManager, ['install'], {
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
    }

    installSpinner.succeed(chalk.green('Dependencies installed!'));
    return true;
  } catch {
    installSpinner.fail(chalk.red('Failed to install dependencies'));
    console.log(chalk.yellow(`\nPlease run '${config.packageManager} install' manually.\n`));
    return false;
  }
}

export { installDependencies };
