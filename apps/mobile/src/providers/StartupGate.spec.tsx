import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { StartupGate } from './StartupGate';
const mockState = { kind: 'loading' };
jest.mock('../features/auth', () => ({ useAuth: () => ({ state: mockState }) }));
jest.mock('../components/ui/AuthPage', () => ({
  AuthPage: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../components/ui/BrandLoading', () => ({
  BrandLoading: () =>
    jest
      .requireActual('react')
      .createElement(jest.requireActual('react-native').Text, null, 'Brand'),
}));
beforeEach(() => {
  jest.useFakeTimers();
  mockState.kind = 'loading';
});
afterEach(() => jest.useRealTimers());
const tree = (ready = true) => (
  <StartupGate ready={ready}>
    <Text>Content</Text>
  </StartupGate>
);
test('a fast restoration enters content without ever showing the brand', async () => {
  const screen = await render(tree());
  await act(async () => jest.advanceTimersByTime(100));
  expect(screen.queryByText('Brand')).toBeNull();
  mockState.kind = 'signedOut';
  await screen.rerender(tree());
  expect(screen.getByText('Content')).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(200));
  expect(screen.queryByText('Brand')).toBeNull();
});
test('a slow restoration waits for font readiness and a later restoration gets its own delay', async () => {
  const screen = await render(tree(false));
  await act(async () => jest.advanceTimersByTime(181));
  expect(screen.queryByText('Brand')).toBeNull();
  await screen.rerender(tree(true));
  expect(screen.getByText('Brand')).toBeTruthy();
  mockState.kind = 'signedOut';
  await screen.rerender(tree());
  expect(screen.getByText('Content')).toBeTruthy();
  mockState.kind = 'loading';
  await screen.rerender(tree());
  expect(screen.queryByText('Brand')).toBeNull();
  await act(async () => jest.advanceTimersByTime(180));
  expect(screen.getByText('Brand')).toBeTruthy();
});
