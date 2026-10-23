import {
  type Href,
  useFocusEffect,
  useNavigation,
  useRouter,
} from 'expo-router';
import { useCallback } from 'react';

export type ModalStackProps = {
  /** What the modal is, for its close button ("Close Games"). */
  label: string;
  /** Screens that draw their own header (a game's review). */
  bare?: readonly string[];
};

/** Closes the modal the caller is in: the root stack goes back to the path,
 * or, opened by a link with nothing under it, replaces it with the path. */
export function useCloseModal() {
  const root = useNavigation('/');
  const router = useRouter();
  return () => {
    if (root.canGoBack()) root.goBack();
    else router.replace('/');
  };
}

/** Leaves the modal for a route outside it (a lesson, another modal): closes
 * it first so the route opens over the path, never inside the sheet. */
export function useLeaveModal() {
  const close = useCloseModal();
  const router = useRouter();
  return (href: Href) => {
    close();
    router.push(href);
  };
}

/** While the calling screen is focused, the modal it is in cannot be swiped
 * down (a board's drags stay the board's); its ✕ or Back still closes it. */
export function useLockModalDismiss() {
  const navigation = useNavigation();
  useFocusEffect(
    useCallback(() => {
      const modal = navigation.getParent();
      modal?.setOptions({ gestureEnabled: false });
      return () => modal?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );
}
