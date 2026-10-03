import { Gate } from '../../src/features/auth/Gate';
import { PreferencesScreen } from '../../src/features/profile/ProfileScreens';

export default function PreferencesRoute() {
  return (
    <Gate allow="PROFILE_REQUIRED">
      <PreferencesScreen />
    </Gate>
  );
}
