import * as ws from "ws";
import * as express from "express";
import * as Http from "http";
import * as Types from "@patternplate/types";
import * as T from "./types";
import * as Routes from "./routes";
import { createSubscription } from "./create-subscription";
import { createCompiler } from "./create-compiler";

const profiler = require("../../../tools/profiler")(__filename);
const { createWatcher } = require("./create-watcher");

export interface ApiApplication {
  middleware: express.Express;
  subscribe(h: (msg: T.QueueMessage) => void): void;
  unsubscribe(): void;
}

export interface ApiOptions {
  cwd: string;
  config: Types.PatternplateConfig;
  server: Http.Server;
  inspect: {
    enabled: boolean;
    port: number;
    break: boolean;
  };
}

export async function api({
  server,
  config,
  cwd,
  inspect
}: ApiOptions): Promise<ApiApplication> {
  const [clientQueue, serverQueue] = await Promise.all([
    createCompiler({ config, cwd, inspect, target: Types.CompileTarget.Web }),
    createCompiler({ config, cwd, inspect, target: Types.CompileTarget.Node })
  ]);

  const queues = {
    client: clientQueue,
    server: serverQueue
  };

  const watcher = await createWatcher({ config, cwd });
  const wss = new ws.Server({ server });

  const routeOptions = { config, cwd, queue: queues.server };

  const stateRouter = async () => {
    profiler.pStart("stateRouter");
    const route = await Routes.main(routeOptions);
    profiler.pEnd();
    return route;
  };

  const demoRouter = async () => {
    profiler.pStart("demoRouter");
    const route = await Routes.demo(routeOptions);
    profiler.pEnd();
    return route;
  };

  const middleware = express()
    // .get("/state.json", await Routes.main(routeOptions))
    .get("/state.json", await stateRouter())
    .get("/demo/*.html", await demoRouter())
    .get("/cover.html", await Routes.cover(routeOptions))
    .use(await Routes.scripts({ config, cwd, queue: queues.client }));

  return {
    middleware,
    subscribe: createSubscription({
      cwd,
      config,
      inspect,
      queues,
      wss,
      watcher
    }),
    unsubscribe: () => {
      watcher.stop();
      serverQueue.stop();
      clientQueue.stop();
      wss.clients.forEach(client => {
        client.close();
      });
    }
  };
}
