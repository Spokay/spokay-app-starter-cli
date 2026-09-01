import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

import type { VcsHost } from '../types.js';

/** Delete the CI configuration the generated project will not use. */
function handleCIFiles(targetPath: string, vcsHost: VcsHost): void {
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

export { handleCIFiles };
