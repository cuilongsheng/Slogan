import { Gate } from '../../src/features/auth';
import { VocabularyScreen } from '../../src/features/learning/VocabularyScreen';

export default function VocabularyRoute() {
  return <Gate allow="ELIGIBLE"><VocabularyScreen /></Gate>;
}
