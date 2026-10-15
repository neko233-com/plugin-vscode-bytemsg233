# ByteMsg233 VS Code Plugin

Public source: https://github.com/neko233-com/plugin-vscode-bytemsg233

## 功能

- `.bmsg.json`、`.bmsg.yaml`、`.bmsg.yml`、legacy `.bmsg` 高亮、基础类型 / 协议键 / 当前文件自定义类型补全。
- 原生文档格式化、当前文件类型跳转及结构视图。JSON 格式化保留字段顺序、大整数原文；YAML 保留注释。重复格式化结果稳定。
- 编辑时调用权威 CLI 校验未保存的缓冲区；显式校验命令也可用于 `.proto`。校验范围与 CLI 一致，并非完整业务约束检查。
- 多选导出语言、输出目录、en/zh 生成注释。生成语言列表取自当前 CLI 的 `languages` 命令；v1.1.3 实现 Go、C#、TypeScript、Java、Rust、Python。
- Markdown / HTML 文档、legacy `.bmsg` / Protobuf `.proto` schema 导出。
- 生成前保存当前文件，保存失败则停止；校验和格式化使用 stdin，不创建临时协议文件。
- CLI 直接接收参数，路径含空格也可使用。只在受信任的工作区 / 项目运行 CLI。高亮、补全、类型导航无需 CLI。

## 发布状态（2026-10-15）

1.1.0 已通过 [GitHub Releases](https://github.com/neko233-com/plugin-vscode-bytemsg233/releases/tag/v1.1.0) 公开提供 VSIX。VS Code Marketplace 尚未上架，请使用 VSIX 安装。

## 安装

从 [GitHub Releases](https://github.com/neko233-com/plugin-vscode-bytemsg233/releases/latest) 下载 VSIX 后，使用 Extensions → Install from VSIX，或 `code --install-extension bytemsg233-1.1.0.vsix`。

安装 **ByteMsg233 CLI v1.1.3+**，使用 [主仓库发行包](https://github.com/neko233-com/bytemsg233/releases/latest)，或：

```sh
go install github.com/neko233-com/bytemsg233/cmd/bytemsg233@v1.1.3
bytemsg233 version
bytemsg233 languages
```

旧 CLI 缺少 `format` / `check` / `languages` 时，请先升级 CLI。不需要自建服务。

## 使用

设置 `bytemsg233.cliPath`（默认 `bytemsg233`）、`bytemsg233.outputDirectory`、`bytemsg233.locale` 和 `bytemsg233.timeout`。右键或命令面板使用 `ByteMsg233: Generate Languages…` / `Export Documentation / Schema…` / `Validate Schema`。Format Document 使用本插件；支持 format on save。

示例协议：

```json
{
  "schema": "bymsg/v1",
  "package": "game",
  "Hero": {
    "id": { "type": "uint32", "tag": 1 },
    "name": { "type": "string", "tag": 2 }
  }
}
```

CLI 等价命令：

```sh
bytemsg233 check hero.bmsg.json
bytemsg233 format hero.bmsg.json -w
bytemsg233 compile hero.bmsg.json -l go,csharp,typescript,java,rust,python -o generated --locale zh
bytemsg233 export hero.bmsg.json -f md,html,bmsg,proto -o generated/docs
```

普通 `.json` / `.yaml` 文件保持原文件类型。`.proto` 可校验及导出；本插件不接管 Proto 语法高亮 / 格式化。自定义类型导航限当前文件。部分 CLI 错误不带行号，IDE 会在文档开头显示错误。

## 从源码构建

Node.js 22+：

```sh
npm ci
npm run package
```

输出：`bytemsg233-1.1.0.vsix`。使用 VS Code 1.85+。

## License

MIT. 参考 [Jenkinsfile-jetbrains-plugin](https://github.com/neko233-com/Jenkinsfile-jetbrains-plugin) 的独立语言、原生 IDE 集成与打包方式。
