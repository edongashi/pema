import { AppNode } from '@pema/app'
import { createContext } from 'react'

export default createContext<AppNode | null>(null)
