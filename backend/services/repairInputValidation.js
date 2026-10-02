const isValidSriLankanPhone = value => {
  const normalized = String(value || '').trim().replace(/[\s()-]/g, '');
  return /^(?:0|94|\+94)\d{9}$/.test(normalized);
};

const isValidSriLankanPlate = value => /^[A-Z]{2,3}-?\d{3,4}$/i.test(String(value || '').trim());

const validateCustomerInput = customer => {
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const email = String(customer.email || '').trim();
  const address = String(customer.address || '').trim();

  if (!name) return 'Customer name is required.';
  if (name.length < 2 || name.length > 80) return 'Customer name must be between 2 and 80 characters.';
  if (!isValidSriLankanPhone(phone)) return 'Enter a valid Sri Lankan phone number.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  if (address.length > 250) return 'Address cannot exceed 250 characters.';

  if (customer.vehicles !== undefined && !Array.isArray(customer.vehicles)) return 'Vehicles must be a list.';
  for (const vehicle of customer.vehicles || []) {
    const validationError = validateVehicleInput(vehicle);
    if (validationError) return validationError;
  }

  return null;
};

const validateVehicleInput = (vehicle, { requireYear = true } = {}) => {
  const model = String(vehicle?.model || '').trim();
  const plate = String(vehicle?.licensePlate || '').trim();
  const year = Number(vehicle?.year);

  if (!plate) return 'License plate is required.';
  if (!isValidSriLankanPlate(plate)) return 'Enter a plate like ABC-1234 or AB-1234.';
  if (!model) return 'Vehicle model is required.';
  if (model.length < 2 || model.length > 80) return 'Vehicle model must be between 2 and 80 characters.';
  if (requireYear && (vehicle.year === '' || vehicle.year === null || vehicle.year === undefined)) return 'Vehicle year is required.';
  if (vehicle.year !== '' && vehicle.year !== null && vehicle.year !== undefined
    && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
    return `Enter a valid vehicle year from 1900 to ${new Date().getFullYear() + 1}.`;
  }

  return null;
};

const validateJobCardInput = (job, now = new Date()) => {
  const issueDescription = String(job.issueDescription || '').trim();
  if (!issueDescription) return 'Issue description is required.';
  if (issueDescription.length < 10 || issueDescription.length > 500) {
    return 'Issue description must be between 10 and 500 characters.';
  }

  const appointmentValue = job.appointmentDate;
  const match = typeof appointmentValue === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(appointmentValue)
    : null;
  if (!match) return 'Choose a valid appointment date and time.';

  const [, year, month, day, hour, minute] = match.map(Number);
  const dateString = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayStartUtc = Date.UTC(year, month - 1, day);
  if (new Date(dayStartUtc).toISOString().slice(0, 10) !== dateString || hour > 23 || minute > 59) {
    return 'Choose a valid appointment date and time.';
  }
  const appointmentDate = new Date(dayStartUtc + hour * 60 * 60_000 + minute * 60_000 - 330 * 60_000);
  if (appointmentDate <= now) return 'Appointment must be in the future.';

  if (job.estimatedCost !== undefined && job.estimatedCost !== '') {
    const estimatedCost = Number(job.estimatedCost);
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0) return 'Estimated cost must be zero or greater.';
  }

  return null;
};

module.exports = {
  isValidSriLankanPhone,
  isValidSriLankanPlate,
  validateCustomerInput,
  validateVehicleInput,
  validateJobCardInput
};
