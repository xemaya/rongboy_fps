export const crazyGames = typeof __RONGBOY_CRAZYGAMES__ !== 'undefined' && __RONGBOY_CRAZYGAMES__;
export const playPage = 'rongboy-play.html';
export const firstRound = 'garden-intro';
const campaign = [firstRound, 'school', 'house', 'museum', 'cottage'];

export function nextChapter(level) {
  return crazyGames && campaign.includes(level) ? campaign[campaign.indexOf(level) + 1] : undefined;
}

let sdkPromise, game, loading = false, playing = false;

function loadCrazyGames() {
  return sdkPromise ??= new Promise(resolve => {
    const script = document.createElement('script');
    const finish = sdk => { clearTimeout(timer); resolve(sdk); };
    const timer = setTimeout(() => finish(null),4000);
    script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
    script.onload = async () => {
      try {
        const sdk = window.CrazyGames.SDK;
        await sdk.init();
        finish(sdk);
      } catch { finish(null); }
    };
    script.onerror = () => finish(null);
    document.head.append(script);
  });
}

export async function crazyGamesLocale() {
  if (!crazyGames) return;
  const sdk = await loadCrazyGames();
  try { return sdk?.user?.systemInfo?.locale; } catch { return undefined; }
}

export async function connectCrazyGames() {
  if (!crazyGames) return;
  const sdk = await loadCrazyGames();
  game = sdk?.game;
  if (game && !loading) {
    try { game.loadingStart(); loading = true; }
    catch { game = undefined; }
  }
}

export function platformReady() {
  if (!loading) return;
  game.loadingStop();
  loading = false;
}

export function platformPlaying(active) {
  if (!game || active === playing) return;
  playing = active;
  if (active) game.gameplayStart();
  else game.gameplayStop();
}
