/**
 * Domain errors for Google Drive and Media Attachment operations.
 */

export class DriveDomainError extends Error {
  public readonly code: string;
  public readonly reauthRequired: boolean;
  public readonly retryable: boolean;
  public readonly statusCode: number;

  constructor(
    code: string,
    message: string,
    reauthRequired = false,
    retryable = false,
    statusCode = 400
  ) {
    super(message);
    this.name = 'DriveDomainError';
    this.code = code;
    this.reauthRequired = reauthRequired;
    this.retryable = retryable;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AttachmentDomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'AttachmentDomainError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
