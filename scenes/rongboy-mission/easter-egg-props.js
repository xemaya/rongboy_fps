// 每件彩蛋各自的毛毡模型与动作。坐标以关卡里标的道具中心为原点，正面朝 +z。
import * as T from 'three';
import { cabinet } from '../../cine-engine/library/structures/plush.js';
import { dinosaur, displayCase, plinth } from '../../cine-engine/library/structures/museum.js';
import { createVapor } from './vapor.js';

const clamp = x => Math.min(1, Math.max(0, x));
const ease = (a, b, t) => T.MathUtils.smoothstep(t, a, b);
const bump = (a, b, t) => Math.sin(Math.PI * clamp((t - a) / (b - a)));
const swing = (t, hz, decay) => Math.sin(t * hz) * Math.exp(-t * decay);
const wood = 0x9c7351, ivory = 0xf4dfad, ink = 0x424042, coral = 0xd26058, moss = 0x83a388, gold = 0xe3b861;
const teal = 0x538a8d, blue = 0x6fa3b7;

export function createEasterEggProps({ Kit, M, floors, level }) {
  const eggs = new Map();
  function add(spec) {
    const root = new T.Group();
    root.name = 'easter-egg-' + spec.id;
    root.position.set(spec.x, spec.y, spec.z);
    root.rotation.y = spec.yaw ?? 0;
    floors[spec.floor].add(root);

    const part = (draw, x = 0, y = 0, z = 0, parent = root) => {
      const k = new Kit();
      draw(k);
      const group = new T.Group();
      group.add(...k.build({ name: spec.id }));
      group.position.set(x, y, z);
      parent.add(group);
      return group;
    };
    const felt = (k, c, r, x, y, z, sx = 1, sy = 1, sz = 1) =>
      k.sphere(M('felt', c), r, x, y, z, { seg: 12, rings: 8, sx, sy, sz });
    const box = (k, c, w, h, d, x, y, z, look = 'felt') =>
      k.soft(M(look, c), w, h, d, x, y, z, { r: Math.min(0.06, w * 0.24, h * 0.24, d * 0.24) });
    const tube = (k, c, points, r = 0.02) => k.tube(M('knit', c), points, r, { seg: 6, detail: 2 });
    const button = (k, c, r, h, x, y, z, options = {}) => k.cyl(M.button(c), r, r, h, x, y, z, { seg: 16, ...options });
    const frame = (w, h, background) => part(k => {
      box(k, wood, w, h, 0.08, 0, 0, 0, 'boards');
      box(k, background, w - 0.12, h - 0.12, 0.025, 0, 0, 0.047);
    });
    const face = (k, x, y, z, r, color) => {
      felt(k, color, r, x, y, z, 1, 0.93, 0.16);
      for (const sx of [-1, 1]) felt(k, ink, r * .12, x + sx * r * .37, y + r * .14, z + r * .16, 0.85, 1.1, .6);
      tube(k, ink, [[x-r*.25,y-r*.23,z+r*.16],[x,y-r*.34,z+r*.18],[x+r*.25,y-r*.23,z+r*.16]], r * .04);
    };
    let fixture;
    if (spec.mount && spec.replaces) {
      const host = level.storeys[spec.floor].furnitureBoxes.find(box => box.id === spec.mount.host);
      const sideways = Math.abs(Math.sin(spec.yaw)) > .5;
      fixture = { ...host, x:0, z:-(spec.mount.forward ?? 0), w:sideways ? host.d : host.w, d:sideways ? host.w : host.d, face:'s' };
    }
    let animate;
    const duration = 1.5;
    let sounds;

    switch (spec.id) {
      case 'tv': {
        part(k => cabinet(k, M, fixture),0,-spec.y);
        const set = part(k => {
          box(k,wood,.56,.062,.31,0,-.30,0,'toy_wood');
          box(k,0xb58a58,1.0,.53,.34,0,-.014,0,'boards');
          box(k,ink,.72,.435,.036,-.107,-.008,.171);
          box(k,0x355151,.647,.371,.023,-.107,-.004,.192);
          for (const y of [-.035,.119]) button(k,y>0 ? ivory : coral,.055,.046,.375,y,.186,{rx:Math.PI/2});
          for (const x of [.301,.344,.387,.43]) box(k,ink,.014,.080,.015,x,-.153,.178);
        });
        const aerial = part(k => {
          for (const direction of [-1,1]) {
            tube(k,ink,[[0,0,0],[.13*direction,.10,-.012],[.20*direction,.21,-.04]],.014);
            felt(k,gold,.024,.20*direction,.21,-.04);
          }
        },.01,.238,-.04,set);
        const channel = part(k => {
          k.soft(M.glow(0x83b4b2,.64),.642,.36,.019,0,0,0,{r:.043});
          felt(k,gold,.074,.118,.079,.018,1,1,.12);
          felt(k,0x698b69,.19,-.128,-.094,.019,1,.39,.12);
          felt(k,0x91ad73,.17,.106,-.114,.027,1,.34,.10);
          tube(k,ivory,[[-.275,-.115,.035],[-.168,-.105,.035],[-.069,-.113,.035]],.01);
        },-.107,-.004,.205,set);
        const cloud = part(k => {
          for (const [x,y,scale] of [[-.044,0,.70],[0,.014,1],[.044,0,.62]]) felt(k,ivory,.043,x,y,0,scale,.45,.14);
        },-.153,.098,.038,channel);
        animate = t => {
          set.rotation.z = .071*swing(t,23,4.6);
          aerial.rotation.x = .48*swing(t,25,3.6);
          const screen = ease(.05,.21,t)*(1-ease(1.25,1.5,t));
          channel.visible = screen > .001;
          channel.scale.y = Math.max(.02,screen);
          cloud.position.x = -.153 + .276*ease(.12,1.32,t);
        };
        sounds = ['tv-switch','tv-channel'];
        break;
      }
      case 'fridge': {
        const { w, d, h:height, color } = fixture;
        const bottom = -spec.y, top = bottom+height, split = bottom+.62*height;
        const front = fixture.z+d/2;
        part(k => {
          box(k,color,w,height,.11,0,bottom+height/2,front-d+.055);
          for (const side of [-1,1]) box(k,color,.078,height,d,side*(w-.078)/2,bottom+height/2,fixture.z);
          for (const y of [top-.042,split,bottom+.05]) box(k,ivory,w-.12,.075,d-.10,0,y,fixture.z);
          box(k,color,w-.058,split-bottom-.07,.09,0,(split+bottom)/2,front);
          box(k,ink,.043,.238,.045,-w/2+.133,split-.251,front+.052,'toy_wood');
          const shelf = split+.057;
          box(k,0xb7e0d2,w-.21,.04,d-.15,0,shelf,fixture.z);
          box(k,ivory,.16,.205,.14,-.124,shelf+.121,front-.24);
          box(k,teal,.16,.071,.144,-.124,shelf+.117,front-.24);
          button(k,blue,.06,.031,-.124,shelf+.24,front-.24);
          k.cyl(M('felt',coral),.077,.068,.138,.135,shelf+.087,front-.34,{seg:12});
          button(k,gold,.082,.041,.135,shelf+.162,front-.34);
        });
        const fridgeLight = part(k => k.soft(M.glow(0xb6dccc,.95),w-.22,.044,.096,0,top-.11,front-.24,{r:.017}));
        const doorWidth = w-.063, doorHeight = top-split-.07;
        const door = part(k => {
          box(k,color,doorWidth,doorHeight,.089,doorWidth/2,split+.028+doorHeight/2,0);
          box(k,ink,.044,.235,.045,doorWidth-.114,split+.176,.06,'toy_wood');
          for(const [x,y,paint] of [[.21,.38,gold],[.34,.50,coral],[.39,.33,teal]]) {
            felt(k,paint,.040,x,split+y,.050,1,1,.42);
          }
        },-doorWidth/2,0,front+.014);
        animate = t => {
          const open = ease(.02,.32,t)*(1-ease(.87,1.39,t));
          door.rotation.y = -1.20*open + .047*swing(Math.max(0,t-1.37),36,15)*(1-ease(1.43,1.5,t));
          fridgeLight.visible = open > .13;
        };
        sounds = ['fridge-latch','fridge-hum'];
        break;
      }
      case 'toaster': {
        part(k => {
          box(k,wood,.44,.047,.31,0,-.169,0,'toy_wood');
          box(k,coral,.47,.297,.34,0,-.022,0);
          box(k,ivory,.443,.036,.306,0,.126,0);
          for (const z of [-.067,.066]) box(k,ink,.321,.014,.052,0,.146,z);
          button(k,ivory,.043,.032,.116,-.058,.179,{rx:Math.PI/2});
        });
        const lever = part(k => box(k,ink,.17,.036,.102,0,0,0,'toy_wood'),.246,.045,.017);
        const slices = [-.068,.067].map(z => part(k => {
          box(k,0x965531,.289,.229,.057,0,0,0);
          for (const side of [-1,1]) box(k,0xf1cb88,.245,.179,.022,0,.006,side*.034);
          for(const x of [-.038,.038]) felt(k,ink,.009,x,.023,.053);
          tube(k,wood,[[-.027,-.031,.055],[0,-.048,.055],[.027,-.031,.055]],.006);
        },0,.046,z));
        animate = t => {
          lever.position.y = .045 - .105*bump(0,.33,t);
          slices.forEach((slice,index) => {
            const start = .155 + index*.11;
            const pop = bump(start,start+.69,t);
            slice.visible = pop > .01;
            slice.position.y = .048 + (index ? .51 : .64)*pop;
            slice.rotation.x = (index ? -.58 : .72)*pop;
            slice.rotation.z = (index ? -.31 : .34)*pop;
          });
        };
        sounds = ['knock','toast-pop'];
        break;
      }
      case 'armor': {
        part(k => plinth(k,M,{...fixture,item:null}),0,-spec.y);
        const gray = 0x97a5a6, dark = 0x52656a;
        part(k => {
          for (const x of [-.125,.125]) {
            box(k,gray,.158,.485,.174,x,-.464,0);
            box(k,dark,.179,.112,.263,x,-.667,.041);
            felt(k,gray,.123,x<0 ? -.31 : .31,.236,0,1,.92,1.19);
          }
          box(k,gray,.464,.508,.33,0,-.010,0);
          box(k,dark,.447,.071,.345,0,-.237,0);
          felt(k,coral,.205,-.318,-.116,.192,1,1.19,.20);
          button(k,gold,.066,.039,-.318,-.113,.237,{rx:Math.PI/2});
          tube(k,ivory,[[-.159,.132,.165],[0,.092,.19],[.159,.132,.165]],.012);
        });
        const glove = part(k => {
          box(k,gray,.132,.32,.148,0,-.149,0);
          felt(k,dark,.077,0,-.317,.032,1,1.15,1.01);
          button(k,gold,.023,.029,.05,-.205,.065,{rx:Math.PI/2});
        },.302,.229,.025);
        const head = part(k => {
          felt(k,gray,.193,0,0,0,1,1.06,1);
          felt(k,ivory,.128,0,-.011,.069,1,.90,.85);
          for (const x of [-.05,.05]) felt(k,ink,.019,x,.024,.170);
          felt(k,coral,.077,.01,.185,-.086,.65,1.1,1.32);
        },0,.466,0);
        const visor = part(k => {
          box(k,dark,.322,.139,.083,0,-.048,.133);
          for (const x of [-.091,0,.091]) box(k,0x333e43,.027,.034,.017,x,-.052,.176);
          for (const x of [-.151,.151]) felt(k,gold,.027,x,-.012,.128);
        },0,.058,.025,head);
        animate = t => {
          const salute = ease(.18,.47,t)*(1-ease(.88,1.36,t));
          glove.rotation.z = -2.37*salute;
          glove.rotation.x = -.32*salute;
          head.rotation.z = .103*swing(t,23,3.9);
          visor.rotation.x = -1.36*salute;
        };
        sounds = ['clang','rattle'];
        break;
      }
      case 'mummy': {
        const hand = part(k => {
          tube(k,ivory,[[0,0,0],[0,.11,.01],[.018,.21,.07],[.04,.32,.10]],.066);
          felt(k,0xe5d7bb,.083,.041,.326,.106,1,1.06,.75);
          felt(k,ivory,.048,.091,.308,.109,.61,1.05,.67);
          for (let i=0;i<3;i++) {
            tube(k,i%2 ? 0xbfb195 : gold,[[-.076+i*.008,.054+i*.071,.034],[.007,.023+i*.071,.072],[.07+i*.003,.044+i*.071,.041]],.013);
          }
          tube(k,ivory,[[-.055,.059,.046],[-.128,.02,.142],[-.202,-.099,.224],[-.186,-.194,.269]],.019);
        },-.18,0,-.1);
        animate = t => {
          const reach = ease(.08,.32,t)*(1-ease(.96,1.44,t));
          hand.visible = reach > .001;
          // The wrist sits against the mummy's shoulder inside the coffin.
          hand.position.set(-.176,.055,-.275);
          hand.rotation.z = .23+.52*reach + .36*swing(Math.max(0,t-.30),19,1.8)*reach;
          hand.rotation.x = -.31 + 1.10*reach;
        };
        sounds = ['flop','whip'];
        break;
      }
      case 'prism': {
        const display = Object.assign((name, color) => M(name, color), M, {
          glow: (color, strength) => M.glow(color, strength * .43),
        });
        part(k => displayCase(k,display,{...fixture,item:'gem-empty'}),0,-spec.y);
        const gem = part(k => {
          k.sphere(M.glow(0x78cfb3,.92),.244,0,0,0,{seg:5,rings:2,sy:1.18});
          for (const side of [-1,1]) tube(k,ivory,[[0,.239,0],[side*.17,0,.15],[0,-.237,0]],.012);
        },0,-.115,fixture.z);
        const glints = [0xf6cd7b,0xb2e8db,0xe6a0aa].map(color => part(k => {
          k.extrude(M.glow(color,.92),[[0,-.128],[.097,0],[0,.128],[-.097,0]],.018,new T.Matrix4());
        }));
        animate = t => {
          gem.rotation.y = .34 + Math.PI*2*ease(.03,1.47,t);
          gem.position.y = -.115 + .19*bump(0,1.5,t);
          glints.forEach((glint,index) => {
            const start = .16 + index*.15, flash = bump(start,start+.80,t);
            glint.visible = flash > .001;
            glint.scale.setScalar(Math.max(.01,flash));
            const angle = (index-1)*1.0 + .24*ease(start,start+.8,t);
            glint.position.set(Math.sin(angle)*(.59+flash*.25),.32-index*.077+flash*.092,fixture.z+.26);
            glint.rotation.z = .64*ease(start,start+.8,t);
          });
        };
        sounds = ['ting','prism-chime'];
        break;
      }
      case 'cushions': {
        const pad = (x, y, width, height, depth, color) => part(k => {
          k.soft(M('quilt', color), width, height, depth, 0, 0, 0, { r: .084, seg: 4 });
          tube(k, ivory, [[-width*.36,-height*.32,depth*.43],[0,-height*.39,depth*.50],[width*.36,-height*.32,depth*.43]], .010);
        }, x, y);
        const a = pad(-.22, 0, .42, .41, .167, coral);
        const b = pad(.27, -.043, .35, .34, .156, gold);
        a.rotation.set(-.27, .08, -.11);
        b.rotation.set(-.25, -.16, .12);
        animate = t => {
          const press = bump(0, .31, t), flip = ease(.16,.78,t);
          a.scale.set(1+.13*press, 1-.15*press, 1-.52*press);
          a.position.y = -.024 * press;
          b.position.y = -.043 + .31*bump(.16,.79,t);
          b.rotation.z = .12 + Math.PI*2*flip;
        };
        sounds = ['thump', 'flop'];
        break;
      }
      case 'duck': {
        const water = part(k => {
          k.soft(M('felt',0x83bdc4),1.38,.023,.54,0,0,0,{r:.011});
        }, -.43, -.12, -.25);
        water.name = 'bath-water';
        const duck = part(k => {
          felt(k,0xf5ca4f,.16,0,0,0,1.25,.8,.91);
          felt(k,0xf7ce50,.111,-.11,.12,0);
          felt(k,0xe57632,.054,-.21,.093,0,1.3,.66,1.05);
          for (const z of [-.094,.094]) felt(k,ink,.015,-.141,.148,z);
          felt(k,0xf8d36a,.075,.143,.056,0,1,.85,.8);
          for (const z of [-.12,.12]) felt(k,0xeeb73c,.095,.044,-.015,z,1.2,.7,.35);
        });
        animate = t => {
          duck.position.set(-.39 * ease(.04,.52,t) + .24 * ease(.64,1.4,t), .31*bump(0,.49,t) - .085*ease(.45,.58,t) + .08*bump(.53,1.45,t), -.23*ease(.1,.52,t));
          duck.rotation.z = -2.6*ease(.08,.66,t) - .12*swing(Math.max(0,t-.57),24,2)*ease(.54,.66,t);
        };
        sounds = ['squeak', 'splash'];
        break;
      }
      case 'photo': {
        const outer = frame(.83,.61,0xb3c5a2);
        const faces = part(k => {
          for (const [x,y,r,c] of [[-.20,-.02,.115,ivory],[.19,-.06,.13,0xdeb496],[.02,.11,.09,0xf0bd84]]) {
            face(k,x,y,.014,r,c);
            box(k,teal,r*1.3,r*.19,.019,x,y+r*.89,.035);
          }
        },0,0,.069,outer);
        faces.name = 'family-portrait';
        const inset = part(k => {
          box(k,ivory,.41,.36,.038,0,0,0);
          box(k,blue,.35,.30,.022,0,0,.021);
          felt(k,ivory,.102,-.053,.01,.039,1,.92,.17);
          for (const x of [-.091,-.018]) tube(k,ink,[[x-.017,.024,.061],[x,.013,.061],[x+.017,.024,.061]],.006);
          felt(k,coral,.069,.062,-.076,.055,1,1,.4);
          tube(k,ivory,[[.022,-.065,.079],[.05,-.105,.084],[.087,-.076,.082]],.007);
        },.16,-.08,.097,outer);
        animate = t => {
          outer.rotation.z = -.16*ease(0,.26,t) + .17*swing(t,22,4.4);
          const reveal = ease(.11,.65,t);
          inset.visible = reveal > 0;
          inset.position.set(.16+.43*reveal,-.08-.15*reveal,.097);
          inset.rotation.z = -.32*reveal;
        };
        sounds = ['knock', 'flop'];
        break;
      }
      case 'bobbin': {
        const spool = part(k => {
          k.cyl(M('knit', coral), .155, .155, .32, 0, 0, 0, { seg: 16, rz: Math.PI / 2 });
          for (const x of [-.174,.174]) button(k,wood,.19,.057,x,0,0,{rz:Math.PI/2});
        });
        const thread = part(k => tube(k,coral,[[0,0,0],[0,.03,.2],[0,-.02,.68],[0,0,1]],.019),0,-.16,.02);
        animate = t => {
          const roll = ease(0,.52,t)*1.05 - .84*ease(.57,1.34,t);
          spool.position.z = roll;
          spool.rotation.x = roll/.18 + .18*swing(t,26,2);
          thread.visible = roll > .02;
          thread.scale.z = Math.max(.01,roll);
        };
        sounds = ['whirr', 'flop'];
        break;
      }
      case 'locker': {
        part(k => {
          box(k,blue,2.4,1.8,.5,0,-.01,0);
          for (const [x,c] of [[-.8, gold],[.8, moss]]) {
            box(k,c,.74,1.69,.06,x,0,.26);
            for (const y of [.46,.53,.60]) box(k,ink,.32,.018,.01,x,y,.3);
            button(k,ivory,.034,.024,x+.26,0,.3,{rx:Math.PI/2});
          }
          box(k,ink,.65,1.63,.033,0,0,.267);
        });
        const door = part(k => {
          box(k, coral, .72, 1.69, .057, .36, 0, 0);
          for (const y of [.46,.53,.60]) box(k,ink,.31,.017,.01,.36,y,.033);
          button(k,ivory,.033,.024,.63,0,.04,{rx:Math.PI/2});
        }, -.36,0,.313);
        const rope = part(k => {
          tube(k,ivory,[[0,0,0],[.08,.19,.13],[.22,.21,.27],[.4,.09,.37],[.46,-.14,.35],[.33,-.32,.31]],.025);
          box(k,teal,.075,.15,.072,.33,-.36,.31,'toy_wood');
        }, -.23,-.05,.3);
        animate = t => {
          door.rotation.y = -1.57*bump(0,1.22,t);
          rope.visible = t > .12 && t < 1.02;
          rope.rotation.y = -1.12 + 2.28*bump(.12,1.02,t);
          rope.rotation.z = .45*swing(Math.max(0,t-.12),19,1.25);
        };
        sounds = ['clang', 'whip'];
        break;
      }
      case 'chalk': {
        frame(3.16,1.33,0x364c43);
        const chalk = (k, strokes) => {
          for (const path of strokes) tube(k,ivory,path.map(([x,y]) => [x,y,.079]),.018);
        };
        part(k => chalk(k, [
          [[-.98,.10],[-.86,.24],[-.68,.10],[-1,-.13],[-.67,-.13]],
          [[-.47,0],[-.25,0]], [[-.36,-.11],[-.36,.11]],
        ]));
        const math = part(k => chalk(k, [
          [[-.13,.11],[.11,.11],[-.03,-.15]], [[.31,.055],[.51,.055]], [[.31,-.06],[.51,-.06]],
          [[.69,.18],[.91,.18],[.91,-.13],[.70,-.13],[.69,.02],[.91,.02]],
        ]));
        const eraser = part(k => {
          box(k,wood,.31,.133,.16,0,.03,0,'toy_wood');
          box(k,ink,.31,.058,.16,0,-.04,0);
        },-1.19,-.51,.115);
        const smile = part(k => {
          const points = Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/7.5)*.18,Math.sin(i*Math.PI/7.5)*.14,.079]);
          tube(k,ivory,points,.016);
          for (const x of [-.063,.063]) tube(k,ivory,[[x-.022,.054,.079],[x+.022,.01,.079],[x,.032,.081],[x+.022,.054,.079],[x-.022,.01,.079]],.01);
          tube(k,ivory,[[-.075,-.05,.08],[0,-.09,.08],[.075,-.05,.08]],.011);
        },1.16,-.29);
        animate = t => {
          eraser.position.x = -1.19 + 2.36*ease(0,.72,t);
          eraser.position.y = -.51 + .52*bump(0,.79,t);
          eraser.rotation.z = .35*swing(t,19,1.7);
          math.visible = t < .44;
          smile.visible = t > .44;
        };
        sounds = ['chalk', 'knock'];
        break;
      }
      case 'globe': {
        const pedestal = level.storeys[spec.floor].furnitureBoxes.find(c => c.id === spec.replaces);
        part(k => plinth(k,M,{ ...pedestal,x:0,z:0,item:null,face:'s' }),0,-spec.y);
        part(k => {
          button(k,wood,.27,.05,0,-.373,0);
          button(k,gold,.054,.33,0,-.22,0);
          const arc = Array.from({length:13},(_,i) => {
            const a = -.9 + i*3.8/12;
            return [.361*Math.cos(a),.361*Math.sin(a)+.07,.042];
          });
          tube(k,gold,arc,.025);
        });
        const planet = part(k => {
          felt(k,blue,.33,0,0,0);
          for (const [a,b,r] of [[.4,.3,.13],[2.2,-.2,.16],[3.6,.5,.1],[5,-.1,.14],[1.2,-.6,.09]]) {
            felt(k,moss,r,Math.cos(a)*Math.cos(b)*.277,Math.sin(b)*.28,Math.sin(a)*Math.cos(b)*.277);
          }
        },0,.055,0);
        const flag = part(k => {
          tube(k,ivory,[[0,0,0],[0,.28,0]],.019);
          k.extrude(M('felt',coral),[[0,.15],[.22,.18],[0,.28]],.026,new T.Matrix4());
        },.15,.19,.21,planet);
        animate = t => {
          planet.rotation.y = Math.PI*4*ease(0,1.3,t);
          flag.visible = t > .83;
          flag.rotation.z = -1.24 + 1.18*ease(.83,1.29,t)+.23*swing(Math.max(0,t-.94),30,3);
        };
        sounds = ['whirr', 'flop'];
        break;
      }
      case 'seesaw': {
        part(k => {
          box(k,wood,.48,.49,.57,0,-.23,0,'toy_wood');
          button(k,teal,.12,.62,0,-.018,0,{rx:Math.PI/2});
        });
        const beam = part(k => {
          box(k,moss,2.8,.14,.32,0,0,0,'toy_wood');
          for (const x of [-1.16,1.16]) {
            box(k,coral,.46,.08,.43,x,.105,0,'quilt');
            tube(k,ivory,[[x*.76,.08,-.12],[x*.76,.30,-.12],[x*.76,.30,.12],[x*.76,.08,.12]],.023);
          }
        });
        const balls = [-1,1].map((end,i) => part(k => {
          k.sphere(M('knit',i ? gold : teal),.15,0,0,0,{seg:14,rings:10});
        },end*1.16,.3));
        animate = (t, side = -1) => {
          const angle = -side * (.40*bump(0,.32,t) - .33*swing(Math.max(0,t-.60),18,3));
          beam.rotation.z = angle;
          balls.forEach((ball,i) => {
            const end = i ? 1 : -1, x = end*1.16;
            const launch = end === -side ? .84*bump(.065,.73,t) : 0;
            ball.position.set(x*Math.cos(angle)-.30*Math.sin(angle), x*Math.sin(angle)+.30*Math.cos(angle)+launch, 0);
          });
        };
        sounds = ['knock', 'boing'];
        break;
      }
      case 'dinosaur': {
        const furniture = level.storeys[spec.floor].furnitureBoxes.find(c => c.id === spec.replaces);
        const dino = part(k => dinosaur(k,M,{ ...furniture,x:0,z:0 }),0,-spec.y);
        const meshes = dino.children.flatMap(mesh => {
          const positions = mesh.geometry.getAttribute('position');
          mesh.geometry.computeBoundingBox();
          if (!positions || mesh.geometry.boundingBox.max.y <= .7) return [];
          const rest = positions.array.slice();
          const weights = new Float32Array(positions.count);
          for (let i = 0; i < weights.length; i++) weights[i] = ease(.57,.92,rest[i*3+1]);
          return [{ positions, rest, weights }];
        });
        animate = t => {
          const amplitude = .16*(1-ease(1.09,1.5,t));
          const bite = .12*bump(.53,.81,t);
          for (const { positions, rest, weights } of meshes) {
            for (let i = 0, j = 0; i < weights.length; i++, j+=3) {
              const z = rest[j+2], delay = Math.max(0,(z+3.1)*.087);
              const elapsed = Math.max(0,t-delay);
              positions.array[j] = rest[j] + amplitude*weights[i]*swing(elapsed,26,5);
              const jaw = z > 2.42 && rest[j+1] > 2.82 && rest[j+1] < 3.29;
              positions.array[j+1] = rest[j+1] + (jaw ? bite : 0);
            }
            positions.needsUpdate = true;
          }
        };
        sounds = ['rattle', 'jaw'];
        break;
      }
      case 'cat': {
        part(k => {
          const furniture = level.storeys[spec.floor].furnitureBoxes.find(c => c.id === spec.replaces);
          plinth(k,M,{ ...furniture,x:0,z:0,item:null });
        },0,-spec.y,0);
        const cat = part(k => {
          felt(k,ink,.26,0,-.17,0,.8,1.12,.8);
          felt(k,ink,.27,0,.16,.015,1,.82,.85);
          for (const x of [-.16,.16]) {
            const tip = x*1.36;
            k.extrude(M('felt',ink),[[x-.095,.26],[x+.095,.26],[tip,.54]],.12,new T.Matrix4().makeTranslation(0,0,-.055));
            k.extrude(M('felt',gold),[[x-.049,.29],[x+.049,.29],[tip,.45]],.017,new T.Matrix4().makeTranslation(0,0,.07));
          }
          button(k,gold,.063,.025,0,-.07,.209,{rx:Math.PI/2});
          felt(k,gold,.034,0,.12,.247,1,.73,.32);
          tube(k,ink,[[.15,-.36,-.05],[.29,-.32,-.12],[.32,-.11,-.13],[.28,-.02,-.1]],.052);
        });
        const eyes = [-.106,.106].map(x => part(k => {
          felt(k,gold,.064,0,0,0,1,.58,.3);
          felt(k,ink,.026,0,0,.016,.45,1.05,.45);
        },x,.206,.232,cat));
        animate = t => {
          cat.rotation.z = .068*swing(t,24,3.8);
          eyes.forEach((eye,i) => { const start = .16+i*.25; eye.scale.y = .11+.89*ease(start,start+.12,t)*(1-ease(.97,1.26,t)); });
        };
        sounds = ['tock', 'cat'];
        break;
      }
      case 'sailboat': {
        frame(1.66,1.21,0xa6c9c5);
        const waves = Array.from({length:3},(_,i)=>part(k=>{
          tube(k,i%2?ivory:teal,[[-.65,0,0],[-.38,.02,0],[-.19,-.01,0],[.09,.02,0],[.42,-.01,0],[.65,0,0]],.021);
        },0,-.19-i*.12,.08));
        const boat = part(k=>{
          k.extrude(M('felt',coral),[[-.31,0],[.31,0],[.18,-.14],[-.19,-.14]],.045,new T.Matrix4());
          tube(k,wood,[[0,0,.025],[0,.53,.025]],.017);
        },-.33,-.11,.09);
        const sail = part(k=>{
          k.extrude(M('quilt',ivory),[[.018,.063],[.27,.063],[.018,.53]],.027,new T.Matrix4());
          k.extrude(M('felt',gold),[[-.04,.066],[-.23,.066],[-.04,.36]],.027,new T.Matrix4());
        },0,0,.028,boat);
        animate = t => {
          boat.position.x = -.33 + .63*ease(.06,1.25,t);
          boat.rotation.z = .18*swing(t,16,1.7);
          sail.scale.z = 1 + 1.1*bump(.06,1.2,t);
          sail.rotation.y = -.28*bump(.02,1.29,t);
          waves.forEach((wave,i) => { wave.rotation.z = .065*swing(Math.max(0,t-i*.09),18,1.8); });
        };
        sounds = ['flop', 'splash'];
        break;
      }
      case 'cup': {
        part(k => {
          button(k,ivory,.30,.049,0,-.18,0);
          button(k,teal,.235,.021,0,-.148,0);
        });
        const cup = part(k => {
          k.cyl(M('felt',ivory),.15,.115,.245,0,0,0,{seg:18,open:true});
          button(k,0x734a34,.134,.018,0,.055,0);
          tube(k,ivory,[[.12,.1,0],[.23,.13,0],[.27,.035,0],[.21,-.055,0],[.129,-.069,0]],.028);
          felt(k,moss,.057,0,.006,-.147,1,1,.12);
          for(const x of [-.023,.023]) felt(k,ink,.009,x,.024,-.153);
          box(k,ivory,.045,.012,.009,0,-.017,-.157);
        });
        const spoon = part(k => {
          tube(k,gold,[[0,0,-.09],[0,.012,.11]],.017);
          felt(k,gold,.060,0,0,.13,.75,.21,1);
        },-.23,-.11,-.04);
        animate = t => {
          spoon.position.y = -.11 + .41*bump(0,.58,t);
          spoon.rotation.x = 3.9*bump(0,.64,t);
          cup.rotation.y = Math.PI*ease(.12,.93,t);
          cup.rotation.z = .12*swing(t,26,4.2);
        };
        sounds = ['china', 'ting'];
        break;
      }
      case 'scarecrow': {
        part(k => {
          tube(k,wood,[[0,-.94,0],[0,.47,0]],.038);
          tube(k,wood,[[-.58,.13,0],[.54,.13,0]],.033);
          box(k,0xc17d56,.57,.54,.19,0,-.09,0,'gingham');
          felt(k,ivory,.20,0,.48,.01,1,1.06,1);
          for (const x of [-.063,.063]) felt(k,ink,.024,x,.50,.199);
          tube(k,coral,[[-.08,.43,.19],[0,.40,.205],[.08,.43,.19]],.009);
        });
        const hat = part(k => {
          button(k,gold,.30,.062,0,0,0);
          k.cyl(M('knit',gold),.16,.21,.17,0,.099,0,{seg:16});
          button(k,coral,.208,.045,0,.049,0);
        },0,.64,0);
        const hand = part(k => {
          tube(k,ivory,[[0,0,0],[.12,-.02,.015],[.21,0,.015]],.036);
          for (const f of [-.039,0,.039]) tube(k,gold,[[.17,f,.016],[.26,f+.007,.016]],.011);
        },.36,.13,0);
        animate = t => {
          const slipped = ease(.02,.28,t)-ease(.66,1.11,t);
          hat.position.set(.045*slipped,.64-.17*slipped,.085*slipped);
          hat.rotation.x = .68*slipped;
          hand.rotation.z = 1.42*bump(.43,1.4,t);
          hand.position.set(.36-.19*bump(.43,1.4,t),.13+.30*bump(.43,1.4,t),.11*bump(.43,1.4,t));
        };
        sounds = ['knock', 'flop'];
        break;
      }
      case 'pot': {
        part(k => {
          k.cyl(M('felt',teal), .265,.229,.31,0,-.07,0,{seg:18});
          button(k,ivory,.267,.034,0,.075,0);
          for (const x of [-.30,.30]) tube(k,ink,[[x*.74,.005,-.10],[x,.031,-.07],[x,.031,.07],[x*.74,.005,.10]],.025);
        });
        const lid = part(k => {
          felt(k,teal,.268,0,0,0,1,.24,1);
          button(k,ink,.048,.066,0,.072,0);
        },0,.094,0);
        const steam = createVapor({ parent:root, y:.109, count:7, rise:.86, duration:.96, size:.64, drift:.11, opacity:.60 });
        animate = t => {
          lid.position.y = .094 + .47*bump(0,.67,t) + .10*bump(.67,.94,t);
          lid.rotation.z = .85*bump(0,.67,t)+.26*swing(Math.max(0,t-.67),35,8);
          steam(t - .09);
        };
        sounds = ['steam', 'clang'];
        break;
      }
      case 'sewing': {
        part(k => {
          box(k,ink,.84,.076,.49,0,-.245,0,'toy_wood');
          box(k,teal,.20,.51,.25,.27,-.02,0);
          box(k,teal,.62,.165,.23,.05,.174,0);
          box(k,teal,.18,.244,.23,-.23,.064,0);
          button(k,ivory,.023,.18,-.23,-.096,0);
          box(k,gold,.098,.035,.095,-.22,-.171,.018);
          k.cyl(M('knit',gold),.046,.046,.09,.13,.296,0,{seg:12});
        });
        const wheel = part(k=>{
          const rim = Array.from({length:17},(_,i)=>{
            const a=i*Math.PI/8;
            return [0,.165*Math.cos(a),.165*Math.sin(a)];
          });
          tube(k,wood,rim,.034);
          for (const a of [0,Math.PI/3,Math.PI*2/3]) tube(k,gold,[[0,-.16*Math.cos(a),-.16*Math.sin(a)],[0,.16*Math.cos(a),.16*Math.sin(a)]],.017);
        },.424,.051,0);
        const patch = part(k => {
          box(k,ivory,.26,.038,.38,0,0,0,'quilt');
          for (let i=0;i<5;i++) {
            const a = i*Math.PI*2/5;
            felt(k,coral,.049,Math.cos(a)*.055,.025,.064+Math.sin(a)*.061,1,.34,.8);
          }
          felt(k,gold,.023,0,.038,.067,1,.55,1);
        },-.19,-.182,-.14);
        // 布头最初收在针脚后，和桌板一起藏住图案。
        animate = t => {
          wheel.rotation.x = 5*Math.PI*ease(0,.96,t);
          patch.visible = t>.16;
          patch.scale.z = .24+.76*ease(.16,.86,t);
          patch.position.z = -.14+.36*ease(.16,.86,t);
        };
        sounds = ['sew', 'flop'];
        break;
      }
      case 'rocker': {
        const chair = part(k => {
          for (const x of [-.33,.33]) {
            const foot = Array.from({length:9},(_,i)=>{
              const z = (i-4)*.104;
              return [x,-.497+z*z*.75,z];
            });
            tube(k,wood,foot,.051);
            for(const z of [-.23,.22]) tube(k,wood,[[x,-.45,z],[x*.88,-.04,z*.8]],.032);
            tube(k,wood,[[x,-.02,-.3],[x,.21,-.26],[x,.21,.23],[x,-.075,.23]],.035);
          }
          box(k,wood,.70,.08,.66,0,-.055,0,'toy_wood');
          k.soft(M('boards',wood),.66,.59,.135,0,.254,-.30,{r:.060,rx:-.14});
          box(k,moss,.54,.41,.085,0,.255,-.227,'quilt');
        });
        const seat = part(k => box(k,coral,.63,.133,.56,0,0,0,'quilt'),0,.037,0);
        animate = t => {
          chair.rotation.x = -0.48*bump(0,.45,t)+.27*swing(Math.max(0,t-.45),15,2.8);
          seat.position.y = .037 + .65*bump(.12,.84,t);
          seat.rotation.x = .66*bump(.12,.83,t)+chair.rotation.x;
        };
        sounds = ['wood-creak', 'thump'];
        break;
      }
      default: throw new Error(`Unknown Easter egg: ${spec.id}`);
    }

    // play() 由真实的毛球命中驱动。静止姿态也走同一套动作，确保重开能正确复原。
    const egg = { root, spec, time: -1, duration, side: -1, sounds, triggerCount: 0, animate };
    animate(0, egg.side);
    eggs.set(spec.id, egg);
  }
  for (const spec of level.easterEggs) add(spec);

  function fire(event) {
    const egg = eggs.get(event.id);
    if (!egg || egg.time >= 0 && egg.time < egg.duration) return null;
    egg.time = 0;
    egg.side = event.side;
    egg.triggerCount++;
    return egg;
  }
  function update(dt) {
    for (const egg of eggs.values()) {
      if (egg.time < 0 || egg.time >= egg.duration) continue;
      egg.time = Math.min(egg.duration, egg.time + dt);
      egg.animate(egg.time, egg.side);
    }
  }
  function reset() {
    for (const egg of eggs.values()) {
      egg.time = -1;
      egg.triggerCount = 0;
      egg.animate(0, -1);
    }
  }
  return { eggs, fire, update, reset };
}
