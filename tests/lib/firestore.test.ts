import { getUserProfile, upsertUserProfile, saveMessage, getSession } from '@/lib/firestore';

// Mock the Firestore client
jest.mock('@google-cloud/firestore', () => {
  const mockDoc = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
  };
  const mockCollection = jest.fn(() => ({
    doc: jest.fn(() => mockDoc),
  }));
  return {
    Firestore: jest.fn(() => ({
      collection: mockCollection,
    })),
    FieldValue: {
      serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
    },
  };
});

describe('getUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when user does not exist', async () => {
    const { Firestore } = require('@google-cloud/firestore');
    const instance = new Firestore();
    instance.collection().doc().get.mockResolvedValue({ exists: false });

    const result = await getUserProfile('user-123');
    expect(result).toBeNull();
  });

  it('returns profile when user exists', async () => {
    const { Firestore } = require('@google-cloud/firestore');
    const instance = new Firestore();
    const mockProfile = { userId: 'user-123', email: 'test@test.com', facts: {} };
    instance.collection().doc().get.mockResolvedValue({
      exists: true,
      data: () => mockProfile,
    });

    const result = await getUserProfile('user-123');
    expect(result).toEqual(mockProfile);
  });
});

describe('upsertUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls set with merge option', async () => {
    const { Firestore } = require('@google-cloud/firestore');
    const instance = new Firestore();
    instance.collection().doc().set.mockResolvedValue(undefined);

    await upsertUserProfile('user-123', { email: 'test@test.com', name: 'Test' });
    expect(instance.collection().doc().set).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@test.com' }),
      { merge: true }
    );
  });
});
