import { Tabs } from 'expo-router';
import { Gate, useAuth } from '../../src/features/auth';

export default function MainTabsLayout() {
  const { state } = useAuth();
  return (
    <Gate allow="ELIGIBLE">
      <Tabs
        key={state.kind === 'signedIn' ? state.me.userId : 'signedOut'}
        initialRouteName="rooms"
        screenOptions={{ headerShown: false, lazy: true, animation: 'none' }}
        tabBar={() => null}
      >
        <Tabs.Screen name="rooms" />
        <Tabs.Screen name="partners" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="me" />
      </Tabs>
    </Gate>
  );
}
