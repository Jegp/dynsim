/**
 * dynsim — Interactive dynamical systems simulator.
 *
 * ES module entry point. Exports all public API.
 */
export { Simulation } from './simulation.js';
export { SimulationView } from './view.js';
export { SimulationController } from './controller.js';
export { CodeEditor } from './editor.js';
export * as registry from './registry.js';
export { pyToJs, injectPythonBridge } from './pybridge.js';

import { SimulationController } from './controller.js';
import * as registry from './registry.js';

// --- Singleton controller management ---
// One controller per container ID. Creating a new one destroys the old.
const controllers = {};

/**
 * Create (or replace) the controller for a container.
 * Destroys any existing controller first to prevent races.
 * @param {string} containerId
 * @returns {SimulationController|null}
 */
export function initializeContainer(containerId) {
  // Destroy existing controller to prevent overlapping Plotly calls
  if (controllers[containerId]) {
    console.log('[DynSim] Destroying old controller for:', containerId);
    controllers[containerId].destroy();
    delete controllers[containerId];
  }

  const container = document.getElementById(containerId);
  if (!container) return null;

  const config = registry.getConfig(containerId);
  if (!config) return null;

  console.log('[DynSim] Creating controller for:', containerId);
  const ctrl = new SimulationController({
    container,
    config,
    stepProvider: () => registry.getStep(containerId)
  });
  controllers[containerId] = ctrl;
  ctrl.start();
  return ctrl;
}

/**
 * Get the active controller for a container (if any).
 * @param {string} containerId
 * @returns {SimulationController|null}
 */
export function getController(containerId) {
  return controllers[containerId] || null;
}

/**
 * Auto-initialize: expose globals for PyScript interop and
 * bootstrap PyScript containers. Called automatically by the UMD build.
 * Call manually when using as an ES module if you need the legacy behavior.
 */
export async function autoInit() {
  // Expose globals for PyScript interop
  window.pythonSystems = {};
  window.dynSimConfigs = {};

  // JS-side registration — called by the Python bridge wrapper.
  window._dynsimJsRegister = function (containerId, stepFunction, config) {
    console.log('[DynSim] Registering Python system:', containerId);
    registry.register(containerId, stepFunction, config);

    if (document.readyState === 'complete' && typeof Plotly !== 'undefined') {
      initializeContainer(containerId);
    }
  };

  // Fallback: if the Python bridge hasn't loaded, provide a direct JS registration
  if (!window.registerPythonSystem) {
    window.registerPythonSystem = window._dynsimJsRegister;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await setupPyScriptContainers();
      initializeAllContainers();
    });
  } else {
    await setupPyScriptContainers();
    initializeAllContainers();
  }
}

// --- Internal helpers for autoInit ---

function initializeAllContainers() {
  let attempts = 0;
  const MAX_ATTEMPTS = 20;

  function tryInit() {
    attempts++;
    if (typeof Plotly === 'undefined') {
      if (attempts < MAX_ATTEMPTS) setTimeout(tryInit, 50);
      return;
    }

    const ids = registry.getContainerIds();
    if (ids.length === 0 && attempts < MAX_ATTEMPTS) {
      setTimeout(tryInit, 50);
      return;
    }

    ids.forEach(id => {
      // Only init if no active controller exists
      if (!controllers[id]) {
        initializeContainer(id);
      }
    });
  }

  tryInit();
}

async function setupPyScriptContainers() {
  // Wait for data file
  let attempts = 0;
  while (!window.dynSimSystemsData && attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  if (!window.dynSimSystemsData) return;

  // Wait for PyScript bootstrap
  attempts = 0;
  while (!window.executeDynSimCode && attempts < 40) {
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  if (!window.executeDynSimCode) return;

  const containers = document.querySelectorAll('.dynsim-python-container');
  for (const container of containers) {
    const systemData = window.dynSimSystemsData[container.id];
    if (!systemData) continue;

    try {
      window.dynSimConfigs[container.id] = systemData.config;
      window.executeDynSimCode(systemData.pythonCode, container.id, systemData.config);
    } catch (e) {
      console.error('[DynSim] Error processing container:', container.id, e);
    }
  }
}
