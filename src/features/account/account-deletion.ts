/** Retry a failed identity deletion without repeating the acknowledged data purge. */
export function createAccountDeletion(
  deleteData: () => Promise<void>,
  deleteIdentity: () => Promise<void>,
  isCurrent: () => boolean,
  prepareIdentity?: () => Promise<void>,
) {
  let dataDeleted = false;
  let running = false;
  return {
    get dataDeleted() {
      return dataDeleted;
    },
    async run() {
      if (running || !isCurrent()) return;
      running = true;
      try {
        if (prepareIdentity) await prepareIdentity();
        if (!isCurrent()) return;
        if (!dataDeleted) {
          await deleteData();
          dataDeleted = true;
        }
        if (!isCurrent()) return;
        await deleteIdentity();
      } finally {
        running = false;
      }
    },
  };
}
