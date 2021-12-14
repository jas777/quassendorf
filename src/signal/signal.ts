import Station from "../station/station";
import Node from "../node/node";
import MCP23017 from "../mcp/MCP23017";
import {determineName} from "../util/nameUtil";

export class Signal {
    station: Station;

    id: number;

    aspects: Aspect[];

    switchAhead: number;
    backwards: boolean;

    back: string;

    aspect: number;

    repeaters: SignalRepeater[];

    constructor(station: Station, object: SignalObject) {
        this.station = station;
        this.id = object.id;
        this.aspects = object.aspects;
        this.switchAhead = object.ahead.switch;
        this.backwards = object.ahead.backwards;
        this.back = object.back;
        this.aspect = SignalAspect.RED;

        if (object.repeaters) this.repeaters = object.repeaters;
        else this.repeaters = [];

        this.setAspect(SignalAspect.RED);
    }

    setAspect(aspectId: number) {
        if (!this.aspects.find((c) => c.aspectId == aspectId))
            throw new Error("Invalid aspect!");

        this.aspects // Disable every aspect except the desired one
            .filter((c) => c.aspectId != aspectId)
            .forEach((aspect) => {
                const state = aspect.pin.split("-")[1] == "H" ? 1 : 0;
                const pinNum = Number.parseInt(aspect.pin.split("-")[0]);

                if (!isNaN(pinNum) && (aspect.pin != this.aspects.find((c) => c.aspectId == aspectId)?.pin)) {

                    const pin: number = this.station.determinePin(aspect.pin);
                    const mcp: MCP23017 = this.station.determineController(aspect.pin);

                    if (mcp.readPin(pin) == state) {
                        mcp.writePin(pin, state == 0 ? 1 : 0);
                    }

                }
            });

        const aspect = this.aspects.find((c) => c.aspectId == aspectId); // Find the desired aspect

        this.finalizeAspect(aspect); // Set the aspect

        this.aspect = aspectId; // Update the aspect variable

        this.updateRepeaters(); // Update all repeaters linked to this signal

    }

    updateRepeaters() {

        this.repeaters.forEach(repeater => {
            if (!repeater.aspects.find((c) => c.aspectId == this.aspect))
                throw new Error("Invalid aspect!");

            repeater.aspects // Disable every aspect except the desired one
                .filter((c) => c.aspectId != this.aspect)
                .forEach((aspect) => {
                    const state = aspect.pin.split("-")[1] == "H" ? 1 : 0;
                    const pinNum = Number.parseInt(aspect.pin.split("-")[0]);

                    if (!isNaN(pinNum) && (aspect.pin != repeater.aspects.find((c) => c.aspectId == this.aspect)?.pin)) {

                        const pin: number = this.station.determinePin(aspect.pin);
                        const mcp: MCP23017 = this.station.determineController(aspect.pin);

                        if (mcp.readPin(pin) == state) {
                            mcp.writePin(pin, state == 0 ? 1 : 0);
                        }

                    }
                });

            const aspect = repeater.aspects.find((c) => c.aspectId == this.aspect); // Find the aspect

            this.finalizeAspect(aspect); // Set the aspect

        });

    }

    finalizeAspect(aspect: Aspect | undefined) {
        if (aspect) {
            const state = aspect.pin.split("-")[1] == "H" ? 1 : 0;

            const pin: number = this.station.determinePin(aspect.pin);
            const mcp: MCP23017 = this.station.determineController(aspect.pin);

            if (mcp.readPin(pin) != state) {
                mcp.writePin(pin, state);
            }

        }
    }

    allow(to: string) {

        const nodeAhead: Node | null = this.station.findNode(this.switchAhead.toString());

        const switchAhead = this.station.switches.find(
            (s) => s.id == this.switchAhead
        );

        if (!nodeAhead) throw new Error("Invalid node!");

        let finished: boolean = false;
        let safe: boolean = true;
        let directionChange: boolean = false;
        let node: Node = nodeAhead as Node;
        let prev: Node = node;
        let last: Node = node;
        let lastSwitch: Node = nodeAhead;

        let bypass: boolean = false;

        let nextNode: Node;

        if (this.backwards) { // If the switch ahead is facing the signal
            node = this.station.findNode(node.back!!.node)!! // Find the point behind the switch (always behind because the switch is backwards)

            if (node.facing == nodeAhead.facing) { // If node is facing the signal too, do the same
                nextNode = this.station.findNode(node.back!!.node)!!;
            } else {
                if (node.type == "switch") { // If the node is a switch
                    const asSwitch = this.station.switches.find(s => s.id == node.id); // Find the switch object in the station

                    if (asSwitch?.state == 1) { // If the switch is turned to plus the next node will be the point neighboring with plus
                        nextNode = nextNode = this.station.findNode(node.plus?.node!!)!!;
                    } else {
                        nextNode = this.station.findNode(node.minus?.node!!)!!; // Else it will be the minus neighbor
                    }

                } else {
                    // TODO: Try to figure out why I wrote this
                    nextNode = this.station.config.nodes.find(n => n[nodeAhead.facing ?? "left"] == nodeAhead.id.toString()) as Node;
                }
            }

        } else {

            if (switchAhead?.state == 1) { // If it's not backwards just follow the standard procedure to determine the next node
                nextNode = nextNode = this.station.findNode(node.plus?.node!!)!!;
            } else {
                nextNode = this.station.findNode(node.minus?.node!!)!!;
            }

        }

        while (!finished) {

            let asSwitch = this.station.switches.find((s) => s.id == node.id);

            // If the node is facing the opposite direction to the signal, the next node will be behind it
            if (node.facing != (this.backwards ? nodeAhead.facing == "right" ? "left" : "right" : nodeAhead.facing)) {
                nextNode = this.station.findNode(node.back?.node!!)!!;
            } else {

                if (asSwitch?.state == 1) {
                    nextNode = nextNode = this.station.findNode(node.plus?.node!!)!!;
                } else {
                    nextNode = this.station.findNode(node.minus?.node!!)!!;
                }

            }

            if (!nextNode || (to && (determineName(node) == to))) { // If there's no next node, and "to" is equal to the current node - finish
                last = node;
                finished = true;
                break;
            }

            if (nextNode.type == "point") { // If the next node is a waypoint

                if (determineName(nextNode) == to) { // If the point's name is equal to "to" - finish
                    last = nextNode;
                    finished = true;
                    break;
                }

                if (nodeAhead.facing) {
                    if ( // If the point doesn't have a neighboring node on the side the signal is facing - finish
                        !nextNode[
                            this.backwards
                                ? nodeAhead.facing == "right"
                                    ? "left"
                                    : "right"
                                : nodeAhead.facing
                            ]
                    ) {
                        last = nextNode;
                        finished = true;
                        break;
                    } else {
                        while (nextNode.type == "point") { // Just in case the point is next to another waypoint
                            if (determineName(nextNode) == to) {
                                if (this.checkSwitch(prev, node)) {
                                    if (this.station.switches.find((s) => s.id == node.id)?.state == 1) {
                                        directionChange = true;
                                        safe = true;
                                    } else {
                                        safe = true;
                                    }
                                } else {
                                    finished = true;
                                    safe = false;
                                }
                                bypass = true;
                                break;
                            }
                            if (node.facing != (this.backwards ? nodeAhead.facing == "right" ? "left" : "right" : nodeAhead.facing)) {
                                if (node.facing == "right") {
                                    nextNode = this.station.config.nodes.find((n) =>
                                        n.type == "switch"
                                            ? n.id.toString() == nextNode.left
                                            : n.name
                                                ? n.name == nextNode.left
                                                : `PT${n.id}` == nextNode.left
                                    ) as Node;
                                } else {
                                    nextNode = this.station.config.nodes.find((n) =>
                                        n.type == "switch"
                                            ? n.id.toString() == nextNode.right
                                            : n.name
                                                ? n.name == nextNode.right
                                                : `PT${n.id}` == nextNode.left
                                    ) as Node;
                                }
                            } else {
                                console.log(nextNode);
                                if (node.facing == "right") {
                                    nextNode = this.station.config.nodes.find((n) =>
                                        n.type == "switch"
                                            ? n.id.toString() == nextNode.right
                                            : n.name
                                                ? n.name == nextNode.right
                                                : `PT${n.id}` == nextNode.right
                                    ) as Node;
                                } else {
                                    nextNode = this.station.config.nodes.find((n) =>
                                        n.type == "switch"
                                            ? n.id.toString() == nextNode.left
                                            : n.name
                                                ? n.name == nextNode.left
                                                : `PT${n.id}` == nextNode.left
                                    ) as Node;
                                }
                            }
                        }
                    }
                }
            }

            if (!bypass && this.checkSwitch(nextNode, node)) {
                if (this.station.switches.find((s) => s.id == node.id)?.state == 1) {
                    directionChange = true;
                    safe = true;
                } else {
                    safe = true;
                }
            } else {
                finished = true;
                safe = false;
                break;
            }

            prev = node;
            last = node;
            lastSwitch = node;
            node = nextNode;
        }

        if (
            safe &&
            to &&
            (last.type == "switch"
                ? last.id.toString()
                : last.name
                    ? last.name
                    : `PT${last.id}`) == to
        ) {
            if (directionChange) {
                this.setAspect(SignalAspect.GREEN_CAUTION);
            } else {
                this.setAspect(SignalAspect.GREEN);
            }
            return true;
        } else {
            return false;
        }
    }

    close() {
        this.setAspect(SignalAspect.RED);
    }

    // Check if switches are set to meet
    checkSwitch(next: Node, node: Node): boolean {

        const nextAsSwitch = this.station.switches.find((s) => s.id == next.id);
        const asSwitch = this.station.switches.find((s) => s.id == node.id);

        if (nextAsSwitch && asSwitch) {

            const path = this.station.layout.path(node.id.toString(), next.id.toString());

            if (path && path.length > 2) { // If the path has point between switches

                if (node.back?.node == path[1]) { // If the node behind the current point is the first item in the path
                    // If the minus neighbor is equal to the last point before "next" return true if it's switched to it
                    if (next.minus?.node == path[path.length - 2]) {
                        return nextAsSwitch?.state == 0;
                    } else if (next.plus?.node == path[path.length - 2]) {
                        return nextAsSwitch?.state == 1; // Same for plus
                    } else {
                        return true; // Else they are back-to-back (always true)
                    }
                } else {
                    // If the first point in the path is the node's plus neighbor
                    if (node.plus?.node == path[1] || node.minus?.node == path[1]) {
                        // If "next" is neighboring with the last point in the path at plus or minus
                        if (
                            next.plus?.node == path[path.length - 2] ||
                            next.minus?.node == path[path.length - 2]
                        ) {
                            if (next.plus?.node == path[path.length - 2]) {
                                return nextAsSwitch.state == 1;
                            }

                            if (next.minus?.node == path[path.length - 2]) {
                                return nextAsSwitch.state == 0;
                            }
                        } else {
                            return asSwitch.state == (node.minus?.node == path[1] ? 0 : 1);
                        }
                    }
                }

            }

            if (node.back?.node == next.id.toString()) {
                if (next.minus?.node == node.id.toString()) {
                    return nextAsSwitch?.state == 0;
                } else if (next.plus?.node == node.id.toString()) {
                    return nextAsSwitch?.state == 1;
                } else {
                    return true;
                }
            } else if (node.plus?.node == next.id.toString() || node.minus?.node == next.id.toString()) {
                if (
                    next.plus?.node == node.id.toString() ||
                    next.minus?.node == node.id.toString()
                ) {
                    if (next.plus?.node == node.id.toString()) {
                        return nextAsSwitch.state == 1;
                    }

                    if (next.minus?.node == node.id.toString()) {
                        return nextAsSwitch.state == 0;
                    }
                } else {
                    return asSwitch.state == (node.minus?.node == next.id.toString() ? 0 : 1);
                }
            }
        }
        throw new Error("Invalid points!");
    }
}

export enum SignalAspect {
    GREEN,
    GREEN_CAUTION,
    YELLOW,
    RED,
}

export interface SignalObject {
    id: number;
    aspects: Aspect[];
    ahead: {
        switch: number;
        backwards: boolean;
    };
    back: string;
    repeaters?: SignalRepeater[];
    position: {
        x: number;
        y: number;
    }
}

export interface Aspect {
    aspectId: number;
    pin: string;
}

export interface SignalRepeater {
    aspects: Aspect[],
    name: string
}
