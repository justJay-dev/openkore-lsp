/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Items Control Grammar
 *
 * Syntax: (item name) (minimum) (auto-store) (auto-sell) [put in cart] [get from cart]
 *
 * Fields:
 * - item name or ID: Name or ID of the item (string or number, can have spaces if quoted)
 * - minimum: Minimum amount to keep in inventory (number >= 0)
 * - auto-store: Set to 1 to store at NPC, 0 otherwise (0 or 1)
 * - auto-sell: Set to 1 to sell at NPC, 0 otherwise (0 or 1)
 * - put in cart: Optional, set to 1 to put in cart (0 or 1)
 * - get from cart: Optional, set to 1 to get from cart (0 or 1)
 */

export interface ItemControlEntry {
    itemNameOrID: string | number;
    minimum: number;
    autoStore: 0 | 1;
    autoSell: 0 | 1;
    putInCart?: 0 | 1;
    getFromCart?: 0 | 1;
}

export const itemsControlFieldCount = {
    min: 4, // item name, minimum, auto-store, auto-sell
    max: 6, // + put in cart, get from cart
};
