// Architectural roles are navigation hints, not proof of execution order.
// Source annotations outrank path/name conventions; unknown roles stay explicit.
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const REVIEW_ROLES = [
  { id: 'ui', label: 'UI / Presentation' },
  { id: 'controller', label: 'Controller / Request entry' },
  { id: 'consumer', label: 'Consumer / Message entry' },
  { id: 'job', label: 'Job / Scheduled entry' },
  { id: 'service', label: 'Service / Application' },
  { id: 'domainservice', label: 'Domain Service / Business rules' },
  { id: 'domain', label: 'Domain / Business objects' },
  { id: 'core', label: 'Core / Shared business logic' },
  { id: 'port', label: 'Port / Boundary contracts', data: true },
  { id: 'adapter', label: 'Adapter / External systems' },
  { id: 'persistenceadapter', label: 'Persistence Adapter / Storage' },
  { id: 'repository', label: 'Repository / Data access' },
  { id: 'producer', label: 'Producer / Message dispatch' },
  { id: 'integration', label: 'Integration / External clients' },
  { id: 'dto', label: 'DTO / Transfer contracts', data: true },
  { id: 'entity', label: 'Entity / Stored objects', data: true },
  { id: 'model', label: 'Model / Data structures', data: true },
  { id: 'mapper', label: 'Mapper / Data conversion', data: true },
  { id: 'shared', label: 'Shared / Utilities' },
  { id: 'tests', label: 'Tests' }, { id: 'docs', label: 'Documentation' },
  { id: 'config', label: 'Configuration' }, { id: 'other', label: 'Other / Unclassified' },
];
const shortLabels = { ui: 'UI', controller: 'Controller', consumer: 'Consumer', job: 'Job', service: 'Service', domainservice: 'Domain Service', domain: 'Domain', core: 'Core', port: 'Port', adapter: 'Adapter', persistenceadapter: 'Persistence Adapter', repository: 'Repository', producer: 'Producer', model: 'Model', dto: 'DTO', entity: 'Entity', mapper: 'Mapper', integration: 'Integration', shared: 'Shared', tests: 'Tests', docs: 'Docs', config: 'Config', other: 'Other' };
const basename = path => path.split('/').at(-1);
// Specific conventions must precede generic Service/Adapter names. Both common
// spellings (Adapter/Adaptor) and camel/dotted/dashed filenames are supported.
const nameRole = [
  ['persistenceadapter', /(?:Persistence|Persistent|Jpa|Database|Storage)(?:Adapter|Adaptor)$|[._-](?:persistence|persistent|jpa|database|storage)[._-]adapt[eo]r$/i],
  ['domainservice', /DomainService$|[._-]domain[._-]service$/i],
  ['consumer', /(?:Consumer|Listener|Subscriber|[._-](?:consumer|listener|subscriber))$/i],
  ['job', /(?:Job|Scheduler|Tasklet|Batch|Worker|[._-](?:job|scheduler|tasklet|batch|worker))$/i],
  ['controller', /(?:Controller|Route|Router|Handler|[._-](?:controller|route|router|handler))$/],
  ['producer', /(?:Producer|Publisher|EventBus|Queue|[._-](?:producer|publisher|queue))$/i],
  ['port', /(?:Port|[._-]port)$/i],
  ['adapter', /(?:Adapter|Adaptor|[._-](?:adapter|adaptor))$/i],
  ['dto', /(?:DTO|Dto|Request|Response|Command|Query|Event|[._-](?:dto|request|response|command|query|event))$/],
  ['entity', /(?:Entity|[._-]entity)$/i],
  ['mapper', /(?:Mapper|Converter|[._-](?:mapper|converter))$/i],
  ['repository', /(?:Repository|Repo|DAO|Dao|[._-](?:repository|repo|dao))$/],
  ['service', /(?:Service|UseCase|Interactor|[._-](?:service|use-?case|interactor))$/],
  ['model', /(?:Model|Schema|[._-](?:model|schema))$/],
  ['integration', /(?:Client|Gateway|[._-](?:client|gateway))$/],
];
const pathRole = [
  ['persistenceadapter', /(?:^|\/)(?:adapters?|adaptors?)(?:\/[^/]+)*\/(?:persistence|persistent|out\/persistence|storage)(?:\/|$)|(?:^|\/)(?:persistence|persistent)[._-]adapt[eo]rs?(?:\/|$)/i],
  ['domainservice', /(?:^|\/)(?:domains?)(?:\/[^/]+)*\/(?:services?)(?:\/|$)/i],
  ['consumer', /(?:^|\/)(?:consumers?|listeners?|subscribers?)(?:\/|$)/i],
  ['job', /(?:^|\/)(?:jobs?|schedulers?|batch|workers?)(?:\/|$)/i],
  ['controller', /(?:^|\/)(?:controllers?|routes?|handlers?)(?:\/|$)/i],
  ['port', /(?:^|\/)(?:ports?)(?:\/|$)/i],
  ['adapter', /(?:^|\/)(?:adapters?|adaptors?)(?:\/|$)/i],
  ['dto', /(?:^|\/)(?:dtos?|requests?|responses?|commands?|events?|contracts?)(?:\/|$)/i],
  ['entity', /(?:^|\/)(?:entities|entity)(?:\/|$)/i],
  ['mapper', /(?:^|\/)(?:mappers?|converters?)(?:\/|$)/i],
  ['repository', /(?:^|\/)(?:repositories|repository|repos?|dao|persistence)(?:\/|$)/i],
  ['service', /(?:^|\/)(?:services?|use-?cases?|application)(?:\/|$)/i],
  ['model', /(?:^|\/)(?:models?|schemas?)(?:\/|$)/i],
  ['domain', /(?:^|\/)(?:domains?)(?:\/|$)/i],
  ['core', /(?:^|\/)(?:core)(?:\/|$)/i],
  ['ui', /(?:^|\/)(?:components?|views?|pages?|screens?)(?:\/|$)/i],
  ['producer', /(?:^|\/)(?:producers?|publishers?)(?:\/|$)/i],
  ['integration', /(?:^|\/)(?:clients?|gateways?|integrations?)(?:\/|$)/i],
  ['shared', /(?:^|\/)(?:shared|common|utils?|helpers?)(?:\/|$)/i],
];
export function classifyReviewFile(file = {}) {
  const path = file.path || file.new_path || file.old_path || '';
  const stem = basename(path).replace(/\.[^.]+$/, '');
  const result = (role, confidence, evidence, endpoint) => ({ role, roleLabel: shortLabels[role], confidence, evidence, ...(endpoint ? { endpoint } : {}) });
  if (/(?:^|\/)(?:tests?|__tests__|specs?|e2e|fixtures)(?:\/|$)|(?:[._-](?:test|spec)|Tests?|Spec)\.(?:[cm]?[jt]sx?|java|kt|py|go|rb|rs|c|cpp|cs)$/i.test(path)) return result('tests', 'path', [{ kind: 'path', detail: 'Test filename or directory' }]);
  if (/(?:^|\/)(?:docs?|documentation)(?:\/|$)|\.(?:md|mdx|rst|adoc)$/i.test(path)) return result('docs', 'path', [{ kind: 'path', detail: 'Documentation file' }]);
  if (/(?:^|\/)(?:\.github|\.gitlab|config|configuration)(?:\/|$)|\.(?:json|ya?ml|toml|ini|conf|lock)$|(?:^|\/)(?:Dockerfile|Makefile|\.env[^/]*)$/i.test(path)) return result('config', 'path', [{ kind: 'path', detail: 'Configuration file' }]);
  // Removed rows and comment-only declarations cannot assign the current role.
  const rows = file.content !== undefined ? String(file.content).split('\n').map((text, index) => ({ text, newLine: index + 1 }))
    : (file.rows || []).filter(row => row.kind !== 'removed' && row.kind !== 'hunk');
  let inComment = false;
  const source = rows.map(row => {
    let text = String(row.text || '');
    if (inComment) { const end = text.indexOf('*/'); if (end < 0) return { ...row, text: '' }; text = text.slice(end + 2); inComment = false; }
    text = text.replace(/\/\*.*?\*\//g, '');
    const opening = text.indexOf('/*'); if (opening >= 0) { text = text.slice(0, opening); inComment = true; }
    return { ...row, text: text.replace(/\/\/.*$/, '') };
  });
  const mybatis = source.some(row => /^\s*import\s+org\.apache\.ibatis\.annotations\.Mapper\s*;?/.test(row.text));
  const annotations = [
    ['controller', /@(?:RestController|Controller)\b/],
    ['service', /@Service\b/],
    ['repository', mybatis ? /@(?:Repository|Mapper)\b|\bextends\s+(?:JpaRepository|CrudRepository|PagingAndSortingRepository)\s*</ : /@Repository\b|\bextends\s+(?:JpaRepository|CrudRepository|PagingAndSortingRepository)\s*</],
    ['entity', /@(?:Entity|Table)\b/],
  ];
  const roleEvidence = annotations.flatMap(([role, pattern]) => source.filter(row => /^\s*(?:@|(?:public\s+)?(?:interface|class)\s)/.test(row.text) && pattern.test(row.text))
    .map(row => ({ role, kind: 'code', detail: row.text.trim().slice(0, 120), line: row.newLine })));
  const roles = new Set(roleEvidence.map(item => item.role));
  if (roles.size > 1) return result('other', 'ambiguous', roleEvidence.map(({ role, ...item }) => ({ ...item, detail: `${shortLabels[role]}: ${item.detail}` })));
  if (roles.size === 1) {
    let role = [...roles][0];
    const specific = pathRole.slice(0, 2).find(([, pattern]) => pattern.test(path)) || nameRole.find(([, pattern]) => pattern.test(stem)) || pathRole.find(([, pattern]) => pattern.test(path));
    if (role === 'service' && ['domainservice', 'persistenceadapter', 'adapter', 'job', 'consumer', 'producer'].includes(specific?.[0]) || role === 'repository' && specific?.[0] === 'persistenceadapter') role = specific[0];
    const route = source.find(row => /^\s*@(?:RequestMapping|GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|Controller)\s*\(/.test(row.text));
    const value = route?.text.match(/["']([^"']+)["']/)?.[1];
    const verb = route?.text.match(/@(Get|Post|Put|Patch|Delete)Mapping/)?.[1]?.toUpperCase();
    return result(role, 'code', roleEvidence.map(({ role, ...item }) => item), value ? { path: value, method: verb || null, line: route.newLine } : undefined);
  }
  const specialized = pathRole.slice(0, 2).find(([, pattern]) => pattern.test(path));
  if (specialized) return result(specialized[0], 'path', [{ kind: 'path', detail: `${path} architecture directory convention` }]);
  const naming = nameRole.find(([, pattern]) => pattern.test(stem));
  if (naming) return result(naming[0], 'name', [{ kind: 'name', detail: `${stem} naming convention` }]);
  const directory = pathRole.find(([, pattern]) => pattern.test(path));
  if (directory) return result(directory[0], 'path', [{ kind: 'path', detail: `${path.split('/').slice(0, -1).join('/')} directory convention` }]);
  if (/\.(?:jsx|tsx|vue|svelte)$/.test(path)) return result('ui', 'extension', [{ kind: 'extension', detail: 'UI source extension' }]);
  return result('other', 'unknown', [{ kind: 'unknown', detail: file.deferred ? 'Source not loaded; no role convention in path' : 'No recognized annotation, filename or directory convention' }]);
}
export function annotateReviewGraph(graph = {}, files = []) {
  const byPath = new Map(files.map(file => [file.path || file.new_path || file.old_path, file]));
  return { ...graph, nodes: (graph.nodes || []).map(node => ({ ...node, ...classifyReviewFile(byPath.get(node.path || node.id) || { path: node.path || node.id }) })) };
}
export function architectureLayout(graph = {}, { columns = 1 } = {}) {
  const nodes = graph.nodes || [];
  if (!nodes.some(node => node.role && node.role !== 'other')) return null;
  const callOrder = new Map();
  if (nodes.some(node => node.methods?.length)) for (const step of graph.sequence || []) for (const id of [step.from, step.to]) if (!callOrder.has(id)) callOrder.set(id, callOrder.size);
  const roleGroups = REVIEW_ROLES.map(role => ({ role, nodes: nodes.filter(node => (node.role || 'other') === role.id).sort((a, b) => (callOrder.get(a.id) ?? Infinity) - (callOrder.get(b.id) ?? Infinity) || compare(a.path || a.id, b.path || b.id)) })).filter(group => group.nodes.length);
  const nodeW = 204, nodeH = 64, gap = 40;
  const railGutter = Math.max(0, (graph.dependencies?.length || 0) - 8) * 12;
  const width = Math.max(332, ...roleGroups.map(group => Math.min(columns, group.nodes.length) * (nodeW + gap) + gap)) + railGutter;
  const positions = new Map(), layerOffsets = [], layers = [], layerLabels = [], layerRoles = [];
  const neighbors = new Map(nodes.map(node => [node.id, []]));
  for (const edge of graph.dependencies || []) if (neighbors.has(edge.from) && neighbors.has(edge.to)) neighbors.get(edge.from).push(edge.to);
  const cyclic = id => {
    const pending = [...(neighbors.get(id) || [])], seen = new Set();
    while (pending.length) { const next = pending.pop(); if (next === id) return true; if (seen.has(next)) continue; seen.add(next); pending.push(...(neighbors.get(next) || [])); }
    return false;
  };
  let offset = 0;
  roleGroups.forEach(({ role, nodes: layer }, index) => {
    layerOffsets.push(offset); layers.push(layer); layerLabels.push(role.label); layerRoles.push(role.id);
    layer.forEach((node, column) => {
      const row = Math.floor(column / columns), rowCount = Math.min(columns, layer.length - row * columns);
      positions.set(node.id, { x: (width - (rowCount * (nodeW + gap) - gap)) / 2 + (column % columns) * (nodeW + gap), y: 48 + offset + row * 112, layer: index, cyclic: cyclic(node.id) });
    });
    offset += Math.ceil(layer.length / columns) * (layer.length > columns ? 112 : 88) + 32;
  });
  return { positions, layers, layerOffsets, layerLabels, layerRoles, nodeW, nodeH, width, height: Math.max(200, offset + 12), semantic: true };
}
export function reviewFlowMetadata(paths, files, graph, fallbackLabel = 'Changed files') {
  const byPath = new Map(files.map(file => [file.path || file.new_path || file.old_path, file]));
  const classified = paths.map(path => ({ path, ...classifyReviewFile(byPath.get(path) || { path }) }));
  const order = new Map(REVIEW_ROLES.map((role, index) => [role.id, index]));
  const ranked = [...classified].sort((a, b) => (order.get(a.role) - order.get(b.role)) || compare(a.path, b.path));
  const substantive = ranked.filter(file => !['tests', 'docs', 'config', 'shared', 'other'].includes(file.role));
  const entry = substantive[0] || ranked[0];
  const entryName = basename(entry.path).replace(/\.[^.]+$/, '');
  const human = value => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^\w/, character => character.toUpperCase());
  const entryTopic = entryName.replace(/(?:Controller|Service|Repository|Repo|DAO|Dao|Mapper|UseCase|Interactor|Route|Router|Handler|Entity|DTO|Dto|Model|Schema|Client|Gateway|Worker|Consumer|Producer|Queue|[._-](?:controller|service|repository|repo|dao|mapper|use-?case|interactor|route|router|handler|entity|dto|model|schema|client|gateway|worker|consumer|producer|queue))$/, '');
  const topic = human(/^(?:index|api|main|entry|handler|controller)$/i.test(entryTopic) ? fallbackLabel.replace(/ · part.*$/, '') : entryTopic || fallbackLabel);
  const rolePath = REVIEW_ROLES.filter(role => classified.some(file => file.role === role.id)).map(role => shortLabels[role.id]);
  const internal = (graph.dependencies || []).filter(edge => edge.evidence === 'code' && paths.includes(edge.from) && paths.includes(edge.to));
  const roleSet = new Set(classified.map(file => file.role));
  const known = substantive.length;
  let title;
  if (roleSet.has('controller')) title = `${topic} request handling`;
  else if (roleSet.has('ui')) title = `${topic} interface`;
  else if (roleSet.has('service')) title = `${topic} business logic`;
  else if (roleSet.has('repository')) title = `${topic} data access`;
  else if (roleSet.has('integration')) title = `${topic} integration`;
  else title = /^(?:Changed files|Other source files|Supporting files|Tests|Documentation|Configuration|Shared code)$/.test(fallbackLabel) ? fallbackLabel : `${human(fallbackLabel.replace(/ · part.*$/, ''))} changes`;
  const primaryExamples = (known ? substantive : ranked).slice(0, 3).map(file => basename(file.path));
  const subtitle = `${primaryExamples.join(' · ')}${(known ? substantive : ranked).length > 3 ? ` +${(known ? substantive : ranked).length - 3} more` : ''}`;
  const confidence = internal.length ? 'imports' : classified.some(file => file.confidence === 'code') ? 'code' : known ? 'convention' : 'directory';
  const evidence = internal.length ? `${internal.length} verified import${internal.length === 1 ? '' : 's'}; roles from code or naming conventions`
    : known ? 'Grouped by file area and role conventions; execution order is unverified' : 'Directory-based review group; no execution flow established';
  return { title, subtitle, rolePath, entrypoint: { path: entry.path, label: entryName, role: entry.role, ...(entry.endpoint ? { endpoint: entry.endpoint } : {}) }, confidence, evidence };
}
