import { Link } from 'expo-router';
import { Text } from 'react-native';
import { useFoundation } from '../../lib/auth/auth-provider';
import { Body, Page, useFoundationStyles } from '../../ui';

const sources = [
  {
    label: 'GNU General Public License v3',
    url: 'https://www.gnu.org/licenses/gpl-3.0.html',
  },
  {
    label: 'Stockfish.js 19 source',
    url: 'https://github.com/nmrugg/stockfish.js/tree/v19.0.1',
  },
  {
    label: 'Stockfish source',
    url: 'https://github.com/official-stockfish/Stockfish',
  },
] as const;

export function PrivacyScreen({ inAccount = false }: { inAccount?: boolean }) {
  const foundationStyles = useFoundationStyles();
  const { contact } = useFoundation();
  return (
    <Page safeArea title="Privacy and licences">
      <Body>
        This development foundation uses Clerk for account sign-in and the
        Knightly backend for account capabilities. Connected Chess.com and
        Lichess accounts supply public games for import and analysis. The
        backend stores your practice and review progress.
      </Body>
      {contact && <Body>Questions: {contact}</Body>}
      <Body>
        Full product privacy information will be finalized before public
        release.
      </Body>
      {/* GPL-3.0 §4–6: the notice, no-warranty and the corresponding source. */}
      <Body>
        Game review evaluates the side lines you play with Stockfish.js 19 Lite,
        which runs on your device. Stockfish is by T. Romstad, M. Costalba, J.
        Kiiski, G. Linscott and other contributors; Stockfish.js is published by
        Chess.com, LLC. It is free software under the GNU General Public
        License, version 3: you may share and change it under that licence, and
        it comes with no warranty.
      </Body>
      {sources.map(({ label, url }) => (
        <Link key={url} href={url} asChild>
          <Text style={foundationStyles.link}>{label}</Text>
        </Link>
      ))}
      {!inAccount && (
        <Link href="/" asChild>
          <Text style={foundationStyles.link}>Return to Knightly</Text>
        </Link>
      )}
    </Page>
  );
}
