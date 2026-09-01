/**
 * Basic test file to validate the CLI structure.
 *
 * Compiled by `tsconfig.test.json` into `dist-test/` and run from there, against the build
 * output in `dist/` — so what is asserted is the artifact users actually install. Both
 * directories sit one level under the package root, which is why the relative paths below
 * resolve the same way from the source and from the compiled test.
 *
 * Run with: npm test
 */

import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as mainModule from '../dist/index.js';
import * as validators from '../dist/validators/validators.js';
import { cloneTemplate } from '../dist/template/cloner.js';
import { replaceTokens, renamePaths, extractRealm } from '../dist/template/token-replacer.js';
import { handleCIFiles } from '../dist/template/ci-configurator.js';
import { generateAppConfig } from '../dist/config/app-config-generator.js';

const __dirname = import.meta.dirname;

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'),
) as { name: string; bin: Record<string, string> };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

console.log('🧪 Running basic structure tests...\n');

// Test 1: Check package.json exists and is valid
try {
  const packagePath = path.join(__dirname, '../package.json');
  assert(fs.existsSync(packagePath), 'package.json should exist');

  assert(
    packageJson.name === 'spokay-app-starter-cli',
    'Package name should be spokay-app-starter-cli',
  );
  assert(
    packageJson.bin['spokay-app-starter'] === './dist/cli.js',
    'Binary should point to ./dist/cli.js',
  );

  console.log('✅ Test 1 passed: package.json is valid');
} catch (error) {
  console.error('❌ Test 1 failed:', messageOf(error));
  process.exit(1);
}

// Test 2: Check the built CLI entry point
try {
  const cliPath = path.join(__dirname, '../dist/cli.js');
  assert(fs.existsSync(cliPath), 'CLI entry point should exist');

  const cliContent = fs.readFileSync(cliPath, 'utf8');
  // tsc must preserve the shebang, or npm links a binary the shell cannot exec.
  assert(cliContent.includes('#!/usr/bin/env node'), 'CLI should have shebang');
  assert(cliContent.includes('commander'), 'CLI should use commander');

  console.log('✅ Test 2 passed: CLI entry point is valid');
} catch (error) {
  console.error('❌ Test 2 failed:', messageOf(error));
  process.exit(1);
}

// Test 3: Check the main module exposes the public API
try {
  assert(typeof mainModule.createProject === 'function', 'Should export createProject');
  assert(typeof mainModule.createFullstack === 'function', 'Should export createFullstack');
  assert(typeof mainModule.generate === 'function', 'Should export generate');
  assert(Array.isArray(mainModule.templateIds), 'Should export templateIds');

  console.log('✅ Test 3 passed: Main module exports the public API');
} catch (error) {
  console.error('❌ Test 3 failed:', messageOf(error));
  process.exit(1);
}

// Test 4: Check validators module
try {
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
  console.error('❌ Test 4 failed:', messageOf(error));
  process.exit(1);
}

// Test 5: Check template modules
try {
  assert(typeof cloneTemplate === 'function', 'Should export cloneTemplate function');
  assert(typeof replaceTokens === 'function', 'Should export replaceTokens function');
  assert(typeof handleCIFiles === 'function', 'Should export handleCIFiles function');
  assert(typeof extractRealm === 'function', 'Should export extractRealm function');
  assert(typeof renamePaths === 'function', 'Should export renamePaths function');

  // renamePaths must tolerate a template that declares renames for paths it does not have,
  // which is every template except the Java one.
  renamePaths(os.tmpdir(), [{ from: '__NOT_THERE__', to: 'somewhere' }]);

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
  console.error('❌ Test 5 failed:', messageOf(error));
  process.exit(1);
}

// Test 6: Check config module
try {
  assert(typeof generateAppConfig === 'function', 'Should export generateAppConfig function');

  console.log('✅ Test 6 passed: Config module exports correct functions');
} catch (error) {
  console.error('❌ Test 6 failed:', messageOf(error));
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
  console.error('❌ Test 7 failed:', messageOf(error));
  process.exit(1);
}

console.log('\n✅ All tests passed!\n');
