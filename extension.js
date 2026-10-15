'use strict';

const vscode = require('vscode');
const cp = require('node:child_process');
const path = require('node:path');
const { parseTree, getNodeValue } = require('jsonc-parser');
const YAML = require('yaml');

const selectors = ['bmsg', 'bmsg-json', 'bmsg-yaml'].map(language => ({ language, scheme: 'file' }));
const supported = file => /(?:\.bmsg(?:\.(?:json|ya?ml))?|\.proto)$/i.test(file);
const config = uri => vscode.workspace.getConfiguration('bytemsg233', uri);

function run(args, uri, input, token) {
  if (!vscode.workspace.isTrusted) return Promise.reject(new Error('Trust this workspace before running ByteMsg233 CLI.'));
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return new Promise((resolve, reject) => {
    let subscription;
    const child = cp.execFile(config(uri).get('cliPath', 'bytemsg233'), args, {
      cwd: folder?.uri.fsPath || path.dirname(uri.fsPath), windowsHide: true,
      timeout: config(uri).get('timeout', 30) * 1000, maxBuffer: 32 * 1024 * 1024,
      encoding: 'utf8', shell: false
    }, (error, stdout, stderr) => {
      subscription?.dispose();
      if (error) reject(new Error(stderr.trim() || (error.code === 'ENOENT'
        ? 'ByteMsg233 CLI was not found. Install the current CLI and set bytemsg233.cliPath.' : error.message)));
      else resolve(stdout);
    });
    subscription = token?.onCancellationRequested(() => child.kill());
    child.stdin.on('error', () => {}); // Early CLI exit may close stdin.
    child.stdin.end(input || '');
  });
}

// Offsets come from syntax trees; strings and numeric values are never rewritten.
function symbols(text, filename) {
  const result = [];
  if (/\.json$/i.test(filename) || text.trimStart().startsWith('{')) {
    const root = parseTree(text);
    const properties = node => (node?.children || []).filter(n => n.type === 'property');
    const visit = (node, parent) => {
      for (const prop of properties(node)) {
        const name = getNodeValue(prop.children[0]);
        const value = prop.children[1];
        const reserved = ['schema', '$schema', 'package', 'namespace', 'protocolVersion'];
        if (!parent && reserved.includes(name)) continue;
        if (!parent && ['messages', 'enums'].includes(name)) { visit(value, name); continue; }
        result.push({ name, offset: prop.children[0].offset + 1, length: name.length,
          start: prop.offset, end: prop.offset + prop.length,
          kind: parent === 'enums' ? vscode.SymbolKind.Enum : vscode.SymbolKind.Class });
      }
    };
    visit(root, null);
  } else if (/\.ya?ml$/i.test(filename)) {
    const doc = YAML.parseDocument(text);
    for (const pair of doc.contents?.items || []) {
      if (!['messages', 'enums'].includes(pair.key?.value)) continue;
      for (const item of pair.value?.items || []) {
        if (!item.key?.range || !item.value?.range) continue;
        result.push({ name: String(item.key.value), offset: item.key.range[0], length: String(item.key.value).length,
          start: item.key.range[0], end: item.value.range[1],
          kind: pair.key.value === 'enums' ? vscode.SymbolKind.Enum : vscode.SymbolKind.Class });
      }
    }
  } else {
    const pattern = /^(?:message|enum)\s+(\w+)\s*\{/gm;
    let match;
    while ((match = pattern.exec(text))) {
      const closing = /^\s*}/gm;
      closing.lastIndex = pattern.lastIndex;
      const end = closing.exec(text);
      result.push({ name: match[1], offset: match.index + match[0].indexOf(match[1]), length: match[1].length,
        start: match.index, end: end ? end.index + end[0].length : text.length,
        kind: match[0].startsWith('enum') ? vscode.SymbolKind.Enum : vscode.SymbolKind.Class });
    }
  }
  return result;
}

function activate(context) {
  const output = vscode.window.createOutputChannel('ByteMsg233');
  const diagnostics = vscode.languages.createDiagnosticCollection('bytemsg233');
  const timers = new Map();
  const pending = new Map();
  context.subscriptions.push(output, diagnostics, { dispose() {
    for (const timer of timers.values()) clearTimeout(timer);
    for (const source of pending.values()) { source.cancel(); source.dispose(); }
  }});
  const report = error => { output.appendLine(error.message); output.show(true); vscode.window.showErrorMessage(error.message); };
  const validate = async (document, explicit = false) => {
    if (!supported(document.fileName) || document.uri.scheme !== 'file' || !vscode.workspace.isTrusted) return;
    if (!explicit && !config(document.uri).get('validateOnChange', true)) return;
    const key = document.uri.toString();
    pending.get(key)?.cancel(); pending.get(key)?.dispose();
    const source = new vscode.CancellationTokenSource(); pending.set(key, source);
    const version = document.version;
    try {
      await run(['check', document.fileName, '--stdin'], document.uri, document.getText(), source.token);
      if (document.version === version && !source.token.isCancellationRequested) {
        diagnostics.delete(document.uri);
        if (explicit) vscode.window.showInformationMessage('ByteMsg233: schema is valid.');
      }
    } catch (error) {
      if (source.token.isCancellationRequested || document.isClosed || document.version !== version) return;
      if (/not found|ENOENT|unknown command/.test(error.message)) { if (explicit) report(error); else output.appendLine(error.message); return; }
      const lineMatch = /(?:line\s+|:)(\d+)(?::(\d+))?/i.exec(error.message);
      const line = Math.min(document.lineCount - 1, Math.max(0, Number(lineMatch?.[1] || 1) - 1));
      diagnostics.set(document.uri, [new vscode.Diagnostic(document.lineAt(line).range, error.message, vscode.DiagnosticSeverity.Error)]);
      if (explicit) report(error);
    } finally { if (pending.get(key) === source) pending.delete(key); source.dispose(); }
  };
  const schedule = document => {
    const key = document.uri.toString(); clearTimeout(timers.get(key)); pending.get(key)?.cancel();
    timers.set(key, setTimeout(() => { timers.delete(key); void validate(document); }, 500));
  };
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(schedule),
    vscode.workspace.onDidChangeTextDocument(event => schedule(event.document)),
    vscode.workspace.onDidCloseTextDocument(document => {
      const key = document.uri.toString(); clearTimeout(timers.get(key)); timers.delete(key);
      pending.get(key)?.cancel(); diagnostics.delete(document.uri);
    }));
  for (const doc of vscode.workspace.textDocuments) schedule(doc);
  context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider(selectors, {
    async provideDocumentFormattingEdits(document, options, token) {
      try {
        const text = await run(['format', document.fileName, '--stdin', '--indent', String(Math.min(8, Math.max(1, options.tabSize)))], document.uri, document.getText(), token);
        if (token.isCancellationRequested) return [];
        return [vscode.TextEdit.replace(new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text)];
      } catch (error) { if (!token.isCancellationRequested) report(error); return []; }
    }
  }));
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selectors, {
    provideDocumentSymbols(document) {
      return symbols(document.getText(), document.fileName).map(item => new vscode.DocumentSymbol(item.name, 'ByteMsg233', item.kind,
        new vscode.Range(document.positionAt(item.start), document.positionAt(item.end)),
        new vscode.Range(document.positionAt(item.offset), document.positionAt(item.offset + item.length))));
    }
  }));
  context.subscriptions.push(vscode.languages.registerDefinitionProvider(selectors, {
    provideDefinition(document, position) {
      const range = document.getWordRangeAtPosition(position);
      if (!range) return;
      const name = document.getText(range);
      const item = symbols(document.getText(), document.fileName).find(s => s.name === name);
      if (item) return new vscode.Location(document.uri, document.positionAt(item.offset));
    }
  }));
  const types = ['uint32', 'uint64', 'int32', 'int64', 'float32', 'float64', 'bool', 'string', 'bytes'];
  const keys = ['schema', 'package', 'namespace', 'protocolVersion', 'messages', 'enums', 'type', 'tag', 'list', 'map', 'packetId', 'comment', 'description', 'zh', 'en', 'fields'];
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider(selectors, {
    provideCompletionItems(document) {
      return [...types, ...symbols(document.getText(), document.fileName).map(s => s.name), ...keys,
        ...(document.languageId === 'bmsg' ? ['message', 'enum', 'list', 'map'] : [])]
        .map(word => new vscode.CompletionItem(word, types.includes(word) ? vscode.CompletionItemKind.TypeParameter : vscode.CompletionItemKind.Keyword));
    }
  }));
  const activeDocument = async uri => {
    const doc = uri ? await vscode.workspace.openTextDocument(uri) : vscode.window.activeTextEditor?.document;
    if (!doc || !supported(doc.fileName) || doc.isUntitled) throw new Error('Open a saved .bmsg.json, .bmsg.yaml, .bmsg.yml, .bmsg or .proto file first.');
    return doc;
  };
  const command = (id, handler) => context.subscriptions.push(vscode.commands.registerCommand(id, async uri => {
    try { await handler(await activeDocument(uri)); } catch (error) { report(error); }
  }));
  command('bytemsg233.validate', doc => validate(doc, true));
  const generate = async (doc, exportDocs) => {
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before running ByteMsg233 CLI.');
    const items = exportDocs ? ['md', 'html', 'bmsg', 'proto'] : JSON.parse(await run(['languages'], doc.uri));
    const selected = await vscode.window.showQuickPick(items, { canPickMany: true, title: exportDocs ? 'Export schema / documentation' : 'Generate languages' });
    if (!selected?.length) return;
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath || path.dirname(doc.fileName);
    const outputPath = config(doc.uri).get('outputDirectory', 'generated');
    const out = await vscode.window.showInputBox({ title: 'Output directory', value: path.resolve(folder, outputPath), ignoreFocusOut: true });
    if (!out) return;
    // Save immediately before generating so the CLI sees exactly the visible buffer.
    if (!await doc.save()) throw new Error('Save was cancelled; generation stopped.');
    output.appendLine(await run([exportDocs ? 'export' : 'compile', doc.fileName,
      exportDocs ? '--format' : '--lang', selected.join(','), '--output', path.resolve(folder, out),
      ...(exportDocs ? [] : ['--locale', config(doc.uri).get('locale', 'en')])], doc.uri));
    vscode.window.showInformationMessage(`ByteMsg233: exported ${selected.join(', ')} to ${out}`);
  };
  command('bytemsg233.generate', doc => generate(doc, false));
  command('bytemsg233.export', doc => generate(doc, true));
  command('bytemsg233.updateCLI', async doc => {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Updating ByteMsg233 CLI' }, async () => {
      output.appendLine(await run(['update'], doc.uri));
    });
    vscode.window.showInformationMessage('ByteMsg233 CLI updated.');
  });
  context.subscriptions.push(vscode.commands.registerCommand('bytemsg233.showOutput', () => output.show()));
}

exports.activate = activate;
exports.symbols = symbols;
