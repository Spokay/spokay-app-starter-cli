# Examples

This directory contains examples of how to use the angular-starter-cli tool.

## Basic Usage

### Create a project with default template

```bash
angular-starter-oidc create my-app
```

This will prompt you to enter a template URL.

### Create a project with a specific template

```bash
angular-starter-oidc create my-app --template https://github.com/angular/quickstart
```

### Create a project in a specific directory

```bash
angular-starter-oidc create my-app --template https://github.com/angular/quickstart --path ./projects
```

## Advanced Usage

### Using a custom template repository

You can use any Git repository as a template:

```bash
angular-starter-oidc create my-app --template https://github.com/yourusername/your-angular-template
```

### Template Requirements

Your template repository should:
- Be a valid Git repository
- Contain a `package.json` file (optional, but recommended)
- Include Angular project structure

## Configuration File Examples

### Simple Configuration

Create a `.angular-starter.json` file:

```json
{
  "defaultTemplate": "https://github.com/angular/quickstart"
}
```

### Multiple Template Presets

```json
{
  "defaultTemplate": "https://github.com/angular/quickstart",
  "templates": {
    "basic": "https://github.com/angular/quickstart",
    "material": "https://github.com/yourusername/your-material-template",
    "enterprise": "https://github.com/yourusername/enterprise-template"
  }
}
```

## Workflow Example

1. Install the CLI globally:
   ```bash
   npm install -g angular-starter-cli
   ```

2. Create a new project:
   ```bash
   angular-starter-oidc create my-awesome-app
   ```

3. Enter template URL when prompted or use `--template` flag

4. Navigate to your project and install dependencies:
   ```bash
   cd my-awesome-app
   npm install
   ```

5. Start development:
   ```bash
   npm start
   ```
