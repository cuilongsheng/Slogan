import regular from '../../../assets/fonts/NotoSansSC-400.ttf';
import medium from '../../../assets/fonts/NotoSansSC-500.ttf';
import semibold from '../../../assets/fonts/NotoSansSC-600.ttf';
import bold from '../../../assets/fonts/NotoSansSC-700.ttf';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { AuthProvider } from '../src/features/auth/context';
import { EmailFlowProvider } from '../src/features/auth/emailFlow';
import { ProfileDraftProvider } from '../src/features/profile/draft';
import { JoinProvider } from '../src/features/room-discovery/join';
import { PresenceHeartbeat } from '../src/features/social/PresenceHeartbeat';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    NotoSansSC: regular,
    NotoSansSCMedium: medium,
    NotoSansSCSemibold: semibold,
    NotoSansSCBold: bold,
  });
  if (error) throw error;
  if (!loaded) return null;
  return (
    <AuthProvider>
      <PresenceHeartbeat />
      <EmailFlowProvider>
        <ProfileDraftProvider>
          <JoinProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </JoinProvider>
        </ProfileDraftProvider>
      </EmailFlowProvider>
    </AuthProvider>
  );
}
