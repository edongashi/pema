import { useEvent } from './hooks'
import { invariant } from '@pema/utils'

export type ListenerRenderProps =
  | { render: () => JSX.Element }
  | { children: () => JSX.Element }

export type ListenerProps = { event: string } & ListenerRenderProps

export function Listener(props: ListenerProps) {
  useEvent(props.event)
  if ('render' in props) {
    return props.render()
  }

  if ('children' in props) {
    return props.children()
  }

  invariant(false, 'Required render or children property.')
}
