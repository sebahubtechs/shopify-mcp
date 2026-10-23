import { unlink } from "node:fs/promises";

/** Remove only the Multer-created file owned by this request, on every exit. */
export async function withTemporaryUpload<T>(
  path: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } finally {
    if (path)
      await unlink(path).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          console.error("Temporary upload cleanup failed");
      });
  }
}
