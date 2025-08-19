#!/usr/bin/env node
import { program } from 'commander';
import { getLibrarySelection, getAllLibrary } from './utils.js';

import inquirer from 'inquirer';
import { build } from './pack.js';
import kleur from 'kleur';

process.on('SIGINT', () => {
  console.log('\nProgram interrupted by Command + C (SIGINT).');
  process.exit(128 + 2);
});

program
  .command('build')
  .description('Build library for systemjs.')
  .option('--all', 'Build all libraries')
  .argument('[libraries...]', 'Library names in format: library_name@version')
  .action(async (libraryArgs: string[], options: { all?: boolean }) => {
    process.env.NODE_ENV = 'production';
    let libraries: string[] = [];

    if (options.all) {
      // Build all libraries
      const allLibraries = getAllLibrary();
      libraries = allLibraries.map(lib => lib.folder);
      console.log(kleur.blue(`Building all libraries (${libraries.length} found):`));
      allLibraries.forEach(lib => {
        console.log(kleur.gray(`  - ${lib.manifest.name}@${lib.manifest.version}`));
      });
    } else if (libraryArgs.length > 0) {
      // Build specific libraries from command line arguments
      const allLibraries = getAllLibrary();
      const libraryMap = new Map();
      
      // Create a map for quick lookup: "name@version" -> folder path
      allLibraries.forEach(lib => {
        libraryMap.set(`${lib.manifest.name}@${lib.manifest.version}`, lib.folder);
      });

      // Resolve library arguments to folder paths
      const notFoundLibraries: string[] = [];
      libraryArgs.forEach(arg => {
        if (libraryMap.has(arg)) {
          libraries.push(libraryMap.get(arg));
        } else {
          notFoundLibraries.push(arg);
        }
      });

      if (notFoundLibraries.length > 0) {
        console.error(kleur.red('The following libraries were not found:'));
        notFoundLibraries.forEach(lib => {
          console.error(kleur.red(`  - ${lib}`));
        });
        console.log(kleur.yellow('Available libraries:'));
        allLibraries.forEach(lib => {
          console.log(kleur.gray(`  - ${lib.manifest.name}@${lib.manifest.version}`));
        });
        process.exit(1);
      }

      console.log(kleur.blue(`Building specified libraries (${libraries.length} found):`));
      libraries.forEach(folder => {
        const lib = allLibraries.find(l => l.folder === folder);
        if (lib) {
          console.log(kleur.gray(`  - ${lib.manifest.name}@${lib.manifest.version}`));
        }
      });
    } else {
      // Interactive mode (original behavior)
      const choices = getLibrarySelection();

      const res = await inquirer
        .prompt({
          type: 'checkbox',
          message: 'Select library need pack',
          name: 'libraries',
          choices,
          pageSize: 20,
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
    }

    if (libraries.length === 0) {
      console.log(kleur.yellow('No libraries to build!'));
      process.exit(1);
    }

    try {
      await build({ folders: libraries });
      console.log(kleur.green(`✅ Successfully built ${libraries.length} libraries`));
      process.exit(0);
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
