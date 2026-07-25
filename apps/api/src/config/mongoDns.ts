import dns from "dns";
import { env } from "./env";

export function configureMongoDns() {
  if (env.mongoUri.startsWith("mongodb+srv://") && env.mongoDnsServers.length > 0) {
    dns.setServers(env.mongoDnsServers);
  }
}

configureMongoDns();
