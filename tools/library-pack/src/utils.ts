import fs, { readFileSync, writeFileSync } from 'fs';
import path, { resolve } from 'path';
import YAML from 'yaml';

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

export const readDirYml = (filePath: string) => {
  const content = readFileSync(resolve(filePath), {
    encoding: 'utf8',
  });
  return YAML.parse(content);
};

export const readLibMinifest = (folder: string) => {
  return readDirYml(resolve(folder, MANIFEST_FILE_NAME));
};

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
  const manifest = readLibMinifest(folder);

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
      const manifest = getBundleManifest(readLibMinifest(options.folder));
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
