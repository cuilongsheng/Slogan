import { Gate } from '../src/features/auth/Gate';
import { AgeRestrictedScreen } from '../src/features/profile/EligibilityScreens';

export default function AgeRestrictedRoute() {
  return (
    <Gate allow="AGE_RESTRICTED">
      <AgeRestrictedScreen />
    </Gate>
  );
}
