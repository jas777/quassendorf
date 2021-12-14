import Station from "../station/station";
import {FastifyReply, FastifyRequest} from "fastify";

export const checkIfPointsValid = (station: Station, req: FastifyRequest, res: FastifyReply<any>): boolean => {
    if (
        (!station.switches.find((s) => (s.id == Number.parseInt(req.params.a))) &&
            !station.waypoints.find((w) =>
                w.name ? w.name == req.params.a : `PT${w.id}` == req.params.a
            )) ||
        (!station.switches.find((s) => (s.id == Number.parseInt(req.params.b))) &&
            !station.waypoints.find((w) =>
                w.name ? w.name == req.params.b : `PT${w.id}` == req.params.b
            ))
    ) {
        res.code(501).send({error: "Invalid points!"});
        return false;
    }
    return true;
}
