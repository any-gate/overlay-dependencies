import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

import webpack from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import {
  MANIFEST_FILE_NAME,
  ENTRY_FILE_NAME,
  OUTPUT_FILE_NAME,
  OUTPUT_CSS_FILE_NAME,
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
  return readDirYml(path.resolve(folder, MANIFEST_FILE_NAME));
};

export const formatWebpackConfig = ({
  folder,
  manifest,
}: {
  folder: string;
  manifest: ManifestModel;
}): webpack.Configuration => {
  const plugins = [
    new MiniCssExtractPlugin({
      filename: OUTPUT_CSS_FILE_NAME,
    }),
    new CssMinimizerPlugin(),
    new WebpackBar({
      color: '#9ff552',
    }),
    new CompressionPlugin({
      threshold: 12800, // 对大于 128kb 的文件进行压缩
    }),
    // 添加以下插件，强制所有模块打包到主文件
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ];
  return {
    stats: {
      all: false,
      errors: true,
      warnings: false,
      modules: false,
      assets: true,
    },
    mode: 'production' as 'production',
    devtool: 'source-map',
    entry: path.resolve(folder, ENTRY_FILE_NAME),
    output: {
      filename: OUTPUT_FILE_NAME,
      path: getOutputFolder(manifest.name, manifest.version),
      libraryTarget: 'system',
      clean: true,
    },
    optimization: {
      minimize: true,
      // splitChunks: false,
      // runtimeChunk: false,
    },
    // experiments: {
    //   outputModule: false,
    // },
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
          test: /\.less$/i,
          use: [require.resolve('css-loader'), require.resolve('less-loader')],
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

async function runPostBuildScript(
  folder: string,
  manifest: ManifestModel
): Promise<void> {
  return new Promise((resolve, _reject) => {
    const postBuildScript = path.resolve(folder, 'postbuild.js');
    if (!fs.existsSync(postBuildScript)) {
      resolve();
      return;
    }
    const outputPath = getOutputFolder(manifest.name, manifest.version);
    const child = spawn('node', [postBuildScript], {
      stdio: 'inherit',
      cwd: folder,
      env: {
        ...process.env,
        MANIFEST: JSON.stringify(manifest),
        OUTPUT_PATH: outputPath,
      },
    });

    child.on('error', err => {
      console.warn(
        kleur.yellow(
          `[Warning] Failed to execute postbuild script: ${err.message}`
        )
      );
      resolve();
    });

    child.on('exit', code => {
      if (code !== 0) {
        console.warn(
          kleur.yellow(`[Warning] Postbuild script exited with code ${code}`)
        );
      }
      resolve();
    });
  });
}

async function execTask(task: {
  folder: string;
  manifest: ManifestModel;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { manifest, folder } = task;
    const webpackConfig = formatWebpackConfig(task);

    const compiler = webpack(webpackConfig);

    compiler.run(async (error: any, stats: any) => {
      if (error) {
        reject(new Error(error.message));
        return;
      }
      const info = stats.toJson();
      if (stats?.hasErrors()) {
        reject(info.errors);
        return;
      }

      writeBundleManifest(manifest);

      compiler.close(async closeErr => {
        if (closeErr) {
          reject(closeErr);
        } else {
          // 执行回调脚本
          await runPostBuildScript(folder, manifest);

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

  if (manifest.dependencies) {
    Object.entries(manifest.dependencies).forEach(([name, version]) => {
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

  await execTasks(tasks);
}

export async function build({ folders }: { folders: string[] }) {
  const packLibraries = getAllLibrary().filter(({ folder }) =>
    folders.includes(folder)
  );

  await execTasks(packLibraries);
}
