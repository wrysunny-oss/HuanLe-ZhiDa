import {takuAdProvider} from './taku';

test('Taku provider 已注册为可用广告适配器', () => {
  expect(takuAdProvider.name).toBe('taku');
  expect(takuAdProvider.available).toBe(true);
  expect(takuAdProvider.state).toBe('idle');
});
