import fs, { writeFileSync } from 'fs';
import path, { resolve } from 'path';

import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import {
  MANIFEST_FILE_NAME,
  ENTRY_FILE_NAME,
  BUNDLE_DIR,
  OUTPUT_FILE_NAME,
  OUTPUT_CSS_FILE_NAME,
  BUNDLE_MANIFEST_NAME,
} from './constants.js';
import {
  getAllLibrary,
  getExternals,
  getOutputFolder,
  ManifestModel,
  readDirYml,
  updateDependencies,
  writeBundleManifest,
} from './utils.js';
import kleur from 'kleur';

import CompressionPlugin from 'compression-webpack-plugin';
import WebpackBar from 'webpackbar';

export const readLibMinifest = (folder: string) => {
  return readDirYml(resolve(folder, MANIFEST_FILE_NAME));
};

export const formatWebpackConfig = ({
  folder,
  manifest,
}: {
  folder: string;
  manifest: ManifestModel;
}) => {
  const plugins = [
    new MiniCssExtractPlugin({
      filename: OUTPUT_CSS_FILE_NAME,
    }),
    new CssMinimizerPlugin(),
    new WebpackBar({
      /* options */
    }),
    new CompressionPlugin({
      threshold: 12800, // 对大于 128kb 的文件进行压缩
    }),
  ];
  return {
    devtool: 'source-map',
    entry: resolve(folder, ENTRY_FILE_NAME),
    output: {
      filename: OUTPUT_FILE_NAME,
      path: getOutputFolder(manifest.name, manifest.version),
      libraryTarget: 'system',
      clean: true,
    },
    optimization: {
      minimize: true,
    },
    plugins,
    performance: {
      maxEntrypointSize: 2000000,
      maxAssetSize: 2000000,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    externals: getExternals(manifest),
    module: {
      rules: [
        {
          test: /\.(js|mjs)$/,
          use: [
            {
              loader: require.resolve('babel-loader'),
              options: {
                cacheDirectory: true,
                cacheCompression: false,
                compact: false,
              },
            },
            {
              loader: require.resolve('source-map-loader'),
            },
          ],
        },
        {
          test: /\.ts?$/,
          use: [
            require.resolve('babel-loader'),
            require.resolve('ts-loader'),
            {
              loader: require.resolve('source-map-loader'),
            },
          ],
          parser: {
            system: false,
          },
        },
        {
          test: /\.(css)$/,
          // sideEffects: true,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: require.resolve('css-loader'),
            },
            {
              loader: require.resolve('postcss-loader'),
              options: {
                postcssOptions: {
                  plugins: ['postcss-preset-env'],
                },
              },
            },
          ],
        },
      ],
    },
  };
};

async function execTask(task: {
  folder: string;
  manifest: ManifestModel;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { manifest } = task;
    const webpackConfig = formatWebpackConfig(task);

    const compiler = webpack(webpackConfig);

    compiler.run((error: any, stats: any) => {
      if (error) {
        reject(new Error(error.message));
        return;
      }
      const info = stats.toJson();
      if (stats?.hasErrors()) {
        reject(info.errors);
        return;
      }
      // if (stats.hasWarnings()) {
      //   console.warn(info.warnings);
      // }
      // 导出 dep.manifest.yml 文件
      writeBundleManifest(manifest);

      compiler.close(closeErr => {
        if (closeErr) {
          reject(closeErr);
        } else {
          resolve('complete');
        }
      });
    });
  });
}

async function execTasks(
  tasks: {
    folder: string;
    manifest: ManifestModel;
  }[]
) {
  const task = tasks.shift();
  if (!task) process.exit(0);

  const { manifest } = task;
  const libraries = [{ name: manifest.name, version: manifest.version }];

  if (manifest.dependences) {
    Object.entries(manifest.dependences).forEach(([name, version]) => {
      libraries.push({ name, version });
    });
  }

  await updateDependencies([
    'add',
    ...libraries.map(({ name, version }) => `${name}@${version}`),
  ]);

  try {
    await execTask(task);
  } catch (error) {
    console.log(
      error instanceof Error
        ? kleur.red('[Error]: ' + error.message)
        : console.log(kleur.red(JSON.stringify(error, null, 2)))
    );
  }

  await updateDependencies(['remove', ...libraries.map(({ name }) => name)]);

  execTasks(tasks);
}

export async function build({ folders }: { folders: string[] }) {
  const packLibraries = getAllLibrary().filter(({ folder }) =>
    folders.includes(folder)
  );

  await execTasks(packLibraries);
}
