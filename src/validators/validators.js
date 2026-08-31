/**
 * Validation functions for CLI inputs
 */

/**
 * Convert a display name to an npm-friendly package name
 * Examples:
 * - "My Awesome App" -> "my-awesome-app"
 * - "MyAwesomeApp" -> "my-awesome-app"
 * - "my_awesome_app" -> "my-awesome-app"
 * @param {string} displayName - Display name to convert
 * @returns {string} npm-friendly package name
 */
function toNpmPackageName(displayName) {
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

/**
 * Validate if project name is a valid npm package name
 * @param {string} name - Project name to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidNpmPackageName(name) {
  // npm package name rules: lowercase, no spaces, can contain hyphens and numbers
  return /^[a-z0-9-]+$/.test(name);
}

/**
 * Validate if display name can be converted to a valid npm package name
 * @param {string} displayName - Display name to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidDisplayName(displayName) {
  if (!displayName || displayName.trim() === '') {
    return false;
  }
  // Check if the converted name would be valid
  const packageName = toNpmPackageName(displayName);
  return packageName.length > 0 && isValidNpmPackageName(packageName);
}

/**
 * Validate if the URL is a valid Git repository URL
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidGitUrl(url) {
  // Allow HTTPS, SSH, and Git protocol URLs
  const gitUrlPattern =
    /^(https?:\/\/|git@|git:\/\/)[\w\.\-@:\/~]+\.git$|^(https?:\/\/|git@|git:\/\/)[\w\.\-@:\/~]+$/i;
  return gitUrlPattern.test(url);
}

/**
 * Validate OIDC authority URL
 * @param {string} input - URL to validate
 * @returns {boolean|string} True if valid, error message otherwise
 */
function validateOidcAuthority(input) {
  if (!input || input.trim() === '') {
    return 'OIDC authority URL is required';
  }
  // Allow http for localhost, require https otherwise
  if (!input.match(/^https:\/\/.+/) && !input.match(/^http:\/\/localhost/)) {
    return 'OIDC authority must be a valid HTTPS URL (or HTTP for localhost)';
  }
  return true;
}

/**
 * Validate OIDC client ID
 * @param {string} input - Client ID to validate
 * @returns {boolean|string} True if valid, error message otherwise
 */
function validateClientId(input) {
  if (!input || input.trim() === '') {
    return 'OIDC client ID is required';
  }
  return true;
}

/**
 * Validate URL format
 * @param {string} input - URL to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {boolean|string} True if valid, error message otherwise
 */
function validateUrl(input, fieldName = 'URL') {
  if (!input || input.trim() === '') {
    return `${fieldName} is required`;
  }
  if (!input.match(/^https?:\/\/.+/)) {
    return `${fieldName} must be a valid URL`;
  }
  return true;
}

/**
 * Validate required field
 * @param {string} input - Input to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {boolean|string} True if valid, error message otherwise
 */
function validateRequired(input, fieldName = 'Field') {
  if (!input || input.trim() === '') {
    return `${fieldName} is required`;
  }
  return true;
}

module.exports = {
  toNpmPackageName,
  isValidNpmPackageName,
  isValidDisplayName,
  isValidGitUrl,
  validateOidcAuthority,
  validateClientId,
  validateUrl,
  validateRequired,
};
