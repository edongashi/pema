import { Dictionary } from './types'

export default function getProps<TArg, TProps extends Dictionary = Dictionary>(
  app: TArg,
  props?: TProps | ((arg: TArg) => TProps),
  clone = true): TProps | Dictionary {
  if (props && typeof props === 'object') {
    return clone ? { ...props } : props
  }

  if (typeof props === 'function') {
    return props(app) || {}
  }

  return {}
}
