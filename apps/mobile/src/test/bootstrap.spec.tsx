import { render } from '@testing-library/react-native';

import BootstrapRoute from '../../app/index';

describe('mobile bootstrap', () => {
  it('renders the engineering-only smoke route', async () => {
    const view = await render(<BootstrapRoute />);

    expect(view.getByRole('header', { name: 'Slogan Mobile is ready' })).toBeTruthy();
    expect(view.getByText(/not a voice room/i)).toBeTruthy();
  });
});
