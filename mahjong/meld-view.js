/**
 * 副露展示与自家手牌展示顺序（纯函数，不写 DOM）
 *
 * 座位：0 自己(下) / 1 上家(左) / 2 对家(上) / 3 下家(右)
 */

/**
 * 拥有者面朝牌桌中央时，来源座位在其身体坐标系中的方位。
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
 * 来源相对碰/杠者 → 屏幕方位（用于标记与 class）。
 * 按 actor 面朝桌心的身体方位，再换算到观察者屏幕方向。
 * @param {number} actorIndex
 * @param {number} sourceIndex
 * @returns {"left"|"right"|"top"|"bottom"|null}
 */
export function getMeldSourcePosition(actorIndex,sourceIndex){
  const body=getOwnerBodySourceSide(actorIndex,sourceIndex);
  if(!body)return null;

  // 自己：面朝上；左/右=屏幕左右；对家=朝上（组内居中）
  if(actorIndex===0){
    if(body==="left")return "left";
    if(body==="right")return "right";
    return "top";
  }
  // 对家：面朝下；身体左右与屏幕相反
  if(actorIndex===2){
    if(body==="left")return "right";
    if(body==="right")return "left";
    return "bottom";
  }
  // 上家（左）：面朝右；身体左=屏幕上，身体右=屏幕下
  if(actorIndex===1){
    if(body==="left")return "top";
    if(body==="right")return "bottom";
    return "right";
  }
  // 下家（右）：面朝左；身体左=屏幕下，身体右=屏幕上
  if(actorIndex===3){
    if(body==="left")return "bottom";
    if(body==="right")return "top";
    return "left";
  }
  return null;
}

/**
 * 屏幕方位 → 组内 flex 槽位（横排 left→右；竖列 top→下 = left/middle/right 槽）
 * @returns {"left"|"middle"|"right"|null}
 */
function screenPositionToFlexSlot(actorIndex,screenPos){
  if(!screenPos)return null;
  const vertical=actorIndex===1||actorIndex===3;
  if(vertical){
    if(screenPos==="top")return "left";
    if(screenPos==="bottom")return "right";
    return "middle";
  }
  if(screenPos==="left")return "left";
  if(screenPos==="right")return "right";
  return "middle";
}

/**
 * 副露来源牌槽位（展示用 left/middle/right，兼容旧逻辑）。
 * @param {number} meldOwnerIndex 碰/杠者
 * @param {number} sourcePlayerIndex 出牌者
 * @returns {"left"|"middle"|"right"|null}
 */
export function getMeldSourceSlot(meldOwnerIndex,sourcePlayerIndex){
  return screenPositionToFlexSlot(
    meldOwnerIndex,
    getMeldSourcePosition(meldOwnerIndex,sourcePlayerIndex)
  );
}

/**
 * 相对副露拥有者的来源位（flex 槽）。
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

/**
 * @param {"left"|"middle"|"right"|null} flexSlot
 * @param {number} count
 */
function sourceSlotIndex(flexSlot,count){
  if(flexSlot==="left")return 0;
  if(flexSlot==="right")return Math.max(0,count-1);
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
    const flex=getMeldSourceSlot(ownerSeat,from);
    if(!flex)return null;
    return {layer:"base",baseIndex:sourceSlotIndex(flex,3)};
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
  const flex=from!=null?getMeldSourceSlot(ownerSeat,from):null;
  const slice=rowTiles.slice(0,count);
  if(!flex||slice.length<2){
    return slice.map(tile=>({tile,isSource:false,face:"show"}));
  }

  const sourceIndex=sourceSlotIndex(flex,count);
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
  anGang:1
};

/**
 * 副露展示计划：分层（碰单层 / 明杠·补杠三+一 / 暗杠单层四张）
 * 暗杠固定 4 张：牌背 · 明牌 · 明牌 · 牌背（不再叠层追加）
 * sourcePosition = 屏幕方位 left|right|top|bottom（供 class）
 * @param {object|null|undefined} meld
 * @param {number} ownerSeat
 */
export function buildMeldTilePlan(meld,ownerSeat){
  const type=String(meld?.type||"");
  const tiles=Array.isArray(meld?.tiles)?meld.tiles:[];
  const from=normalizeMeldFrom(meld);
  const sourcePosition=
    (type==="peng"||type==="mingGang")&&from!=null
      ?getMeldSourcePosition(ownerSeat,from)
      :null;
  const widthScale=MELD_WIDTH_SCALE[type]??1;

  if(type==="anGang"){
    const row=tiles.slice(0,4).map((tile,tileIndex)=>({
      tile,
      isSource:false,
      face:(tileIndex===1||tileIndex===2)?"show":"back"
    }));
    while(row.length<4){
      row.push({tile:tiles[0]||null,isSource:false,face:row.length===1||row.length===2?"show":"back"});
    }
    return {
      type,
      widthScale,
      sourcePosition:null,
      layers:{
        base:row.slice(0,4),
        top:null
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
 * 自家手牌展示顺序：新摸牌固定最右侧，不参与中间区间排序；不改动 hand 数组。
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
