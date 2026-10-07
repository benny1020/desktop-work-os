import { reviewFlowMetadata } from './review-architecture.mjs';
// Review groups are navigation aids derived from paths and verified imports.
// They describe changed-file structure, never runtime execution or business intent.
const MAX_PRIMARY_FILES = 12;
const MAX_SHARED_FILES = 6;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = values => [...values].sort(compare);
const basename = path => path.split('/').at(-1);
const genericDirectories = new Set(['src', 'source', 'sources', 'main', 'test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'integration', 'unit', 'java', 'kotlin', 'python', 'js', 'ts', 'app', 'api', 'web', 'server', 'client', 'controllers', 'controller', 'services', 'service', 'repositories', 'repository', 'models', 'model', 'entities', 'entity', 'components', 'component', 'hooks', 'handlers', 'handler', 'routes', 'route', 'views', 'view', 'dto', 'dtos', 'interfaces', 'types', 'lib', 'utils', 'util', 'common', 'shared', 'core', 'config', 'configuration', 'docs', 'doc', 'documentation', 'assets', 'public', 'resources']);
const canonicalPath = file => file?.path || file?.new_path || file?.old_path;
function describe(path) {
  const segments = path.split('/').filter(Boolean), directories = segments.slice(0, -1);
  const name = basename(path);
  let kind = /(?:^|\/)(?:tests?|__tests__|specs?|e2e)(?:\/|$)|(?:[._-](?:test|spec)|Test|Tests|Spec)\.(?:[cm]?[jt]sx?|java|kt|py|go|rb|rs|c|cpp|cs)$/i.test(path)
    ? 'tests' : /(?:^|\/)(?:docs?|documentation)(?:\/|$)|\.(?:md|mdx|rst|adoc)$/i.test(path)
      ? 'docs' : /(?:^|\/)(?:\.github|\.gitlab|config|configuration)(?:\/|$)|\.(?:json|ya?ml|toml|ini|conf|lock)$|(?:^|\/)(?:Dockerfile|Makefile|\.env[^/]*)$/i.test(path)
        ? 'config' : 'code';
  let area = '';
  for (const markers of [['features', 'feature', 'domains', 'domain', 'modules', 'module'], ['packages', 'apps', 'services']]) {
    const index = directories.findLastIndex(part => markers.includes(part.toLowerCase()));
    if (index >= 0 && directories[index + 1] && !genericDirectories.has(directories[index + 1].toLowerCase())) {
      area = directories[index + 1]; break;
    }
  }
  if (!area) {
    let candidates = directories;
    const packageRoot = candidates.findIndex(part => ['com', 'org', 'net', 'io'].includes(part));
    if (packageRoot >= 0 && candidates.slice(0, packageRoot).some(part => ['java', 'kotlin'].includes(part))) candidates = candidates.slice(packageRoot + 2);
    area = candidates.find(part => !genericDirectories.has(part.toLowerCase()) && !part.startsWith('.')) || '';
  }
  return { path, kind, area,
    sharedCandidate: directories.some(part => ['shared', 'common', 'utils', 'util', 'lib', 'core'].includes(part.toLowerCase())) || /^(?:logger|logging|constants|types|config|helpers?|utils?)\./i.test(name),
    stem: name.replace(/\.[^.]+$/, '').replace(/(?:[._-](?:test|spec)|Tests?|Spec)$/i, ''),
  };
}
function identifier(paths) {
  let hash = 14695981039346656037n;
  for (const char of paths.join('\0')) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0))) * 1099511628211n);
  return `flow-${hash.toString(16)}`;
}
function walk(paths, neighbors) {
  const remaining = new Set(sorted(paths)), ordered = [];
  while (remaining.size) {
    const queue = [remaining.values().next().value];
    remaining.delete(queue[0]);
    for (let index = 0; index < queue.length; index++) {
      const path = queue[index]; ordered.push(path);
      for (const neighbor of sorted(neighbors.get(path) || [])) if (remaining.delete(neighbor)) queue.push(neighbor);
    }
  }
  return ordered;
}

export function buildReviewFlows(files = [], graph = {}) {
  const paths = sorted(new Set(files.map(canonicalPath).filter(path => typeof path === 'string' && path.length)));
  if (!paths.length) return [];
  const details = new Map(paths.map(path => [path, describe(path)]));
  const aliases = new Map(paths.map(path => [path, path]));
  const candidates = new Map();
  for (const file of files) {
    const path = canonicalPath(file);
    if (!details.has(path)) continue;
    for (const alias of [file.old_path, file.new_path]) if (alias && !aliases.has(alias)) {
      if (!candidates.has(alias)) candidates.set(alias, new Set());
      candidates.get(alias).add(path);
    }
  }
  for (const [alias, values] of candidates) if (values.size === 1) aliases.set(alias, [...values][0]);
  const edges = (graph.dependencies || []).filter(edge => edge.evidence === 'code')
    .map(edge => ({ from: aliases.get(edge.from), to: aliases.get(edge.to) }))
    .filter(edge => edge.from && edge.to && edge.from !== edge.to);
  const neighbors = new Map(paths.map(path => [path, new Set()]));
  for (const edge of edges) { neighbors.get(edge.from).add(edge.to); neighbors.get(edge.to).add(edge.from); }
  const shared = new Set(paths.filter(path => {
    const adjacent = neighbors.get(path), areas = new Set([...adjacent].map(other => details.get(other).area).filter(Boolean));
    return areas.size > 1 && (details.get(path).sharedCandidate || adjacent.size >= Math.max(4, Math.ceil(paths.length * 0.4)));
  }));
  const parents = new Map(paths.filter(path => !shared.has(path)).map(path => [path, path]));
  function find(path) {
    let root = path;
    while (parents.get(root) !== root) root = parents.get(root);
    while (path !== root) { const parent = parents.get(path); parents.set(path, root); path = parent; }
    return root;
  }
  function join(a, b) { const left = find(a), right = find(b); if (left !== right) parents.set(compare(left, right) < 0 ? right : left, compare(left, right) < 0 ? left : right); }
  for (const edge of edges) {
    if (shared.has(edge.from) || shared.has(edge.to)) continue;
    const a = details.get(edge.from), b = details.get(edge.to);
    if (a.area && b.area && a.area !== b.area) continue;
    join(edge.from, edge.to);
  }
  // Flat Java/TS layer folders often contain several unrelated features. Class
  // families keep OrderController/OrderService separate from Payment*, even
  // when both live in the same package. Verified imports still connect helpers.
  const classFamily = path => details.get(path).stem.match(/^(.+?)(?:Controller|Service|Repository|Repo|DAO|Dao|Mapper|UseCase|Interactor|[._-](?:controller|service|repository|repo|dao|mapper|use-?case|interactor))$/)?.[1] || '';
  const familiesByArea = new Map();
  for (const path of parents.keys()) {
    const item = details.get(path), family = classFamily(path);
    if (item.kind !== 'code' || !family) continue;
    if (!familiesByArea.has(item.area)) familiesByArea.set(item.area, new Set());
    familiesByArea.get(item.area).add(family);
  }
  const groupingArea = path => {
    const item = details.get(path), family = classFamily(path);
    return (familiesByArea.get(item.area)?.size > 1 && family) ? `${item.area}::${family}` : item.area;
  };
  const areas = new Map();
  for (const path of parents.keys()) {
    const { kind } = details.get(path);
    const areaKey = groupingArea(path);
    if (!areaKey || kind !== 'code') continue;
    if (areas.has(areaKey)) join(path, areas.get(areaKey)); else areas.set(areaKey, path);
  }
  // A colocated test/document belongs with its area. A uniquely named test may
  // follow its implementation; duplicate basenames never choose an arbitrary owner.
  const implementations = new Map();
  for (const path of parents.keys()) {
    const item = details.get(path);
    if (item.kind !== 'code') continue;
    if (!implementations.has(item.stem)) implementations.set(item.stem, []);
    implementations.get(item.stem).push(path);
  }
  for (const path of parents.keys()) {
    const item = details.get(path);
    if (item.kind === 'code') continue;
    // Match a test by implementation before choosing a broad directory area.
    if (item.kind === 'tests') {
      const matches = implementations.get(item.stem) || [];
      if (matches.length === 1) { join(path, matches[0]); continue; }
    }
    if (item.area && areas.has(item.area) && (familiesByArea.get(item.area)?.size || 0) <= 1) { join(path, areas.get(item.area)); continue; }
  }
  const components = new Map();
  for (const path of parents.keys()) { const root = find(path); if (!components.has(root)) components.set(root, []); components.get(root).push(path); }
  const clusters = [...components.values()];
  const substantive = clusters.filter(cluster => cluster.some(path => details.get(path).kind === 'code') &&
    (cluster.some(path => details.get(path).area || classFamily(path)) || cluster.length > 1));
  const distinctAreas = new Set(paths.filter(path => !shared.has(path) && details.get(path).kind === 'code').map(path => details.get(path).area).filter(Boolean));
  let groups;
  if (!shared.size && distinctAreas.size <= 1 && substantive.length <= 1) {
    const kinds = new Set(paths.map(path => details.get(path).kind));
    const supportLabel = kinds.size === 1 ? { tests: 'Tests', docs: 'Documentation', config: 'Configuration' }[[...kinds][0]] : null;
    groups = [{ paths, label: distinctAreas.size ? [...distinctAreas][0] : supportLabel || (kinds.has('code') ? 'Changed files' : 'Supporting files'),
      reason: distinctAreas.size ? 'One structural directory area; supporting files stay with the change.' : 'No separate structural change areas were established; files stay together for review.' }];
  } else {
    groups = [];
    const loose = new Map();
    for (const cluster of clusters) {
      const code = cluster.filter(path => details.get(path).kind === 'code');
      if (code.length && (cluster.length > 1 || details.get(code[0]).area || classFamily(code[0]))) {
        const area = details.get(code[0]).area;
        groups.push({ paths: cluster, label: area || basename(code[0]), reason: area ? `Grouped by the ${area} directory area and verified imports.` : 'Connected by verified imports between changed files.' });
      } else {
        const kind = details.get(cluster[0]).kind;
        if (!loose.has(kind)) loose.set(kind, []);
        loose.get(kind).push(...cluster);
      }
    }
    const labels = { code: 'Other source files', tests: 'Tests', docs: 'Documentation', config: 'Configuration' };
    for (const [kind, members] of loose) groups.push({ paths: members, label: labels[kind], reason: 'No verified link to a specific change area; kept as an explicit review group.' });
    if (shared.size) groups.push({ paths: sorted(shared), label: 'Shared code', reason: 'Shared dependencies are reviewed once and linked from their consuming areas.' });
  }
  const output = [];
  for (const group of groups) {
    const ordered = walk(group.paths, neighbors), count = Math.ceil(ordered.length / MAX_PRIMARY_FILES);
    for (let index = 0; index < count; index++) {
      const primary = sorted(ordered.slice(index * MAX_PRIMARY_FILES, (index + 1) * MAX_PRIMARY_FILES));
      const primarySet = new Set(primary);
      const related = sorted(new Set(primary.flatMap(path => [...neighbors.get(path)].filter(other => shared.has(other) && !primarySet.has(other)))));
      const hasCodeEdge = primary.some(path => [...neighbors.get(path)].some(other => primarySet.has(other)));
      const metadata = reviewFlowMetadata(primary, files, { ...graph, dependencies: edges.map(edge => ({ ...edge, evidence: 'code' })) }, group.label);
      output.push({ ...metadata, id: identifier(primary), label: count > 1 ? `${group.label} · part ${index + 1} of ${count}` : group.label,
        paths: primary, sharedPaths: related.slice(0, MAX_SHARED_FILES), kind: hasCodeEdge ? 'flow' : 'group',
        section: count > 1 ? { index: index + 1, count } : null,
        reason: (hasCodeEdge ? group.reason : metadata.evidence) + (count > 1 ? ' Split into at most 12 primary files per group; cross-group links remain visible.' : '') +
          (related.length > MAX_SHARED_FILES ? ' Up to 6 shared files are included; other shared dependencies remain in their own groups and boundary links.' : '') });
    }
  }
  // Start with connected changes; configuration and documentation remain
  // explicit scopes after the business flows instead of obscuring them.
  return output.sort((a, b) => Number(b.kind === 'flow') - Number(a.kind === 'flow') || compare(a.paths[0], b.paths[0]));
}

export function scopeReviewGraph(graph = {}, flow) {
  if (flow?.api) return { ...graph, ...flow.graph, transactions: graph.transactions,
    boundaryDependencies: [], boundarySequence: [] };
  if (!flow) return { ...graph, nodes: graph.nodes || [], dependencies: graph.dependencies || [], sequence: graph.sequence || [], boundaryDependencies: [], boundarySequence: [] };
  const paths = new Set([...(flow.paths || []), ...(flow.sharedPaths || [])]);
  const nodes = (graph.nodes || []).filter(node => paths.has(node.path || node.id));
  const ids = new Set([...paths, ...nodes.map(node => node.id)]);
  const inside = edge => ids.has(edge.from) && ids.has(edge.to);
  const boundary = edge => ids.has(edge.from) !== ids.has(edge.to);
  return { ...graph, nodes,
    dependencies: (graph.dependencies || []).filter(inside), sequence: (graph.sequence || []).filter(inside),
    boundaryDependencies: (graph.dependencies || []).filter(boundary), boundarySequence: (graph.sequence || []).filter(boundary) };
}
