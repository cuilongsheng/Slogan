import { useState } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { t } from '../../services/locale';
import { useAuth } from '../auth/context';
import { BasicProfileScreen, PreferencesScreen } from './ProfileScreens';
import { useProfileDraft, type ProfileDraft } from './draft';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../auth/context', () => ({ useAuth: jest.fn() }));
jest.mock('./draft', () => ({ ...jest.requireActual('./draft'), useProfileDraft: jest.fn() }));

const valid: ProfileDraft = {
  avatarUrl: 'https://example.test/avatar.png',
  displayName: 'Ada',
  genderCode: 'female',
  city: 'Shanghai',
  birthYear: '2000',
  birthMonth: '2',
  interestCodes: ['travel'],
  cefrLevel: '',
};

function Harness({ initial, basic = false }: { initial: ProfileDraft; basic?: boolean }) {
  const [draft, setDraft] = useState(initial);
  (useProfileDraft as jest.Mock).mockReturnValue({ draft, setDraft });
  return basic ? <BasicProfileScreen /> : <PreferencesScreen />;
}

describe('first profile screens', () => {
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  const putProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(router);
    (useAuth as jest.Mock).mockReturnValue({ putProfile });
  });

  it('keeps basic step on invalid fields', async () => {
    const screen = await render(<Harness basic initial={{ ...valid, displayName: '' }} />);
    await fireEvent.press(screen.getByTestId('basic-continue'));
    expect(screen.getByText(t('required'))).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('submits selected interests and a CEFR band, then follows server age state', async () => {
    putProfile.mockResolvedValue({
      userId: 'user-1',
      onboardingState: 'AGE_RESTRICTED',
      profile: {},
    });
    const screen = await render(<Harness initial={valid} />);
    await fireEvent.press(screen.getByTestId('interest-movies'));
    await fireEvent.press(screen.getByTestId('level-B1_B2'));
    expect(screen.getByTestId('level-B1_B2').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('profile-submit'));
    await waitFor(() =>
      expect(putProfile).toHaveBeenCalledWith(
        expect.objectContaining({ interestCodes: ['travel', 'movies'], cefrLevel: 'B1_B2' }),
      ),
    );
    expect(router.replace).toHaveBeenCalledWith('/age-restricted');
  });
});
