import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The Muushig rules run in the browser (solo) and on the server (online) from
// two copies, because the server deploys from server/ alone. They must match
// byte for byte: edit src/utils/muushig/ and copy it to server/game/muushig/.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe.each(["engine.js", "ai.js"])("muushig/%s", (file) => {
  it("is identical in the browser and on the server", () => {
    const client = fs.readFileSync(path.join(root, "src/utils/muushig", file), "utf8");
    const server = fs.readFileSync(path.join(root, "server/game/muushig", file), "utf8");
    expect(server).toBe(client);
  });
});
