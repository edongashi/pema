import { JObject } from '@pema/utils'

export interface AuthStore {
  readonly authenticated: boolean
  readonly claims: JObject
  signOut(): Promise<void>
}
