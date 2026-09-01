import inquirer from 'inquirer';
import type { PromptSession } from 'inquirer';

import type { ProjectAnswers, Question } from '../types.js';

/**
 * Ask only what is still unknown.
 *
 * Answers supplied as command-line flags are taken as given, so the CLI can run
 * unattended; `--yes` fills the rest from defaults. A question with neither a preset nor a
 * default cannot be answered without a human, so `--yes` reports it rather than scaffolding
 * a project with a blank OIDC authority.
 *
 * @param questions - inquirer questions, each with an optional `flag`
 * @param presets - answers already known, keyed by question name
 * @param useDefaults - `--yes`: do not prompt, take defaults
 */
async function ask(
  questions: readonly Question[],
  presets: Partial<ProjectAnswers> = {},
  useDefaults = false,
): Promise<ProjectAnswers> {
  const answers: Record<string, unknown> = { ...presets };
  const pending = questions.filter((q) => answers[q.name] === undefined);

  if (!useDefaults) {
    // `Question` is inquirer's own union narrowed to the fields this CLI sets, which the
    // library's discriminated question type will not accept as a heterogeneous array.
    const asked = await inquirer.prompt(
      pending.map(({ flag: _flag, ...question }) => question) as PromptSession<
        Partial<ProjectAnswers>
      >,
    );
    // The prompt layer is keyed by question name at runtime; this is where that shape is
    // asserted rather than proven. Every other module gets a real `ProjectAnswers`.
    return { ...answers, ...asked } as ProjectAnswers;
  }

  const unanswerable = pending.filter((q) => q.default === undefined);
  if (unanswerable.length) {
    const flags = unanswerable.map((q) => `--${toKebab(q.flag ?? q.name)}`).join(', ');
    throw new Error(`--yes needs these to be supplied as flags: ${flags}`);
  }
  for (const q of pending) answers[q.name] = q.default;
  return answers as ProjectAnswers;
}

const toKebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export { ask, toKebab };
