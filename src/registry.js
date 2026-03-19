/**
 * Registry for step functions, keyed by container ID.
 *
 * Supports live replacement: update a step function at any time
 * and the next simulation tick will pick it up via the stepProvider pattern.
 */

const systems = {};

/**
 * Ensure a value is a plain JS object (not a PyProxy or other foreign wrapper).
 * Uses Pyodide's toJs() if available, otherwise falls back to JSON round-trip.
 */
function toPlainObject(value) {
  if (value == null) return value;
  // Pyodide PyProxy — use toJs with dict_converter for proper dict→object conversion
  if (typeof value.toJs === 'function') {
    try {
      return value.toJs({ dict_converter: Object.fromEntries });
    } catch {
      try { return value.toJs(); } catch {}
    }
  }
  // Fallback: JSON round-trip (works for plain JS objects)
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * Register (or replace) a step function and config for a container.
 * @param {string} containerId
 * @param {function} stepFunction - step(x, state, params) => [x_new, state_new]
 * @param {object} rawConfig - Config object (plain JS or Python dict proxy — converted implicitly)
 */
export function register(containerId, stepFunction, rawConfig) {
  // Convert potential PyProxy to plain JS object
  const cfg = toPlainObject(rawConfig);
  systems[containerId] = {
    step: stepFunction,
    config: {
      params: typeof cfg.params === 'string' ? JSON.parse(cfg.params) : (cfg.params || []),
      plotType: cfg.plotType || 'timeseries',
      plotConfig: typeof cfg.plotConfig === 'string' ? JSON.parse(cfg.plotConfig) : (cfg.plotConfig || {}),
      initialState: typeof cfg.initialState === 'string' ? JSON.parse(cfg.initialState) : (cfg.initialState || { t: 0 }),
      initialX: cfg.initialX ?? 0,
      height: cfg.height || 400,
      dt: cfg.dt || 0.01,
      pauseTime: cfg.pauseTime ?? null,
      spikes: cfg.spikes || null,
      spikeThreshold: cfg.spikeThreshold ?? null
    }
  };
}

/**
 * Get the current step function for a container.
 * @param {string} containerId
 * @returns {function|null}
 */
export function getStep(containerId) {
  return systems[containerId]?.step || null;
}

/**
 * Get the parsed config for a container.
 * @param {string} containerId
 * @returns {object|null}
 */
export function getConfig(containerId) {
  return systems[containerId]?.config || null;
}

/**
 * Replace just the step function (for live code editing).
 * @param {string} containerId
 * @param {function} stepFunction
 */
export function replaceStep(containerId, stepFunction) {
  if (systems[containerId]) {
    systems[containerId].step = stepFunction;
  }
}

/**
 * Get all registered container IDs.
 * @returns {string[]}
 */
export function getContainerIds() {
  return Object.keys(systems);
}

/**
 * Check if a container is registered.
 * @param {string} containerId
 * @returns {boolean}
 */
export function has(containerId) {
  return containerId in systems;
}
