import { render } from "preact-render-to-string";
import { renderGraph } from "./graph.ts";
import { DISPLAY_SYMBOL } from "./types.ts";
import type {
  GraphData,
  GraphPath,
  GraphRendererOptions,
  RichDisplay,
} from "./types.ts";

// ── Theme (CSS custom properties for light/dark mode) ──

const THEME_CSS = `
.nq-root {
  --nq-bg: #ffffff;
  --nq-bg-alt: #f8fafc;
  --nq-text: #1e293b;
  --nq-muted: #64748b;
  --nq-border: #e2e8f0;
  --nq-header-bg: #f1f5f9;
  --nq-badge-bg: #e2e8f0;
  --nq-badge-text: #475569;
  --nq-success-bg: #f0fdf4;
  --nq-success-border: #bbf7d0;
  --nq-success-text: #166534;
  --nq-error-bg: #fef2f2;
  --nq-error-border: #fecaca;
  --nq-error-text: #991b1b;
  --nq-font: ui-sans-serif, system-ui, -apple-system, sans-serif;
  --nq-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  .nq-root {
    --nq-bg: #1e1e2e;
    --nq-bg-alt: #181825;
    --nq-text: #cdd6f4;
    --nq-muted: #a6adc8;
    --nq-border: #313244;
    --nq-header-bg: #1e1e2e;
    --nq-badge-bg: #313244;
    --nq-badge-text: #bac2de;
    --nq-success-bg: #1a2e1a;
    --nq-success-border: #2d5a2d;
    --nq-success-text: #a6e3a1;
    --nq-error-bg: #2e1a1a;
    --nq-error-border: #5a2d2d;
    --nq-error-text: #f38ba8;
  }
}
`;

function ThemeStyle() {
  return <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />;
}

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

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return stringifyPlain(value);
}

function mimeBundle(
  bundle: Record<string, string | Record<string, unknown>>,
): RichDisplay {
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

// ── JSX Components ──

function JsonBlock({ pretty }: { pretty: string }) {
  return (
    <div class="nq-root">
      <ThemeStyle />
      <div
        style={{
          margin: "8px 0",
          padding: "12px 14px",
          border: "1px solid var(--nq-border)",
          borderRadius: "8px",
          background: "var(--nq-bg)",
        }}
      >
        <div
          style={{
            marginBottom: "8px",
            font: "600 11px/1.4 var(--nq-font)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--nq-muted)",
          }}
        >
          JSON
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            font: "13px/1.6 var(--nq-mono)",
            color: "var(--nq-text)",
          }}
        >
          {pretty}
        </pre>
      </div>
    </div>
  );
}

function DataTable(
  { rows, columns }: {
    rows: Array<Record<string, unknown>>;
    columns: string[];
  },
) {
  const rowCount = rows.length;
  const label = `${rowCount} row${rowCount === 1 ? "" : "s"}`;

  return (
    <div class="nq-root">
      <ThemeStyle />
      <div
        style={{
          margin: "8px auto 8px 0",
          maxWidth: "100%",
          width: "fit-content",
          minWidth: "min(720px, 100%)",
          border: "1px solid var(--nq-border)",
          borderRadius: "10px",
          background: "var(--nq-bg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderBottom: "1px solid var(--nq-border)",
            background: "var(--nq-header-bg)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: "9999px",
              background: "var(--nq-badge-bg)",
              font: "600 11px/1.6 var(--nq-font)",
              letterSpacing: "0.03em",
              color: "var(--nq-badge-text)",
            }}
          >
            {label}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "separate",
              borderSpacing: 0,
              width: "max-content",
              minWidth: "100%",
            }}
          >
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "var(--nq-header-bg)",
                      padding: "10px 14px",
                      textAlign: "left",
                      font: "600 11px/1.4 var(--nq-font)",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--nq-muted)",
                      borderBottom: "2px solid var(--nq-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0
                      ? "var(--nq-bg)"
                      : "var(--nq-bg-alt)",
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      style={{
                        padding: "9px 14px",
                        verticalAlign: "top",
                        textAlign: "left",
                        font: "13px/1.5 var(--nq-font)",
                        color: "var(--nq-text)",
                        borderBottom: "1px solid var(--nq-border)",
                        maxWidth: "360px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cellText(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Loader({ label }: { label: string }) {
  return (
    <div class="nq-root">
      <ThemeStyle />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          border: "1px solid var(--nq-border)",
          borderRadius: "8px",
          background: "var(--nq-bg)",
          font: "500 13px/1.4 var(--nq-font)",
          color: "var(--nq-text)",
        }}
      >
        <span
          style={{
            width: "14px",
            height: "14px",
            border: "2px solid var(--nq-border)",
            borderTopColor: "var(--nq-muted)",
            borderRadius: "9999px",
            display: "inline-block",
            animation: "nq-spin 0.8s linear infinite",
          }}
        />
        <span>{label}</span>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes nq-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }",
        }}
      />
    </div>
  );
}

function StatusBar(
  { variant, label }: { variant: "success" | "error"; label: string },
) {
  const isSuccess = variant === "success";
  return (
    <div class="nq-root">
      <ThemeStyle />
      <div
        style={{
          padding: "10px 14px",
          border: `1px solid var(${
            isSuccess ? "--nq-success-border" : "--nq-error-border"
          })`,
          borderRadius: "8px",
          background: `var(${isSuccess ? "--nq-success-bg" : "--nq-error-bg"})`,
          font: "500 13px/1.4 var(--nq-font)",
          color: `var(${isSuccess ? "--nq-success-text" : "--nq-error-text"})`,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Display functions ──

function displayJson(value: unknown): RichDisplay {
  const pretty = stringifyPlain(value);
  return mimeBundle({
    "text/html": render(<JsonBlock pretty={pretty} />),
    "application/json": isRecord(value) ? value : { value },
    "text/plain": pretty,
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
  const tableHtml = render(<DataTable rows={rows} columns={columns} />);

  const plainText = rows.map((row) =>
    columns.map((column) => `${column}: ${stringifyPlain(row[column])}`).join(
      " | ",
    )
  ).join("\n");

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

function notebookMarkdown(
  strings: TemplateStringsArray,
  ...values: unknown[]
): RichDisplay {
  const source = String.raw(
    { raw: strings },
    ...values.map((value) =>
      typeof value === "string" ? value : stringifyPlain(value)
    ),
  );
  return displayMarkdown(source);
}

function notebookHtml(
  strings: TemplateStringsArray,
  ...values: unknown[]
): RichDisplay {
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
    value.every((item) =>
      typeof item === "object" && item !== null && "objects" in item
    );
}

function assertGraphRenderable(
  value: unknown,
): asserts value is GraphData | GraphPath[] {
  if (!isGraphData(value) && !isGraphPaths(value)) {
    throw new Error(
      "ui.graph() requires path results or { vertices, edges } data.",
    );
  }
}

// ── Loader UI ──

function loaderMarkup(label: string): string {
  return render(<Loader label={label} />);
}

function successMarkup(label: string): string {
  return render(<StatusBar variant="success" label={label} />);
}

function errorMarkup(label: string): string {
  return render(<StatusBar variant="error" label={label} />);
}

async function updateNotebookDisplay(
  eventType: "display_data" | "update_display_data",
  displayId: string,
  html: string,
): Promise<void> {
  if (
    typeof Deno === "undefined" || !("jupyter" in Deno) ||
    !Deno.jupyter?.broadcast
  ) {
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
  options: {
    successMessage?: string;
    errorMessage?: string;
    displayId?: string;
  } = {},
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

export interface UiApi {
  readonly table: (rows: Array<Record<string, unknown>>) => RichDisplay;
  readonly json: (value: unknown) => RichDisplay;
  readonly graph: (
    value: GraphData | GraphPath[],
    options?: GraphRendererOptions,
  ) => RichDisplay;
  readonly markdown: (content: string) => RichDisplay;
  readonly md: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => RichDisplay;
  readonly html: (html: string, plainText?: string) => RichDisplay;
  readonly htmlTemplate: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => RichDisplay;
  readonly svg: (svg: string, plainText: string) => RichDisplay;
  readonly note: (content: string) => RichDisplay;
  readonly error: (message: string, details?: string) => RichDisplay;
  readonly auto: (value: unknown) => RichDisplay;
  readonly withLoader: <T>(
    label: string,
    work: () => Promise<T>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      displayId?: string;
    },
  ) => Promise<T>;
}

export const ui: UiApi = {
  table: displayTable,
  json: displayJson,
  graph(
    value: GraphData | GraphPath[],
    options: GraphRendererOptions = {},
  ): RichDisplay {
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
};
