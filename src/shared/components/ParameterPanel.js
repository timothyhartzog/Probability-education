/**
 * ParameterPanel - Factory for creating interactive control panels
 * with sliders, dropdowns, and toggles. Each control returns an object
 * with getValue() and setValue() methods.
 */
export default class ParameterPanel {
  /**
   * Create a range slider control.
   * @param {HTMLElement|string} container - DOM element or CSS selector
   * @param {Object} config
   * @param {string} config.id - Unique identifier
   * @param {string} config.label - Display label
   * @param {number} config.min - Minimum value
   * @param {number} config.max - Maximum value
   * @param {number} [config.step=1] - Step increment
   * @param {number} [config.value] - Initial value (defaults to min)
   * @param {Function} [config.onChange] - Callback(value)
   * @returns {{getValue: Function, setValue: Function, element: HTMLElement}}
   */
  static createSlider(container, config) {
    const el = ParameterPanel._resolveContainer(container);
    const {
      id,
      label,
      min,
      max,
      step = 1,
      value = min,
      onChange,
    } = config;

    const wrapper = document.createElement('div');
    wrapper.className = 'param-control param-slider';
    wrapper.setAttribute('data-param-id', id);

    const labelEl = document.createElement('label');
    labelEl.className = 'param-label';
    labelEl.htmlFor = id;
    labelEl.textContent = label;

    const inputRow = document.createElement('div');
    inputRow.className = 'param-input-row';

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'param-range';
    input.id = id;
    input.name = id;
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;

    const display = document.createElement('span');
    display.className = 'param-value-display';
    display.textContent = value;

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      display.textContent = v;
      if (onChange) onChange(v);
    });

    inputRow.appendChild(input);
    inputRow.appendChild(display);
    wrapper.appendChild(labelEl);
    wrapper.appendChild(inputRow);
    el.appendChild(wrapper);

    return {
      element: wrapper,
      getValue() {
        return parseFloat(input.value);
      },
      setValue(v) {
        input.value = v;
        display.textContent = v;
      },
    };
  }

  /**
   * Create a dropdown (select) control.
   * @param {HTMLElement|string} container - DOM element or CSS selector
   * @param {Object} config
   * @param {string} config.id - Unique identifier
   * @param {string} config.label - Display label
   * @param {Array<{value: string, text: string}|string>} config.options - Dropdown options
   * @param {string} [config.value] - Initial selected value
   * @param {Function} [config.onChange] - Callback(value)
   * @returns {{getValue: Function, setValue: Function, element: HTMLElement}}
   */
  static createDropdown(container, config) {
    const el = ParameterPanel._resolveContainer(container);
    const { id, label, options, value, onChange } = config;

    const wrapper = document.createElement('div');
    wrapper.className = 'param-control param-dropdown';
    wrapper.setAttribute('data-param-id', id);

    const labelEl = document.createElement('label');
    labelEl.className = 'param-label';
    labelEl.htmlFor = id;
    labelEl.textContent = label;

    const inputRow = document.createElement('div');
    inputRow.className = 'param-input-row';

    const select = document.createElement('select');
    select.className = 'param-select';
    select.id = id;
    select.name = id;

    const display = document.createElement('span');
    display.className = 'param-value-display';

    (options || []).forEach((opt) => {
      const optionEl = document.createElement('option');
      if (typeof opt === 'string') {
        optionEl.value = opt;
        optionEl.textContent = opt;
      } else {
        optionEl.value = opt.value;
        optionEl.textContent = opt.text || opt.value;
      }
      select.appendChild(optionEl);
    });

    if (value !== undefined) {
      select.value = value;
    }
    display.textContent = select.value;

    select.addEventListener('change', () => {
      display.textContent = select.value;
      if (onChange) onChange(select.value);
    });

    inputRow.appendChild(select);
    inputRow.appendChild(display);
    wrapper.appendChild(labelEl);
    wrapper.appendChild(inputRow);
    el.appendChild(wrapper);

    return {
      element: wrapper,
      getValue() {
        return select.value;
      },
      setValue(v) {
        select.value = v;
        display.textContent = v;
      },
    };
  }

  /**
   * Create a toggle (checkbox) control.
   * @param {HTMLElement|string} container - DOM element or CSS selector
   * @param {Object} config
   * @param {string} config.id - Unique identifier
   * @param {string} config.label - Display label
   * @param {boolean} [config.checked=false] - Initial state
   * @param {Function} [config.onChange] - Callback(checked)
   * @returns {{getValue: Function, setValue: Function, element: HTMLElement}}
   */
  static createToggle(container, config) {
    const el = ParameterPanel._resolveContainer(container);
    const { id, label, checked = false, onChange } = config;

    const wrapper = document.createElement('div');
    wrapper.className = 'param-control param-toggle';
    wrapper.setAttribute('data-param-id', id);

    const labelEl = document.createElement('label');
    labelEl.className = 'param-label';
    labelEl.htmlFor = id;
    labelEl.textContent = label;

    const inputRow = document.createElement('div');
    inputRow.className = 'param-input-row';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'param-checkbox';
    input.id = id;
    input.name = id;
    input.checked = checked;

    const display = document.createElement('span');
    display.className = 'param-value-display';
    display.textContent = checked ? 'On' : 'Off';

    input.addEventListener('change', () => {
      display.textContent = input.checked ? 'On' : 'Off';
      if (onChange) onChange(input.checked);
    });

    inputRow.appendChild(input);
    inputRow.appendChild(display);
    wrapper.appendChild(labelEl);
    wrapper.appendChild(inputRow);
    el.appendChild(wrapper);

    return {
      element: wrapper,
      getValue() {
        return input.checked;
      },
      setValue(v) {
        input.checked = !!v;
        display.textContent = v ? 'On' : 'Off';
      },
    };
  }

  /**
   * Resolve a container argument to a DOM element.
   * @param {HTMLElement|string} container
   * @returns {HTMLElement}
   */
  static _resolveContainer(container) {
    if (typeof container === 'string') {
      const el = document.querySelector(container);
      if (!el) throw new Error(`Container not found: ${container}`);
      return el;
    }
    return container;
  }
}
