import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

import type { ProjectAnswers } from '../types.js';

/**
 * Write `public/assets/app-config.json`, the file the generated app fetches at runtime.
 *
 * The app is built once and deployed to many environments by swapping this file, so it is
 * generated from the answers rather than baked into the bundle.
 */
function generateAppConfig(targetPath: string, config: ProjectAnswers): void {
  const spinner = ora('Generating app-config.json...').start();

  try {
    const appConfigPath = path.join(targetPath, 'public', 'assets', 'app-config.json');

    // Relative path when the dev proxy is on, the full URL when requests go direct.
    const secureRoutes = config.useProxy ? ['/api'] : [config.resourceServerUrl];

    const appConfig = {
      oidc: {
        authority: config.oidcAuthority,
        clientId: config.oidcClientId,
        redirectUrl: config.frontendUrl,
        postLogoutRedirectUri: config.frontendUrl,
        scope: 'openid profile email',
        responseType: 'code',
        secureRoutes: secureRoutes,
      },
      resourceServer: {
        baseUrl: config.resourceServerUrl,
      },
    };

    // Ensure directory exists
    const appConfigDir = path.dirname(appConfigPath);
    if (!fs.existsSync(appConfigDir)) {
      fs.mkdirSync(appConfigDir, { recursive: true });
    }

    fs.writeFileSync(appConfigPath, JSON.stringify(appConfig, null, 2), 'utf8');

    spinner.succeed(chalk.green('app-config.json generated!'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate app-config.json'));
    throw error;
  }
}

export { generateAppConfig };
