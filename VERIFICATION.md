# Verification — 2026-10-15

Version 1.1.0. Tested in VS Code 1.142.0 Extension Host with the extension extracted from its packaged VSIX and an isolated profile.

- Extension activation, `.bmsg.json` language recognition and all four CLI commands registered.
- Outline symbol and type completion providers responded.
- Five formatting passes were stable; field order and integer text were preserved.
- Invalid unsaved JSON produced an error diagnostic through the CLI.
- `npm run package`: passed; production dependencies included in VSIX.
- Shared CLI v1.1.3 code generated six supported languages and exported md/html/bmsg/proto, including output paths with spaces.

The repeatable host entry point is `verification/host.js`; set `BYTEMSG233_TEST_WORKSPACE` to a directory containing `hero.bmsg.json`, and `BYTEMSG233_TEST_CLI` to the CLI executable. Launch VS Code with isolated `--user-data-dir`, `--extensions-dir`, `--extensionDevelopmentPath`, and `--extensionTestsPath` arguments. The runner writes `host-result.json` on success.

## Marketplace publication

- Published 1.1.0 as `neko233-com.bytemsg233`; Marketplace automatic validation passed on 2026-10-15. The [public listing](https://marketplace.visualstudio.com/items?itemName=neko233-com.bytemsg233) is available.
- Anonymous public-gallery download produced a 341,143-byte VSIX. SHA-256 matches the GitHub release: `5f570123b5d89c25d99f072751ae73e08d2aecfe6afcd5f9d842267a8ba46ad4`.
- Package identity, extension entry point, and bundled `yaml` / `jsonc-parser` dependencies were inspected in the downloaded VSIX.
- VS Code 1.142.0 successfully installed `neko233-com.bytemsg233@1.1.0` directly from Marketplace with isolated user-data and extension directories; `--list-extensions --show-versions` confirmed the installed version.
- The temporary publication credential was revoked immediately after the successful upload.
