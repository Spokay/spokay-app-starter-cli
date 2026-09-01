/**
 * The contracts the pipeline shares: what a template descriptor is, what a question is,
 * and the answers object that travels from the prompts to the token maps.
 */

/**
 * The valid values, as data. The prompt `choices` and the command-line `--pkg` / `--vcs`
 * validation both read these, so the two cannot drift apart and let a flag through that a
 * prompt would have rejected.
 */
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn'] as const;
export const VCS_HOSTS = ['github', 'gitlab'] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];
export type VcsHost = (typeof VCS_HOSTS)[number];

/**
 * Everything a template can read off the answers object.
 *
 * Deliberately one flat shape with no optional fields, rather than a type per template.
 * A single-template run genuinely lacks the other template's answers — `create angular`
 * never asks for a groupId — but the Angular descriptor never reads one either, so the
 * missing key is unobservable. Splitting this into `AngularAnswers` / `ResourceServerAnswers`
 * would push a generic parameter through the registry and the generator to describe a
 * distinction no code makes; making the fields optional would force a `!` at every token.
 *
 * The cost is a cast in `ask()`, where answers come back from inquirer keyed by question
 * name. That boundary is runtime-shaped by nature, so the cast is where the honesty is.
 *
 * Written as a type alias rather than an interface on purpose: an alias gets an implicit
 * index signature, which is what lets it satisfy inquirer's `Answers` constraint.
 */
export type ProjectAnswers = {
  /** The project name as the user typed it. */
  displayName: string;
  /** npm/Maven-friendly identifier derived from it; also the directory name. */
  packageName: string;

  // Shared: asked once, and by the fullstack command written into both projects.
  oidcAuthority: string;
  oidcClientId: string;
  frontendUrl: string;
  resourceServerUrl: string;

  // Angular.
  useProxy: boolean;
  vcsHost: VcsHost;
  packageManager: PackageManager;
  nodeVersion: string;

  // Resource server.
  groupId: string;
  basePackage: string;
  javaVersion: string;
  contextPath: string;
};

/**
 * An inquirer question, narrowed to the prompt types this CLI uses, plus the `flag` that
 * ties it to a command-line option. inquirer 14 removed the legacy `list` type; `select`
 * is its replacement.
 */
export interface Question {
  type: 'input' | 'confirm' | 'select' | 'checkbox' | 'number' | 'password' | 'search';
  /** Must name a field of the answers object — that is how presets and prompts meet. */
  name: keyof ProjectAnswers;
  /** The command-line option that answers this question without prompting. */
  flag?: string;
  message: string;
  default?: string | boolean;
  choices?: readonly string[];
  validate?: (input: string) => boolean | string;
}

/** A directory move applied to the clone before token replacement. */
export interface Rename {
  from: string;
  to: string;
}

/** Work a template needs after replacement: CI selection, generated files, deletions. */
export type PostStep = (targetPath: string, answers: ProjectAnswers) => void | Promise<void>;

/**
 * One stack, as data. The generator reads this and nothing else, which is what keeps it
 * free of a branch per template.
 */
export interface TemplateDescriptor {
  id: string;
  label: string;
  repo: string;
  questions: readonly Question[];
  /** Files to run replacement over, project-relative. Missing ones are skipped. */
  files(answers: ProjectAnswers): string[];
  /** Globs for the same, e.g. `src/**\/*.java`. */
  fileGlobs?(answers: ProjectAnswers): string[];
  /** Applied *before* replacement — see `renamePaths`. */
  renames?(answers: ProjectAnswers): Rename[];
  tokens(answers: ProjectAnswers): Record<string, string>;
  postSteps?: readonly PostStep[];
  /** The package manager to install with, or `null` when there is nothing to install. */
  install?(answers: ProjectAnswers): PackageManager | null;
}

/**
 * The flags every create-style command accepts.
 *
 * `vcs` and `pkg` are plain strings: commander does not validate them, so claiming
 * `VcsHost`/`PackageManager` here would assert a check that does not happen.
 * `proxy` and `git` come from the negated options `--no-proxy` / `--no-git`, so they carry
 * a commander default and are only meaningful together with `getOptionValueSource`.
 */
export interface CreateOptions {
  path?: string;
  template?: string;
  oidcAuthority?: string;
  clientId?: string;
  frontendUrl?: string;
  backendUrl?: string;
  vcs?: string;
  pkg?: string;
  nodeVersion?: string;
  proxy?: boolean;
  groupId?: string;
  basePackage?: string;
  javaVersion?: string;
  contextPath?: string;
  yes?: boolean;
  force?: boolean;
  git?: boolean;
}
