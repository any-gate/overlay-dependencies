# Library Pack 工具

这是一个用于构建和打包库文件的命令行工具，支持将库打包为 SystemJS 格式。

## 功能特性

- 🎯 **交互式模式**：通过界面选择要构建的库
- 🚀 **批量构建**：使用 `--all` 参数构建所有库
- 📋 **精确指定**：通过 `library_name@version` 格式指定具体库
- 🔍 **智能验证**：自动验证指定的库是否存在
- 🎨 **友好输出**：彩色控制台输出，清晰显示构建进度

## 安装和使用

### 基本命令

```bash
# 查看帮助
pack build --help

# 交互式模式（原有功能）
pack build

# 构建所有库
pack build --all

# 构建指定库
pack build library_name_01@1.0.0 library_name_02@2.1.0
```

## 使用方式

### 1. 交互式模式

当不提供任何参数时，工具会启动交互式模式，让您通过复选框界面选择要构建的库：

```bash
pack build
```

这会显示类似下面的界面：
```
? Select library need pack (Press <space> to select, <a> to toggle all, <i> to invert selection, and <enter> to proceed)
❯◯ react 18.0.0
 ◯ vue 3.0.0
 ◯ lodash 4.17.21
 ◯ moment 2.29.4
```

### 2. 构建所有库

使用 `--all` 参数可以构建所有可用的库：

```bash
npm run build -- --all
```

输出示例：
```
Building all libraries (15 found):
  - react@18.0.0
  - vue@3.0.0
  - lodash@4.17.21
  - moment@2.29.4
  ...
✅ Successfully built 15 libraries
```

### 3. 构建指定库

您可以通过 `library_name@version` 的格式指定要构建的库：

```bash
# 构建单个库
npm run build react@18.0.0

# 构建多个库
npm run build react@18.0.0 vue@3.0.0 lodash@4.17.21

# 混合构建不同库
npm run build axios@1.5.0 moment@2.29.4 dayjs@1.11.0
```

输出示例：
```
Building specified libraries (3 found):
  - react@18.0.0
  - vue@3.0.0
  - lodash@4.17.21
✅ Successfully built 3 libraries
```

## 错误处理

### 库不存在的情况

如果指定的库不存在，工具会显示错误信息并列出所有可用的库：

```bash
npm run build nonexistent@1.0.0
```

输出：
```
The following libraries were not found:
  - nonexistent@1.0.0
Available libraries:
  - react@18.0.0
  - vue@3.0.0
  - lodash@4.17.21
  - moment@2.29.4
  ...
```

### 中断操作

在任何模式下，您都可以使用 `Ctrl + C` 来中断操作：

```
Program interrupted by Command + C (SIGINT).
```

## 项目结构

工具会在以下目录结构中查找库：

```
libs/
├── library_name_01/
│   └── version/
│       ├── dep.manifest.yml  # 库的清单文件
│       └── main.js          # 入口文件
├── library_name_02/
│   └── version/
│       ├── dep.manifest.yml
│       └── main.js
└── ...
```

构建后的文件会输出到：

```
dist/
├── library_name_01/
│   └── version/
│       ├── main.js           # 构建后的 JS 文件
│       ├── main.css          # 样式文件（如果有）
│       └── dep.manifest.json # 构建清单
└── ...
```

## 清单文件格式

每个库都需要一个 `dep.manifest.yml` 文件来描述库的信息：

```yaml
name: library-name
version: 1.0.0
schema: "1.0"
dependencies:
  react: "^18.0.0"
  lodash: "^4.17.21"
```

构建后会生成对应的 JSON 格式清单文件。

## 高级功能

### 依赖管理

工具会自动处理库之间的依赖关系，并在构建时生成正确的外部依赖映射。

### CSS 支持

如果库包含 CSS 文件，构建后的清单会标记 `css: true`，表示该库包含样式文件。

### 环境变量

构建时会自动设置 `NODE_ENV=production` 以确保生产环境的优化构建。

## 故障排除

### 常见问题

1. **权限问题**：确保对 `libs/` 和 `dist/` 目录有读写权限
2. **依赖缺失**：确保已经安装了所需的 npm 依赖
3. **清单文件**：确保每个库目录下都有正确的 `dep.manifest.yml` 文件

### 调试模式

如果遇到问题，可以检查构建日志获取更多详细信息。

## 开发说明

- 使用 TypeScript 开发
- 基于 Commander.js 进行命令行解析
- 使用 Inquirer.js 提供交互式界面
- 支持 SystemJS 模块格式输出
