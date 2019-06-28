// Based on react-router. License https://github.com/ReactTraining/react-router/blob/master/LICENSE

import { Path } from '@pema/router'
import { Dictionary } from '@pema/utils'
import classNames from 'classnames'
import React, { FunctionComponent, useEffect } from 'react'
import { useRouter } from './hooks'

function isModifiedEvent(event: React.MouseEvent) {
  return !!(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: Path
  replace?: boolean
  prefetch?: boolean
  innerRef?: React.Ref<HTMLAnchorElement>
}

export const Link: FunctionComponent<LinkProps> = ({
  to,
  replace,
  prefetch,
  className,
  innerRef,
  onClick,
  ...props
}) => {
  const router = useRouter()
  useEffect(() => {
    if (prefetch && (to || to === '')) {
      router.prefetch(to)
    }
  }, [router, to, prefetch])

  const { target } = props
  const href = to ? router.createHref(to) : ''
  return (
    <a
      {...props}
      className={classNames('Link', className)}
      href={href}
      ref={innerRef}
      onClick={event => {
        try {
          if (onClick) {
            onClick(event)
          }
        } catch (ex) {
          event.preventDefault()
          throw ex
        }

        if (
          !event.defaultPrevented && // onClick prevented default
          event.button === 0 && // ignore everything but left clicks
          (!target || target === '_self') && // let browser handle "target=_blank" etc.
          !isModifiedEvent(event) // ignore clicks with modifier keys
        ) {
          event.preventDefault()
          if (to) {
            if (replace) {
              router.replace(to)
            } else {
              router.push(to)
            }
          }
        }
      }}
    />
  )
}
