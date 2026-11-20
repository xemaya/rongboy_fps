export const crazyGames = typeof __RONGBOY_CRAZYGAMES__ !== 'undefined' && __RONGBOY_CRAZYGAMES__;

let sdkPromise;

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
