/**
 * UMD entry point — auto-initializes for <script> tag usage.
 * Exposes everything on the global DynSim namespace and calls autoInit().
 */
export { Simulation } from './simulation.js';
export { SimulationView } from './view.js';
export { SimulationController } from './controller.js';
export { CodeEditor } from './editor.js';
export * as registry from './registry.js';
export { autoInit } from './index.js';

import { autoInit } from './index.js';
autoInit();
