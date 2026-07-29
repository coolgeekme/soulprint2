const DEFAULT_MAX_INLINE_ATTACHMENT_CHARS = 2_000_000;
const DEFAULT_RECENT_MEDIA_WINDOW = 10;

function isExternalReference(value) {
  return typeof value === 'string' && (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('attachment://')
  );
}

export function isImageAttachment(attachment) {
  if (!attachment) return false;
  return attachment.type === 'image' ||
    attachment.type?.startsWith('image/') ||
    attachment.mimeType?.startsWith('image/');
}

export function getAttachmentReference(attachment) {
  if (!attachment) return null;

  const reference = attachment.reference || attachment.url || attachment.base64 || null;
  if (!reference || typeof reference !== 'string') return null;
  if (isExternalReference(reference)) return reference;

  if (isImageAttachment(attachment)) {
    return `data:${attachment.mimeType || 'image/jpeg'};base64,${reference}`;
  }

  return null;
}

export function serializeAttachmentsForStorage(
  attachments,
  { maxInlineChars = DEFAULT_MAX_INLINE_ATTACHMENT_CHARS } = {},
) {
  if (!Array.isArray(attachments)) return [];

  return attachments.map((attachment) => {
    const stored = {
      type: attachment.type || 'unknown',
      name: attachment.name || 'attachment',
      mimeType: attachment.mimeType || null,
    };

    if (isImageAttachment(attachment)) {
      const value = attachment.reference || attachment.url || attachment.base64 || null;
      if (typeof value === 'string' && (isExternalReference(value) || value.length <= maxInlineChars)) {
        stored.base64 = value;
        stored.isUrlReference = isExternalReference(value);
      } else if (typeof value === 'string') {
        stored.contextUnavailable = true;
      }
    } else if (attachment.type === 'document') {
      if (typeof attachment.text === 'string') {
        stored.text = attachment.text.slice(0, 128_000);
        stored.textTruncated = attachment.text.length > 128_000;
      }
    }

    return stored;
  });
}

export function isExplicitLiveSportsScoreQuery(text) {
  const lower = String(text || '').toLowerCase();
  const sportsContext = /\b(nba|nfl|nhl|mlb|wnba|epl|soccer|football|basketball|baseball|hockey|game|match|team|lakers|suns|celtics|warriors|chiefs|cowboys|yankees|dodgers)\b/i;
  const liveContext = /\b(score|result|won|lost|final)\b/i;
  const currentContext = /\b(today|tonight|current|latest|live|right now|final)\b/i;
  return sportsContext.test(lower) && liveContext.test(lower) && currentContext.test(lower);
}

export function isContextualImageFollowUp(text) {
  const lower = String(text || '').trim().toLowerCase();
  if (!lower || isExplicitLiveSportsScoreQuery(lower)) return false;

  const evaluationRequest = /\b(score|rate|rating|grade|evaluate|assess|assessment|compare|comparison|clean|cleanliness|messy|tidy|organized|organised)\b/i;
  const mediaReference = /\b(this|that|it|image|picture|photo|room|first one|second one|previous one|last one)\b/i;
  const explicitImageSubject = /\b(image|picture|photo|room)\b/i;
  const unrelatedLiveSubject = /\b(stock|share|market|price|weather|news|article|website|company|team|game|match)\b/i;
  const shortScoringRequest = /^(?:please\s+)?(?:give\s+me\s+an?\s+)?(?:score|rate|grade|evaluate|assess)\b/i;

  if (unrelatedLiveSubject.test(lower) && !explicitImageSubject.test(lower)) return false;

  return shortScoringRequest.test(lower) ||
    (evaluationRequest.test(lower) && (lower.length < 80 || mediaReference.test(lower)));
}

export function hasRecentImageContext(messages, windowSize = DEFAULT_RECENT_MEDIA_WINDOW) {
  if (!Array.isArray(messages) || messages.length === 0) return false;

  return messages.slice(-windowSize).some((message) => {
    if (message?.image_url) return true;
    if (
      Array.isArray(message?.attachments) &&
      message.attachments.some((attachment) => (
        isImageAttachment(attachment) && Boolean(getAttachmentReference(attachment))
      ))
    ) return true;
    return typeof message?.content === 'string' && /!\[.*?\]\((?:https?:\/\/|data:image\/)/i.test(message.content);
  });
}

export function shouldReuseRecentImage(text, messages) {
  return hasRecentImageContext(messages) && isContextualImageFollowUp(text);
}
