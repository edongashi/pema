import { matchResource } from './match-resource'

test('matchResource', () => {
  expect(matchResource('*', 'user')).toBe(true)
  expect(matchResource('*', 'user/1')).toBe(true)
  expect(matchResource('*', 'user/1/friends')).toBe(true)

  expect(matchResource('*', '*')).toBe(true)
  expect(matchResource('user', '*')).toBe(false)
  expect(matchResource('user/1', '*')).toBe(false)
  expect(matchResource('user/1/friends', '*')).toBe(false)

  expect(matchResource('user', 'user')).toBe(true)
  expect(matchResource('user', 'user/1')).toBe(true)
  expect(matchResource('user', 'user/1/friends')).toBe(true)

  expect(matchResource('user/', 'user')).toBe(true)
  expect(matchResource('user/', 'user/1')).toBe(false)
  expect(matchResource('user/', 'user/1/friends')).toBe(false)

  expect(matchResource('user/1', 'user')).toBe(false)
  expect(matchResource('user/1', 'user/1')).toBe(true)
  expect(matchResource('user/1', 'user/1/friends')).toBe(true)

  expect(matchResource('user/2', 'user')).toBe(false)
  expect(matchResource('user/2', 'user/1')).toBe(false)
  expect(matchResource('user/2', 'user/1/friends')).toBe(false)

  expect(matchResource('user/1/friends', 'user')).toBe(false)
  expect(matchResource('user/1/friends', 'user/1')).toBe(false)
  expect(matchResource('user/1/friends', 'user/1/friends')).toBe(true)

  expect(matchResource('user/2/friends', 'user')).toBe(false)
  expect(matchResource('user/2/friends', 'user/1')).toBe(false)
  expect(matchResource('user/2/friends', 'user/1/friends')).toBe(false)

  expect(matchResource('user/*', 'user')).toBe(true)
  expect(matchResource('user/*', 'user/1')).toBe(true)
  expect(matchResource('user/*', 'user/1/friends')).toBe(true)

  expect(matchResource('user/*/friends', 'user')).toBe(false)
  expect(matchResource('user/*/friends', 'user/1')).toBe(false)
  expect(matchResource('user/*/friends', 'user/1/friends')).toBe(true)
})
