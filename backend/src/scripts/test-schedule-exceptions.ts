import {
    appointmentFitsShift,
    bookingShiftForLocation,
    resolveEffectiveSchedule
} from '../schedule/effective-schedule';

function assert(name: string, condition: boolean): void {
    if (!condition) {
        throw new Error(`FAIL ${name}`);
    }
    console.log(`PASS ${name}`);
}

const regular = {
    startTime: '08:00',
    endTime: '14:00',
    location: { id: 1, name: 'VitaMed Vračar' }
};
const exception = {
    startTime: '14:00',
    endTime: '20:00',
    location: { id: 2, name: 'VitaMed Novi Beograd' }
};
const saturdayException = {
    startTime: '09:00',
    endTime: '13:00',
    location: { id: 1, name: 'VitaMed Vračar' }
};

const caseA = resolveEffectiveSchedule({
    date: '2026-09-23',
    weekday: 3,
    absent: false,
    regular,
    exception: null
});
assert('A regular only', caseA.effective?.startTime === '08:00' && caseA.effective?.location.id === 1 && caseA.effective?.source === 'regular');

const caseB = resolveEffectiveSchedule({
    date: '2026-09-23',
    weekday: 3,
    absent: false,
    regular,
    exception
});
assert('B exception replaces regular', caseB.effective?.startTime === '14:00' && caseB.effective?.location.id === 2 && caseB.effective?.source === 'exception');

const caseC = resolveEffectiveSchedule({
    date: '2026-10-01',
    weekday: 4,
    absent: true,
    absenceReason: 'annual_leave',
    regular,
    exception: null
});
assert('C absence blocks regular', caseC.effective === null && caseC.absent);

const caseD = resolveEffectiveSchedule({
    date: '2026-09-23',
    weekday: 3,
    absent: true,
    absenceReason: 'annual_leave',
    regular,
    exception
});
assert('D absence wins over exception', caseD.effective === null && caseD.absent);

const caseE = resolveEffectiveSchedule({
    date: '2026-09-30',
    weekday: 3,
    absent: false,
    regular,
    exception: null
});
assert('E following week uses regular', caseE.effective?.source === 'regular' && caseE.effective?.startTime === '08:00');

const caseF = resolveEffectiveSchedule({
    date: '2026-09-26',
    weekday: 6,
    absent: false,
    regular: null,
    exception: saturdayException
});
assert('F non-working day exception', caseF.effective?.startTime === '09:00' && caseF.effective?.source === 'exception');

const bookingB = bookingShiftForLocation({
    weekday: 3,
    locationId: 2,
    absent: false,
    regular: { dayOfWeek: 3, startMinutes: 8 * 60, endMinutes: 14 * 60 },
    exception: { locationId: 2, startMinutes: 14 * 60, endMinutes: 20 * 60 }
});
assert('booking uses exception hours', bookingB?.startMinutes === 14 * 60);

const bookingOldLocation = bookingShiftForLocation({
    weekday: 3,
    locationId: 1,
    absent: false,
    regular: { dayOfWeek: 3, startMinutes: 8 * 60, endMinutes: 14 * 60 },
    exception: { locationId: 2, startMinutes: 14 * 60, endMinutes: 20 * 60 }
});
assert('booking ignores old location on exception date', bookingOldLocation === undefined);

const bookingAbsence = bookingShiftForLocation({
    weekday: 3,
    locationId: 2,
    absent: true,
    regular: { dayOfWeek: 3, startMinutes: 8 * 60, endMinutes: 14 * 60 },
    exception: { locationId: 2, startMinutes: 14 * 60, endMinutes: 20 * 60 }
});
assert('booking absence has no slots', bookingAbsence === undefined);

assert(
    'G confirmed appointment outside new hours',
    appointmentFitsShift(
        { startMinutes: 10 * 60, endMinutes: 10 * 60 + 30, locationId: 1 },
        { startMinutes: 14 * 60, endMinutes: 20 * 60, locationId: 1 }
    ) === 'time'
);

assert(
    'H cancelled appointments are ignored by helper usage',
    appointmentFitsShift(
        { startMinutes: 16 * 60, endMinutes: 16 * 60 + 30, locationId: 2 },
        { startMinutes: 14 * 60, endMinutes: 20 * 60, locationId: 2 }
    ) === 'ok'
);

assert(
    'I location conflict',
    appointmentFitsShift(
        { startMinutes: 16 * 60, endMinutes: 16 * 60 + 30, locationId: 1 },
        { startMinutes: 14 * 60, endMinutes: 20 * 60, locationId: 2 }
    ) === 'location'
);

assert(
    'J restore to regular is valid',
    appointmentFitsShift(
        { startMinutes: 9 * 60, endMinutes: 9 * 60 + 30, locationId: 1 },
        { startMinutes: 8 * 60, endMinutes: 14 * 60, locationId: 1 }
    ) === 'ok'
);

assert(
    'K restore blocked by dependent appointment',
    appointmentFitsShift(
        { startMinutes: 16 * 60, endMinutes: 16 * 60 + 30, locationId: 2 },
        { startMinutes: 8 * 60, endMinutes: 14 * 60, locationId: 1 }
    ) === 'location'
);

assert(
    'K restore blocked by time when location matches',
    appointmentFitsShift(
        { startMinutes: 16 * 60, endMinutes: 16 * 60 + 30, locationId: 1 },
        { startMinutes: 8 * 60, endMinutes: 14 * 60, locationId: 1 }
    ) === 'time'
);

console.log('All schedule exception logic cases passed.');
