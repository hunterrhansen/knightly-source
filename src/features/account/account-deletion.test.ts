import { createAccountDeletion } from './account-deletion';

test('retry after cancelled identity verification does not purge account data twice', async () => {
  const data = jest.fn().mockResolvedValue(undefined);
  const identity = jest
    .fn()
    .mockRejectedValueOnce(new Error('Verification cancelled'))
    .mockResolvedValue(undefined);
  const deletion = createAccountDeletion(data, identity, () => true);
  await expect(deletion.run()).rejects.toThrow('Verification cancelled');
  expect(deletion.dataDeleted).toBe(true);
  await deletion.run();
  expect(data).toHaveBeenCalledTimes(1);
  expect(identity).toHaveBeenCalledTimes(2);
});
test('duplicate confirmation and an account change cannot delete a second identity', async () => {
  let current = true;
  let finish!: () => void;
  const data = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const identity = jest.fn().mockResolvedValue(undefined);
  const deletion = createAccountDeletion(data, identity, () => current);
  const pending = deletion.run();
  await deletion.run();
  current = false;
  finish();
  await pending;
  await deletion.run();
  expect(data).toHaveBeenCalledTimes(1);
  expect(identity).not.toHaveBeenCalled();
});
test('a failed data purge never proceeds to identity deletion', async () => {
  const identity = jest.fn();
  const deletion = createAccountDeletion(
    async () => {
      throw new Error('Offline');
    },
    identity,
    () => true,
  );
  await expect(deletion.run()).rejects.toThrow('Offline');
  expect(identity).not.toHaveBeenCalled();
  expect(deletion.dataDeleted).toBe(false);
});

test('cancelling identity preparation preserves backend data', async () => {
  const data = jest.fn();
  const identity = jest.fn();
  const deletion = createAccountDeletion(
    data,
    identity,
    () => true,
    async () => {
      throw new Error('Verification cancelled');
    },
  );
  await expect(deletion.run()).rejects.toThrow('Verification cancelled');
  expect(data).not.toHaveBeenCalled();
  expect(identity).not.toHaveBeenCalled();
  expect(deletion.dataDeleted).toBe(false);
});
test('account replacement during identity preparation prevents data deletion', async () => {
  let current = true;
  let finish!: () => void;
  const data = jest.fn();
  const identity = jest.fn();
  const deletion = createAccountDeletion(
    data,
    identity,
    () => current,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = deletion.run();
  current = false;
  finish();
  await pending;
  expect(data).not.toHaveBeenCalled();
  expect(identity).not.toHaveBeenCalled();
});
