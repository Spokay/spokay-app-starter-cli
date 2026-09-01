import { validateRequired } from '../validators/validators.js';
import type { TemplateDescriptor } from '../types.js';

/** `com.acme.api` -> `com/acme/api` */
const packageToPath = (pkg: string): string => pkg.split('.').join('/');

const resourceServerTemplate = {
  id: 'resource-server',
  label: 'Spring Boot 4 OAuth2 resource server',
  repo: 'https://github.com/Spokay/resource-server-template.git',

  questions: [
    {
      type: 'input',
      name: 'groupId',
      flag: 'groupId',
      message: 'Maven groupId?',
      default: 'com.example',
      validate: (input) => validateRequired(input, 'groupId'),
    },
    {
      type: 'input',
      name: 'basePackage',
      flag: 'basePackage',
      message: 'Base Java package?',
      default: 'com.example.api',
      validate: (input) =>
        /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test((input ?? '').trim()) ||
        'Must be a valid Java package, e.g. com.example.api',
    },
    {
      type: 'input',
      name: 'javaVersion',
      flag: 'javaVersion',
      message: 'Which Java version?',
      default: '25',
      validate: (input) => validateRequired(input, 'Java version'),
    },
    {
      type: 'input',
      name: 'contextPath',
      flag: 'contextPath',
      message: 'Servlet context path?',
      default: '/api',
    },
  ],

  files: () => [
    'pom.xml',
    'README.md',
    'src/main/resources/application.properties',
    'src/main/resources/application-dev.properties',
    '.github/workflows/ci.yml',
  ],

  // Java sources carry `package __BASE_PACKAGE__;` and live under a directory of that
  // literal name, so every .java file needs replacing and the directory needs moving.
  fileGlobs: () => ['src/**/*.java'],

  renames: (answers) => [
    {
      from: 'src/main/java/__BASE_PACKAGE__',
      to: `src/main/java/${packageToPath(answers.basePackage)}`,
    },
    {
      from: 'src/test/java/__BASE_PACKAGE__',
      to: `src/test/java/${packageToPath(answers.basePackage)}`,
    },
  ],

  tokens: (answers) => ({
    __BASE_PACKAGE__: answers.basePackage,
    __GROUP_ID__: answers.groupId,
    __ARTIFACT_ID__: answers.packageName,
    __APP_DISPLAY_NAME__: answers.displayName,
    __JAVA_VERSION__: answers.javaVersion,
    __SERVER_PORT__: new URL(answers.resourceServerUrl).port || '8080',
    __CONTEXT_PATH__: answers.contextPath,
    __OIDC_AUTHORITY__: answers.oidcAuthority,
    __CLIENT_ID__: answers.oidcClientId,
    __CORS_ALLOWED_ORIGINS__: answers.frontendUrl,
  }),

  postSteps: [],
  install: () => null, // Maven resolves on first build; nothing to install up front
} satisfies TemplateDescriptor;

export { resourceServerTemplate, packageToPath };
