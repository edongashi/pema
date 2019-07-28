import RouteCollection from './route-collection'
import { RoutingTable } from './types';

test('nested routes', () => {
  const routes: RoutingTable = {
    '/a': {},
    '/b': {},
    '/c': {
      routes: {
        '/c-1': {
          routes: {
            '/c-1-1': {},
            '/c-1-2': {},
            '/c-1-3': {}
          }
        },
        '/c-2': {},
        '/c-3': {}
      }
    }
  }

  const collection = new RouteCollection(routes)
  const flattenedRoutes = collection.routes
  expect(flattenedRoutes.length).toBe(9)
})
