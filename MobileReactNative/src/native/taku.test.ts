import {takuAdProvider, transactionIdOf} from './taku';

test('Taku reward transaction ID uses show ID rather than request ID', () => {
  expect(transactionIdOf({id: 12345, request_id: 'request-67890'})).toBe('12345');
  expect(transactionIdOf({show_id: 'show-1', request_id: 'request-1'})).toBe('show-1');
  expect(transactionIdOf({request_id: 'request-only'})).toBe('');
});

test('Taku provider 已注册为可用广告适配器', () => {
  expect(takuAdProvider.name).toBe('taku');
  expect(takuAdProvider.available).toBe(true);
  expect(takuAdProvider.state).toBe('idle');
});
