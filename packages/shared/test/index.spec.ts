import { describe, expect, it } from 'vitest';

import * as shared from '../src/index';

describe('@slogan/shared boundary', () => {
  it('contains no placeholder business exports', () => {
    expect(Object.keys(shared)).toHaveLength(0);
  });
});
