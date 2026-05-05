# SDR  Notebook

Interactive query and visualization environment for the SDR Neptune graph database.  Run Gremlin and
Cypher queries, render graph diagrams and charts — all from a notebook in VS Code.

## What is this?

Jupyter notebook but in Typescript using Deno Jupyter notebook kernel.

- Write queries in TypeScript and see results inline (tables, JSON, charts, graph diagrams)
- Edit a query and re-run just that cell — no restarting anything
- Build up an analysis step by step, keeping intermediate results


## How to use this:

Install [Deno](https://deno.com) and the VS Code Jupyter extension, then open any `.ipynb` file in this folder.


You also need to run `deno jupyter --install` once to register the Deno kernel with Jupyter.  After that, you can 
open notebooks and select the Deno kernel to run TypeScript code directly in cells.

Note that this assumes that you already have AWS CLI configured with an SSO profile named `dsoadev` that has access to
the SDR Neptune cluster.  If not, you can change the profile name in the connection code cell or set up your AWS CLI
accordingly.

## What is Deno? (for Node devs)

[Deno](https://deno.com) is a TypeScript/JavaScript runtime — like Node, but with some key differences:

- **TypeScript works out of the box.** No `ts-node`, no `tsconfig.json`, no build step.
- **Imports use URLs or `npm:` specifiers.** Instead of `npm install`, you write `import { foo }
from "npm:some-package"`.  Dependencies are cached automatically.
- **Has a built-in Jupyter kernel.** That's why we use it here — you get TypeScript notebooks without any Python.

You don't need to learn Deno deeply to use this.  If you can write TypeScript, you can write Deno.
The main thing to know: imports look a bit different, and there's no `node_modules` folder.  Everything else is familiar.

## What is Jupyter? (for non-Python devs)

You might associate Jupyter with Python — but Jupyter is actually **kernel-agnostic**.  It's just a
notebook format (`.ipynb` files) with a protocol for executing code.  The "kernel" is what actually
runs your code.  Python is the most common kernel, but there are kernels for R, Julia, Go, and —
thanks to Deno — **TypeScript**.

Jupyter notebooks are documents with **cells** — each cell is either code or text.  You run cells
one at a time, and the output appears right below.  Think of it like a REPL, but you can go back and
edit any previous step.

- **Code cells** run TypeScript (via the Deno kernel). Variables persist between cells.
- **Markdown cells** are documentation — formatted text, tables, links.
- **Output** appears inline — JSON, tables, SVG charts, graph diagrams.

**You do not need Python installed.** The Deno kernel replaces it entirely.

## How it works (Deno + Jupyter + TypeScript)

Here's what's actually happening when you run a notebook cell:

```
┌────────────────────────────────────┐
│  VS Code (Jupyter extension)       │
│  ┌──────────────────────────────┐  │
│  │ .ipynb notebook              │  │
│  │                              │  │
│  │  Cell: const x = await ...   │──┼──→ Sends TypeScript to Deno kernel
│  │  Output: { count: 42 }    ←──│──┼──  Receives results back
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────┐
│  Deno Jupyter Kernel               │
│  (deno jupyter --install)          │
│                                    │
│  - Runs TypeScript natively        │
│  - npm packages work (npm:foo)     │
│  - Top-level await works           │
│  - Deno.jupyter API for rich       │
│    output (SVG, HTML, images)      │
└────────────────────────────────────┘
```

**The code you write in cells is plain TypeScript** — the same as what you'd write in any `.ts`
file.  There's no special syntax, no magic.  The only difference from a regular script is:

1. **Top-level `await`** works (no need to wrap in an async function)
2. **Variables persist** across cells within the same session
3.  **Rich output** — you can return objects with a `Symbol.for("Jupyter.display")` method to render
HTML, SVG, or images inline (that's how `GraphRenderer` and the chart helpers work)

If you can write this in a `.ts` file, you can write it in a notebook cell:
```ts
import { connectNotebook, ui } from "@sdr-notebook/mod";
const session = await connectNotebook({ profile: "dsoadev" });
const result = await session.gremlin(`g.V().hasLabel("Study").count()`);
ui.json(result);
```


**The minimum code to query Neptune from a Deno notebook is:**

```ts
// Cell 1: connect
import { connectNotebook } from "@sdr-notebook/mod";
const session = await connectNotebook({ profile: "dsoadev" });
```

```ts
// Cell 2: query
import { ui } from "@sdr-notebook/mod";
const result = await session.gremlin(`g.V().hasLabel("Study").count()`);
ui.json(result);
```

That's it. Two cells, one import path. Everything else — `GraphRenderer`, `bar()`, `pie()`, Cypher builder, and low-level `createClient(...)` access — is optional and only imported when you need it.

**What `createClient()` does under the hood:**

1. Reads your AWS credentials from `~/.aws/config` using the profile you specified
2. Calls `ListGraphqlApis` to find the AppSync endpoint URL (so you don't have to hardcode it)
3. Returns a client that signs every request with SigV4 and sends it to AppSync

**What `client.gremlin(query)` does:**

1. Wraps your query string in a GraphQL mutation: `mutation { executeQuery(input: { type: "gremlin", query: "..." }) }`
2. Signs the HTTP request with SigV4 (same as what `nqcli` does in Go)
3. POSTs to AppSync, which invokes the Lambda resolver, which runs the query on Neptune
4. Unwraps the nested response (GraphQL envelope → stringified JSON → parsed result)
5. Returns the parsed result to your notebook cell

**Where does `deno.json` fit?**

`deno.json` is like `package.json` for Deno. It defines an import map so you can write stable imports like `@sdr-notebook/mod` instead of guessing relative paths like `../src/mod.ts`. It also defines the `deno test` and `deno check` tasks.

## Setup (one-time)

### 1. Install Deno

```bash
brew install deno
```

Verify: `deno --version` should show 2.7+.

### 2. Install the Jupyter kernel

```bash
deno jupyter --install
```

This registers the Deno kernel with Jupyter so VS Code can find it.

### 3. Install the VS Code Jupyter extension

Open VS Code → Extensions (`Cmd+Shift+X`) → search **"Jupyter"** → install the one by Microsoft.

### 4. Corporate TLS (Lilly network)

If you're on the corporate network, Deno may fail to download packages with `UnknownIssuer` TLS errors. Fix by launching VS Code with:

```bash
DENO_TLS_CA_STORE=system code .
```

Or add to your shell profile (~/.zshrc or ~/.config/fish/config.fish):

```bash
export DENO_TLS_CA_STORE=system
```

## Day-to-day usage

### 1. Authenticate

```bash
aws sso login --profile dsoadev
```

SSO sessions expire every 8–12 hours. If a notebook cell fails with a credential error, just re-run this command — you don't need to restart the kernel.

### 2. Open a notebook

```bash
code notebooks/examples/quickstart.ipynb
```

When the notebook opens, click **"Select Kernel"** (top right) → **"Jupyter Kernel..."** → **"Deno"**.

### 3. Run cells

- **Shift+Enter** — run current cell, move to next
- **Cmd+Enter** — run current cell, stay on it
- **Click the play button** on any cell

Variables persist across cells in the same session. If things get weird, restart the kernel: `Cmd+Shift+P` → "Notebook: Restart Kernel".

### 4. Create your own notebook

`Cmd+Shift+P` → "Create: New Jupyter Notebook" → select Deno kernel. Start with:

```ts
import { connectNotebook, sampleStudies, GraphRenderer, bar, pie, ui } from "@sdr-notebook/mod";

const session = await connectNotebook({ profile: "dsoadev" });
const studies = await sampleStudies(session, { minVersions: 2, limit: 5 });
ui.table(studies);
```

## Example notebooks

```sh
┌─────────────────────────────────┬────────────────────────────────────────────────────────────────┐
│            Notebook             │                         What it covers                         │
├─────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ `examples/quickstart.ipynb`     │  Gremlin & Cypher crash courses, graph schema, GraphRenderer   │
│                                 │ reference, tips & tricks                                       │
├─────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ `examples/explore-study.ipynb`  │  Deep-dive into a specific study's versions, designs, and      │
│                                 │ neighborhood                                                   │
└─────────────────────────────────┴────────────────────────────────────────────────────────────────┘
```

Start with **quickstart** — it teaches you Gremlin and Cypher from scratch with runnable examples.

## API Reference

### Notebook Session

Preferred notebook entrypoint. `connectNotebook(...)` returns a plain session object with the notebook-oriented methods.

```ts
const session = await connectNotebook({ profile: "dsoadev" });

const result = await session.gremlin(`g.V().hasLabel("Study").limit(5).elementMap()`);
ui.table(result); // rich HTML table
ui.json(result);  // pretty JSON
```

You can also reuse the same AWS profile and resolved region for normal AWS SDK clients:

```ts
import { ListBucketsCommand, S3Client } from "npm:@aws-sdk/client-s3";

const session = await connectNotebook({ profile: "dsoadev" });
const s3 = session.aws(S3Client);
const buckets = await s3.send(new ListBucketsCommand({}));
ui.json(buckets);
```

Useful notebook session methods:

- `session.gremlin(queryOrTraversal)` runs Gremlin and returns parsed data
- `session.cypher(queryOrBuilder)` runs Cypher and returns parsed data
- `session.g()` returns the Gremlin traversal source
- `session.aws(ClientCtor, config?)` creates an AWS SDK v3 client with the same credentials and region
- `session.awsConfig()` returns the `{ region, credentials }` object used for AWS SDK clients

### `ui`

Explicit rendering helpers. The exported `ui` object accepts plain transformed data directly.

```ts
const versions = await session.gremlin(`g.V().hasLabel("Study").limit(5).elementMap()`);
const filtered = versions.filter((row) => row.label === "Study");

ui.table(versions);
ui.table(filtered);
ui.json(filtered);
```

Useful methods on `ui`:

- `ui.table(value)` renders arrays of records as HTML tables
- `ui.json(value)` renders structured JSON
- `ui.graph(value, options)` renders Gremlin path results or normalized graph data
- `ui.md(...)` emits markdown output from code cells
- `ui.htmlTemplate(...)` emits HTML output from code cells
- `ui.withLoader(label, work)` shows progress for long-running async work

### `createClient`

Creates the low-level AppSync-backed Neptune client.

```ts
import { createClient } from "@sdr-notebook/mod";

const client = await createClient({
  profile: "dsoadev",        // AWS CLI profile (required)
  region: "us-east-2",       // optional — auto-detected from profile
  url: "https://...",        // optional — skips AppSync discovery
});
```

**Query methods:**

```ts
// Gremlin — raw string (recommended in notebooks)
await client.gremlin(`g.V().hasLabel("Study").count()`);

// Gremlin — fluent API (useful in .ts files where you get autocomplete)
const g = client.g();
await client.gremlin(g.V().hasLabel("Study").count());

// Cypher — raw string (recommended in notebooks)
await client.cypherRaw(`MATCH (s:Study) RETURN s.name LIMIT 5`);

// Cypher — typed builder (useful in .ts files)
import Cypher from "@neo4j/cypher-builder";
const s = new Cypher.NamedNode("s");
await client.cypher(
  new Cypher.Match(new Cypher.Pattern(s, { labels: ["Study"] })).return(s).limit(5)
);
```

> **Note on autocomplete:** The fluent Gremlin API and Cypher builder provide full autocomplete in
regular `.ts` files, but **not in notebook cells** (VS Code limitation with the Deno kernel).  In
notebooks, raw strings are the practical choice.  The quickstart notebook has a full Gremlin and
Cypher cheat sheet to help.

### `GraphRenderer`

Renders graph query results as SVG diagrams. Use `.path()` in your Gremlin query to capture vertices and edges.

```ts
const renderer = new GraphRenderer({
  layout: "tree",       // "force" (default) or "tree" (hierarchical)
  nodeDisplayText: "label",  // "property" | "label" | "id"
  // ... many more options — see quickstart.ipynb for the full reference
});

renderer.render(paths);          // inline in notebook
await renderer.open(paths);      // open in browser (full viewport, zoomable)
await renderer.save(paths, "graph.svg");  // save to file
```

### Charts

SVG charts for visualizing query results.  All accept `Record<string, number>` (from Gremlin
`groupCount()`) or `Array<{ label, value }>`.

```ts
import { bar, pie, groupedBar } from "@sdr-notebook/mod";

// Horizontal bar chart
const byVersion = await client.gremlin(`g.V().hasLabel("Study").groupCount().by("usdmVersion")`);
bar(byVersion[0], { title: "Studies by USDM Version" });

// Pie / donut chart
const designTypes = await client.gremlin(`g.V().hasLabel("StudyDesign").groupCount().by("instanceType")`);
pie(designTypes[0], { title: "Study Design Types", donut: true });

// Grouped bar chart (compare categories across groups)
groupedBar([
  { group: "v4.0", values: { Interventional: 12, Observational: 5 } },
  { group: "v3.0", values: { Interventional: 8, Observational: 3 } },
], { title: "Design Types by USDM Version" });
```


## Running tests

```bash
cd notebooks && deno test --allow-all
```

Tests cover the Gremlin translator, Cypher builder, SigV4 signer, response parsing, and graph
renderer.  No network access needed — they use mocked data.

## Troubleshooting

```sh
┌───────────────────────────────────────────┬──────────────────────────────────────────────────────┐
│                 Problem                   │                       Solution                       │
├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ `UnknownIssuer` TLS error                 │  Run `DENO_TLS_CA_STORE=system code .` or export it  │
│                                           │ in your shell profile                                │
├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ `AWS credentials failed`                  │  Run `aws sso login --profile dsoadev`               │
├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ `Region is missing`                       │  Pass `region` explicitly: `createClient({ profile:  │
│                                           │ "dsoadev", region: "us-east-2" })`                   │
├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Kernel not found in VS Code               │  Run `deno jupyter --install` and reload VS Code     │
├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Request timed out (29s)                   │  Your query is too expensive — add `.limit()` or     │
│                                           │ reduce hops                                          │
├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Variables undefined after kernel restart  │  Re-run the connection cell (first code cell) first  │
├───────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ `Cannot find module` errors               │  Make sure you're using the Deno kernel, not Python  │
└───────────────────────────────────────────┴──────────────────────────────────────────────────────┘
```
