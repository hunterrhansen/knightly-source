import { type Href, router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { findCard } from './node-card';
import { NodeDialog } from './node-dialog';
import { NodeView } from './node-view';
import { pathModel } from './path-model';
import { useTodayHome } from './today-foundation-screen';
import { useKeptNight } from './use-daily-review';

/** The `/node` route: the card for `?key=` or `?castle=`, presented as a
 * sheet by the path's stack (HomeStack). Its actions leave the sheet first. */
export function TodayNodeScreen() {
  const home = useTodayHome();
  const { key, castle } = useLocalSearchParams<{
    key?: string;
    castle?: string;
  }>();
  // A kept night's card lists its moves, asked for once it is open.
  const model = useMemo(
    () => pathModel(home.state, home.journey),
    [home.state, home.journey],
  );
  const open = findCard(model, { key, castle });
  const nightDate =
    open?.kind === 'node' && open.node.kind === 'kept'
      ? open.node.date
      : undefined;
  const night = useKeptNight(nightDate);
  const leave = (go: () => void) => {
    router.back();
    go();
  };
  // A card opened from a link has nothing behind it to go back to: home.
  const close = () =>
    router.canGoBack() ? router.back() : router.replace('/');
  return (
    <>
      {/* The same native ✕ as Account, top right over the sheet's clear
          header (node-sheet-options). */}
      {Platform.OS === 'ios' && (
        <Stack.Screen>
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="xmark"
              accessibilityLabel="Close"
              onPress={() => router.back()}
            />
          </Stack.Toolbar>
        </Stack.Screen>
      )}
      <NodeDialog onClose={close}>
        <NodeView
          onClose={close}
          cardKey={key}
          castle={castle}
          state={home.state}
          journey={home.journey}
          tonight={home.tonight}
          reminder={home.reminder}
          night={{ data: night.data, failed: !!night.error }}
          learnMore={{
            ...home.learnMore,
            onPress: () => leave(home.learnMore.onPress),
          }}
          actions={{
            ...home.actions,
            open: (href) => leave(() => router.push(href as Href)),
            connectGames: () => leave(home.actions.connectGames),
          }}
        />
      </NodeDialog>
    </>
  );
}
