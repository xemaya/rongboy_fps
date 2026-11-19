// Receipts describe actual contacts of a single wool ball in their simulation order.
import {GARDEN_BOARD} from './levels/garden-wall.js';

export function isBoardReturnHit(e){
  return e.type==='hit' && e.back && e.amount>0 && e.afterSurface===GARDEN_BOARD;
}

export function gardenReceipts(){
  const counts={blocks:0, breaks:0, returns:0};
  return {
    counts,
    reset(){counts.blocks=counts.breaks=counts.returns=0;},
    event(e,shieldId){
      if(e.type==='blocked' && e.id===shieldId) counts.blocks++;
      if(e.type==='guard-break' && e.id===shieldId) counts.breaks++;
      if(e.id===shieldId && isBoardReturnHit(e)){
        counts.returns++;
        return true;
      }
      return false;
    },
  };
}
