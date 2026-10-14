import { MultilineField } from '../../components/ui/MultilineField';
import { largeAction } from '../../components/ui/largeAction';
import { AppText as Text } from '../../components/ui/AppText';
import { useCallback, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusedPolling } from '../../hooks/useFocusedPolling';
import { LatestRequestQueue } from '../../services/latestRequestQueue';
import { t, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import type { AvailablePerson, RemovedMember, ReportInput, RoomMember, VoiceRoomApi } from './api';
import { ReportReceiptSheet, type ReportSubmissionReceipt } from '../reporting';

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
  initialMode,
  initialReportTarget,
  roomTopic,
}: {
  roomId: string;
  members: RoomMember[];
  ownMembershipId: string | null;
  isHost: boolean;
  api: VoiceRoomApi;
  refresh: () => Promise<void>;
  onClose: () => void;
  initialRemoveTarget?: RoomMember;
  initialMode?: 'invite' | 'report' | 'reportRoom';
  initialReportTarget?: RoomMember;
  roomTopic?: string;
}) {
  const [mode, setMode] = useState<Mode>(
    initialMode === 'report' || initialMode === 'reportRoom'
      ? 'report'
      : isHost && initialMode === 'invite'
        ? 'invite'
        : initialRemoveTarget && isHost
          ? 'remove'
          : 'members',
  );
  const [target, setTarget] = useState<RoomMember | null>(
    initialReportTarget ?? (isHost ? (initialRemoveTarget ?? null) : null),
  );
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [receipt, setReceipt] = useState<ReportSubmissionReceipt | null>(null);
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<AvailablePerson[]>([]);
  const [removed, setRemoved] = useState<RemovedMember[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(isHost && initialMode === 'invite');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [peopleError, setPeopleError] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const sentTargets = useRef(new Set<string>());
  const sendInFlight = useRef(false);
  const sendVersion = useRef(0);
  const confirmedSends = useRef(new Map<string, number>());
  const [invitationsReady, setInvitationsReady] = useState(false);
  const invitationIds = useRef(new Map<string, string>());

  const peopleQueue = useRef(new LatestRequestQueue());
  const loadedPeople = useRef(false);
  const peopleFence = useRef<() => boolean>(() => false);
  const loadedPeoplePages = useRef(1);
  const [peopleFetching, setPeopleFetching] = useState(false);
  const loadPeople = useCallback(
    (cursor?: string, current: () => boolean = peopleFence.current) =>
      peopleQueue.current.enqueue(async () => {
        if (!current()) return;
        setPeopleFetching(true);
        if (cursor || !loadedPeople.current) setPeopleLoading(true);
        setPeopleError(false);
        try {
          const readVersion = sendVersion.current;
          const [pending, candidates] = await Promise.all([
            (async () => {
              const targets = new Set<string>();
              let invitationCursor: string | undefined;
              do {
                const page = await api.sentInvitations(roomId, invitationCursor);
                if (!current()) return targets;
                for (const invitation of page.items) targets.add(invitation.inviteeUserId);
                invitationCursor = page.nextCursor ?? undefined;
              } while (invitationCursor);
              return targets;
            })(),
            (async () => {
              const collected: AvailablePerson[] = [];
              let next = cursor ?? undefined;
              let pageCount = 0;
              do {
                const page = await api.availablePeople(next);
                if (!current()) return { collected, next, pageCount };
                for (const person of page.items) {
                  if (person.isAvailable && !collected.some((x) => x.userId === person.userId))
                    collected.push(person);
                }
                next = page.nextCursor ?? undefined;
                pageCount++;
              } while (!cursor && next && pageCount < loadedPeoplePages.current);
              return { collected, next, pageCount };
            })(),
          ]);
          if (!current()) return;
          const { collected, next, pageCount } = candidates;
          setPeople((old) =>
            cursor
              ? [
                  ...old,
                  ...collected.filter((person) => !old.some((x) => x.userId === person.userId)),
                ]
              : collected,
          );
          loadedPeoplePages.current = cursor ? loadedPeoplePages.current + 1 : pageCount;
          setNextCursor(next ?? null);
          loadedPeople.current = true;
          // A read begun before a send completed cannot erase that confirmed send.
          for (const [targetId, version] of confirmedSends.current) {
            if (version > readVersion) pending.add(targetId);
            else confirmedSends.current.delete(targetId);
          }
          sentTargets.current = pending;
          setSentTo([...pending]);
          setInvitationsReady(true);
        } catch {
          if (current()) setPeopleError(true);
        } finally {
          if (current()) {
            setPeopleFetching(false);
            setPeopleLoading(false);
          }
        }
      }),
    [api, roomId],
  );
  const pollPeople = useCallback(
    (current: () => boolean) => {
      peopleFence.current = current;
      return loadPeople(undefined, current);
    },
    [loadPeople],
  );
  useFocusedPolling(pollPeople, 5000, isHost && mode === 'invite');

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
    if (busy || sendInFlight.current || !invitationsReady || sentTargets.current.has(person.userId))
      return;
    sendInFlight.current = true;
    setBusy(true);
    setError('');
    const id = invitationIds.current.get(person.userId) ?? randomUUID();
    invitationIds.current.set(person.userId, id);
    try {
      await api.inviteUser(roomId, person.userId, id);
      invitationIds.current.delete(person.userId);
      sentTargets.current.add(person.userId);
      confirmedSends.current.set(person.userId, ++sendVersion.current);
      setSentTo([...sentTargets.current]);
    } catch {
      setError(t('roomControlsFailed'));
    } finally {
      sendInFlight.current = false;
      setBusy(false);
    }
  }

  const reportingRoom = initialMode === 'reportRoom';
  async function report() {
    if ((!target && !reportingRoom) || !category || busy) return;
    const trimmed = description.trim();
    if ([...trimmed].length < 1 || [...trimmed].length > 2000) {
      setError(t('roomReportInvalid'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.report(roomId, {
        ...(target ? { targetUserId: target.userId } : {}),
        clientRequestId: requestId,
        category,
        description: trimmed,
      });
      setReceipt(result);
      setMode('receipt');
    } catch {
      setError(t('roomControlsFailed'));
    } finally {
      setBusy(false);
    }
  }

  const isMembers = mode === 'members';
  const visiblePeople = people.filter(
    (person) =>
      !members.some((member) => member.userId === person.userId) &&
      person.displayName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  if (mode === 'receipt' && receipt)
    return <ReportReceiptSheet receipt={receipt} onClose={onClose} />;
  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('roomCloseSheet')}
        style={styles.scrim}
        onPress={onClose}
      />
      <View
        style={[
          styles.sheet,
          isMembers && styles.membersSheet,
          mode === 'invite' && styles.inviteSheet,
          mode === 'report' && styles.reportSheet,
        ]}
      >
        <View style={styles.headingRow}>
          <Text
            style={[
              styles.title,
              isMembers && styles.darkTitle,
              mode === 'invite' && styles.inviteTitle,
              mode === 'report' && styles.reportTitle,
            ]}
          >
            {mode === 'members'
              ? t('roomManageMembers')
              : mode === 'remove'
                ? t('roomRemoveConfirm')
                : mode === 'removed'
                  ? t('roomRemovedMembers')
                  : mode === 'invite'
                    ? t('roomInvitePeople')
                    : mode === 'report'
                      ? t(reportingRoom ? 'roomReportRoom' : 'roomReportMember')
                      : t('roomReportReceived')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('roomCloseSheet')}
            onPress={onClose}
          >
            <Text
              style={[
                styles.close,
                isMembers && styles.darkTitle,
                mode === 'invite' && styles.inviteClose,
              ]}
            >
              ×
            </Text>
          </TouchableOpacity>
        </View>
        {(mode === 'invite' || mode === 'report') && (
          <View pointerEvents="none" style={styles.brandDots}>
            <View style={[styles.brandDot, { backgroundColor: '#FF6F70' }]} />
            <View style={[styles.brandDot, { backgroundColor: '#FFD65A', marginTop: 3 }]} />
            <View style={[styles.brandDot, { backgroundColor: '#23C8BE' }]} />
          </View>
        )}
        {error || (mode === 'invite' && peopleError) ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error || t('roomControlsFailed')}
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
            <TextInput
              accessibilityLabel={t('roomInviteSearch')}
              placeholder={t('roomInviteSearch')}
              placeholderTextColor="#C8BCE0"
              value={search}
              onChangeText={setSearch}
              style={styles.inviteSearch}
            />
            <Text style={styles.inviteListTitle}>{t('roomInviteListTitle')}</Text>
            <ScrollView style={styles.inviteScroll}>
              {visiblePeople.map((person) => (
                <View key={person.userId} style={[styles.inviteRow, styles.onlineInviteRow]}>
                  <View style={[styles.avatar, styles.onlineInviteAvatar]}>
                    <Text style={styles.onlineInviteInitial}>{person.displayName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text numberOfLines={1} style={styles.onlineInviteName}>
                      {person.displayName}
                    </Text>
                    <Text style={styles.onlineInviteMeta}>
                      {person.cefrLevel} · {t('roomInviteIdle')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${t(sentTo.includes(person.userId) ? 'roomInviteSent' : 'roomInviteAction')} ${person.displayName}`}
                    disabled={busy || !invitationsReady || sentTo.includes(person.userId)}
                    onPress={() => void invite(person)}
                    style={[styles.inviteButton, styles.onlineInviteButton]}
                  >
                    <Text style={styles.onlineInviteLabel}>
                      {sentTo.includes(person.userId) ? t('roomInviteSent') : t('roomInviteAction')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              {visiblePeople.length === 0 && !peopleLoading && (
                <View>
                  <Text style={styles.body}>
                    {t(peopleError ? 'roomControlsFailed' : 'roomInviteEmpty')}
                  </Text>
                  <TouchableOpacity accessibilityRole="button" onPress={() => void loadPeople()}>
                    <Text style={styles.loadMore}>{t('refreshAction')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {nextCursor && (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={peopleLoading || peopleFetching}
                  onPress={() => void loadPeople(nextCursor)}
                >
                  <Text style={styles.loadMore}>{t('roomLoadMorePeople')}</Text>
                </TouchableOpacity>
              )}
              {peopleLoading && <ActivityIndicator color="#fff" />}
            </ScrollView>
            <Text style={styles.inviteCapacityNote}>{t('roomInviteHint')}</Text>
          </>
        )}
        {mode === 'report' && (
          <>
            <ScrollView style={styles.reportScroll} keyboardShouldPersistTaps="handled">
              <Text style={[styles.body, styles.reportBody]}>
                {t(reportingRoom ? 'roomReportRoomHint' : 'roomReportHint')}
              </Text>
              <Text style={[styles.label, styles.targetLabel]}>{t('roomReportTarget')}</Text>
              <Text style={styles.selected}>{reportingRoom ? roomTopic : target?.displayName}</Text>
              <Text style={[styles.label, styles.categoryLabel]}>{t('roomReportCategory')}</Text>
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
              <Text style={[styles.label, styles.detailsLabel]}>{t('roomReportDescription')}</Text>
              <MultilineField
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
              style={[
                styles.primary,
                styles.reportSubmit,
                (busy || !category || !description.trim()) && styles.reportDisabled,
              ]}
              onPress={() => void report()}
            >
              <Text style={[styles.primaryText, styles.reportSubmitText]}>
                {t('roomReportSubmit')}
              </Text>
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
  // Desktop Bridge source: 111:884 (390×518); fixed viewport for list scrolling.
  inviteSheet: {
    height: 518,
    minHeight: 0,
    backgroundColor: '#34274F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
  },
  inviteTitle: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
  inviteClose: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
    width: 28,
    textAlign: 'center',
    color: '#D6CBE9',
  },
  inviteSearch: {
    height: tokens.control.height,
    flexShrink: 0,
    borderRadius: 22,
    backgroundColor: '#45365E',
    marginTop: 18,
    paddingHorizontal: 14,
    fontFamily: 'NotoSansSC',
    fontSize: 13,
    color: '#FFF',
  },
  inviteListTitle: {
    height: 22,
    marginTop: 20,
    fontSize: 12,
    lineHeight: 22,
    fontWeight: '500',
    color: '#C8BCE0',
  },
  inviteScroll: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    height: 166,
    minHeight: 0,
    marginTop: 12,
  },
  inviteCapacityNote: { fontSize: 11, lineHeight: 18, color: '#BFB2D7', marginTop: 24 },
  onlineInviteRow: {
    height: 70,
    minHeight: 70,
    marginVertical: 0,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#45365E',
    gap: 12,
  },
  onlineInviteAvatar: { backgroundColor: '#66559A', alignSelf: 'flex-start', marginTop: 0 },
  onlineInviteInitial: { color: '#FFF', fontSize: 16, fontWeight: '500', lineHeight: 25 },
  onlineInviteName: { color: '#FFF', fontSize: 14, lineHeight: 23, fontWeight: '500' },
  onlineInviteMeta: { color: '#C8BCE0', fontSize: 11, lineHeight: 18, marginTop: 3 },
  onlineInviteButton: {
    minWidth: 64,
    height: tokens.control.height,
    paddingHorizontal: 12,
    paddingVertical: 0,
    backgroundColor: '#6D4DE3',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineInviteLabel: { color: '#FFF', fontSize: 12, lineHeight: 20, fontWeight: '500' },
  brandDots: { position: 'absolute', top: 24, right: 81, flexDirection: 'row', gap: 5 },
  brandDot: { width: 7, height: 7, borderRadius: 4 },
  membersSheet: { backgroundColor: '#FFF9F6', minHeight: '65%' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  darkTitle: { color: tokens.color.foreground },
  close: { color: '#C8BDE0', fontSize: 30, lineHeight: 30 },
  error: { color: '#FF8B98', marginTop: 14, lineHeight: 20 },
  body: { color: '#C7BBD8', fontSize: 13, lineHeight: 20, marginTop: 18 },
  memberHint: { color: tokens.color.muted, marginTop: 8, marginBottom: 10 },
  scroll: { flexGrow: 0, flex: 1, marginTop: 14 },
  reportSheet: {
    height: 634,
    minHeight: 0,
    maxHeight: '100%',
    paddingBottom: 65,
    backgroundColor: '#34274F',
  },
  reportSubmit: { marginTop: 31, ...largeAction },
  reportTitle: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
  reportBody: { marginTop: 0, minHeight: 40, fontSize: 12, lineHeight: 20 },
  reportScroll: { flex: 1, minHeight: 0, marginTop: 13 },
  targetLabel: { marginTop: 10 },
  categoryLabel: { marginBottom: 7 },
  detailsLabel: { marginTop: 17, marginBottom: 6 },
  reportDisabled: { backgroundColor: '#49395F' },
  reportSubmitText: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
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
    backgroundColor: tokens.color.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    ...largeAction,
  },
  secondaryMembers: {
    height: tokens.control.height,
    minHeight: tokens.control.height,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryMembersText: { color: tokens.color.purple, fontWeight: '700' },
  primaryText: { color: '#fff', fontWeight: '700' },
  targetName: { color: '#fff', fontSize: 18, marginTop: 28 },
  confirmActions: { flexDirection: 'row', gap: 12, marginTop: 110 },
  secondary: {
    height: tokens.control.height,
    flex: 1,
    backgroundColor: '#4A3B65',
    borderRadius: 28,
    minHeight: tokens.control.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
  danger: {
    height: tokens.control.height,
    flex: 1,
    backgroundColor: '#9F3158',
    borderRadius: 28,
    minHeight: tokens.control.height,
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
    height: tokens.control.height,
    backgroundColor: tokens.color.purple,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
  },
  loadMore: { color: '#fff', textAlign: 'center', marginVertical: 15 },
  label: {
    color: '#C7BBD8',
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 5,
  },
  selected: {
    backgroundColor: '#49395F',
    color: '#fff',
    borderRadius: 20,
    height: 48,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 12,
    lineHeight: 20,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    height: tokens.control.height,
    width: '48.5%',
    backgroundColor: '#49395F',
    borderRadius: 20,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  categorySelected: { backgroundColor: tokens.color.purple },
  categoryText: { color: '#fff', fontSize: 11, lineHeight: 18 },
  textarea: {
    backgroundColor: '#49395F',
    borderRadius: 16,
    color: '#fff',
    padding: 14,
    textAlignVertical: 'top',
  },
});
