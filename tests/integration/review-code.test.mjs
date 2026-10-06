import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightCode, highlightDiff, codeLanguage } from '../../src/lib/review-code.mjs';
import { parseDiff } from '../../src/lib/review-model.mjs';

const plain = result => result.lines.map(line => line.map(token => token.text).join('')).join('\n');
const brackets = result => result.lines.flat().filter(token => token.depth !== null);

test('Syntax preserves exact source, multiline comments/literals and nested pairs across lines', () => {
  const text = `/* Comment {\n  ignored [()] */\nexport class PaymentService {\n  async retry() {\n    const message = "[literal {()]";\n    return [{ ok: true, amount: 12.5 }];\n  }\n}\n`;
  const result = highlightCode(text, 'src/PaymentService.ts');
  assert.equal(plain(result), text);
  assert.equal(result.label, 'TypeScript');
  assert.ok(result.lines[1].every(token => token.types.includes('comment') && token.depth === null));
  assert.ok(result.lines[4].filter(token => token.types.includes('string')).every(token => token.depth === null));
  assert.deepEqual(brackets(result).map(token => [token.text, token.depth]),
    [['{', 0], ['(', 1], [')', 1], ['{', 1], ['[', 2], ['{', 3], ['}', 3], [']', 2], ['}', 1], ['}', 0]]);
  for (const type of ['keyword', 'class-name', 'function', 'string', 'boolean', 'number'])
    assert.ok(result.lines.flat().some(token => token.types.includes(type)), type);
});

test('Diff deletion does not shift new-side nesting; hunk gaps reset partial context', () => {
  const rows = parseDiff('@@ -1,3 +1,5 @@\n function run() {\n-  return old();\n+  if (ready) {\n+    return next();\n+  }\n }\n@@ -40,1 +42,1 @@\n-previous();\n+current();');
  const file = { path: 'run.ts', old_path: 'run.ts', rows };
  const result = highlightDiff(file);
  rows.forEach((row, index) => { if (row.kind !== 'hunk') assert.equal(result[index].map(token => token.text).join(''), row.text); });
  const old = result[2].filter(token => token.depth !== null);
  const next = result[4].filter(token => token.depth !== null);
  assert.equal(old.find(token => token.text === '(').depth, 1);
  assert.equal(next.find(token => token.text === '(').depth, 2);
  assert.equal(result.at(-1).find(token => token.text === '(').depth, 0);
});

test('Head source restores actual nesting for a diff starting inside a function without overriding mismatched text', () => {
  const rows = parseDiff('@@ -5,1 +5,1 @@\n-  previous();\n+  current();');
  const file = { path: 'run.ts', rows };
  const source = 'function run() {\n if (true) {\n  warm();\n  ready();\n  current();\n }\n}';
  assert.equal(highlightDiff(file, source)[2].find(token => token.text === '(').depth, 2);
  assert.equal(highlightDiff(file, source.replace('current', 'different'))[2].map(token => token.text).join(''), '  current();');
});

test('Java, Kotlin, Python, SQL, JSX and YAML use their own grammars; regex and scalar brackets remain literals', () => {
  for (const [path, text] of [['Controller.java', '@RestController public class Controller { void run() {} }'],
    ['Worker.kt', 'fun retry() = listOf(1, 2)'], ['job.py', 'def run():\n    return True'],
    ['migration.sql', 'SELECT count(*) FROM payments;'], ['View.tsx', 'const view = <div>{run()}</div>;'],
    ['config.yml', 'text: |\n  literal {[]}\n']]) {
    const result = highlightCode(text, path);
    assert.notEqual(result.language, 'plain');
    assert.equal(plain(result), text);
    assert.ok(result.lines.flat().some(token => token.types.length));
    if (path.endsWith('yml')) assert.equal(brackets(result).length, 0);
  }
  const regex = highlightCode('const pattern = /[{}()]/; run();', 'run.js');
  assert.equal(brackets(regex).length, 2);
});

test('Unknown and large files keep exact plain text without code interpretation', () => {
  assert.equal(codeLanguage('notes.txt')[0], 'plain');
  for (const [path, text] of [['notes.txt', '<img src=x onerror=alert(1)>\n{}'], ['file.constructor', 'literal {}'], ['file.__proto__', 'literal []'], ['huge.ts', 'const value = {}\n'.repeat(15000)]]) {
    const result = highlightCode(text, path);
    assert.equal(result.language, 'plain');
    assert.equal(plain(result), text);
    assert.equal(brackets(result).length, 0);
  }
});
