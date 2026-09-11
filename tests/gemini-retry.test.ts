import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isRetryableGeminiError,
  withGeminiRetry,
} from '../integrations/gemini/retry.ts';

void test('retries temporary Gemini errors with a bounded attempt count', async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await withGeminiRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw { status: 503 };
      return 'ok';
    },
    {
      sleep: async (delay) => {
        delays.push(delay);
      },
    },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [500, 1_500]);
});

void test('does not retry permanent or unknown failures', async () => {
  let calls = 0;
  await assert.rejects(
    withGeminiRetry(async () => {
      calls += 1;
      throw new Error('invalid_request');
    }),
    /invalid_request/,
  );
  assert.equal(calls, 1);
  assert.equal(isRetryableGeminiError({ status: 429 }), true);
  assert.equal(isRetryableGeminiError({ status: 400 }), false);
});
