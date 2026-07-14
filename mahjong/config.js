const KEY="nocturne_mahjong_rules_v10";
const DEALER_KEY="nocturne_mahjong_dealer_v10";
const NAMES_KEY="nocturne_mahjong_names_v10";

export const defaultRules={
  exchangeThree:true,
  gangRain:true
};

export const defaultNames=["瑞","安彬","兰儿","小诺"];

export function loadRules(){
  try{
    return {...defaultRules,...JSON.parse(localStorage.getItem(KEY)||"{}")};
  }catch{
    return {...defaultRules};
  }
}

export function saveRules(rules){
  localStorage.setItem(KEY,JSON.stringify(rules));
}

export function loadNames(){
  try{
    const raw=JSON.parse(localStorage.getItem(NAMES_KEY)||"null");
    if(Array.isArray(raw)&&raw.length===4){
      return raw.map((name,index)=>{
        const text=String(name??"").trim();
        return text||defaultNames[index];
      });
    }
  }catch{/* ignore */}
  return [...defaultNames];
}

export function saveNames(list){
  const next=list.map((name,index)=>{
    const text=String(name??"").trim();
    return text.slice(0,8)||defaultNames[index];
  });
  localStorage.setItem(NAMES_KEY,JSON.stringify(next));
  return next;
}

/** 上一局庄家座位 0-3；首局返回 -1 表示尚未坐庄记录 */
export function loadLastDealer(){
  const raw=localStorage.getItem(DEALER_KEY);
  if(raw===null||raw==="")return -1;
  const value=Number(raw);
  return Number.isInteger(value)&&value>=0&&value<=3?value:-1;
}

export function saveLastDealer(dealer){
  localStorage.setItem(DEALER_KEY,String(dealer));
}
