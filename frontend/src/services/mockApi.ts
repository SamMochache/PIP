/**
 * mockApi.ts
 * ==========
 * The Citation type is kept here because CitationCard imports it from this path.
 * The uploadFile function now calls the real backend instead of simulating.
 */

import { documentApi } from "./api";

export interface Citation {
  id: string;
  documentName: string;
  pageNumber?: number;
  relevanceScore: number; // 0–1, higher = more relevant
  snippet: string;
}

export const mockApi = {
  /**
   * Upload a file to the backend document ingestion endpoint.
   * Returns the document URL/identifier on success.
   */
  uploadFile: async (
    file: File,
    onProgress: (progress: number) => void
  ): Promise<string> => {
    const result = await documentApi.upload(file, onProgress);
    // Return the document title as the "URL" identifier shown in the message
    return result.document.title;
  },
};
