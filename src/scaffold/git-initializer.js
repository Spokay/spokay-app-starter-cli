import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { spawnSync } from 'child_process';

/**
 * Initialize git repository and optionally add remote
 * @param {string} targetPath - Path of the project
 * @param {object} options - `assumeYes` skips both prompts, for unattended runs
 * @returns {Promise<void>}
 */
async function initializeGit(targetPath, { assumeYes = false } = {}) {
  const { initGit } = assumeYes
    ? { initGit: true }
    : await inquirer.prompt([
        {
          type: 'confirm',
          name: 'initGit',
          message: 'Initialize git repository?',
          default: true,
        },
      ]);

  if (!initGit) {
    return;
  }

  const gitSpinner = ora('Initializing git repository...').start();

  try {
    // Check if git is installed
    const gitCheck = spawnSync('git', ['--version'], { stdio: 'pipe' });

    if (gitCheck.error) {
      gitSpinner.warn(chalk.yellow('Git is not installed'));
      return;
    }

    // Initialize git
    spawnSync('git', ['init'], { cwd: targetPath, stdio: 'pipe' });
    spawnSync('git', ['add', '.'], { cwd: targetPath, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'chore: initial commit from angular-starter-cli'], {
      cwd: targetPath,
      stdio: 'pipe',
    });

    gitSpinner.succeed(chalk.green('Git repository initialized!'));

    // Adding a remote is interactive by nature; skip it when running unattended.
    if (!assumeYes) await addGitRemote(targetPath);
  } catch {
    gitSpinner.fail(chalk.red('Failed to initialize git'));
  }
}

/**
 * Add git remote if user wants to
 * @param {string} targetPath - Path of the project
 * @returns {Promise<void>}
 */
async function addGitRemote(targetPath) {
  const { addRemote } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addRemote',
      message: 'Add git remote?',
      default: false,
    },
  ]);

  if (!addRemote) {
    return;
  }

  const { remoteUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'remoteUrl',
      message: 'Enter remote repository URL:',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Remote URL is required';
        }
        return true;
      },
    },
  ]);

  spawnSync('git', ['remote', 'add', 'origin', remoteUrl], {
    cwd: targetPath,
    stdio: 'pipe',
  });

  console.log(chalk.green('✓ Remote added successfully!'));
}

export { initializeGit };
