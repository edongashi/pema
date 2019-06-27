// Based on react-router. License https://github.com/ReactTraining/react-router/blob/master/LICENSE

import {
  Match,
  MatchedRoute,
  MatchOptions,
  KeyedRouteConfig
} from './types'
import pathToRegexp, { Key } from 'path-to-regexp'
import { Dictionary } from '@pema/utils'

interface CompiledRegexp {
  regexp: RegExp,
  keys: Key[]
}

const cache: Dictionary<Dictionary<CompiledRegexp>> = {}
const cacheLimit = 10000
let cacheCount = 0

function compilePath(path: string, options: {
  end: boolean,
  strict: boolean,
  sensitive: boolean
}): CompiledRegexp {
  const cacheKey = `${options.end}${options.strict}${options.sensitive}`
  const pathCache = cache[cacheKey] || (cache[cacheKey] = {})
  if (pathCache[path]) {
    return pathCache[path]
  }

  const keys: Key[] = []
  const regexp = pathToRegexp(path, keys, options)
  const result = { regexp, keys }

  if (cacheCount < cacheLimit) {
    pathCache[path] = result
    cacheCount++
  }

  return result
}

function matchPath(pathname: string, path: string): Match | null
function matchPath(pathname: string, options: MatchOptions): Match | null
function matchPath(pathname: string, arg: string | MatchOptions): Match | null {
  if (typeof arg === 'string') {
    arg = { path: arg }
  }

  const {
    path,
    exact = true,
    strict = false,
    sensitive = false
  } = arg

  const paths = ([] as string[]).concat(path)

  return paths.reduce((matched: Match | null, path) => {
    if (!path) {
      return null
    }

    if (matched) {
      return matched
    }

    const { regexp, keys } = compilePath(path, {
      end: exact,
      strict,
      sensitive
    })

    const match = regexp.exec(pathname)

    if (!match) {
      return null
    }

    const [url, ...values] = match
    const isExact = pathname === url

    if (exact && !isExact) {
      return null
    }

    return {
      path, // the path used to match
      url: path === '/' && url === '' ? '/' : url, // the matched portion of the URL
      isExact, // whether or not we matched exactly
      params: keys.reduce((memo: Dictionary<string>, key, index) => {
        memo[key.name] = values[index]
        return memo
      }, {})
    }
  }, null)
}

export function computeRootMatch(pathname: string): Match {
  return { path: '/', url: '/', params: {}, isExact: pathname === '/' }
}

export function matchRoutes(
  routes: KeyedRouteConfig[],
  pathname: string,
  branch: MatchedRoute[] = []): MatchedRoute[] {
  const len = routes.length
  for (let i = 0; i < len; i++) {
    const route = routes[i]
    const match = matchPath(pathname, route)
    if (match) {
      branch.push({ route, match })
      if (route.keyedRoutes) {
        matchRoutes(route.keyedRoutes, pathname, branch)
      }

      break
    }
  }

  return branch
}
