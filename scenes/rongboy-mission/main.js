import { initializeLanguage } from './language.js';
import { crazyGames, playPage } from './platform.js';

const query = new URLSearchParams(location.search);
// URLs from earlier release builds also used index.html for explicit plays.
const legacyPlayLink = crazyGames && query.has('level') && !query.has('screen')
  && !location.pathname.endsWith('/rongboy-mission.html');
if (legacyPlayLink) location.replace(playPage + '?' + query);
else initializeLanguage({waitForPlatformLocale:true}).then(() => import('./menu-app.js'));
