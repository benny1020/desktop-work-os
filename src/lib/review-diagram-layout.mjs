// Presentation geometry only: source graph edges and code positions stay intact.
const same = (a, b) => a.x === b.x && a.y === b.y;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const between = (v, a, b) => v > Math.min(a, b) && v < Math.max(a, b);
// Label budget includes Korean/CJK width. Full values stay in titles and names.
export function fitDiagramText(value, width, fontSize = 12, mono = false) {
  const characters = [...String(value)];
  const advance = char => /\p{Mark}/u.test(char) ? 0 : /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7ff\uff01-\uff60\uffe0-\uffe6]/u.test(char) || char.codePointAt(0) >= 0x1f300 ? fontSize : fontSize * (mono ? .62 : .6);
  if (characters.reduce((sum, char) => sum + advance(char), 0) <= width) return value;
  let used = fontSize, result = '';
  for (const char of characters) { if (used + advance(char) > width) break; result += char; used += advance(char); }
  return result + '…';
}
export function crossesBox(a, b, box, padding = 0) {
  const left = box.x - padding, right = box.x + box.w + padding;
  const top = box.y - padding, bottom = box.y + box.h + padding;
  return a.x === b.x ? between(a.x, left, right) && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom
    : between(a.y, top, bottom) && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
}
function simplify(points) {
  const result = [];
  for (const point of points) {
    if (result.length && same(result.at(-1), point)) continue;
    while (result.length > 1 && ((result.at(-2).x === result.at(-1).x && result.at(-1).x === point.x) ||
      (result.at(-2).y === result.at(-1).y && result.at(-1).y === point.y))) result.pop();
    result.push(point);
  }
  return result;
}
export function roundedRail(points, previousSegments = []) {
  if (!points.length) return '';
  const corners = points.map((point, i) => {
    if (!i || i === points.length - 1) return { enter: point, leave: point };
    const a = points[i - 1], c = points[i + 1];
    const radius = Math.min(8, distance(a, point) / 2, distance(point, c) / 2);
    return { enter: { x: point.x + Math.sign(a.x - point.x) * radius, y: point.y + Math.sign(a.y - point.y) * radius },
      leave: { x: point.x + Math.sign(c.x - point.x) * radius, y: point.y + Math.sign(c.y - point.y) * radius } };
  });
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = corners[i].leave, b = corners[i + 1].enter, vertical = a.x === b.x;
    const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
    const crossings = previousSegments.flatMap(([p, q]) => {
      if (vertical === (p.x === q.x)) return [];
      const cross = vertical ? { x: a.x, y: p.y } : { x: p.x, y: a.y };
      if ((vertical ? !between(cross.y, a.y, b.y) || !between(cross.x, p.x, q.x) : !between(cross.x, a.x, b.x) || !between(cross.y, p.y, q.y)) ||
        Math.min(distance(cross, a), distance(cross, b)) < 8 || Math.min(distance(cross, p), distance(cross, q)) < 10) return [];
      return [cross];
    }).sort((p, q) => distance(a, p) - distance(a, q));
    let last = a;
    for (const cross of crossings) {
      if (distance(last, cross) < 12) continue;
      path += ` L ${cross.x - dx * 4} ${cross.y - dy * 4} a 4 4 0 0 ${vertical ? dy > 0 ? 0 : 1 : dx > 0 ? 1 : 0} ${dx * 8} ${dy * 8}`;
      last = { x: cross.x + dx * 4, y: cross.y + dy * 4 };
    }
    path += ` L ${b.x} ${b.y}`;
    if (i < points.length - 2) path += ` Q ${points[i + 1].x} ${points[i + 1].y} ${corners[i + 1].leave.x} ${corners[i + 1].leave.y}`;
  }
  return path;
}
// Small binary heap keeps route search bounded even on a large review scope.
class Queue {
  items = [];
  push(value) {
    let i = this.items.push(value) - 1;
    while (i && this.items[(i - 1) >> 1].score > value.score) { this.items[i] = this.items[(i - 1) >> 1]; i = (i - 1) >> 1; }
    this.items[i] = value;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].score < this.items[child].score) child++;
        if (this.items[child].score >= last.score) break;
        this.items[i] = this.items[child]; i = child;
      }
      this.items[i] = last;
    }
    return first;
  }
}
function route(start, end, boxes, width, height, segments, reserved = []) {
  const sorted = values => [...new Set(values)].sort((a, b) => a - b);
  const xs = sorted([...Array.from({ length: Math.floor(width / 12) }, (_, i) => 4 + i * 12), 4, width - 4, start.x, end.x, ...boxes.flatMap(box => [box.x - 12, box.x + box.w + 12]), ...segments.flatMap(([a, b]) => a.x === b.x ? [a.x - 12, a.x + 12] : [])].filter(x => x >= 4 && x <= width - 4));
  const ys = sorted([...Array.from({ length: Math.floor(height / 12) }, (_, i) => 4 + i * 12), 4, height - 4, start.y, end.y, ...boxes.flatMap(box => [box.y - 12, box.y + box.h + 12]), ...segments.flatMap(([a, b]) => a.y === b.y ? [a.y - 12, a.y + 12] : [])].filter(y => y >= 4 && y <= height - 4));
  const occupied = [...segments, ...reserved];
  const queue = new Queue(), costs = new Map(), previous = new Map(), positions = new Map();
  const initial = { ix: xs.indexOf(start.x), iy: ys.indexOf(start.y), dir: 0, cost: 0, score: distance(start, end) };
  const key = state => `${state.ix}:${state.iy}:${state.dir}`;
  queue.push(initial); costs.set(key(initial), 0);
  let budget = 80000;
  while (queue.items.length && budget--) {
    const current = queue.pop(), currentKey = key(current);
    if (current.cost !== costs.get(currentKey)) continue;
    const a = { x: xs[current.ix], y: ys[current.iy] }; positions.set(currentKey, a);
    if (same(a, end)) {
      const points = [a]; let cursor = currentKey;
      while (previous.has(cursor)) { cursor = previous.get(cursor); points.unshift(positions.get(cursor)); }
      return simplify(points);
    }
    for (const [dx, dy, dir] of [[-1, 0, 1], [1, 0, 1], [0, -1, 2], [0, 1, 2]]) {
      const ix = current.ix + dx, iy = current.iy + dy;
      if (ix < 0 || iy < 0 || ix >= xs.length || iy >= ys.length) continue;
      const b = { x: xs[ix], y: ys[iy] };
      if (boxes.some(box => crossesBox(a, b, box, box.padding ?? 8))) continue;
      // Reserve every endpoint approach, including connectors not routed yet.
      // Sharing a trunk is forbidden; allocate another lane rather than add ink.
      const overlap = occupied.some(([p, q]) => a.x === b.x && p.x === q.x && a.x === p.x && Math.min(Math.max(a.y, b.y), Math.max(p.y, q.y)) > Math.max(Math.min(a.y, b.y), Math.min(p.y, q.y)) ||
        a.y === b.y && p.y === q.y && a.y === p.y && Math.min(Math.max(a.x, b.x), Math.max(p.x, q.x)) > Math.max(Math.min(a.x, b.x), Math.min(p.x, q.x)));
      if (overlap) continue;
      const cost = current.cost + distance(a, b) + (current.dir && current.dir !== dir ? 16 : 0);
      const next = { ix, iy, dir, cost, score: cost + distance(b, end) }, nextKey = key(next);
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue;
      costs.set(nextKey, cost); previous.set(nextKey, currentKey); queue.push(next);
    }
  }
  return null;
}
// Calls and structural contracts are different reading tasks. Keep the source
// graph intact; this is a reversible presentation filter, never a topology edit.
export function dependencyView(graph, { includeTypes = false, selected } = {}) {
  const nodes = graph.nodes.filter(node => includeTypes || !node.dataContract || node.id === selected);
  const ids = new Set(nodes.map(node => node.id));
  return { ...graph, nodes, dependencies: graph.dependencies.filter(edge =>
    (includeTypes || edge.evidence !== 'type') && ids.has(edge.from) && ids.has(edge.to)) };
}
export function dependencyRoutes(graph, layout) {
  const { positions, nodeW, nodeH, width, height } = layout;
  const boxes = [...positions].map(([id, point]) => ({ id, ...point, w: nodeW, h: nodeH }));
  // Layer captions are obstacles too: a rail must never run through its text.
  (layout.layerOffsets || []).forEach((offset, index) => boxes.push({ x: 18, y: offset + 13,
    w: Math.min(width - 48, ((layout.layerRoles?.[index] === 'other' ? layout.layerLabels?.[index] : layout.layerLabels?.[index]?.split(' / ')[0]) || 'Dependency layer').length * 6 + 8), h: 16, padding: 4 }));
  const endpoints = new Map(), specs = [];
  const attach = (id, side, edgeIndex, end) => {
    const k = `${id}:${side}`, group = endpoints.get(k) || [];
    const spec = { id, side, edgeIndex, end }; group.push(spec); endpoints.set(k, group); return spec;
  };
  (graph.dependencies || []).forEach((edge, index) => {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    if (!a || !b) return;
    const horizontal = Math.abs(a.y - b.y) < nodeH / 2;
    const sides = edge.from === edge.to ? ['right', 'right'] : horizontal ? a.x < b.x ? ['right', 'left'] : ['left', 'right']
      : a.y < b.y ? ['bottom', 'top'] : ['top', 'bottom'];
    specs.push({ edge, index, source: attach(edge.from, sides[0], index, false), target: attach(edge.to, sides[1], index, true) });
  });
  for (const group of endpoints.values()) group.forEach((spec, index) => {
    const box = positions.get(spec.id), horizontalSide = ['top', 'bottom'].includes(spec.side);
    const span = horizontalSide ? nodeW : nodeH, offset = 12 + (span - 24) * (index + 1) / (group.length + 1);
    spec.port = horizontalSide ? { x: box.x + offset, y: box.y + (spec.side === 'bottom' ? nodeH : 0) }
      : { x: box.x + (spec.side === 'right' ? nodeW : 0), y: box.y + offset };
    spec.stub = { x: spec.port.x + (spec.side === 'right' ? 12 : spec.side === 'left' ? -12 : 0),
      y: spec.port.y + (spec.side === 'bottom' ? 12 : spec.side === 'top' ? -12 : 0) };
  });
  const segments = [];
  return [...specs].sort((a, b) => (a.edge.evidence === 'type') - (b.edge.evidence === 'type') ||
    distance(a.source.port, a.target.port) - distance(b.source.port, b.target.port) || a.index - b.index).map(spec => {
    const reserved = specs.filter(other => other !== spec).flatMap(other => [[other.source.port, other.source.stub], [other.target.port, other.target.stub]]);
    const middle = route(spec.source.stub, spec.target.stub, boxes, width, height, segments, reserved);
    const points = middle ? simplify([spec.source.port, ...middle, spec.target.port]) : [];
    const d = roundedRail(points, segments);
    for (let i = 1; i < points.length; i++) segments.push([points[i - 1], points[i]]);
    return { ...spec, points, d, unavailable: !middle };
  }).sort((a, b) => a.index - b.index);
}

export function sequenceMessage(step, number, maxCharacters = 44) {
  const sourceCall = step.label?.match(/\b(?:this\.)?[\w$]+\.\s*([\w$]+)\s*\(/)?.[1];
  const label = step.toMethod ? step.toMethod.split('#').at(-1).replace(/:\d+$/, '').split('.').at(-1) + '()' : sourceCall ? sourceCall + '()' : step.label;
  const text = `${number}. ${label}`;
  const clipped = text.length > maxCharacters ? text.slice(0, maxCharacters - 1) + '…' : text;
  return { label: clipped, evidence: step.evidence === 'code' ? 'source call' : 'inferred',
    kind: step.deferred ? 'deferred' : step.evidence === 'code' ? 'resolved' : 'inferred' };
}
