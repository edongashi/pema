import { AppNode } from '@pema/app'
import { ApiClient, Action, Query, matchResource } from '@pema/state'
import { useApp } from '@pema/app-react'
import { useEffect, useState, useRef } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import { ActionInvoker, QueryState, QueryResult, UseQueryOptions } from './types'

interface App extends AppNode {
  apiClient: ApiClient
}

const noParams = {}

export function useQuery<TResult>
  (query: Query<TResult>, options: UseQueryOptions = {}): QueryResult<TResult> {
  // Context
  const {
    active = true,
    pollInterval = 0,
    pollCache = false
  } = options
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
  const initialData = fetchCycle === 0 ? app.apiClient.lookup(query) : undefined
  const [state, setState] = useState<QueryState<TResult>>({
    data: initialData as TResult,
    loading: typeof initialData === 'undefined',
    error: false
  })

  // Invalidation
  const resourceId = query.resource || '*'
  useEffect(() => {
    let cancel = false

    // Refetching
    function refetchHandler(pattern: string) {
      if (cancel) {
        return
      }

      if (matchResource(pattern, resourceId)) {
        refetch(true)
      }
    }

    // Optimistic updates
    function mapHandler(pattern: string, map: (value: TResult) => TResult) {
      if (cancel) {
        return
      }

      if (matchResource(pattern, resourceId)) {
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
  }, [app, resourceId])

  // Polling
  const pollCacheRef = useRef(pollCache)
  useEffect(() => {
    pollCacheRef.current = pollCache
  }, [pollCache])

  useEffect(() => {
    if (!active || typeof pollInterval !== 'number' || pollInterval <= 0) {
      return
    }

    const timeoutId = setTimeout(() => refetch(pollCacheRef.current), pollInterval)
    return () => clearTimeout(timeoutId)
  }, [active, fetchCycle, pollInterval])

  // Fetching
  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

  useDeepCompareEffect(() => {
    if (!active) {
      return
    }

    let cancel = false
    async function fetch() {
      try {
        const data = await app.apiClient.query(queryRef.current, {
          allowProgress: true,
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
  }, [active, fetchCycle, query.params || noParams])

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    ready: !state.loading && !state.error
  }
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
