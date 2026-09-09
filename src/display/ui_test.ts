import { assertStringIncludes } from "@std/assert";
import { toMimeBundle, ui } from "./ui.ts";

Deno.test("ui.table renders plain arrays", () => {
  const mime = toMimeBundle(ui.table([{ study: "A", version: "1.0" }]));
  assertStringIncludes(String(mime["text/html"]), "<table");
  assertStringIncludes(String(mime["text/plain"]), "study: A");
});

Deno.test("ui.json renders transformed plain values", () => {
  const rows = [{ study: "A", version: "1.0" }].filter((row) =>
    row.study === "A"
  );
  const mime = toMimeBundle(ui.json(rows));
  assertStringIncludes(String(mime["text/plain"]), '"study": "A"');
});
