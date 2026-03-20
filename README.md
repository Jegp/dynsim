# dynsim

Interactive dynamical systems simulator for the browser. Define systems in Python (via [PyScript](https://pyscript.net/)), visualize with [Plotly](https://plotly.com/javascript/).

## Quick start

```html
<!-- 1. Load dependencies -->
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<script src="https://pyscript.net/releases/2024.11.1/core.js" type="module"></script>

<!-- 2. Load dynsim -->
<script src="https://unpkg.com/dynsim"></script>

<!-- 3. Add a container -->
<div id="my-system"></div>

<!-- 4. Define your system in Python (see code example below) -->
<script type="py" src="my-system.py"></script>
```

## Python code example

```python
from pyscript import window
import json

def step(x, state, params):
    """Damped harmonic oscillator: x'' + 2ζω₀x' + ω₀²x = u(t)"""
    pos, vel, t = state["pos"], state["vel"], state["t"]
    zeta, w0, dt = params["zeta"], params["w0"], params["dt"]

    force = float(x)
    acc = force - 2 * zeta * w0 * vel - w0**2 * pos
    vel_new = vel + acc * dt
    pos_new = pos + vel_new * dt

    return [pos_new, {"pos": pos_new, "vel": vel_new, "t": t + dt}]

window.registerPythonSystem("my-system", step, {
    "input": json.dumps({"label": "Force u(t)", "min": -5, "max": 5, "step": 0.1, "value": 1}),
    "params": json.dumps([
        {"id": "zeta", "label": "ζ",  "min": 0, "max": 2, "step": 0.05, "value": 0.3},
        {"id": "w0",   "label": "ω₀", "min": 0.1, "max": 10, "step": 0.1, "value": 3.0},
    ]),
    "plotType": "timeseries",
    "plotConfig": json.dumps({
        "title": "Position",
        "xaxis": {"title": "Time (s)", "range": [0, 20]},
        "yaxis": {"title": "x", "range": [-3, 3]},
    }),
    "initialState": json.dumps({"pos": 0, "vel": 0, "t": 0}),
    "height": 450,
    "dt": 0.02,
    "pauseTime": 20,   # pause at t=20 (omit for continuous)
})
```

## How it works

You write a Python `step(x, state, params)` function that takes:

| Argument | Description |
|----------|-------------|
| `x` | Current input value (from the slider) |
| `state` | Dictionary of internal state variables |
| `params` | Dictionary of parameter values (includes `dt`) |

It returns `[x_new, state_new]`. DynSim calls this every animation frame, feeds the result to Plotly, and gives the user sliders to control input and parameters in real time.

## Config reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `input` | object/JSON | `{label: "Input (x)", min: -2, max: 2, step: 0.1, value: 0}` | Input slider config |
| `params` | array/JSON | `[]` | Parameter sliders `[{id, label, min, max, step, value}]` |
| `plotType` | string | `"timeseries"` | `"timeseries"`, `"3d"`, or `"2d"` |
| `plotConfig` | object/JSON | `{}` | Plotly layout (title, xaxis, yaxis) |
| `initialState` | object/JSON | `{t: 0}` | Initial state dictionary |
| `height` | number | `400` | Plot height in pixels |
| `dt` | number | `0.01` | Time step |
| `pauseTime` | number | `null` | Auto-pause at this time (`null` = run forever) |
| `spikes` | string | `null` | State variable name for spike detection (e.g. `"z"`) |
| `spikeThreshold` | number | `null` | Draw a horizontal threshold line at this value |

Labels support LaTeX via MathJax (e.g. `"\\(\\zeta\\)"`). Include MathJax on the page for rendering.

## Features

- **Live code editing** — the `CodeEditor` component lets users modify the Python system definition on the page and apply changes without resetting the simulation.
- **Plot types** — `timeseries` (default), `3d` scatter, or `2d` phase plots.
- **Pause / reset** — built-in controls. Optional `pauseTime` to auto-pause at a given time.
- **Sliding time window** — for timeseries, the plot auto-scrolls as time advances.
- **Spike visualization** — mark spikes as vertical lines and show a threshold with `spikes` and `spikeThreshold`.
- **LaTeX labels** — parameter and input labels render LaTeX when MathJax is loaded.

## Installation

**CDN (script tag):**

```html
<script src="https://unpkg.com/dynsim"></script>
```

**npm:**

```bash
npm install dynsim
```

```js
import { Simulation, SimulationController, registry } from 'dynsim';
```

## Architecture

```
Simulation           — pure state + stepping logic (no DOM, testable in Node)
SimulationView       — DOM creation, Plotly rendering, slider I/O
SimulationController — animation loop, wires Simulation ↔ View
CodeEditor           — live Python code editor with hot-swap
registry             — step function registry, supports live replacement
```

## Running the example locally

```bash
npm install
npm run build
# Serve the examples directory (any static server works)
npx serve .
# Open http://localhost:3000/examples/damped-oscillator.html
```

## Development

```bash
npm test          # run tests
npm run test:watch # watch mode
npm run build      # build ESM + UMD bundles to dist/
```

## License

MIT
