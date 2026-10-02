const { isValidSriLankanPhone } = require('./repairInputValidation');

const validatePartsCustomer = customer => {
  const name = String(customer?.customerName || '').trim();
  const phone = String(customer?.customerPhone || '').trim();
  const email = String(customer?.customerEmail || '').trim();

  if (!name) return 'Customer name is required.';
  if (name.length < 2 || name.length > 80) return 'Customer name must be between 2 and 80 characters.';
  if (!phone) return 'Phone number is required.';
  if (!isValidSriLankanPhone(phone)) return 'Enter a valid Sri Lankan phone number.';
  if (!email) return 'Email address is required.';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }

  return null;
};

module.exports = { validatePartsCustomer };
