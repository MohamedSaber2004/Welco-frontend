import { describe, it, expect } from 'vitest';
import { isStaffRole } from '../../domain/models/business-role';
describe('isStaffRole', () => {
  it('treats WelcoStaff and SnulStaff identically', () => {
    expect(isStaffRole('WelcoStaff')).toBe(true);
    expect(isStaffRole('SnulStaff')).toBe(true);
    expect(isStaffRole('Client')).toBe(false);
  });
});
