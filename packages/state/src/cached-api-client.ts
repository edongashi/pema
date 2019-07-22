import { AppNode } from '@pema/app'
import { matchResource } from './match-resource'
import { Action, ApiClient, Query, QueryOptions } from './types'

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

export class CachedApiClient implements ApiClient {
  private readonly app: App
  private cache: Map<string, CacheItem>

  constructor(todo: any, app: App) {
    this.app = app
    this.cache = new Map()
  }

  invalidate(resources: string[] | string) {
    if (!resources) {
      return
    }

    const { app, cache } = this
    if (resources === '*') {
      this.cache = new Map()
      app.emit('refetch', '*')
      return
    }

    if (typeof resources === 'string') {
      resources = [resources]
    }

    const now = Date.now()
    const resourcesLength = resources.length
    const entries = cache.entries()
    // Todo: organize cache in tree for performance
    for (const [key, value] of entries) {
      if (value.expires && now >= value.expires) {
        cache.delete(key)
        continue
      }

      for (let i = 0; i < resourcesLength; i++) {
        if (matchResource(resources[i], key)) {
          cache.delete(key)
          break
        }
      }
    }

    for (const pattern of resources) {
      app.emit('refetch', pattern)
    }
  }

  lookup<TResult>(query: Query<TResult>): TResult | undefined {
    if (!query.cache || !query.resource) {
      return undefined
    }

    const { cache } = this
    const item = cache.get(query.resource)
    if (item) {
      if (item.expires && Date.now() >= item.expires) {
        cache.delete(query.resource)
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
        this.cache.set(query.resource, {
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
