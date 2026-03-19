/**
 * PyBridge — transparent type conversion between JS and Python (Pyodide).
 *
 * Injects a Python-side bridge script that wraps step functions so that
 * JS objects are automatically converted to Python dicts before the user's
 * step function is called. Neither side needs to know about the other.
 *
 * Flow:
 * 1. UMD load → injectPythonBridge() inserts <script type="py"> into DOM
 * 2. PyScript processes it before user scripts (document order)
 * 3. Python bridge redefines window.registerPythonSystem to wrap step functions
 * 4. User's Python code calls registerPythonSystem as normal
 * 5. The wrapper converts JsProxy args to Python dicts, calls real step,
 *    and returns the result
 */

const PYTHON_BRIDGE = `
def _dynsim_init_bridge():
    from pyscript import window as _w
    from pyodide.ffi import create_proxy, to_js
    from js import Object

    _js_register = _w._dynsimJsRegister

    def _register(container_id, step_fn, config):
        def wrapped_step(x, state, params):
            # Convert JS inputs to Python dicts
            s = state.to_py() if hasattr(state, 'to_py') else state
            p = params.to_py() if hasattr(params, 'to_py') else params
            result = step_fn(float(x), s, p)
            # Convert Python outputs to plain JS objects
            return to_js(result, dict_converter=Object.fromEntries)
        # create_proxy prevents the wrapped function from being garbage collected
        # after this call returns — it's called repeatedly from requestAnimationFrame
        _js_register(container_id, create_proxy(wrapped_step), config)

    _w.registerPythonSystem = _register

_dynsim_init_bridge()
del _dynsim_init_bridge
`;

/**
 * Inject the Python bridge script into the DOM.
 * Must be called synchronously during UMD script load (before PyScript processes scripts).
 */
export function injectPythonBridge() {
  const script = document.createElement('script');
  script.type = 'py';
  script.textContent = PYTHON_BRIDGE;
  // Insert as first child of <head> so it runs before user's <script type="py"> tags
  document.head.insertBefore(script, document.head.firstChild);
}

/**
 * Convert a Python proxy value to a plain JS value.
 */
export function pyToJs(value) {
  if (value != null && typeof value.toJs === 'function') {
    try {
      return value.toJs({ dict_converter: Object.fromEntries });
    } catch {
      try { return value.toJs(); } catch {}
    }
  }
  return value;
}
