const mockGenerateContent = jest.fn();

jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

import { extractFacts } from '@/lib/gemini';

describe('extractFacts', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('returns empty object when model returns empty json', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { candidates: [{ content: { parts: [{ text: '{}' }] } }] },
    });
    const result = await extractFacts('hello', 'hi there', {});
    expect(result).toEqual({});
  });

  it('returns parsed facts from model output', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { candidates: [{ content: { parts: [{ text: '{"gcpProject": "my-proj"}' }] } }] },
    });
    const result = await extractFacts('my project is my-proj', 'Got it!', {});
    expect(result).toEqual({ gcpProject: 'my-proj' });
  });

  it('handles malformed JSON gracefully', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { candidates: [{ content: { parts: [{ text: 'not valid json' }] } }] },
    });
    const result = await extractFacts('msg', 'reply', {});
    expect(result).toEqual({});
  });

  it('strips markdown code blocks from model output', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { candidates: [{ content: { parts: [{ text: '```json\n{"key": "value"}\n```' }] } }] },
    });
    const result = await extractFacts('msg', 'reply', {});
    expect(result).toEqual({ key: 'value' });
  });
});
