import { Link, type Href as RouterHref, usePathname } from 'expo-router';
import { type PropsWithChildren, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import {
  SafeAreaView as NativeSafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFoundation } from '../../lib/auth/auth-provider';
import { createStyles, useTheme } from '../../theme/theme';
import {
  Avatar,
  BrandMark,
  KnightlyGlyph,
  type KnightlyGlyphName,
} from '../../ui';

type SyncTone = 'ok' | 'running' | 'partial' | 'failed' | 'idle';

import { availableDestinations } from './destinations';

type Href = '/' | '/games' | '/progress' | '/account-settings';
const glyphs: Record<string, KnightlyGlyphName> = {
  today: 'today',
  games: 'games',
  progress: 'progress',
  settings: 'settings',
};
/**
 * Web shell, matching the original Knightly web app: from 768 px a sidebar with the brand,
 * the destinations and Settings, then the account row at the bottom with the daily
 * update's state. Narrower: a brand header and bottom tabs.
 */
export function AppShell({
  children,
  preview = false,
  nativeHeader = false,
  onPreviewNavigate,
  syncStatus,
  basePath = '',
}: PropsWithChildren<{
  preview?: boolean;
  /** Prefix for the isolated navigation preview; production uses the root URLs. */
  basePath?: string;
  nativeHeader?: boolean;
  onPreviewNavigate?: (path: string) => void;
  /** The account row's status line; without it the row reads "Account & privacy". */
  syncStatus?: { tone: SyncTone; label: string };
}>) {
  const styles = useStyles();
  const account = useFoundation();
  const accountName = preview
    ? 'Alex Morgan'
    : (account.account ?? 'Your account');
  const accountDetail =
    syncStatus?.label ?? (preview ? 'Demo account' : 'Account & privacy');
  const wide = useWindowDimensions().width >= 768;
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const { theme } = useTheme();
  const toneColor: Record<SyncTone, string> = {
    ok: theme.colors.brand,
    running: theme.colors.sky,
    partial: theme.colors.gold,
    failed: theme.colors.dangerText,
    idle: theme.colors.line,
  };
  const [focusedItem, setFocusedItem] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  // Link styles live on an inner View: Expo Router's <Link asChild> Slot drops style
  // functions and rejects style arrays on web, which left every sidebar link unstyled.
  const [pressedItem, setPressedItem] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState('/');
  const routed = !preview || !!basePath;
  const activePath = routed ? path.slice(basePath.length) || '/' : previewPath;
  function selected(href: string) {
    if (href === '/') return activePath === '/' || activePath === '/practice';
    if (href === '/games')
      return (
        activePath === '/games' ||
        activePath === '/connect-games' ||
        activePath.startsWith('/review/') ||
        activePath.startsWith('/games/')
      );
    return activePath === href || activePath.startsWith(`${href}/`);
  }
  function interaction(id: string) {
    return {
      onFocus: () => setFocusedItem(id),
      onBlur: () => setFocusedItem(null),
      onHoverIn: () => setHoveredItem(id),
      onHoverOut: () => setHoveredItem(null),
      onPressIn: () => setPressedItem(id),
      onPressOut: () => setPressedItem(null),
    };
  }
  function item(id: string, label: string, href: Href, mobile = false) {
    const active = selected(href);
    const hovered = hoveredItem === id && !active;
    const pressed = pressedItem === id;
    const control = (
      <Pressable
        accessibilityRole={routed ? 'link' : 'button'}
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={
          !routed
            ? () => {
                setPreviewPath(href);
                onPreviewNavigate?.(href);
              }
            : undefined
        }
        {...interaction(id)}
      >
        <View
          style={[
            styles.item,
            mobile && styles.tab,
            (hovered || (pressed && !active)) && styles.hovered,
            active && (mobile ? styles.selectedTab : styles.selected),
            focusedItem === id && styles.focused,
          ]}
        >
          <KnightlyGlyph name={glyphs[id] ?? 'today'} size={mobile ? 30 : 32} />
          <Text
            style={[
              styles.label,
              mobile && styles.tabLabel,
              (active || hovered) && styles.activeLabel,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    );
    return !routed ? (
      <View key={id} style={mobile && styles.tabSlot}>
        {control}
      </View>
    ) : (
      <Link
        key={id}
        href={
          (basePath
            ? href === '/account-settings'
              ? '/account-settings-preview'
              : `${basePath}${href === '/' ? '' : href}`
            : href) as RouterHref
        }
        asChild
        style={mobile && styles.tabSlot}
      >
        {control}
      </Link>
    );
  }
  const compactAccount = !wide;
  const accountControl = (
    <Pressable
      accessibilityRole={preview ? 'button' : 'link'}
      accessibilityLabel={`${accountName}. ${accountDetail}`}
      onPress={
        preview
          ? () => {
              onPreviewNavigate?.('/account');
            }
          : undefined
      }
      {...interaction('account')}
    >
      <View
        style={[
          styles.accountRow,
          compactAccount && styles.avatarTarget,
          !compactAccount &&
            (pressedItem === 'account' || hoveredItem === 'account') &&
            styles.hovered,
          !compactAccount && focusedItem === 'account' && styles.focused,
        ]}
      >
        <Avatar
          name={accountName}
          size={wide ? 40 : 34}
          focused={compactAccount && focusedItem === 'account'}
          pressed={compactAccount && pressedItem === 'account'}
        />
        {wide && (
          <View style={styles.accountText}>
            <Text numberOfLines={1} style={styles.accountName}>
              {accountName}
            </Text>
            <View style={styles.statusLine}>
              {syncStatus && (
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: toneColor[syncStatus.tone] },
                  ]}
                />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.accountDetail,
                  syncStatus?.tone === 'failed' && styles.failedDetail,
                ]}
              >
                {accountDetail}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
  const accountLink = preview ? (
    accountControl
  ) : (
    <Link href="/account" push asChild>
      {accountControl}
    </Link>
  );
  const destinations = availableDestinations();
  return (
    <NativeSafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.page }}
      edges={wide ? undefined : ['top', 'left', 'right']}
    >
      <View style={wide ? styles.wide : styles.narrow}>
        {(!nativeHeader || wide) && (
          <View style={wide ? styles.sidebar : styles.header}>
            <View style={wide ? styles.brand : styles.headerBrand}>
              <BrandMark size={wide ? 32 : 28} />
              <Text style={[styles.wordmark, !wide && styles.headerWordmark]}>
                Knightly
              </Text>
            </View>
            {wide ? (
              <>
                <View
                  role="navigation"
                  aria-label="Main"
                  style={styles.navigation}
                >
                  {destinations.map((d) => item(d.id, d.label, d.href))}
                  {item('settings', 'Settings', '/account-settings')}
                </View>
                <View style={styles.accountFooter}>{accountLink}</View>
              </>
            ) : (
              accountLink
            )}
          </View>
        )}
        <View style={styles.content}>{children}</View>
        {!wide && (
          <View
            role="navigation"
            accessibilityLabel="Main navigation"
            style={[
              styles.tabs,
              { paddingBottom: Math.max(10, insets.bottom) },
            ]}
          >
            {destinations.map((d) => item(d.id, d.label, d.href, true))}
          </View>
        )}
      </View>
    </NativeSafeAreaView>
  );
}
const useStyles = createStyles((theme) => ({
  wide: { flex: 1, flexDirection: 'row' },
  narrow: { flex: 1 },
  content: { flex: 1, minWidth: 0 },
  sidebar: {
    width: 240,
    borderRightWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  brand: {
    height: 80,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: theme.typography.heading,
    fontSize: 24,
    letterSpacing: -0.3,
    color: theme.colors.brandText,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerWordmark: { fontSize: 20, letterSpacing: 0 },
  navigation: { gap: 6, paddingHorizontal: 10, paddingTop: 8 },
  item: {
    minHeight: 52,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 14,
  },
  hovered: { backgroundColor: theme.colors.surfaceMuted },
  selected: {
    borderColor: theme.colors.sky,
    backgroundColor: `${theme.colors.sky}1f`,
  },
  selectedTab: {
    borderColor: theme.colors.sky,
    backgroundColor: `${theme.colors.sky}24`,
  },
  focused: {
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: theme.colors.focus,
    outlineOffset: 2,
  },
  label: {
    color: theme.colors.inkMuted,
    fontFamily: theme.typography.bold,
    fontSize: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  activeLabel: { color: theme.colors.ink },
  accountFooter: {
    marginTop: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopWidth: 2,
    borderColor: theme.colors.line,
  },
  accountRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
  },
  avatarTarget: {
    minHeight: 48,
    width: 48,
    padding: 4,
    borderRadius: 24,
    justifyContent: 'center',
  },
  accountText: { flex: 1, minWidth: 0, gap: 2 },
  accountName: {
    fontFamily: theme.typography.bold,
    fontSize: 15,
    color: theme.colors.ink,
  },
  accountDetail: {
    flexShrink: 1,
    fontFamily: theme.typography.body,
    fontSize: 12,
    color: theme.colors.inkMuted,
  },
  failedDetail: { color: theme.colors.dangerText },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tabs: {
    paddingTop: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 4,
    borderTopWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  tabSlot: { flex: 1, minWidth: 0 },
  tab: {
    minHeight: 0,
    flexDirection: 'column',
    gap: 2,
    paddingHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tabLabel: { fontSize: 11, letterSpacing: 0.55, textAlign: 'center' },
}));
