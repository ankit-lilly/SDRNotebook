import { assertEquals, assertStringIncludes } from "@std/assert";
import { toMimeBundle } from "./ui.tsx";
import { extractGraphData, renderGraph, renderGraphSvg } from "./graph.ts";
import type { Edge, GraphData, Vertex } from "./types.ts";

const sampleVertices: Vertex[] = [
  { id: "v1", label: "Study", properties: { name: "Study-001" } },
  { id: "v2", label: "StudyVersion", properties: { name: "v1.0" } },
  { id: "v3", label: "StudyVersion", properties: { name: "v2.0" } },
];

const sampleEdges: Edge[] = [
  { id: "e1", label: "hasVersion", inV: "v2", outV: "v1" },
  { id: "e2", label: "hasVersion", inV: "v3", outV: "v1" },
];

Deno.test("extractGraphData from path result", () => {
  const pathResult = [
    {
      objects: [
        {
          id: "v1",
          label: "Study",
          type: "vertex",
          properties: { name: [{ value: "Study-001" }] },
        },
        { id: "e1", label: "hasVersion", type: "edge", inV: "v2", outV: "v1" },
        {
          id: "v2",
          label: "StudyVersion",
          type: "vertex",
          properties: { name: [{ value: "v1.0" }] },
        },
      ],
    },
    {
      objects: [
        {
          id: "v1",
          label: "Study",
          type: "vertex",
          properties: { name: [{ value: "Study-001" }] },
        },
        { id: "e2", label: "hasVersion", type: "edge", inV: "v3", outV: "v1" },
        {
          id: "v3",
          label: "StudyVersion",
          type: "vertex",
          properties: { name: [{ value: "v2.0" }] },
        },
      ],
    },
  ];
  const graph = extractGraphData(pathResult);
  assertEquals(graph.vertices.length, 3);
  assertEquals(graph.edges.length, 2);
});

Deno.test("extractGraphData deduplicates vertices by id", () => {
  const pathResult = [
    {
      objects: [
        { id: "v1", label: "Study", type: "vertex" },
        { id: "e1", label: "rel", type: "edge", inV: "v2", outV: "v1" },
        { id: "v2", label: "Other", type: "vertex" },
      ],
    },
    {
      objects: [
        { id: "v1", label: "Study", type: "vertex" },
        { id: "e2", label: "rel", type: "edge", inV: "v3", outV: "v1" },
        { id: "v3", label: "Other", type: "vertex" },
      ],
    },
  ];
  const graph = extractGraphData(pathResult);
  assertEquals(graph.vertices.length, 3);
  assertEquals(graph.edges.length, 2);
});

Deno.test("renderGraphSvg produces valid SVG", () => {
  const data: GraphData = { vertices: sampleVertices, edges: sampleEdges };
  const svg = renderGraphSvg(data);
  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
  assertStringIncludes(svg, "Study-001");
  assertStringIncludes(svg, "hasVersion");
});

Deno.test("renderGraphSvg respects width/height", () => {
  const data: GraphData = { vertices: sampleVertices, edges: sampleEdges };
  const svg = renderGraphSvg(data, { width: 1000, height: 800 });
  assertStringIncludes(svg, 'width="1000"');
  assertStringIncludes(svg, 'height="800"');
});

Deno.test("renderGraphSvg includes color legend", () => {
  const data: GraphData = { vertices: sampleVertices, edges: sampleEdges };
  const svg = renderGraphSvg(data);
  assertStringIncludes(svg, "Study");
  assertStringIncludes(svg, "StudyVersion");
});

Deno.test("renderGraphSvg handles empty graph", () => {
  const data: GraphData = { vertices: [], edges: [] };
  const svg = renderGraphSvg(data);
  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
});

Deno.test("renderGraph returns display object", () => {
  const data: GraphData = { vertices: sampleVertices, edges: sampleEdges };
  const display = renderGraph(data);
  const mimeBundle = toMimeBundle(display);
  assertStringIncludes(String(mimeBundle["image/svg+xml"]), "<svg");
});
