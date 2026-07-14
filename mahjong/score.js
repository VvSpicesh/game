/**
 * 家麻计分：起始 20000，一番 = 1 分；允许负分。
 * 番种：平胡1 / 对对胡2 / 七对2 / 龙七对3 / 双龙七对4；清一色+2；
 * 抢杠胡 / 杠上花 / 杠上炮 +1；自摸（含杠上开花）再 +1。
 */

export const START_SCORE=20000;
export const POINTS_PER_FAN=1;
export const MING_GANG_POINTS=2;
export const AN_GANG_EACH=1;

const SCORE_KEY="nocturne_mahjong_session_score_v10";
const SESSION_START_KEY="nocturne_mahjong_session_started_v10";
const EYE_WARN_KEY="nocturne_mahjong_eye_warned_v10";
export const EYE_WARN_MS=2*60*60*1000;

export function defaultScores(){
  return [START_SCORE,START_SCORE,START_SCORE,START_SCORE];
}

export function loadSessionScores(){
  try{
    const raw=JSON.parse(localStorage.getItem(SCORE_KEY)||"null");
    if(raw&&Array.isArray(raw.scores)&&raw.scores.length===4){
      return raw.scores.map(n=>Number(n)||0);
    }
  }catch{/* ignore */}
  return defaultScores();
}

export function saveSessionScores(scores){
  localStorage.setItem(SCORE_KEY,JSON.stringify({scores:scores.map(n=>Number(n)||0)}));
}

export function ensureSessionClock(){
  if(!sessionStorage.getItem(SESSION_START_KEY)){
    sessionStorage.setItem(SESSION_START_KEY,String(Date.now()));
  }
  return Number(sessionStorage.getItem(SESSION_START_KEY))||Date.now();
}

export function checkEyeWarn(toastFn){
  const started=ensureSessionClock();
  if(sessionStorage.getItem(EYE_WARN_KEY)==="1")return;
  if(Date.now()-started<EYE_WARN_MS)return;
  sessionStorage.setItem(EYE_WARN_KEY,"1");
  toastFn("已连续游玩超过2小时，请注意用眼休息");
}

export function formatPoints(n){
  const value=Number(n)||0;
  if(value>0)return `+${value}`;
  return String(value);
}

/**
 * @param {{name?:string,canWin?:boolean}} info getWinInfo 结果
 * @param {{selfDraw?:boolean,robGang?:boolean,gangFlower?:boolean,gangDiscard?:boolean}} manner
 */
export function computeFan(info,manner={}){
  if(!info?.canWin&&!info?.name)return 0;
  const name=info.name||"";
  const parts=name.split("·").filter(Boolean);
  const core=parts.filter(p=>!["抢杠胡","杠上花","杠上炮","一炮多响"].includes(p));
  const text=core.join("·")||name;

  let fan=1;
  if(text.includes("双龙七对"))fan=4;
  else if(text.includes("龙七对"))fan=3;
  else if(text.includes("七对"))fan=2;
  else if(text.includes("对对胡"))fan=2;
  else fan=1;

  if(text.includes("清一色"))fan+=2;

  const rob=manner.robGang||name.includes("抢杠胡");
  const flower=manner.gangFlower||name.includes("杠上花");
  const discardGang=manner.gangDiscard||name.includes("杠上炮");
  if(rob)fan+=1;
  if(flower)fan+=1;
  if(discardGang)fan+=1;
  if(manner.selfDraw)fan+=1;

  return fan;
}

function ensureScoreFields(state){
  if(!Array.isArray(state.scores)||state.scores.length!==4){
    state.scores=loadSessionScores();
  }
  if(!Array.isArray(state.roundDelta)||state.roundDelta.length!==4){
    state.roundDelta=[0,0,0,0];
  }
  if(!Array.isArray(state.scoreLog))state.scoreLog=[];
}

function applyDeltas(state,deltas,logText){
  ensureScoreFields(state);
  for(let i=0;i<4;i++){
    const d=deltas[i]||0;
    state.scores[i]+=d;
    state.roundDelta[i]+=d;
  }
  saveSessionScores(state.scores);
  if(logText){
    state.scoreLog.unshift({text:logText,at:Date.now()});
    if(state.scoreLog.length>12)state.scoreLog.length=12;
  }
  return {deltas,logText};
}

function unpaidPlayers(state,exceptIndex){
  const list=[];
  for(let i=0;i<4;i++){
    if(i===exceptIndex)continue;
    if(state.players[i]?.won)continue;
    list.push(i);
  }
  return list;
}

/** 自摸 / 杠上开花：未胡各家出 fan 分 */
export function settleSelfDraw(state,winnerIndex,info,manner={}){
  const fan=computeFan(info,{...manner,selfDraw:true});
  const unit=fan*POINTS_PER_FAN;
  const deltas=[0,0,0,0];
  const payers=unpaidPlayers(state,winnerIndex);
  payers.forEach(i=>{
    deltas[i]-=unit;
    deltas[winnerIndex]+=unit;
  });
  const text=
    `${state.players[winnerIndex].name}胡（${fan}番）`+
    ` · ${manner.gangFlower?"杠上开花":"自摸"} ${formatPoints(deltas[winnerIndex])}`;
  const applied=applyDeltas(state,deltas,text);
  return {fan,deltas,unit,logText:applied.logText};
}

/** 点炮 / 杠上炮 / 抢杠：放炮家按每位胡家番数付分；每位胡家至少按 1 番结算 */
export function settleDiscardWins(state,winners,fromPlayer,winInfos,manner={}){
  const deltas=[0,0,0,0];
  const fans=[];
  const unique=[];
  winners.forEach((winnerIndex,i)=>{
    if(unique.some(item=>item.winnerIndex===winnerIndex))return;
    unique.push({winnerIndex,info:winInfos[i]});
  });

  unique.forEach(({winnerIndex,info})=>{
    let fan=computeFan(info,{
      ...manner,
      selfDraw:false,
      robGang:manner.robGang===true,
      gangDiscard:manner.gangDiscard===true
    });
    if(fan<1)fan=1;
    fans.push(fan);
    const unit=fan*POINTS_PER_FAN;
    deltas[fromPlayer]-=unit;
    deltas[winnerIndex]+=unit;
  });

  const winnerIndexes=unique.map(u=>u.winnerIndex);
  const label=manner.robGang?"抢杠胡":manner.gangDiscard?"杠上炮":"点炮";
  const detail=winnerIndexes
    .map((w,i)=>`${state.players[w].name}${fans[i]}番${formatPoints(deltas[w])}`)
    .join("、");
  const text=`${label}：${detail}（${state.players[fromPlayer].name} ${formatPoints(deltas[fromPlayer])}）`;
  const applied=applyDeltas(state,deltas,text);
  return {fans,deltas,logText:applied.logText,winners:winnerIndexes};
}

export function settleMingGang(state,gangster,fromPlayer){
  if(!state.activeRules?.gangRain)return null;
  const deltas=[0,0,0,0];
  const pts=MING_GANG_POINTS;
  deltas[fromPlayer]-=pts;
  deltas[gangster]+=pts;
  const text=
    `${state.players[gangster].name}杠 ${formatPoints(pts)}`+
    `（${state.players[fromPlayer].name} ${formatPoints(-pts)}）`;
  const applied=applyDeltas(state,deltas,text);
  return {deltas,pts,logText:applied.logText};
}

export function settleAnOrBuGang(state,gangster,kind="暗杠"){
  if(!state.activeRules?.gangRain)return null;
  const deltas=[0,0,0,0];
  const payers=unpaidPlayers(state,gangster);
  payers.forEach(i=>{
    deltas[i]-=AN_GANG_EACH;
    deltas[gangster]+=AN_GANG_EACH;
  });
  const text=
    `${state.players[gangster].name}${kind} ${formatPoints(deltas[gangster])}`+
    `（各未胡家 -${AN_GANG_EACH}）`;
  const applied=applyDeltas(state,deltas,text);
  return {deltas,logText:applied.logText};
}

export function roundSummary(state,reason){
  ensureScoreFields(state);
  return state.players.map((player,i)=>({
    name:player.name,
    won:!!player.won,
    delta:state.roundDelta[i]||0,
    total:state.scores[i]||0,
    status:player.won?"已胡":(reason.includes("流")||reason.includes("摸完")?"未胡":"留局")
  }));
}
