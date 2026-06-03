/**
 * codeflow-prd wrapper
 * PRD processing and requirements management
 */
import type {
  PRDDocument,
  PRDSection,
  Requirement,
  PRDProcessor,
  PRDParseOptions,
} from '@/types/codeflow-prd';

// Re-export types
export type { PRDDocument, PRDSection, Requirement, PRDParseOptions };

class PRDProcessorImpl implements PRDProcessor {
  private documents: Map<string, PRDDocument> = new Map();
  private currentDoc: string | null = null;

  async initialize(): Promise<void> {
    console.log('[codeflow-prd] PRD processor initialized');
  }

  createDocument(title: string, content: string): PRDDocument {
    const doc: PRDDocument = {
      id: `prd-${Date.now()}`,
      title,
      content,
      status: 'draft',
      sections: this.parseContent(content),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.documents.set(doc.id, doc);
    this.currentDoc = doc.id;
    return doc;
  }

  private parseContent(content: string): PRDSection[] {
    const sections: PRDSection[] = [];
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (line.startsWith('## ')) {
        sections.push({
          id: `section-${i}`,
          type: 'goal',
          content: line.replace('## ', '').trim(),
        });
      } else if (line.startsWith('### ')) {
        sections.push({
          id: `section-${i}`,
          type: 'requirement',
          content: line.replace('### ', '').trim(),
          priority: 'medium',
        });
      } else if (line.startsWith('- ')) {
        const prevSection = sections[sections.length - 1];
        if (prevSection) {
          // Extend previous section
          prevSection.content += '\n' + line.replace('- ', '').trim();
        }
      }
    });

    return sections;
  }

  async processDocument(docId: string): Promise<PRDDocument> {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document not found: ${docId}`);
    }

    doc.status = 'processing';
    doc.updatedAt = Date.now();

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    doc.status = 'complete';
    doc.updatedAt = Date.now();

    return doc;
  }

  getDocument(docId: string): PRDDocument | undefined {
    return this.documents.get(docId);
  }

  getCurrentDocument(): PRDDocument | undefined {
    return this.currentDoc ? this.documents.get(this.currentDoc) : undefined;
  }

  listDocuments(): PRDDocument[] {
    return Array.from(this.documents.values());
  }

  extractRequirements(docId: string): Requirement[] {
    const doc = this.documents.get(docId);
    if (!doc) return [];

    return doc.sections
      .filter((s) => s.type === 'requirement')
      .map((s, i) => ({
        id: `req-${docId}-${i}`,
        description: s.content,
        status: 'open' as const,
        relatedSections: [s.id],
        priority: s.priority,
      }));
  }

  updateRequirement(_reqId: string, _updates: Partial<Requirement>): void {
    // Implementation for updating requirements
  }

  archiveDocument(docId: string): void {
    const doc = this.documents.get(docId);
    if (doc) {
      doc.status = 'archived';
      doc.updatedAt = Date.now();
    }
  }
}

// Singleton
let prd: PRDProcessor | null = null;

export function getPRDProcessor(): PRDProcessor {
  if (!prd) {
    prd = new PRDProcessorImpl();
  }
  return prd;
}

// React hook for PRD
export function usePRD() {
  const processor = getPRDProcessor();

  return {
    documents: processor.listDocuments(),
    currentDocument: processor.getCurrentDocument(),
    createDocument: (title: string, content: string) => processor.createDocument(title, content),
    processDocument: (docId: string) => processor.processDocument(docId),
    getDocument: (docId: string) => processor.getDocument(docId),
    extractRequirements: (docId: string) => processor.extractRequirements(docId),
  };
}