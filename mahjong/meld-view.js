/**
 * 副露展示与自家手牌展示顺序（纯函数，不写 DOM）
 */

/**
 * 相对副露拥有者的来源位：上家左 / 对家中 / 下家右
 * @param {number} ownerIndex
 * @param {number} fromPlayerIndex
 * @returns {"left"|"middle"|"right"|null}
 */
export function getRelativeSourcePosition(ownerIndex,fromPlayerIndex){
  if(!Number.isInteger(ownerIndex)||ownerIndex<0||ownerIndex>3)return null;
  if(!Number.isInteger(fromPlayerIndex)||fromPlayerIndex<0||fromPlayerIndex>3)return null;
  if(fromPlayerIndex===ownerIndex)return null;
  const diff=(fromPlayerIndex-ownerIndex+4)%4;
  if(diff===1)return "left";
  if(diff===2)return "middle";
  if(diff===3)return "right";
  return null;
}

/**
 * 相对来源短标签：上 / 对 / 下
 * @returns {"上"|"对"|"下"|null}
 */
export function getRelativeSourceTag(ownerIndex,fromPlayerIndex){
  if(!Number.isInteger(ownerIndex)||ownerIndex<0||ownerIndex>3)return null;
  if(!Number.isInteger(fromPlayerIndex)||fromPlayerIndex<0||fromPlayerIndex>3)return null;
  if(fromPlayerIndex===ownerIndex)return null;
  const diff=(fromPlayerIndex-ownerIndex+4)%4;
  if(diff===1)return "上";
  if(diff===2)return "对";
  if(diff===3)return "下";
  return null;
}

/**
 * @deprecated 兼容旧测试
 */
export function getMeldOwnerNudge(ownerSeat){
  if(ownerSeat===0)return "up";
  if(ownerSeat===1)return "right";
  if(ownerSeat===2)return "down";
  if(ownerSeat===3)return "left";
  return null;
}

/** @deprecated 兼容旧测试 */
export function relativeSeatDirection(viewerSeat,sourceSeat){
  const pos=getRelativeSourcePosition(viewerSeat,sourceSeat);
  if(pos==="left")return "←";
  if(pos==="middle")return "↑";
  if(pos==="right")return "→";
  return null;
}

/**
 * 兼容旧存档：读取 meld.from，无效则 null
 * @param {object|null|undefined} meld
 * @returns {number|null}
 */
export function normalizeMeldFrom(meld){
  const from=meld?.from;
  if(!Number.isInteger(from)||from<0||from>3)return null;
  return from;
}

function sourceSlotIndex(position,count){
  if(position==="left")return 0;
  if(position==="right")return Math.max(0,count-1);
  return Math.floor((count-1)/2);
}

/**
 * 碰/杠底层：按来源关系排列，来源位金色描边（isSource）
 * @param {object[]} rowTiles
 * @param {number} ownerSeat
 * @param {number|null} from
 * @param {number} count
 */
function buildOrientedRow(rowTiles,ownerSeat,from,count){
  const position=from!=null?getRelativeSourcePosition(ownerSeat,from):null;
  const slice=rowTiles.slice(0,count);
  if(!position||slice.length<2){
    return slice.map(tile=>({tile,isSource:false,face:"show"}));
  }

  const sourceIndex=sourceSlotIndex(position,count);
  const pool=slice.slice();
  const sourceTile=pool[0];
  const items=[];
  let pi=1;
  for(let i=0;i<count;i++){
    if(i===sourceIndex){
      items.push({tile:sourceTile,isSource:true,face:"show"});
    }else{
      items.push({tile:pool[pi++]||sourceTile,isSource:false,face:"show"});
    }
  }
  return items;
}

const MELD_WIDTH_SCALE={
  peng:1,
  mingGang:1.1,
  buGang:1.1,
  anGang:1.1
};

/**
 * 副露展示计划：分层（碰单层 / 明杠·补杠三+一 / 暗杠四+二）
 * @param {object|null|undefined} meld
 * @param {number} ownerSeat
 */
export function buildMeldTilePlan(meld,ownerSeat){
  const type=String(meld?.type||"");
  const tiles=Array.isArray(meld?.tiles)?meld.tiles:[];
  const from=normalizeMeldFrom(meld);
  const sourcePosition=
    (type==="peng"||type==="mingGang"||type==="buGang")&&from!=null
      ?getRelativeSourcePosition(ownerSeat,from)
      :null;
  const widthScale=MELD_WIDTH_SCALE[type]??1;

  if(type==="anGang"){
    const topTiles=tiles.length>=4?[tiles[1],tiles[2]]:tiles.slice(0,2);
    return {
      type,
      widthScale,
      sourcePosition:null,
      layers:{
        base:tiles.slice(0,4).map(tile=>({tile,isSource:false,face:"back"})),
        top:topTiles.map((tile,tileIndex)=>({
          tile,
          isSource:false,
          face:ownerSeat===0&&tileIndex===1?"show":"back"
        }))
      }
    };
  }

  if(type==="peng"){
    return {
      type,
      widthScale,
      sourcePosition,
      layers:{
        base:buildOrientedRow(tiles,ownerSeat,from,3),
        top:null
      }
    };
  }

  if(type==="mingGang"||type==="buGang"){
    const topTile=tiles[3]??tiles[tiles.length-1]??null;
    return {
      type,
      widthScale,
      sourcePosition,
      layers:{
        base:buildOrientedRow(tiles,ownerSeat,from,3),
        top:topTile?[{tile:topTile,isSource:false,face:"show"}]:[]
      }
    };
  }

  return {
    type:type||"unknown",
    widthScale:1,
    sourcePosition:null,
    layers:{
      base:tiles.map(tile=>({tile,isSource:false,face:"show"})),
      top:null
    }
  };
}

/**
 * @param {object|null|undefined} meld
 * @param {number} ownerSeat
 */
export function meldDisplayInfo(meld,ownerSeat){
  const plan=buildMeldTilePlan(meld,ownerSeat);
  const title={
    peng:"碰",
    mingGang:"杠",
    anGang:"暗杠",
    buGang:"补杠"
  }[plan.type]||plan.type||"副露";
  return {
    arrow:null,
    badge:null,
    title,
    sourceLabel:"",
    sourcePosition:plan.sourcePosition,
    ownerNudge:null
  };
}

/**
 * 自家手牌展示顺序：新摸牌固定最右，不参与中间视觉排序；不改变 hand 数组。
 * @param {object[]} hand
 * @param {string|null|undefined} drawnTileId
 * @returns {{tile:object,tileIndex:number,isDraw:boolean}[]}
 */
export function buildSelfHandDisplayOrder(hand,drawnTileId){
  const list=Array.isArray(hand)?hand:[];
  if(!drawnTileId){
    return list.map((tile,tileIndex)=>({tile,tileIndex,isDraw:false}));
  }

  const drawIndex=list.findIndex(tile=>tile?.id===drawnTileId);
  if(drawIndex<0){
    return list.map((tile,tileIndex)=>({tile,tileIndex,isDraw:false}));
  }

  const items=[];
  list.forEach((tile,tileIndex)=>{
    if(tileIndex!==drawIndex)items.push({tile,tileIndex,isDraw:false});
  });
  items.push({tile:list[drawIndex],tileIndex:drawIndex,isDraw:true});
  return items;
}
