"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mobx_1 = require("mobx");
class AppNodeImpl {
    constructor(root = null, state = {}, env = {}, volatile = {}) {
        this.__root = root || this;
        this.__state = state;
        this.__env = env;
        this.__volatile = volatile;
    }
    get root() {
        return this.__root;
    }
    get env() {
        return this.__root.__env;
    }
    get volatile() {
        return this.__root.__volatile;
    }
    toJSON() {
        return this.__serialize();
    }
    extend(services) {
        if (typeof services === 'object') {
            const node = this;
            const root = node.__root;
            const state = node.__state;
            for (const key in services) {
                let val = services[key];
                let env = {};
                if (Array.isArray(val)) {
                    const arr = val;
                    val = arr[0];
                    env = arr[1] || {};
                }
                if (typeof val === 'function') {
                    if (key in node) {
                        continue;
                    }
                    if (typeof env === 'function') {
                        env = env(root);
                    }
                    if (typeof val.dependencies === 'object') {
                        root.extend(val.dependencies);
                    }
                    const instance = new val(state[key] || {}, root, env);
                    Object.defineProperty(instance, '$app', {
                        enumerable: false,
                        configurable: true,
                        writable: true,
                        value: root
                    });
                    node[key] = instance;
                    state[key] = null;
                }
                else if (val && typeof val === 'object') {
                    let child = node[key];
                    if (!child) {
                        child = new AppNodeImpl(root, state[key]);
                        state[key] = null;
                        node[key] = child;
                    }
                    child.extend(val);
                }
            }
            return this;
        }
        else if (typeof services === 'function') {
            return services(this) || this;
        }
        else {
            return this;
        }
    }
    dispatch(event) {
        mobx_1.runInAction(() => this.__dispatch(event));
    }
    __dispatch(action) {
        for (const key in this) {
            if (key.indexOf('__') === 0) {
                continue;
            }
            const val = this[key];
            if (val instanceof AppNodeImpl) {
                val.__dispatch(action);
            }
            else if (val) {
                if (typeof val.handleEvent === 'function') {
                    val.handleEvent(action);
                }
            }
        }
    }
    __serialize(context) {
        const result = {};
        const state = this.__state;
        for (const key in state) {
            const val = state[key];
            if (val) {
                result[key] = val;
            }
        }
        for (const key in this) {
            if (key.indexOf('__') === 0) {
                continue;
            }
            const val = this[key];
            if (val instanceof AppNodeImpl) {
                result[key] = val.__serialize(context);
            }
            else if (val) {
                if (typeof val.serialize === 'function') {
                    result[key] = val.serialize(context);
                }
                else {
                    result[key] = mobx_1.toJS(val);
                }
            }
        }
        return result;
    }
}
function app(state) {
    return new AppNodeImpl(null, state);
}
exports.app = app;
function withEnv(constructor, env) {
    return [constructor, env];
}
exports.withEnv = withEnv;
