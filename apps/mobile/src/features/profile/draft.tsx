import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { defaultAvatarUrl } from './avatar';
import { useAuth } from '../auth/context';
import type { MessageKey } from '../../services/locale';
import { validAvatarUrl, type ProfileInput } from '../auth/session';

export interface ProfileDraft {
  avatarUrl: string;
  displayName: string;
  genderCode: ProfileInput['genderCode'] | '';
  city: string;
  nationalityCode?: string;
  adultConfirmed?: boolean;
  birthYear: string;
  birthMonth: string;
  interestCodes: string[];
  cefrLevel: ProfileInput['cefrLevel'] | '';
}

const emptyDraft: ProfileDraft = {
  avatarUrl: '',
  displayName: '',
  genderCode: '',
  city: '',
  adultConfirmed: false,
  birthYear: '',
  birthMonth: '',
  interestCodes: [],
  cefrLevel: '',
};

interface DraftContextValue {
  draft: ProfileDraft;
  resetFromProfile?: () => void;
  setDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>;
  serverErrors?: ProfileErrors;
  setServerErrors?: React.Dispatch<React.SetStateAction<ProfileErrors>>;
}
const DraftContext = createContext<DraftContextValue | null>(null);

export function ProfileDraftProvider({ children }: { children: React.ReactNode }) {
  const { state, suggestedProfile } = useAuth();
  const [manualDraft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [serverErrors, setServerErrors] = useState<ProfileErrors>({});
  const owner = state.kind === 'signedIn' ? state.me.userId : null;
  const previousOwner = useRef<string | null>(null);
  const resetFromProfile = useCallback(() => {
    setServerErrors({});
    setDraft({
      ...emptyDraft,
      ...(state.kind === 'signedIn' && state.me.profile
        ? {
            avatarUrl: state.me.profile.avatarUrl,
            displayName: state.me.profile.displayName,
            genderCode: state.me.profile.genderCode ?? '',
            nationalityCode: state.me.profile.nationalityCode ?? '',
            city: state.me.profile.city ?? '',
            adultConfirmed: state.me.onboardingState === 'ELIGIBLE',
            birthYear: state.me.profile.birthYear?.toString() ?? '',
            birthMonth: state.me.profile.birthMonth?.toString() ?? '',
            interestCodes: state.me.profile.interestCodes,
            cefrLevel: state.me.profile.cefrLevel,
          }
        : { displayName: suggestedProfile?.displayName ?? '' }),
    });
  }, [state, suggestedProfile]);
  useEffect(() => {
    if (previousOwner.current === owner) return;
    previousOwner.current = owner;
    resetFromProfile();
  }, [owner, resetFromProfile]);
  const draft = useMemo(
    () => ({
      ...manualDraft,
      avatarUrl: validAvatarUrl(manualDraft.avatarUrl)
        ? manualDraft.avatarUrl
        : validAvatarUrl(suggestedProfile?.avatarUrl)
          ? suggestedProfile.avatarUrl
          : defaultAvatarUrl(),
    }),
    [manualDraft, suggestedProfile],
  );
  const value = useMemo(
    () => ({ draft, setDraft, serverErrors, setServerErrors, resetFromProfile }),
    [draft, serverErrors, resetFromProfile],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useProfileDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error('ProfileDraftProvider is required');
  return value;
}

export type ProfileField =
  | 'avatarUrl'
  | 'displayName'
  | 'genderCode'
  | 'city'
  | 'birthYear'
  | 'birthMonth'
  | 'adultConfirmed'
  | 'interestCodes'
  | 'cefrLevel';
export type ProfileErrors = Partial<Record<ProfileField, MessageKey | undefined>>;

export function validateBasic(draft: ProfileDraft, now = new Date()): ProfileErrors {
  const errors: ProfileErrors = {};
  if (draft.displayName.trim().length < 2 || draft.displayName.trim().length > 40)
    errors.displayName = 'profileNameInvalid';
  if (draft.city.trim().length > 100) errors.city = 'profileCityInvalid';
  const year = Number(draft.birthYear);
  const month = Number(draft.birthMonth);
  if (draft.birthYear.trim() || draft.birthMonth.trim()) {
    if (
      !/^\d{4}$/.test(draft.birthYear) ||
      year < Math.max(1900, now.getUTCFullYear() - 120) ||
      year > now.getUTCFullYear()
    )
      errors.birthYear = 'profileYearInvalid';
    if (
      !/^\d{1,2}$/.test(draft.birthMonth) ||
      month < 1 ||
      month > 12 ||
      (year === now.getUTCFullYear() && month > now.getUTCMonth() + 1)
    )
      errors.birthMonth = 'profileMonthInvalid';
  }
  if (draft.adultConfirmed !== true) errors.adultConfirmed = 'adultConfirmRequired';
  return errors;
}
export function validatePreferences(draft: ProfileDraft): ProfileErrors {
  return {
    ...(!validAvatarUrl(draft.avatarUrl) ? { avatarUrl: 'avatarMissing' as const } : {}),
    ...(draft.interestCodes.length === 0
      ? { interestCodes: 'profileInterestRequired' as const }
      : {}),
    ...(!draft.cefrLevel ? { cefrLevel: 'profileLevelRequired' as const } : {}),
  };
}
export function profileServerErrors(details: readonly string[]): ProfileErrors {
  const fields: Record<string, MessageKey> = {
    avatarUrl: 'avatarMissing',
    displayName: 'profileNameInvalid',
    genderCode: 'profileGenderInvalid',
    city: 'profileCityInvalid',
    nationalityCode: 'profileCityInvalid',
    birthYear: 'profileYearInvalid',
    birthMonth: 'profileMonthInvalid',
    adultConfirmed: 'adultConfirmRequired',
    interestCodes: 'profileInterestRequired',
    cefrLevel: 'profileLevelRequired',
  };
  return Object.fromEntries(
    details
      .map((message) => message.split(/[ .:[\]]/, 1)[0] ?? '')
      .filter((field) => field in fields)
      .map((field) => [field === 'nationalityCode' ? 'city' : field, fields[field]]),
  );
}
export function toProfileInput(draft: ProfileDraft): ProfileInput | null {
  if (
    Object.keys(validateBasic(draft)).length ||
    Object.keys(validatePreferences(draft)).length ||
    !draft.cefrLevel
  )
    return null;
  return {
    avatarUrl: draft.avatarUrl,
    displayName: draft.displayName.trim(),
    ...(draft.genderCode ? { genderCode: draft.genderCode } : {}),
    ...(draft.nationalityCode ? { nationalityCode: draft.nationalityCode } : {}),
    ...(draft.city.trim() ? { city: draft.city.trim() } : {}),
    ...(draft.birthYear.trim() && draft.birthMonth.trim()
      ? { birthYear: Number(draft.birthYear), birthMonth: Number(draft.birthMonth) }
      : {}),
    adultConfirmed: true,
    interestCodes: draft.interestCodes,
    cefrLevel: draft.cefrLevel,
  };
}
