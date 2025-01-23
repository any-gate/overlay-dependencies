import inquirer from 'inquirer';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_DIR = path.resolve('./dependencies/libs');

async function main() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Name:',
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version:',
    },
  ]);

  let { name, version } = answers;

  name = name.trim();
  version = version.trim();

  const dest = path.resolve(SOURCE_DIR, name, version);

  fs.mkdirSync(dest, { recursive: true });

  fs.writeFileSync(
    path.resolve(dest, 'dep.manifest.yml'),
    `name: '${name}'
version: ${version}
schema: 1.0.0
`,
    { encoding: 'utf-8' }
  );
  fs.writeFileSync(
    path.resolve(dest, 'main.js'),
    `export * from '${name}';

export { default } from '${name}';

`,
    { encoding: 'utf-8' }
  );
  process.exit(0);
}

main();
