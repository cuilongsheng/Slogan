import { Redirect } from 'expo-router';
import { Gate } from '../src/features/auth';

export default function ReadyRoute() {
  return (
    <Gate allow="ELIGIBLE">
      <Redirect href="/rooms" />
    </Gate>
  );
}
