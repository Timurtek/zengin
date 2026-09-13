import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A Figma plugin, small enough to read, that imports a Zengin variables payload into the open file and
 * exports the file's variables in the shape `zengin figma import` reads. The Variables REST API is an
 * Enterprise feature; a plugin loaded from its manifest works on every plan.
 */

export const PLUGIN_FILES: Record<string, string> = {
  "manifest.json": JSON.stringify(
    {
      name: "Zengin variables",
      id: "zengin-variables",
      api: "1.0.0",
      main: "code.js",
      ui: "ui.html",
      editorType: ["figma"],
      documentAccess: "dynamic-page",
      networkAccess: { allowedDomains: ["none"] },
    },
    null,
    2,
  ) + "\n",

  "ui.html": `<!doctype html>
<meta charset="utf-8" />
<style>
  body { margin: 0; padding: 12px; font: 12px/1.5 Inter, system-ui, sans-serif; color: #1e1e1e; }
  textarea { width: 100%; height: 220px; box-sizing: border-box; font: 11px/1.4 ui-monospace, monospace; }
  .row { display: flex; gap: 8px; margin-top: 8px; }
  button { padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; }
  button.primary { background: #0d99ff; border-color: #0d99ff; color: #fff; }
  #status { margin-top: 8px; color: #555; white-space: pre-wrap; }
</style>
<p><strong>Import</strong>: paste the payload from <code>zengin figma export</code> and press Import. <strong>Export</strong>: reads this file's variables in the shape <code>zengin figma import</code> takes.</p>
<textarea id="payload" placeholder='{"variableCollections": [...], ...}'></textarea>
<div class="row">
  <button class="primary" id="import">Import</button>
  <button id="export">Export</button>
  <button id="copy">Copy</button>
</div>
<div id="status"></div>
<script>
  const $ = (id) => document.getElementById(id);
  $("import").onclick = () => {
    try {
      parent.postMessage({ pluginMessage: { type: "import", payload: JSON.parse($("payload").value) } }, "*");
    } catch (e) {
      $("status").textContent = "That is not valid JSON: " + e.message;
    }
  };
  $("export").onclick = () => parent.postMessage({ pluginMessage: { type: "export" } }, "*");
  $("copy").onclick = () => { $("payload").select(); document.execCommand("copy"); $("status").textContent = "Copied."; };
  onmessage = (e) => {
    const m = e.data.pluginMessage;
    if (!m) return;
    if (m.type === "status") $("status").textContent = m.text;
    if (m.type === "exported") { $("payload").value = JSON.stringify(m.local, null, 2); $("status").textContent = m.text; }
  };
</script>
`,

  "code.js": `// Zengin variables: import a payload from \`zengin figma export\`, or export this file's variables.
figma.showUI(__html__, { width: 480, height: 420 });

const rgba = (v) => ({ r: v.r, g: v.g, b: v.b, a: v.a === undefined ? 1 : v.a });

async function importPayload(p) {
  const collections = new Map(); // temp id -> collection
  const modes = new Map(); // temp id -> real mode id
  const variables = new Map(); // temp id -> variable
  for (const c of p.variableCollections) {
    const col = figma.variables.createVariableCollection(c.name);
    collections.set(c.id, col);
    modes.set(c.initialModeId, col.modes[0].modeId);
  }
  for (const m of p.variableModes) {
    const col = collections.get(m.variableCollectionId);
    if (m.action === "UPDATE") col.renameMode(modes.get(m.id), m.name);
    else modes.set(m.id, col.addMode(m.name));
  }
  for (const v of p.variables) {
    const col = collections.get(v.variableCollectionId);
    const variable = figma.variables.createVariable(v.name, col, v.resolvedType);
    if (v.scopes && !v.scopes.includes("ALL_SCOPES")) variable.scopes = v.scopes;
    if (v.codeSyntax && v.codeSyntax.WEB) variable.setVariableCodeSyntax("WEB", v.codeSyntax.WEB);
    if (v.description) variable.description = v.description;
    variables.set(v.id, variable);
  }
  let n = 0;
  for (const mv of p.variableModeValues) {
    const variable = variables.get(mv.variableId);
    const modeId = modes.get(mv.modeId);
    if (!variable || !modeId) continue;
    variable.setValueForMode(modeId, variable.resolvedType === "COLOR" ? rgba(mv.value) : mv.value);
    n++;
  }
  return p.variables.length + " variables, " + n + " values, in " + p.variableCollections.map((c) => c.name).join(", ");
}

async function exportLocal() {
  const local = { meta: { variableCollections: {}, variables: {} } };
  for (const col of await figma.variables.getLocalVariableCollectionsAsync()) {
    local.meta.variableCollections[col.id] = { id: col.id, name: col.name, modes: col.modes.map((m) => ({ modeId: m.modeId, name: m.name })), defaultModeId: col.defaultModeId };
  }
  for (const v of await figma.variables.getLocalVariablesAsync()) {
    local.meta.variables[v.id] = { id: v.id, name: v.name, resolvedType: v.resolvedType, variableCollectionId: v.variableCollectionId, valuesByMode: v.valuesByMode, codeSyntax: v.codeSyntax };
  }
  return local;
}

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === "import") {
      const text = await importPayload(msg.payload);
      figma.ui.postMessage({ type: "status", text: "Imported " + text + "." });
      figma.notify("Zengin variables imported");
    } else if (msg.type === "export") {
      const local = await exportLocal();
      const count = Object.keys(local.meta.variables).length;
      figma.ui.postMessage({ type: "exported", local, text: "Exported " + count + " variables. Copy, save as variables.json, then: zengin figma import variables.json" });
    }
  } catch (e) {
    figma.ui.postMessage({ type: "status", text: "Failed: " + (e && e.message ? e.message : String(e)) });
  }
};
`,
};

/** Writes the plugin into a directory, ready for Figma's "Import plugin from manifest". */
export function writePlugin(dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const [name, content] of Object.entries(PLUGIN_FILES)) {
    writeFileSync(join(dir, name), content);
    written.push(join(dir, name));
  }
  return written;
}
