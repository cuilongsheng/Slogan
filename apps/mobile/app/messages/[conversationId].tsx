import { useLocalSearchParams } from 'expo-router';
import { Gate } from '../../src/features/auth';
import { ChatScreen } from '../../src/features/direct/ChatScreen';
export default function ChatRoute() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  return (
    <Gate allow="ELIGIBLE">
      <ChatScreen key={conversationId} conversationId={conversationId} />
    </Gate>
  );
}
