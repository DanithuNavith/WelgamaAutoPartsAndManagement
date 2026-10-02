const Holidays = require('date-holidays');

const SRI_LANKA_TIME_ZONE = 'Asia/Colombo';
const SRI_LANKA_OFFSET_MINUTES = 330;
const SLOT_DURATION_MINUTES = 60;
const OPENING_MINUTES = 9 * 60;
const LAST_START_MINUTES = 16 * 60;
const holidays = new Holidays('LK');

const bookingTimes = [];
for (let minutes = OPENING_MINUTES; minutes <= LAST_START_MINUTES; minutes += SLOT_DURATION_MINUTES) {
  bookingTimes.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
}

const getSriLankaDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SRI_LANKA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const parseDate = dateString => {
  if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== dateString) return null;
  return { year, month, day, date };
};

const getPublicHoliday = dateString => {
  const parsed = parseDate(dateString);
  if (!parsed) return null;
  const holiday = holidays.getHolidays(parsed.year).find(item =>
    item.type === 'public' && item.date.slice(0, 10) === dateString
  );
  return holiday ? { date: dateString, name: holiday.name } : null;
};

const getDayRange = dateString => {
  const parsed = parseDate(dateString);
  if (!parsed) return null;
  const start = Date.UTC(parsed.year, parsed.month - 1, parsed.day) - SRI_LANKA_OFFSET_MINUTES * 60_000;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60_000) };
};

const getTimeSlot = date => {
  const sriLankaTime = new Date(date.getTime() + SRI_LANKA_OFFSET_MINUTES * 60_000);
  return `${String(sriLankaTime.getUTCHours()).padStart(2, '0')}:${String(sriLankaTime.getUTCMinutes()).padStart(2, '0')}`;
};

const getAvailableBookingTimes = (dateString, bookedTimes, now = new Date()) => {
  const toMinutes = time => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return bookingTimes.filter(time => {
    const start = toMinutes(time);
    const overlapsBookedTime = bookedTimes.some(bookedTime => {
      const bookedStart = toMinutes(bookedTime);
      return start < bookedStart + SLOT_DURATION_MINUTES && start + SLOT_DURATION_MINUTES > bookedStart;
    });
    return !overlapsBookedTime && !isPastBookingTime(dateString, time, now);
  });
};

const validateCustomerAppointment = (value, now = new Date()) => {
  if (typeof value !== 'string') return { error: 'Choose an appointment date and time.' };
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { error: 'Choose an available appointment time.' };

  const [, dateString, hourString, minuteString] = match;
  const parsed = parseDate(dateString);
  const time = `${hourString}:${minuteString}`;
  if (!parsed || !bookingTimes.includes(time)) {
    return { error: 'Appointment start times are available every hour from 9:00 a.m. to 4:00 p.m.' };
  }

  const holiday = getPublicHoliday(dateString);
  if (holiday) return { error: `Appointments cannot be booked on ${holiday.name}, a Sri Lankan public holiday.` };

  const appointmentDate = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day, Number(hourString), Number(minuteString))
    - SRI_LANKA_OFFSET_MINUTES * 60_000
  );
  if (appointmentDate.getTime() <= now.getTime()) {
    return { error: 'Choose an appointment time in the future.' };
  }

  return { appointmentDate, date: dateString, time };
};

const isPastBookingTime = (dateString, time, now = new Date()) => `${dateString}T${time}` <= `${getSriLankaDate(now)}T${new Intl.DateTimeFormat('en-GB', {
  timeZone: SRI_LANKA_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
}).format(now)}`;

module.exports = {
  bookingTimes,
  getDayRange,
  getAvailableBookingTimes,
  getPublicHoliday,
  getTimeSlot,
  isPastBookingTime,
  parseDate,
  validateCustomerAppointment
};
