import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../auth/context';
import { validAvatarUrl, type ProfileInput } from '../auth/session';

export interface ProfileDraft {
  avatarUrl: string;
  displayName: string;
  genderCode: ProfileInput['genderCode'] | '';
  city: string;
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
  birthYear: '',
  birthMonth: '',
  interestCodes: [],
  cefrLevel: '',
};

interface DraftContextValue {
  draft: ProfileDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProfileDraft>>;
}
const DraftContext = createContext<DraftContextValue | null>(null);

export function ProfileDraftProvider({ children }: { children: React.ReactNode }) {
  const { state, suggestedProfile } = useAuth();
  const [manualDraft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const owner = state.kind === 'signedIn' ? state.me.userId : null;
  const previousOwner = useRef<string | null>(null);
  useEffect(() => {
    if (previousOwner.current === owner) return;
    previousOwner.current = owner;
    setDraft({
      ...emptyDraft,
      displayName: suggestedProfile?.displayName ?? '',
    });
  }, [owner, suggestedProfile]);
  const draft = useMemo(
    () => ({
      ...manualDraft,
      avatarUrl: validAvatarUrl(manualDraft.avatarUrl)
        ? manualDraft.avatarUrl
        : validAvatarUrl(suggestedProfile?.avatarUrl)
          ? suggestedProfile.avatarUrl
          : '',
    }),
    [manualDraft, suggestedProfile],
  );
  const value = useMemo(() => ({ draft, setDraft }), [draft]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useProfileDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error('ProfileDraftProvider is required');
  return value;
}

export function validateBasic(draft: ProfileDraft, now = new Date()): 'required' | 'birth' | null {
  if (
    draft.displayName.trim().length < 2 ||
    draft.displayName.trim().length > 40 ||
    !draft.genderCode ||
    !draft.city.trim() ||
    draft.city.length > 100
  )
    return 'required';
  const year = Number(draft.birthYear);
  const month = Number(draft.birthMonth);
  if (
    !/^\d{4}$/.test(draft.birthYear) ||
    !/^\d{1,2}$/.test(draft.birthMonth) ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < Math.max(1900, now.getUTCFullYear() - 120) ||
    year > now.getUTCFullYear() ||
    month < 1 ||
    month > 12 ||
    (year === now.getUTCFullYear() && month > now.getUTCMonth() + 1)
  )
    return 'birth';
  return null;
}

export function toProfileInput(draft: ProfileDraft): ProfileInput | null {
  if (
    validateBasic(draft) ||
    !validAvatarUrl(draft.avatarUrl) ||
    draft.interestCodes.length < 1 ||
    !draft.cefrLevel ||
    !draft.genderCode
  )
    return null;
  return {
    avatarUrl: draft.avatarUrl,
    displayName: draft.displayName.trim(),
    genderCode: draft.genderCode,
    city: draft.city.trim(),
    birthYear: Number(draft.birthYear),
    birthMonth: Number(draft.birthMonth),
    interestCodes: draft.interestCodes,
    cefrLevel: draft.cefrLevel,
  };
}
