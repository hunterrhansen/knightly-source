import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { darkTheme } from '../theme/themes';

// Knightly is dark only: the page, scrollbars and form controls stay dark
// whatever the browser's colour scheme, before and after the app renders.
// Scrollbars show only a dim thumb, no light rail beside dark panels.
const pageStyle = `html, body { background-color: ${darkTheme.colors.page}; color-scheme: dark; }
* { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent; }`;

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta name="theme-color" content={darkTheme.colors.page} />
        <ScrollViewStyleReset />
        <style>{pageStyle}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
