import fs from 'fs';
import path from 'path';

import chalk from 'chalk';

import { cloneTemplate } from './template/cloner.js';
import { renamePaths, replaceTokens } from './template/token-replacer.js';
import { installDependencies } from './scaffold/dependency-installer.js';
import { toNpmPackageName } from './validators/validators.js';

/** Expand a template's `fileGlobs` (e.g. `src/**\/*.java`) into concrete relative paths. */
function expandGlobs(targetPath, globs = []) {
  const found = [];
  for (const glob of globs) {
    const [root, extension] = [glob.split('/**/')[0], path.extname(glob)];
    const base = path.join(targetPath, root);
    if (!fs.existsSync(base)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (full.endsWith(extension)) found.push(path.relative(targetPath, full));
      }
    };
    walk(base);
  }
  return found;
}

/**
 * Turn one template into a project. Everything stack-specific comes from the template
 * descriptor, so this pipeline never grows a branch per stack.
 *
 * @param {object} template - registry entry
 * @param {object} answers - merged shared + template-specific answers
 * @param {string} targetPath - where the project is written
 * @param {object} options - { templateUrl } to override the template repository
 */
async function generate(template, answers, targetPath, options = {}) {
  cloneTemplate(options.templateUrl || template.repo, targetPath);

  // Before replacement: sources must not be left in a directory that contradicts the
  // package they now declare.
  renamePaths(targetPath, template.renames?.(answers) ?? []);

  const files = [
    ...template.files(answers),
    ...expandGlobs(targetPath, template.fileGlobs?.(answers) ?? []),
  ];
  await replaceTokens(targetPath, template.tokens(answers), files);

  for (const step of template.postSteps ?? []) await step(targetPath, answers);

  const packageManager = template.install?.(answers);
  if (packageManager) await installDependencies(targetPath, { packageManager });

  return targetPath;
}

/**
 * Resolve a user-supplied display name into the pair the templates need: the name shown to
 * humans, and the npm/Maven-friendly identifier used for directories and artifact ids.
 */
function resolveNames(displayName) {
  const trimmed = displayName.trim();
  return { displayName: trimmed, packageName: toNpmPackageName(trimmed) };
}

/** Refuse to write over an existing directory unless the caller has cleared it. */
function ensureTarget(targetPath, { force = false } = {}) {
  if (!fs.existsSync(targetPath)) return;
  if (!force) {
    throw new Error(`Directory "${path.basename(targetPath)}" already exists`);
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(chalk.gray(`   removed existing ${targetPath}`));
}

export { generate, resolveNames, ensureTarget, expandGlobs };
