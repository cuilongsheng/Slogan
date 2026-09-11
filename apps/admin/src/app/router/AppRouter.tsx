import { Route, Routes } from 'react-router-dom';

import { BootstrapView } from '../../views/BootstrapView';

export function AppRouter() {
  return (
    <Routes>
      <Route path="*" element={<BootstrapView />} />
    </Routes>
  );
}
