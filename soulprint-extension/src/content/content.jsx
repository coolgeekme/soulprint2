import { createRoot } from 'react-dom/client';
import Sidebar from '../sidebar/Sidebar';
import { MESSAGE } from '../shared/constants';
import styles from '../sidebar/sidebar.css?raw';

if (!document.getElementById('soulprint-sidebar-root')) {
  const host = document.createElement('div'); host.id = 'soulprint-sidebar-root'; host.style.cssText = 'all:initial;position:fixed;inset:0 0 auto auto;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' }); const style = document.createElement('style'); style.textContent = styles; const mount = document.createElement('div'); mount.id = 'soulprint-react-root'; shadow.append(style, mount); document.documentElement.appendChild(host); createRoot(mount).render(<Sidebar />);
}
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') window.dispatchEvent(new CustomEvent(MESSAGE.close)); if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') { event.preventDefault(); window.dispatchEvent(new CustomEvent(MESSAGE.focus)); } });
