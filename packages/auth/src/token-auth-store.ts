import { AppNode } from '@pema/app'
import { Session } from '@pema/session'
import { JValue, JObject } from '@pema/utils'
import { AuthStore } from './types'

export interface AuthStoreEnv {
  session: Session
}

export default class TokenAuthStore implements AuthStore {
  private session: Session
  private _claims: JObject

  get authenticated(): boolean {
    return !!this._claims.authenticated
  }

  get claims(): JObject {
    return this._claims
  }

  signOut(): Promise<void> {
    return this.session.remove('auth.claims')
  }

  async refresh() {
    this._claims = (await this.session.get('auth.claims') || {}) as JObject
  }

  constructor(state: JValue, app: AppNode, env: AuthStoreEnv) {
    this._claims = {}
    this.session = env.session
  }
}
