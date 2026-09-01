import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

import type { ProjectAnswers } from '../types.js';

/**
 * Where the generated app calls its API.
 *
 * Not the resource server's origin: with the dev proxy on the app must go through the
 * proxy prefix, and with it off it must include the server's context path, or every call
 * lands one level above the controllers. `contextPath` is optional because a standalone
 * `create angular` run never asks for one — there `--backend-url` is already the API root.
 */
function apiBaseUrl(
  answers: Pick<ProjectAnswers, 'useProxy' | 'resourceServerUrl'> &
    Partial<Pick<ProjectAnswers, 'contextPath'>>,
): string {
  if (answers.useProxy) return '/api';
  const origin = answers.resourceServerUrl.replace(/\/+$/, '');
  const contextPath = (answers.contextPath ?? '').replace(/\/+$/, '');
  if (!contextPath) return origin;
  return contextPath.startsWith('/') ? `${origin}${contextPath}` : `${origin}/${contextPath}`;
}

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

    // The token is attached to exactly what the app calls, so both derive from one value.
    const apiRoot = apiBaseUrl(config);

    const appConfig = {
      oidc: {
        authority: config.oidcAuthority,
        clientId: config.oidcClientId,
        redirectUrl: config.frontendUrl,
        postLogoutRedirectUri: config.frontendUrl,
        scope: 'openid profile email',
        responseType: 'code',
        secureRoutes: [apiRoot],
      },
      resourceServer: {
        baseUrl: apiRoot,
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

export { generateAppConfig, apiBaseUrl };
