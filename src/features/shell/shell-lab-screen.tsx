import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useFoundationStyles } from '../../ui';
import { AccountLayout, AccountSettingsPage } from '../account/account-api';
import {
  type TodayActions,
  TodayScreen,
  todaySamples,
} from '../today/today-api';
import { PreviewAccountToolbar } from './preview-account-toolbar';

export function ShellLabScreen() {
  const foundationStyles = useFoundationStyles();
  const router = useRouter();
  const { view, section, choice } = useLocalSearchParams<{
    view?: string;
    section?: string;
    choice?: string;
  }>();
  const [name, setName] = useState('Ready');
  const [destination, setDestination] = useState<string | null>(null);
  const actions: TodayActions = {
    open: (href) => setDestination(href),
    connectGames: () => setDestination('Connect games'),
    retry: () => setName('Ready'),
  };
  const alias = useRef<string | null>(null);
  useEffect(() => {
    if (
      Platform.OS !== 'ios' ||
      (view !== 'account' && view !== 'account-settings')
    ) {
      alias.current = null;
      return;
    }
    const key = `${view}:${section ?? ''}:${choice ?? ''}`;
    if (alias.current === key) return;
    alias.current = key;
    // Restore the lab in place before presenting; replacing it would lose its state.
    router.setParams({
      view: undefined,
      section: undefined,
      choice: undefined,
    });
    if (view === 'account') router.push('/account-preview');
    else
      router.push({
        pathname: '/account-settings-preview',
        params: { section, choice },
      });
  }, [view, section, choice, router]);
  if (
    Platform.OS === 'ios' &&
    (view === 'account' || view === 'account-settings')
  )
    return null;
  if (view === 'account-settings')
    return (
      <AccountSettingsPage
        preview
        section={section ?? 'appearance'}
        choice={choice}
        onOpenChoice={(choice) =>
          router.push({
            pathname: '/shell-lab',
            params: { view: 'account-settings', section: 'appearance', choice },
          })
        }
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace('/shell-lab?view=account')
        }
      />
    );
  if (view === 'account') {
    return (
      <AccountLayout
        preview
        accountName="Alex Morgan"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/shell-lab')
        }
        onOpenPrivacy={() => router.push('/privacy')}
        onOpenSettings={(section) =>
          router.push({
            pathname: '/shell-lab',
            params: { view: 'account-settings', section },
          })
        }
      />
    );
  }
  return (
    <>
      <PreviewAccountToolbar
        onOpenAccount={() =>
          Platform.OS === 'ios'
            ? router.push('/account-preview')
            : router.push({
                pathname: '/shell-lab',
                params: { view: 'account' },
              })
        }
      />
      {/* The one screen with sample data: the path, its top bar and the
          Games and Progress tiles; their links show here as a note. */}
      <View style={{ flex: 1 }}>
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={foundationStyles.quiet}>
            Shell demo — sample data, no learning progress saved
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Object.keys(todaySamples).map((key) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: key === name }}
                onPress={() => {
                  setDestination(null);
                  setName(key);
                }}
              >
                <Text style={foundationStyles.link}>{key}</Text>
              </Pressable>
            ))}
          </View>
          <Link href="/sign-in" asChild>
            <Text style={foundationStyles.link}>Back to connection setup</Text>
          </Link>
          {destination && (
            <View style={{ gap: 4 }}>
              <Text style={foundationStyles.label}>
                {`Opens ${destination}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDestination(null)}
              >
                <Text style={foundationStyles.link}>Dismiss</Text>
              </Pressable>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <TodayScreen
            state={
              todaySamples[name as keyof typeof todaySamples] ?? {
                kind: 'loading',
              }
            }
            actions={{
              ...actions,
              open: (href) =>
                href === '/account'
                  ? Platform.OS === 'ios'
                    ? router.push('/account-preview')
                    : router.push({
                        pathname: '/shell-lab',
                        params: { view: 'account' },
                      })
                  : actions.open(href),
            }}
            accountName="Alex Morgan"
          />
        </View>
      </View>
    </>
  );
}
