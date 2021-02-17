import Station from "../station/station";
import Node from "../node/node";
import {RailSwitch} from "../switch/switch";
import MCP23017 from "../mcp/MCP23017";

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

        this.aspects
            .filter((c) => c.aspectId != aspectId)
            .forEach((aspect) => {
                // const targetAspect = this.aspects.find((c) => c.aspectId == aspectId);
                const state = aspect.pin.split("-")[1] == "H" ? 1 : 0;
                const pinNum = Number.parseInt(aspect.pin.split("-")[0]);

                if (!isNaN(pinNum) && (aspect.pin != this.aspects.find((c) => c.aspectId == aspectId)?.pin)) {

                    const pin: number = this.station.determinePin(aspect.pin);
                    const mcp: MCP23017 = this.station.determineController(aspect.pin);

                    if (mcp.readPin(pin) == state) {
                        mcp.writePin(pin, state == 0 ? 1 : 0);
                    }

                }

                // if (
                //   targetAspect &&
                //   Number.parseInt(targetAspect.pin.split("-")[0]) != pinNum
                // ) {
                //   const mcp = this.station.controllers[Math.floor(pinNum / 16)];
                //   const pin =
                //     pinNum > 15
                //       ? pinNum - this.station.controllers.indexOf(mcp) * 16
                //       : pinNum;
                //
                //   if (mcp.readPin(pin) == state) {
                //     mcp.writePin(pin, state == 1 ? 0 : 1);
                //   }
                // }
            });

        const aspect = this.aspects.find((c) => c.aspectId == aspectId);

        this.finalizeAspect(aspect);

        this.aspect = aspectId;

        this.updateRepeaters();

    }

    updateRepeaters() {

        this.repeaters.forEach(repeater => {
            if (!repeater.aspects.find((c) => c.aspectId == this.aspect))
                throw new Error("Invalid aspect!");

            repeater.aspects
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

            const aspect = repeater.aspects.find((c) => c.aspectId == this.aspect);

            this.finalizeAspect(aspect);

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

    allow(to?: string) {

        const nodeAhead: Node = this.station.config.nodes
            .filter((n) => n.type == "switch")
            .find((s) => s.id == this.switchAhead) as Node;
        const switchAhead = this.station.switches.find(
            (s) => s.id == this.switchAhead
        );

        if (!nodeAhead) throw new Error("Invalid node!");

        let finished: boolean = false;
        let safe: boolean = true;
        let directionChange: boolean = false;
        let node: Node = nodeAhead as Node;
        let prev: Node;
        let last: Node = node;

        let nextNode: Node;

        if (this.backwards) {
            node = this.station.config.nodes.find(
                (n) => (n.type == "switch" ? n.id.toString() : n.name ? n.name : `PT${n.id}`) == node.back?.node
            ) as Node;

            if (node.facing == nodeAhead.facing) {
                nextNode = this.station.config.nodes.find(
                    (n) => (n.type == "switch" ? n.id.toString() : n.name ? n.name : `PT${n.id}`) == node.back?.node
                ) as Node;
            } else {
                if (node.type == "switch") {
                    const asSwitch = this.station.switches.find(s => s.id == node.id);
                    if (asSwitch?.state == 1) {
                        nextNode = this.station.config.nodes.find((n) =>
                            n.type == "switch"
                                ? n.id.toString() == node.plus?.node
                                : n.name
                                ? n.name == node.plus?.node
                                : `PT${n.id}` == node.plus?.node
                        ) as Node;
                    } else {
                        nextNode = this.station.config.nodes.find((n) =>
                            n.type == "switch"
                                ? n.id.toString() == node.minus?.node
                                : n.name
                                ? n.name == node.minus?.node
                                : `PT${n.id}` == node.minus?.node
                        ) as Node;
                    }
                } else {
                    nextNode = this.station.config.nodes.find(n => n[nodeAhead.facing ?? "left"] == nodeAhead.id.toString()) as Node;
                }
            }

        } else {

            if (switchAhead?.state == 1) {
                nextNode = this.station.config.nodes.find((n) =>
                    n.type == "switch"
                        ? n.id.toString() == node.plus?.node
                        : n.name
                        ? n.name == node.plus?.node
                        : `PT${n.id}` == node.plus?.node
                ) as Node;
            } else {
                nextNode = this.station.config.nodes.find((n) =>
                    n.type == "switch"
                        ? n.id.toString() == node.minus?.node
                        : n.name
                        ? n.name == node.minus?.node
                        : `PT${n.id}` == node.minus?.node
                ) as Node;
            }
        }

        while (!finished) {

            let asSwitch = this.station.switches.find((s) => s.id == node.id);

            if (node.facing != (this.backwards ? nodeAhead.facing == "right" ? "left" : "right" : nodeAhead.facing)) {
                nextNode = this.station.config.nodes.find(
                    (n) => (n.type == "switch" ? n.id.toString() : n.name ? n.name : `PT${n.id}`) == node.back?.node
                ) as Node;
            } else {

                if (asSwitch?.state == 1) {
                    nextNode = this.station.config.nodes.find((n) =>
                        n.type == "switch"
                            ? n.id.toString() == node.plus?.node
                            : n.name
                            ? n.name == node.plus?.node
                            : `PT${n.id}` == node.plus?.node
                    ) as Node;
                } else {
                    nextNode = this.station.config.nodes.find((n) =>
                        n.type == "switch"
                            ? n.id.toString() == node.minus?.node
                            : n.name
                            ? n.name == node.minus?.node
                            : `PT${n.id}` == node.minus?.node
                    ) as Node;
                }

            }

            if (
                !nextNode ||
                (to &&
                    (node.type == "switch"
                        ? node.id.toString()
                        : node.name
                            ? node.name
                            : `PT${node.id}`) == to)
            ) {
                last = node;
                finished = true;
                break;
            }

            if (nextNode.type == "point") {

                if ((nextNode.name ? nextNode.name : `PT${nextNode.id}`) == to) {
                    last = nextNode;
                    finished = true;
                    break;
                }

                if (nodeAhead.facing) {
                    if (
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
                        while (nextNode.type == "point") {
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
                                console.log("3")
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

            if (this.checkSwitch(nextNode, node)) {
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

    checkSwitch(next: Node, node: Node) {

        const nextAsSwitch = this.station.switches.find((s) => s.id == next.id);
        const asSwitch = this.station.switches.find((s) => s.id == node.id);

        if (nextAsSwitch && asSwitch) {

            const path = this.station.layout.path(node.id.toString(), next.id.toString());

            if (path && path.length > 2) {

                if (node.back?.node == path[1]) {
                    if (next.minus?.node == path[path.length - 2]) {
                        console.log(next)
                        console.log(path[path.length - 2])
                        return nextAsSwitch?.state == 0;
                    } else if (next.plus?.node == path[path.length - 2]) {
                        return nextAsSwitch?.state == 1;
                    } else {
                        return true;
                    }
                } else {
                    if (node.plus?.node == path[1]) {
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
                            return asSwitch.state == 1;
                        }
                    } else if (node.minus?.node == path[1]) {
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
                            return asSwitch.state == 0;
                        }
                    }
                }

            }

            if (node.back?.node == next.id.toString()) {
                if (next.minus?.node == node.id.toString()) {
                    if (nextAsSwitch?.state == 0) return true;
                    else return false;
                } else if (next.plus?.node == node.id.toString()) {
                    if (nextAsSwitch?.state == 1) return true;
                    else return false;
                } else {
                    return true;
                }
            } else {
                if (node.plus?.node == next.id.toString()) {
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
                        return asSwitch.state == 1;
                    }
                } else if (node.minus?.node == next.id.toString()) {
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
                        return asSwitch.state == 0;
                    }
                }
            }
        }
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
    repeaters?: SignalRepeater[]
}

export interface Aspect {
    aspectId: number;
    pin: string;
}

export interface SignalRepeater {
    aspects: Aspect[],
    name: string
}
