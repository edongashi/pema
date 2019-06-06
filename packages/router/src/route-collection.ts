import {
  KeyedRouteConfig,
  MatchedRoute,
  RoutingTable,
  RouteConfig
} from './types'
import sortBy from 'lodash.sortby'
import { matchRoutes, computeRootMatch } from './match'
import { error } from './actions'
import { join } from './url-utils'

function flattenRoutes(path: string, routes: RoutingTable) {
  const childRoutes: KeyedRouteConfig[] = []
  const paths = Object.keys(routes)
  const len = paths.length
  for (let i = 0; i < len; i++) {
    const childPath = paths[i]
    childRoutes.push(toKeyedRoute(join(path, childPath), routes[childPath]))
  }

  return sortBy(childRoutes, r => r.order || 0)
}

function toKeyedRoute(path: string, route: RouteConfig): KeyedRouteConfig {
  const id =
    (route.exact ? 'e' : '')
    + (route.strict ? 's' : '')
    + (route.sensitive ? 'v' : '')
    + '@' + path

  const result: KeyedRouteConfig = {
    ...route,
    id,
    path
  }

  if (route.routes) {
    result.keyedRoutes = flattenRoutes(path, route.routes)
  }

  return result
}

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

  registerRoutes(routes: RoutingTable): void {
    const current = this.routes
    const all = current.concat(flattenRoutes('/', routes))
    this.routes = current.length > 0
      ? sortBy(all, r => r.order || 0)
      : all
  }

  match(pathname: string): MatchedRoute[] {
    const branch = matchRoutes(this.routes, pathname)
    return branch.length > 0
      ? branch
      : [{
        route: this.notFound,
        match: computeRootMatch(pathname)
      }]
  }
}
