import { randomUUID } from "crypto";

export function createDeploymentId() {
  return randomUUID().replace(/-/g, "");
}
