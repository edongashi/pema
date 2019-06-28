import { AppNode } from '@pema/app'
import { useApp, useEvent } from '@pema/app-react'
import { Controller, Router, RouterState } from '@pema/router'
import { invariant } from '@pema/utils'

interface RouterApp extends AppNode {
  router: Router
}

export function useRouter(): Router {
  const { router } = useApp<RouterApp>()
  invariant(router, 'Router not found in app instance.')
  return router
}

export function useCurrentLocation(): RouterState {
  const router = useRouter()
  useEvent('router.current')
  return router.current
}

export function useController<TController extends Controller>(): TController {
  return useCurrentLocation().controller as TController
}
