/**
 * Type definitions for @abhinav2203/codeflow-prd
 * PRD processing and requirements management
 */

export interface PRDDocument {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'processing' | 'complete' | 'archived';
  sections: PRDSection[];
  createdAt: number;
  updatedAt: number;
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
  };
}

export interface PRDSection {
  id: string;
  type: 'goal' | 'requirement' | 'constraint' | 'stakeholder' | 'background' | 'success-metric';
  content: string;
  priority?: 'high' | 'medium' | 'low';
  metadata?: Record<string, any>;
}

export interface Requirement {
  id: string;
  description: string;
  status: 'open' | 'in_progress' | 'fulfilled' | 'deferred' | 'blocked';
  relatedSections: string[];
  acceptanceCriteria?: string[];
  priority?: 'high' | 'medium' | 'low';
  effort?: 'small' | 'medium' | 'large';
}

export interface PRDProcessor {
  initialize(): Promise<void>;
  createDocument(title: string, content: string): PRDDocument;
  processDocument(docId: string): Promise<PRDDocument>;
  getDocument(docId: string): PRDDocument | undefined;
  getCurrentDocument(): PRDDocument | undefined;
  listDocuments(): PRDDocument[];
  extractRequirements(docId: string): Requirement[];
  updateRequirement(reqId: string, updates: Partial<Requirement>): void;
  archiveDocument(docId: string): void;
}

export interface PRDParseOptions {
  includeExamples?: boolean;
  extractMetadata?: boolean;
  normalizeLineEndings?: boolean;
}

export interface RequirementLink {
  requirementId: string;
  sectionId: string;
  type: 'satisfies' | 'conflicts' | 'relates-to';
}