export default interface Node {
    type: "switch" | "point";
    id: number;
    plus?: {
        pin: string,
        node: string,
        cost: number
    };
    minus?: {
        pin: string,
        node: string,
        cost: number
    };
    back?: {
        pin: string,
        node: string,
        cost: number
    };
    facing?: "left" | "right";
    orientation?: "up" | "down";
    left?: string;
    right?: string;
    name?: string;
    timeout?: number;
}