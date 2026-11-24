import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { woolMaterial } from '../../library/games/rongboy-runtime.js';

export const VIEWMODEL_SCALE = .3;
const VIEWMODEL_FOV = 65;

// Camera-space poses keep the nozzle, side and top readable while the firing hand sits below frame.
// Each support point is in the weapon's own coordinates and moves with its recoil.
const POSES = {
  single: { at:[.40,-.46,-.75], size:.56, yaw:.55, lift:.25, rear:[-.03,-.15,-.07] },
  scatter: { at:[.48,-.49,-.76], size:.62, yaw:.58, lift:.23, support:[.18,-.130,.415], rear:[-.02,-.21,-.20] },
  heavy: { at:[.515,-.515,-.79], size:.65, yaw:.64, lift:.245, support:[.19,-.13,.385], rear:[-.02,-.22,-.21] },
  freeze: { at:[.47,-.49,-.76], size:.61, yaw:.56, lift:.23, support:[.15,-.10,.35], rear:[-.02,-.21,-.20] },
  stun: { at:[.47,-.475,-.75], size:.62, yaw:.57, lift:.22, support:[.15,-.105,.37], rear:[-.02,-.21,-.20] },
  sewing: { at:[.48,-.465,-.75], size:.64, yaw:.57, lift:.22, support:[.14,-.115,.39], rear:[-.02,-.21,-.20] },
  needle: { at:[.45,-.46,-.81], size:.60, yaw:.45, lift:.21, support:[.10,-.13,.39], rear:[-.03,-.26,-.06] },
};

function mitten(shell, cuff, sleeve, support) {
  const group=new T.Group();
  const palm=new T.Mesh(new RoundedBoxGeometry(.157,.115,.202,4,.05),shell);
  palm.rotation.z=support?-.38:.25;
  group.add(palm);
  const thumb=new T.Mesh(new T.CapsuleGeometry(.035,.061,5,12),shell);
  thumb.position.set(support?-.055:.061,.041,.03);
  thumb.rotation.x=.52;
  thumb.rotation.z=support?.59:-.41;
  group.add(thumb);
  const cuffMesh=new T.Mesh(new RoundedBoxGeometry(.151,.103,.077,3,.036),cuff);
  cuffMesh.position.set(.021,-.032,-.103);
  group.add(cuffMesh);
  const forearm=new T.Mesh(new T.CapsuleGeometry(.064,.236,5,12),sleeve);
  forearm.position.set(.061,-.117,-.191);
  forearm.rotation.set(1.01,.1,support?.29:-.12);
  group.add(forearm);
  return group;
}

export function createViewmodel(kit, ball, bombModels) {
  const root=new T.Group(), held=new T.Group();
  const shell=woolMaterial(0xe8cca1), cuff=woolMaterial(0xbfa681), sleeve=woolMaterial(0x8e7b54);
  const rear=mitten(shell,cuff,sleeve,false), support=mitten(shell,cuff,sleeve,true);
  kit.add(rear,support);
  kit.rotation.order='YXZ';
  const barrel = new T.Vector3(), desiredBarrel = new T.Vector3();
  const fixedMouth = new T.Vector3(), rotatedMouth = new T.Vector3(), correction = new T.Quaternion();
  ball.position.z=.65;
  kit.add(ball);
  const throwingHand=mitten(shell,cuff,sleeve,true);
  throwingHand.position.set(.04,-.126,-.08);
  throwingHand.rotation.set(-.14,.12,.28);
  held.add(throwingHand);
  for (const {model} of bombModels) {
    model.scale.setScalar(.155);
    held.add(model);
  }
  root.add(kit,held);
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});

  return {
    root, kit, ball, held,
    equip(index) { kit.userData.variants.forEach((variant,i)=>{ variant.visible=i===index; }); },
    aimMouth(mouth, cameraDirection) {
      fixedMouth.copy(mouth).multiply(kit.scale).applyQuaternion(kit.quaternion);
      barrel.set(0,0,1).applyQuaternion(kit.quaternion);
      desiredBarrel.copy(cameraDirection).divide(root.scale).normalize();
      correction.setFromUnitVectors(barrel,desiredBarrel);
      kit.quaternion.premultiply(correction);
      rotatedMouth.copy(mouth).multiply(kit.scale).applyQuaternion(kit.quaternion);
      // Rotate around the muzzle to preserve its position in the existing first-person framing.
      kit.position.add(fixedMouth.sub(rotatedMouth));
    },
    update({ weapon, phase, speed, motion, recoil, reload, charge, lob, grenade, invul, time }) {
      const pose=POSES[weapon];
      const sway=Math.sin(phase)*speed*motion;
      kit.scale.setScalar(pose.size);
      kit.position.set(
        pose.at[0]+sway*.013+recoil.side.x*motion,
        pose.at[1]+Math.cos(phase*2)*speed*.009*motion+recoil.up.x*motion-reload*.15,
        pose.at[2]+recoil.back.x*motion+charge*.016,
      );
      kit.rotation.set(-pose.lift+recoil.pitch.x*motion+reload*.32,
        Math.PI+pose.yaw+sway*.022+reload*.11,-.047+recoil.roll.x*motion-reload*.17);
      rear.position.fromArray(pose.rear);
      rear.rotation.set(.22,-.09,-.21);
      support.visible=!!pose.support && lob===null;
      if(pose.support) support.position.fromArray(pose.support);
      support.rotation.set(-.10,.11,-.39+reload*.32);
      held.visible=lob!==null;
      held.position.set(-.24,-.49+(lob??0)*.053,-.64+(lob??0)*.06);
      for(const {index,model} of bombModels) model.visible=index===grenade;
      shell.emissive.setRGB(invul ? .07*(1+Math.sin(time*24)) : 0, invul ? .025 : 0, invul ? .013 : 0);
    },
    project(fov, aspect, visible) {
      // Compensate the weapon framing for scene FOV changes without a second render pass.
      const fit=Math.max(1,1.46/aspect);
      const framing=Math.tan(T.MathUtils.degToRad(fov/2))/Math.tan(T.MathUtils.degToRad(VIEWMODEL_FOV/2));
      root.scale.set(VIEWMODEL_SCALE*framing/fit, VIEWMODEL_SCALE*framing, VIEWMODEL_SCALE);
      root.visible=visible;
    },
  };
}
