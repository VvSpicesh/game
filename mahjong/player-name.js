/**
 * 玩家显示名称：优先自定义名字，否则相对观察者的方位称呼。
 * UI / 日志共用；语音 clip 仍用座位序号，勿混用。
 */

export const RELATIVE_SEAT_LABELS=["自己","上家","对家","下家"];

export function isValidPlayerName(name){
  return typeof name==="string"&&name.trim().length>0;
}

/**
 * 相对 viewer 的方位：0 自己 / 1 上家 / 2 对家 / 3 下家
 *（与座位布局一致：左=上家、上=对家、右=下家）
 */
export function getRelativeSeatLabel(playerIndex,viewerIndex=0){
  const p=((Number(playerIndex)%4)+4)%4;
  const v=((Number(viewerIndex)%4)+4)%4;
  const rel=(p-v+4)%4;
  return RELATIVE_SEAT_LABELS[rel]||"玩家";
}

/**
 * @param {number} playerIndex
 * @param {number} [viewerIndex=0]
 * @param {Array<{name?:string}|string|null|undefined>} [players] 玩家对象数组或名字数组
 */
export function getPlayerDisplayName(playerIndex,viewerIndex=0,players=[]){
  const entry=players?.[playerIndex];
  const raw=typeof entry==="string"?entry:entry?.name;
  if(isValidPlayerName(raw))return raw.trim();
  return getRelativeSeatLabel(playerIndex,viewerIndex);
}
