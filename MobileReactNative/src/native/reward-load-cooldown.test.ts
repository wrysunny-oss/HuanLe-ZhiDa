import {computeRewardLoadCooldownRemainingMs} from './reward-load-cooldown';

test('reward load cooldown starts when the previous ad closes', () => {
  expect(computeRewardLoadCooldownRemainingMs(1_000, 8, 1_000)).toBe(8_000);
  expect(computeRewardLoadCooldownRemainingMs(1_000, 8, 8_500)).toBe(500);
  expect(computeRewardLoadCooldownRemainingMs(1_000, 8, 9_000)).toBe(0);
});

test('zero seconds disables reward load cooldown', () => {
  expect(computeRewardLoadCooldownRemainingMs(1_000, 0, 1_000)).toBe(0);
  expect(computeRewardLoadCooldownRemainingMs(0, 8, 1_000)).toBe(0);
});
