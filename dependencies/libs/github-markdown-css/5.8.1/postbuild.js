const fs = require('fs');
const path = require('path');

// 需要复制的样式文件列表
const styleFiles = [
  'github-markdown.css',
  'github-markdown-dark.css',
  'github-markdown-light.css',
];

// 获取包信息
const manifest = JSON.parse(process.env.MANIFEST);
const version = manifest.version;
const name = manifest.name;

// 源目录和目标目录
const sourceDir = path.resolve('../../../node_modules', name);
const targetDir = path.resolve('../../../dist', name, version);

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 复制文件
styleFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);

  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${file} to ${targetDir}`);
  } else {
    console.error(`Source file not found: ${sourcePath}`);
  }
});

console.log('Postbuild completed successfully!');
