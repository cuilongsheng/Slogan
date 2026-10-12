import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import MainTabsLayout from '../../../app/(tabs)/_layout';
import { BottomNavigation } from './BottomNavigation';

jest.mock('../../features/auth', () => ({
  Gate: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ state: { kind: 'signedIn', me: { userId: 'account-a' } } }),
}));
const mounts = [0, 0, 0, 0];
function Page({ index }: { index: 0 | 1 | 2 | 3 }) {
  const [draft, setDraft] = useState('');
  useEffect(() => {
    mounts[index] = (mounts[index] ?? 0) + 1;
  }, [index]);
  return (
    <View>
      <Text>Page {index}</Text>
      <TextInput testID={`draft-${index}`} value={draft} onChangeText={setDraft} />
      <BottomNavigation active={index} />
    </View>
  );
}

afterEach(() => jest.useRealTimers());
test('real Expo tabs preserve instances and drafts when navigating between public URLs', async () => {
  await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      '(tabs)/_layout': MainTabsLayout,
      '(tabs)/rooms': () => <Page index={0} />,
      '(tabs)/partners': () => <Page index={1} />,
      '(tabs)/messages': () => <Page index={2} />,
      '(tabs)/me': () => <Page index={3} />,
    },
    { initialUrl: '/rooms' },
  );
  await fireEvent.changeText(screen.getByTestId('draft-0'), 'Keep my page state');
  await fireEvent.press(screen.getByRole('button', { name: 'Partners' }));
  expect(screen.getByText('Page 1')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Messages' }));
  expect(screen.getByText('Page 2')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Me' }));
  expect(screen.getByText('Page 3')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Discover' }));
  expect(screen.getByTestId('draft-0').props.value).toBe('Keep my page state');
  expect(mounts).toEqual([1, 1, 1, 1]);
});
