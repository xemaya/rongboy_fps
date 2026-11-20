let canvasStack;

export function uiCanvasFont(size, weight = 700) {
  canvasStack ??= getComputedStyle(document.documentElement).getPropertyValue('--ui-text').trim() || 'sans-serif';
  return `${weight} ${size}px ${canvasStack}`;
}

export function loadInterfaceFonts(language) {
  if (!document.fonts) return;
  const fonts = [document.fonts.load('600 24px "Rongboy Rounded"','Rongboy')];
  if (language === 'zh-CN') fonts.push(document.fonts.load('400 24px "Rongboy Han"','绒仔'));
  return Promise.allSettled(fonts);
}
