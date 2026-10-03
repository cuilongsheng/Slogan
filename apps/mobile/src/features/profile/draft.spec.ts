import { toProfileInput, validateBasic, type ProfileDraft } from './draft';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { signOut: jest.fn() },
}));

const draft: ProfileDraft = {
  avatarUrl: 'https://example.test/avatar.png',
  displayName: 'Ada',
  genderCode: 'prefer_not_to_say',
  city: 'Shanghai',
  birthYear: '2000',
  birthMonth: '2',
  interestCodes: ['travel'],
  cefrLevel: 'B1_B2',
};

describe('profile draft', () => {
  it('submits the selected CEFR band and required fields', () => {
    expect(toProfileInput(draft)).toEqual({
      avatarUrl: draft.avatarUrl,
      displayName: 'Ada',
      genderCode: 'prefer_not_to_say',
      city: 'Shanghai',
      birthYear: 2000,
      birthMonth: 2,
      interestCodes: ['travel'],
      cefrLevel: 'B1_B2',
    });
  });

  it('rejects a local file avatar and a future birth date', () => {
    expect(toProfileInput({ ...draft, avatarUrl: 'file:///avatar.png' })).toBeNull();
    expect(validateBasic({ ...draft, birthYear: '2100' }, new Date('2026-09-24'))).toBe('birth');
  });
});
