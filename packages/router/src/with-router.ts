import { AppNode, AppOptions } from '@pema/app'
import { RouterEnv } from './types'
import Router from './router'

export default function withRouter
  <TApp extends AppNode = AppNode>(options: AppOptions<RouterEnv, TApp>) {
  const plugin = (app: AppNode) => {
    return app.extend({
      router: [Router, options]
    })
  }

  return plugin
}
