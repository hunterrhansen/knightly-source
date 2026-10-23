const mockShare = jest.fn();
const mockDelete = jest.fn();
const mockWrite = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'private-cache' },
  File: class {
    uri = 'file:///private-cache/export.zip';
    exists = true;
    create() {}
    write(value: Uint8Array) {
      mockWrite(value);
    }
    delete() {
      mockDelete();
    }
  },
}));
jest.mock('./identity-verification', () => ({ useDeleteIdentity: jest.fn() }));

import { saveExport } from './user-data';

beforeEach(() => {
  jest.clearAllMocks();
  mockShare.mockResolvedValue(undefined);
  global.FileReader = class {
    result = new Uint8Array([80, 75]).buffer;
    onload?: () => void;
    readAsArrayBuffer() {
      this.onload?.();
    }
  } as unknown as typeof FileReader;
});

test('export shares a ZIP and removes its private temporary file afterward', async () => {
  await saveExport(new Blob());
  expect(mockWrite).toHaveBeenCalledWith(new Uint8Array([80, 75]));
  expect(mockShare).toHaveBeenCalledWith(
    'file:///private-cache/export.zip',
    expect.objectContaining({ mimeType: 'application/zip' }),
  );
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

test('a failed share still removes the private export archive', async () => {
  mockShare.mockRejectedValue(new Error('Sharing failed'));
  await expect(saveExport(new Blob())).rejects.toThrow('Sharing failed');
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

test('an account change while reading prevents file creation and sharing', async () => {
  let current = true;
  global.FileReader = class {
    result = new Uint8Array([80, 75]).buffer;
    onload?: () => void;
    readAsArrayBuffer() {
      current = false;
      this.onload?.();
    }
  } as unknown as typeof FileReader;
  await saveExport(new Blob(), () => current);
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockShare).not.toHaveBeenCalled();
});
