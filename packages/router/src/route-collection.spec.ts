import RouteCollection from './route-collection'
import { RoutingTable } from './types'

test('nested routes', () => {
  const routes: RoutingTable = {
    '/a': {},
    '/b': {},
    '/c': {
      routes: {
        '/x': {
          routes: {
            '/1': {},
            '/2': {},
            '/3': {}
          }
        },
        '/y': {},
        '/z': {}
      }
    }
  }

  const collection = new RouteCollection(routes)
  const flattenedRoutes = collection.routes
  expect(flattenedRoutes.length).toBe(9)
  expect(flattenedRoutes.map(r => r.path).sort())
    .toEqual(['/a', '/b', '/c', '/c/x', '/c/x/1', '/c/x/2', '/c/x/3', '/c/y', '/c/z'].sort())
})
