/**
 * contextMenu.js — Gjenbrukbar kontekst-meny-builder.
 */

function getPortal() {
  return document.getElementById('modal-portal') ?? document.body;
}

/**
 * Vis en kontekst-meny ved gitte koordinater.
 * @param {number} x
 * @param {number} y
 * @param {Array} items - [{ label, icon, action, danger?, divider? }]
 * @param {string} [menuId] - CSS-ID for menyen (default 'ctx-menu')
 */
export function showContextMenu(x, y, items, menuId = 'ctx-menu') {
  let menu = document.getElementById(menuId);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = menuId;
    menu.className = 'context-menu';
    getPortal().appendChild(menu);
  }

  menu.innerHTML = '';
  menu.classList.remove('hidden');

  items.forEach(item => {
    if (item.divider) {
      menu.appendChild(Object.assign(document.createElement('div'), { className: 'context-menu-divider' }));
      return;
    }
    const el = document.createElement('div');
    el.className = 'context-menu-item' + (item.danger ? ' danger' : '');
    el.innerHTML = `<i class="fa-solid ${item.icon}"></i> ${item.label}`;
    el.addEventListener('click', () => { hideContextMenu(menuId); item.action(); });
    menu.appendChild(el);
  });

  // Sørg for at menyen ikke går utenfor viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  menu.style.left = (x + 180 > vw ? vw - 190 : x) + 'px';
  menu.style.top  = (y + menu.offsetHeight > vh ? vh - menu.offsetHeight - 8 : y) + 'px';

  setTimeout(() => document.addEventListener('click', () => hideContextMenu(menuId), { once: true }), 0);
}

export function hideContextMenu(menuId = 'ctx-menu') {
  document.getElementById(menuId)?.classList.add('hidden');
}
