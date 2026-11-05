import { Slot, useRouter } from 'expo-router';
import { AppShell } from './app-shell';

export function MainLayout({ preview = false }: { preview?: boolean }) {
  const router = useRouter();
  return (
    <AppShell
      preview={preview}
      basePath={preview ? '/navigation-preview' : ''}
      onPreviewNavigate={() => router.push('/account-preview')}
    >
      <Slot />
    </AppShell>
  );
}
