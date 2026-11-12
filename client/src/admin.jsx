import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Flag,
  GraduationCap,
  History,
  Layers,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Tags,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { search, useAction, useData } from './api';
import { Form, Mutate } from './forms';
import { VideoPlayer } from './videos';
import { Button, date, label, Pager, Result, StartupMark } from './ui';
import { AccountSettings } from './workspace';

function AdminHeading({ title, description, icon: _Icon = ShieldCheck }) {
  return (
    <header className="admin-page-heading">
      <span className="admin-heading-icon">
        <_Icon size={28} aria-hidden="true" />
      </span>
      <div>
        <p className="eyebrow">Admin Workspace</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}

const metrics = [
  ['Graduates', 'Graduates', 'Registered talent', GraduationCap],
  ['Startups', 'Startups', 'Total startups', Building2],
  ['Verified startups', 'Verified Startups', 'Approved profiles', ShieldCheck],
  ['Active projects', 'Active Projects', 'Ongoing projects', Layers],
  ['Accepted connections', 'Connections', 'Talent–startup matches', UsersRound],
];
const activityColors = ['#0b347c', '#ffab00'];
const chartDate = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function ActivityChart({ series, through }) {
  const [days, setDays] = useState(30);
  const chart = useRef(null);
  useEffect(() => {
    const canvas = chart.current;
    const context = canvas.getContext('2d');
    if (!context) return;
    const end = new Date(through + 'T00:00:00Z');
    const dates = Array.from({ length: days }, (_, index) => {
      const day = new Date(end);
      day.setUTCDate(end.getUTCDate() - days + index + 1);
      return day;
    });
    const lines = series.slice(0, 2).map((rows) => {
      const totals = new Map(rows.map((row) => [row._id, row.total]));
      return dates.map((day) => totals.get(day.toISOString().slice(0, 10)) || 0);
    });
    const roughStep = Math.max(1, Math.max(...lines.flat()) / 4);
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const step = [1, 2, 5, 10].find((value) => value * magnitude >= roughStep) * magnitude;
    const maximum = step * 4;

    function draw() {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.scale(scale, scale);
      const left = 38;
      const right = width - 19;
      const top = 11;
      const bottom = height - 27;
      const x = (index) => left + (index / (days - 1)) * (right - left);
      const y = (value) => bottom - (value / maximum) * (bottom - top);
      context.font = '13px Inter, system-ui, sans-serif';
      context.textBaseline = 'middle';
      context.fillStyle = '#203553';
      context.strokeStyle = '#e8edf4';
      context.textAlign = 'right';
      for (let tick = 0; tick <= maximum; tick += step) {
        context.beginPath();
        context.moveTo(left, y(tick));
        context.lineTo(right, y(tick));
        context.stroke();
        context.fillText(tick, left - 10, y(tick));
      }
      const tickCount = width < 340 ? 4 : 6;
      context.textAlign = 'center';
      for (let tick = 0; tick < tickCount; tick += 1) {
        const index = Math.round((tick / (tickCount - 1)) * (days - 1));
        context.fillText(chartDate.format(dates[index]), x(index), bottom + 16);
      }
      lines.forEach((values, line) => {
        const outline = new Path2D();
        outline.moveTo(x(0), y(values[0]));
        for (let index = 1; index < values.length; index += 1) {
          const midpoint = (x(index - 1) + x(index)) / 2;
          outline.bezierCurveTo(
            midpoint,
            y(values[index - 1]),
            midpoint,
            y(values[index]),
            x(index),
            y(values[index]),
          );
        }
        const area = new Path2D(outline);
        area.lineTo(right, bottom);
        area.lineTo(left, bottom);
        area.closePath();
        const gradient = context.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, activityColors[line] + '65');
        gradient.addColorStop(1, activityColors[line] + '06');
        context.fillStyle = gradient;
        context.fill(area);
        context.strokeStyle = activityColors[line];
        context.lineWidth = 2.5;
        context.stroke(outline);
      });
    }

    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    return () => resize.disconnect();
  }, [series, through, days]);

  const totals = series.slice(0, 2).map((rows) =>
    rows.reduce((total, row) => {
      const elapsed = (Date.parse(through) - Date.parse(row._id)) / 86400000;
      return elapsed >= 0 && elapsed < days ? total + row.total : total;
    }, 0),
  );
  return (
    <section className="admin-overview-panel admin-activity">
      <header>
        <h2>
          <TrendingUp aria-hidden="true" /> Platform Activity
        </h2>
        <select
          aria-label="Activity period"
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          {[7, 14, 30].map((value) => (
            <option key={value} value={value}>
              Last {value} Days
            </option>
          ))}
        </select>
      </header>
      <canvas
        ref={chart}
        role="img"
        aria-label={`Daily registrations over ${days} days. ${totals[0]} new users and ${totals[1]} new startups in total.`}
      />
      <div className="admin-chart-key">
        <span>New Users</span>
        <span>New Startups</span>
      </div>
    </section>
  );
}

function PanelLink({ to }) {
  return (
    <Link className="admin-panel-link" to={to}>
      View All <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

function StartupSummary({ item, verified = false }) {
  return (
    <div className="admin-startup-summary">
      <StartupMark item={item} />
      <span>
        <strong>
          {item.name} {verified && <BadgeCheck size={17} aria-label="Verified" />}
        </strong>
        <small>{item.industry}</small>
      </span>
    </div>
  );
}

function VerificationRequests({ items }) {
  const statuses = { pending: 'Pending', verified: 'Approved', rejected: 'Rejected' };
  return (
    <section className="admin-overview-panel admin-verification">
      <header>
        <h2>
          <ShieldCheck aria-hidden="true" /> Recent Verification Requests
        </h2>
        <PanelLink to="/admin/verifications" />
      </header>
      <div className="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Startup</th>
              <th>Founder</th>
              <th>Submitted</th>
              <th>Status</th>
              <th aria-label="Review" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const founder = item.founders?.[0];
              return (
                <tr key={item._id}>
                  <td>
                    <StartupSummary item={item} />
                  </td>
                  <td>
                    <span className="admin-founder">
                      {founder && <span aria-hidden="true">{founder.slice(0, 1)}</span>}
                      {founder || '—'}
                    </span>
                  </td>
                  <td>
                    <time dateTime={item.createdAt}>{date(item.createdAt)}</time>
                  </td>
                  <td>
                    <span className="admin-overview-status" data-status={item.verificationStatus}>
                      {statuses[item.verificationStatus]}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="admin-row-link"
                      to={`/admin/startups?startup=${item._id}`}
                      aria-label={`Review ${item.name}`}
                    >
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5}>No verification requests yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function downloadOverview(counts) {
  const report = [
    'Metric,Count',
    ...Object.entries(counts).map(([name, count]) => `${name},${count}`),
  ];
  const url = URL.createObjectURL(
    new Blob([report.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'startlink-platform-overview.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AdminOverview() {
  const query = useData('/admin/dashboard');
  return (
    <div className="dashboard admin-dashboard">
      <header className="admin-overview-hero">
        <p className="eyebrow">Admin Workspace</p>
        <h1>Platform Overview</h1>
        <p>Track registrations, verify startups, manage projects, and monitor platform growth.</p>
      </header>
      <Result query={query}>
        {(data) => (
          <>
            <div className="admin-overview-metrics">
              {metrics.map(([key, title, description, _Icon]) => {
                const growth = data.growth?.[key];
                return (
                  <article className="admin-overview-metric" key={key}>
                    <span className="admin-overview-tile">
                      <_Icon aria-hidden="true" />
                    </span>
                    <div>
                      <h2>{title}</h2>
                      <div className="admin-metric-value">
                        <strong>{data.counts[key].toLocaleString()}</strong>
                        {growth != null && (
                          <span
                            data-decline={growth < 0}
                            title="Records created in the last 30 days compared with the prior 30 days"
                          >
                            {growth >= 0 ? '↑ +' : '↓ '}
                            {growth}%
                          </span>
                        )}
                      </div>
                      <p>{description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="admin-overview-panels">
              <VerificationRequests items={data.verificationRequests} />
              <ActivityChart series={data.series} through={data.activityThrough} />
              <section className="admin-overview-panel">
                <header>
                  <h2>
                    <Building2 aria-hidden="true" /> Recent Startups
                  </h2>
                  <PanelLink to="/admin/startups" />
                </header>
                <div className="admin-recent-startups">
                  {data.recentStartups.map((item) => (
                    <Link key={item._id} to={`/admin/startups?startup=${item._id}`}>
                      <StartupSummary
                        item={item}
                        verified={item.verificationStatus === 'verified'}
                      />
                    </Link>
                  ))}
                  {data.recentStartups.length === 0 && <p>No startups yet.</p>}
                </div>
              </section>
              <section className="admin-overview-panel">
                <header>
                  <h2>
                    <Zap aria-hidden="true" /> Quick Actions
                  </h2>
                </header>
                <div className="admin-quick-actions">
                  <Link to="/admin/verifications">
                    <span>
                      <ShieldCheck aria-hidden="true" />
                    </span>
                    Verify Startup
                  </Link>
                  <Link to="/admin/opportunities">
                    <span>
                      <Layers aria-hidden="true" />
                    </span>
                    Manage Projects
                  </Link>
                  <Link to="/admin/users">
                    <span>
                      <UsersRound aria-hidden="true" />
                    </span>
                    Manage Users
                  </Link>
                  <button type="button" onClick={() => downloadOverview(data.counts)}>
                    <span>
                      <BarChart3 aria-hidden="true" />
                    </span>
                    Generate Report
                  </button>
                </div>
              </section>
            </div>
          </>
        )}
      </Result>
    </div>
  );
}
const sections = {
  users: ['Users', 'users', UsersRound, 'Review accounts and manage access to the platform.'],
  startups: [
    'Startups',
    'startups',
    Building2,
    'Review startup profiles and their verification status.',
  ],
  verifications: [
    'Startup Verification',
    'startups/pending',
    BadgeCheck,
    'Review startups waiting for approval.',
  ],
  opportunities: [
    'Projects & Challenges',
    'opportunities',
    Layers,
    'Moderate project and challenge listings.',
  ],
  reports: ['Reports', 'reports', Flag, 'Inspect reported content and resolve moderation cases.'],
  categories: ['Categories', 'categories', Tags, 'Organize listings with platform categories.'],
  'audit-logs': [
    'Audit Logs',
    'audit-logs',
    History,
    'Review administrative actions recorded by STARTLINK.',
  ],
};
function AdminRow({ section, row }) {
  const mutation = (path, data, text, confirm) => (
    <Mutate path={'/admin/' + path} method="patch" data={data} confirm={confirm}>
      {text}
    </Mutate>
  );
  const [inspect, setInspect] = useState(false);
  const content = useData(
    '/admin/reports/' + row._id + '/content',
    section === 'reports' && inspect,
  );
  const startup = ['startups', 'verifications'].includes(section);
  const verify = (status, text) =>
    mutation(
      'startups/' + row._id + '/verification',
      { verificationStatus: status },
      text,
      'Change verification status?',
    );
  const status = row.verificationStatus || row.status;
  const Icon = sections[section][2];
  const meta = [row.role, row.type, row.industry, row.reportedEntityType, row.entityType]
    .filter(Boolean)
    .map(label)
    .concat(row.createdAt ? [date(row.createdAt)] : [])
    .join(' · ');
  return (
    <article className="card admin-record">
      <span className="admin-record-icon">
        <Icon size={21} aria-hidden="true" />
      </span>
      <div className="admin-record-content">
        <div className="admin-record-title">
          <h3>{row.name || row.fullName || row.title || row.reason || row.action}</h3>
          {status && (
            <span className="admin-record-status" data-status={status}>
              {label(status)}
            </span>
          )}
        </div>
        {meta && <p className="meta">{meta}</p>}
        {(row.email || row.description) && <p>{row.email || row.description}</p>}
        {row.reportedEntityId && (
          <>
            <p>
              Record ID <code>{row.reportedEntityId}</code>
            </p>
            <Button variant="outline" aria-expanded={inspect} onClick={() => setInspect(!inspect)}>
              {inspect ? 'Close Preview' : 'Inspect Content'}
            </Button>
            {inspect && (
              <Result query={content}>
                {(item) =>
                  item.video ? (
                    <VideoPlayer video={item.video} title="Reported video" />
                  ) : (
                    <p className="preserve">
                      {item.missing
                        ? 'This record was removed.'
                        : item.body ||
                          [item.name || item.title, item.description].filter(Boolean).join(' · ')}
                    </p>
                  )
                }
              </Result>
            )}
          </>
        )}
        {row.actorId && (
          <p>
            Administrator <code>{row.actorId}</code>
          </p>
        )}
        {row.metadata && <pre>{JSON.stringify(row.metadata, null, 2)}</pre>}
      </div>
      <div className="actions">
        {section === 'users' &&
          row.role !== 'admin' &&
          mutation(
            'users/' + row._id + '/status',
            { status: status === 'active' ? 'suspended' : 'active' },
            status === 'active' ? 'Suspend' : 'Reactivate',
            'Change account access?',
          )}
        {startup && (
          <>
            {status !== 'verified' && verify('verified', 'Approve')}
            {status !== 'rejected' && verify('rejected', 'Reject')}
            {status !== 'pending' && verify('pending', 'Return to Review')}
          </>
        )}
        {section === 'opportunities' &&
          mutation(
            'opportunities/' + row._id + '/status',
            { status: status === 'hidden' ? 'draft' : 'hidden' },
            status === 'hidden' ? 'Restore to Draft' : 'Hide',
            'Change opportunity visibility?',
          )}
        {section === 'reports' && status === 'pending' && (
          <>
            {mutation('reports/' + row._id, { status: 'resolved' }, 'Resolve')}
            {mutation('reports/' + row._id, { status: 'dismissed' }, 'Dismiss')}
            {mutation(
              'reports/' + row._id,
              { status: 'resolved', hide: true },
              'Hide and Resolve',
              'Hide the reported content?',
            )}
          </>
        )}
        {section === 'categories' && (
          <Mutate
            method="delete"
            path={'/admin/categories/' + row._id}
            confirm="Delete this category?"
          >
            Delete
          </Mutate>
        )}
      </div>
    </article>
  );
}
export function AdminSection({ section }) {
  const [title, endpoint, Icon, description] = sections[section];
  const [page, setPage] = useState(1);
  const [params] = useSearchParams();
  const startup = section === 'startups' ? params.get('startup') || undefined : undefined;
  const query = useData(search('/admin/' + endpoint, { page: startup ? 1 : page, startup }));
  const action = useAction();
  return (
    <div className="admin-page">
      <AdminHeading title={title} description={description} icon={Icon} />
      {startup && (
        <Button variant="outline" to="/admin/startups">
          View All Startups
        </Button>
      )}
      {section === 'categories' && (
        <article className="card admin-form-card">
          <h2>Add a Category</h2>
          <Form
            submit="Add Category"
            fields={[{ name: 'name', label: 'Category name', required: true }]}
            onSubmit={async (data) => {
              await action.mutateAsync({ path: '/admin/categories', data });
              toast.success('Category added.');
            }}
          />
        </article>
      )}
      <Result query={query} empty="No records in this section.">
        {(data) => (
          <>
            <div className="stack admin-records">
              {data.items.map((row) => (
                <AdminRow key={row._id} row={row} section={section} />
              ))}
            </div>
            {!startup && <Pager data={data} page={page} onPage={setPage} />}
          </>
        )}
      </Result>
    </div>
  );
}

export function AdminSettings() {
  return (
    <div className="admin-page admin-settings">
      <AdminHeading
        title="Account Settings"
        description="Manage the password for your administrator account."
        icon={Settings}
      />
      <div className="admin-settings-content">
        <AccountSettings showTitle={false} />
      </div>
    </div>
  );
}
