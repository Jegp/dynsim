/**
 * Registry for step functions, keyed by container ID.
 *
 * Supports live replacement: update a step function at any time
 * and the next simulation tick will pick it up via the stepProvider pattern.
 */

const systems = {};

/**
 * Register (or replace) a step function and config for a container.
 * @param {string} containerId
 * @param {function} stepFunction - step(x, state, params) => [x_new, state_new]
 * @param {object} rawConfig - Raw config with JSON-encoded fields
 */
export function register(containerId, stepFunction, rawConfig) {
  systems[containerId] = {
    step: stepFunction,
    config: {
      params: JSON.parse(rawConfig.params || '[]'),
      plotType: rawConfig.plotType || 'timeseries',
      plotConfig: JSON.parse(rawConfig.plotConfig || '{}'),
      initialState: JSON.parse(rawConfig.initialState || '{"t": 0}'),
      initialX: rawConfig.initialX ?? 0,
      height: rawConfig.height || 400,
      dt: rawConfig.dt || 0.01
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
