var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { toJS, action } from "mobx";
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
        this.__dispatch(event);
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
                    result[key] = toJS(val);
                }
            }
        }
        return result;
    }
}
__decorate([
    action
], AppNodeImpl.prototype, "dispatch", null);
export function app(state) {
    return new AppNodeImpl(null, state);
}
export function withEnv(constructor, env) {
    return [constructor, env];
}
