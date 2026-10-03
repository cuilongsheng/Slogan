import { Stack } from 'expo-router';

import { AuthProvider } from '../src/features/auth/context';
import { EmailFlowProvider } from '../src/features/auth/emailFlow';
import { ProfileDraftProvider } from '../src/features/profile/draft';
import { JoinProvider } from '../src/features/room-discovery/join';

export default function RootLayout() {
  return (
    <AuthProvider>
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
