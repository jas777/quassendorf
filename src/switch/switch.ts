import MCP23017 from "src/mcp/MCP23017";
import Station from "src/station/station";

export class RailSwitch {

    station: Station;

    id: number;

    state: number;

    minus: 0 | 1;
    minusPin: number;

    plus: 0 | 1;
    plusPin: number;

    timeout: number;

    constructor (station: Station, id: number, object: RailSwitchObject) {

        this.station = station;

        this.id = id;

        this.minus = object.minus.pin.split("-")[1] == "H" ? 1 : 0;
        this.minusPin = Number.parseInt(object.minus.pin.split("-")[0]);

        this.plus = object.plus.pin.split("-")[1] == "H" ? 1 : 0;
        this.plusPin = Number.parseInt(object.plus.pin.split("-")[0]);

        this.timeout = object.timeout;

        this.state = 0;
        this.toMinus();

    }

    readState () {

        const plusPin: number = this.station.determinePin(this.plusPin + "-");
        const minusMcp: MCP23017 = this.station.determineController(this.minusPin + "-");

        const minusPin: number = this.station.determinePin(this.minusPin + "-");
        const plusMcp: MCP23017 = this.station.determineController(this.plusPin + "-");

        if (minusMcp.readPin(minusPin) != plusMcp.readPin(plusPin)) return 1;
        else return 0;
    }

    toMinus () {

        const plusPin: number = this.station.determinePin(this.plusPin + "-");
        const minusMcp: MCP23017 = this.station.determineController(this.minusPin + "-");

        const minusPin: number = this.station.determinePin(this.minusPin + "-");
        const plusMcp: MCP23017 = this.station.determineController(this.plusPin + "-");

        if (plusMcp.readPin(plusPin) == this.plus) {
            plusMcp.writePin(plusPin, this.plus == 0 ? 1 : 0);
        }
        minusMcp.writePin(minusPin, this.minus);
        this.state = 0;
    }

    toPlus () {

        const plusPin: number = this.station.determinePin(this.plusPin + "-");
        const minusMcp: MCP23017 = this.station.determineController(this.minusPin + "-");

        const minusPin: number = this.station.determinePin(this.minusPin + "-");
        const plusMcp: MCP23017 = this.station.determineController(this.plusPin + "-");

        if (minusMcp.readPin(minusPin) == this.minus) {
            minusMcp.writePin(minusPin, this.minus == 0 ? 1 : 0);
        }

        plusMcp.writePin(plusPin, this.plus);
        this.state = 1;
    }

    switch () {

        if (this.readState() == 0) {
            this.toPlus();
        } else {
            this.toMinus();
        }

    }

}

export interface RailSwitchObject {
    id: number;
    plus: {
        pin: string,
        node: string,
        cost: number
    };
    minus: {
        pin: string,
        node: string,
        cost: number
    };
    back: {
        pin: string,
        node: string,
        cost: number
    };
    facing: "left" | "right";
    orientation: "up" | "down";
    timeout: number;
}
