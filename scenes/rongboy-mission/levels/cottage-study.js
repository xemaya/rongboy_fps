import cottage from './cottage-study-map.js';

const left = [[-7.02,5.5],[-5.92,5.71],[-4.85,5.13],[-6.5,4.27]];
const right = [[4.23,4.15],[5.12,5.45],[6.52,5.48],[6.31,3.63]];
const groups = [
  { positions:[[-.82,9.06],[.78,8.73]], types:['walker','walker'] },
  { positions:left, types:['walker','leaper','walker'] },
  { positions:right, types:['archer','walker','walker','walker'] },
];

// Both arms of the trial use the same roster, courtyard, supplies and loadout.
export function cottageStudyDef(study) {
  const waves = study === 'waves';
  const yardEdge = cottage.rooms.find(room => room.id === 'garden').minZ;
  const title = waves ? '院子里的三波' : '院子里的对照局';
  return {
    ...cottage,
    name:title,
    par:180,
    mission: { type:'clear', title:waves ? '打完院子里的三波僵尸' : '打倒院子里的九只僵尸' },
    texts: {
      short:title,
      brief:waves ? '三波僵尸会从树篱两侧出来。打完一波，有三秒换弹或挪位置。'
        : '这局的九只僵尸开场就会行动。院子、补给和敌人与三波版相同。',
      won:waves ? '三波都打完了！' : '院子清理完毕！',
    },
    // Close the two house doors to keep the short experiment in the courtyard.
    walls:cottage.walls.map(wall => wall.z === yardEdge ? { ...wall, doors:[] } : wall),
    furniture:[
      ...cottage.furniture,
      { id:'cottage-study-west-hedge', kind:'hedge', x:-5.9, z:6.65, w:3.25, d:.55, h:1.55, color:0x799b63 },
      { id:'cottage-study-east-hedge', kind:'hedge', x:5.35, z:6.4, w:3.6, d:.55, h:1.55, color:0x789b63 },
    ],
    pickups:cottage.pickups.filter(pickup => pickup.z >= yardEdge),
    upper:cottage.upper.map(floor => ({ ...floor, enemies:[], pickups:[] })),
    enemies:groups.flatMap(({ types, positions }, wave) => types.map((type, i) => {
      const [x,z] = positions[i];
      return { type, x, z, state:'alert', enabled:!waves || wave === 0, wave };
    })),
    waves:waves ? { count:groups.length, breakSeconds:3, entries:[left,right] } : null,
  };
}
