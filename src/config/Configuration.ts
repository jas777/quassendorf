import LightNode from "../node/lightnode";
import {SignalObject} from "../signal/signal";
import Node from "../node/node";

export default interface Configuration {
    signals: SignalObject[],
    lighting: LightNode[],
    nodes: Node[],
    constantSignalOperation: boolean
}
