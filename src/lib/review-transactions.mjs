import { codeOnly } from './review-model.mjs';

// Source boundaries only. Never infer a transaction from an AI guide, a type
// name, or disconnected diff hunks. Callback return is not a runtime commit.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;
function closeBlock(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    if (code[i] === '}' && --depth === 0) return i;
  }
  return -1;
}
function resolveImport(from, spec) {
  const parts = from.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return parts.join('/').replace(/\.[cm]?[jt]sx?$/, '');
}
function wrapperMethods(file, code) {
  const methods = [];
  const classes = [...code.matchAll(/\bclass\s+(\w+)[^{]*\{/g)].map(match => {
    const open = match.index + match[0].lastIndexOf('{');
    return { name: match[1], open, end: closeBlock(code, open) };
  });
  // Small, direct forwarding methods only; don't treat arbitrary run() helpers
  // with a transaction somewhere in their implementation as transactional.
  const signature = /\b(\w+)(?:<[^\n{}]+>)?\s*\(\s*(\w+)\s*:\s*\([^\n]*?\)\s*=>[^\n{]+\{\s*return\s+(?:await\s+)?this\.(\w+)\.(\$?transaction)\s*\(\s*(\w+)\b/g;
  for (const match of code.matchAll(signature)) {
    const owner = classes.filter(item => item.open < match.index && item.end > match.index).at(-1);
    if (!owner || match[2] !== match[5]) continue;
    const prefix = code.slice(owner.open + 1, match.index);
    if ([...prefix].reduce((depth, char) => depth + (char === '{' ? 1 : char === '}' ? -1 : 0), 0) !== 0) continue;
    const open = code.indexOf('{', match.index), end = closeBlock(code, open);
    if (end < 0 || !/^\s*return\s+(?:await\s+)?this\.\w+\.\$?transaction\s*\([^;]*\);?\s*$/.test(code.slice(open + 1, end))) continue;
    methods.push({ owner: owner.name, method: match[1], path: file.path, line: lineAt(code, match.index) });
  }
  return methods;
}
export function transactionScopes(files) {
  const available = files.filter(file => !file.deleted_file && typeof file.content === 'string' && file.content.length <= 200000);
  const lexical = new Map(available.map(file => [file.path, codeOnly(file.content)]));
  const wrappers = new Map(available.map(file => [file.path, wrapperMethods(file, lexical.get(file.path))]));
  const scopes = [];
  for (const file of available) {
    if (!/\.(?:[cm]?[jt]sx?|java)$/.test(file.path)) continue;
    const code = lexical.get(file.path), receivers = [];
    // Resolve imported TS wrapper + constructor property to its exact source.
    for (const match of file.content.matchAll(/\bimport\s*\{\s*(\w+)(?:\s+as\s+(\w+))?\s*\}\s*from\s*['"]([^'"]+)['"]/g)) {
      if (code.slice(match.index, match.index + 6) !== 'import' || !match[3].startsWith('.')) continue;
      const target = available.find(item => item.path.replace(/\.[cm]?[jt]sx?$/, '') === resolveImport(file.path, match[3]));
      if (!target || !new RegExp(`\\bclass\\s+${escape(match[1])}\\b`).test(lexical.get(target.path))) continue;
      const property = new RegExp(`\\b(?:private|public|protected)\\s+(?:readonly\\s+)?(\\w+)\\s*:\\s*${escape(match[2] || match[1])}\\b`, 'g');
      for (const alias of code.matchAll(property)) for (const wrapper of wrappers.get(target.path) || [])
        if (wrapper.owner === match[1]) receivers.push({ receiver: `this.${alias[1]}`, method: wrapper.method, evidence: wrapper });
    }
    const callback = /\b((?:this\.)?[\w$]+)\.(\$?transaction|\w+)\s*\(\s*(?:async\s+)?(?:\(\s*([\w$]+)(?:\s*:\s*[\w$]+)?\s*\)|([\w$]+))\s*=>\s*\{/g;
    for (const match of code.matchAll(callback)) {
      const wrapper = receivers.find(item => item.receiver === match[1] && item.method === match[2]);
      const direct = match[2] === '$transaction' || (match[2] === 'transaction' && /^(?:this\.)?(?:db|database|prisma|sequelize|knex)$/.test(match[1]));
      if (!wrapper && !direct) continue;
      const open = match.index + match[0].lastIndexOf('{'), end = closeBlock(code, open);
      if (end < 0) continue;
      const startLine = lineAt(code, match.index), endLine = lineAt(code, end);
      scopes.push({ id: `${file.path}:${startLine}:${endLine}:${match.index}`, path: file.path,
        startLine, endLine, startOffset: match.index, endOffset: end, label: `${match[1]}.${match[2]}`, parameter: match[3] || match[4],
        kind: 'callback', evidence: wrapper?.evidence || { path: file.path, line: startLine } });
    }
    // A method annotation is a declared boundary, not proof that a Spring proxy
    // opened a transaction (self invocation / propagation cannot be resolved).
    if (/\.java$/.test(file.path) && /^\s*import\s+org\.springframework\.transaction\.annotation\.Transactional\s*;/m.test(code)) {
      const annotatedMethod = /@Transactional\b(?:\s*\([^)]*\))?\s*(?:(?:public|protected|private|static|final|synchronized)\s+)*[\w<>?,.\[\] ]+\s+\w+\s*\([^;{}]*\)\s*(?:throws\s+[\w,. ]+)?\{/g;
      for (const match of code.matchAll(annotatedMethod)) {
        const open = match.index + match[0].lastIndexOf('{'), end = closeBlock(code, open);
        if (end < 0 || /\bpropagation\s*=\s*Propagation\.(?:NOT_SUPPORTED|NEVER|SUPPORTS)\b/.test(match[0])) continue;
        const startLine = lineAt(code, match.index), endLine = lineAt(code, end);
        scopes.push({ id: `${file.path}:${startLine}:${endLine}:${match.index}`, path: file.path, startLine, endLine, startOffset: match.index, endOffset: end,
          label: '@Transactional', kind: 'annotation', evidence: { path: file.path, line: startLine } });
      }
    }
  }
  return { scopes, availablePaths: available.map(file => file.path) };
}
export function annotateTransactions(graph, files) {
  return { ...graph, transactions: transactionScopes(files) };
}
export function stepTransaction(graph, step) {
  const distance = scope => Math.max(scope.startLine - step.line, step.line - scope.endLine, 0);
  const scopes = (graph.transactions?.scopes || []).filter(scope => scope.path === step?.path)
    .sort((a, b) => distance(a) - distance(b));
  const inside = scopes.filter(scope => (step.line > scope.startLine && step.line < scope.endLine) || (step.line === scope.startLine && scope.evidence.path !== scope.path && step.to === scope.evidence.path))
    .sort((a, b) => b.startOffset - a.startOffset || a.endOffset - b.endOffset);
  const boundary = scopes.some(scope => step.line === scope.startLine || step.line === scope.endLine);
  return { inside, scopes, state: inside.length ? 'inside' : boundary ? 'boundary' : scopes.length ? 'outside' :
    graph.transactions?.availablePaths.includes(step?.path) ? 'undetected' : 'unavailable' };
}
