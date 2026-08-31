import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { isValidGitUrl } from '../validators/validators.js';

/**
 * Clone the template repository
 * @param {string} templateUrl - URL of the template repository
 * @param {string} targetPath - Path where the project should be created
 */
function cloneTemplate(templateUrl, targetPath) {
  try {
    // Validate template URL format to prevent command injection
    if (!isValidGitUrl(templateUrl)) {
      throw new Error('Invalid template URL format');
    }

    // Additional check: reject URLs containing special git options
    if (templateUrl.includes('--upload-pack') || templateUrl.includes('-u')) {
      throw new Error('Invalid template URL: contains forbidden git options');
    }

    // Use spawn with array of arguments to prevent command injection
    // Add --no-checkout to prevent any hooks from running during clone
    const result = spawnSync('git', ['clone', '--', templateUrl, targetPath], {
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (result.error || result.status !== 0) {
      throw new Error(result.stderr || result.error?.message || 'Git clone failed');
    }

    // Development artifacts of the template repository itself, which a generated project
    // must not inherit: its history, and the agent tooling that drives the template.
    for (const artifact of ['.git', '.claude']) {
      const dir = path.join(targetPath, artifact);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  } catch (error) {
    throw new Error(`Failed to clone template: ${error.message}`);
  }
}

export { cloneTemplate };
