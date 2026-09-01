import fs from 'fs';
import path from 'path';

import chalk from 'chalk';
import ora from 'ora';

import type { Rename } from '../types.js';

/** Extract the realm from an OIDC authority URL, defaulting to `my-realm`. */
function extractRealm(authority: string): string {
  const match = authority.match(/\/realms\/([^/]+)/);
  return match?.[1] ?? 'my-realm';
}

/**
 * Rename templated directories, e.g. `src/main/java/__BASE_PACKAGE__` -> `.../com/acme/api`.
 *
 * Must run *before* token replacement: Java rejects sources whose directory no longer
 * matches their `package` declaration, and replacing contents first would produce exactly
 * that mismatch.
 *
 * @param targetPath - Path of the cloned project
 * @param renames - Project-relative paths; a `from` that is not there is skipped
 */
function renamePaths(targetPath: string, renames: readonly Rename[] = []): void {
  for (const { from, to } of renames) {
    const source = path.join(targetPath, from);
    if (!fs.existsSync(source)) continue;
    const destination = path.join(targetPath, to);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(source, destination);
  }
}

/**
 * Replace `__TOKEN__` placeholders across a template's files.
 *
 * @param targetPath - Path of the cloned project
 * @param tokens - Map of `__TOKEN__` to its replacement
 * @param files - Project-relative files to process; missing ones are skipped
 */
async function replaceTokens(
  targetPath: string,
  tokens: Record<string, string>,
  files: readonly string[],
): Promise<void> {
  const spinner = ora('Replacing configuration tokens...').start();

  try {
    for (const file of files) {
      const filePath = path.join(targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      let content = fs.readFileSync(filePath, 'utf8');
      for (const [token, value] of Object.entries(tokens)) {
        content = content.replaceAll(token, value);
      }
      fs.writeFileSync(filePath, content, 'utf8');
    }

    spinner.succeed(chalk.green('Configuration tokens replaced!'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to replace tokens'));
    throw error;
  }
}

export { replaceTokens, renamePaths, extractRealm };
