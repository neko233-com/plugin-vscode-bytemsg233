# Verification — 2026-10-15

Version 1.1.0. Tested in VS Code 1.142.0 Extension Host with the extension extracted from its packaged VSIX and an isolated profile.

- Extension activation, `.bmsg.json` language recognition and all four CLI commands registered.
- Outline symbol and type completion providers responded.
- Five formatting passes were stable; field order and integer text were preserved.
- Invalid unsaved JSON produced an error diagnostic through the CLI.
- `npm run package`: passed; production dependencies included in VSIX.
- Shared CLI v1.1.3 code generated six supported languages and exported md/html/bmsg/proto, including output paths with spaces.

The repeatable host entry point is `verification/host.js`; set `BYTEMSG233_TEST_WORKSPACE` to a directory containing `hero.bmsg.json`, and `BYTEMSG233_TEST_CLI` to the CLI executable. Launch VS Code with isolated `--user-data-dir`, `--extensions-dir`, `--extensionDevelopmentPath`, and `--extensionTestsPath` arguments. The runner writes `host-result.json` on success.

This records package and host validation. Marketplace availability is a separate stage.
