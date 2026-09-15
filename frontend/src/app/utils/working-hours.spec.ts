import { getOpeningStatus } from './working-hours';

const HOURS = 'Pon–Pet: 07:00–21:00, Sub: 08:00–15:00';

function at(year: number, month: number, day: number, hours: number, minutes: number): Date {
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

describe('getOpeningStatus', () => {
  it('is closed on a weekday before 07:00 and shows today\'s opening time', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 14, 6, 59));
    expect(status.state).toBe('closed');
    expect(status.label).toBe('Zatvoreno');
    expect(status.nextOpenLabel).toBe('Otvara se u 07:00');
  });

  it('is open on a weekday between 07:00 and 21:00', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 14, 7, 0));
    expect(status.state).toBe('open');
    expect(status.label).toBe('Otvoreno');
    expect(status.nextOpenLabel).toBeNull();
  });

  it('is still open at 20:59 on a weekday', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 14, 20, 59));
    expect(status.state).toBe('open');
  });

  it('is closed at 21:00 on a weekday', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 14, 21, 0));
    expect(status.state).toBe('closed');
    expect(status.nextOpenLabel).toBe('Otvara se u utorak u 07:00');
  });

  it('is closed on Saturday before 08:00', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 19, 7, 59));
    expect(status.state).toBe('closed');
    expect(status.nextOpenLabel).toBe('Otvara se u 08:00');
  });

  it('is open on Saturday between 08:00 and 15:00', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 19, 8, 0));
    expect(status.state).toBe('open');
  });

  it('is still open at 14:59 on Saturday', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 19, 14, 59));
    expect(status.state).toBe('open');
  });

  it('is closed at 15:00 on Saturday and opens Monday', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 19, 15, 0));
    expect(status.state).toBe('closed');
    expect(status.nextOpenLabel).toBe('Otvara se u ponedeljak u 07:00');
  });

  it('is closed on Sunday', () => {
    const status = getOpeningStatus(HOURS, at(2026, 9, 13, 12, 0));
    expect(status.state).toBe('closed');
    expect(status.label).toBe('Zatvoreno');
    expect(status.nextOpenLabel).toBe('Otvara se u ponedeljak u 07:00');
  });

  it('does not claim open for missing or unexpected hours', () => {
    expect(getOpeningStatus('', at(2026, 9, 14, 10, 0)).state).toBe('unknown');
    expect(getOpeningStatus('nije uneto', at(2026, 9, 14, 10, 0)).label).toBe(
      'Radno vreme nije dostupno'
    );
  });
});
