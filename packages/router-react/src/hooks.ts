import { AppNode } from '@pema/app'
import { useApp } from '@pema/app-react'
import { Router } from '@pema/router'
import { invariant } from '@pema/utils'

interface RouterApp extends AppNode {
  router: Router
}

export function useRouter(): Router {
  const { router } = useApp<RouterApp>()
  invariant(router, 'Router not found in app instance.')
  return router
}
