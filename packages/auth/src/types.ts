import { JObject } from '@pema/utils'

export interface UserStore {
  readonly claims: JObject
  signIn(claims: JObject): Promise<void>
  signOut(): Promise<void>
}
