import { AppNode } from '@pema/app'
import { Session } from '@pema/session'
import { JValue, JObject } from '@pema/utils'
import { UserStore } from './types'

export interface UserStoreEnv {
  session: Session
}

export default class UserStoreImpl implements UserStore {
  private session: Session
  private _claims: JObject

  get authenticated(): boolean {
    return !!this._claims.authenticated
  }

  get claims(): JObject {
    return this._claims
  }

  signIn(claims: JObject): Promise<void> {
    throw new Error('Method not implemented.');
  }

  signOut(): Promise<void> {
    return this.session.remove('auth.claims')
  }

  async refresh() {
    this._claims = (await this.session.get('auth.claims') || {}) as JObject
  }

  constructor(state: JValue, app: AppNode, env: UserStoreEnv) {
    this._claims = {}
    this.session = env.session
  }
}
