// Synthesized cloth, wood and spring sounds. No downloads or external audio assets.
export const SOUND_PROFILES={
 single:{name:'Spool popper',description:'bright wooden pop + short yarn twang'},
 scatter:{name:'Pom-pom trio',description:'three offset pops + a broad cloth puff'},
 heavy:{name:'Quilt cannon',description:'low padded thump + spring and latch tail'},
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function noiseBuffer(ctx){const buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate),a=buffer.getChannelData(0);let seed=611;for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=(seed/4294967296)*2-1;}return buffer;}
function chain(ctx,destination){const master=ctx.createGain(),limit=ctx.createDynamicsCompressor();master.gain.value=.8;limit.threshold.value=-13;limit.knee.value=12;limit.ratio.value=5;limit.attack.value=.003;limit.release.value=.11;master.connect(limit);limit.connect(destination);return master;}
export function scheduleSound(ctx,out,noise,kind,{weapon='single',power=0,strength=1,pan=0}={},at=ctx.currentTime){
 const gain=ctx.createGain();gain.gain.value=clamp(strength,.25,1.3);const stereo=ctx.createStereoPanner();stereo.pan.value=clamp(pan,-.65,.65);gain.connect(stereo);stereo.connect(out);let end=at+.6;
 const tone=(delay,freq,to,duration,volume,type='sine')=>{const o=ctx.createOscillator(),g=ctx.createGain(),t=at+delay;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.003);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(gain);o.start(t);o.stop(t+duration+.01);end=Math.max(end,t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};};
 const puff=(delay,duration,volume,freq,type='lowpass',q=.6)=>{const b=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),t=at+delay;b.buffer=noise;f.type=type;f.frequency.value=freq;f.Q.value=q;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);b.connect(f);f.connect(g);g.connect(gain);b.start(t,.21,duration+.01);end=Math.max(end,t+duration+.02);b.onended=()=>{b.disconnect();f.disconnect();g.disconnect();};};
 const tune=1-power*.12;
 if(kind==='shot'){
  if(weapon==='scatter'){
   for(const [delay,f]of [[0,310],[.017,255],[.035,355]])tone(delay,f*tune,105,.09,.060,'triangle');
   puff(0,.19,.24,1550,'bandpass',.55);puff(.06,.16,.09,2800);tone(.08,480,250,.13,.020);
  }else if(weapon==='heavy'){
   tone(0,142*tune,48,.34,.23);tone(.002,235*tune,83,.19,.095,'triangle');puff(0,.20,.28,850);puff(.002,.035,.11,2200,'highpass');
   tone(.105,320,125,.075,.047,'triangle');tone(.15,168,88,.30,.032);puff(.125,.14,.055,1250,'bandpass',1.4);
  }else{
   tone(0,470*tune,155,.085,.105,'triangle');tone(.012,880*tune,570,.15,.029);tone(0,1550,750,.021,.018,'triangle');puff(0,.060,.16,3500,'bandpass',.8);
  }
 }else if(kind==='hit'){
  if(weapon==='heavy'){tone(0,126,47,.21,.15);tone(.003,410,115,.09,.045,'triangle');puff(0,.13,.19,850);}
  else if(weapon==='scatter'){puff(0,.10,.13,1900,'bandpass',.65);tone(0,325,140,.075,.050,'triangle');}
  else{tone(0,590,205,.068,.075,'triangle');tone(.012,170,95,.095,.035);puff(0,.065,.11,2100);}
 }else if(kind==='kill'){
  puff(0,.22,.19,1100);tone(0,190,75,.18,.09);tone(.065,420,290,.16,.035);tone(.12,610,440,.18,.025);
 }else if(kind==='hurt'){tone(0,240,105,.14,.11,'triangle');puff(0,.11,.13,1400);}
 else if(kind==='switch'){tone(0,650,370,.032,.025,'triangle');puff(.018,.045,.05,2200);}
 else{tone(0,weapon==='heavy'?135:290,weapon==='heavy'?65:165,.065,.028);puff(0,.055,.05,weapon==='scatter'?2100:1100);}
 // Offline rendering calls onended synchronously at completion; live buses bound overall concurrency.
 const cleanup=ctx.createConstantSource();cleanup.offset.value=0;cleanup.connect(gain);cleanup.start(at);cleanup.stop(end);cleanup.onended=()=>{cleanup.disconnect();gain.disconnect();stereo.disconnect();};
}
export function createWoolAudio(ctx){const noise=noiseBuffer(ctx),out=chain(ctx,ctx.destination),last={};return {play(kind,options={}){const now=ctx.currentTime,min=kind==='hit'?.045:kind==='bounce'?.09:0;if(now-(last[kind]??-10)<min)return false;last[kind]=now;scheduleSound(ctx,out,noise,kind,options,now+.002);return true;}};}
function wav(buffer){const n=buffer.length,bytes=new Uint8Array(44+n*2),v=new DataView(bytes.buffer),str=(s,i)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));};str('RIFF',0);v.setUint32(4,36+n*2,true);str('WAVEfmt ',8);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str('data',36);v.setUint32(40,n*2,true);const a=buffer.getChannelData(0);let peak=0,sum=0,clipped=0;for(let i=0;i<n;i++){const x=a[i];peak=Math.max(peak,Math.abs(x));sum+=x*x;if(Math.abs(x)>=.999)clipped++;v.setInt16(44+i*2,Math.round(clamp(x,-1,1)*32767),true);}return {bytes,peak,rms:Math.sqrt(sum/n),clipped};}
export async function renderSoundSample(weapon){const ctx=new OfflineAudioContext(1,48000*1.85,48000),out=chain(ctx,ctx.destination),noise=noiseBuffer(ctx);scheduleSound(ctx,out,noise,'shot',{weapon},.10);scheduleSound(ctx,out,noise,'hit',{weapon},.85);scheduleSound(ctx,out,noise,'bounce',{weapon},1.4);return wav(await ctx.startRendering());}
