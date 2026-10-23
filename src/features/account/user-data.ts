import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export { useDeleteIdentity } from './identity-verification';
export const canExport = true;
function bytes(data: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error('Could not read your export archive.'));
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(new Uint8Array(reader.result))
        : reject(new Error('Invalid export archive.'));
    reader.readAsArrayBuffer(data);
  });
}
export async function saveExport(
  data: Blob,
  isCurrent: () => boolean = () => true,
) {
  if (!isCurrent()) return;
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is unavailable on this device.');
  const contents = await bytes(data);
  if (!isCurrent()) return;
  const file = new File(
    Paths.cache,
    `knightly-export-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`,
  );
  try {
    file.create();
    file.write(contents);
    if (!isCurrent()) return;
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/zip',
      UTI: 'public.zip-archive',
      dialogTitle: 'Export Knightly data',
    });
  } finally {
    if (file.exists) file.delete();
  }
}
