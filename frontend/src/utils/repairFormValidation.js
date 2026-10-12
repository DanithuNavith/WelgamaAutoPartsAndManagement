const sriLankanPhonePattern = /^(?:0|94|\+94)\d{9}$/;
const sriLankanPlatePattern = /^[A-Z]{2,3}-?\d{3,4}$/i;

export const isValidSriLankanPhone = value => {
  const normalized = String(value || '').trim().replace(/[\s()-]/g, '');
  return sriLankanPhonePattern.test(normalized);
};

export const isValidSriLankanPlate = value => sriLankanPlatePattern.test(String(value || '').trim());

export const validateCustomerForm = (customer, { requireAddress = false, requireVehicle = false } = {}) => {
  const errors = {};
  const name = String(customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const email = String(customer.email || '').trim();
  const address = String(customer.address || '').trim();

  if (!name) errors.name = 'Customer name is required.';
  else if (name.length < 2 || name.length > 80) errors.name = 'Customer name must be 2 to 80 characters.';

  if (!phone) errors.phone = 'Phone number is required.';
  else if (!isValidSriLankanPhone(phone)) errors.phone = 'Enter a valid Sri Lankan phone number.';

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';

  if (requireAddress && !address) errors.address = 'Address is required.';
  else if (address && address.length > 250) errors.address = 'Address cannot exceed 250 characters.';

  const vehicles = Array.isArray(customer.vehicles) ? customer.vehicles : [];
  if (requireVehicle && vehicles.length === 0) errors.vehicle = 'Add at least one vehicle.';
  vehicles.forEach((vehicle, index) => {
    const prefix = `vehicles.${index}`;
    const model = String(vehicle.model || '').trim();
    const plate = String(vehicle.licensePlate || '').trim();
    const year = Number(vehicle.year);

    if (!plate) errors[`${prefix}.licensePlate`] = 'License plate is required.';
    else if (!isValidSriLankanPlate(plate)) errors[`${prefix}.licensePlate`] = 'Enter a plate like ABC-1234 or AB-1234.';

    if (!model) errors[`${prefix}.model`] = 'Vehicle model is required.';
    else if (model.length < 2 || model.length > 80) errors[`${prefix}.model`] = 'Vehicle model must be 2 to 80 characters.';

    if (vehicle.year === '' || vehicle.year === null || vehicle.year === undefined) errors[`${prefix}.year`] = 'Vehicle year is required.';
    else if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      errors[`${prefix}.year`] = `Enter a valid year from 1900 to ${new Date().getFullYear() + 1}.`;
    }
  });

  return errors;
};

export const validateJobForm = (job, customer, now = new Date(), { allowPastAppointment = false } = {}) => {
  const errors = {};
  if (!job.customer) errors.customer = 'Select a customer.';
  if (job.vehicleIndex === '' || job.vehicleIndex === null || job.vehicleIndex === undefined) errors.vehicleIndex = 'Select a vehicle.';

  const vehicle = job.vehicleIndex === 'existing-job-vehicle' ? null : customer?.vehicles?.[Number(job.vehicleIndex)];
  if (job.vehicleIndex !== '' && job.vehicleIndex !== 'existing-job-vehicle' && !vehicle) {
    errors.vehicleIndex = 'Select a valid vehicle for this customer.';
  }
  if (vehicle && (
    !isValidSriLankanPlate(vehicle.licensePlate)
    || String(vehicle.model || '').trim().length < 2
    || String(vehicle.model || '').trim().length > 80
    || !Number.isInteger(Number(vehicle.year))
    || Number(vehicle.year) < 1900
    || Number(vehicle.year) > new Date().getFullYear() + 1
  )) {
    errors.vehicleIndex = 'The selected vehicle has invalid registration, model, or year details.';
  }

  const issueDescription = String(job.issueDescription || '').trim();
  if (!issueDescription) errors.issueDescription = 'Issue description is required.';
  else if (issueDescription.length < 10 || issueDescription.length > 500) {
    errors.issueDescription = 'Issue description must be 10 to 500 characters.';
  }

  if (!job.appointmentDate) errors.appointmentDate = 'Choose an appointment date.';
  if (!job.appointmentTime) errors.appointmentTime = 'Choose an available appointment time.';
  if (job.appointmentDate && job.appointmentTime) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(job.appointmentDate);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(job.appointmentTime);
    const appointment = match && timeMatch
      ? new Date(Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(timeMatch[1]),
        Number(timeMatch[2])
      ) - 330 * 60_000)
      : new Date(NaN);
    if (Number.isNaN(appointment.getTime()) || (!allowPastAppointment && appointment <= now)) {
      errors.appointmentDate = 'Appointment must be in the future.';
    }
  }

  if (!job.technician) errors.technician = 'Select a technician.';

  return errors;
};
