import { Gate } from '../../src/features/auth';
import { MyReportsScreen } from '../../src/features/reporting';
export default function ReportsRoute() {
  return (
    <Gate allow="ELIGIBLE">
      <MyReportsScreen />
    </Gate>
  );
}
