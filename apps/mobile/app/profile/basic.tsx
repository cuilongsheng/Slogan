import { Gate } from '../../src/features/auth/Gate';
import { BasicProfileScreen } from '../../src/features/profile/ProfileScreens';

export default function BasicProfileRoute() {
  return (
    <Gate allow="PROFILE_REQUIRED">
      <BasicProfileScreen />
    </Gate>
  );
}
