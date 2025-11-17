/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Monster Control Grammar
 *
 * Syntax: (monster name/id) (attack) (teleport) (search) (skillcancel) [lv] [joblv] [hp] [sp] [weight]
 *
 * Fields:
 * - monster: Name or ID of monster (string or number)
 * - attack: -1 (ignore), 0 (unless attacks), 1 (always), 2 (aggressive), 3 (provoke)
 * - teleport: <0 (critical distance), 1 (on screen), 2 (attacks), 3 (disconnect 30s), >=4 (disconnect N seconds)
 * - search: 0 or 1
 * - skillcancel: 0 or 1
 * - lv: Optional, player level threshold (number)
 * - joblv: Optional, job level threshold (number)
 * - hp: Optional, HP threshold (number)
 * - sp: Optional, SP threshold (number)
 * - weight: Optional, aggression weight (number, can be decimal)
 */

export interface MonsterControlEntry {
    monsterName: string;
    attack: -1 | 0 | 1 | 2 | 3;
    teleport: number;
    search: 0 | 1;
    skillcancel: 0 | 1;
    lv?: number;
    joblv?: number;
    hp?: number;
    sp?: number;
    weight?: number;
}

export const monsterControlFieldCount = {
    min: 5, // monster, attack, teleport, search, skillcancel
    max: 10, // above + lv, joblv, hp, sp, weight
};
