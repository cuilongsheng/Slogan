import type { ViewStyle } from 'react-native';
import { tokens } from '../../styles/tokens';

/** Owner-approved large action: 342 × 46 at a 390pt viewport. */
export const largeAction: ViewStyle = {
  width: '100%',
  maxWidth: 342,
  height: tokens.control.height,
  minHeight: tokens.control.height,
  alignSelf: 'center',
  borderRadius: tokens.control.radius,
};
