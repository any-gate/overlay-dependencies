import fs, { readFileSync, statSync, writeFileSync } from 'fs';
import path, { resolve } from 'path';
import YAML from 'yaml';

// const SystemJSPublicPathWebpackPlugin = require('systemjs-webpack-interop/SystemJSPublicPathWebpackPlugin');
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
} from './constants';
import { exec, execSync, spawnSync } from 'child_process';

const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

interface OptionsModel {
  folder: string;
}

interface ManifestModel {
  name: string;
  version: string;
  schema_version: string;
  libs?: Record<string, string>;
}

interface ManifestBundleModel {
  name: string;
  version: string;
  hasCss: boolean;
  libs?: Record<string, string>;
}

const readDirYml = (filePath: string) => {
  const content = readFileSync(resolve(filePath), {
    encoding: 'utf8',
  });
  return YAML.parse(content);
};

// const formatManifest = (folder: string): ManifestModel => {
//   const content = readFileSync(resolve(folder, MANIFEST_FILE_NAME), {
//     encoding: 'utf8',
//   });
//   const manifest = YAML.parse(content);

//   return manifest;
// };

const getOutputFolder = (name: string, version) => {
  return resolve(BUNDLE_DIR, name, version);
};

const getBundleManifest = (manifest: ManifestModel): ManifestBundleModel => {
  return {
    name: manifest.name,
    version: manifest.version,
    hasCss: fs.existsSync(
      resolve(
        getOutputFolder(manifest.name, manifest.version),
        OUTPUT_CSS_FILE_NAME
      )
    ),
    libs: manifest.libs,
  };
};

const extractExternals = ({ libs }: ManifestModel): Record<string, string> => {
  const externals: Record<string, string> = {};
  libs &&
    Object.entries(libs).forEach(([name, version]) => {
      Object.assign(externals, {
        [name]: `${name}@${version}`,
      });
    });
  return externals;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const formatWebpackConfig = ({ folder }: OptionsModel) => {
  const manifest = readDirYml(path.join(folder, MANIFEST_FILE_NAME));

  const plugins = [
    new MiniCssExtractPlugin({
      filename: OUTPUT_CSS_FILE_NAME,
    }),
    new CssMinimizerPlugin(),
    new SimpleProgressWebpackPlugin(),
    new CompressionPlugin({
      threshold: 12800, // 对大于 128kb 的文件进行压缩
    }),
  ];
  return {
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
    externals: extractExternals(manifest),
    module: {
      rules: [
        {
          test: /\.(js|mjs)$/,
          loader: require.resolve('babel-loader'),
          options: {
            cacheDirectory: true,
            cacheCompression: false,
            compact: false,
          },
        },
        {
          test: /\.ts?$/,
          use: [require.resolve('babel-loader'), require.resolve('ts-loader')],
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

export function build(options: OptionsModel): Promise<string> {
  return new Promise((resolve, reject) => {
    const webpackConfig = formatWebpackConfig(options);

    const compiler = webpack(webpackConfig);

    compiler.run((error: any, stats: any) => {
      if (error) {
        // let errMessage = error.message;
        reject(error);
        return;
      }
      const info = stats.toJson();
      if (stats?.hasErrors()) {
        console.error(info.errors);
        reject(stats?.toString({ all: false, warnings: false, errors: true }));
        return;
      }
      // if (stats.hasWarnings()) {
      //   console.warn(info.warnings);
      // }
      // const manifest = getBundleManifest(formatManifest(options.folder));
      const manifest = readDirYml(
        path.join(options.folder, MANIFEST_FILE_NAME)
      );
      // 导出 library.manifest 文件
      writeFileSync(
        path.resolve(
          getOutputFolder(manifest.name, manifest.version),
          BUNDLE_MANIFEST_NAME
        ),
        JSON.stringify(manifest, null, 2),
        { encoding: 'utf8' }
      );

      compiler.close(_closeErr => {
        // console.error(JSON.stringify(closeErr));
      });

      resolve('complete');
    });
  });
}

interface TaskModel {
  name: string;
  version: string;
  folder: string;
}

async function execBuildTask(task: TaskModel, tasks: TaskModel[]) {
  const manifest: ManifestModel = readDirYml(
    path.join(task.folder, MANIFEST_FILE_NAME)
  );
  let libsAddCmd = `pnpm add ${task.name}@${task.version} `;

  // 判断是否存在子依赖
  if (manifest.libs) {
    libsAddCmd += Object.entries(manifest.libs)
      .map(([libName, version]) => {
        return `${libName}@${version}`;
      })
      .join(' ');
  }

  console.log(libsAddCmd);
  // console.log(execSync('ls', { cwd: path.resolve(), encoding: 'utf-8' }));
  execSync(libsAddCmd, { cwd: path.resolve(), encoding: 'utf-8' });
  // spawnSync(libsAddCmd, [''], { cwd: path.resolve(), encoding: 'utf-8' });
  // execSync(`pack build --folder ${task.folder}`);

  if (tasks.length) {
    execBuildTask(tasks.shift() as TaskModel, tasks);
    return;
  }
  console.log('Build all completed!');
}

export function buildAll(options: OptionsModel): Promise<string> {
  const libraryMap = readDirYml('library-map.yml');

  const { dependencies } = libraryMap;

  dependencies.forEach(dep => {
    Object.assign(dep, {
      folder: path.join(options.folder, dep.name, dep.version),
    });
  });

  execBuildTask(dependencies.shift(), dependencies);

  return new Promise((resolve, reject) => {});
}
