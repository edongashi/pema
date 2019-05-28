/*
 * MIT License
 *
 * Copyright (c) React Training 2016-2018
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import pathToRegexp, { Key } from 'path-to-regexp'
import { Match, MatchedRoute, MatchOptions, RouteConfig } from './types'

interface StringMap<TValue> {
  [key: string]: TValue
}

interface CompiledRegexp {
  regexp: RegExp,
  keys: Key[]
}

const cache: StringMap<StringMap<CompiledRegexp>> = {}
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
    exact = false,
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
      params: keys.reduce((memo: StringMap<string>, key, index) => {
        memo[key.name] = values[index]
        return memo
      }, {})
    }
  }, null)
}

function computeRootMatch(pathname: string) {
  return { path: '/', url: '/', params: {}, isExact: pathname === '/' }
}

export function matchRoutes(
  routes: RouteConfig[],
  pathname: string,
  branch: MatchedRoute[] = []): MatchedRoute[] {
  routes.some(route => {
    const match = route.path
      ? matchPath(pathname, route)
      : branch.length
        ? branch[branch.length - 1].match // use parent match
        : computeRootMatch(pathname) // use default 'root' match

    if (match) {
      branch.push({ route, match })
      if (route.routes) {
        matchRoutes(route.routes, pathname, branch)
      }
    }

    return !!match
  })

  return branch
}
