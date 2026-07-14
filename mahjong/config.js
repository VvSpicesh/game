const KEY="nocturne_mahjong_rules_v10";
const DEALER_KEY="nocturne_mahjong_dealer_v10";

export const defaultRules={
  exchangeThree:true,
  gangRain:true
};

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
