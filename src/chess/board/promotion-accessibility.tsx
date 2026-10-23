import { useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, View } from 'react-native';
import type { PromotionAccessibilityProps } from './promotion-accessibility.types';

export function PromotionAccessibility({
  children,
  firstControl,
  cancel,
  anchorRef,
  size,
}: PromotionAccessibilityProps) {
  const root = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number }>();
  // Measured once the modal itself has laid out: measuring the board as the
  // modal mounts can report the window origin and pin the stack to the corner.
  // Relative to the modal's own origin, so its window placement cannot offset it.
  const place = () =>
    anchorRef.current?.measureInWindow((x, y, width) =>
      root.current?.measureInWindow((rootX, rootY) => {
        if (width > 0) setAnchor({ x: x - rootX, y: y - rootY });
      }),
    );
  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}
      onShow={() => {
        place();
        if (firstControl.current)
          AccessibilityInfo.sendAccessibilityEvent(
            firstControl.current,
            'focus',
          );
      }}
    >
      <View
        ref={root}
        collapsable={false}
        style={{ flex: 1 }}
        accessible={false}
        onLayout={place}
      >
        <Pressable
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          accessible={false}
          onPress={cancel}
        />
        <View
          accessible={false}
          accessibilityViewIsModal
          accessibilityLabel="Choose promotion piece"
          onAccessibilityEscape={cancel}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: [
              { translateX: anchor?.x ?? 0 },
              { translateY: anchor?.y ?? 0 },
            ],
            width: size,
            height: size,
            // Hidden (not unmounted, so focus can land) for the frame before placing.
            opacity: anchor ? 1 : 0,
          }}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}
