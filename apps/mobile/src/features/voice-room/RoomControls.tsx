import { useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { t, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import type { AvailablePerson, RemovedMember, ReportInput, RoomMember, VoiceRoomApi } from './api';

type Mode = 'members' | 'remove' | 'removed' | 'invite' | 'report' | 'receipt';
type Category = ReportInput['category'];
const categories: { value: Category; label: MessageKey }[] = [
  { value: 'HARASSMENT_ABUSE', label: 'roomReportHarassment' },
  { value: 'HATE_DISCRIMINATION', label: 'roomReportHate' },
  { value: 'SEXUAL_CONTENT', label: 'roomReportSexual' },
  { value: 'SPAM_ADVERTISING', label: 'roomReportSpam' },
  { value: 'OTHER', label: 'roomReportOther' },
];

export function RoomControls({
  roomId,
  members,
  ownMembershipId,
  isHost,
  api,
  refresh,
  onClose,
  initialRemoveTarget,
}: {
  roomId: string;
  members: RoomMember[];
  ownMembershipId: string | null;
  isHost: boolean;
  api: VoiceRoomApi;
  refresh: () => Promise<void>;
  onClose: () => void;
  initialRemoveTarget?: RoomMember;
}) {
  const [mode, setMode] = useState<Mode>(initialRemoveTarget && isHost ? 'remove' : 'members');
  const [target, setTarget] = useState<RoomMember | null>(
    isHost ? (initialRemoveTarget ?? null) : null,
  );
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [receipt, setReceipt] = useState<{ id: string; caseId: string } | null>(null);
  const [people, setPeople] = useState<AvailablePerson[]>([]);
  const [removed, setRemoved] = useState<RemovedMember[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextFriendCursor, setNextFriendCursor] = useState<string | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string[]>([]);
  const invitationIds = useRef(new Map<string, string>());

  async function loadPeople(cursor?: string) {
    if (peopleLoading) return;
    setPeopleLoading(true);
    setError('');
    try {
      const [page, friends] = await Promise.all([
        api.availablePeople(cursor),
        cursor ? Promise.resolve(null) : api.friends(),
      ]);
      const candidates = [
        ...(friends?.items.map((item) => ({ ...item.friend, isAvailable: item.isAvailable })) ??
          []),
        ...page.items,
      ].filter(
        (person, index, all) => all.findIndex((item) => item.userId === person.userId) === index,
      );
      setPeople((current) =>
        cursor
          ? [
              ...current,
              ...candidates.filter(
                (person) => !current.some((item) => item.userId === person.userId),
              ),
            ]
          : candidates,
      );
      setNextCursor(page.nextCursor);
      if (!cursor) setNextFriendCursor(friends?.nextCursor ?? null);
    } catch {
      setError(t('roomControlsFailed'));
    } finally {
      setPeopleLoading(false);
    }
  }

  async function loadMoreFriends() {
    if (!nextFriendCursor || peopleLoading) return;
    setPeopleLoading(true);
    setError('');
    try {
      const page = await api.friends(nextFriendCursor);
      setPeople((current) => [
        ...current,
        ...page.items
          .map((item) => ({ ...item.friend, isAvailable: item.isAvailable }))
          .filter((person) => !current.some((item) => item.userId === person.userId)),
      ]);
      setNextFriendCursor(page.nextCursor);
    } catch {
      setError(t('roomControlsFailed'));
    } finally {
      setPeopleLoading(false);
    }
  }

  async function loadRemoved() {
    setPeopleLoading(true);
    setError('');
    try {
      setRemoved(await api.removedMembers(roomId));
    } catch {
      setError(t('roomControlsFailed'));
    } finally {
      setPeopleLoading(false);
    }
  }

  function selectReportTarget(member: RoomMember) {
    setTarget(member);
    setCategory(null);
    setDescription('');
    setRequestId(randomUUID());
    setError('');
    setMode('report');
  }

  async function removeMember() {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.removeMember(roomId, target);
      await refresh();
      if (isHost) await loadRemoved();
      setTarget(null);
      setMode('members');
    } catch {
      await refresh().catch(() => undefined);
      setError(t('roomControlsFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function reinvite(member: RemovedMember) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.reinviteRemoved(roomId, member);
      await loadRemoved();
    } catch {
      await loadRemoved().catch(() => undefined);
      setError(t('roomControlsFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function invite(person: AvailablePerson) {
    if (busy) return;
    setBusy(true);
    setError('');
    const id = invitationIds.current.get(person.userId) ?? randomUUID();
    invitationIds.current.set(person.userId, id);
    try {
      await api.inviteUser(roomId, person.userId, id);
      invitationIds.current.delete(person.userId);
      setSentTo((current) => [...current, person.userId]);
    } catch {
      setError(t('roomControlsFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!target || !category || busy) return;
    const trimmed = description.trim();
    if ([...trimmed].length < 1 || [...trimmed].length > 2000) {
      setError(t('roomReportInvalid'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.report(roomId, {
        targetUserId: target.userId,
        clientRequestId: requestId,
        category,
        description: trimmed,
      });
      setReceipt({ id: result.id, caseId: result.caseId });
      setMode('receipt');
    } catch {
      setError(t('roomControlsFailed'));
    } finally {
      setBusy(false);
    }
  }

  const isMembers = mode === 'members';
  const visiblePeople = people.filter(
    (person) => !members.some((member) => member.userId === person.userId),
  );
  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('roomCloseSheet')}
        style={styles.scrim}
        onPress={onClose}
      />
      <View style={[styles.sheet, isMembers && styles.membersSheet]}>
        <View style={styles.headingRow}>
          <Text style={[styles.title, isMembers && styles.darkTitle]}>
            {mode === 'members'
              ? t('roomManageMembers')
              : mode === 'remove'
                ? t('roomRemoveConfirm')
                : mode === 'removed'
                  ? t('roomRemovedMembers')
                  : mode === 'invite'
                    ? t('roomInvitePeople')
                    : mode === 'report'
                      ? t('roomReportMember')
                      : t('roomReportReceived')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('roomCloseSheet')}
            onPress={onClose}
          >
            <Text style={[styles.close, isMembers && styles.darkTitle]}>×</Text>
          </TouchableOpacity>
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {mode === 'members' && (
          <>
            <Text style={styles.memberHint}>
              {t(isHost ? 'roomMembersHostHint' : 'roomMembersHint')}
            </Text>
            <ScrollView style={styles.scroll}>
              {members.map((member) => (
                <View key={member.membershipId} style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{member.displayName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.displayName}</Text>
                    <Text style={styles.memberMeta}>
                      {member.role === 'HOST' ? t('roomHost') : t('roomMember')} ·{' '}
                      {member.cefrLevel.replace('_', '–')}
                    </Text>
                  </View>
                  {member.membershipId !== ownMembershipId && (
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => selectReportTarget(member)}
                      >
                        <Text style={styles.reportLink}>{t('roomReportMember')}</Text>
                      </TouchableOpacity>
                      {isHost && (
                        <TouchableOpacity
                          accessibilityRole="button"
                          onPress={() => {
                            setTarget(member);
                            setError('');
                            setMode('remove');
                          }}
                        >
                          <Text style={styles.removeLink}>{t('roomRemoveMember')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            {isHost && (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.secondaryMembers}
                  onPress={() => {
                    setMode('removed');
                    void loadRemoved();
                  }}
                >
                  <Text style={styles.secondaryMembersText}>{t('roomRemovedMembers')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.primary}
                  onPress={() => {
                    setError('');
                    setMode('invite');
                    void loadPeople();
                  }}
                >
                  <Text style={styles.primaryText}>{t('roomInvitePeople')}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
        {mode === 'removed' && (
          <>
            <ScrollView style={styles.scroll}>
              {removed.map((member) => (
                <View key={member.membershipId} style={styles.inviteRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{member.displayName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.lightName}>{member.displayName}</Text>
                    <Text style={styles.lightMeta}>{member.cefrLevel.replace('_', '–')}</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={busy}
                    style={styles.inviteButton}
                    onPress={() => void reinvite(member)}
                  >
                    <Text style={styles.primaryText}>{t('roomReinvite')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {removed.length === 0 && !peopleLoading && (
                <Text style={styles.body}>{t('roomRemovedEmpty')}</Text>
              )}
              {peopleLoading && <ActivityIndicator color="#fff" />}
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.primary}
              onPress={() => setMode('members')}
            >
              <Text style={styles.primaryText}>{t('roomManageMembers')}</Text>
            </TouchableOpacity>
          </>
        )}
        {mode === 'remove' && (
          <>
            <Text style={styles.body}>{t('roomRemoveBody')}</Text>
            <Text style={styles.targetName}>{target?.displayName}</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.secondary}
                onPress={() => setMode('members')}
              >
                <Text style={styles.primaryText}>{t('cancelAction')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={busy}
                style={[styles.danger, busy && styles.dim]}
                onPress={() => void removeMember()}
              >
                <Text style={styles.primaryText}>{t('roomRemoveConfirmAction')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {mode === 'invite' && (
          <>
            <Text style={styles.body}>{t('roomInviteHint')}</Text>
            <ScrollView style={styles.scroll}>
              {visiblePeople.map((person) => (
                <View key={person.userId} style={styles.inviteRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{person.displayName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.lightName}>{person.displayName}</Text>
                    <Text style={styles.lightMeta}>{person.cefrLevel}</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={busy || sentTo.includes(person.userId)}
                    onPress={() => void invite(person)}
                    style={styles.inviteButton}
                  >
                    <Text style={styles.primaryText}>
                      {sentTo.includes(person.userId) ? t('roomInviteSent') : t('roomInviteAction')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              {visiblePeople.length === 0 && !peopleLoading && (
                <Text style={styles.body}>{t('roomInviteEmpty')}</Text>
              )}
              {nextCursor && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void loadPeople(nextCursor)}
                >
                  <Text style={styles.loadMore}>{t('roomLoadMorePeople')}</Text>
                </TouchableOpacity>
              )}
              {nextFriendCursor && (
                <TouchableOpacity accessibilityRole="button" onPress={() => void loadMoreFriends()}>
                  <Text style={styles.loadMore}>{t('roomLoadMorePeople')}</Text>
                </TouchableOpacity>
              )}
              {peopleLoading && <ActivityIndicator color="#fff" />}
            </ScrollView>
          </>
        )}
        {mode === 'report' && (
          <>
            <ScrollView style={styles.reportScroll} keyboardShouldPersistTaps="handled">
              <Text style={styles.body}>{t('roomReportHint')}</Text>
              <Text style={styles.label}>{t('roomReportTarget')}</Text>
              <Text style={styles.selected}>{target?.displayName}</Text>
              <Text style={styles.label}>{t('roomReportCategory')}</Text>
              <View style={styles.categories}>
                {categories.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === item.value }}
                    style={[styles.category, category === item.value && styles.categorySelected]}
                    onPress={() => {
                      setCategory(item.value);
                      setRequestId(randomUUID());
                    }}
                  >
                    <Text style={styles.categoryText}>{t(item.label)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>{t('roomReportDescription')}</Text>
              <TextInput
                accessibilityLabel={t('roomReportDescription')}
                multiline
                maxLength={2000}
                placeholder={t('roomReportPlaceholder')}
                placeholderTextColor="#A69BB7"
                style={styles.textarea}
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                  setRequestId(randomUUID());
                }}
              />
            </ScrollView>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy || !category || !description.trim()}
              style={[styles.primary, (busy || !category || !description.trim()) && styles.dim]}
              onPress={() => void report()}
            >
              <Text style={styles.primaryText}>{t('roomReportSubmit')}</Text>
            </TouchableOpacity>
          </>
        )}
        {mode === 'receipt' && receipt && (
          <>
            <Text style={styles.body}>
              {t('roomReportCaseId')} · {receipt.caseId}
            </Text>
            <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={onClose}>
              <Text style={styles.primaryText}>{t('roomCloseSheet')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    minHeight: 450,
    maxHeight: '82%',
    backgroundColor: '#35264F',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 50,
  },
  membersSheet: { backgroundColor: '#FFF9F6', minHeight: '65%' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  darkTitle: { color: tokens.color.foreground },
  close: { color: '#C8BDE0', fontSize: 30, lineHeight: 30 },
  error: { color: '#FF8B98', marginTop: 14, lineHeight: 20 },
  body: { color: '#C7BBD8', fontSize: 13, lineHeight: 20, marginTop: 18 },
  memberHint: { color: tokens.color.muted, marginTop: 8, marginBottom: 10 },
  scroll: { flexGrow: 0, flex: 1, marginTop: 14 },
  reportScroll: { flexGrow: 0, flex: 1, marginTop: 14 },
  memberRow: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9E6',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFEBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: tokens.color.purple, fontSize: 18, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { color: tokens.color.foreground, fontWeight: '700' },
  memberMeta: { color: tokens.color.muted, marginTop: 6, fontSize: 12 },
  rowActions: { alignItems: 'flex-end', gap: 5 },
  reportLink: { color: tokens.color.purple, fontSize: 12 },
  removeLink: { color: '#C6384A', fontWeight: '700' },
  primary: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: tokens.color.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  secondaryMembers: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryMembersText: { color: tokens.color.purple, fontWeight: '700' },
  primaryText: { color: '#fff', fontWeight: '700' },
  targetName: { color: '#fff', fontSize: 18, marginTop: 28 },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 110 },
  secondary: {
    flex: 1,
    backgroundColor: '#4A3B65',
    borderRadius: 28,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: {
    flex: 1,
    backgroundColor: '#9F3158',
    borderRadius: 28,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
  inviteRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 5,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#49395F',
  },
  lightName: { color: '#fff', fontWeight: '700' },
  lightMeta: { color: '#C7BBD8', marginTop: 4 },
  inviteButton: {
    backgroundColor: tokens.color.purple,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  loadMore: { color: '#fff', textAlign: 'center', marginVertical: 15 },
  label: { color: '#C7BBD8', marginTop: 22, marginBottom: 8 },
  selected: { backgroundColor: '#49395F', color: '#fff', borderRadius: 20, padding: 15 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    width: '48%',
    backgroundColor: '#49395F',
    borderRadius: 20,
    minHeight: 37,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  categorySelected: { backgroundColor: tokens.color.purple },
  categoryText: { color: '#fff', fontSize: 12 },
  textarea: {
    minHeight: 95,
    maxHeight: 130,
    backgroundColor: '#49395F',
    borderRadius: 16,
    color: '#fff',
    padding: 14,
    textAlignVertical: 'top',
  },
});
