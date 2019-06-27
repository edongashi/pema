import {
  KeyedRouteConfig,
  MatchedRoute,
  RoutingTable
} from './types'
import { matchRoutes, computeRootMatch } from './match'
import { error, route } from './actions'
import { join } from './url-utils'

function sorter(a: KeyedRouteConfig, b: KeyedRouteConfig) {
  return (a.order || 0) - (b.order || 0)
}

function flattenRoutes(path: string, routes: RoutingTable) {
  const childRoutes: KeyedRouteConfig[] = []
  const paths = Object.keys(routes)
  const len = paths.length
  for (let i = 0; i < len; i++) {
    const childPath = paths[i]
    childRoutes.push(toKeyedRoute(join(path, childPath), routes[childPath]))
  }

  return childRoutes.sort(sorter)
}

function toKeyedRoute(path: string, r: any): KeyedRouteConfig {
  const config = route(r as any)
  const id =
    (config.exact ? 'e' : '')
    + (config.strict ? 's' : '')
    + (config.sensitive ? 'v' : '')
    + '@' + path

  const result: KeyedRouteConfig = {
    ...config,
    id,
    path
  }

  if (config.routes) {
    result.keyedRoutes = flattenRoutes(path, config.routes)
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
    if (current.length > 0) {
      all.sort(sorter)
    }

    this.routes = all
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
