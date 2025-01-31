#!/usr/bin/env node
import path from 'path';

import { ENTRY_FILE_NAME, OUTPUT_FILE_NAME } from './constants.js';

import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';

import kleur from 'kleur';
import { InputOptions, OutputOptions, rollup } from 'rollup';
import cleaner from 'rollup-plugin-cleaner';
import {
  getAllLibrary,
  getExternals,
  getOutputFolder,
  ManifestModel,
  updateDependencies,
} from './utils.js';
import ora from 'ora';

const extensions = ['.js', '.ts', '.json', '.tsx', '.jsx'];

const getInputOptions = (
  folder: string,
  manifest: ManifestModel
): InputOptions => {
  const external = Object.keys(manifest.dependencies || {});
  const res = {
    cache: false,
    input: path.join(folder, ENTRY_FILE_NAME),
    external,
    plugins: [
      typescript({ tsconfig: path.resolve('./tsconfig.json') }),
      cleaner({ targets: [getOutputFolder(manifest.name, manifest.version)] }),
      babel({
        extensions,
        babelHelpers: 'bundled',
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      }),
      nodeResolve({ extensions, preferBuiltins: true, browser: true }),
      replace({
        preventAssignment: true,
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      }),
      commonjs(),
    ],
  };

  return res;
};

const getOutputOptions = (
  manifest: ManifestModel
): (OutputOptions & { file: string })[] => {
  const res: (OutputOptions & { file: string })[] = [
    {
      format: 'system',
      file: path.join(
        getOutputFolder(manifest.name, manifest.version),
        OUTPUT_FILE_NAME
      ),
      sourcemap: true,
      // 命名后 systemjs 需要引入额外模块, 暂时不清楚作用
      // name: `${manifest.name}@${manifest.version}`,
      globals: getExternals(manifest),
    },
  ];
  return res;
};

function formatOutputFileLog(files: readonly string[]) {
  return files
    .map(
      file =>
        `      ${kleur
          .underline()
          .green(file.replace(path.resolve() + '/', ''))}`
    )
    .join('\n');
}



async function execTasks(
  tasks: {
    folder: string;
    manifest: ManifestModel;
  }[]
) {
  const task = tasks.shift();
  if (!task) process.exit(0);

  const { folder, manifest } = task;

  const libraries = [{ name: manifest.name, version: manifest.version }];

  // 判断是否存在子依赖
  if (manifest.dependencies) {
    Object.entries(manifest.dependencies).forEach(([libName, version]) => {
      return libraries.push({ name: libName, version });
    });
  }

  await updateDependencies([
    'add',
    ...libraries.map(({ name, version }) => `${name}@${version}`),
  ]);

  let bundle;
  const outputOptionsList = getOutputOptions(manifest);

  async function generateOutputs(bundle) {
    for (const outputOptions of outputOptionsList) {
      await bundle.write(outputOptions);
    }
  }

  try {
    const spinner = ora(kleur.blue(`Compiling`));
    spinner.start();

    bundle = await rollup(getInputOptions(folder, manifest));

    await generateOutputs(bundle);

    spinner.text = `${kleur.blue('Success!')}\n${formatOutputFileLog(
      outputOptionsList.map(output => output.file)
    )}`;
    spinner.succeed();
  } catch (error) {
    console.log(kleur.red(JSON.stringify(error)));
  }
  await updateDependencies(['remove', ...libraries.map(({ name }) => name)]);

  if (bundle) {
    await bundle.close();
  }

  execTasks(tasks);
}

export async function build({ folders }: { folders: string[] }) {
  const packLibraries = getAllLibrary().filter(({ folder }) =>
    folders.includes(folder)
  );

  await execTasks(packLibraries);
}
