import { parse as parseBabel } from '@babel/parser';
import { transactionScopes } from './review-transactions.mjs';
import { classifyReviewFile, REVIEW_ROLES } from './review-architecture.mjs';
import { parseDiff } from './review-model.mjs';

const pathKey = path => path.replace(/\.(?:[cm]?[jt]sx?|java)$/, '').replace(/\/index$/, '');
const joinRoute = (prefix, route) => ('/' + [prefix, route].join('/')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
const children = node => Object.values(node?.children || {}).flat();
function cstFind(node, name) {
  const found = [];
  const visit = n => { if (!n?.children) return; if (n.name === name) found.push(n); else children(n).forEach(visit); };
  visit(node); return found;
}
const cstTokens = node => node?.image !== undefined ? [node] : children(node).flatMap(cstTokens).sort((a, b) => a.startOffset - b.startOffset);
const textOf = (source, node) => source.slice(node.location.startOffset, node.location.endOffset + 1);
function walkAst(node, visit, branch = '', deferred = false) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => walkAst(child, visit, branch, deferred)); return; }
  if (!node.type) return;
  visit(node, branch, deferred);
  if (['FunctionDeclaration', 'FunctionExpression', 'ClassDeclaration', 'ClassExpression'].includes(node.type)) return;
  if (node.type === 'IfStatement') {
    walkAst(node.test, visit, branch, deferred);
    walkAst(node.consequent, visit, [branch, 'if'].filter(Boolean).join(' / '), deferred);
    walkAst(node.alternate, visit, [branch, 'else'].filter(Boolean).join(' / '), deferred); return;
  }
  if (node.type === 'TryStatement') {
    walkAst(node.block, visit, branch, deferred);
    walkAst(node.handler, visit, [branch, 'catch'].filter(Boolean).join(' / '), deferred);
    walkAst(node.finalizer, visit, [branch, 'finally'].filter(Boolean).join(' / '), deferred); return;
  }
  const later = deferred || node.type === 'ArrowFunctionExpression';
  for (const [key, value] of Object.entries(node)) if (!['loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'decorators'].includes(key)) walkAst(value, visit, branch, later);
}
function bindingNames(node) {
  if (!node) return [];
  if (node.type === 'Identifier') return [node.name];
  if (node.type === 'TSParameterProperty') return bindingNames(node.parameter);
  if (node.type === 'AssignmentPattern') return bindingNames(node.left);
  if (node.type === 'RestElement') return bindingNames(node.argument);
  if (node.type === 'ObjectPattern') return node.properties.flatMap(item => bindingNames(item.type === 'RestElement' ? item.argument : item.value));
  if (node.type === 'ArrayPattern') return node.elements.flatMap(bindingNames);
  return [];
}
function tsType(node) {
  const type = node?.typeAnnotation?.typeAnnotation;
  return type?.type === 'TSTypeReference' ? type.typeName?.name : null;
}
function parseTypescript(file) {
  const source = file.content;
  const ast = parseBabel(source, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx', 'decorators-legacy'], attachComment: false });
  const imports = new Map(), decorators = new Map(), classes = [];
  for (const statement of ast.program.body) if (statement.type === 'ImportDeclaration') for (const spec of statement.specifiers) {
    imports.set(spec.local.name, { module: statement.source.value, name: spec.imported?.name || 'default', typeOnly: statement.importKind === 'type' || spec.importKind === 'type', line: statement.loc.start.line });
    if (['@nestjs/common', '@nestjs/microservices', '@nestjs/schedule', '@nestjs/bull'].includes(statement.source.value)) decorators.set(spec.local.name, { name: spec.imported?.name, module: statement.source.value });
  }
  const annotations = node => (node.decorators || []).flatMap(decorator => {
    const call = decorator.expression, imported = decorators.get(call.callee?.name);
    if (!imported) return [];
    const route = call.arguments?.length ? call.arguments[0]?.type === 'StringLiteral' ? call.arguments[0].value : null : '';
    return [{ ...imported, route, raw: source.slice(call.start, call.end), kafka: call.arguments?.some(arg => arg.type === 'MemberExpression' && arg.object?.type === 'Identifier' && imports.get(arg.object.name)?.module === '@nestjs/microservices' && imports.get(arg.object.name)?.name === 'Transport' && arg.property?.name === 'KAFKA') }];
  });
  for (const statement of ast.program.body) {
    const cls = statement.declaration || statement;
    if (cls.type !== 'ClassDeclaration' || !cls.id) continue;
    const owner = { name: cls.id.name, path: file.path, imports, fields: new Map(), methods: [] };
    const controller = annotations(cls).find(item => item.module === '@nestjs/common' && item.name === 'Controller');
    for (const member of cls.body.body) {
      if (member.type === 'ClassProperty' && member.key?.name && tsType(member)) owner.fields.set(member.key.name, tsType(member));
      if (member.kind === 'constructor') for (const param of member.params) {
        const value = param.type === 'TSParameterProperty' ? param.parameter : param;
        if (value.name && tsType(value)) owner.fields.set(value.name, tsType(value));
      }
    }
    for (const member of cls.body.body) {
      if (member.type !== 'ClassMethod' || member.kind === 'constructor' || !member.key.name || !member.body) continue;
      const method = { id: `${file.path}#${owner.name}.${member.key.name}:${member.start}`, path: file.path,
        className: owner.name, name: member.key.name, arity: member.params.length,
        startLine: member.loc.start.line, endLine: member.loc.end.line, bodyLine: member.body.loc.start.line,
        calls: [], endings: [], owner };
      const route = annotations(member).find(item => item.module === '@nestjs/common' && ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All'].includes(item.name));
      if (controller && controller.route !== null && route?.route !== null && route) method.endpoint = { method: route.name === 'All' ? 'ANY' : route.name.toUpperCase(), path: joinRoute(controller.route, route.route) };
      const trigger = annotations(member).find(item => item.module === '@nestjs/microservices' && ['EventPattern', 'MessagePattern'].includes(item.name) || item.module === '@nestjs/schedule' && ['Cron', 'Interval', 'Timeout'].includes(item.name) || item.module === '@nestjs/bull' && item.name === 'Process');
      if (trigger) method.trigger = { kind: trigger.module === '@nestjs/schedule' ? 'scheduled' : trigger.module === '@nestjs/bull' ? 'job' : trigger.kafka ? 'kafka' : 'message', detail: trigger.route || trigger.raw, declaration: trigger.raw };
      method.shadowed = new Set(member.params.flatMap(bindingNames));
      walkAst(member.body, node => { if (node.type === 'VariableDeclarator') bindingNames(node.id).forEach(name => method.shadowed.add(name)); });
      walkAst(member.body, (node, branch, deferred) => {
        if (!deferred && (node.type === 'ReturnStatement' || node.type === 'ThrowStatement')) method.endings.push({ kind: node.type === 'ReturnStatement' ? 'return' : 'throw', path: file.path, line: node.loc.start.line, branch });
        if (!['CallExpression', 'OptionalCallExpression'].includes(node.type)) return;
        const callee = node.callee;
        let receiver, name;
        if (callee.type === 'Identifier') { receiver = '<lexical>'; name = callee.name; }
        else if (['MemberExpression', 'OptionalMemberExpression'].includes(callee.type) && !callee.computed) {
          name = callee.property.name;
          receiver = source.slice(callee.object.start, callee.object.end);
        }
        if (!name) return;
        method.calls.push({ receiver, name, arity: node.arguments.length, line: node.loc.start.line, offset: node.start,
          label: `${receiver}.${name}()`, branch, deferred });
      });
      owner.methods.push(method);
    }
    classes.push(owner);
  }
  const lexical = { name: file.path.split('/').at(-1).replace(/\.[^.]+$/, ''), path: file.path, imports, fields: new Map(), methods: [], lexical: true };
  for (const statement of ast.program.body) {
    const declaration = statement.declaration || statement;
    const definitions = declaration.type === 'FunctionDeclaration' ? [{ id: declaration.id, init: declaration }] : declaration.type === 'VariableDeclaration' ? declaration.declarations.filter(item => ['ArrowFunctionExpression', 'FunctionExpression'].includes(item.init?.type)) : [];
    for (const definition of definitions) {
      const fn = definition.init;
      if (!definition.id?.name || !fn.body) continue;
      const method = { id: `${file.path}#function.${definition.id.name}:${fn.start}`, path: file.path, className: lexical.name, name: definition.id.name, arity: fn.params.length, startLine: fn.loc.start.line, endLine: fn.loc.end.line, bodyLine: fn.body.loc.start.line, owner: lexical, calls: [], endings: [], shadowed: new Set(fn.params.flatMap(bindingNames)) };
      walkAst(fn.body, node => { if (node.type === 'VariableDeclarator') bindingNames(node.id).forEach(name => method.shadowed.add(name)); });
      walkAst(fn.body, (node, branch, deferred) => {
        if (!deferred && ['ReturnStatement', 'ThrowStatement'].includes(node.type)) method.endings.push({ kind: node.type === 'ReturnStatement' ? 'return' : 'throw', path: file.path, line: node.loc.start.line, branch });
        if (!['CallExpression', 'OptionalCallExpression'].includes(node.type)) return;
        const callee = node.callee;
        const name = callee.type === 'Identifier' ? callee.name : !callee.computed ? callee.property?.name : null;
        if (name) method.calls.push({ receiver: callee.type === 'Identifier' ? '<lexical>' : source.slice(callee.object.start, callee.object.end), name, arity: node.arguments.length, line: node.loc.start.line, offset: node.start, label: `${name}()`, branch, deferred });
      });
      if (fn.body.type !== 'BlockStatement') method.endings.push({ kind: 'return', path: file.path, line: fn.body.loc.start.line, branch: '' });
      lexical.methods.push(method);
    }
  }
  if (lexical.methods.length) classes.push(lexical);
  return classes;
}
let javaModule;
async function parseJava(file) {
  javaModule ||= import('java-parser');
  const { lexAndParse } = await javaModule;
  const source = file.content, { cst } = lexAndParse(source), classes = [];
  const packageName = cstFind(cst, 'packageDeclaration').map(node => cstTokens(node).filter(token => token.tokenType.name === 'Identifier').map(token => token.image).join('.'))[0] || '';
  const imports = new Map(), wildcards = [];
  for (const node of cstFind(cst, 'importDeclaration')) {
    const tokens = cstTokens(node), parts = tokens.filter(token => token.tokenType.name === 'Identifier').map(token => token.image);
    const qualified = parts.join('.');
    if (tokens.some(token => token.image === '*')) wildcards.push(qualified);
    else imports.set(parts.at(-1), { qualified, line: node.location.startLine });
  }
  function annotations(modifiers) {
    return (modifiers || []).flatMap(node => cstFind(node, 'annotation')).map(node => {
      const name = cstTokens(node.children.typeName[0]).map(token => token.image).join('.'), raw = textOf(source, node);
      const stereotype = name === 'org.springframework.stereotype.Controller' || (name === 'Controller' && imports.get(name)?.qualified === 'org.springframework.stereotype.Controller');
      const spring = stereotype || name.startsWith('org.springframework.web.bind.annotation.') || imports.get(name)?.qualified === `org.springframework.web.bind.annotation.${name}` || wildcards.includes('org.springframework.web.bind.annotation');
      const tokens = cstTokens(node), assignments = tokens.filter(token => token.image === '=');
      const key = tokens.findIndex((token, index) => ['path', 'value'].includes(token.image) && tokens[index + 1]?.image === '=');
      const opening = tokens.findIndex(token => token.image === '(');
      const candidate = key >= 0 ? tokens[key + 2] : assignments.length || opening < 0 ? null : tokens[opening + 1];
      let path = '';
      if (candidate?.tokenType.name === 'StringLiteral') { try { path = JSON.parse(candidate.image); } catch { path = null; } }
      else if (key >= 0 || (!assignments.length && tokens.findIndex(token => token.image === '(') >= 0 && tokens.slice(tokens.findIndex(token => token.image === '(') + 1, -1).length)) path = null;
      const verbs = [...new Set(tokens.flatMap((token, index) => token.image === 'RequestMethod' && tokens[index + 1]?.image === '.' && /^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|TRACE)$/.test(tokens[index + 2]?.image) ? [tokens[index + 2].image] : []))];
      return { name: name.split('.').at(-1), qualified: name.includes('.') ? name : imports.get(name)?.qualified || (wildcards.includes('org.springframework.kafka.annotation') && name === 'KafkaListener' ? 'org.springframework.kafka.annotation.KafkaListener' : wildcards.includes('org.springframework.scheduling.annotation') && name === 'Scheduled' ? 'org.springframework.scheduling.annotation.Scheduled' : null), spring, path, raw, verb: verbs.length === 1 ? verbs[0] : 'ANY' };
    });
  }
  for (const declaration of cstFind(cst, 'classDeclaration')) {
    const cls = declaration.children.normalClassDeclaration?.[0];
    if (!cls) continue;
    const name = cstTokens(cls.children.typeIdentifier[0])[0].image;
    const owner = { name, qualified: [packageName, name].filter(Boolean).join('.'), packageName, path: file.path, imports, wildcards, fields: new Map(), methods: [] };
    const classAnnotations = annotations(declaration.children.classModifier);
    const isController = classAnnotations.some(item => item.spring && ['RestController', 'Controller'].includes(item.name));
    const prefix = classAnnotations.find(item => item.spring && item.name === 'RequestMapping');
    const body = cls.children.classBody[0];
    const ownMembers = name => { const result = []; const visit = n => { if (!n?.children || n.name === 'classDeclaration') return; if (n.name === name) result.push(n); else children(n).forEach(visit); }; visit(body); return result; };
    for (const field of ownMembers('fieldDeclaration')) {
      const type = cstTokens(field.children.unannType[0]).find(token => token.tokenType.name === 'Identifier')?.image;
      for (const variable of cstFind(field, 'variableDeclaratorId')) if (type) owner.fields.set(cstTokens(variable)[0].image, type);
    }
    for (const node of ownMembers('methodDeclaration')) {
      const header = node.children.methodHeader[0], declarator = cstFind(header, 'methodDeclarator')[0];
      const methodName = declarator.children.Identifier[0].image;
      const methodBody = node.children.methodBody?.[0];
      if (!methodBody?.children.block) continue;
      const shadowed = new Set([...cstFind(declarator, 'formalParameter'), ...cstFind(methodBody, 'localVariableDeclaration')].flatMap(node => cstFind(node, 'variableDeclaratorId')).map(node => cstTokens(node)[0]?.image));
      const method = { shadowed, id: `${file.path}#${name}.${methodName}:${node.location.startOffset}`, path: file.path,
        className: name, name: methodName, arity: cstFind(declarator, 'formalParameter').length,
        startLine: node.location.startLine, endLine: node.location.endLine, bodyLine: methodBody.location.startLine,
        calls: [], endings: [], owner };
      const route = annotations(node.children.methodModifier).find(item => item.spring && /^(?:Get|Post|Put|Patch|Delete|Options|Head|Request)Mapping$/.test(item.name));
      if (isController && route && route.path !== null && prefix?.path !== null) {
        const verb = route.name === 'RequestMapping' ? route.verb : route.name.replace('Mapping', '').toUpperCase();
        method.endpoint = { method: verb, path: joinRoute(prefix?.path || '', route.path) };
      }
      const trigger = annotations(node.children.methodModifier).find(item => ['org.springframework.kafka.annotation.KafkaListener', 'org.springframework.scheduling.annotation.Scheduled', 'org.springframework.context.event.EventListener'].includes(item.qualified));
      if (trigger) method.trigger = { kind: trigger.name === 'KafkaListener' ? 'kafka' : trigger.name === 'Scheduled' ? 'scheduled' : 'message', detail: trigger.raw, declaration: trigger.raw };
      function visit(n, branch = '', deferred = false) {
        if (!n?.children) return;
        if (n !== methodBody && ['classDeclaration', 'methodDeclaration'].includes(n.name)) return;
        const nextBranch = /^(?:ifStatement|catchClause|finally|forStatement|whileStatement)/.test(n.name) ? [branch, n.name.replace(/Statement.*$/, '')].filter(Boolean).join(' / ') : branch;
        const later = deferred || n.name === 'lambdaExpression';
        if (!later && (n.name === 'returnStatement' || n.name === 'throwStatement')) method.endings.push({ kind: n.name === 'returnStatement' ? 'return' : 'throw', path: file.path, line: n.location.startLine, branch: nextBranch });
        if (n.name === 'primary') {
          const prefixTokens = cstTokens(n.children.primaryPrefix?.[0]);
          const chain = prefixTokens.map(token => token.image).join('');
          let current = chain;
          for (const suffix of n.children.primarySuffix || []) {
            if (suffix.children.Identifier) current += '.' + suffix.children.Identifier[0].image;
            const invoke = suffix.children.methodInvocationSuffix?.[0];
            if (!invoke) continue;
            if (/^(?:this\.)?[\w$]+(?:\.[\w$]+)*$/.test(current)) {
              const parts = current.split('.'), called = parts.pop(), receiver = parts.join('.') || 'this';
              method.calls.push({ receiver, name: called, arity: invoke.children.argumentList?.[0]?.children.expression?.length || 0,
                line: n.location.startLine, offset: invoke.location.startOffset, label: `${receiver}.${called}()`, branch: nextBranch, deferred: later });
            }
            current += '()';
          }
        }
        children(n).forEach(child => visit(child, nextBranch, later));
      }
      visit(methodBody); owner.methods.push(method);
    }
    classes.push(owner);
  }
  return classes;
}
function changedMethod(method, file) {
  if (!file || file.contextOnly || file.deleted_file) return false;
  const rows = file.rows || parseDiff(file.diff || '');
  if (!rows.length || file.new_file) return true;
  const removals = []; let cursor = 1;
  for (const row of rows) {
    if (row.kind === 'hunk') cursor = Number(row.text.match(/\+(\d+)/)?.[1] || cursor);
    else if (row.kind === 'removed') removals.push(cursor);
    else if (row.newLine) cursor = row.newLine + 1;
  }
  if (removals.some(line => line >= method.startLine && line <= method.endLine)) return true;
  if (rows.some(row => row.kind === 'added' && row.newLine >= method.startLine && row.newLine <= method.endLine)) return true;
  // Imports, class/field wiring, or pure deletions can affect every method. Keep
  // impact conservative; never drop a route because only wiring changed.
  return removals.some(line => !file.__methods.some(item => line >= item.startLine && line <= item.endLine)) || rows.some(row => row.kind === 'added' && !file.__methods.some(item => row.newLine >= item.startLine && row.newLine <= item.endLine)) ||
    (!rows.some(row => row.kind === 'added') && rows.some(row => row.kind === 'removed'));
}
export async function analyzeApiFlows(files, { coverage = {} } = {}) {
  const classes = [], failures = [], byPath = new Map(files.map(file => [file.path, file]));
  for (const file of files) {
    if (file.deleted_file || !/\.(?:[cm]?[jt]sx?|java)$/.test(file.path)) continue;
    if (typeof file.content !== 'string' || file.content.length > 200000) { failures.push({ path: file.path, reason: 'Full source unavailable or exceeds 200 kB' }); continue; }
    try { classes.push(...(file.path.endsWith('.java') ? await parseJava(file) : parseTypescript(file))); }
    catch { failures.push({ path: file.path, reason: 'Source could not be parsed' }); }
  }
  const declaredTransactions = transactionScopes(files).scopes;
  const methods = classes.flatMap(owner => owner.methods), fileMethods = new Map();
  for (const method of methods) { if (!fileMethods.has(method.path)) fileMethods.set(method.path, []); fileMethods.get(method.path).push(method); }
  const changed = new Set(methods.filter(method => changedMethod(method, { ...byPath.get(method.path), __methods: fileMethods.get(method.path) })).map(method => method.id));
  function resolve(method, call) {
    const receiver = call.receiver.replace(/^this\./, '');
    if (!call.receiver.startsWith('this.') && method.shadowed?.has(receiver.split('.')[0])) return null;
    let targets;
    if (call.receiver === '<lexical>') {
      if (method.shadowed?.has(call.name)) return null;
      const imported = method.owner.imports.get(call.name);
      if (imported?.module?.startsWith('.')) {
        if (imported.typeOnly && call.receiver === '<lexical>') return null;
        const parts = method.path.split('/').slice(0, -1);
        for (const part of imported.module.split('/')) if (part === '..') parts.pop(); else if (part !== '.') parts.push(part);
        const matches = classes.filter(owner => owner.lexical && pathKey(owner.path) === pathKey(parts.join('/'))).flatMap(owner => owner.methods.filter(target => target.name === imported.name && target.arity === call.arity));
        return matches.length === 1 ? matches[0] : null;
      }
      const matches = classes.filter(owner => owner.lexical && owner.path === method.path).flatMap(owner => owner.methods.filter(target => target.name === call.name && target.arity === call.arity));
      return matches.length === 1 ? matches[0] : null;
    }
    if (call.receiver === 'this') targets = [method.owner];
    else {
      const type = method.owner.fields.get(receiver) || receiver, imported = method.owner.imports.get(type);
      if (imported?.module?.startsWith('.')) {
        const parts = method.path.split('/').slice(0, -1);
        for (const part of imported.module.split('/')) if (part === '..') parts.pop(); else if (part !== '.') parts.push(part);
        targets = classes.filter(owner => pathKey(owner.path) === pathKey(parts.join('/')) && (imported.name === 'default' || owner.name === imported.name));
      } else if (method.owner.packageName !== undefined) {
        const qualified = imported?.qualified || [method.owner.packageName, type].filter(Boolean).join('.');
        targets = classes.filter(owner => owner.qualified === qualified);
        if (!targets.length) targets = classes.filter(owner => method.owner.wildcards.some(pkg => owner.qualified === `${pkg}.${type}`));
      } else targets = [];
    }
    const matches = (targets || []).flatMap(owner => owner.methods.filter(target => target.name === call.name && target.arity === call.arity));
    return matches.length === 1 ? matches[0] : null;
  }
  const flows = [], consumed = new Set(), coveredMethods = new Set();
  const entryRoots = methods.filter(method => method.endpoint || method.trigger);
  const incoming = new Map(methods.map(method => [method.id, 0]));
  for (const method of methods) for (const call of method.calls) { const target = resolve(method, call); if (target && target.id !== method.id) incoming.set(target.id, incoming.get(target.id) + 1); }
  const roots = [...entryRoots, ...methods.filter(method => changed.has(method.id) && !entryRoots.includes(method))];
  for (const root of roots.sort((a, b) => Number(!!(b.endpoint || b.trigger)) - Number(!!(a.endpoint || a.trigger)) || (!(a.endpoint || a.trigger) && !(b.endpoint || b.trigger) ? incoming.get(a.id) - incoming.get(b.id) : 0) || a.path.localeCompare(b.path) || a.startLine - b.startLine)) {
    if (!root.endpoint && !root.trigger && coveredMethods.has(root.id)) continue;
    const reachable = new Map(), sequence = [], boundaries = [], expanded = new Set();
    let truncated = false;
    function expand(method, stack = new Set()) {
      if (reachable.size >= 200 || sequence.length >= 500) { truncated = true; return; }
      reachable.set(method.id, method);
      if (expanded.has(method.id)) return;
      expanded.add(method.id);
      const current = new Set([...stack, method.id]);
      for (const call of [...method.calls].sort((a, b) => a.offset - b.offset)) {
        if (sequence.length >= 500) { truncated = true; break; }
        const target = resolve(method, call), asyncBoundary = !!target && /(?:Queue|Producer|Publisher|EventBus)$/.test(target.className) && /^(?:enqueue|addJob|publish|sendMessage|send|emit)$/.test(call.name);
        const deferred = call.deferred && !declaredTransactions.some(scope => scope.path === method.path && call.line > scope.startLine && call.line < scope.endLine);
        if (!target) { boundaries.push({ ...call, path: method.path, reason: deferred ? 'Callback execution is not established' : 'Target method unresolved' }); continue; }
        sequence.push({ from: method.path, to: target.path, label: `${method.className}.${method.name} → ${target.className}.${target.name}()${call.branch ? ' · ' + call.branch : ''}`,
          path: method.path, line: call.line, offset: call.offset, targetLine: target.bodyLine, fromMethod: method.id, toMethod: target.id,
          branch: call.branch, deferred, evidence: 'code', asyncBoundary });
        reachable.set(target.id, target);
        if (deferred) {
          boundaries.push({ ...call, path: method.path, targetPath: target.path, reason: asyncBoundary ? 'Dispatch boundary · worker runs separately' : 'Callback execution is not established' });
        } else if (current.has(target.id)) boundaries.push({ ...call, path: method.path, targetPath: target.path, reason: 'Recursive call · expansion stops here' });
        else {
          if (asyncBoundary) boundaries.push({ ...call, path: method.path, targetPath: target.path, reason: 'Dispatch helper · background worker is a separate flow' });
          expand(target, current);
        }
      }
    }
    expand(root);
    if (![...reachable.keys()].some(id => changed.has(id))) continue;
    const included = [...reachable.values()], paths = [...new Set(included.map(method => method.path))];
    const changedPaths = paths.filter(path => !byPath.get(path)?.contextOnly);
    included.forEach(method => coveredMethods.add(method.id));
    changedPaths.forEach(path => consumed.add(path));
    const nodes = paths.map(path => ({ id: path, path, label: new Set(included.filter(method => method.path === path).map(method => method.className)).size === 1 ? included.find(method => method.path === path).className : path.split('/').at(-1),
      change: byPath.get(path)?.contextOnly ? 'context' : byPath.get(path)?.new_file ? 'added' : 'changed',
      lines: (byPath.get(path)?.rows || []).filter(row => row.kind === 'added' || row.kind === 'removed').length,
      methods: included.filter(method => method.path === path).map(method => ({ name: method.name, className: method.className, line: method.bodyLine })) }));
    const dependencies = sequence.filter(edge => edge.from !== edge.to).filter((edge, index, list) => list.findIndex(item => item.from === edge.from && item.to === edge.to) === index);
    const contracts = new Map();
    for (const method of included) for (const [local, imported] of method.owner.imports) {
      let candidates = [];
      if (imported.module?.startsWith('.')) {
        const parts = method.path.split('/').slice(0, -1);
        for (const part of imported.module.split('/')) if (part === '..') parts.pop(); else if (part !== '.') parts.push(part);
        candidates = files.filter(file => pathKey(file.path) === pathKey(parts.join('/')));
      } else if (imported.qualified) candidates = files.filter(file => file.path.replace(/\.java$/, '').endsWith(imported.qualified.replace(/\./g, '/')));
      if (candidates.length !== 1) continue;
      const contract = candidates[0], role = classifyReviewFile(contract);
      if (!REVIEW_ROLES.find(item => item.id === role.role)?.data || paths.includes(contract.path)) continue;
      contracts.set(contract.path, contract);
      if (!dependencies.some(edge => edge.from === method.path && edge.to === contract.path && edge.evidence === 'type')) dependencies.push({ from: method.path, to: contract.path, path: method.path, line: imported.line || method.startLine, label: `Imported contract · ${local}`, evidence: 'type', relation: 'contract' });
    }
    for (const contract of contracts.values()) {
      paths.push(contract.path);
      nodes.push({ id: contract.path, path: contract.path, label: contract.path.split('/').at(-1).replace(/\.[^.]+$/, ''), change: contract.contextOnly ? 'context' : 'changed', methods: [], dataContract: true });
    }
    const ranges = included.map(method => ({ id: method.id, path: method.path, className: method.className, name: method.name, startLine: method.startLine, endLine: method.endLine, bodyLine: method.bodyLine, changed: changed.has(method.id) }));
    const endings = included.flatMap(method => method.endings.map(end => ({ ...end, method: method.name, root: method.id === root.id })));
    const kind = root.endpoint ? 'api' : root.trigger?.kind || 'core';
    const titles = { kafka: 'Kafka', message: 'Message', scheduled: 'Scheduled', job: 'Job', core: 'Core' };
    const title = root.endpoint ? `${root.endpoint.method} ${root.endpoint.path}` : `${titles[kind]} · ${root.className}.${root.name}()`;

    flows.push({ id: `${kind}:${root.path}:${root.className}.${root.name}:${title}`, label: title, title, subtitle: root.trigger ? `${root.trigger.detail} → handler completion` : `${root.className}.${root.name}() → ${root.endpoint ? 'handler return' : 'method completion'}`,
      kind, api: kind === 'api', methodFlow: true, trigger: root.trigger || null, paths, changedPaths, sharedPaths: [], contracts: [...contracts.keys()], ranges, boundaries, endings,
      entrypoint: { path: root.path, line: root.bodyLine, kind, label: `${root.className}.${root.name}()`, endpoint: root.endpoint },
      reason: root.endpoint || root.trigger ? 'Declared entry point and statically resolved method calls from immutable source' : 'Changed core method and its resolved callees; no runtime entry point established',
      graph: { nodes, dependencies, sequence, boundaryDependencies: [], boundarySequence: [] },
      coverage: { ...coverage, parsedFiles: new Set(classes.map(owner => owner.path)).size, failedFiles: failures.length, truncated: truncated || !!coverage.omittedPatches } });
  }
  return { flows, consumedPaths: [...consumed].filter(path => !byPath.get(path)?.deferred && !byPath.get(path)?.unavailable && (fileMethods.get(path) || []).filter(method => changed.has(method.id)).every(method => coveredMethods.has(method.id))), failures, coverage,
    contextFiles: files.filter(file => flows.some(flow => flow.paths.includes(file.path))) };
}
