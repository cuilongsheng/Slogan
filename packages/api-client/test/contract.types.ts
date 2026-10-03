import { createSloganApiClient } from '../src';

import type { SloganApiPaths } from '../src';

type CurrentUser = SloganApiPaths['/v1/me']['get']['responses'][200]['content']['application/json'];

const state: CurrentUser['onboardingState'] = 'ELIGIBLE';
void state;

function verifyGeneratedOperations() {
  const client = createSloganApiClient({ baseUrl: 'https://api.example.test' });

  void client.GET('/v1/me');
  void client.GET('/v1/rooms/{roomId}', {
    params: { path: { roomId: 'room-id' } },
  });

  // @ts-expect-error This endpoint is absent from the sole OpenAPI contract.
  void client.GET('/v1/not-a-real-endpoint');
  // @ts-expect-error The generated room-detail operation requires roomId.
  void client.GET('/v1/rooms/{roomId}');
}

void verifyGeneratedOperations;
