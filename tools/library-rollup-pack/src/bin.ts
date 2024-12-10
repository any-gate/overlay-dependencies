#!/usr/bin/env node
import { program } from 'commander';
import { getAllLibrary, getLibrarySelection } from './utils.js';

import inquirer from 'inquirer';
import { batchExecTask } from './pack.js';
import kleur from 'kleur';

program
  .command('build')
  .description('Build library for systemjs.')
  .action(async () => {
    process.env.NODE_ENV = 'production';
    const choices = getLibrarySelection();
    let libraries: string[] = [];

    try {
      const res = await inquirer.prompt({
        type: 'checkbox',
        message: 'Select library need pack',
        name: 'libraries',
        choices,
      });
      libraries = res.libraries;
    } catch (error: any) {
      if (error.name === 'ExitPromptError') {
        console.log('\nPrompt closed by user.');
        process.exit(0);
      } else {
        console.error('Unexpected error:', error);
        process.exit(1);
      }
    }
    const libraryMap = getAllLibrary().filter(({ folder }) =>
      libraries.includes(folder)
    );

    if (libraryMap.length === 0) {
      kleur.yellow('Please select library!');
      process.exit(1);
    }

    batchExecTask(libraryMap);
  });

program
  .command('publish')
  .description('Publish library to store.')
  .action(() => {
    // 1. 检查生成文件列表
    // 2. 生成 libb.manifest.json
  });

program.parse();
