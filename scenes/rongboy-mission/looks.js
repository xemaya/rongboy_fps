// 三张地图的光线预设，按关卡的 look 取。任务版（main.js）和开场片（scenes/rongboy-op）共用。
import { LOOKS, cloneLook } from '../../cine-engine/engine/index.js';

// 光线按关卡取（level.look）。
// afternoon：下午四五点的斜阳，从西南方照过来。花园里影子拉得长，阳光穿过西窗、南窗和两扇门落在地板上；
//   屋里的天光压暗，靠每个房间的吊灯补亮（world.js）。
// night：闭馆后的夜里。"太阳"是东南方高处的月亮，冷色、不强，从天窗和高窗照进来；屋里是偏蓝的环境光加一盏盏暖色射灯。
//   曝光放宽，让眼睛适应暗处；泛光开大一点，射灯、展柜和电弧会晕开。
export const LOOK_PRESETS = {
  afternoon() {
    const look = cloneLook(LOOKS.clearNoon);
    Object.assign(look.sun, { azimuth: 138, elevation: 30, intensity: 5.2, color: [1, 0.86, 0.66] });
    look.env.intensity = 1.15;
    Object.assign(look.sky, { zenith: [0.16, 0.33, 0.62], mid: [0.36, 0.55, 0.80], midSun: [0.75, 0.70, 0.62], horizon: [0.95, 0.84, 0.66], horizonAway: [0.62, 0.72, 0.84], glow: [1.6, 1.3, 0.9], cloudCover: 0.3, cloudWarm: 0.6 });
    Object.assign(look.air, { sigma: 0.0006, mist: 0, sunScale: 0.4, aoRadius: 0.3, aoIntensity: 0.65, aoStrength: 0.75 });
    Object.assign(look.grade, { key: 0.17, minExposure: 0.85, maxExposure: 1.5, adaptTau: 0.9, exposure: 1, bloom: 0.05, flare: 0.03, streak: 0, dirt: 0, ca: 0, grain: 0.004, vignette: 0.16, saturation: 1.06, contrast: 0.2, sharpen: 0.55 });
    return look;
  },
  // morning：上学路上的晴天上午。太阳在东南方，照亮教学楼的正面和整个操场；天更蓝、更饱和一点，颜色像蜡笔盒。
  morning() {
    const look = cloneLook(LOOKS.clearNoon);
    Object.assign(look.sun, { azimuth: 56, elevation: 46, intensity: 5.6, color: [1, 0.94, 0.82] });
    look.env.intensity = 1.25;
    Object.assign(look.sky, { zenith: [0.14, 0.36, 0.72], mid: [0.34, 0.6, 0.9], midSun: [0.6, 0.74, 0.9], horizon: [0.82, 0.9, 0.96], horizonAway: [0.62, 0.78, 0.94], glow: [1.4, 1.35, 1.2], cloudCover: 0.22, cloudWarm: 0.2 });
    Object.assign(look.air, { sigma: 0.0005, mist: 0, sunScale: 0.4, aoRadius: 0.3, aoIntensity: 0.6, aoStrength: 0.7 });
    Object.assign(look.grade, { key: 0.18, minExposure: 0.85, maxExposure: 1.5, adaptTau: 0.9, exposure: 1, bloom: 0.05, flare: 0.03, streak: 0, dirt: 0, ca: 0, grain: 0.004, vignette: 0.14, saturation: 1.12, contrast: 0.18, sharpen: 0.55 });
    return look;
  },
  orchard() {
    const look = cloneLook(LOOKS.clearNoon);
    Object.assign(look.sun, { azimuth:116,elevation:24,intensity:4.7,color:[1,.87,.65] });
    look.env.intensity=1.22;
    Object.assign(look.sky, { zenith:[.23,.38,.56],mid:[.49,.64,.75],horizon:[.94,.83,.68],cloudCover:.36,cloudWarm:.7 });
    Object.assign(look.air, { sigma:.0012,mist:0,sunScale:.32,aoRadius:.26,aoIntensity:.52,aoStrength:.7 });
    Object.assign(look.grade, { key:.17,minExposure:.85,maxExposure:1.6,exposure:1,bloom:.06,flare:.015,grain:.004,vignette:.12,saturation:1.08,contrast:.16 });
    return look;
  },
  night() {
    const look = cloneLook(LOOKS.blueHour);
    Object.assign(look.sun, { azimuth: 52, elevation: 66, intensity: 2.6, color: [0.62, 0.76, 1.0] });
    look.env.intensity = 1.0;
    Object.assign(look.sky, { zenith: [0.012, 0.022, 0.06], mid: [0.025, 0.045, 0.11], midSun: [0.06, 0.09, 0.18], horizon: [0.07, 0.11, 0.21], horizonAway: [0.04, 0.06, 0.13], glow: [0.5, 0.6, 0.9], cloudCover: 0.3, cloudWarm: 0 });
    Object.assign(look.air, { sigma: 0.0004, mist: 0, sunScale: 0.3, aoRadius: 0.3, aoIntensity: 0.6, aoStrength: 0.7 });
    Object.assign(look.grade, { key: 0.15, minExposure: 1.0, maxExposure: 2.6, adaptTau: 0.9, exposure: 1, bloom: 0.085, flare: 0.02, streak: 0, dirt: 0, ca: 0, grain: 0.005, vignette: 0.2, saturation: 1.08, contrast: 0.2, sharpen: 0.55 });
    return look;
  },
};
