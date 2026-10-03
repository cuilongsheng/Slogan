import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface JoinDraft {
  roomId: string;
  password: string;
  rulesAccepted: boolean;
  invitationId?: string;
}
interface JoinContextValue {
  draft: JoinDraft | null;
  begin(roomId: string, invitationId?: string): void;
  password(value: string): void;
  acceptRules(value: boolean): void;
  clear(): void;
}

export function validRoomPassword(value: string) {
  return /^\d{4}$/.test(value);
}

export function beginJoin(previous: JoinDraft | null, roomId: string, invitationId?: string): JoinDraft {
  return previous?.roomId === roomId && previous.invitationId === invitationId
    ? previous
    : { roomId, password: '', rulesAccepted: false, ...(invitationId ? { invitationId } : {}) };
}

export function updateJoinPassword(previous: JoinDraft | null, input: string): JoinDraft | null {
  return previous
    ? { ...previous, password: input.replace(/\D/g, '').slice(0, 4), rulesAccepted: false }
    : null;
}

export function updateJoinRules(previous: JoinDraft | null, accepted: boolean): JoinDraft | null {
  return previous ? { ...previous, rulesAccepted: accepted } : null;
}

const JoinContext = createContext<JoinContextValue | null>(null);

export function JoinProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<JoinDraft | null>(null);
  const value = useMemo<JoinContextValue>(
    () => ({
      draft,
      begin(roomId, invitationId) {
        setDraft((previous) => beginJoin(previous, roomId, invitationId));
      },
      password(input) {
        setDraft((previous) => updateJoinPassword(previous, input));
      },
      acceptRules(accepted) {
        setDraft((previous) => updateJoinRules(previous, accepted));
      },
      clear() {
        setDraft(null);
      },
    }),
    [draft],
  );
  return <JoinContext.Provider value={value}>{children}</JoinContext.Provider>;
}

export function useJoinDraft() {
  const value = useContext(JoinContext);
  if (!value) throw new Error('JoinProvider is required');
  return value;
}
