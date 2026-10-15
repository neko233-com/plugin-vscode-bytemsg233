'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');
exports.run = async function () {
  const root = process.env.BYTEMSG233_TEST_WORKSPACE;
  await vscode.workspace.getConfiguration('bytemsg233').update('cliPath', process.env.BYTEMSG233_TEST_CLI, vscode.ConfigurationTarget.Global);
  const extension = vscode.extensions.getExtension('neko233-com.bytemsg233');
  assert.ok(extension, 'packaged extension discovered'); await extension.activate();
  const uri = vscode.Uri.file(path.join(root, 'hero.bmsg.json'));
  const doc = await vscode.workspace.openTextDocument(uri); await vscode.window.showTextDocument(doc);
  assert.equal(doc.languageId, 'bmsg-json');
  const commands = await vscode.commands.getCommands();
  for (const name of ['generate', 'export', 'validate', 'updateCLI']) assert.ok(commands.includes('bytemsg233.' + name));
  const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri);
  assert.equal(symbols[0].name, 'Hero');
  const completions = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', uri, new vscode.Position(0, 1));
  assert.ok(completions.items.some(x => x.label === 'uint32'));
  for (let i = 0; i < 5; i++) {
    const before = doc.getText();
    const edits = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', uri, { tabSize: 2, insertSpaces: true });
    if (i === 0) assert.ok(edits.length, 'initial format produced edits');
    const edit = new vscode.WorkspaceEdit(); edit.set(uri, edits); await vscode.workspace.applyEdit(edit);
    if (i > 0) assert.equal(doc.getText(), before, 'formatter is idempotent');
  }
  assert.ok(doc.getText().includes('18446744073709551615'));
  assert.ok(doc.getText().indexOf('"z"') < doc.getText().indexOf('"a"'));
  const change = new vscode.WorkspaceEdit();change.replace(uri, new vscode.Range(doc.positionAt(0),doc.positionAt(doc.getText().length)), '{bad');
  await vscode.workspace.applyEdit(change);
  const deadline = Date.now() + 15000;
  while (!vscode.languages.getDiagnostics(uri).length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
  assert.ok(vscode.languages.getDiagnostics(uri).some(x => x.severity === vscode.DiagnosticSeverity.Error), 'invalid unsaved buffer produces a diagnostic');
  fs.writeFileSync(path.join(root, 'host-result.json'), JSON.stringify({ activated: true, language: true, commands: 4, symbols: true, completion: true, formattingPasses: 5, orderAndIntegerPreserved: true, unsavedDiagnostics: true }, null, 2));
};
