import { Image, StyleSheet, View } from 'react-native';
import { AuthPage } from './AuthPage';
import { AppText as Text } from './AppText';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import sloganLogo from '../../../assets/icons/slogan-mark-v3.png';

export function BrandLoading() {
  return (
    <AuthPage>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('signingIn')}
        testID="brand-loading"
        style={styles.body}
      >
        <View style={[styles.sparkle, styles.first]}>
          <Text style={styles.mark}>✦</Text>
        </View>
        <View style={[styles.sparkle, styles.second]}>
          <Text style={styles.mark}>✦</Text>
        </View>
        <View style={styles.brand}>
          <Image source={sloganLogo} resizeMode="contain" style={styles.logo} />
          <Text style={styles.name}>{t('appName')}</Text>
        </View>
      </View>
    </AuthPage>
  );
}
const styles = StyleSheet.create({
  body: { flex: 1 },
  brand: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -23 }, { translateX: 6 }],
  },
  logo: { width: 112, height: 112 },
  name: {
    color: tokens.color.brandInk,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    height: 36,
    marginTop: 2,
  },
  sparkle: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  first: { top: 164, left: 67 },
  second: { top: 213, right: 12 },
  mark: { color: tokens.color.coral, fontSize: 18, lineHeight: 30 },
});
