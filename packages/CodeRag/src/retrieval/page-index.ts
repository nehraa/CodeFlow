import path from "node:path";

import type { GraphSnapshot, IndexedNodeDocument, RetrievedNodeContext } from "../types.js";
import { FileCache } from "../store/file-cache.js";
import { uniqueNumbers } from "../utils/text.js";

const edgeKeyFor = (fromNodeId: string, toNodeId: string): string => `calls:${fromNodeId}:${toNodeId}`;

export const createRetrievedNodeContext = async (
  repoPath: string,
  fileCache: FileCache,
  snapshot: GraphSnapshot,
  document: IndexedNodeDocument,
  relationship: RetrievedNodeContext["relationship"],
  sourceNodeId?: string
): Promise<RetrievedNodeContext> => {
  const fullFileContent = await fileCache.read(path.join(repoPath, document.filePath));

  let callSiteLines: number[] = [];
  if (sourceNodeId && relationship === "calls") {
    callSiteLines = snapshot.callSites[edgeKeyFor(sourceNodeId, document.nodeId)]?.lineNumbers ?? [];
  }

  if (sourceNodeId && relationship === "called-by") {
    callSiteLines = snapshot.callSites[edgeKeyFor(document.nodeId, sourceNodeId)]?.lineNumbers ?? [];
  }

  return {
    nodeId: document.nodeId,
    name: document.name,
    kind: document.kind,
    filePath: document.filePath,
    fullFileContent,
    startLine: document.startLine,
    endLine: document.endLine,
    callSiteLines: uniqueNumbers(callSiteLines),
    doc: document.doc,
    relationship
  };
};
