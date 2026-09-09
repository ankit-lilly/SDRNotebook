import { forceCenter, forceCollide, forceLink, forceManyBody } from "d3-force";
import { scaleOrdinal } from "d3-scale";
import type {
  Edge,
  GraphData,
  GraphPath,
  GraphRendererOptions,
  RichDisplay,
  Vertex,
} from "./types.ts";
import { DISPLAY_SYMBOL } from "./types.ts";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DEFAULT_LABEL_PROP = "name";
const DEFAULT_COLORS = [
  "#4A90D9",
  "#50C878",
  "#F5A623",
  "#D0021B",
  "#9013FE",
  "#417505",
  "#BD10E0",
  "#7ED321",
  "#4A4A4A",
  "#B8E986",
];

interface SimNode {
  id: string;
  label: string;
  displayName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  label: string;
}

// ── Data extraction ──

export function extractGraphData(
  pathResult: Array<{ objects: Array<Record<string, unknown>> }>,
): GraphData {
  const vertexMap = new Map<string, Vertex>();
  const edgeMap = new Map<string, Edge>();

  for (const path of pathResult) {
    for (const obj of path.objects) {
      const id = String(obj.id);
      if (obj.type === "edge" || ("inV" in obj && "outV" in obj)) {
        if (!edgeMap.has(id)) {
          edgeMap.set(id, {
            id,
            label: String(obj.label ?? ""),
            inV: String(obj.inV),
            outV: String(obj.outV),
            properties: (obj.properties as Record<string, unknown>) ?? {},
          });
        }
      } else {
        if (!vertexMap.has(id)) {
          vertexMap.set(id, {
            id,
            label: String(obj.label ?? ""),
            properties: (obj.properties as Record<string, unknown>) ?? {},
          });
        }
      }
    }
  }

  return {
    vertices: Array.from(vertexMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

// ── Helpers ──

function getPropertyValue(vertex: Vertex, prop: string): string {
  const props = vertex.properties;
  if (!props) return vertex.id;
  const propValue = props[prop];
  if (Array.isArray(propValue) && propValue.length > 0) {
    const first = propValue[0];
    if (typeof first === "object" && first !== null && "value" in first) {
      return String((first as { value: unknown }).value);
    }
    return String(first);
  }
  if (propValue !== undefined && propValue !== null) {
    return String(propValue);
  }
  return vertex.id;
}

function getNodeDisplayText(
  vertex: Vertex,
  mode: "property" | "label" | "id",
  labelProp: string,
): string {
  switch (mode) {
    case "label":
      return vertex.label;
    case "id":
      return vertex.id;
    case "property":
    default:
      return getPropertyValue(vertex, labelProp);
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Tree layout ──

function layoutTree(
  nodes: SimNode[],
  links: SimLink[],
  opts: { levelSpacing: number; siblingSpacing: number },
): void {
  const nodeMap = new Map<string, SimNode>();
  for (const node of nodes) nodeMap.set(node.id, node);

  // Build adjacency: parent → children (following edge direction)
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const link of links) {
    const sourceId = typeof link.source === "string"
      ? link.source
      : link.source.id;
    const targetId = typeof link.target === "string"
      ? link.target
      : link.target.id;
    if (!children.has(sourceId)) children.set(sourceId, []);
    children.get(sourceId)!.push(targetId);
    hasParent.add(targetId);
  }

  // Roots = nodes with no incoming edges
  const roots = nodes.filter((n) => !hasParent.has(n.id));
  if (roots.length === 0 && nodes.length > 0) {
    // Fallback: pick first node as root (graph may be cyclic)
    roots.push(nodes[0]!);
  }

  // BFS to assign levels
  const level = new Map<string, number>();
  const queue: string[] = [];
  for (const root of roots) {
    level.set(root.id, 0);
    queue.push(root.id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = level.get(current) ?? 0;
    for (const childId of children.get(current) ?? []) {
      if (!level.has(childId)) {
        level.set(childId, currentLevel + 1);
        queue.push(childId);
      }
    }
  }

  // Assign level 0 to any unvisited nodes (disconnected)
  for (const node of nodes) {
    if (!level.has(node.id)) level.set(node.id, 0);
  }

  // Group nodes by level
  const levels = new Map<number, SimNode[]>();
  for (const node of nodes) {
    const l = level.get(node.id) ?? 0;
    if (!levels.has(l)) levels.set(l, []);
    levels.get(l)!.push(node);
  }

  // Position nodes
  const sortedLevels = [...levels.keys()].sort((a, b) => a - b);
  for (const l of sortedLevels) {
    const nodesAtLevel = levels.get(l)!;
    const totalWidth = (nodesAtLevel.length - 1) * opts.siblingSpacing;
    const startX = -totalWidth / 2;
    for (let i = 0; i < nodesAtLevel.length; i++) {
      const node = nodesAtLevel[i]!;
      node.x = startX + i * opts.siblingSpacing;
      node.y = l * opts.levelSpacing;
    }
  }
}

// ── Force layout ──

function layoutForce(
  nodes: SimNode[],
  links: SimLink[],
  opts: {
    width: number;
    height: number;
    linkDist: number;
    charge: number;
    nodeRadius: number;
  },
): void {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    nodes[i]!.x = opts.width / 2 +
      (Math.min(opts.width, opts.height) / 3) * Math.cos(angle);
    nodes[i]!.y = opts.height / 2 +
      (Math.min(opts.width, opts.height) / 3) * Math.sin(angle);
    nodes[i]!.vx = 0;
    nodes[i]!.vy = 0;
  }

  // deno-lint-ignore no-explicit-any
  const linkForce = forceLink(links as any).id((d: any) => d.id).distance(
    opts.linkDist,
  );
  // deno-lint-ignore no-explicit-any
  linkForce.initialize(nodes as any, () => Math.random());

  // deno-lint-ignore no-explicit-any
  const chargeForce = forceManyBody<any>().strength(opts.charge);
  // deno-lint-ignore no-explicit-any
  chargeForce.initialize(nodes as any, () => Math.random());

  // deno-lint-ignore no-explicit-any
  const centerForce = forceCenter<any>(opts.width / 2, opts.height / 2);
  // deno-lint-ignore no-explicit-any
  centerForce.initialize(nodes as any, () => Math.random());

  // deno-lint-ignore no-explicit-any
  const collideForce = forceCollide<any>(opts.nodeRadius * 2.5);
  // deno-lint-ignore no-explicit-any
  collideForce.initialize(nodes as any, () => Math.random());

  const alphaMin = 0.001;
  const alphaDecay = 1 - Math.pow(alphaMin, 1 / 300);
  const velocityDecay = 0.6;
  let alpha = 1;

  for (let tick = 0; tick < 300; tick++) {
    alpha += (0 - alpha) * alphaDecay;
    // deno-lint-ignore no-explicit-any
    linkForce(alpha as any);
    // deno-lint-ignore no-explicit-any
    chargeForce(alpha as any);
    // deno-lint-ignore no-explicit-any
    centerForce(alpha as any);
    // deno-lint-ignore no-explicit-any
    collideForce(alpha as any);
    for (let i = 0; i < n; i++) {
      const node = nodes[i]!;
      node.x += node.vx * velocityDecay;
      node.vx *= velocityDecay;
      node.y += node.vy * velocityDecay;
      node.vy *= velocityDecay;
    }
  }
}

// ── SVG rendering ──

export function renderGraphSvg(
  data: GraphData,
  options: GraphRendererOptions = {},
): string {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const labelProp = options.labelProperty ?? DEFAULT_LABEL_PROP;
  const labelMaxChars = options.labelMaxChars ?? 20;
  const nodeRadius = options.nodeRadius ?? 25;
  const nodeFontSize = options.nodeFontSize ?? 9;
  const edgeFontSize = options.edgeFontSize ?? 8;
  const linkDist = options.linkDistance ?? 180;
  const charge = options.chargeStrength ?? -400;
  const showNodeType = options.showNodeType ?? true;
  const showEdgeLabels = options.showEdgeLabels ?? true;
  const nodeDisplayText = options.nodeDisplayText ?? "property";
  const layoutMode = options.layout ?? "force";
  const levelSpacing = options.levelSpacing ?? 120;
  const siblingSpacing = options.siblingSpacing ?? 80;

  if (data.vertices.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="${width / 2}" y="${
      height / 2
    }" text-anchor="middle" fill="#666" font-family="sans-serif">Empty graph</text>
</svg>`;
  }

  const labels = [...new Set(data.vertices.map((v) => v.label))];
  const customColors = options.nodeColors ?? {};
  const colorScale = scaleOrdinal<string>().domain(labels).range(
    DEFAULT_COLORS,
  );

  function getColor(label: string): string {
    return customColors[label] ?? colorScale(label);
  }

  const nodes: SimNode[] = data.vertices.map((v) => ({
    id: v.id,
    label: v.label,
    displayName: getNodeDisplayText(v, nodeDisplayText, labelProp),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: SimLink[] = data.edges
    .filter((e) => nodeIds.has(e.outV) && nodeIds.has(e.inV))
    .map((e) => ({ source: e.outV, target: e.inV, label: e.label }));

  // Run layout
  if (layoutMode === "tree") {
    layoutTree(nodes, links, { levelSpacing, siblingSpacing });
  } else {
    layoutForce(nodes, links, { width, height, linkDist, charge, nodeRadius });
  }

  // Resolve link source/target to SimNode refs (needed after layout)
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  for (const link of links) {
    if (typeof link.source === "string") {
      link.source = nodeById.get(link.source) ?? link.source;
    }
    if (typeof link.target === "string") {
      link.target = nodeById.get(link.target) ?? link.target;
    }
  }

  // Compute bounding box from actual node positions
  const pad = nodeRadius + 40;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.x > maxX) maxX = node.x;
    if (node.y > maxY) maxY = node.y;
  }
  const graphW = maxX - minX + pad * 2;
  const graphH = maxY - minY + pad * 2;

  // Reserve space for the legend to the right of the graph
  const legendW = 180;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = Math.max(graphW, 200) + legendW;
  const vbH = Math.max(graphH, 200);

  // Legend positioned to the right of the graph, never overlapping nodes
  const legendX = minX - pad + Math.max(graphW, 200) + 20;

  // Edge SVG — use curved paths for tree layout to avoid overlaps
  const edgeSvg = links.map((link) => {
    const source = link.source as SimNode;
    const target = link.target as SimNode;

    let pathD: string;
    if (layoutMode === "tree") {
      // Curved path: vertical down from source, then curve to target
      const midY = (source.y + target.y) / 2;
      pathD =
        `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`;
    } else {
      pathD = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
    }

    const mx = (source.x + target.x) / 2;
    const my = (source.y + target.y) / 2;
    const edgeLabelSvg = showEdgeLabels
      ? `\n  <text x="${mx}" y="${
        my - 6
      }" text-anchor="middle" font-size="${edgeFontSize}" fill="#555" font-family="sans-serif">${
        escapeXml(link.label)
      }</text>`
      : "";
    return `  <path d="${pathD}" fill="none" stroke="#999" stroke-opacity="0.5" stroke-width="1" marker-end="url(#arrow)"/>${edgeLabelSvg}`;
  }).join("\n");

  const nodeSvg = nodes.map((node) => {
    const { x, y } = node;
    const color = getColor(node.label);
    const displayText = escapeXml(node.displayName.slice(0, labelMaxChars));
    const typeLine = showNodeType
      ? `\n  <text x="${x}" y="${
        y + nodeFontSize + 4
      }" text-anchor="middle" font-size="${
        nodeFontSize - 1
      }" fill="rgba(255,255,255,0.7)" font-family="sans-serif">${
        escapeXml(node.label)
      }</text>`
      : "";
    return `  <circle cx="${x}" cy="${y}" r="${nodeRadius}" fill="${color}" stroke="#fff" stroke-width="2"/>
  <text x="${x}" y="${
      y - 2
    }" text-anchor="middle" font-size="${nodeFontSize}" fill="#fff" font-weight="bold" font-family="sans-serif">${displayText}</text>${typeLine}`;
  }).join("\n");

  const legendSvg = labels.map((label, i) => {
    const y = vbY + 20 + i * 22;
    return `  <rect x="${legendX}" y="${y}" width="12" height="12" fill="${
      getColor(label)
    }"/>
  <text x="${legendX + 18}" y="${
      y + 11
    }" font-size="11" fill="#333" font-family="sans-serif">${
      escapeXml(label)
    }</text>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="${
    nodeRadius + 8
  }" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#999"/>
    </marker>
  </defs>
  <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#fafafa" rx="4"/>
${edgeSvg}
${nodeSvg}
${legendSvg}
</svg>`;
}

// ── Rich display wrapper ──

function parseInput(dataOrPaths: GraphData | GraphPath[]): GraphData {
  if (
    typeof dataOrPaths === "object" && dataOrPaths !== null &&
    "vertices" in dataOrPaths
  ) {
    return dataOrPaths as GraphData;
  }
  return extractGraphData(dataOrPaths as GraphPath[]);
}

export function renderGraph(
  dataOrPaths: GraphData | GraphPath[],
  options: GraphRendererOptions = {},
): RichDisplay {
  const graphData = parseInput(dataOrPaths);
  const svg = renderGraphSvg(graphData, options);
  return {
    [DISPLAY_SYMBOL]() {
      return {
        "image/svg+xml": svg,
        "text/html": `<div style="overflow:auto;max-width:100%">${svg}</div>`,
        "text/plain":
          `Graph: ${graphData.vertices.length} nodes, ${graphData.edges.length} edges`,
      };
    },
  };
}

// ── File I/O utilities (side-effectful, kept separate from pure rendering) ──

export async function openGraph(
  dataOrPaths: GraphData | GraphPath[],
  options: GraphRendererOptions = {},
  filePath = "/tmp/graph.html",
): Promise<void> {
  const graphData = parseInput(dataOrPaths);
  const svg = renderGraphSvg(graphData, options);
  const responsiveSvg = svg
    .replace(/width="\d+"/, 'width="100%"')
    .replace(/height="\d+"/, 'height="100%"');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Graph — ${graphData.vertices.length} nodes, ${graphData.edges.length} edges</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fafafa; overflow: hidden; }
    svg { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
${responsiveSvg}
</body>
</html>`;
  await Deno.writeTextFile(filePath, html);
  const cmd = new Deno.Command("open", { args: [filePath] });
  await cmd.output();
  console.log(
    `Opened ${filePath} in browser (${graphData.vertices.length} nodes, ${graphData.edges.length} edges)`,
  );
}

export async function saveGraph(
  dataOrPaths: GraphData | GraphPath[],
  filePath: string,
  options: GraphRendererOptions = {},
): Promise<void> {
  const graphData = parseInput(dataOrPaths);
  const svg = renderGraphSvg(graphData, options);
  await Deno.writeTextFile(filePath, svg);
  console.log(
    `Saved to ${filePath} (${graphData.vertices.length} nodes, ${graphData.edges.length} edges)`,
  );
}
