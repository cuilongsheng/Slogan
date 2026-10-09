import React from 'react';
import { createRoot } from 'react-dom/client';
import { VoiceRoomScreen } from '../../apps/mobile/src/features/voice-room/VoiceRoomScreen';
import './fonts.css';
import { JoinProvider } from '../../apps/mobile/src/features/room-discovery/join';
import { CreateRoomScreen } from '../../apps/mobile/src/features/room-creation/CreateRoomScreen';

// Test-only harness: the real component runs with explicit session/recorder adapters.
// No fixture entry or adapter is imported by the production application.
createRoot(document.getElementById('root')!).render(
  <JoinProvider>
    {new URL(location.href).searchParams.get('screen') === 'create' ? (
      <CreateRoomScreen />
    ) : (
      <VoiceRoomScreen roomId="visual-room" />
    )}
  </JoinProvider>,
);
