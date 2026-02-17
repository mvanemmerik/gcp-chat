import { buildSystemPromptWithMemory } from '@/lib/gemini';

// Mock VertexAI to prevent real initialization during import
jest.mock('@google-cloud/vertexai', () => ({
  VertexAI: jest.fn(() => ({
    getGenerativeModel: jest.fn(),
  })),
}));

describe('buildSystemPromptWithMemory', () => {
  it('returns base system prompt when no facts', () => {
    const result = buildSystemPromptWithMemory({});
    expect(result).toContain('expert Google Cloud Platform');
    expect(result).not.toContain('What you know');
  });

  it('appends facts to system prompt', () => {
    const result = buildSystemPromptWithMemory({
      gcpProject: 'my-project-123',
      preferredRegion: 'us-east1',
    });
    expect(result).toContain('What you know about the user');
    expect(result).toContain('my-project-123');
    expect(result).toContain('us-east1');
  });
});
