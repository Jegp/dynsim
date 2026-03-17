/**
 * CodeEditor — in-page Python code editor with live replacement.
 *
 * Provides a textarea for editing the Python step function definition.
 * On "Apply", re-executes the code via PyScript/Pyodide and updates
 * the step function in the registry. The simulation continues
 * seamlessly with the new dynamics on the next tick.
 */
import * as registry from './registry.js';

export class CodeEditor {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container - DOM element to render the editor into
   * @param {string} options.containerId - The simulation container ID (registry key)
   * @param {string} options.initialCode - Initial Python source code
   * @param {function} options.executePython - (code, containerId, config) => void
   *   Function that executes Python code in the PyScript/Pyodide runtime.
   *   The code should call registerPythonSystem which updates the registry.
   */
  constructor({ container, containerId, initialCode, executePython }) {
    this.container = container;
    this.containerId = containerId;
    this.initialCode = initialCode || '';
    this.executePython = executePython;
    this.textarea = null;
    this.statusEl = null;

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="dynsim-editor" style="font-family: Arial, sans-serif; font-size: 0.9em; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="font-weight: 600; font-size: 0.85em;">Python System Definition</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="dynsim-editor-status" style="font-size: 0.8em; color: #666;"></span>
            <button class="dynsim-editor-apply" style="
              background: #0056b3; color: white; border: none; border-radius: 4px;
              padding: 4px 12px; cursor: pointer; font-size: 0.85em;
            ">Apply</button>
            <button class="dynsim-editor-reset" style="
              background: #6c757d; color: white; border: none; border-radius: 4px;
              padding: 4px 12px; cursor: pointer; font-size: 0.85em;
            ">Reset Code</button>
          </div>
        </div>
        <textarea class="dynsim-editor-textarea" style="
          width: 100%; min-height: 200px; font-family: monospace; font-size: 0.9em;
          padding: 8px; border: 1px solid #ddd; border-radius: 6px;
          box-sizing: border-box; resize: vertical; tab-size: 4;
        " spellcheck="false">${this._escapeHtml(this.initialCode)}</textarea>
      </div>
    `;

    this.textarea = this.container.querySelector('.dynsim-editor-textarea');
    this.statusEl = this.container.querySelector('.dynsim-editor-status');

    this.container.querySelector('.dynsim-editor-apply')
      .addEventListener('click', () => this.apply());

    this.container.querySelector('.dynsim-editor-reset')
      .addEventListener('click', () => this.resetCode());

    // Tab key inserts spaces instead of changing focus
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.value =
          this.textarea.value.substring(0, start) +
          '    ' +
          this.textarea.value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
      }
    });
  }

  /**
   * Re-execute the current code and update the registry.
   */
  apply() {
    const code = this.textarea.value;
    const config = registry.getConfig(this.containerId);

    try {
      this.executePython(code, this.containerId, config);
      this._setStatus('Applied', 'green');
    } catch (e) {
      console.error('[DynSim Editor] Error applying code:', e);
      this._setStatus('Error: ' + e.message, 'red');
    }
  }

  /**
   * Reset the textarea to the initial code.
   */
  resetCode() {
    this.textarea.value = this.initialCode;
    this._setStatus('Reset to original', '#666');
  }

  /**
   * Get the current code from the editor.
   * @returns {string}
   */
  getCode() {
    return this.textarea.value;
  }

  _setStatus(text, color) {
    this.statusEl.textContent = text;
    this.statusEl.style.color = color;
    // Clear status after 3 seconds
    setTimeout(() => {
      if (this.statusEl.textContent === text) {
        this.statusEl.textContent = '';
      }
    }, 3000);
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
