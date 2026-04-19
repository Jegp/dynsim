/**
 * CodeEditor — in-page Python code editor with live replacement.
 *
 * Provides a textarea for editing the Python step function definition.
 * Supports both manual "Apply" and automatic live mode with debounce.
 * Re-executes the code via PyScript/Pyodide and updates the step
 * function in the registry. The simulation continues seamlessly
 * with the new dynamics on the next tick.
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
   * @param {boolean} [options.live=true] - Enable auto-apply on edit with debounce
   * @param {number} [options.debounceMs=500] - Debounce delay in ms for live mode
   */
  constructor({ container, containerId, initialCode, executePython, live, debounceMs }) {
    this.container = container;
    this.containerId = containerId;
    this.initialCode = initialCode || '';
    this.executePython = executePython;
    this.live = live !== false;
    this.debounceMs = debounceMs || 500;
    this.textarea = null;
    this.statusEl = null;
    this._debounceTimer = null;

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="dynsim-editor" style="font-family: Arial, sans-serif; font-size: 0.9em; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <label style="font-weight: 600; font-size: 0.85em;">Python System Definition</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="dynsim-editor-status" style="font-size: 0.8em; color: #666;"></span>
            <label style="font-size: 0.8em; cursor: pointer; user-select: none;">
              <input type="checkbox" class="dynsim-editor-live" ${this.live ? 'checked' : ''}
                style="vertical-align: middle; margin-right: 2px;">
              Live
            </label>
            <button class="dynsim-editor-apply" style="
              background: #0056b3; color: white; border: none; border-radius: 4px;
              padding: 4px 12px; cursor: pointer; font-size: 0.85em;
            ">Apply</button>
            <button class="dynsim-editor-reset" style="
              background: #6c757d; color: white; border: none; border-radius: 4px;
              padding: 4px 12px; cursor: pointer; font-size: 0.85em;
            ">Reset</button>
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

    this.container.querySelector('.dynsim-editor-live')
      .addEventListener('change', (e) => { this.live = e.target.checked; });

    // Live auto-apply on input
    this.textarea.addEventListener('input', () => {
      if (!this.live) return;
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.apply(), this.debounceMs);
    });

    // Ctrl/Cmd+Enter to apply manually
    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.apply();
        return;
      }
      // Tab key inserts spaces instead of changing focus
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
    if (this.live) {
      this.apply();
    }
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
