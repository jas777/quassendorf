import Node from "../node/node";

export const defaultSwitchFilter = (wp: Node, targetName: string) => wp.type == "switch" && wp.id.toString() == targetName;

export const defaultPointFilter = (wp: Node, targetName: string) => wp.type == "point" && (`PT${wp.id}` == targetName || wp.name == targetName)

export const determineName = (node: Node) => node.type == "switch" ? node.id.toString() : node.name ?? `PT${node.id}`
