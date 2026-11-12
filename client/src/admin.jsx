import { useState } from 'react';
import { toast } from 'sonner';
import { search, useAction, useData } from './api';
import { Form, Mutate } from './forms';
import { Button, date, label, Pager, Result, Title } from './ui';

export function AdminOverview() {
  const query = useData('/admin/dashboard');
  return (
    <>
      <Title label="Administration" title="Platform Overview" />
      <Result query={query}>
        {(data) => (
          <>
            <div className="grid three">
              {Object.entries(data.counts).map(([name, count]) => (
                <article className="card" key={name}>
                  <h3>{name}</h3>
                  <strong className="stat">{count}</strong>
                </article>
              ))}
            </div>
            <div className="grid two">
              {data.series.map((series, index) => (
                <article className="card" key={index}>
                  <h3>
                    {
                      [
                        'User Registrations',
                        'Startup Registrations',
                        'New Opportunities',
                        'New Connections',
                      ][index]
                    }
                  </h3>
                  <p className="meta">Last 30 days</p>
                  {series.length ? (
                    <div className="chart">
                      {series.map(({ _id, total }) => (
                        <div key={_id}>
                          <span>{_id.slice(5)}</span>
                          <meter
                            min={0}
                            max={Math.max(...series.map((row) => row.total))}
                            value={total}
                            aria-label={_id}
                          />
                          <strong>{total}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No activity in this period.</p>
                  )}
                </article>
              ))}
            </div>
          </>
        )}
      </Result>
    </>
  );
}
const sections = {
  users: ['Users', 'users'],
  startups: ['Startups', 'startups'],
  verifications: ['Startup Verification', 'startups/pending'],
  opportunities: ['Projects & Challenges', 'opportunities'],
  reports: ['Reports', 'reports'],
  categories: ['Categories', 'categories'],
  'audit-logs': ['Audit Logs', 'audit-logs'],
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
  return (
    <article className="card list-row">
      <div>
        <h3>{row.name || row.fullName || row.title || row.reason || row.action}</h3>
        <p className="meta">
          {[row.role, row.type, row.industry, status, row.reportedEntityType, row.entityType]
            .filter(Boolean)
            .map(label)
            .join(' · ')}{' '}
          · {date(row.createdAt)}
        </p>
        <p>{row.email || row.description}</p>
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
                {(item) => (
                  <p className="preserve">
                    {item.missing
                      ? 'This record was removed.'
                      : item.body ||
                        [item.name || item.title, item.description].filter(Boolean).join(' · ')}
                  </p>
                )}
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
  const [title, endpoint] = sections[section];
  const [page, setPage] = useState(1);
  const query = useData(search('/admin/' + endpoint, { page }));
  const action = useAction();
  return (
    <>
      <Title title={title} />
      {section === 'categories' && (
        <article className="card">
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
            <div className="stack">
              {data.items.map((row) => (
                <AdminRow key={row._id} row={row} section={section} />
              ))}
            </div>
            <Pager data={data} page={page} onPage={setPage} />
          </>
        )}
      </Result>
    </>
  );
}
