import { AppNode } from '@pema/app'
import { invariant } from '@pema/utils'
import { matchResource } from './match-resource'
import { Action, ApiClient, Query, QueryOptions, MaybeComputed } from './types'

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

export interface UpdateMap {
  [resource: string]: (context: any) => any
}

export function resolve<T, TParam>(value: MaybeComputed<T, TParam> | undefined, param: TParam): T | undefined {
  if (typeof value === 'function') {
    return (value as (param: TParam) => T)(param)
  } else {
    return value
  }
}

enum PromiseState {
  Pending = 0,
  Resolved = 1,
  Rejected = 2
}

interface TrackedPromise {
  promise: Promise<any>
  state: PromiseState
  value: any
}

const INFLIGHT_DURATION = 3_000

export class CachedApiClient implements ApiClient {
  protected readonly app: App
  private readonly inflight: Map<string, TrackedPromise>
  private readonly cache: Map<string, CacheItem>

  constructor(state: any, app: App) {
    this.app = app
    this.cache = new Map()
    this.inflight = new Map()
  }

  invalidate(resources: string[] | string, refetch = true) {
    if (!resources) {
      return
    }

    const { app, cache, inflight } = this
    if (resources === '*') {
      this.cache.clear()
      this.inflight.clear()
      app.emit('apiClient.refetch', '*')
      return
    }

    if (typeof resources === 'string') {
      resources = [resources]
    }

    const resourcesLength = resources.length

    const inflightKeys = inflight.keys()
    for (const key of inflightKeys) {
      for (let i = 0; i < resourcesLength; i++) {
        if (matchResource(resources[i], key)) {
          inflight.delete(key)
          break
        }
      }
    }

    const entries = cache.entries()
    const now = Date.now()
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

    if (refetch) {
      for (const pattern of resources) {
        app.emit('apiClient.refetch', pattern)
      }
    }
  }

  refetch(resources: string[] | string) {
    if (!resources) {
      return
    }

    const { app } = this
    if (typeof resources === 'string') {
      app.emit('apiClient.refetch', resources)
    } else {
      const resourcesLength = resources.length
      for (let i = 0; i < resourcesLength; i++) {
        app.emit('apiClient.refetch', resources[i])
      }
    }
  }

  lookup<TResult>(resource: string): TResult | undefined {
    const { cache } = this
    const item = cache.get(resource)
    if (item) {
      if (item.expires && Date.now() >= item.expires) {
        cache.delete(resource)
        return undefined
      }

      return item.value
    } else {
      return undefined
    }
  }

  protected fetch<TResult, TParams>(query: Query<TResult, TParams>, params: TParams): Promise<TResult> {
    return query.fetch(params, this.app)
  }

  private async fetchWrapper<TResult, TParams>(
    query: Query<TResult, TParams>,
    resource: string,
    params: TParams
  ): Promise<TResult> {
    let result: TResult
    try {
      result = await this.fetch(query, params)
      if (typeof result === 'undefined') {
        result = null as any
      }

      let cache = resolve(query.cache, params)
      if (typeof cache === 'undefined') {
        cache = true
      }

      if (cache) {
        this.cache.set(resource, {
          value: result,
          expires: cache === true
            ? false
            : Date.now() + cache * 1000
        })
      }

      return result
    } catch (error) {
      if (query.onError) {
        query.onError({
          error,
          app: this.app,
          apiClient: this,
          query,
          params
        })
      }

      throw error
    }
  }

  query<TResult>(query: Query<TResult>): Promise<TResult>
  query<TResult, TParams>(query: Query<TResult, TParams>, params: TParams, options?: QueryOptions): Promise<TResult>
  async query<TResult, TParams>(
    query: Query<TResult, TParams>,
    params?: TParams,
    options: QueryOptions = {}
  ): Promise<TResult> {
    const {
      allowProgress = true,
      lookupCache = true
    } = options
    const resource = resolve(query.resource, params as TParams) as string
    invariant(typeof resource === 'string')

    const cached = lookupCache ? this.lookup<TResult>(resource) : undefined
    if (typeof cached !== 'undefined') {
      return cached
    }

    const progress = (allowProgress && resolve(query.progress, params as TParams))
      ? this.app.progress
      : null

    let promise: Promise<TResult>
    const { inflight } = this
    let state = inflight.get(resource) as TrackedPromise
    if (state && state.state === PromiseState.Pending) {
      promise = state.promise
    } else {
      state = { state: PromiseState.Pending } as TrackedPromise

      function terminateWith(value: any, promiseState: PromiseState) {
        state.state = promiseState
        state.value = value
        setTimeout(() => {
          if (inflight.get(resource) === state) {
            inflight.delete(resource)
          }
        }, INFLIGHT_DURATION)
      }

      promise = this
        .fetchWrapper(query, resource, params as TParams)
        .then(res => {
          terminateWith(res, PromiseState.Resolved)
          return res
        }, err => {
          terminateWith(err, PromiseState.Rejected)
          throw err
        })

      state.promise = promise
      inflight.set(resource, state)
    }

    if (progress) {
      progress.start()
    }

    try {
      return await promise
    } finally {
      if (progress) {
        progress.done()
      }
    }
  }

  suspend<TResult>(query: Query<TResult>): TResult
  suspend<TResult, TParams>(query: Query<TResult, TParams>, params: TParams): TResult
  suspend<TResult, TParams>(
    query: Query<TResult, TParams>,
    params?: TParams
  ): TResult {
    const resource = resolve(query.resource, params as TParams) as string
    invariant(typeof resource === 'string')
    const item = this.lookup<TResult>(resource)
    if (typeof item !== 'undefined') {
      return item
    }

    const state = this.inflight.get(resource)
    if (state) {
      switch (state.state) {
        case PromiseState.Pending:
          throw state.promise
        case PromiseState.Resolved:
          return state.value
        case PromiseState.Rejected:
          throw state.value
      }
    }

    throw this.query(query, params as TParams, {
      lookupCache: false
    })
  }

  protected perform<TParams, TResult>(action: Action<TParams, TResult>, params: TParams): Promise<TResult> {
    return action.perform(params, this.app)
  }

  action<TResult>(action: Action<void, TResult>): Promise<TResult>
  action<TParams, TResult>(action: Action<TParams, TResult>, params: TParams): Promise<TResult>
  async action<TParams, TResult>(
    action: Action<TParams, TResult>,
    params?: TParams
  ): Promise<TResult> {
    if (action.schema) {
      params = await action.schema.validate(params as TParams) || params
    }

    const apiClient = this
    const { app } = this
    const progress = resolve(action.progress, {
      params: params as TParams,
      action,
      apiClient,
      app
    }) ? app.progress : null

    if (progress) {
      progress.start()
    }

    function runHook(map: UpdateMap | ((ctx: any) => UpdateMap) | void, additionalProps: {}) {
      if (!map) {
        return
      }

      const baseContext = {
        params,
        app,
        apiClient,
        action,
        ...additionalProps
      }

      if (typeof map === 'function') {
        map = map(baseContext)
        if (!map) {
          return
        }
      }

      // tslint:disable-next-line: forin
      for (const resource in map) {
        const update = map[resource]
        function wrapper(value: any) {
          const mappedValue = update({
            ...baseContext,
            resource,
            value,
          })

          if (typeof mappedValue === 'undefined') {
            return value
          } else {
            return mappedValue
          }
        }

        if (typeof update === 'function') {
          app.emit('apiClient.map', resource, wrapper)
        }
      }
    }

    try {
      runHook(action.optimistic, {})
      const result = await this.perform(action, params as TParams)
      runHook(action.onSuccess, { result })
      if (action.invalidates) {
        const resources = typeof action.invalidates === 'function'
          ? action.invalidates({ params: params as TParams, app, apiClient, action, result })
          : action.invalidates
        this.invalidate(resources)
      }

      return result
    } catch (error) {
      runHook(action.onError, { error })
      if (action.optimistic) {
        this.refetch(Object.keys(action.optimistic))
      }

      throw error
    } finally {
      if (progress) {
        progress.done()
      }
    }
  }
}
