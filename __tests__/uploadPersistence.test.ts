import {
  createUploadSession,
  getUploadSession,
  updateUploadSession,
  resetUploadSessionsForTests,
  installUploadSessionPersistence,
  cleanupExpiredUploadSessions,
} from "../src/files/uploadSessions.js";
afterEach(() => resetUploadSessionsForTests());
test("upload capabilities survive runtime eviction and are removed after expiry", () => {
  const stored = new Map<string, any>();
  const changed = (id: string, record: any) => {
    if (record) stored.set(id, record);
    else stored.delete(id);
  };
  installUploadSessionPersistence([], changed);
  const s = createUploadSession({
    baseUrl: "https://worker.example",
    kind: "IMAGE",
    duplicateResolutionMode: "APPEND_UUID",
    expiresInMinutes: 15,
  });
  updateUploadSession(s.id, {
    state: "COMPLETE",
    fileId: "gid://shopify/MediaImage/1",
  });
  resetUploadSessionsForTests();
  installUploadSessionPersistence([...stored.values()], changed);
  expect(getUploadSession(s.id)?.fileId).toBe("gid://shopify/MediaImage/1");
  cleanupExpiredUploadSessions(Date.now() + 2 * 60 * 60 * 1000);
  expect(stored.size).toBe(0);
});
test("an interrupted in-flight upload is restored as uncertain, never retried", () => {
  const s = createUploadSession({
    baseUrl: "https://worker.example",
    kind: "IMAGE",
    duplicateResolutionMode: "APPEND_UUID",
    expiresInMinutes: 15,
  });
  updateUploadSession(s.id, { state: "UPLOADING" });
  const saved = { ...s };
  resetUploadSessionsForTests();
  installUploadSessionPersistence([saved], () => {});
  expect(getUploadSession(s.id)).toMatchObject({
    state: "FAILED",
    error: expect.stringMatching(/check Shopify Files/i),
  });
});
