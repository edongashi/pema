import { Path } from '@pema/router'
import { FunctionComponent, useEffect } from 'react'
import { useRouter } from './hooks'

export interface PrefetchProps {
  path: Path
}

export const Prefetch: FunctionComponent<PrefetchProps> = ({ path }) => {
  const router = useRouter()
  useEffect(() => {
    if (path) {
      router.prefetch(path)
    }
  }, [router, path])
  return null
}
