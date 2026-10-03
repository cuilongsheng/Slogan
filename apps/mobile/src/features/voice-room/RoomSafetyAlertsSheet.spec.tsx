import { fireEvent, render } from '@testing-library/react-native';

import { RoomSafetyAlertsSheet } from './RoomSafetyAlertsSheet';

it('shows only minimal server alert facts and requests the next cursor', async () => {
  const refreshSafetyAlerts = jest.fn(async () => undefined);
  const page = await render(
    <RoomSafetyAlertsSheet
      snapshot={
        {
          safetyAlerts: [
            {
              id: 'alert-1',
              roomId: 'room-1',
              subjectUserId: 'user-2',
              category: 'THREAT_VIOLENCE',
              severity: 'HIGH',
              firstOccurredAt: '2026-09-30T00:00:00Z',
              lastOccurredAt: '2026-09-30T00:00:00Z',
              occurrenceCount: 2,
              ruleSetVersion: 'v1',
              noticeCode: 'REQUIRES_HUMAN_REVIEW',
            },
          ],
          safetyAlertsCursor: 'next-page',
          safetyAlertsLoading: false,
          safetyAlertsError: false,
        } as never
      }
      session={{ refreshSafetyAlerts } as never}
      members={[{ userId: 'user-2', displayName: 'Mika' }] as never}
      onClose={jest.fn()}
    />,
  );
  expect(page.getByText('Threat or violence')).toBeTruthy();
  expect(page.getByText('Member: Mika')).toBeTruthy();
  expect(page.getByText('Review manually. No automatic action is taken.')).toBeTruthy();
  await fireEvent.press(page.getByRole('button', { name: 'Show more' }));
  expect(refreshSafetyAlerts).toHaveBeenCalledWith('next-page');
});
