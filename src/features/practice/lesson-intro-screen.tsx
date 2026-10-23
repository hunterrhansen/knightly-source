import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useSessionScope } from '../../lib/auth/session-boundary';
import { useSystemReducedMotion } from '../../theme/use-reduced-motion';
import {
  ActionBar,
  ActionButton,
  CoachBubble,
  LessonFrame,
  LessonHeader,
  Screen,
  useWallView,
} from '../../ui';
import { useLessonIntro } from './lesson-intro';

/** `/lesson-intro?key=`: a lesson's intro replayed from its post's card, in
 * the watch's frame; finishing or skipping it goes back. */
export function LessonIntroScreen() {
  const { key = '' } = useLocalSearchParams<{ key?: string }>();
  const { scope } = useSessionScope();
  const wallView = useWallView('scene.wallView');
  const reduced = useSystemReducedMotion();
  const intro = useQuery({
    queryKey: [...scope.meKey, 'lesson-intro', key],
    queryFn: ({ signal }) => scope.api.lessonIntro(key, signal),
    enabled: key.length > 0,
  });
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  const onFinish = useCallback(
    (lesson: string) => {
      void scope.api.lessonIntroduced(lesson).catch(() => {});
      close();
    },
    [scope, close],
  );
  const view = useLessonIntro(intro.data, onFinish, reduced);
  const failed = intro.isError || (intro.isSuccess && !view);
  return (
    <Screen preset="fixed" style={{ backgroundColor: wallView.far.sky[0] }}>
      <LessonFrame
        watch
        bars={
          <LessonHeader
            title={intro.data?.name ?? 'Lesson'}
            onClose={close}
            closeLabel="Close the lesson’s intro"
          />
        }
        coach={
          <CoachBubble
            title={view?.title ?? (failed ? 'No intro yet' : 'Loading…')}
            body={
              view?.body ??
              (failed
                ? 'This lesson has nothing to show yet. Its positions come in the watch.'
                : '')
            }
            tone={view?.tone ?? 'plain'}
            lines={2}
          />
        }
        board={view?.board}
        orientation={view?.board.orientation ?? 'w'}
        reserve={0}
        actions={
          <ActionBar>
            {view ? (
              view.actions.map((a) => (
                <ActionButton
                  key={a.label}
                  icon={a.icon}
                  label={a.label}
                  primary={a.primary}
                  disabled={a.disabled}
                  onPress={a.onPress}
                />
              ))
            ) : (
              <ActionButton icon="forward" label="Close" onPress={close} />
            )}
          </ActionBar>
        }
      />
    </Screen>
  );
}
