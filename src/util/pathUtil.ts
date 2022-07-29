import Node from "../node/node";
import {defaultPointFilter, defaultSwitchFilter, determineName} from "./nameUtil";
import Configuration from "../config/Configuration";
import Station from "../station/station";
const config: Configuration = require('../config.json');

export function calculateStep(a: string, b: string, station: Station) {
    const nodes: string[] = station.layout.path(a, b);

    let prev: Node;

    let queue: string[][] = [];
    let step: string[] = [];

    nodes.forEach((n, i) => {
        let node: Node;
        let next: Node;

        if (isNaN(Number.parseInt(n))) {
            node = config.nodes.filter(
                (wp) => defaultPointFilter(wp, n)
            )[0] as Node;
        } else {
            node = config.nodes.filter(
                (wp) => defaultSwitchFilter(wp, n)
            )[0] as Node;
        }

        if (nodes[i + 1]) {
            if (isNaN(Number.parseInt(nodes[i + 1]))) {
                next = config.nodes.filter(
                    (wp) =>
                        defaultPointFilter(wp, nodes[i + 1])
                )[0] as Node;
            } else {
                next = config.nodes.filter(
                    (wp) => defaultSwitchFilter(wp, nodes[i + 1])
                )[0] as Node;
            }

            if (prev) {
                if (!station.checkDirection(prev, node, next)) {
                    step.push(determineName(node));

                    queue.push(step);
                    step = [];

                    step.push(determineName(node));
                } else {
                    step.push(determineName(node));
                }
            } else {
                step.push(determineName(node));
            }
        } else {
            step.push(determineName(node));
        }

        prev = node;
    });

    if (step.length > 0) queue.push(step);

    return {
        queue,
        step
    }
}

export function checkPath(a: string, b: string, station: Station): { length: number; queue: string[][] } {
    const {queue} = calculateStep(a, b, station);

    return {
        length: queue.length,
        queue
    };

}
