import { AppNode } from '@pema/app'
import { RoutingTable, View, Controller, ActionParams } from './types'
import { view, redirect, allow, controller, route, delay, lazy } from './actions'
import { Dictionary, JValue } from '@pema/utils'

const Something = () => null

async function authenticate() {
  return allow()
}

const routes: RoutingTable = {
  '/': view(Something),
  '/home': redirect('/'),
  '/students': redirect('/students/list'),
  '/help': [authenticate],
  '/hello': route([authenticate, view(Something)]),
  '/students/list': [delay(authenticate), view(Something)],
  // 'students/add': [view(Something)],
  // 'students/info/:id': [authenticate, view(Something)],
  // '/login': route({}, {
  //   '/students': route([view(Something), delay(() => view(Something))], {})
  // })
}
