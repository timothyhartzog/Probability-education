/**
 * module.js
 * The Interactive Textbook Controller
 */

import { chapters } from './chapters';
import katex from 'katex';
import '../../lib/param-tooltips.js';

document.addEventListener('DOMContentLoaded', () => {
  const tocList = document.getElementById('toc-list');
  const chapterBody = document.getElementById('chapter-body');
  const heroTitle = document.getElementById('hero-title');
  const heroDesc = document.getElementById('hero-desc');
  const simFrame = document.getElementById('sim-frame');
  const playground = document.getElementById('playground-anchor');
  const searchInput = document.getElementById('chapter-search');

  let currentChapterId = null;

  // 1. Build TOC
  function buildTOC(filter = '') {
    tocList.innerHTML = '';
    chapters.forEach(ch => {
      if (filter && !ch.title.toLowerCase().includes(filter.toLowerCase())) return;

      const item = document.createElement('div');
      item.className = 'toc-item' + (currentChapterId === ch.id ? ' active' : '');
      item.innerHTML = `
        <span class="ch-num">${ch.id}</span>
        <div class="ch-text">
          <div class="ch-title">${ch.title}</div>
          <div class="ch-summary">${ch.summary}</div>
        </div>
      `;
      item.onclick = () => loadChapter(ch.id);
      tocList.appendChild(item);
    });
  }

  // 2. Load Chapter Content
  function loadChapter(id) {
    const ch = chapters.find(c => c.id === id);
    if (!ch) return;

    currentChapterId = id;
    
    // Update TOC highlight
    document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'));
    const activeItem = [...document.querySelectorAll('.toc-item')].find(el => el.querySelector('.ch-num').innerText == id);
    if (activeItem) activeItem.classList.add('active');

    // Content Update
    heroTitle.textContent = `Chapter ${ch.id}: ${ch.title}`;
    heroDesc.textContent = ch.summary;
    chapterBody.innerHTML = ch.content;

    // Simulation Loading
    if (ch.simulation) {
      playground.style.display = 'block';
      simFrame.src = ch.simulation;
      // Pre-select the module ID for context
      console.log(`[Textbook] Loading Interactive: ${ch.module_id}`);
    } else {
      playground.style.display = 'none';
      simFrame.src = '';
    }

    // LaTeX Math Rendering
    renderMath();

    // Scroll to Top
    document.getElementById('reader').scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderMath() {
    const mathElements = document.querySelectorAll('#chapter-body p, #chapter-body h2, #chapter-body h3');
    mathElements.forEach(el => {
      // Find $...$ patterns
      const text = el.innerHTML;
      const html = text.replace(/\$([^$]+)\$/g, (match, formula) => {
        try {
          return katex.renderToString(formula, { throwOnError: false });
        } catch (e) {
          return match;
        }
      });
      el.innerHTML = html;
    });
  }

  // 3. Search
  searchInput.addEventListener('input', (e) => buildTOC(e.target.value));

  // 4. Maximize Sim
  document.getElementById('btn-maximize').addEventListener('click', () => {
    playground.classList.toggle('maximized');
    const isMax = playground.classList.contains('maximized');
    document.getElementById('btn-maximize').textContent = isMax ? 'Minimize' : 'Maximize';
  });

  // Init
  buildTOC();
});
