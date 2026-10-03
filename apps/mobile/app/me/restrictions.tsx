import { Gate } from '../../src/features/auth';
import { RestrictionsScreen } from '../../src/features/safety/RestrictionsScreen';

export default function RestrictionsRoute() {
  return <Gate allow="ELIGIBLE"><RestrictionsScreen /></Gate>;
}
