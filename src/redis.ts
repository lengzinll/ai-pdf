import { Redis } from "ioredis";
import { env } from "./env";
const redis = new Redis(env.redis);
export default redis;
