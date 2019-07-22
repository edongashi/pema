type EffectCallback = () => (void | (() => void | undefined))
type DependencyList = ReadonlyArray<any>

declare module 'use-deep-compare-effect' {
  export default function useDeepCompareEffect(effect: EffectCallback, deps?: DependencyList): void
}
