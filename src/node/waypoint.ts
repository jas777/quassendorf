import Node from "./node";

export default class Waypoint {

    id: number;

    name?: string;

    left: Node | null;
    right: Node | null;

    constructor (id: number, left: Node | null, right: Node | null, name?: string) {
        this.id = id;
        this.left = left;
        this.right = right;
        this.name = name;
    }

}
