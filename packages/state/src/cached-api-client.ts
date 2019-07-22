import { AppNode } from '@pema/app'
import { Dictionary } from '@pema/utils'
import { Action, ApiClient, Query, QueryOptions } from './types'
import { normalizeResource } from './resource-utils'

interface App extends AppNode {
  progress?: {
    start(): void
    done(): void
  }
}

interface CacheItem {
  expires: number | false
  value: any
}

function asKey(id: string) {
  return id === '*' ? '__ROOT__' : id
}

export class CachedApiClient implements ApiClient {
  private readonly app: App
  private cache: Dictionary<Map<string, CacheItem>>

  constructor(todo: any, app: App) {
    this.app = app
    this.cache = {}
  }

  invalidate(resources: string[] | string) {
    if (!resources) {
      return
    }

    const { app } = this
    if (resources === '*') {
      this.cache = {}
      app.emit('refetch', '*')
      return
    }

    if (typeof resources === 'string') {
      resources = [resources]
    }

    const paths = resources.map(normalizeResource)
    for (const [type, id] of paths) {
      const map = this.cache[type]
      if (map) {
        if (id === '*') {
          map.clear()
        } else {
          map.delete(id)
        }
      }
    }

    for (const [type, id] of paths) {
      app.emit('refetch', type + '/' + id)
    }
  }

  lookup<TResult>(query: Query<TResult>): TResult | undefined {
    if (!query.cache || !query.resource) {
      return undefined
    }

    const [type, id] = normalizeResource(query.resource)
    const map = this.cache[type]
    if (!map) {
      return undefined
    }

    const key = asKey(id)
    const item = map.get(key)
    if (item) {
      if (item.expires && Date.now() >= item.expires) {
        map.delete(key)
        return undefined
      }

      return item.value
    } else {
      return undefined
    }
  }

  async query<TResult>(query: Query<TResult>, options: QueryOptions = {}): Promise<TResult> {
    const {
      allowProgress = false,
      lookupCache = true
    } = options

    let result = lookupCache ? this.lookup(query) : undefined
    if (typeof result !== 'undefined') {
      return result
    }

    const progress = (allowProgress && query.progress)
      ? this.app.progress
      : null

    if (progress) {
      progress.start()
    }

    try {
      result = await query.fetch(this.app)
      if (typeof result === 'undefined') {
        result = (null as any) as TResult
      }

      if (query.cache && query.resource) {
        const [type, id] = normalizeResource(query.resource)
        let map = this.cache[type]
        if (!map) {
          map = new Map<string, CacheItem>()
          this.cache[type] = map
        }

        const key = asKey(id)
        map.set(key, {
          value: result,
          expires: query.cache === true
            ? false
            : Date.now() + query.cache * 1000
        })
      }

      return result
    } finally {
      if (progress) {
        progress.done()
      }
    }
  }

  async action<TParams, TResult>
    (action: Action<TParams, TResult>, params: TParams): Promise<TResult> {
    const { app } = this
    const progress = action.progress ? app.progress : null
    if (progress) {
      progress.start()
    }

    try {
      const result = await action.perform(params, app)
      if (action.invalidates) {
        const resources = typeof action.invalidates === 'function'
          ? action.invalidates(params, app)
          : action.invalidates
        this.invalidate(resources)
      }

      return result
    } finally {
      if (progress) {
        progress.done()
      }
    }
  }
}
