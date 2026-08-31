import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Generate app-config.json with user values
 * @param {string} targetPath - Path of the cloned project
 * @param {object} config - Configuration object
 */
function generateAppConfig(targetPath, config) {
  const spinner = ora('Generating app-config.json...').start();

  try {
    const appConfigPath = path.join(targetPath, 'public', 'assets', 'app-config.json');

    // Determine secureRoutes based on proxy configuration
    const secureRoutes = config.useProxy
      ? ['/api'] // Relative path for proxy setup
      : [config.resourceServerUrl]; // Full URL for direct calls

    // Create the config object
    const appConfig = {
      oidc: {
        authority: config.oidcAuthority,
        clientId: config.oidcClientId,
        redirectUrl: config.redirectUrl,
        postLogoutRedirectUri: config.redirectUrl,
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

    // Write the config file
    fs.writeFileSync(appConfigPath, JSON.stringify(appConfig, null, 2), 'utf8');

    spinner.succeed(chalk.green('app-config.json generated!'));
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate app-config.json'));
    throw error;
  }
}

export { generateAppConfig };
