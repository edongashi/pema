import { app } from './app'

test('app mixin', () => {
  const root = app()
    .mixin({
      getTwo() {
        return 2
      }
    })
    .mixin({
      twoPlusSomething(x: number) {
        return this.getTwo() + x
      }
    })

  expect(root.twoPlusSomething(5)).toBe(7)
})
