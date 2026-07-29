import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAttachmentReference,
  hasRecentImageContext,
  isContextualImageFollowUp,
  isExplicitLiveSportsScoreQuery,
  serializeAttachmentsForStorage,
  shouldReuseRecentImage,
} from '../lib/handlers/conversation-context.mjs';

test('treats room scoring as an image-context follow-up', () => {
  assert.equal(isContextualImageFollowUp('Give me a score'), true);
  assert.equal(isContextualImageFollowUp('How clean is it?'), true);
  assert.equal(isContextualImageFollowUp('Rate the room from 1 to 10'), true);
});

test('does not reinterpret an explicit live sports query as image context', () => {
  assert.equal(isExplicitLiveSportsScoreQuery('What is the Lakers score tonight?'), true);
  assert.equal(isContextualImageFollowUp('What is the Lakers score tonight?'), false);
});

test('does not let recent image context hijack an unrelated comparison', () => {
  assert.equal(isContextualImageFollowUp('Compare this stock price to the market'), false);
  assert.equal(isContextualImageFollowUp('What is the weather in Phoenix?'), false);
});

test('recognizes a short pronoun-based image follow-up', () => {
  assert.equal(isContextualImageFollowUp('What do you think about this?'), true);
});

test('only reuses an image when recent conversation state contains one', () => {
  const withImage = [
    { role: 'user', content: 'Use this as the reference', attachments: [{ type: 'image', base64: 'abc' }] },
    { role: 'assistant', content: 'I can compare against that.' },
  ];

  assert.equal(shouldReuseRecentImage('Give me a score', withImage), true);
  assert.equal(shouldReuseRecentImage('Give me a score', [{ role: 'assistant', content: 'Which game?' }]), false);
});

test('does not treat images outside the recent media window as active context', () => {
  const messages = [
    { role: 'user', content: 'Old image', attachments: [{ type: 'image', base64: 'abc' }] },
    ...Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `turn ${index}` })),
  ];

  assert.equal(hasRecentImageContext(messages), false);
});

test('does not claim unavailable attachment metadata is usable image context', () => {
  assert.equal(
    hasRecentImageContext([
      { role: 'user', attachments: [{ type: 'image', contextUnavailable: true }] },
    ]),
    false,
  );
});

test('stores URL and bounded inline image references without losing metadata', () => {
  const stored = serializeAttachmentsForStorage([
    {
      type: 'image',
      name: 'room.jpg',
      mimeType: 'image/jpeg',
      base64: 'https://cdn.example.com/room.jpg',
      isUrlReference: true,
    },
    {
      type: 'image',
      name: 'small.png',
      mimeType: 'image/png',
      base64: 'YWJj',
    },
  ]);

  assert.equal(stored[0].base64, 'https://cdn.example.com/room.jpg');
  assert.equal(stored[0].isUrlReference, true);
  assert.equal(stored[1].base64, 'YWJj');
  assert.equal(stored[1].mimeType, 'image/png');
});

test('marks oversized inline images unavailable instead of bloating the message document', () => {
  const stored = serializeAttachmentsForStorage(
    [{ type: 'image', name: 'huge.jpg', mimeType: 'image/jpeg', base64: 'x'.repeat(11) }],
    { maxInlineChars: 10 },
  );

  assert.equal(stored[0].base64, undefined);
  assert.equal(stored[0].contextUnavailable, true);
});

test('converts a stored inline image into a provider-compatible data URL', () => {
  assert.equal(
    getAttachmentReference({ type: 'image', mimeType: 'image/png', base64: 'YWJj' }),
    'data:image/png;base64,YWJj',
  );
});
