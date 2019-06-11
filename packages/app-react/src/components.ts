import { useValue, useEvent } from './hooks'
import { invariant } from '@pema/utils'

type ReaderRenderProps<T> =
  | { render: (value: T) => JSX.Element }
  | { children: (value: T) => JSX.Element }

export type ReaderProps<T> = { key: string } & ReaderRenderProps<T>

export type ListenerRenderProps =
  | { render: () => JSX.Element }
  | { children: () => JSX.Element }

export type ListenerProps = { event: string } & ListenerRenderProps

export function Reader<T = any>(props: ReaderProps<T>) {
  const value = useValue<T>(props.key)
  if ('render' in props) {
    return props.render(value)
  }

  if ('children' in props) {
    return props.children(value)
  }

  invariant(false, 'Required render or children property.')
}

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
