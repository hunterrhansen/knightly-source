import { Body, Page } from '../../ui';
/** Development-only sample tab content for the native navigation preview. */
export function NavigationPreviewScreen({ title }: { title: string }) {
  return (
    <Page title={title}>
      <Body>
        Navigation preview — sample screen. No account data is loaded or saved.
      </Body>
    </Page>
  );
}
