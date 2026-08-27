(function () {
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

    // Click handler for toggle
    title.addEventListener('click', () => {
      const isCollapsed = title.classList.toggle('collapsed');
      body.style.display = isCollapsed ? 'none' : '';

      // If expanding, collapse all other sections within the same parent
      if (!isCollapsed) {
        const parent = title.parentNode;
        Array.from(parent.children).forEach(sibling => {
          if (
            sibling !== title &&
            sibling.classList &&
            sibling.classList.contains('section-title')
          ) {
            // Collapse sibling
            sibling.classList.add('collapsed');
            const siblingBody = sibling.nextElementSibling;
            if (siblingBody && siblingBody.classList.contains('section-body')) {
              siblingBody.style.display = 'none';
            }
          }
        });
      }
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
      body.style.display = '';
    }
  }

  function wire() {
    document.querySelectorAll('h2.section-title').forEach(processTitle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  const observer = new MutationObserver(() => wire());
  observer.observe(document.body, { childList: true, subtree: true });
})();