import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * MathAnnotation - Renders LaTeX formulas inside SVG using KaTeX and foreignObject.
 */
export default class MathAnnotation {
  /**
   * Render a LaTeX string at a given position within an SVG container.
   * @param {SVGElement|d3.Selection|string} container - SVG element, d3 selection, or CSS selector
   * @param {string} latex - LaTeX string to render
   * @param {number} x - x position in SVG coordinates
   * @param {number} y - y position in SVG coordinates
   * @param {Object} [options]
   * @param {number} [options.width=200] - foreignObject width
   * @param {number} [options.height=50] - foreignObject height
   * @param {string} [options.fontSize='14px'] - CSS font size
   * @param {string} [options.color='#000'] - Text color
   * @returns {SVGForeignObjectElement} The foreignObject element
   */
  static renderMath(container, latex, x, y, options = {}) {
    const {
      width = 200,
      height = 50,
      fontSize = '14px',
      color = '#000',
    } = options;

    const svgEl = MathAnnotation._resolveSVGContainer(container);

    const ns = 'http://www.w3.org/2000/svg';
    const fo = document.createElementNS(ns, 'foreignObject');
    fo.setAttribute('x', x);
    fo.setAttribute('y', y);
    fo.setAttribute('width', width);
    fo.setAttribute('height', height);
    fo.classList.add('math-annotation');

    const div = document.createElement('div');
    div.style.fontSize = fontSize;
    div.style.color = color;
    div.style.lineHeight = '1';
    div.style.overflow = 'visible';

    katex.render(latex, div, {
      throwOnError: false,
      displayMode: false,
    });

    fo.appendChild(div);
    svgEl.appendChild(fo);

    // Store the latex source for later updates
    fo.__mathLatex = latex;
    fo.__mathDiv = div;

    return fo;
  }

  /**
   * Update an existing math annotation with new LaTeX.
   * @param {SVGForeignObjectElement} element - The foreignObject returned by renderMath
   * @param {string} newLatex - New LaTeX string
   */
  static updateMath(element, newLatex) {
    if (!element || !element.__mathDiv) {
      throw new Error(
        'Invalid element: must be a foreignObject created by renderMath'
      );
    }

    katex.render(newLatex, element.__mathDiv, {
      throwOnError: false,
      displayMode: false,
    });

    element.__mathLatex = newLatex;
  }

  /**
   * Remove a math annotation from the SVG.
   * @param {SVGForeignObjectElement} element
   */
  static removeMath(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * Resolve the container to a raw SVG DOM element.
   * Accepts a CSS selector string, a DOM element, or a d3 selection.
   * @param {SVGElement|d3.Selection|string} container
   * @returns {SVGElement}
   */
  static _resolveSVGContainer(container) {
    if (typeof container === 'string') {
      const el = document.querySelector(container);
      if (!el) throw new Error(`SVG container not found: ${container}`);
      return el;
    }
    // d3 selection
    if (container.node && typeof container.node === 'function') {
      return container.node();
    }
    return container;
  }
}
