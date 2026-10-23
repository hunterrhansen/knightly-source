import {
  TextInput,
  type TextInputProps,
  type TextInputRef,
  useNativeState,
} from '@expo/ui';
import { forwardRef, useEffect } from 'react';

type ControlledTextInputProps = Omit<TextInputProps, 'value' | 'ref'> & {
  value: string;
};

/** Keep feature-owned strings synchronized with Expo UI's native observable state. */
export const ControlledTextInput = forwardRef<
  TextInputRef,
  ControlledTextInputProps
>(function ControlledTextInput(
  {
    value,
    onChangeText,
    onSubmitEditing,
    editable = true,
    readOnly = false,
    ...props
  },
  ref,
) {
  const text = useNativeState(value);
  useEffect(() => {
    text.value = value;
  }, [text, value]);
  const enabled = editable && !readOnly;
  return (
    <TextInput
      {...props}
      ref={ref}
      value={text}
      editable={editable}
      readOnly={readOnly}
      aria-disabled={!enabled}
      onChangeText={(next) => {
        if (enabled) onChangeText?.(next);
        else text.value = value;
      }}
      onSubmitEditing={(next) => {
        if (enabled) onSubmitEditing?.(next);
      }}
    />
  );
});
