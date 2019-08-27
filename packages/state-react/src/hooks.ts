import { AppNode } from '@pema/app'
import { ApiClient, Action, Query, matchResource, resolve } from '@pema/state'
import { useApp } from '@pema/app-react'
import { invariant } from '@pema/utils'
import { useEffect, useState, useRef } from 'react'
import { ActionInvoker, QueryState, QueryResult, UseQueryOptions } from './types'

interface App extends AppNode {
  apiClient: ApiClient
}

export function useQuery<TResult>(
  query: Query<TResult, void>
): QueryResult<TResult>
export function useQuery<TResult, TParams>(
  query: Query<TResult, TParams>,
  params: TParams,
  options?: UseQueryOptions
): QueryResult<TResult>
export function useQuery<TResult, TParams>(
  query: Query<TResult, TParams>,
  params?: TParams,
  options?: UseQueryOptions
): QueryResult<TResult> {
  const resource = resolve(query.resource, params as TParams) as string
  invariant(typeof resource === 'string')

  // Context
  const {
    active = true,
    pollInterval = 0,
    pollCache = false
  } = options || {}
  const app = useApp<App>()

  // Fetch cycle
  // tslint:disable-next-line: variable-name
  const [fetchCycle, __setFetchCycle] = useState(0)
  const lookupCacheRef = useRef(true)
  function refetch(lookupCache = false) {
    lookupCacheRef.current = lookupCache
    __setFetchCycle(c => c + 1)
  }

  // State
  const initialData = fetchCycle === 0 ? app.apiClient.lookup<TResult>(resource) : undefined
  const [state, setState] = useState<QueryState<TResult>>({
    data: initialData as TResult,
    loading: typeof initialData === 'undefined',
    error: false
  })

  // Invalidation
  useEffect(() => {
    let cancel = false

    // Refetching
    function refetchHandler(pattern: string) {
      if (cancel) {
        return
      }

      if (matchResource(pattern, resource)) {
        refetch(true)
      }
    }

    // Optimistic updates
    function mapHandler(pattern: string, map: (value: TResult) => TResult) {
      if (cancel) {
        return
      }

      if (matchResource(pattern, resource)) {
        setState(current => (current.loading || current.error)
          ? current
          : { data: map(current.data), loading: false, error: false })
      }
    }

    app.events.on('apiClient.refetch', refetchHandler)
    app.events.on('apiClient.map', mapHandler)

    return () => {
      cancel = true
      app.events.off('apiClient.refetch', refetchHandler)
      app.events.off('apiClient.map', refetchHandler)
    }
  }, [app, resource])

  // Params ref
  const paramsRef = useRef(params)
  paramsRef.current = params

  // Polling
  const pollCacheRef = useRef(pollCache)
  pollCacheRef.current = pollCache

  useEffect(() => {
    if (!active || typeof pollInterval !== 'number' || pollInterval <= 0) {
      return
    }

    const timeoutId = setTimeout(() => refetch(pollCacheRef.current), pollInterval)
    return () => clearTimeout(timeoutId)
  }, [active, fetchCycle, pollInterval])

  // Fetching
  useEffect(() => {
    if (!active) {
      return
    }

    let cancel = false
    async function fetch() {
      try {
        const data = await app.apiClient.query(query, paramsRef.current as TParams, {
          lookupCache: lookupCacheRef.current
        })

        if (cancel) {
          return
        }

        setState({
          data,
          loading: false,
          error: false
        })
      } catch (error) {
        if (cancel) {
          return
        }

        setState(current => ({
          data: current.data,
          loading: false,
          error: error || true
        }))
      }
    }

    fetch()
    return () => {
      cancel = true
    }
  }, [active, fetchCycle, query, resource])

  const result = {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    ready: !state.loading && !state.error,
    read(): TResult {
      if (state.error) {
        throw state.error
      }

      return typeof state.data !== 'undefined'
        ? state.data
        : app.apiClient.suspend(query, params as TParams) as TResult
    },
    preload() {
      app.apiClient.query(query, params as TParams)
      return result
    }
  }

  return result
}

const dummySchema = {
  async validate(value: any) {
    return value
  },
  validateSync(value: any) {
    return value
  },
  async isValid() {
    return true
  },
  isValidSync() {
    return true
  }
}

export function useAction
  <TParams, TResult>(action: Action<TParams, TResult>):
  ActionInvoker<TParams, TResult> {
  const app = useApp<App>()
  function invoke(params: TParams): Promise<TResult> {
    return app.apiClient.action(action, params)
  }

  const schema = action.schema || dummySchema
  invoke.schema = schema
  return (invoke as any) as ActionInvoker<TParams, TResult>
}
