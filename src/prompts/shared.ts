import { validateClientId, validateOidcAuthority, validateUrl } from '../validators/validators.js';
import type { Question } from '../types.js';

/**
 * Questions whose answer is the same for every template in one run. The fullstack command
 * asks these once and hands the answers to both templates, which is what keeps a generated
 * pair pointing at the same identity provider.
 */
const sharedQuestions: readonly Question[] = [
  {
    type: 'input',
    name: 'oidcAuthority',
    flag: 'oidcAuthority',
    message: 'What is your OIDC authority URL?',
    validate: validateOidcAuthority,
  },
  {
    type: 'input',
    name: 'oidcClientId',
    flag: 'clientId',
    message: 'What is your OIDC client ID?',
    validate: validateClientId,
  },
  {
    type: 'input',
    name: 'frontendUrl',
    flag: 'frontendUrl',
    message: 'Where will the frontend be served?',
    default: 'http://localhost:4200',
    validate: (input) => validateUrl(input, 'Frontend URL'),
  },
  {
    type: 'input',
    name: 'resourceServerUrl',
    flag: 'backendUrl',
    message: 'Where will the resource server be served?',
    default: 'http://localhost:8080',
    validate: (input) => validateUrl(input, 'Resource server URL'),
  },
];

export { sharedQuestions };
