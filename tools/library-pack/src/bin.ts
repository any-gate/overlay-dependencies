#!/usr/bin/env node
import { program } from 'commander';
import { getAllLibrary, getLibrarySelection } from './utils.js';

import inquirer from 'inquirer';
import { build } from './pack.js';
import kleur from 'kleur';

process.on('SIGINT', () => {
  console.log('\nProgram interrupted by Command + C (SIGINT).');
  process.exit(130);
});

program
  .command('build')
  .description('Build library for systemjs.')
  .action(async () => {
    process.env.NODE_ENV = 'production';
    const choices = getLibrarySelection();
    let libraries: string[] = [];

    const res = await inquirer
      .prompt({
        type: 'checkbox',
        message: 'Select library need pack',
        name: 'libraries',
        choices,
      })
      .catch(error => {
        if (error.isTtyError) {
          console.error(
            'Prompt could not be rendered in the current environment.'
          );
          process.exit(1);
        } else if (error.name === 'ExitPromptError') {
          console.log('\nProgram interrupted by Command + C (SIGINT).');
          process.exit(128 + 2);
        } else {
          console.error('Unexpected error:', error);
          process.exit(1);
        }
      });

    libraries = res.libraries;

    if (libraries.length === 0) {
      kleur.yellow('Please select library!');
      process.exit(1);
    }

    try {
      build({ folders: libraries });
    } catch (error) {
      console.log(
        kleur.red(
          error instanceof Error
            ? error.message
            : JSON.stringify(error, null, 2)
        )
      );
      process.exit(1);
    }
  });

program
  .command('publish')
  .description('Publish library to store.')
  .action(() => {
    // 1. 检查生成文件列表
    // 2. 生成 libb.manifest.json
  });

program.parse();
