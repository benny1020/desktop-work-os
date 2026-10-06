import Prism from 'prismjs/components/prism-core.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-kotlin.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-csharp.js';

// React owns the code DOM; use tokenization only, including at initial startup.
Prism.manual = true;

const languages = {
  ts: ['typescript', 'TypeScript'], tsx: ['tsx', 'TSX'],
  js: ['javascript', 'JavaScript'], jsx: ['jsx', 'JSX'],
  mjs: ['javascript', 'JavaScript'], cjs: ['javascript', 'JavaScript'],
  mts: ['typescript', 'TypeScript'], cts: ['typescript', 'TypeScript'],
  java: ['java', 'Java'], kt: ['kotlin', 'Kotlin'], kts: ['kotlin', 'Kotlin'],
  py: ['python', 'Python'], json: ['json', 'JSON'],
  yaml: ['yaml', 'YAML'], yml: ['yaml', 'YAML'], sql: ['sql', 'SQL'],
  sh: ['bash', 'Shell'], bash: ['bash', 'Shell'], css: ['css', 'CSS'],
  html: ['markup', 'HTML'], xml: ['markup', 'XML'], svg: ['markup', 'SVG'],
  go: ['go', 'Go'], cs: ['csharp', 'C#'],
};
export function codeLanguage(path) {
  const extension = String(path).split('.').at(-1)?.toLowerCase();
  return Object.hasOwn(languages, extension) ? languages[extension] : ['plain', 'Plain text'];
}
const opaque = new Set(['comment', 'string', 'char', 'regex', 'attr-value', 'url']);
const closers = { ')': '(', ']': '[', '}': '{' };

// Tokenize once per code version, never per keystroke. Render text tokens through
// React; source is never interpreted as HTML. Literal/comment brackets stay text.
export function highlightCode(text, path) {
  text = String(text);
  const [language, label] = codeLanguage(path);
  const lines = [[]], stack = [];
  function append(value, types = [], protectedText = false) {
    const parts = value.split('\n');
    parts.forEach((part, index) => {
      if (index) lines.push([]);
      if (!part) return;
      const pieces = protectedText ? [part] : part.split(/([()[\]{}])/);
      for (const piece of pieces) {
        if (!piece) continue;
        let depth = null;
        if (!protectedText && /^[([{]$/.test(piece)) {
          depth = stack.length;
          stack.push({ bracket: piece, depth });
        } else if (!protectedText && closers[piece] && stack.at(-1)?.bracket === closers[piece]) {
          depth = stack.pop().depth;
        }
        lines.at(-1).push({ text: piece, types, depth });
      }
    });
  }
  function walk(tokens, types = [], protectedText = false) {
    for (const token of tokens) {
      if (typeof token === 'string') append(token, types, protectedText);
      else {
        const aliases = [token.alias || []].flat();
        const nested = [...types, token.type, ...aliases];
        const guarded = protectedText || opaque.has(token.type) || aliases.some(alias => opaque.has(alias));
        if (typeof token.content === 'string') append(token.content, nested, guarded);
        else walk(token.content, nested, guarded);
      }
    }
  }
  // Unknown and very large files remain exact plain text. Avoid unbounded grammar
  // work on the renderer; this does not truncate code or change review positions.
  const grammar = language !== 'plain' && text.length <= 200000 && Prism.languages[language];
  if (grammar) walk(Prism.tokenize(text, grammar));
  else text.split('\n').forEach((line, index) => { lines[index] = line ? [{ text: line, types: [], depth: null }] : []; });
  return { language: grammar ? language : 'plain', label: grammar ? label : 'Plain text', lines };
}

export function highlightDiff(file, currentSource) {
  const rows = file.rows || [], output = rows.map(() => []);
  const current = typeof currentSource === 'string' ? highlightCode(currentSource, file.path) : null;
  for (const side of ['old', 'new']) {
    let group = [], lastLine = null;
    function flush() {
      if (!group.length) return;
      const tokens = highlightCode(group.map(item => item.row.text).join('\n'), side === 'old' ? file.old_path || file.path : file.path).lines;
      group.forEach((item, index) => {
        if (side === 'new' || item.row.kind === 'removed') {
          const sourceTokens = side === 'new' && current?.lines[item.row.newLine - 1];
          output[item.index] = sourceTokens && sourceTokens.map(token => token.text).join('') === item.row.text ? sourceTokens : tokens[index];
        }
      });
      group = []; lastLine = null;
    }
    rows.forEach((row, index) => {
      if (row.kind === 'hunk') { flush(); return; }
      const number = side === 'new' ? row.newLine : row.oldLine;
      if (number == null) return;
      if (lastLine != null && number !== lastLine + 1) flush();
      group.push({ row, index }); lastLine = number;
    });
    flush();
  }
  return output;
}
