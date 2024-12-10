#!/usr/bin/env node
import path from 'path';

import {
  ENTRY_FILE_NAME,
  OUTPUT_FILE_NAME,
  OUTPUT_CSS_FILE_NAME,
} from './constants.js';

import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';

import child_process from 'node:child_process';
import kleur from 'kleur';
import { InputOptions, OutputOptions, rollup } from 'rollup';
import cleaner from 'rollup-plugin-cleaner';
import { getExternals, getOutputFolder, ManifestModel } from './utils.js';
import ora from 'ora';

const extensions = ['.js', '.ts', '.json', '.tsx', '.jsx'];

const getInputOptions = (
  folder: string,
  manifest: ManifestModel
): InputOptions => {
  const external = Object.keys(manifest.libs || {});
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

async function updateDependencies(libraries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn('pnpm', [...libraries], {
      stdio: 'inherit',
      cwd: path.resolve(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    child.on('close', code => {
      if (code !== 0) {
        reject();
        return;
      }
      resolve();
    });
  });
}

async function execTask({
  folder,
  manifest,
}: {
  folder: string;
  manifest: ManifestModel;
}) {
  const libraries = [{ name: manifest.name, version: manifest.version }];

  // 判断是否存在子依赖
  if (manifest.libs) {
    Object.entries(manifest.libs).forEach(([libName, version]) => {
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
}

export async function batchExecTask(
  packLibraries: {
    folder: string;
    manifest: ManifestModel;
  }[]
) {
  const task = packLibraries.shift();

  if (task) {
    await execTask(task);
    batchExecTask(packLibraries);
  } else {
    process.exit(0);
  }
}
