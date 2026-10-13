import React from 'react';
import { createRoot } from 'react-dom/client';
import { VoiceRoomScreen } from '../../apps/mobile/src/features/voice-room/VoiceRoomScreen';
import './fonts.css';
import { PartnersScreen } from '../../apps/mobile/src/features/direct/PartnersScreen';
import { MessagesScreen } from '../../apps/mobile/src/features/direct/MessagesScreen';
import { ChatScreen } from '../../apps/mobile/src/features/direct/ChatScreen';
import { CallScreen } from '../../apps/mobile/src/features/direct/CallScreen';
import { MessageUnreadProvider } from '../../apps/mobile/src/features/direct/MessageUnreadProvider';
import { MeScreen } from '../../apps/mobile/src/features/profile/MeScreen';
const screen = new URL(location.href).searchParams.get('screen');
const directScreen =
  screen === 'partners' ? (
    <PartnersScreen />
  ) : screen === 'messages' ? (
    <MessagesScreen />
  ) : screen === 'chat' ? (
    <ChatScreen conversationId="conversation-luna" />
  ) : screen === 'call' ? (
    <CallScreen callId="call-luna" />
  ) : screen === 'me' ? (
    <ProfileDraftProvider>
      <MeScreen />
    </ProfileDraftProvider>
  ) : null;
import {
  BasicProfileScreen,
  PreferencesScreen,
} from '../../apps/mobile/src/features/profile/ProfileScreens';
import { ProfileDraftProvider } from '../../apps/mobile/src/features/profile/draft';
import { RoomListScreen } from '../../apps/mobile/src/features/room-discovery/RoomListScreen';
import { JoinProvider } from '../../apps/mobile/src/features/room-discovery/join';
import { CreateRoomScreen } from '../../apps/mobile/src/features/room-creation/CreateRoomScreen';

// Test-only harness: the real component runs with explicit session/recorder adapters.
// No fixture entry or adapter is imported by the production application.
createRoot(document.getElementById('root')!).render(
  <MessageUnreadProvider>
    <JoinProvider>
      {directScreen ??
        (['profile', 'preferences'].includes(
          new URL(location.href).searchParams.get('screen') ?? '',
        ) ? (
          <ProfileDraftProvider>
            {new URL(location.href).searchParams.get('screen') === 'profile' ? (
              <BasicProfileScreen />
            ) : (
              <PreferencesScreen />
            )}
          </ProfileDraftProvider>
        ) : new URL(location.href).searchParams.get('screen') === 'create' ? (
          <CreateRoomScreen />
        ) : new URL(location.href).searchParams.get('screen') === 'rooms' ? (
          <RoomListScreen />
        ) : (
          <VoiceRoomScreen roomId="visual-room" />
        ))}
    </JoinProvider>
  </MessageUnreadProvider>,
);
