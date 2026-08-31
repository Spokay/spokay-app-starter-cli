const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const ora = require('ora');

/**
 * Handle CI file selection based on VCS host
 * @param {string} targetPath - Path of the cloned project
 * @param {string} vcsHost - VCS host (github or gitlab)
 */
function handleCIFiles(targetPath, vcsHost) {
  const spinner = ora('Configuring CI files...').start();

  try {
    if (vcsHost === 'github') {
      // Delete GitLab CI file
      const gitlabCIPath = path.join(targetPath, '.gitlab-ci.yml');
      if (fs.existsSync(gitlabCIPath)) {
        fs.unlinkSync(gitlabCIPath);
      }
    } else if (vcsHost === 'gitlab') {
      // Delete GitHub workflows directory
      const githubDir = path.join(targetPath, '.github');
      if (fs.existsSync(githubDir)) {
        fs.rmSync(githubDir, { recursive: true, force: true });
      }
    }

    spinner.succeed(chalk.green(`CI configured for ${vcsHost}!`));
  } catch {
    spinner.warn(chalk.yellow('Could not fully configure CI files'));
  }
}

module.exports = {
  handleCIFiles,
};
