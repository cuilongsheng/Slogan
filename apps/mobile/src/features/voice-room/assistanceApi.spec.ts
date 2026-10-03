import { createMobileApiClient } from '../../api/client';
import { ExpressionAssistanceApi } from './assistanceApi';

jest.mock('../../api/client', () => ({ createMobileApiClient: jest.fn() }));

const client = {
  GET: jest.fn(),
  PUT: jest.fn(),
  POST: jest.fn(),
};
const authorize = async <T extends { response: Response }>(request: (token: string) => Promise<T>) => request('test-token');

beforeEach(() => {
  jest.clearAllMocks();
  (createMobileApiClient as jest.Mock).mockReturnValue(client);
});

test('reads current notice version and accepts the same server version', async () => {
  client.GET.mockResolvedValue({ data: { items: [{ purpose: 'AI_EXPRESSION_AUDIO', status: 'REQUIRED', currentNoticeVersion: 'current-v2' }] }, response: { status: 200 } });
  client.PUT.mockResolvedValue({ data: { purpose: 'AI_EXPRESSION_AUDIO', status: 'ACCEPTED', currentNoticeVersion: 'current-v2' }, response: { status: 200 } });
  const api = new ExpressionAssistanceApi(authorize);
  const consent = await api.consent();
  await api.acceptConsent(consent.currentNoticeVersion, '00000000-0000-4000-8000-000000000001');
  expect(client.PUT).toHaveBeenCalledWith('/v1/me/speech-processing-consents/ai-expression', expect.objectContaining({ body: { action: 'ACCEPT', clientRequestId: '00000000-0000-4000-8000-000000000001', noticeVersion: 'current-v2' } }));
});

test('uses the caller request id for text and multipart audio', async () => {
  const expression = { requestId: 'result', primary: { text: 'Hello.', tone: 'NEUTRAL' }, alternatives: [], noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE', generatedAt: '2026-09-28T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z' };
  client.POST.mockResolvedValue({ data: expression, response: { status: 200 } });
  const api = new ExpressionAssistanceApi(authorize);
  const id = '00000000-0000-4000-8000-000000000002';
  await api.text('room-id', '你好', id);
  expect(client.POST).toHaveBeenCalledWith('/v1/rooms/{roomId}/expression-assistance/text', expect.objectContaining({ body: { clientRequestId: id, text: '你好' } }));
  const clip = { uri: 'blob:clip', name: 'expression.webm', mimeType: 'audio/webm', formFile: new Blob(['clip'], { type: 'audio/webm' }) };
  await api.audio('room-id', clip, 'current-v2', id);
  const options = client.POST.mock.calls[1][1];
  const form = options.bodySerializer();
  expect(form.get('clientRequestId')).toBe(id);
  expect(form.get('noticeVersion')).toBe('current-v2');
  expect(form.get('noticeConfirmed')).toBe('true');
  expect(form.get('audio')).toBeInstanceOf(Blob);
});
