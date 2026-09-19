export class ReportError extends Error {
  constructor(
    public readonly code:
      | 'VALIDATION_FAILED'
      | 'REPORT_TARGET_INVALID'
      | 'REPORT_CONTEXT_NOT_FOUND'
      | 'REPORT_REQUEST_CONFLICT',
  ) {
    super(
      {
        VALIDATION_FAILED: 'Report input is invalid',
        REPORT_TARGET_INVALID: 'Report target is invalid',
        REPORT_CONTEXT_NOT_FOUND: 'Report context is unavailable',
        REPORT_REQUEST_CONFLICT: 'Request identifier is already bound to different content',
      }[code],
    );
    this.name = 'ReportError';
  }
}
