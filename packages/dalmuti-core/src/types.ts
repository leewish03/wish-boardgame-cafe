export type DalmutiRank = 1|2|3|4|5|6|7|8|9|10|11|12|13;
export type DalmutiPhase = 'LOBBY'|'DEALING'|'REVOLUTION_DECISION'|'TAX_RETURN'|'MERCHANT_EXCHANGE'|'TURN_INPUT'|'ROUND_END'|'GAME_OVER';
export interface DalmutiConfig { roundCount:5|10|20; maxPlayers:4|5|6|7|8; turnTimeoutSeconds:0|30|60|90; firstDealRevolution:boolean; useStrippedDeck:boolean; philanthropicScoring:boolean; merchantExchange:boolean; }
export interface DalmutiCard { id:string; rank:DalmutiRank; name:string; }
export interface DalmutiPlay { rank:DalmutiRank; count:number; jesterCount:number; }
export type DalmutiCommand =
  | ({type:'START_MATCH'|'ADVANCE_ROUND'|'DECLARE_REVOLUTION'|'DECLINE_REVOLUTION'|'PASS'; playerId?:string})
  | ({type:'PLAY_SET';playerId:string}&DalmutiPlay)
  | {type:'SELECT_TAX_RETURN';playerId:string;selection:Array<{rank:DalmutiRank;count:number}>}
  | {type:'SELECT_MERCHANT_EXCHANGE_TARGET';playerId:string;targetId:string};
