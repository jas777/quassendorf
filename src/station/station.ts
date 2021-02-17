import Node from "../node/node";
import Graph from "node-dijkstra";
import { RailSwitch, RailSwitchObject } from "../switch/switch";
import Waypoint from "../node/waypoint";
import MCP23017 from "../mcp/MCP23017";
import { Signal, SignalObject } from "../signal/signal";
import LightNode from "../node/lightnode";
import Configuration from "../config/Configuration";

export default class Station {

  config: Configuration;

  layout: Graph;

  switches: RailSwitch[];
  waypoints: Waypoint[];
  signals: Signal[];
  lightNodes: LightNode[];

  controllers: MCP23017[];

  constructor(controllers: MCP23017[], config: Configuration) {
    this.layout = new Graph();

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
        const name = node.name ? node.name : `PT${node.id}`;

        const rightCost: number = 0;

        const neighbourRight = config.nodes.find(n => (n.type == "switch" ? n.id : n.name ? n.name : `PT${n.id}`) == node.right);
        const neighbourLeft = config.nodes.find(n => (n.type == "switch" ? n.id : n.name ? n.name : `PT${n.id}`) == node.left);

        let costRight: number = 1;
        let costLeft: number = 1;

        if (neighbourRight?.type == "switch") {
          if (neighbourRight?.plus?.node == name) {
            costRight = neighbourRight?.plus?.cost;
          } else if (neighbourRight?.minus?.node == name) {
            costRight = neighbourRight?.minus?.cost;
          } else if (neighbourRight?.back?.node == name) {
            costRight = neighbourRight?.back?.cost;
          }
        } else {
          if (neighbourRight?.type == "point") {
            costRight = 1.5;
          }
        }

        if (neighbourLeft?.type == "switch") {
          if (neighbourLeft?.plus?.node == name) {
            costLeft = neighbourLeft?.plus?.cost;
          } else if (neighbourLeft?.minus?.node == name) {
            costLeft = neighbourLeft?.minus?.cost;
          } else if (neighbourLeft?.back?.node == name) {
            costLeft = neighbourLeft?.back?.cost;
          }
        } else {
          if (neighbourLeft?.type == "point") {
            costLeft = 1.5;
          }
        }

        const point = {
          [node.right as string]: costRight,
          [node.left as string]: costLeft,
        };

        if ((node.right as string) == undefined)
          delete point[node.right as string];
        if ((node.left as string) == undefined)
          delete point[node.left as string];

        this.layout.addNode(node.name ? node.name : "PT" + node.id, point);
        this.waypoints.push(
          new Waypoint(
            node.id,
            config.nodes.filter((n) => (n.type == "switch" ? n.id.toString() : n.name ? n.name : `PT${n.id}`) == node.left)[0],
            config.nodes.filter((n) => (n.type == "switch" ? n.id.toString() : n.name ? n.name : `PT${n.id}`) == node.right)[0],
            node.name ? node.name : undefined
          )
        );
      } else {
        this.layout.addNode(node.id.toString(), {
          [node.minus?.node as string]: node.minus?.cost,
          [node.plus?.node as string]: node.plus?.cost,
          [node.back?.node as string]: node.back?.cost,
        });

        this.switches.push(
          new RailSwitch(
            this,
            node.id,
            node as RailSwitchObject
          )
        );
      }
      // console.log(this.layout);
    });
  }

  path(nodes: string[]) {
    let prev: Node;

    let queue: string[] = [];

    nodes.forEach((n, i) => {
      let node: Node;
      let next: Node;

      if (isNaN(Number.parseInt(n))) {
        node = this.config.nodes.filter(
          (wp) => wp.type == "point" && (`PT${wp.id}` == n || wp.name == n)
        )[0] as Node;
      } else {
        node = this.config.nodes.filter(
          (wp) => wp.type == "switch" && wp.id.toString() == n
        )[0] as Node;
      }

      if (isNaN(Number.parseInt(nodes[i + 1]))) {
        next = this.config.nodes.filter(
          (wp) =>
            wp.type == "point" &&
            (`PT${wp.id}` == nodes[i + 1] || wp.name == nodes[i + 1])
        )[0] as Node;
      } else {
        next = this.config.nodes.filter(
          (wp) => wp.type == "switch" && wp.id.toString() == nodes[i + 1]
        )[0] as Node;
      }

      if (node.type == "switch" && i != nodes.length - 1) {

        let switchTo;

        if (prev && node.back?.node == (next.type == "switch" ? next.id.toString() : next.name ? next.name : `PT${next.id}`)) {

          queue.push(
            node.minus?.node == (prev.type == "switch" ? prev.id.toString() : prev.name ? prev.name : `PT${prev.id}`)
              ? this.switches.find((s) => s.id == node.id)?.id + "-M"
              : this.switches.find((s) => s.id == node.id)?.id + "-P"
          );

        } else {

          queue.push(
            node.minus?.node == (next.type == "switch" ? next.id.toString() : next.name ? next.name : `PT${next.id}`)
              ? this.switches.find((s) => s.id == node.id)?.id + "-M"
              : this.switches.find((s) => s.id == node.id)?.id + "-P"
          );

        }
        prev = node;
      } else if (node.type == "switch" && i == nodes.length - 1) {
        queue.push(
          node.minus?.node == prev.id.toString()
            ? this.switches.find((s) => s.id == node.id)?.id + "-M"
            : this.switches.find((s) => s.id == node.id)?.id + "-P"
        );
      } else {
        prev = node;
      }
    });

    queue.forEach((item) => {
      const id = item.split("-")[0];
      const state = item.split("-")[1];

      const s = this.switches.find((s) => s.id.toString() == id);

      state == "M" ? s?.toMinus() : s?.toPlus();
    });
  }

  checkDirection(prev: Node, node: Node, next: Node): boolean {
    let prevId =
      prev.type == "point" ? (prev.name ? prev.name : `PT${prev.id}`) : prev.id;

    let nextId =
      next.type == "point" ? (next.name ? next.name : `PT${next.id}`) : next.id;

    if (node.type == "switch") {
      if (
        (node.minus?.node == prevId && node.plus?.node == nextId) ||
        (node.minus?.node == nextId && node.plus?.node == prevId)
      )
        return false;
      else return true;
    } else {
      return prevId != nextId;
    }
  }

  lightNodeOn(node: string): void {
    if (!this.lightNodes.find(n => n.name.toLowerCase() == node.toLowerCase())) return;

    const lightNode: LightNode = this.lightNodes.find(n => n.name.toLowerCase() == node.toLowerCase()) as LightNode;

    lightNode.pins.forEach(pin => {

      const state = pin.split("-")[1] == "H" ? 1 : 0;
      const pinNum = Number.parseInt(pin.split("-")[0]);

      const mcp = this.controllers[Math.floor(pinNum / 16)];
      const actualPin = pinNum > 15 ?
          pinNum - (this.controllers.indexOf(mcp) * 16) :
          pinNum;

      if (mcp.readPin(actualPin) != state) {
        mcp.writePin(actualPin, state);
      }

    });

    lightNode.active = true;

  }

  lightNodeOff(node: string): void {
    if (!this.lightNodes.find(n => n.name.toLowerCase() == node.toLowerCase())) return;

    const lightNode: LightNode = this.lightNodes.find(n => n.name.toLowerCase() == node.toLowerCase()) as LightNode;

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

}
