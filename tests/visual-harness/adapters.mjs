/* global crypto, history, location, URL, Blob */
import React from 'react';
import { View, StyleSheet } from 'react-native';

// Provider/session data is deterministic. Tests exercise real UI and generated HTTP clients,
// not LiveKit, STT, permission prompts, Android rendering, or a production auth session.
export const getLocales = () => [{ languageTag: 'zh-CN', languageCode: 'zh' }];
export const randomUUID = () => crypto.randomUUID();
export const useRouter = () => ({
  replace: (url) => history.replaceState(null, '', url),
  push: (url) => history.pushState(null, '', url),
  back: () => history.back(),
});
const auth = { authorized: (request) => request('visual-fixture') };
export const useAuth = () => auth;
export const useFocusEffect = (effect) => React.useEffect(effect, [effect]);
export const useJoinDraft = () => ({ draft: null, clear() {} });
export const createVoiceMedia = () => ({});
export const StatusBar = () => null;
export const SafeAreaView = ({ children, style }) => React.createElement(View, { style }, children);
export const LinearGradient = ({ children, style, colors }) =>
  React.createElement(
    View,
    {
      style: [
        StyleSheet.flatten(style),
        { backgroundImage: `linear-gradient(90deg, ${colors.join(',')})` },
      ],
    },
    children,
  );

const portraits = {
  luna: new URL(
    '../../docs/acceptance/voice-room-four-column-fidelity/fixture-avatars/luna.png',
    import.meta.url,
  ).href,
  mika: new URL(
    '../../docs/acceptance/voice-room-four-column-fidelity/fixture-avatars/mika.png',
    import.meta.url,
  ).href,
  yuki: new URL(
    '../../docs/acceptance/voice-room-four-column-fidelity/fixture-avatars/yuki.png',
    import.meta.url,
  ).href,
  ravi: new URL(
    '../../docs/acceptance/voice-room-four-column-fidelity/fixture-avatars/ravi.png',
    import.meta.url,
  ).href,
};
const avatar = (name) => portraits[name];
const members = ['Luna', 'Mika', 'Yuki', 'Ravi'].map((name, index) => ({
  membershipId: `member-${index}`,
  userId: `user-${index}`,
  displayName: name,
  participantIdentity: `identity-${index}`,
  position: index + 1,
  role: index === 0 ? 'HOST' : 'MEMBER',
  presence: 'CONNECTED',
  lifecycle: 'ACTIVE',
  cefrLevel: 'B1',
  avatarUrl: avatar(name.toLowerCase()),
  nationalityCode: ['GB', 'JP', 'US', 'IN'][index],
}));
export class VoiceRoomSession {
  constructor() {
    const query = new URL(location.href).searchParams;
    const count = Math.min(6, Math.max(0, Number(query.get('count') ?? 4)));
    this.state.room.capacity = Math.min(6, Math.max(count, Number(query.get('capacity') ?? 6)));
    this.state.members = Array.from({ length: count }, (_, index) => ({
      ...members[index % members.length],
      membershipId: `member-${index}`,
      participantIdentity: `identity-${index}`,
      position: index + 1,
      ...(query.has('longNames')
        ? { displayName: `Preview member ${index} with a long name` }
        : {}),
    }));
    this.state.room.memberCount = count;
    this.state.media.participants = this.state.members.map((member, index) => ({
      identity: member.participantIdentity,
      speaking: false,
      microphoneEnabled: index !== 2,
    }));
    if (new URL(location.href).searchParams.get('role') === 'host') {
      this.state.role = 'HOST';
      this.state.room.currentMembership.id = 'member-0';
      this.state.media.participants[1].speaking = true;
    }
    if (new URL(location.href).searchParams.get('device') === 'blocked') {
      this.state.media.deviceCheck = { microphone: 'blocked', playback: 'ready' };
    }
  }
  state = {
    phase: 'active',
    role: 'MEMBER',
    credentialVersion: 1,
    errorCode: null,
    room: {
      id: 'visual-room',
      topic: '聊聊旅行中的意外收获',
      memberCount: 4,
      capacity: 6,
      cefrLevel: 'B1',
      cefrLevelMin: 'B1',
      cefrLevelMax: 'B2',
      endsAt: '2026-09-28T09:38:00Z',
      sensitiveSpeechDetectionEnabled: false,
      currentMembership: { id: 'member-1' },
      shareUrl: 'https://example.test/share/fixture',
    },
    members,
    safetyAlerts: [],
    safetyAlertsDenied: false,
    media: {
      connection: 'connected',
      microphoneEnabled: false,
      audioPlaybackAllowed: true,
      participants: members.map((member, index) => ({
        identity: member.participantIdentity,
        speaking: index === 0,
        microphoneEnabled: index !== 2,
      })),
    },
  };
  listeners = new Set();
  get snapshot() {
    return this.state;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }
  async start() {}
  async refresh() {}
  async recheckDevices() {
    this.state = {
      ...this.state,
      media: { ...this.state.media, deviceCheck: { microphone: 'ready', playback: 'ready' } },
    };
    this.listeners.forEach((listener) => listener(this.state));
  }
  async dispose() {}
  async setMicrophoneEnabled(enabled) {
    this.state = { ...this.state, media: { ...this.state.media, microphoneEnabled: enabled } };
    this.listeners.forEach((listener) => listener(this.state));
  }
  async leave() {
    this.state = { ...this.state, phase: 'left' };
    this.listeners.forEach((listener) => listener(this.state));
  }
}
const start = async () => {};
const stop = async () => ({
  uri: 'blob:fixture',
  name: 'fixture.webm',
  mimeType: 'audio/webm',
  formFile: new Blob(['explicit-test-audio-fixture'], { type: 'audio/webm' }),
  size: 27,
  release() {},
});
const discard = () => {};
export const usePrivateRecorder = () => ({ start, stop, discard, elapsedSeconds: 0 });
