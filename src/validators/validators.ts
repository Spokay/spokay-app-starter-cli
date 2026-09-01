/**
 * Validation functions for CLI inputs.
 *
 * The `validate*` functions return `true` when the input is acceptable and the message to
 * show otherwise, which is the contract inquirer expects of a question's `validate`.
 */

/**
 * Convert a display name to an npm-friendly package name.
 * - `"My Awesome App"` -> `"my-awesome-app"`
 * - `"MyAwesomeApp"` -> `"my-awesome-app"`
 * - `"my_awesome_app"` -> `"my-awesome-app"`
 */
function toNpmPackageName(displayName: string): string {
  return (
    displayName
      .trim()
      // Replace spaces, underscores, and camelCase boundaries with hyphens
      .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab-case
      .replace(/[\s_]+/g, '-') // spaces and underscores to hyphens
      .toLowerCase() // lowercase
      .replace(/[^a-z0-9-]/g, '') // remove invalid characters
      .replace(/-+/g, '-') // collapse multiple hyphens
      .replace(/^-|-$/g, '')
  ); // trim leading/trailing hyphens
}

/** npm package name rules: lowercase, no spaces, hyphens and numbers allowed. */
function isValidNpmPackageName(name: string): boolean {
  return /^[a-z0-9-]+$/.test(name);
}

/** Whether a display name converts to a usable npm package name. */
function isValidDisplayName(displayName: string): boolean {
  if (!displayName || displayName.trim() === '') {
    return false;
  }
  // Check if the converted name would be valid
  const packageName = toNpmPackageName(displayName);
  return packageName.length > 0 && isValidNpmPackageName(packageName);
}

/**
 * Whether the URL is one `git clone` can be handed safely.
 *
 * Only HTTPS, SSH and the git protocol match — filesystem paths and `file://` are rejected
 * on purpose, so a template URL can never name a local path or smuggle in a git option.
 */
function isValidGitUrl(url: string): boolean {
  const gitUrlPattern =
    /^(https?:\/\/|git@|git:\/\/)[\w.@:/~-]+\.git$|^(https?:\/\/|git@|git:\/\/)[\w.@:/~-]+$/i;
  return gitUrlPattern.test(url);
}

/** HTTPS everywhere, except localhost where HTTP is how an IdP is actually run. */
function validateOidcAuthority(input: string): boolean | string {
  if (!input || input.trim() === '') {
    return 'OIDC authority URL is required';
  }
  if (!input.match(/^https:\/\/.+/) && !input.match(/^http:\/\/localhost/)) {
    return 'OIDC authority must be a valid HTTPS URL (or HTTP for localhost)';
  }
  return true;
}

function validateClientId(input: string): boolean | string {
  if (!input || input.trim() === '') {
    return 'OIDC client ID is required';
  }
  return true;
}

function validateUrl(input: string, fieldName = 'URL'): boolean | string {
  if (!input || input.trim() === '') {
    return `${fieldName} is required`;
  }
  if (!input.match(/^https?:\/\/.+/)) {
    return `${fieldName} must be a valid URL`;
  }
  return true;
}

function validateRequired(input: string, fieldName = 'Field'): boolean | string {
  if (!input || input.trim() === '') {
    return `${fieldName} is required`;
  }
  return true;
}

export {
  toNpmPackageName,
  isValidNpmPackageName,
  isValidDisplayName,
  isValidGitUrl,
  validateOidcAuthority,
  validateClientId,
  validateUrl,
  validateRequired,
};
