/**
 * Browser-side entry for the Flow Document Phase 1A fidelity harness.
 * Bundled with esbuild; no React / Next / Creator overlays.
 */
import { Editor } from "@tiptap/core";
import { createFlowDocumentExtensions, FLOW_PAPER_PRESETS, type FlowPaperId } from "../extensions";
import { FLOW_FIXTURES, type FlowFixtureId } from "../fixtures";
import {
  countExplicitPageBreaks,
  extractFlowPlainText,
  parseFlowDoc,
  serializeFlowDoc,
} from "../serialize";
import { measureExplicitPageBreakNodes, measurePaginationPlusPageCount } from "../measure-pages";

export type HarnessSnapshot = {
  fixtureId: FlowFixtureId;
  paper: FlowPaperId;
  editorPageCount: number;
  explicitBreakNodes: number;
  explicitBreaksInJson: number;
  scrollHeight: number;
  plainTextLength: number;
  html: string;
  json: string;
};

declare global {
  interface Window {
    __flowHarness: {
      ready: boolean;
      loadFixture: (id: FlowFixtureId, paper?: FlowPaperId) => Promise<HarnessSnapshot>;
      snapshot: () => HarnessSnapshot;
      insertNearStart: (text: string) => void;
      deleteNearStart: (count: number) => void;
      insertPageBreakAtEnd: () => void;
      undo: () => void;
      redo: () => void;
      reloadFromJson: (raw: string) => void;
      waitForPagination: (ms?: number) => Promise<HarnessSnapshot>;
      fixtures: FlowFixtureId[];
    };
  }
}

let editor: Editor | null = null;
let activeFixture: FlowFixtureId = "short-agreement";
let activePaper: FlowPaperId = "letter";

function ensureMount(): HTMLElement {
  let mount = document.getElementById("flow-harness-mount");
  if (!mount) {
    mount = document.createElement("div");
    mount.id = "flow-harness-mount";
    document.body.appendChild(mount);
  }
  return mount;
}

function destroyEditor() {
  editor?.destroy();
  editor = null;
  ensureMount().innerHTML = "";
}

function createEditor(paper: FlowPaperId, content: object) {
  destroyEditor();
  const mount = ensureMount();
  editor = new Editor({
    element: mount,
    extensions: createFlowDocumentExtensions({ paper, pagination: true }),
    content,
    editorProps: {
      attributes: {
        class: "flow-document-editor ProseMirror",
        "data-flow-document": "true",
        "data-flow-harness": "true",
      },
    },
  });
  return editor;
}

function snapshot(): HarnessSnapshot {
  if (!editor) {
    throw new Error("Harness editor not initialized");
  }
  const root = editor.view.dom;
  const json = serializeFlowDoc(editor.getJSON());
  return {
    fixtureId: activeFixture,
    paper: activePaper,
    editorPageCount: measurePaginationPlusPageCount(root),
    explicitBreakNodes: measureExplicitPageBreakNodes(root),
    explicitBreaksInJson: countExplicitPageBreaks(editor.getJSON()),
    scrollHeight: root.scrollHeight,
    plainTextLength: extractFlowPlainText(editor.getJSON()).length,
    html: editor.getHTML(),
    json,
  };
}

async function waitForPagination(ms = 1200): Promise<HarnessSnapshot> {
  const started = performance.now();
  let last = -1;
  let stable = 0;
  while (performance.now() - started < ms) {
    await new Promise((r) => setTimeout(r, 100));
    const current = measurePaginationPlusPageCount(editor?.view.dom ?? null);
    if (current === last && current > 0) {
      stable += 1;
      if (stable >= 3) {
        break;
      }
    } else {
      stable = 0;
      last = current;
    }
  }
  // Extra paint for header/footer height recalculation.
  await new Promise((r) => setTimeout(r, 200));
  return snapshot();
}

async function loadFixture(id: FlowFixtureId, paper: FlowPaperId = "letter") {
  const fixture = FLOW_FIXTURES[id];
  if (!fixture) {
    throw new Error(`Unknown fixture: ${id}`);
  }
  activeFixture = id;
  activePaper = paper;
  void FLOW_PAPER_PRESETS[paper];
  createEditor(paper, fixture.doc);
  return waitForPagination(id === "stress-50-pages" ? 4000 : 2000);
}

window.__flowHarness = {
  ready: true,
  loadFixture,
  snapshot,
  insertNearStart(text: string) {
    if (!editor) {
      throw new Error("no editor");
    }
    editor.chain().focus("start").insertContent(text).run();
  },
  deleteNearStart(count: number) {
    if (!editor) {
      throw new Error("no editor");
    }
    const from = 1;
    const to = Math.min(1 + count, editor.state.doc.content.size);
    editor.chain().focus().deleteRange({ from, to }).run();
  },
  insertPageBreakAtEnd() {
    if (!editor) {
      throw new Error("no editor");
    }
    editor.chain().focus("end").insertContent({ type: "pageBreak" }).run();
  },
  undo() {
    editor?.commands.undo();
  },
  redo() {
    editor?.commands.redo();
  },
  reloadFromJson(raw: string) {
    if (!editor) {
      throw new Error("no editor");
    }
    editor.commands.setContent(parseFlowDoc(raw));
  },
  waitForPagination,
  fixtures: Object.keys(FLOW_FIXTURES) as FlowFixtureId[],
};
