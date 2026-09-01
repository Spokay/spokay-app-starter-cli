/**
 * Programmatic API. `src/cli.ts` is a thin argument parser over this; the run skill's
 * driver calls `generate` directly to exercise the pipeline without a TTY.
 */
export { generate, resolveNames, ensureTarget } from './generator.js';
export { templates, templateIds, getTemplate } from './templates/registry.js';
export { createProject } from './commands/create.js';
export { createFullstack, generateFullstack } from './commands/fullstack.js';
export { sharedQuestions } from './prompts/shared.js';
export { ask } from './prompts/ask.js';
