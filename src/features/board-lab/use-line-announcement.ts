import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// Android/web use the visible live region; iOS needs an explicit queued announcement.
export function useLineAnnouncement(message: string) {
  const last = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (Platform.OS !== 'ios' || last.current === message) return;
    last.current = message;
    AccessibilityInfo.announceForAccessibilityWithOptions(message, {
      queue: true,
    });
  }, [message]);
}
