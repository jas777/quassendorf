import Node from "../node/node";
import Graph from "node-dijkstra";
import {RailSwitch, RailSwitchObject} from "../switch/switch";
import Waypoint from "../node/waypoint";
import MCP23017 from "../mcp/MCP23017";
import {Signal, SignalObject} from "../signal/signal";
import LightNode from "../node/lightnode";
import Configuration from "../config/Configuration";
import {determineName} from "../util/nameUtil";

export default class Station {

    config: Configuration;

    layout: Graph;

    currentPath: string[];

    switches: RailSwitch[];
    waypoints: Waypoint[];
    signals: Signal[];
    lightNodes: LightNode[];

    controllers: MCP23017[];

    constructor(controllers: MCP23017[], config: Configuration) {
        this.layout = new Graph();

        this.currentPath = [];

        this.switches = [];
        this.waypoints = [];
        this.signals = [];
        this.lightNodes = [];
        this.config = config;

        this.controllers = controllers;

        this.config.signals.forEach(signal => {
            this.signals.push(new Signal(this, signal as SignalObject));
        });

        this.config.lighting.forEach((lNode) => {
            this.lightNodes.push(
                {
                    ...lNode as LightNode,
                    active: false
                });
        });

        this.config.nodes.forEach((n) => {
            const node: Node = n as Node;

            if (node.type == "point") {
                const name = node.name ?? `PT${node.id}`;
                const neighbourRight = node.right ? this.findNode(node.right) : null; // The right neighbor (null if none)
                const neighbourLeft = node.left ? this.findNode(node.left) : null; // The left neighbor (null if none)

                let costRight: number = 1;
                let costLeft: number = 1;

                // Check whether the right neighbor is a switch - if yes, set the cost based on config
                if (neighbourRight && neighbourRight.type == "switch") {
                    if (neighbourRight.plus?.node == name) {
                        costRight = neighbourRight.plus?.cost;
                    } else if (neighbourRight.minus?.node == name) {
                        costRight = neighbourRight?.minus?.cost;
                    } else if (neighbourRight.back?.node == name) {
                        costRight = neighbourRight.back?.cost;
                    }
                } else if (neighbourRight && neighbourRight.type == "point") {
                    costRight = 1.5; // For point neighbors default to cost = 1.5
                }

                // Check whether the left neighbor is a switch - if yes, set the cost based on config
                if (neighbourLeft && neighbourLeft.type == "switch") {
                    if (neighbourLeft.plus?.node == name) {
                        costLeft = neighbourLeft.plus?.cost;
                    } else if (neighbourLeft.minus?.node == name) {
                        costLeft = neighbourLeft.minus?.cost;
                    } else if (neighbourLeft.back?.node == name) {
                        costLeft = neighbourLeft.back.cost;
                    }
                } else if (neighbourLeft && neighbourLeft.type == "point") {
                    costLeft = 1.5; // For point neighbors default to cost = 1.5
                }

                // Create an object for pathfinding graph (costs to right & left neighbor)
                const point = {
                    [node.right ?? 'TO_DEL_1']: costRight,
                    [node.left ?? 'TO_DEL_2']: costLeft,
                };

                // Delete neighbors from the pathfinding relations if they don't exist
                if (!(node.right as string))
                    delete point['TO_DEL_1'];
                if (!(node.left as string))
                    delete point['TO_DEL_2'];

                this.layout.addNode(node.name ? node.name : "PT" + node.id, point); // Add the waypoint to the pathfinding graph

                this.waypoints.push( // Add the waypoint to the station's internal collection
                    new Waypoint(
                        node.id,
                        node.left ? this.findNode(node.left) : null,
                        node.right ? this.findNode(node.right) : null,
                        node.name ? node.name : undefined
                    )
                );
            } else {

                this.layout.addNode(node.id.toString(), { // Add the switch to the pathfinding graph
                    [node.minus?.node as string]: node.minus?.cost, // Straight-on neighbor
                    [node.plus?.node as string]: node.plus?.cost, // Left neighbor
                    [node.back?.node as string]: node.back?.cost, // Back neighbor
                });

                this.switches.push( // Add the switch to the internal station's collection
                    new RailSwitch(
                        this,
                        node.id,
                        node as RailSwitchObject
                    )
                );
            }
        });
    }

    path(nodes: string[]) {
        let prev: Node;

        this.currentPath = nodes;

        let queue: string[] = [];

        nodes.forEach((n, i) => {

            let node: Node = this.findNode(n)!!;
            let next: Node = this.findNode(nodes[i + 1])!!;

            if (node.type == "switch" && i != nodes.length - 1) {
                if (prev && node.back?.node == determineName(next)) { // If the next point is at the back of the switch
                    queue.push( // Turn the switch to whatever side the previous point comes from
                        node.minus?.node == (determineName(prev))
                            ? this.switches.find((s) => s.id == node.id)?.id + "-M"
                            : this.switches.find((s) => s.id == node.id)?.id + "-P"
                    );
                } else {
                    queue.push( // Else just turn the switch to the correct point
                        node.minus?.node == (determineName(next))
                            ? this.switches.find((s) => s.id == node.id)?.id + "-M"
                            : this.switches.find((s) => s.id == node.id)?.id + "-P"
                    );
                }
                prev = node;
            } else if (node.type == "switch" && i == nodes.length - 1) {
                queue.push( // Turn the last switch in the queue to whatever side the previous point comes from
                    node.minus?.node == prev.id.toString()
                        ? this.switches.find((s) => s.id == node.id)?.id + "-M"
                        : this.switches.find((s) => s.id == node.id)?.id + "-P"
                );
            } else {
                prev = node;
            }
        });

        queue.forEach((item) => {
            const [id, state] = item.split("-");

            const s = this.switches.find((s) => s.id.toString() == id)!!;

            state == "M" ? s.toMinus() : s.toPlus();
        });
    }

    // Check if the given points are reachable in the same direction
    checkDirection(prev: Node, node: Node, next: Node): boolean {
        let prevId = determineName(prev);
        let nextId = determineName(next);

        if (node.type == "switch") {
            return !((node.minus?.node == prevId && node.plus?.node == nextId) ||
                (node.minus?.node == nextId && node.plus?.node == prevId)); // Check if the points lead to a turnaround
        }

        return prevId != nextId;
    }

    lightNodeOn(node: string): void {
        const lightNode = this.lightNodes.find(n => n.name.toLowerCase() == node.toLowerCase());

        if (!lightNode) return;

        lightNode.pins.forEach(pin => {

            const state = pin.split("-")[1] == "H" ? 1 : 0;

            const pinNum: number = this.determinePin(pin);
            const mcp: MCP23017 = this.determineController(pin);

            if (mcp.readPin(pinNum) != state) {
                mcp.writePin(pinNum, state);
            }

        });

        lightNode.active = true;

    }

    lightNodeOff(node: string): void {

        const lightNode = this.lightNodes.find(n => n.name.toLowerCase() == node.toLowerCase());

        if (!lightNode) return;

        lightNode.pins.forEach(pin => {

            const state = pin.split("-")[1] == "H" ? 1 : 0;

            const pinNum: number = this.determinePin(pin);
            const mcp: MCP23017 = this.determineController(pin);

            if (mcp.readPin(pinNum) == state) {
                mcp.writePin(pinNum, state == 1 ? 0 : 1);
            }

        });

        lightNode.active = false;

    }

    determinePin(pin: string): number {
        const pinNum = Number.parseInt(pin.split("-")[0]);

        const mcp = this.controllers[Math.floor(pinNum / 16)];
        return pinNum > 15 ?
            pinNum - (this.controllers.indexOf(mcp) * 16) :
            pinNum;
    }

    determineController(pin: string): MCP23017 {
        const pinNum = Number.parseInt(pin.split("-")[0]);
        return this.controllers[Math.floor(pinNum / 16)];
    }

    findNode(node: string): Node | null {
        return this.config.nodes.filter((n) => determineName(n) == node)[0]
    }

}
