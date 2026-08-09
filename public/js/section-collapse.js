// Shared utility: makes every h2.section-title expandable / collapsible.
// - Each h2 wraps its following sibling content (until the next h2 section
//   title at the same level) into a collapsible .section-body container.
// - Works for nested containers (e.g. bill-generation pickerView / billView).
// - Default state: first h2 within each parent expanded, the rest collapsed.
// - Runs on DOMContentLoaded AND via a MutationObserver so dynamically
//   rendered section titles (e.g. po-confirm.js / bill-ack.js) also work.

(function () {
  // Process a single h2 title: ensure caret + body wrapper + click toggle.
  function processTitle(title) {
    if (!title || title.dataset.sectionWired) return;
    title.dataset.sectionWired = '1';

    // Add caret if not present.
    let caret = title.querySelector('.caret');
    if (!caret) {
      caret = document.createElement('span');
      caret.className = 'caret';
      caret.textContent = '▼';
      title.insertBefore(caret, title.firstChild);
    }

    // Ensure a .section-body wrapper directly follows the title.
    let body = title.nextElementSibling;
    if (!body || !body.classList.contains('section-body')) {
      // Collect ALL following siblings up to the next section-title BEFORE
      // moving them (moving a node invalidates its nextSibling reference).
      const nodes = [];
      let node = title.nextSibling;
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains('section-title')) break;
        nodes.push(node);
        node = node.nextSibling;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'section-body';
      nodes.forEach(n => wrapper.appendChild(n));
      title.parentNode.insertBefore(wrapper, title.nextSibling);
      body = wrapper;
    }

    // Generic toggle handler (state agnostic so it never fights the default).
    title.addEventListener('click', () => {
      const collapsed = title.classList.toggle('collapsed');
      body.style.display = collapsed ? 'none' : '';
    });

    // Apply default state: first section-title in its parent expanded, rest collapsed.
    const siblings = Array.from(title.parentNode.children).filter(
      el => el.classList && el.classList.contains('section-title')
    );
    const idx = siblings.indexOf(title);
    if (idx > 0) {
      title.classList.add('collapsed');
      body.style.display = 'none';
    } else {
      // Ensure the first section is expanded (no inline override).
      body.style.display = '';
    }
  }

  function wire() {
    document.querySelectorAll('h2.section-title').forEach(processTitle);
  }

  // Run on load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  // Watch for dynamically added section titles.
  const observer = new MutationObserver(() => wire());
  observer.observe(document.body, { childList: true, subtree: true });
})();
