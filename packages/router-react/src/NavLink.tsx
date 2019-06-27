// Based on react-router. License https://github.com/ReactTraining/react-router/blob/master/LICENSE

import classNames from 'classnames'
import React, { FunctionComponent } from 'react'
import { useCurrentLocation } from './hooks'
import { Link, LinkProps } from './Link'

export interface NavLinkProps extends LinkProps {
  activeClassName?: string
  strict?: boolean
  exact?: boolean
  sensitive?: boolean
}

export const NavLink: FunctionComponent<NavLinkProps> = ({
  activeClassName,
  className: classNameProp,
  ...props
}) => {
  const current = useCurrentLocation()
  const className = current.router.isActive(props.to)
    ? classNames('NavLink', 'NavLink--active', activeClassName, classNameProp)
    : classNames('NavLink', classNameProp)
  return <Link className={className} {...props} />
}
