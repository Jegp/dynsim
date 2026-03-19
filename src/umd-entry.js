/**
 * UMD entry point — auto-initializes for <script> tag usage.
 * Exposes everything on the global DynSim namespace and calls autoInit().
 *
 * Injects the Python bridge FIRST (synchronously) so that PyScript
 * processes it before any user <script type="py"> tags.
 */
export { Simulation } from './simulation.js';
export { SimulationView } from './view.js';
export { SimulationController } from './controller.js';
export { CodeEditor } from './editor.js';
export * as registry from './registry.js';
export { autoInit } from './index.js';

import { injectPythonBridge } from './pybridge.js';
import { autoInit } from './index.js';

// 1. Inject Python bridge before PyScript runs
injectPythonBridge();

// 2. Set up JS-side registration and auto-init
autoInit();
