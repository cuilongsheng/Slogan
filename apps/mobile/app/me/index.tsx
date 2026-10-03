import { Gate } from '../../src/features/auth';
import { MeScreen } from '../../src/features/profile/MeScreen';

export default function MeRoute() {
  return <Gate allow="ELIGIBLE"><MeScreen /></Gate>;
}
