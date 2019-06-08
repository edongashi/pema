import { AppPlugin, AppNode } from '@pema/app'
import { Options } from '@pema/utils';
import { RouterEnv } from './types'
import Router from './router'

export default function withRouter
  <TApp extends AppNode = AppNode>(options: Options<RouterEnv, TApp>) {
  const plugin: AppPlugin = (app: AppNode) => {
    return app.extend({
      router: [Router, options]
    })
  }

  return plugin
}
