// Minimal EventEmitter shim for browser use (function-constructor style)
// Compatible with libraries that do `EventEmitter.call(this, ...)`.

function EventEmitter() {
  // Use a simple object map to be compatible with function-style inheritance
  this._events = Object.create(null);
}

EventEmitter.prototype.on = function (event, listener) {
  const arr = this._events[event] || (this._events[event] = []);
  arr.push(listener);
  return this;
};

EventEmitter.prototype.addListener = function (event, listener) {
  return this.on(event, listener);
};

EventEmitter.prototype.once = function (event, listener) {
  const self = this;
  function wrapper() {
    self.off(event, wrapper);
    return listener.apply(self, arguments);
  }
  // keep reference for removeListener semantics
  wrapper.listener = listener;
  return this.on(event, wrapper);
};

EventEmitter.prototype.off = function (event, listener) {
  const arr = this._events[event];
  if (!arr) return this;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === listener || arr[i].listener === listener) {
      arr.splice(i, 1);
      break;
    }
  }
  if (arr.length === 0) delete this._events[event];
  return this;
};

EventEmitter.prototype.removeListener = function (event, listener) {
  return this.off(event, listener);
};

EventEmitter.prototype.removeAllListeners = function (event) {
  if (typeof event === 'undefined') {
    this._events = Object.create(null);
  } else {
    delete this._events[event];
  }
  return this;
};

EventEmitter.prototype.emit = function (event) {
  const arr = this._events[event];
  if (!arr || arr.length === 0) return false;
  const args = Array.prototype.slice.call(arguments, 1);
  // copy to avoid mutation during emit
  for (const fn of arr.slice()) fn.apply(this, args);
  return true;
};

EventEmitter.prototype.listeners = function (event) {
  const arr = this._events[event] || [];
  return arr.slice();
};

// Common patterns expect both default export and named .EventEmitter
module.exports = EventEmitter;
module.exports.EventEmitter = EventEmitter;
module.exports.default = EventEmitter;