/**
 * 胡牌结算语音拼句（纯函数，不调用 speechSynthesis）
 */

const FAN_CN=["零","一","二","三","四","五","六","七","八","九","十"];

/** @param {unknown} fan */
export function formatFanSpeech(fan){
  const n=Number(fan);
  if(!Number.isFinite(n)||n<=0)return "";
  const rounded=Math.round(n);
  if(rounded>=1&&rounded<=10)return `${FAN_CN[rounded]}番`;
  return `${rounded}番`;
}

/**
 * 从现有胡牌 info / breakdown 收集播报番型（不重算）。
 * 顺序：基础牌型 → extraFans（与结算展示一致）
 * @param {object|null|undefined} info
 * @returns {string[]}
 */
export function collectWinSpeechPatterns(info){
  if(!info||typeof info!=="object")return [];
  const out=[];
  const push=(raw)=>{
    let s=String(raw??"").replace(/[·・]/g,"").trim();
    if(!s)return;
    s=s.replace(/大对子/g,"对对胡");
    if(!out.includes(s))out.push(s);
  };

  if(info.basePattern){
    push(info.basePattern);
  }else if(info.name){
    String(info.name).split(/[·・]/).forEach(part=>push(part));
  }

  const extras=Array.isArray(info.extraFans)?info.extraFans:[];
  extras.forEach(e=>push(e?.label));

  return out;
}

/**
 * @param {object} [result]
 * @param {string} [result.winnerName]
 * @param {"zimo"|"discard"|"robGang"|string} [result.winType]
 * @param {string} [result.discarderName]
 * @param {string} [result.robbedName]
 * @param {string[]} [result.patterns]
 * @param {number} [result.totalFan]
 * @returns {string}
 */
export function buildWinSpeech(result={}){
  const winner=String(result.winnerName??"").trim()||"玩家";
  const winType=String(result.winType||"zimo");
  const discarder=String(result.discarderName??"").trim();
  const robbed=String(result.robbedName??"").trim();

  const skip=new Set();
  if(winType==="robGang")skip.add("抢杠胡");
  if(winType==="zimo")skip.add("自摸");
  if(winType==="discard"){
    skip.add("放炮");
    skip.add("点炮");
  }

  const patterns=(Array.isArray(result.patterns)?result.patterns:[])
    .map(p=>String(p??"").replace(/[·・]/g,"").trim().replace(/大对子/g,"对对胡"))
    .filter(p=>p&&!skip.has(p));

  /* 去重但保序 */
  const uniq=[];
  patterns.forEach(p=>{if(!uniq.includes(p))uniq.push(p);});

  const fanText=formatFanSpeech(result.totalFan);
  const parts=[];

  if(winType==="discard"){
    if(discarder)parts.push(`${discarder}放炮`);
    if(uniq.length){
      parts.push(`${winner}${uniq[0]}`);
      parts.push(...uniq.slice(1));
    }else{
      parts.push(`${winner}胡`);
    }
  }else if(winType==="robGang"){
    if(robbed)parts.push(`${robbed}被抢杠`);
    parts.push(`${winner}抢杠胡`);
    parts.push(...uniq);
  }else{
    parts.push(`${winner}自摸`);
    parts.push(...uniq);
  }

  if(fanText)parts.push(fanText);

  const cleaned=parts
    .map(s=>String(s||"").trim())
    .filter(Boolean);

  if(!cleaned.length)return "";
  return `${cleaned.join("，")}。`;
}

/**
 * @param {string} manner 游戏内 manner 文案
 * @returns {"zimo"|"discard"|"robGang"}
 */
export function mapMannerToWinType(manner){
  const m=String(manner||"");
  if(m==="抢杠胡")return "robGang";
  if(m==="点炮"||m==="杠上炮")return "discard";
  return "zimo";
}
