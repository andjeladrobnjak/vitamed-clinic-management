export type OpeningState = 'open' | 'closed' | 'unknown';

export type OpeningStatus = {
  state: OpeningState;
  label: string;
  nextOpenLabel: string | null;
};

const DAY_INDEX: Record<string, number> = {
  ned: 0,
  pon: 1,
  uto: 2,
  sre: 3,
  cet: 4,
  pet: 5,
  sub: 6
};

const DAY_NAME_SR: Record<number, string> = {
  0: 'nedelju',
  1: 'ponedeljak',
  2: 'utorak',
  3: 'sredu',
  4: 'četvrtak',
  5: 'petak',
  6: 'subotu'
};

type DayHours = {
  start: number;
  end: number;
};

export function getOpeningStatus(
  workingHours: string | null | undefined,
  now: Date = new Date()
): OpeningStatus {
  const schedule = parseWorkingHours(workingHours);
  if (!schedule) {
    return {
      state: 'unknown',
      label: 'Radno vreme nije dostupno',
      nextOpenLabel: null
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayHours = schedule.get(now.getDay());
  const isOpen = Boolean(
    todayHours && currentMinutes >= todayHours.start && currentMinutes < todayHours.end
  );

  if (isOpen) {
    return {
      state: 'open',
      label: 'Otvoreno',
      nextOpenLabel: null
    };
  }

  return {
    state: 'closed',
    label: 'Zatvoreno',
    nextOpenLabel: nextOpeningLabel(schedule, now, currentMinutes)
  };
}

export function parseWorkingHours(
  workingHours: string | null | undefined
): Map<number, DayHours> | null {
  if (!workingHours?.trim()) {
    return null;
  }

  const schedule = new Map<number, DayHours>();
  const segments = workingHours.split(',').map((segment) => segment.trim()).filter(Boolean);

  for (const segment of segments) {
    const parsed = parseHoursSegment(segment);
    if (!parsed) {
      continue;
    }

    for (const day of parsed.days) {
      schedule.set(day, { start: parsed.start, end: parsed.end });
    }
  }

  return schedule.size > 0 ? schedule : null;
}

function parseHoursSegment(segment: string): { days: number[]; start: number; end: number } | null {
  const match = segment
    .replace(/\u2013|\u2014/g, '-')
    .match(/^(.+?):\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);

  if (!match) {
    return null;
  }

  const days = parseDayToken(match[1]);
  const start = parseMinutes(match[2]);
  const end = parseMinutes(match[3]);
  if (!days.length || start === null || end === null || end <= start) {
    return null;
  }

  return { days, start, end };
}

function parseDayToken(token: string): number[] {
  const normalized = token.replace(/\u2013|\u2014/g, '-').trim();
  const range = normalized.split('-').map((part) => part.trim()).filter(Boolean);
  if (range.length === 1) {
    const day = dayIndexFromLabel(range[0]);
    return day === null ? [] : [day];
  }

  if (range.length !== 2) {
    return [];
  }

  const from = dayIndexFromLabel(range[0]);
  const to = dayIndexFromLabel(range[1]);
  if (from === null || to === null) {
    return [];
  }

  const days: number[] = [];
  let current = from;
  for (let step = 0; step < 7; step += 1) {
    days.push(current);
    if (current === to) {
      return days;
    }
    current = (current + 1) % 7;
  }

  return [];
}

function dayIndexFromLabel(label: string): number | null {
  const key = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 3);
  return Object.prototype.hasOwnProperty.call(DAY_INDEX, key) ? DAY_INDEX[key] : null;
}

function parseMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function nextOpeningLabel(
  schedule: Map<number, DayHours>,
  now: Date,
  currentMinutes: number
): string | null {
  const todayHours = schedule.get(now.getDay());
  if (todayHours && currentMinutes < todayHours.start) {
    return `Otvara se u ${formatClock(todayHours.start)}`;
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const day = (now.getDay() + offset) % 7;
    const hours = schedule.get(day);
    if (!hours) {
      continue;
    }

    return `Otvara se u ${DAY_NAME_SR[day]} u ${formatClock(hours.start)}`;
  }

  return null;
}

function formatClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
