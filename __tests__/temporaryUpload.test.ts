import { mkdtemp, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withTemporaryUpload } from "../src/files/temporaryUpload.js";

test.each([false, true])(
  "temporary upload is removed after completion or failure (%s)",
  async (fail) => {
    const directory = await mkdtemp(join(tmpdir(), "mcp-upload-test-"));
    const path = join(directory, "file");
    await writeFile(path, "synthetic upload");
    try {
      const result = withTemporaryUpload(path, async () => {
        await access(path);
        if (fail) throw Error("upload rejected");
        return "uploaded";
      });
      if (fail) await expect(result).rejects.toThrow("upload rejected");
      else await expect(result).resolves.toBe("uploaded");
      await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("missing multipart file still returns the handler result", async () => {
  await expect(withTemporaryUpload(undefined, async () => 404)).resolves.toBe(
    404,
  );
});
