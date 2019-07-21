export interface Query<TResult> {
  readonly resource?: string
  readonly cache?: boolean | number
  readonly progress?: boolean
  readonly params?: {}
  fetch(app: any): Promise<TResult>
}

export interface Action<TResult> {
  readonly invalidates?: string[]
  readonly progress?: boolean
  perform(app: any): Promise<TResult>
}
