import { AppPlugin, AppNode, AppOptions } from '@pema/app'
import { RouterEnv } from './types'
import Router from './router'

export default function withRouter
  <TApp extends AppNode = AppNode>(options: AppOptions<RouterEnv, TApp>) {
  const plugin = (app: AppNode) => {
    const result = app.extend({
      router: [Router, options]
    })

    return result
  }

  return plugin
}
