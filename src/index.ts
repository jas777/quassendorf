import fastify from "fastify";
import MCP23017 from "./mcp/MCP23017";
import Station from "./station/station";
import Configuration from "./config/Configuration";
import {checkIfPointsValid} from "./util/checkUtil";
import {calculateStep, checkPath} from "./util/pathUtil";

const config: Configuration = require('../config.json');

const server = fastify({logger: true});

const station = new Station(
    [new MCP23017(1, 0x26, 0x0, 0x0),
        new MCP23017(1, 0x27, 0x0, 0x0)],
    config
);

const stepQueue = new Map<number, string[][]>();
const switchingCache = new Map<number, { from: string, to: string }>();
let stepId = 0;

function queuePath(a: string, b: string): number {

    const {queue} = calculateStep(a, b, station);

    stepQueue.set(stepId, queue);
    switchingCache.set(stepId, {
        from: queue[0][0],
        to: queue[queue.length - 1][queue[queue.length - 1].length - 1]
    });
    return stepId++;

}

server.register(require('fastify-cors'))

server.addContentTypeParser('application/json', {parseAs: 'string'}, function (req, body, done) {
    try {
        const json = JSON.parse(body);
        done(null, json)
    } catch (err: any) {
        err.statusCode = 400
        done(err, undefined)
    }
})

server.post("/reset", (req, res) => {
    try {
        station.switches.forEach((s) => {
            s.toMinus();
        });
    } catch (err: any) {
        res.code(501).send({error: err.message});
    }

    res.send({worked: true});
});

server.post("/test", (req, res) => {
    try {
        station.switches.forEach((s) => {
            s.toPlus();
        });
    } catch (err: any) {
        res.code(501).send({error: err.message});
    }

    res.send({worked: true});
});

server.post("/path/:a/:b", (req, res) => {
    if (!checkIfPointsValid(station, req, res)) return;
    try {
        const steps = queuePath(req.params.a, req.params.b);

        res.send({
            queue_id: steps,
            length: stepQueue.get(steps)?.length
        });
    } catch (err: any) {
        console.error(err);
        res.code(501).send({error: err.message});
    }
});

server.post("/check_path/:a/:b", (req, res) => {
    if (!checkIfPointsValid(station, req, res)) return;
    try {
        res.send(checkPath(req.params.a, req.params.b, station));
    } catch (err: any) {
        console.error(err);
        res.code(501).send({error: err.message});
    }
});

server.post("/steps/:queue/next", (req, res) => {

    const steps = stepQueue.get(Number.parseInt(req.params.queue));

    if (!steps) {
        res.code(501).send({
            message: "Invalid queue ID",
        });
    } else {
        try {
            if (steps.length > 1) {
                station.path(steps[0]);
                steps.shift();
            } else {
                station.path(steps[0]);
                stepQueue.delete(Number.parseInt(req.params.queue));
                switchingCache.delete(Number.parseInt(req.params.queue));
            }
            res.send({ok: "OK"});
        } catch (err: any) {
            console.error(err);
            res.code(501).send({error: err.message});
        }
    }
});

server.post("/switches/minus/:switch", (req, res) => {

    if (!station.switches.find((s) => (s.id == Number.parseInt(req.params.switch)))) {
        res.code(501).send({error: "Invalid point!"});
    }

    station.switches.find(s => s.id == Number.parseInt(req.params.switch))?.toMinus();

    res.send({ok: 'OK'})

});

server.post("/switches/plus/:switch", (req, res) => {

    if (!station.switches.find((s) => (s.id == Number.parseInt(req.params.switch)))) {
        res.code(501).send({error: "Invalid point!"});
    }

    station.switches.find(s => s.id == Number.parseInt(req.params.switch))?.toPlus();

    res.send({ok: 'OK'})

});

server.post("/signals/allow/:signal", (req, res) => {

    if (!station.signals.find((s) => (s.id == Number.parseInt(req.params.signal)))) {
        res.code(501).send({error: "Invalid signal!"});
    }

    let to: string;

    if (req.body.to) {
        to = req.body.to;
    } else {
        res.code(400).send({message: 'Parameter \'to\' not specified!'});
        return;
    }

    station.signals.find((s) => (s.id == Number.parseInt(req.params.signal)))?.allow(to);

    res.send({ok: 'OK'})

});

server.post("/signals/close/:signal", (req, res) => {

    if (!station.signals.find((s) => (s.id == Number.parseInt(req.params.signal)))) {
        res.code(501).send({error: "Invalid signal!"});
    }

    station.signals.find((s) => (s.id == Number.parseInt(req.params.signal)))?.close();

    res.send({ok: 'OK'})

});

server.post("/lighting/:node/on", (req, res) => {

    const lightNode = req.params.node;

    if (!lightNode || !station.lightNodes.find(n => n.name.toLowerCase() == lightNode.toLowerCase()))
        res.code(404).send({error: "Light node not found!"});

    station.lightNodeOn(lightNode);

    res.send({ok: 'OK'})

});

server.post("/lighting/:node/off", (req, res) => {

    const lightNode = req.params.node;

    if (!lightNode || !station.lightNodes.find(n => n.name.toLowerCase() == lightNode.toLowerCase()))
        res.code(404).send({error: "Light node not found!"});

    station.lightNodeOff(lightNode);

    res.send({ok: 'OK'})

});

server.get("/switches", (req, res) => {

    const toSend = station.switches.map(s => {
        return {
            id: s.id,
            state: s.state
        }
    });

    res.send(toSend);

});

server.get("/lighting", (req, res) => {
    res.send([...station.lightNodes])
});

server.get("/signals", (req, res) => {

    const toSend = station.signals.map(s => {
        return {
            id: s.id,
            aspect: s.aspect,
            repeaters: s.repeaters.map(r => r.name)
        }
    });

    res.send(toSend);

});

server.get("/points", (req, res) => {

    const toSend = [...station.waypoints.map(w => w.name ?? `PT${w.id}`), ...station.switches.map(sw => sw.id)]

    res.send(toSend);

});

server.get("/queue", (req, res) => {
    let obj: any = {};

    stepQueue.forEach((value, key) => {
        obj[key] = value;
    });

    let obj1: any = {};

    switchingCache.forEach((value, key) => {
        obj1[key] = value;
    });

    res.send({queue: obj, cache: obj1});
})

server.get("/config", (req, res) => {
    res.send(config)
})

server.get("/currentPath", (_req, res) => {
    res.send(station.currentPath)
})

server.post("/resetPath", (_req, res) => {
    station.currentPath = [];
    res.send([])
})

server.listen(5000, "0.0.0.0", (err, addr) => {
    if (err) {
        server.log.error(err);
        process.exit(1);
    }
    server.log.info(`Server listening on ${addr}`);
});
