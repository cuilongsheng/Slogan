import { useEffect, useState, type ReactNode } from 'react';
import { AuthPage } from '../components/ui/AuthPage';
import { BrandLoading } from '../components/ui/BrandLoading';
import { useAuth } from '../features/auth';

/** Restore auth alongside fonts/locale and keep a single startup surface. */
export function StartupGate({ ready, children }: { ready: boolean; children: ReactNode }) {
  const { state } = useAuth();
  if (ready && state.kind !== 'loading') return <>{children}</>;
  return <PendingStartup ready={ready} />;
}

function PendingStartup({ ready }: { ready: boolean }) {
  const [showBrand, setShowBrand] = useState(false);
  useEffect(() => {
    // Fast local restores should enter the destination without a brief logo flash.
    const timer = setTimeout(() => setShowBrand(true), 180);
    return () => clearTimeout(timer);
  }, []);
  // Avoid switching the wordmark's typeface while the font is still loading.
  return ready && showBrand ? (
    <BrandLoading />
  ) : (
    <AuthPage>
      <></>
    </AuthPage>
  );
}
