import inquirer from 'inquirer';

/**
 * Ask only what is still unknown.
 *
 * Answers supplied as command-line flags are taken as given, so the CLI can run
 * unattended; `--yes` fills the rest from defaults. A question with neither a preset nor a
 * default cannot be answered without a human, so `--yes` reports it rather than scaffolding
 * a project with a blank OIDC authority.
 *
 * @param {Array<object>} questions - inquirer questions, each with an optional `flag`
 * @param {object} presets - answers already known, keyed by question name
 * @param {boolean} useDefaults - `--yes`: do not prompt, take defaults
 */
async function ask(questions, presets = {}, useDefaults = false) {
  const answers = { ...presets };
  const pending = questions.filter((q) => answers[q.name] === undefined);

  if (!useDefaults) {
    const asked = await inquirer.prompt(pending.map(({ flag: _flag, ...q }) => q));
    return { ...answers, ...asked };
  }

  const unanswerable = pending.filter((q) => q.default === undefined);
  if (unanswerable.length) {
    const flags = unanswerable.map((q) => `--${toKebab(q.flag ?? q.name)}`).join(', ');
    throw new Error(`--yes needs these to be supplied as flags: ${flags}`);
  }
  for (const q of pending) answers[q.name] = q.default;
  return answers;
}

const toKebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export { ask, toKebab };
