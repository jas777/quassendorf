import Node from "./node";

export default class Waypoint {

    id: number;

    name?: string;

    left: Node;
    right: Node;

    constructor (id: number, left: Node, right: Node, name?: string) {
        this.id = id;
        this.left = left;
        this.right = right;
        this.name = name;
    }

}