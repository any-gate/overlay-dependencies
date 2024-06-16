import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import { build, buildAll } from './utils';

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), { encoding: 'utf8' })
);

program.name('Library Builder').description(pkg.name).version(pkg.version);

program
  .command('build')
  .description('Build library for systemjs.')
  .option('--folder <folder>', 'Library files folder.')
  .option('--all', 'Build all dependencies.')
  .action((args) => {
    process.env.NODE_ENV = 'production';

    if (args.all) {
      buildAll(args);
      return;
    }
    build(args);
  });

program
  .command('publish')
  .description('Publish library to store.')
  .action(() => {
    // 1. 检查生成文件列表
    // 2. 生成 libb.manifest.json
  });

program.parse();
