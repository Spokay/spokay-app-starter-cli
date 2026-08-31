/**
 * Basic test file to validate the CLI structure
 * Run with: node test/basic-test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 Running basic structure tests...\n');

// Test 1: Check package.json exists and is valid
try {
  const packagePath = path.join(__dirname, '../package.json');
  assert(fs.existsSync(packagePath), 'package.json should exist');

  const packageJson = require('../package.json');
  assert(
    packageJson.name === 'angular-starter-oidc-cli',
    'Package name should be angular-starter-oidc-cli',
  );
  assert(
    packageJson.bin['angular-starter-oidc'] === './bin/cli.js',
    'Binary should point to ./bin/cli.js',
  );

  console.log('✅ Test 1 passed: package.json is valid');
} catch (error) {
  console.error('❌ Test 1 failed:', error.message);
  process.exit(1);
}

// Test 2: Check CLI entry point exists
try {
  const cliPath = path.join(__dirname, '../bin/cli.js');
  assert(fs.existsSync(cliPath), 'CLI entry point should exist');

  const cliContent = fs.readFileSync(cliPath, 'utf8');
  assert(cliContent.includes('#!/usr/bin/env node'), 'CLI should have shebang');
  assert(cliContent.includes('commander'), 'CLI should use commander');

  console.log('✅ Test 2 passed: CLI entry point is valid');
} catch (error) {
  console.error('❌ Test 2 failed:', error.message);
  process.exit(1);
}

// Test 3: Check main module exists and exports createAngularStarter
try {
  const mainModule = require('../src/index.js');
  assert(
    typeof mainModule.createAngularStarter === 'function',
    'Should export createAngularStarter function',
  );

  console.log('✅ Test 3 passed: Main module exports createAngularStarter function');
} catch (error) {
  console.error('❌ Test 3 failed:', error.message);
  process.exit(1);
}

// Test 4: Check validators module
try {
  const validators = require('../src/validators/validators.js');
  assert(typeof validators.isValidGitUrl === 'function', 'Should export isValidGitUrl function');
  assert(
    typeof validators.isValidNpmPackageName === 'function',
    'Should export isValidNpmPackageName function',
  );
  assert(
    typeof validators.toNpmPackageName === 'function',
    'Should export toNpmPackageName function',
  );
  assert(
    typeof validators.isValidDisplayName === 'function',
    'Should export isValidDisplayName function',
  );

  // Test URL validation
  assert(
    validators.isValidGitUrl('https://github.com/user/repo.git') === true,
    'Should accept valid HTTPS git URL',
  );
  assert(
    validators.isValidGitUrl('git@github.com:user/repo.git') === true,
    'Should accept valid SSH git URL',
  );
  assert(
    validators.isValidGitUrl('https://github.com/user/repo') === true,
    'Should accept valid HTTPS URL without .git',
  );
  assert(validators.isValidGitUrl('invalid url') === false, 'Should reject invalid URL');
  assert(validators.isValidGitUrl('') === false, 'Should reject empty URL');

  // Test npm package name validation
  assert(validators.isValidNpmPackageName('my-app') === true, 'Should accept valid package name');
  assert(
    validators.isValidNpmPackageName('my-app-123') === true,
    'Should accept package name with numbers',
  );
  assert(validators.isValidNpmPackageName('MyApp') === false, 'Should reject uppercase letters');
  assert(validators.isValidNpmPackageName('my app') === false, 'Should reject spaces');
  assert(validators.isValidNpmPackageName('my_app') === false, 'Should reject underscores');

  // Test display name to package name conversion
  assert(
    validators.toNpmPackageName('My Awesome App') === 'my-awesome-app',
    'Should convert spaces to hyphens and lowercase',
  );
  assert(
    validators.toNpmPackageName('MyAwesomeApp') === 'my-awesome-app',
    'Should convert camelCase to kebab-case',
  );
  assert(
    validators.toNpmPackageName('my_awesome_app') === 'my-awesome-app',
    'Should convert underscores to hyphens',
  );
  assert(validators.toNpmPackageName('My-App!') === 'my-app', 'Should remove invalid characters');
  assert(validators.toNpmPackageName('  My  App  ') === 'my-app', 'Should handle extra spaces');
  assert(validators.toNpmPackageName('my---app') === 'my-app', 'Should collapse multiple hyphens');

  // Test display name validation
  assert(
    validators.isValidDisplayName('My Awesome App') === true,
    'Should accept display name with spaces',
  );
  assert(validators.isValidDisplayName('MyApp') === true, 'Should accept camelCase display name');
  assert(validators.isValidDisplayName('my-app') === true, 'Should accept kebab-case display name');
  assert(validators.isValidDisplayName('') === false, 'Should reject empty string');
  assert(validators.isValidDisplayName('   ') === false, 'Should reject only spaces');
  assert(validators.isValidDisplayName('!@#') === false, 'Should reject only special characters');

  console.log('✅ Test 4 passed: Validators module works correctly');
} catch (error) {
  console.error('❌ Test 4 failed:', error.message);
  process.exit(1);
}

// Test 5: Check template modules
try {
  const { cloneTemplate } = require('../src/template/cloner.js');
  const { replaceTokens, extractRealm } = require('../src/template/token-replacer.js');
  const { handleCIFiles } = require('../src/template/ci-configurator.js');

  assert(typeof cloneTemplate === 'function', 'Should export cloneTemplate function');
  assert(typeof replaceTokens === 'function', 'Should export replaceTokens function');
  assert(typeof handleCIFiles === 'function', 'Should export handleCIFiles function');
  assert(typeof extractRealm === 'function', 'Should export extractRealm function');

  // Test realm extraction
  assert(
    extractRealm('https://idp.example.com/realms/test-realm') === 'test-realm',
    'Should extract realm from URL',
  );
  assert(
    extractRealm('https://idp.example.com') === 'my-realm',
    'Should return default realm if not found',
  );

  console.log('✅ Test 5 passed: Template modules export correct functions');
} catch (error) {
  console.error('❌ Test 5 failed:', error.message);
  process.exit(1);
}

// Test 6: Check config module
try {
  const { generateAppConfig } = require('../src/config/app-config-generator.js');
  assert(typeof generateAppConfig === 'function', 'Should export generateAppConfig function');

  console.log('✅ Test 6 passed: Config module exports correct functions');
} catch (error) {
  console.error('❌ Test 6 failed:', error.message);
  process.exit(1);
}

// Test 7: Check .gitignore exists
try {
  const gitignorePath = path.join(__dirname, '../.gitignore');
  assert(fs.existsSync(gitignorePath), '.gitignore should exist');

  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  assert(gitignoreContent.includes('node_modules'), '.gitignore should include node_modules');

  console.log('✅ Test 7 passed: .gitignore is valid');
} catch (error) {
  console.error('❌ Test 7 failed:', error.message);
  process.exit(1);
}

console.log('\n✅ All tests passed!\n');
