export function resolveTowCombatOverlayMessageRefId(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "object") return "";

  const directId = String(value.id ?? value._id ?? "").trim();
  if (directId) return directId;

  const nestedMessage = value.message;
  if (typeof nestedMessage === "string") return nestedMessage.trim();
  if (nestedMessage && typeof nestedMessage === "object") {
    const nestedId = String(nestedMessage.id ?? nestedMessage._id ?? "").trim();
    if (nestedId) return nestedId;
  }

  const messageId = String(value.messageId ?? value.chatMessageId ?? "").trim();
  if (messageId) return messageId;
  return "";
}
