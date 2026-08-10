import messages from '../../messages';

export const VALID_USERNAME_REGEX = /^[a-zA-Z0-9._-]*$/i;
export const DISALLOWED_USERNAME_PATTERN = /['";=]|--/;
export const usernameRegex = VALID_USERNAME_REGEX;

const validateUsername = (value, formatMessage) => {
  const normalizedValue = value?.trim() || '';
  let fieldError = '';
  if (!normalizedValue || normalizedValue.length < 3 || normalizedValue.length > 50) {
    fieldError = formatMessage(messages['username.validation.message']);
  } else if (DISALLOWED_USERNAME_PATTERN.test(normalizedValue) || !usernameRegex.test(normalizedValue)) {
    fieldError = formatMessage(messages['username.format.validation.message']);
  }
  return fieldError;
};

export default validateUsername;
