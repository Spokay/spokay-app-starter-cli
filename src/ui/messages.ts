import chalk from 'chalk';

/** Print the CLI header. */
function printHeader(): void {
  console.log(chalk.blue.bold('\n🚀 Angular Starter CLI\n'));
}

/** Print an error message. */
function printError(message: string): void {
  console.error(chalk.red(`\n❌ Error: ${message}\n`));
}

export { printHeader, printError };
