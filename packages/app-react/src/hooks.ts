import { useContext, useState, useLayoutEffect } from 'react'
import { AppNode } from '@pema/app'
import { invariant } from '@pema/utils'
import AppContext from './context'

export function useApp<TApp extends AppNode = AppNode>(): TApp {
  const app = useContext(AppContext)
  invariant(app, 'No application context found.')
  return app as TApp
}

export function useEvent(event: string): void {
  const [, forceUpdate] = useState(0)
  const app = useApp()
  useLayoutEffect(function () {
    function listen() {
      forceUpdate(x => 1 - x)
    }

    if (typeof event === 'string') {
      app.events.on(event, listen)
      return () => app.events.off(event, listen)
    }
  }, [event, app])
}
