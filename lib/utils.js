"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getProps(app, props, clone = true) {
    if (props && typeof props === 'object') {
        return clone ? Object.assign({}, props) : props;
    }
    if (typeof props === 'function') {
        return props(app) || {};
    }
    return {};
}
exports.getProps = getProps;
const isProduction = process.env.NODE_ENV === 'production';
function warning(condition, message) {
    if (!isProduction) {
        if (condition) {
            return;
        }
        const text = `Warning: ${message}`;
        if (typeof console !== 'undefined') {
            console.warn(text);
        }
        try {
            throw Error(text);
        }
        catch (x) { }
    }
}
exports.warning = warning;
function invariant(condition, message) {
    if (condition) {
        return;
    }
    if (isProduction) {
        throw new Error('Invariant failed');
    }
    else {
        throw new Error(`Invariant failed: ${message || ''}`);
    }
}
exports.invariant = invariant;
