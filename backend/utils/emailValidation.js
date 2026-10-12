const localPartCharacters = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+$/;
const domainLabelCharacters = /^[A-Za-z0-9-]+$/;
const alphabeticTopLevelDomain = /^[A-Za-z]{2,63}$/;
const punycodeTopLevelDomain = /^xn--[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/i;

const isValidEmail = value => {
  if (typeof value !== 'string') return false;

  const email = value.trim();
  if (!email || email.length > 254) return false;

  const atIndex = email.indexOf('@');
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) return false;

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (localPart.length > 64 || !domain || domain.length > 253) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false;

  const localPartSegments = localPart.split('.');
  if (!localPartSegments.every(segment => localPartCharacters.test(segment))) return false;

  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label => (
    !label || label.length > 63 || !domainLabelCharacters.test(label)
      || !/^[A-Za-z0-9]/.test(label) || !/[A-Za-z0-9]$/.test(label)
  ))) return false;

  const topLevelDomain = labels[labels.length - 1];
  return alphabeticTopLevelDomain.test(topLevelDomain) || punycodeTopLevelDomain.test(topLevelDomain);
};

module.exports = { isValidEmail };
