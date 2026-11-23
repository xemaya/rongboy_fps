let canvasStack;

export function uiCanvasFont(size, weight = 700) {
  canvasStack ??= getComputedStyle(document.documentElement).getPropertyValue('--ui-text').trim() || 'sans-serif';
  return `${weight} ${size}px ${canvasStack}`;
}

export function loadInterfaceFonts(language, han = '绒仔') {
  if (!document.fonts) return;
  const fonts = [document.fonts.load('600 24px "Rongboy Rounded"','Rongboy')];
  if (language === 'zh-CN') fonts.push(document.fonts.load('700 24px "Rongboy Han"',han));
  return Promise.allSettled(fonts);
}
