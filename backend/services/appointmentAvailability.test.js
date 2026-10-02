const test = require('node:test');
const assert = require('node:assert/strict');
const {
  bookingTimes,
  getDayRange,
  getAvailableBookingTimes,
  getPublicHoliday,
  getTimeSlot,
  validateCustomerAppointment
} = require('./appointmentAvailability');

test('appointment slots are one hour apart during opening hours', () => {
  assert.deepEqual(bookingTimes, [
    '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00'
  ]);
});

test('accepts a future appointment and converts Sri Lankan local time to UTC', () => {
  const result = validateCustomerAppointment('2026-09-30T09:00', new Date('2026-09-29T00:00:00.000Z'));

  assert.equal(result.error, undefined);
  assert.equal(result.appointmentDate.toISOString(), '2026-09-30T03:30:00.000Z');
  assert.equal(result.time, '09:00');
});

test('rejects dates and times outside the valid appointment schedule', () => {
  const now = new Date('2026-09-29T00:00:00.000Z');
  assert.ok(validateCustomerAppointment('2026-09-30T08:00', now).error);
  assert.ok(validateCustomerAppointment('2026-09-30T16:30', now).error);
  assert.ok(validateCustomerAppointment('2026-09-30T17:00', now).error);
  assert.ok(validateCustomerAppointment('2026-02-30T09:00', now).error);
});

test('rejects a Sri Lankan public holiday', () => {
  assert.ok(getPublicHoliday('2026-01-01'));
  assert.match(
    validateCustomerAppointment('2026-01-01T09:00', new Date('2025-12-31T00:00:00.000Z')).error,
    /Sri Lankan public holiday/
  );
});

test('rejects appointments that have already passed', () => {
  const result = validateCustomerAppointment('2026-09-30T09:00', new Date('2026-09-30T03:30:00.000Z'));
  assert.match(result.error, /future/);
});

test('calculates appointment-day boundaries in Sri Lankan time', () => {
  const range = getDayRange('2026-09-30');
  assert.equal(range.start.toISOString(), '2026-09-29T18:30:00.000Z');
  assert.equal(range.end.toISOString(), '2026-09-30T18:30:00.000Z');
  assert.equal(getTimeSlot(new Date('2026-09-30T03:30:00.000Z')), '09:00');
});

test('hides slots that overlap an existing appointment', () => {
  const availableTimes = getAvailableBookingTimes(
    '2026-09-30',
    ['10:30'],
    new Date('2026-09-29T00:00:00.000Z')
  );

  assert.equal(availableTimes.includes('10:00'), false);
  assert.equal(availableTimes.includes('11:00'), false);
  assert.equal(availableTimes.includes('09:00'), true);
  assert.equal(availableTimes.includes('12:00'), true);
});
