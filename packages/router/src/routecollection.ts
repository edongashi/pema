import {
  KeyedRouteConfig,
  MatchedRoute,
  RoutingTable
} from './types'
import { matchRoute, computeRootMatch } from './internal/match'
import { error } from './actions'
import sortBy from 'lodash.sortby'

export default class RouteCollection {
  private routes: KeyedRouteConfig[]
  private notFound: KeyedRouteConfig

  constructor(routes?: RoutingTable) {
    this.routes = []
    this.notFound = {
      id: '@/',
      path: '/',
      onEnter: error(404),
      stateless: true
    }

    if (routes) {
      this.registerRoutes(routes)
    }
  }

  registerRoutes(routes: RoutingTable) {
    const routesArray = this.routes
    const paths = Object.keys(routes)
    const len = paths.length
    for (let i = 0; i < len; i++) {
      const path = paths[i]
      const route = routes[path]
      const id =
        (route.exact ? 'e' : '')
        + (route.strict ? 's' : '')
        + (route.sensitive ? 'v' : '')
        + '@' + path
      routesArray.push({
        ...route,
        id,
        path
      })
    }

    this.routes = sortBy(routesArray, r => r.order || 0)
  }

  match(pathname: string): MatchedRoute {
    return matchRoute(this.routes, pathname) || {
      route: this.notFound,
      match: computeRootMatch(pathname)
    }
  }
}
