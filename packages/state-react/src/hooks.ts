import { AppNode } from '@pema/app'
import { ApiClient, Action, Query, matchResource } from '@pema/state'
import { useApp } from '@pema/app-react'
import { invariant } from '@pema/utils'
import { useEffect, useState, useRef, useMemo } from 'react'
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
  const resource = typeof query.resource === 'function'
    ? query.resource(params as TParams)
    : query.resource as string
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
    reloading: false,
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
          : { data: map(current.data), loading: false, error: false, reloading: false })
      }
    }

    function matchHandler(pattern: string | string[], fetchers: Array<() => Promise<any>>) {
      if (cancel) {
        return
      }

      if (typeof pattern === 'string') {
        pattern = [pattern]
      }

      if (pattern.some(p => matchResource(p, resource))) {
        fetchers.push(() => app.apiClient.query(query, paramsRef.current as TParams, {
          lookupCache: true,
          allowProgress: false
        }))
      }
    }

    app.events.on('apiClient.refetch', refetchHandler)
    app.events.on('apiClient.map', mapHandler)
    app.events.on('apiClient.match', matchHandler)

    return () => {
      cancel = true
      app.events.off('apiClient.refetch', refetchHandler)
      app.events.off('apiClient.map', refetchHandler)
      app.events.off('apiClient.match', matchHandler)
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
        setState(current => current.loading ? current : {
          data: current.data,
          loading: false,
          error: current.error,
          reloading: true
        })

        const data = await app.apiClient.query(query, paramsRef.current as TParams, {
          lookupCache: lookupCacheRef.current
        })

        if (cancel) {
          return
        }

        setState({
          data,
          loading: false,
          error: false,
          reloading: false
        })
      } catch (error) {
        if (cancel) {
          return
        }

        setState(current => ({
          data: current.data,
          loading: false,
          error: error || true,
          reloading: false
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
    reloading: state.reloading || state.loading,
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
  const invokeMemo = useMemo(() => {
    function invoke(params: TParams): Promise<TResult> {
      return app.apiClient.action(action, params)
    }

    const schema = action.schema || dummySchema
    invoke.schema = schema
    return invoke
  }, [action])

  return (invokeMemo as any) as ActionInvoker<TParams, TResult>
}

export function useLoadingAction
  <TParams, TResult>(action: Action<TParams, TResult>):
  [ActionInvoker<TParams, TResult>, boolean] {
  const [loading, setLoading] = useState(false)
  const callRef = useRef(0)
  const app = useApp<App>()
  useEffect(() => () => { callRef.current = -1 }, [])
  const invokeMemo = useMemo(() => {
    async function invoke(params: TParams): Promise<TResult> {
      const current = ++callRef.current
      setLoading(true)
      try {
        return await app.apiClient.action(action, params)
      } finally {
        if (callRef.current === current) {
          setLoading(false)
        }
      }
    }

    const schema = action.schema || dummySchema
    invoke.schema = schema
    return invoke
  }, [action])
  return [(invokeMemo as any) as ActionInvoker<TParams, TResult>, loading]
}
