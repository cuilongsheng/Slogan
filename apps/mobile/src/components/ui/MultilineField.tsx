import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { tokens } from '../../styles/tokens';

/** Compact at rest; keep long editable content readable without consuming the whole screen. */
export function MultilineField({ style, value, onContentSizeChange, ...props }: TextInputProps) {
  const [height, setHeight] = useState<number>(tokens.control.height);
  const visibleHeight = value ? height : tokens.control.height;
  const fieldStyle = StyleSheet.flatten(style);
  const padding = Math.max(
    0,
    (tokens.control.height - (fieldStyle?.lineHeight ?? 20) - 2 * (fieldStyle?.borderWidth ?? 0)) /
      2,
  );
  return (
    <TextInput
      {...props}
      value={value}
      multiline
      scrollEnabled={visibleHeight >= 160}
      onContentSizeChange={(event) => {
        setHeight(
          Math.min(160, Math.max(tokens.control.height, event.nativeEvent.contentSize.height)),
        );
        onContentSizeChange?.(event);
      }}
      style={[
        { fontSize: 14, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'top' },
        style,
        {
          height: visibleHeight,
          minHeight: tokens.control.height,
          maxHeight: 160,
          paddingVertical: padding,
        },
      ]}
    />
  );
}
