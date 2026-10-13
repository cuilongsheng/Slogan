import { StyleSheet } from 'react-native';

// iPhone 17: 1206 × 2622 physical pixels at 3×. Smaller viewports remain fluid.
export const phonePreview = StyleSheet.create({
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF4FC',
  },
  frame: { width: '100%', maxWidth: 402, maxHeight: 874, minHeight: 0 },
});
