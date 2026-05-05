import { renderGraph } from "./graph-renderer.ts";
import { DISPLAY_SYMBOL } from "./types.ts";
import type { GraphData, GraphPath, GraphRendererOptions, RichDisplay } from "./types.ts";

// ── Internal display primitives ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stringifyPlain(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isRowArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => isRecord(item));
}

function renderCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return escapeHtml(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return escapeHtml(stringifyPlain(value));
}

function mimeBundle(bundle: Record<string, string | Record<string, unknown>>): RichDisplay {
  return {
    [DISPLAY_SYMBOL]() {
      return bundle;
    },
  };
}

export function toMimeBundle(
  display: RichDisplay | { [key: symbol]: unknown },
): Record<string, string | Record<string, unknown>> {
  const fn = display[DISPLAY_SYMBOL];
  if (typeof fn !== "function") {
    throw new Error("Object does not expose a Jupyter display handler.");
  }
  return fn.call(display);
}

// ── Display functions ──

function displayJson(value: unknown): RichDisplay {
  const pretty = escapeHtml(stringifyPlain(value));
  return mimeBundle({
    "text/html": [
      "<div style=\"margin:8px 0;padding:10px 12px;border:1px solid #e7ebf0;border-radius:8px;background:#fcfcfd\">",
      "<div style=\"margin-bottom:6px;font:600 11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280\">JSON</div>",
      `<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#111827">${pretty}</pre>`,
      "</div>",
    ].join(""),
    "application/json": isRecord(value) ? value : { value },
    "text/plain": stringifyPlain(value),
  });
}

function displayHtml(html: string, plainText = "HTML content"): RichDisplay {
  return mimeBundle({
    "text/html": html,
    "text/plain": plainText,
  });
}

function displaySvg(svg: string, plainText: string): RichDisplay {
  return mimeBundle({
    "image/svg+xml": svg,
    "text/plain": plainText,
  });
}

function displayMarkdown(content: string): RichDisplay {
  return mimeBundle({
    "text/markdown": content,
    "text/plain": content,
  });
}

function displayNote(content: string): RichDisplay {
  return displayMarkdown(`> ${content}`);
}

function displayError(message: string, details?: string): RichDisplay {
  const body = details ? `${message}\n\n\`\`\`\n${details}\n\`\`\`` : message;
  return displayMarkdown(`## Error\n\n${body}`);
}

function displayTable(rows: Array<Record<string, unknown>>): RichDisplay {
  if (rows.length === 0) {
    return displayMarkdown("_No rows_");
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const head = columns.map((column) =>
    `<th style="position:sticky;top:0;background:#fafbfc;padding:8px 10px;text-align:left;font:600 11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e7ebf0;white-space:nowrap">${escapeHtml(column)}</th>`
  ).join("");
  const body = rows.map((row, index) => {
    const cells = columns.map((column) =>
      `<td style="padding:8px 10px;vertical-align:top;text-align:left;font:12px/1.45 ui-sans-serif,system-ui,sans-serif;color:#111827;border-bottom:1px solid #eef1f4">${renderCell(row[column])}</td>`
    ).join("");
    return `<tr style="background:${index % 2 === 0 ? "#ffffff" : "#fbfcfd"}">${cells}</tr>`;
  }).join("");

  const tableHtml = [
    "<div style=\"margin:8px auto 8px 0;max-width:100%;width:fit-content;min-width:min(720px,100%);border:1px solid #e7ebf0;border-radius:8px;background:#ffffff;overflow:hidden\">",
    `<div style="padding:8px 10px;border-bottom:1px solid #eef1f4;font:600 11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280;background:#fafbfc">${rows.length} row${rows.length === 1 ? "" : "s"}</div>`,
    "<div style=\"overflow-x:auto\">",
    "<table style=\"border-collapse:separate;border-spacing:0;width:max-content;min-width:100%\">",
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    "</table>",
    "</div>",
    "</div>",
  ].join("");

  const plainText = rows.map((row) => columns.map((column) => `${column}: ${stringifyPlain(row[column])}`).join(" | ")).join("\n");

  return displayHtml(tableHtml, plainText);
}

function defaultDisplay(value: unknown): RichDisplay {
  if (isRowArray(value)) {
    return displayTable(value);
  }
  if (Array.isArray(value) || isRecord(value)) {
    return displayJson(value);
  }
  return mimeBundle({
    "text/plain": stringifyPlain(value),
  });
}

function notebookMarkdown(strings: TemplateStringsArray, ...values: unknown[]): RichDisplay {
  const source = String.raw({ raw: strings }, ...values.map((value) => typeof value === "string" ? value : stringifyPlain(value)));
  return displayMarkdown(source);
}

function notebookHtml(strings: TemplateStringsArray, ...values: unknown[]): RichDisplay {
  const htmlContent = strings.reduce((acc, part, index) => {
    const value = index < values.length ? renderCell(values[index]) : "";
    return `${acc}${part}${value}`;
  }, "");
  return displayHtml(htmlContent, htmlContent.replace(/<[^>]+>/g, " "));
}

// ── Graph type guards ──

function isGraphData(value: unknown): value is GraphData {
  return typeof value === "object" &&
    value !== null &&
    "vertices" in value &&
    "edges" in value;
}

function isGraphPaths(value: unknown): value is GraphPath[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "object" && item !== null && "objects" in item);
}

function assertGraphRenderable(value: unknown): asserts value is GraphData | GraphPath[] {
  if (!isGraphData(value) && !isGraphPaths(value)) {
    throw new Error("ui.graph() requires path results or { vertices, edges } data.");
  }
}

// ── Loader UI ──

function loaderMarkup(label: string): string {
  return [
    "<div style=\"display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fcfcfd;font:500 12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#374151\">",
    "<span style=\"width:12px;height:12px;border:2px solid #d1d5db;border-top-color:#4b5563;border-radius:9999px;display:inline-block;animation:nq-spin 0.8s linear infinite\"></span>",
    `<span>${label}</span>`,
    "</div>",
    "<style>@keyframes nq-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }</style>",
  ].join("");
}

function successMarkup(label: string): string {
  return `<div style="padding:8px 10px;border:1px solid #d1fae5;border-radius:8px;background:#f7fdf9;font:500 12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#166534">${label}</div>`;
}

function errorMarkup(label: string): string {
  return `<div style="padding:8px 10px;border:1px solid #fee2e2;border-radius:8px;background:#fff8f8;font:500 12px/1.4 ui-sans-serif,system-ui,sans-serif;color:#991b1b">${label}</div>`;
}

async function updateNotebookDisplay(
  eventType: "display_data" | "update_display_data",
  displayId: string,
  html: string,
): Promise<void> {
  if (typeof Deno === "undefined" || !("jupyter" in Deno) || !Deno.jupyter?.broadcast) {
    return;
  }

  await Deno.jupyter.broadcast(eventType, {
    data: {
      "text/html": html,
      "text/plain": html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    },
    metadata: {},
    transient: { display_id: displayId },
  });
}

// ── Public API ──

async function withLoader<T>(
  label: string,
  work: () => Promise<T>,
  options: { successMessage?: string; errorMessage?: string; displayId?: string } = {},
): Promise<T> {
  const displayId = options.displayId ?? `nq-loader-${crypto.randomUUID()}`;
  await updateNotebookDisplay("display_data", displayId, loaderMarkup(label));

  try {
    const result = await work();
    await updateNotebookDisplay(
      "update_display_data",
      displayId,
      successMarkup(options.successMessage ?? `${label} complete.`),
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateNotebookDisplay(
      "update_display_data",
      displayId,
      errorMarkup(options.errorMessage ?? `${label} failed: ${message}`),
    );
    throw error;
  }
}

export const ui = {
  table: displayTable,
  json: displayJson,
  graph(value: GraphData | GraphPath[], options: GraphRendererOptions = {}): RichDisplay {
    assertGraphRenderable(value);
    return renderGraph(value, options);
  },
  markdown: displayMarkdown,
  md: notebookMarkdown,
  html: displayHtml,
  htmlTemplate: notebookHtml,
  svg: displaySvg,
  note: displayNote,
  error: displayError,
  auto: defaultDisplay,
  withLoader,
} as const;
