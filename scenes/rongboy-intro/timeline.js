export const DURATION=30;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
export const lerp=(a,b,t)=>a+(b-a)*t;
export const mix3=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
export const HERO=[-1.05,0,1.05], HERO_HEADING=Math.atan2(3.65,-3.35), FINAL_HEADING=Math.atan2(1.05,-3.50);
export const WALKER=[-.249253731343,0,1.60], SIT=[-.15,-.105,3.05];
export const SHOT_TIME=12.10, BOUNCES=[13.05,13.30], HIT_TIME=14.25;
const muzzleDistance=(.40+.49)*.78, muzzleY=(.73+.24)*.78-.017;
export const BALL_PATH=[[HERO[0]+Math.sin(HERO_HEADING)*muzzleDistance,muzzleY,HERO[2]+Math.cos(HERO_HEADING)*muzzleDistance],[2.6,muzzleY,-2.3],[3.30,muzzleY,-1.657534246575],[WALKER[0],muzzleY,WALKER[2]]];
export const SHOTS=[
 {id:'01-home',T0:0,T1:3.5,type:'dolly',from:{p:[-3.15,2.35,5.4],at:[.0,1.05,-.15],fov:42},to:{p:[-2.8,2.10,4.8],at:[-.15,1.05,-.1],fov:40}},
 {id:'02-load',T0:3.5,T1:6.5,type:'dolly',from:{p:[.32,1.55,2.15],at:[-.71,1.23,1.03],fov:44},to:{p:[.22,1.51,2.05],at:[-.72,1.23,1.03],fov:44}},
 {id:'03-curious',T0:6.5,T1:9.5,type:'track',follow:'walker.head',off0:[-1.9,.18,1.25],off1:[-2.0,.18,1.4],at:'walker.chest',fov:39},
 {id:'04-reach',T0:9.5,T1:11.3,type:'dolly',from:{p:[-2.6,1.70,3.65],at:[-.28,1.06,1.25],fov:39},to:{p:[-2.5,1.65,3.48],at:[-.27,1.08,1.27],fov:39}},
 {id:'05-uh-oh',T0:11.3,T1:12.1,type:'dolly',from:{p:[.10,1.54,1.88],at:[-.95,1.30,1.05],fov:34},to:{p:[.04,1.52,1.82],at:[-.95,1.30,1.05],fov:34}},
 {id:'06-ricochet',T0:12.1,T1:15.3,type:'dolly',from:{p:[-3.4,2.2,4.8],at:[.40,1.03,-.1],fov:40},to:{p:[-3.4,2.2,4.8],at:[.40,1.03,-.1],fov:40}},
 {id:'07-soft-landing',T0:15.3,T1:18.6,type:'dolly',from:{p:[-1.95,1.5,5.15],at:[-.15,1.02,2.95],fov:36},to:{p:[-1.75,1.4,4.85],at:[-.15,.99,2.95],fov:35}},
 {id:'08-check',T0:18.6,T1:21,type:'dolly',from:{p:[.18,1.5,2.02],at:[-.88,1.27,1.06],fov:37},to:{p:[.35,1.6,2.25],at:[-.84,1.27,.98],fov:39}},
 {id:'09-trouble',T0:21,T1:24,type:'dolly',from:{p:[-2.1,1.6,.85],at:[-1.9,1.32,-2.43],fov:42},to:{p:[-.2,1.65,1.25],at:[.45,1.22,-2.46],fov:54}},
 {id:'10-ready',T0:24,T1:27.8,type:'dolly',from:{p:[-2.8,1.8,3.55],at:[.2,1.18,-1.1],fov:46},to:{p:[-1.8,1.6,2.55],at:[.1,1.18,-1.3],fov:49}},
 {id:'11-your-turn',T0:27.8,T1:30,type:'dolly',from:{p:[-1.05,1.23,1.05],at:[.0,1.2,-2.45],fov:65},to:{p:[-1.05,1.23,1.05],at:[.0,1.2,-2.45],fov:65}},
];
export function shotAt(t){return SHOTS.find(s=>t>=s.T0&&t<s.T1)||SHOTS.at(-1);}
export function ballAt(t){
 if(t<SHOT_TIME)return BALL_PATH[0].slice();
 const times=[SHOT_TIME,...BOUNCES,HIT_TIME];for(let i=0;i<3;i++)if(t<times[i+1])return mix3(BALL_PATH[i],BALL_PATH[i+1],clamp((t-times[i])/(times[i+1]-times[i])));
 const u=smooth(HIT_TIME,15.15,t),p=mix3(BALL_PATH[3],[-.15,.65,3.36],u);p[1]+=Math.sin(u*Math.PI)*.23;
 if(t>15.15)p[1]+=.06*Math.exp(-(t-15.15)*2.1)*Math.abs(Math.sin((t-15.15)*10));return p;
}
export function sampleIntro(time){
 const t=clamp(time,0,DURATION),approach=smooth(6.35,9.4,t),sit=smooth(HIT_TIME,15.2,t),recoil= t<SHOT_TIME?0:Math.exp(-(t-SHOT_TIME)*5)*Math.sin((t-SHOT_TIME)*19);
 const walker=mix3([1.8,0,-2.95],WALKER,approach);if(t>HIT_TIME){const p=mix3(WALKER,SIT,sit);p[1]+=.22*Math.sin(sit*Math.PI);walker.splice(0,3,...p);}else if(t>6.35&&t<9.4)walker[1]=Math.abs(Math.sin((t-6.35)*Math.PI/ .65))*.13;
 return {t,shot:shotAt(t).id,hero:HERO.slice(),walker,approach,sit,reach:smooth(9.65,10.75,t)*(1-smooth(11.5,12.0,t)),startle:smooth(11.32,11.78,t)*(1-smooth(17.8,19.2,t)),recoil,load:smooth(.5,5.6,t),door:Math.max(smooth(6.25,7.1,t)*.5,smooth(20.5,22,t)),threat:smooth(20.6,22,t),bow:smooth(22,24.0,t),ready:smooth(24.2,26.0,t),pov:t>=27.8,title:smooth(26,26.4,t),ball:ballAt(t)};
}
