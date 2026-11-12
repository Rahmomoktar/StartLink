import { ArrowRight, ArrowUpRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from './api';
import { Button, date, label, Result } from './ui';

function Panel({ title, to, action = 'View all', children }) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-heading">
        <h2>{title}</h2>
        <Link to={to}>
          {action} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function DashboardList({ query, empty, describe }) {
  return (
    <Result query={query} empty={empty}>
      {(data) => (
        <ul className="dashboard-list">
          {(data.items ?? data).slice(0, 4).map((row) => {
            const { id, to, title, detail, status } = describe(row);
            return (
              <li key={id}>
                <Link to={to} className="dashboard-row">
                  <span>
                    <strong>{title}</strong>
                    {detail && <small>{detail}</small>}
                  </span>
                  {status && <span className="dashboard-status">{status}</span>}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Result>
  );
}

export function Overview({ user }) {
  const graduate = user.role === 'graduate';
  const root = '/' + user.role;
  const profile = useData(graduate ? '/graduates/me' : '/startups/mine');
  const applications = useData('/applications');
  const activity = useData('/startups/activity', !graduate);
  const submissions = useData('/submissions', graduate);
  const connections = useData('/connections', graduate);
  const messages = useData('/conversations');
  const notifications = useData('/notifications');
  const matches = useData(graduate ? '/matches/opportunities' : '/matches/graduates');
  const listings = useData(graduate ? '/matches/startups' : '/opportunities/mine');
  const company = graduate ? null : profile.data?.[0];
  const percent = graduate
    ? profile.data?.profileCompletion
    : company
      ? Math.round(
          (100 *
            [
              'name',
              'description',
              'industry',
              'location',
              'website',
              'logo',
              'requiredSkills',
              'founders',
            ].filter((key) => company[key]?.length).length) /
            8,
        )
      : 0;
  const metrics = graduate
    ? [
        ['Applications', applications.data?.total, applications, '/applications'],
        ['Challenge submissions', submissions.data?.total, submissions, '/applications'],
        [
          'Connections',
          connections.data?.filter((row) => row.status === 'accepted').length,
          connections,
          '/connections',
        ],
        ['Unread notifications', notifications.data?.unread, notifications, '/notifications'],
      ]
    : [
        ['Active projects', activity.data?.projects, activity, '/opportunities'],
        ['Active challenges', activity.data?.challenges, activity, '/opportunities'],
        ['Applications received', applications.data?.total, applications, '/applications'],
        ['Completed collaborations', activity.data?.completed, activity, '/applications'],
      ];
  const recentApplications = (
    <Panel title="Recent applications" to={root + '/applications'}>
      <DashboardList
        query={applications}
        empty="No applications yet."
        describe={(row) => ({
          id: row._id,
          to: root + '/applications',
          title: (!graduate && row.applicant) || row.opportunityId?.title || 'Project application',
          detail: !graduate && row.applicant ? row.opportunityId?.title : date(row.createdAt),
          status: label(row.status),
        })}
      />
    </Panel>
  );
  return (
    <div className="dashboard">
      <header className="dashboard-heading">
        <div>
          <h1>{graduate ? 'Career overview' : 'Startup overview'}</h1>
          <p>{company?.name || user.fullName}</p>
        </div>
        <div className="actions">
          {graduate ? (
            <Button to="/opportunities">
              Browse opportunities <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : (
            <>
              <Button to="/startup/opportunities/new">
                <Plus size={17} aria-hidden="true" /> Post a project
              </Button>
              <Button to="/startup/opportunities/new?type=challenge" variant="outline">
                Create a challenge
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="dashboard-metrics">
        {metrics.map(([title, value, query, path]) => (
          <Link key={title} className="dashboard-metric" to={root + path}>
            <span>{title}</span>
            <strong>{query.isError ? 'Unavailable' : (value ?? '…')}</strong>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-column">
          {graduate ? (
            recentApplications
          ) : (
            <Panel
              title="Projects and challenges"
              to={root + '/opportunities'}
              action="Manage listings"
            >
              <DashboardList
                query={listings}
                empty="Your projects and challenges will appear here."
                describe={(item) => ({
                  id: item._id,
                  to: root + '/opportunities/' + item._id + '/edit',
                  title: item.title,
                  detail: label(item.type),
                  status: label(item.status),
                })}
              />
            </Panel>
          )}
          <Panel
            title={graduate ? 'Recommended opportunities' : 'Recommended graduates'}
            to={root + '/matches'}
            action="View matches"
          >
            <DashboardList
              query={matches}
              empty="No recommendations yet."
              describe={({ item, score }) => ({
                id: item._id,
                to: graduate ? '/opportunities/' + item._id : '/talent/' + item.userId?._id,
                title: item.title || item.userId?.fullName,
                detail: graduate ? label(item.type) : item.headline,
                status: Number.isFinite(score) ? score + '% match' : undefined,
              })}
            />
          </Panel>
          {graduate ? (
            <>
              <Panel title="Challenge submissions" to={root + '/applications'}>
                <DashboardList
                  query={submissions}
                  empty="No challenge submissions yet."
                  describe={(row) => ({
                    id: row._id,
                    to: root + '/applications',
                    title: row.challengeId?.title || 'Challenge submission',
                    detail: date(row.createdAt),
                    status: label(row.reviewStatus),
                  })}
                />
              </Panel>
              <Panel title="Recommended startups" to="/discover-startups" action="Explore startups">
                <DashboardList
                  query={listings}
                  empty="No startup recommendations yet."
                  describe={({ item }) => ({
                    id: item._id,
                    to: '/startups/' + item.slug,
                    title: item.name,
                    detail: item.industry,
                  })}
                />
              </Panel>
            </>
          ) : (
            recentApplications
          )}
        </div>
        <div className="dashboard-column">
          <Panel
            title={graduate ? 'Your profile' : 'Company profile'}
            to={root + '/profile/edit'}
            action="Edit"
          >
            <div className="dashboard-profile">
              <div>
                <span>Profile completion</span>
                <strong>
                  {profile.isError
                    ? 'Unavailable'
                    : profile.isPending || percent === undefined
                      ? '…'
                      : percent + '%'}
                </strong>
              </div>
              {profile.isSuccess && percent !== undefined && (
                <progress value={percent} max={100} aria-label="Profile completion" />
              )}
              {company && <p>Verification status · {label(company.verificationStatus)}</p>}
            </div>
          </Panel>
          <Panel title="Messages" to={root + '/messages'}>
            <DashboardList
              query={messages}
              empty="No conversations yet."
              describe={(item) => ({
                id: item._id,
                to: root + '/messages?conversation=' + item._id,
                title: item.other.fullName,
                detail: date(item.lastMessageAt),
                status: item.unread ? item.unread + ' unread' : undefined,
              })}
            />
          </Panel>
          <Panel title="Notifications" to={root + '/notifications'}>
            <DashboardList
              query={notifications}
              empty="No notifications yet."
              describe={(item) => ({
                id: item._id,
                to: root + '/notifications',
                title: item.title,
                detail: date(item.createdAt),
                status: item.readAt ? undefined : 'New',
              })}
            />
          </Panel>
          <Link
            className="dashboard-shortcut"
            to={graduate ? root + '/saved-startups' : root + '/talent'}
          >
            {graduate ? 'Saved startups' : 'Find talent'}{' '}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
