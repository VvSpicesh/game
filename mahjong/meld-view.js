/**
 * 副露展示与自家手牌展示顺序（纯函数，不写 DOM）
 */

/**
 * 拥有者面朝牌桌中央时，来源座位在其身体坐标系中的方位。
 * 座位：0 下 / 1 左 / 2 上 / 3 右（观察者视角）。
 * @returns {"left"|"middle"|"right"|null}
 */
function getOwnerBodySourceSide(meldOwnerIndex,sourcePlayerIndex){
  if(!Number.isInteger(meldOwnerIndex)||meldOwnerIndex<0||meldOwnerIndex>3)return null;
  if(!Number.isInteger(sourcePlayerIndex)||sourcePlayerIndex<0||sourcePlayerIndex>3)return null;
  if(sourcePlayerIndex===meldOwnerIndex)return null;
  // 各座位面朝桌心时：左手侧 / 对侧 / 右手侧的座位号
  const leftOf=[1,2,3,0];
  const rightOf=[3,0,1,2];
  const acrossOf=[2,3,0,1];
  if(sourcePlayerIndex===leftOf[meldOwnerIndex])return "left";
  if(sourcePlayerIndex===rightOf[meldOwnerIndex])return "right";
  if(sourcePlayerIndex===acrossOf[meldOwnerIndex])return "middle";
  return null;
}

/**
 * 将拥有者身体左右映射到副露横排的展示坐标（组内从左到右）。
 * 对家面朝玩家，身体左右与屏幕左右相反，需对调。
 */
function toMeldDisplaySlot(meldOwnerIndex,bodySide){
  if(!bodySide||bodySide==="middle")return bodySide;
  if(meldOwnerIndex===2){
    return bodySide==="left"?"right":"left";
  }
  return bodySide;
}

/**
 * 副露来源牌槽位（展示用 left/middle/right）。
 * 先按碰牌者面朝桌心的身体方位，再映射到当前座位的横排展示坐标。
 * @param {number} meldOwnerIndex 碰/杠者
 * @param {number} sourcePlayerIndex 出牌者
 * @returns {"left"|"middle"|"right"|null}
 */
export function getMeldSourceSlot(meldOwnerIndex,sourcePlayerIndex){
  const body=getOwnerBodySourceSide(meldOwnerIndex,sourcePlayerIndex);
  return toMeldDisplaySlot(meldOwnerIndex,body);
}

/**
 * 相对副露拥有者的来源位（展示坐标）。
 * @param {number} ownerIndex
 * @param {number} fromPlayerIndex
 * @returns {"left"|"middle"|"right"|null}
 */
export function getRelativeSourcePosition(ownerIndex,fromPlayerIndex){
  return getMeldSourceSlot(ownerIndex,fromPlayerIndex);
}

/**
 * 相对来源短标签：上 / 对 / 下（相对拥有者的座位标签，非展示槽）
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
 * 副露高亮目标：直杠/碰 → 底层来源位；补杠 → 顶层补牌；暗杠 → 无
 * @param {object|null|undefined} meld
 * @param {number} ownerSeat
 * @returns {{layer:"base"|"top",baseIndex:number|null}|null}
 */
export function getHighlightedMeldTile(meld,ownerSeat){
  const type=String(meld?.type||"");
  const from=normalizeMeldFrom(meld);

  if(type==="anGang")return null;

  if(type==="peng"||type==="mingGang"){
    if(from==null)return null;
    const position=getMeldSourceSlot(ownerSeat,from);
    if(!position)return null;
    return {layer:"base",baseIndex:sourceSlotIndex(position,3)};
  }

  if(type==="buGang"){
    return {layer:"top",baseIndex:null};
  }

  return null;
}

function applyRowHighlight(items,highlight,layer){
  if(!highlight||highlight.layer!==layer){
    return items.map(it=>({...it,isSource:false,isAddedGang:false}));
  }
  if(layer==="base"){
    return items.map((it,i)=>({
      ...it,
      isSource:i===highlight.baseIndex,
      isAddedGang:false
    }));
  }
  return items;
}

function applyTopHighlight(items,highlight){
  if(!highlight||highlight.layer!=="top"||!items.length){
    return items.map(it=>({...it,isSource:false,isAddedGang:false}));
  }
  return items.map((it,i)=>({
    ...it,
    isSource:i===0,
    isAddedGang:i===0
  }));
}

/**
 * 碰/杠底层：按来源关系排列，来源位金色描边（isSource）
 * @param {object[]} rowTiles
 * @param {number} ownerSeat
 * @param {number|null} from
 * @param {number} count
 */
function buildOrientedRow(rowTiles,ownerSeat,from,count){
  const position=from!=null?getMeldSourceSlot(ownerSeat,from):null;
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
    (type==="peng"||type==="mingGang")&&from!=null
      ?getMeldSourceSlot(ownerSeat,from)
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

  const highlight=getHighlightedMeldTile(meld,ownerSeat);

  if(type==="peng"){
    return {
      type,
      widthScale,
      sourcePosition,
      layers:{
        base:applyRowHighlight(buildOrientedRow(tiles,ownerSeat,from,3),highlight,"base"),
        top:null
      }
    };
  }

  if(type==="mingGang"||type==="buGang"){
    const isBuGang=type==="buGang";
    const topTile=isBuGang ? (tiles.length>=4?tiles[3]:null) : (tiles[3]??tiles[tiles.length-1]??null);
    const baseRow=buildOrientedRow(tiles,ownerSeat,from,3);
    const topRow=topTile?[{tile:topTile,isSource:false,isAddedGang:false,face:"show"}]:[];
    return {
      type,
      widthScale,
      sourcePosition:isBuGang?null:sourcePosition,
      layers:{
        base:applyRowHighlight(baseRow,highlight,"base"),
        top:applyTopHighlight(topRow,highlight)
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
