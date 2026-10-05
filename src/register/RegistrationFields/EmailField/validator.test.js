import { COMMON_EMAIL_PROVIDERS } from './constants';
import validateEmail, {
  EMAIL_MAX_LENGTH,
  getLevenshteinSuggestion,
  getSuggestionForInvalidEmail,
} from './validator';

const formatMessage = descriptor => descriptor.defaultMessage;

describe('Email Validators Utils', () => {
  describe('getLevenshteinSuggestion Tests', () => {
    it('test getLevenshteinSuggestion returns null for invalid word', () => {
      const output = getLevenshteinSuggestion('', COMMON_EMAIL_PROVIDERS);
      expect(output).toEqual(null);
    });

    it('test getLevenshteinSuggestion returns output for valid word', () => {
      const output = getLevenshteinSuggestion('gmail', COMMON_EMAIL_PROVIDERS);
      expect(output).toEqual('gmail.com');
    });
  });
  describe('getSuggestionForInvalidEmail Tests', () => {
    it('test getSuggestionForInvalidEmail returns empty string for invalid domain', () => {
      const output = getSuggestionForInvalidEmail('', 'username');
      expect(output).toEqual('');
    });

    it('test getSuggestionForInvalidEmail returns valid suggestion when domain is nearly matched', () => {
      const output = getSuggestionForInvalidEmail('gmail', 'username');
      expect(output).toEqual('username@gmail.com');
    });

    it('test getSuggestionForInvalidEmail returns valid suggestion for default domains', () => {
      const output = getSuggestionForInvalidEmail('aol', 'username');
      expect(output).toEqual('username@aol.com');
    });
    it('test getSuggestionForInvalidEmail returns empty for totally different domain', () => {
      const output = getSuggestionForInvalidEmail('invalid-domain', 'username');
      expect(output).toEqual('');
    });
  });

  describe('validateEmail Tests', () => {
    it('should validate a trimmed email address', () => {
      const { fieldError } = validateEmail('  test.user@example.com  ', null, formatMessage);
      expect(fieldError).toEqual('');
    });

    it('should not set confirm email mismatch for whitespace-only confirm email value', () => {
      const { confirmEmailError } = validateEmail('test.user@example.com', '   ', formatMessage);
      expect(confirmEmailError).toEqual('');
    });

    it('should reject email longer than 254 chars', () => {
      const localPartLength = EMAIL_MAX_LENGTH - '@example.com'.length + 1;
      const oversizedEmail = `${'a'.repeat(localPartLength)}@example.com`;
      const { fieldError } = validateEmail(oversizedEmail, null, formatMessage);
      expect(fieldError).toEqual('Enter a valid email address');
    });
  });
});
