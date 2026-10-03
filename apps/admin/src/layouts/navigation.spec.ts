import { describe, expect, it } from 'vitest';
import { firstPermittedRoute } from './navigation';

describe('backoffice navigation', () => {
  it('sends an auditor to read-only audit-capable work', () => {
    expect(firstPermittedRoute(['AUDITOR'])).toBe('/safety/incidents');
  });
  it('sends a safety officer to the case queue', () => {
    expect(firstPermittedRoute(['SAFETY_OFFICER'])).toBe('/safety/cases');
  });
  it('does not offer a role-free page', () => {
    expect(firstPermittedRoute([])).toBe('/no-pages');
  });
});
