import { initializeLanguage } from './language.js';

initializeLanguage().then(() => import('./menu-app.js'));
