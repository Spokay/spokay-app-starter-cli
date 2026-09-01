import { angularTemplate } from './angular.js';
import { resourceServerTemplate } from './resource-server.js';
import type { TemplateDescriptor } from '../types.js';

/**
 * Every template the CLI can scaffold. A template is plain data plus three functions
 * (`files`, `tokens`, optional `renames`), so adding a stack means adding an entry here,
 * not touching the generator.
 */
const templates: Record<string, TemplateDescriptor> = {
  [angularTemplate.id]: angularTemplate,
  [resourceServerTemplate.id]: resourceServerTemplate,
};

const templateIds: string[] = Object.keys(templates);

function getTemplate(id: string): TemplateDescriptor {
  const template = templates[id];
  if (!template) {
    throw new Error(`Unknown template "${id}". Available: ${templateIds.join(', ')}`);
  }
  return template;
}

export { templates, templateIds, getTemplate };
