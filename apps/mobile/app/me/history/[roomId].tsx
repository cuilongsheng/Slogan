import { useLocalSearchParams } from 'expo-router';
import { Gate } from '../../../src/features/auth';
import { NoteScreen } from '../../../src/features/history/NoteScreen';

export default function NoteRoute() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  return <Gate allow="ELIGIBLE"><NoteScreen roomId={roomId} /></Gate>;
}
