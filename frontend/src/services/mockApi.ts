export interface Citation {
  id: string;
  documentName: string;
  pageNumber?: number;
  relevanceScore: number;
  snippet: string;
}

const MOCK_CITATIONS: Citation[] = [
{
  id: 'c1',
  documentName: 'Q3_Financial_Report.pdf',
  pageNumber: 12,
  relevanceScore: 0.95,
  snippet:
  'Revenue increased by 15% year-over-year, driven primarily by enterprise software sales and cloud infrastructure adoption.'
},
{
  id: 'c2',
  documentName: 'Employee_Handbook_2023.pdf',
  pageNumber: 45,
  relevanceScore: 0.88,
  snippet:
  'Employees are entitled to 20 days of paid time off (PTO) per calendar year, accruing at a rate of 1.66 days per month.'
},
{
  id: 'c3',
  documentName: 'API_Documentation_v2.md',
  relevanceScore: 0.92,
  snippet:
  'The /v2/users endpoint requires a Bearer token in the Authorization header. Rate limits are set to 1000 requests per minute per IP.'
}];


const MOCK_RESPONSES = [
"I can certainly help you with that. Based on the documentation, you'll need to update your configuration settings first.",
"That's a great question. Let me check the latest guidelines for you. It appears the policy was updated recently.",
"I've analyzed the files you provided. The main issue seems to be a mismatch in the expected data format. You should ensure it's in JSON.",
'Here is the summary of the information you requested. Let me know if you need any further clarification or details.',
"I'm sorry, but I couldn't find an exact match for that query in the current knowledge base. Could you provide more context?"];


export const mockApi = {
  streamResponse: (
  prompt: string,
  onChunk: (text: string) => void,
  onComplete: (citations?: Citation[]) => void,
  onError: (error: Error) => void) =>
  {
    // Simulate network error randomly (5% chance)
    if (Math.random() < 0.05) {
      setTimeout(
        () =>
        onError(new Error('Network error: Failed to connect to AI service.')),
        1000
      );
      return;
    }

    const responseText =
    MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    const words = responseText.split(' ');
    let currentIndex = 0;

    // Initial delay to simulate "thinking"
    setTimeout(() => {
      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          onChunk(words.slice(0, currentIndex + 1).join(' '));
          currentIndex++;
        } else {
          clearInterval(interval);
          // 40% chance to include citations
          const includeCitations = Math.random() < 0.4;
          const citations = includeCitations ?
          [
          MOCK_CITATIONS[
          Math.floor(Math.random() * MOCK_CITATIONS.length)]] :


          undefined;
          onComplete(citations);
        }
      }, 100); // 100ms per word
    }, 600);
  },

  uploadFile: (
  file: File,
  onProgress: (progress: number) => void)
  : Promise<string> => {
    return new Promise((resolve, reject) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 20) + 10;
        if (progress >= 100) {
          progress = 100;
          onProgress(progress);
          clearInterval(interval);
          resolve(`mock-url-${file.name}`);
        } else {
          onProgress(progress);
        }
      }, 300);
    });
  }
};