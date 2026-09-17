import { describe, it, expect } from 'vitest';
import { resolveGateway } from '../api.config';
describe('resolveGateway', () => {
  it('defaults to Welco gateway', () => {
    expect(resolveGateway('')).toContain('welco-gateway');
  });
});
