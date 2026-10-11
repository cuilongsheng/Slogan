import { Gate } from '../../src/features/auth';
import { PartnersScreen } from '../../src/features/direct/PartnersScreen';
export default function PartnersRoute() {
  return (
    <Gate allow="ELIGIBLE">
      <PartnersScreen />
    </Gate>
  );
}
