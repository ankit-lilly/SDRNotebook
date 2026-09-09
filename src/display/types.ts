export const DISPLAY_SYMBOL = Symbol.for("Jupyter.display");

export interface Vertex {
  id: string;
  label: string;
  properties?: Record<string, unknown>;
}

export interface Edge {
  id: string;
  label: string;
  inV: string;
  outV: string;
  properties?: Record<string, unknown>;
}

export interface GraphData {
  vertices: Vertex[];
  edges: Edge[];
}

export interface GraphPath {
  objects: Array<Record<string, unknown>>;
}

export interface RichDisplay {
  [key: symbol]: () => Record<string, string | Record<string, unknown>>;
}

export interface GraphRendererOptions {
  width?: number;
  height?: number;
  nodeColors?: Record<string, string>;
  labelProperty?: string;
  labelMaxChars?: number;
  nodeRadius?: number;
  nodeFontSize?: number;
  edgeFontSize?: number;
  linkDistance?: number;
  chargeStrength?: number;
  showNodeType?: boolean;
  showEdgeLabels?: boolean;
  nodeDisplayText?: "property" | "label" | "id";
  layout?: "force" | "tree";
  levelSpacing?: number;
  siblingSpacing?: number;
}
