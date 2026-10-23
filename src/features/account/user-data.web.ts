export { useDeleteIdentity } from './identity-verification';
export const canExport = true;
export async function saveExport(
  data: Blob,
  isCurrent: () => boolean = () => true,
) {
  if (!isCurrent()) return;
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'knightly-export.zip';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
