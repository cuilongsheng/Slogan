import { Gate } from '../../src/features/auth';
import { SocialScreen } from '../../src/features/social/SocialScreen';

export default function SocialRoute() {
  return <Gate allow="ELIGIBLE"><SocialScreen /></Gate>;
}
