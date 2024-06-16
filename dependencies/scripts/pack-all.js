const path = require('path');
const { execSync } = require('node:child_process');

const {
  readDirYml,
  readLibMinifest,
} = require('@overlay-dependencies/lib-builder');

const execSyncOptions = {
  cwd: path.resolve(),
  encoding: 'utf-8',
  stdio: 'inherit',
};

async function execBuildTask(task, tasks) {
  const manifest = readLibMinifest(task.folder);
  let libsAddCmd = `pnpm add ${task.name}@${task.version} `;
  let libsRemoveCmd = `pnpm remove ${task.name} `;

  // 判断是否存在子依赖
  if (manifest.libs) {
    libsAddCmd += Object.entries(manifest.libs)
      .map(([libName, version]) => {
        return `${libName}@${version}`;
      })
      .join(' ');
    libsRemoveCmd += Object.entries(manifest.libs)
      .map(([libName]) => {
        return libName;
      })
      .join(' ');
  }

  libsAddCmd += ' -P';

  // execSync(libsRemoveCmd, execSyncOptions);
  execSync(libsAddCmd, execSyncOptions);

  execSync(`pnpm build:only --folder ${task.folder}`, execSyncOptions);

  if (tasks.length) {
    execBuildTask(tasks.shift(), tasks);
    return;
  }
  console.log('Build all completed!');
}

function buildAll() {
  const libraryMap = readDirYml('library-map.yml');

  const { dependencies } = libraryMap;

  dependencies.forEach(dep => {
    Object.assign(dep, {
      folder: path.join('libs', dep.name, dep.version),
    });
  });

  execBuildTask(dependencies.shift(), dependencies);

  return new Promise((resolve, reject) => {});
}

buildAll();
