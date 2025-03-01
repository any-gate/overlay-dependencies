import fs from 'fs';
import YAML from 'yaml';

import {
  MANIFEST_FILE_NAME,
  BUNDLE_DIR,
  OUTPUT_CSS_FILE_NAME,
  SOURCE_DIR,
} from './constants.js';

import path from 'path';
import { spawn } from 'node:child_process';

export interface ManifestModel {
  name: string;
  version: string;
  schema: string;
  dependencies?: Record<string, string>;
}

export interface ManifestBundleModel extends ManifestModel {
  css: boolean;
}

const readDirYml = filePath => {
  const content = fs.readFileSync(filePath, {
    encoding: 'utf8',
  });
  return YAML.parse(content);
};

function isLibrary(dir: string) {
  return fs.existsSync(path.join(dir, MANIFEST_FILE_NAME));
}

function getDirectories(dir: string) {
  const entries = fs.readdirSync(dir);

  const directories = entries.filter(entry => {
    const entryPath = path.join(dir, entry);
    return fs.statSync(entryPath).isDirectory();
  });
  return directories;
}

export function getLibrarySelection() {
  const dir = path.resolve(SOURCE_DIR);
  const selection: { name: string; value: string; disabled?: boolean }[] = [];

  getDirectories(dir).forEach(name => {
    selection.push(
      {
        name,
        value: name,
        disabled: true
      },
      ...getDirectories(path.join(dir, name))
        .filter(version => isLibrary(path.join(dir, name, version)))
        .map(version => ({
          name: version,
          value: path.join(dir, name, version),
        }))
    );
  });

  return selection;
}

function getLibraryList(dir: string): {
  folder: string;
  manifest: ManifestModel;
}[] {
  return getDirectories(dir)
    .filter(version => isLibrary(path.join(dir, version)))
    .map(version => {
      const folder = path.join(dir, version);

      return {
        folder,
        manifest: readDirYml(path.join(folder, MANIFEST_FILE_NAME)),
      };
    });
}

export const getAllLibrary = (): {
  folder: string;
  manifest: ManifestModel;
}[] => {
  const dir = path.resolve(SOURCE_DIR);
  const libraryNames = getDirectories(dir);
  const libraries: { folder: string; manifest: ManifestModel }[] = [];

  libraryNames.forEach(name => {
    libraries.push(...getLibraryList(path.join(dir, name)));
  });

  return libraries;
};

export const getOutputFolder = (name: string, version) => {
  return path.resolve(BUNDLE_DIR, name, version);
};

export const getBundleManifest = ({
  name,
  version,
  schema,
  dependencies,
}: ManifestModel): ManifestBundleModel => {
  return {
    name,
    version,
    schema,
    css: fs.existsSync(
      path.resolve(getOutputFolder(name, version), OUTPUT_CSS_FILE_NAME)
    ),
    dependencies,
  };
};

export const getExternals = ({
  dependencies,
}: ManifestModel): Record<string, string> => {
  const externals: Record<string, string> = {};
  dependencies &&
    Object.entries(dependencies).forEach(([name, version]) => {
      Object.assign(externals, {
        [name]: `${name}@${version}`,
      });
    });
  return externals;
};

export async function updateDependencies(libraries: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', [...libraries], {
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
