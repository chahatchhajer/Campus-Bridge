import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, PageHeader, StageBadge, usePageTitle } from '../components/ui/Bits';
import { EmptyState, ErrorState, SkeletonCard } from '../components/ui/Feedback';
import { ROUND_LABEL } from '../lib/constants';
import { formatMonthYear, formatTime, parseDateOnly, relativeDay, toDateInput, todayInput } from '../lib/format';
import { useCalendar } from '../lib/queries';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type DayEvents = {
  interviews: { id: string; applicationId: string; company: string; roundType: keyof typeof ROUND_LABEL; scheduledAt: string }[];
  deadlines: { id: string; company: string; jobTitle: string; stage: Parameters<typeof StageBadge>[0]['stage']; deadline: string }[];
};

export function CalendarPage() {
  usePageTitle('Calendar');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  // Full weeks covering the month (Monday-first).
  const { gridStart, gridEnd, days } = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const endOffset = 6 - ((last.getDay() + 6) % 7);
    const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + endOffset);
    const list: Date[] = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) list.push(d);
    return { gridStart: start, gridEnd: end, days: list };
  }, [cursor]);

  const { data, isLoading, error, refetch, isFetching } = useCalendar(toDateInput(gridStart), toDateInput(gridEnd));
  const today = todayInput();

  const byDay = useMemo(() => {
    const m = new Map<string, DayEvents>();
    const slot = (k: string) => {
      if (!m.has(k)) m.set(k, { interviews: [], deadlines: [] });
      return m.get(k)!;
    };
    data?.interviews.forEach((i) => slot(toDateInput(new Date(i.scheduledAt))).interviews.push(i));
    data?.deadlines.forEach((d) => slot(d.deadline).deadlines.push(d));
    return m;
  }, [data]);

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const inMonth = (d: Date) => monthKey(d) === monthKey(cursor);
  const monthDays = days.filter(inMonth).map(toDateInput);
  const agendaDays = (selected ? [selected] : monthDays).filter((k) => {
    const e = byDay.get(k);
    return e && (e.interviews.length || e.deadlines.length);
  });
  const totalEvents = monthDays.reduce((n, k) => n + (byDay.get(k)?.interviews.length ?? 0) + (byDay.get(k)?.deadlines.length ?? 0), 0);

  const go = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
    setSelected(null);
  };

  return (
    <>
      <PageHeader title="Calendar" description="Interview rounds and application deadlines in one place." />

      <div className="cal-toolbar">
        <h2 aria-live="polite">{formatMonthYear(cursor)}</h2>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <Button size="sm" variant="secondary" onClick={() => go(-1)} aria-label="Previous month">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
              setSelected(null);
            }}
          >
            Today
          </Button>
          <Button size="sm" variant="secondary" onClick={() => go(1)} aria-label="Next month">
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={refetch} title="Could not load the calendar" />
        </div>
      ) : isLoading ? (
        <SkeletonCard h={360} label="Loading calendar" />
      ) : (
        <div className="stack" aria-busy={isFetching}>
          <div className="card cal" role="group" aria-label={`Calendar for ${formatMonthYear(cursor)}`}>
            <div className="cal__head" aria-hidden="true">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="cal__grid">
              {days.map((d) => {
                const key = toDateInput(d);
                const e = byDay.get(key);
                const nI = e?.interviews.length ?? 0;
                const nD = e?.deadlines.length ?? 0;
                const label = `${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${nI ? `, ${nI} ${nI === 1 ? 'interview' : 'interviews'}` : ''}${nD ? `, ${nD} ${nD === 1 ? 'deadline' : 'deadlines'}` : ''}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={['cal__day', !inMonth(d) && 'cal__day--out', key === today && 'cal__day--today', key === selected && 'cal__day--selected'].filter(Boolean).join(' ')}
                    aria-label={label}
                    aria-pressed={key === selected}
                    onClick={() => setSelected(key === selected ? null : key)}
                  >
                    <span className="cal__num">{d.getDate()}</span>
                    <span className="cal__events" aria-hidden="true">
                      {e?.interviews.slice(0, 2).map((i) => (
                        <span key={i.id} className="cal__chip cal__chip--interview">
                          {formatTime(i.scheduledAt)} {i.company}
                        </span>
                      ))}
                      {e?.deadlines.slice(0, Math.max(0, 2 - nI)).map((x) => (
                        <span key={x.id} className="cal__chip cal__chip--deadline">
                          Due {x.company}
                        </span>
                      ))}
                      {nI + nD > 2 && <span className="cal__more">+{nI + nD - 2} more</span>}
                      <span className="cal__dots">
                        {nI > 0 && <i className="cal__dot cal__dot--interview" />}
                        {nD > 0 && <i className="cal__dot cal__dot--deadline" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="cal__legend">
              <span>
                <i className="cal__dot cal__dot--interview" /> Interview
              </span>
              <span>
                <i className="cal__dot cal__dot--deadline" /> Deadline
              </span>
            </div>
          </div>

          <Card
            title={selected ? parseDateOnly(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : `Agenda for ${formatMonthYear(cursor)}`}
            subtitle={selected ? undefined : `${totalEvents} ${totalEvents === 1 ? 'event' : 'events'} this month`}
            action={
              selected && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  Show whole month
                </Button>
              )
            }
            flush
          >
            {agendaDays.length === 0 ? (
              <EmptyState compact icon={CalendarDays} title={selected ? 'Nothing on this day' : 'Nothing scheduled this month'} text="Interview rounds and deadlines you add to applications appear here." />
            ) : (
              <ul>
                {agendaDays.map((k) => {
                  const e = byDay.get(k)!;
                  return (
                    <li key={k} className="agenda-day">
                      <div className="agenda-day__date">
                        <strong>{parseDateOnly(k).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                        <span className="muted">{relativeDay(k)}</span>
                      </div>
                      <ul className="agenda-day__items">
                        {e.interviews.map((i) => (
                          <li key={i.id}>
                            <Link to={`/applications/${i.applicationId}`} className="agenda-item">
                              <i className="cal__dot cal__dot--interview" aria-hidden="true" />
                              <span className="agenda-item__main truncate">
                                <strong>{i.company}</strong> · {ROUND_LABEL[i.roundType]} round
                              </span>
                              <span className="muted tnum">{formatTime(i.scheduledAt)}</span>
                            </Link>
                          </li>
                        ))}
                        {e.deadlines.map((d) => (
                          <li key={d.id}>
                            <Link to={`/applications/${d.id}`} className="agenda-item">
                              <i className="cal__dot cal__dot--deadline" aria-hidden="true" />
                              <span className="agenda-item__main truncate">
                                <strong>{d.company}</strong> · deadline
                              </span>
                              <StageBadge stage={d.stage} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
