import { getUserProfile, upsertUserProfile, saveMessage, getSession } from '@/lib/firestore';

// A reusable leaf mock doc that also supports a nested subcollection
const mockLeafDoc = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
};

// Mock the Firestore client
jest.mock('@google-cloud/firestore', () => {
  // Inner doc mock supports .collection() so subcollections work
  const makeDoc = () => {
    const doc: any = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    };
    // subcollection() returns an object whose doc() returns the same leaf mock
    doc.collection = jest.fn(() => ({
      doc: jest.fn(() => doc),
    }));
    return doc;
  };

  const sharedDoc = makeDoc();

  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => sharedDoc),
  }));

  return {
    Firestore: jest.fn(() => ({
      collection: mockCollection,
    })),
    FieldValue: {
      serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
      arrayUnion: jest.fn((...items: any[]) => ({ _arrayUnion: items })),
    },
  };
});

// Helper to reach the shared doc instance via the mock
function getSharedDoc() {
  const { Firestore } = require('@google-cloud/firestore');
  const instance = new Firestore();
  return instance.collection().doc();
}

describe('getUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when user does not exist', async () => {
    const doc = getSharedDoc();
    doc.get.mockResolvedValue({ exists: false });

    const result = await getUserProfile('user-123');
    expect(result).toBeNull();
  });

  it('returns profile when user exists', async () => {
    const doc = getSharedDoc();
    const mockProfile = { userId: 'user-123', email: 'test@test.com', facts: {} };
    doc.get.mockResolvedValue({ exists: true, data: () => mockProfile });

    const result = await getUserProfile('user-123');
    expect(result).toEqual(mockProfile);
  });
});

describe('upsertUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls set with merge option', async () => {
    const doc = getSharedDoc();
    doc.set.mockResolvedValue(undefined);

    await upsertUserProfile('user-123', { email: 'test@test.com', name: 'Test' });
    expect(doc.set).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@test.com' }),
      { merge: true }
    );
  });
});

describe('saveMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls set with initial message array when doc does not exist', async () => {
    const doc = getSharedDoc();
    doc.get.mockResolvedValue({ exists: false });
    doc.set.mockResolvedValue(undefined);

    const message = { role: 'user', content: 'hello', timestamp: 1000 };
    await saveMessage('user-123', 'session-abc', message as any);

    expect(doc.set).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-abc',
        messages: [message],
      })
    );
    expect(doc.update).not.toHaveBeenCalled();
  });

  it('calls update with arrayUnion when doc already exists', async () => {
    const { FieldValue } = require('@google-cloud/firestore');
    const doc = getSharedDoc();
    doc.get.mockResolvedValue({ exists: true });
    doc.update.mockResolvedValue(undefined);

    const message = { role: 'assistant', content: 'hi', timestamp: 2000 };
    await saveMessage('user-123', 'session-abc', message as any);

    expect(doc.update).toHaveBeenCalledWith({
      messages: FieldValue.arrayUnion(message),
    });
    expect(doc.set).not.toHaveBeenCalled();
  });
});
