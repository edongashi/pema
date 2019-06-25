import { useContext, useState, useLayoutEffect } from 'react'
import { AppNode } from '@pema/app'
import { invariant } from '@pema/utils'
import get from 'lodash.get'
import AppContext from './context'

export function useApp<TApp extends AppNode = AppNode>(): TApp {
  const app = useContext(AppContext)
  invariant(app, 'No application context found.')
  return app as TApp
}

export function useValue<T>(key: string): T {
  const app = useApp()
  const [value, setValue] = useState(() => get(app, key) as T)
  useLayoutEffect(function () {
    function listen(newValue: T) {
      setValue(newValue)
    }

    if (typeof key === 'string') {
      app.events.on(key, listen)
      return () => app.events.off(key, listen)
    }
  }, [key, app])

  return value
}

export function useEvent(event: string): void {
  const [, forceUpdate] = useState(0)
  const app = useApp()
  useLayoutEffect(function () {
    function listen() {
      forceUpdate(x => (x + 1) % 10)
    }

    if (typeof event === 'string') {
      app.events.on(event, listen)
      return () => app.events.off(event, listen)
    }
  }, [event, app])
}
