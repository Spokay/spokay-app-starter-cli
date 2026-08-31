import { angularTemplate } from './angular.js';
import { resourceServerTemplate } from './resource-server.js';

/**
 * Every template the CLI can scaffold. A template is plain data plus three functions
 * (`files`, `tokens`, optional `renames`), so adding a stack means adding an entry here,
 * not touching the generator.
 */
const templates = {
  [angularTemplate.id]: angularTemplate,
  [resourceServerTemplate.id]: resourceServerTemplate,
};

const templateIds = Object.keys(templates);

function getTemplate(id) {
  const template = templates[id];
  if (!template) {
    throw new Error(`Unknown template "${id}". Available: ${templateIds.join(', ')}`);
  }
  return template;
}

export { templates, templateIds, getTemplate };
