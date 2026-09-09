# SDR Notebook

Query and visualize the SDR Neptune graph database from TypeScript notebooks in
VS Code. Gremlin, Cypher, graph diagrams, charts.

## Quick start

You need [Deno](https://deno.com), the
[VS Code Jupyter extension](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter),
and an AWS SSO profile (`dsoadev`) with access to the Neptune cluster.

```bash
deno jupyter --install          # register the Deno kernel (once)
aws sso login --profile dsoadev # SSO sessions expire every 8-12h
```

Open `examples/quickstart.ipynb`, pick the Deno kernel, run the cells.

On the Lilly network, Deno may fail with `UnknownIssuer` TLS errors. Fix by
adding to your shell profile:

```bash
export DENO_TLS_CA_STORE=system
```

## Usage

```ts
// Cell 1
import { connectNotebook, ui } from "@sdr-notebook/mod";
const session = await connectNotebook({ profile: "dsoadev" });
```

```ts
// Cell 2
const result = await session.gremlin(`g.V().hasLabel("Study").count()`);
ui.json(result);
```

`connectNotebook()` aliases `createClient()` — loads AWS creds from your
profile, resolves the REST endpoint, signs with SigV4. Pass `url` to override
the endpoint.

## API

### Session

```ts
session.gremlin(query)           // raw string or traversal
session.cypher(query)            // raw string or Cypher builder
session.g()                      // Gremlin traversal source
session.awsConfig()              // { region, credentials }
session.aws(S3Client)            // SDK v3 client with same creds
```

### Display (`ui`)

```ts
ui.table(rows)                           // HTML table
ui.json(value)                           // formatted JSON
ui.graph(paths, { layout: "tree" })      // graph diagram
ui.markdown(content)                     // markdown string
ui.md`Found **${count}** studies`        // tagged template markdown
ui.htmlTemplate`<b>${name}</b>`          // tagged template HTML
ui.withLoader("Loading…", () => work())  // progress spinner
```

### Charts

`bar`, `pie`, `groupedBar` — all accept `Record<string, number>` or
`Array<{ label, value }>`.

```ts
import { bar, groupedBar, pie } from "@sdr-notebook/mod";

bar(byVersion[0], { title: "Studies by USDM Version" });
pie(designTypes[0], { title: "Design Types", donut: true });
groupedBar([
  { group: "v4.0", values: { Interventional: 12, Observational: 5 } },
  { group: "v3.0", values: { Interventional: 8, Observational: 3 } },
], { title: "Design Types by Version" });
```

### Graph rendering

```ts
import { openGraph, saveGraph, ui } from "@sdr-notebook/mod";

ui.graph(paths, { layout: "tree", nodeDisplayText: "label" });
await openGraph(paths, { layout: "tree" });
await saveGraph(paths, "graph.svg", { layout: "tree" });
```

### Low-level client

If you don't want the notebook alias:

```ts
import { createClient } from "@sdr-notebook/mod";
const client = await createClient({
  profile: "dsoadev",
  region: "us-east-2",  // optional — inferred from endpoint
  url: "https://...",    // optional — override endpoint
});
```

Gremlin and Cypher work as raw strings or with fluent/builder APIs. Autocomplete
works in `.ts` files but not in notebook cells (VS Code + Deno limitation).

## Example notebooks

| Notebook | Covers |
|----------|--------|
| `examples/quickstart.ipynb` | Gremlin & Cypher crash course, graph rendering, tips |
| `examples/explore-study.ipynb` | Deep-dive into a study's versions, designs, neighborhood |
| `examples/gremlinExamples.ipynb` | More Gremlin query examples |
| `examples/ollama-gremlin.ipynb` | LLM tool-calling with Ollama (see below) |

Start with **quickstart** — it teaches Gremlin and Cypher from scratch.

### Ollama demo

`ollama-gremlin.ipynb` uses LangChain `ChatOllama` + `granite4:7b` at
`localhost:11434`. It defines an `execute_gremlin` tool with Zod, runs the query
through the REST client, and shows the answer + tool trace. Needs the model
installed on your Ollama server.

## Code layout

```text
src/
  mod.ts            Public API
  connection/       AWS auth, signing, REST transport
  query/            Gremlin translation, Cypher params
  display/          Tables, charts, graph rendering
  sdr/              SDR-specific queries
examples/           Runnable notebooks
```

Tests live beside their modules (`*_test.ts`).

Import aliases (stable across file moves):

| Alias | Points to |
|-------|-----------|
| `@sdr-notebook/mod` | Full public API |
| `@sdr-notebook/client` | Client creation |
| `@sdr-notebook/notebook` | Notebook connection |
| `@sdr-notebook/ui` | Display helpers |
| `@sdr-notebook/helpers` | SDR queries |

```bash
deno task check       # type-check
deno task test        # run tests (mocked, no network)
deno task fmt         # format
deno task fmt:check   # check formatting
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `UnknownIssuer` TLS error | `export DENO_TLS_CA_STORE=system` |
| `AWS credentials failed` | `aws sso login --profile dsoadev` |
| `Region is missing` | Pass `region` to `createClient()` |
| Kernel not found | `deno jupyter --install`, reload VS Code |
| Request timed out (30s) | Add `.limit()` or reduce hops |
| Variables undefined after restart | Re-run the connection cell |
| `Cannot find module` | Wrong kernel — pick Deno, not Python |
