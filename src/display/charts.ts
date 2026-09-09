import { scaleOrdinal } from "d3-scale";

const COLORS = [
  "#2563EB",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#0891B2",
  "#BE185D",
  "#4F46E5",
  "#CA8A04",
  "#0D9488",
  "#EA580C",
  "#6D28D9",
  "#64748B",
  "#E11D48",
  "#78716C",
];

interface ChartItem {
  label: string;
  value: number;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jupyterDisplay(svg: string, plainText: string) {
  return {
    [Symbol.for("Jupyter.display")]() {
      return { "image/svg+xml": svg, "text/plain": plainText };
    },
  };
}

/**
 * Render a horizontal bar chart as inline SVG.
 */
export function bar(
  data: ChartItem[] | Record<string, number>,
  opts: {
    title?: string;
    width?: number;
    barHeight?: number;
    colors?: string[];
  } = {},
) {
  const items = Array.isArray(data)
    ? data
    : Object.entries(data).map(([label, value]) => ({ label, value }));

  if (items.length === 0) return jupyterDisplay("<svg></svg>", "Empty chart");

  const width = opts.width ?? 700;
  const barH = opts.barHeight ?? 32;
  const labelW = 200;
  const gap = 6;
  const titleH = opts.title ? 40 : 10;
  const height = titleH + items.length * (barH + gap) + 20;
  const maxVal = Math.max(...items.map((d) => d.value));
  const barAreaW = width - labelW - 80;
  const palette = opts.colors ?? COLORS;
  const color = scaleOrdinal<string>().domain(items.map((d) => d.label)).range(
    palette,
  );

  const titleSvg = opts.title
    ? `  <text x="${
      width / 2
    }" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#333" font-family="sans-serif">${
      escapeXml(opts.title)
    }</text>`
    : "";

  const barsSvg = items.map((item, i) => {
    const y = titleH + i * (barH + gap);
    const barW = maxVal > 0 ? (item.value / maxVal) * barAreaW : 0;
    return `  <text x="${labelW - 8}" y="${
      y + barH / 2 + 5
    }" text-anchor="end" font-size="12" fill="#333" font-family="sans-serif">${
      escapeXml(item.label)
    }</text>
  <rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" fill="${
      color(item.label)
    }" rx="3"/>
  <text x="${labelW + barW + 6}" y="${
      y + barH / 2 + 5
    }" font-size="11" fill="#666" font-family="sans-serif">${item.value}</text>`;
  }).join("\n");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#fafafa" rx="4"/>
${titleSvg}
${barsSvg}
</svg>`;

  return jupyterDisplay(
    svg,
    items.map((d) => `${d.label}: ${d.value}`).join(", "),
  );
}

/**
 * Render a pie/donut chart as inline SVG.
 */
export function pie(
  data: ChartItem[] | Record<string, number>,
  opts: { title?: string; size?: number; donut?: boolean; colors?: string[] } =
    {},
) {
  const items = Array.isArray(data)
    ? data
    : Object.entries(data).map(([label, value]) => ({ label, value }));

  if (items.length === 0) return jupyterDisplay("<svg></svg>", "Empty chart");

  const size = opts.size ?? 500;
  const donut = opts.donut ?? false;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.35;
  const innerR = donut ? r * 0.55 : 0;
  const total = items.reduce((sum, d) => sum + d.value, 0);
  const palette = opts.colors ?? COLORS;
  const color = scaleOrdinal<string>().domain(items.map((d) => d.label)).range(
    palette,
  );

  // Legend on the right
  const legendW = 200;
  const totalW = size + legendW;

  const titleSvg = opts.title
    ? `  <text x="${
      size / 2
    }" y="24" text-anchor="middle" font-size="14" font-weight="bold" fill="#333" font-family="sans-serif">${
      escapeXml(opts.title)
    }</text>`
    : "";

  let angle = -Math.PI / 2; // start at top
  const slices = items.map((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const startAngle = angle;
    const endAngle = angle + sliceAngle;
    angle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    let d: string;
    if (donut) {
      const ix1 = cx + innerR * Math.cos(startAngle);
      const iy1 = cy + innerR * Math.sin(startAngle);
      const ix2 = cx + innerR * Math.cos(endAngle);
      const iy2 = cy + innerR * Math.sin(endAngle);
      d =
        `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    } else {
      d =
        `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }

    // Label position (midpoint of arc)
    const midAngle = startAngle + sliceAngle / 2;
    const labelR = donut ? (r + innerR) / 2 : r * 0.65;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;

    const labelSvg = pct >= 5
      ? `  <text x="${lx}" y="${
        ly + 4
      }" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff" font-family="sans-serif">${pct}%</text>`
      : "";

    return `  <path d="${d}" fill="${
      color(item.label)
    }" stroke="#fff" stroke-width="2"/>\n${labelSvg}`;
  }).join("\n");

  const legendSvg = items.map((item, i) => {
    const y = 60 + i * 24;
    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
    return `  <rect x="${size + 10}" y="${y}" width="12" height="12" fill="${
      color(item.label)
    }" rx="2"/>
  <text x="${size + 28}" y="${
      y + 11
    }" font-size="12" fill="#333" font-family="sans-serif">${
      escapeXml(item.label)
    } (${item.value}, ${pct}%)</text>`;
  }).join("\n");

  // Total in center for donut
  const centerSvg = donut
    ? `  <text x="${cx}" y="${
      cy - 4
    }" text-anchor="middle" font-size="11" fill="#999" font-family="sans-serif">Total</text>
  <text x="${cx}" y="${
      cy + 16
    }" text-anchor="middle" font-size="20" font-weight="bold" fill="#333" font-family="sans-serif">${total}</text>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${size}" viewBox="0 0 ${totalW} ${size}">
  <rect width="${totalW}" height="${size}" fill="#fafafa" rx="4"/>
${titleSvg}
${slices}
${centerSvg}
${legendSvg}
</svg>`;

  return jupyterDisplay(
    svg,
    items.map((d) => `${d.label}: ${d.value}`).join(", "),
  );
}

/**
 * Render a vertical grouped bar chart (for comparing categories across groups).
 */
export function groupedBar(
  data: Array<{ group: string; values: Record<string, number> }>,
  opts: { title?: string; width?: number; height?: number; colors?: string[] } =
    {},
) {
  const width = opts.width ?? 700;
  const height = opts.height ?? 400;
  const palette = opts.colors ?? COLORS;
  const marginTop = opts.title ? 50 : 20;
  const marginBottom = 60;
  const marginLeft = 50;
  const marginRight = 20;
  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;

  // Collect all category keys
  const categories = [...new Set(data.flatMap((d) => Object.keys(d.values)))];
  const color = scaleOrdinal<string>().domain(categories).range(palette);
  const maxVal = Math.max(...data.flatMap((d) => Object.values(d.values)));

  const groupW = chartW / data.length;
  const barW = Math.min(groupW / (categories.length + 1), 40);

  const titleSvg = opts.title
    ? `  <text x="${
      width / 2
    }" y="28" text-anchor="middle" font-size="14" font-weight="bold" fill="#333" font-family="sans-serif">${
      escapeXml(opts.title)
    }</text>`
    : "";

  const barsSvg = data.map((group, gi) => {
    const gx = marginLeft + gi * groupW + groupW / 2;
    const bars = categories.map((cat, ci) => {
      const val = group.values[cat] ?? 0;
      const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
      const x = gx + (ci - categories.length / 2) * (barW + 2);
      const y = marginTop + chartH - barH;
      return `  <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${
        color(cat)
      }" rx="2"/>`;
    }).join("\n");

    const label = `  <text x="${gx}" y="${
      height - marginBottom + 20
    }" text-anchor="middle" font-size="11" fill="#333" font-family="sans-serif">${
      escapeXml(group.group)
    }</text>`;
    return `${bars}\n${label}`;
  }).join("\n");

  // Y axis ticks
  const ticks = 5;
  const axisSvg = Array.from({ length: ticks + 1 }, (_, i) => {
    const val = Math.round((maxVal / ticks) * i);
    const y = marginTop + chartH - (i / ticks) * chartH;
    return `  <line x1="${marginLeft}" y1="${y}" x2="${
      marginLeft + chartW
    }" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>
  <text x="${marginLeft - 8}" y="${
      y + 4
    }" text-anchor="end" font-size="10" fill="#999" font-family="sans-serif">${val}</text>`;
  }).join("\n");

  // Legend
  const legendSvg = categories.map((cat, i) => {
    const x = marginLeft + i * 140;
    return `  <rect x="${x}" y="${height - 20}" width="10" height="10" fill="${
      color(cat)
    }" rx="2"/>
  <text x="${x + 14}" y="${
      height - 11
    }" font-size="11" fill="#333" font-family="sans-serif">${
      escapeXml(cat)
    }</text>`;
  }).join("\n");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#fafafa" rx="4"/>
${titleSvg}
${axisSvg}
${barsSvg}
${legendSvg}
</svg>`;

  return jupyterDisplay(
    svg,
    data.map((d) => `${d.group}: ${JSON.stringify(d.values)}`).join(", "),
  );
}
