// Use the school's actual corridor, light and combat rules for the costume study.
export function trioStudy(school, specialists = false) {
  const cast = specialists ? ['crawler', 'shielded', 'bomber'] : ['walker', 'heavy', 'leaper'];
  return {
    ...school,
    name: specialists ? '走廊 · 爬行者、持盾者、炸弹客' : '走廊 · 三只样板',
    player: { x: 3.8, z: -1, yaw: Math.PI / 2 },
    mission: { type: 'clear', title: '击倒走廊里的三只僵尸' },
    furniture: school.furniture.filter(piece => piece.id !== 'lockers-m'),
    pickups: [], gadgets: [],
    enemies: cast.map((type, i) => ({
      type, x: -2.9, z: -.08 - i * .92, state: 'alert', heading: Math.PI / 2,
    })),
    texts: {
      ...school.texts, short: '三只样板', hint: specialists ? '左起：爬行者、持盾者、炸弹客' : '左起：跳跳、棉甲、跃行者',
      won: '走廊清空了！',
    },
  };
}
