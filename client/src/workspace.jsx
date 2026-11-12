import { useState } from 'react';
import {
  Building2,
  ClipboardList,
  House,
  Layers,
  Link2,
  LogOut,
  MessageCircle,
  Network,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { request, renew, setSession, search, useAction, useData } from './api';
import { Attachment, Form, Mutate, split } from './forms';
import { Follow } from './discover';
import { VideoManager } from './videos';
import {
  Button,
  date,
  label,
  OpportunityCard,
  Pager,
  Result,
  StartupCard,
  Tags,
  TalentCard,
  Title,
} from './ui';

const menus = {
  graduate: [
    ['dashboard', 'Overview', House],
    ['profile', 'My Profile', UserRound],
    ['applications', 'My Applications', ClipboardList],
    ['matches', 'Smart Matching', Sparkles],
    ['messages', 'Messages', MessageCircle],
  ],
  startup: [
    ['dashboard', 'Overview', House],
    ['profile', 'Startup Profile', Building2],
    ['opportunities', 'Projects & Challenges', Layers],
    ['applications', 'Applications', ClipboardList],
    ['matches', 'Smart Matching', Network],
    ['settings', 'Settings', Settings],
  ],
  admin: [
    ['', 'Overview'],
    ['users', 'Users'],
    ['startups', 'Startups'],
    ['verifications', 'Startup Verification'],
    ['opportunities', 'Projects & Challenges'],
    ['reports', 'Reports'],
    ['categories', 'Categories'],
    ['audit-logs', 'Audit Logs'],
    ['settings', 'Settings'],
  ],
};
export function Workspace({ user }) {
  const root = '/' + user.role;
  const graduate = user.role === 'graduate';
  const startup = user.role === 'startup';
  const menu = menus[user.role];
  const navigate = useNavigate();
  const unread = useData('/notifications', graduate);
  const count = unread.data?.unread || 0;
  return (
    <div
      className={
        'shell workspace ' + (graduate ? 'graduate-workspace' : startup ? 'startup-workspace' : '')
      }
    >
      <aside className="sidebar">
        {graduate && (
          <Link className="workspace-brand" to="/">
            <Link2 size={25} aria-hidden="true" />
            <strong>
              START<span>LINK</span>
            </strong>
          </Link>
        )}
        {!startup && <p className="eyebrow">{label(user.role)} workspace</p>}
        <nav aria-label="Workspace">
          {menu.map(([path, name, _Icon]) => (
            <NavLink
              end={!path || (graduate && path === 'profile')}
              key={path}
              to={root + (path ? '/' + path : '')}
            >
              {_Icon && <_Icon size={18} aria-hidden="true" />}
              <span>{name}</span>
              {graduate && path === 'messages' && count > 0 && (
                <span className="tag" aria-label={count + ' unread notifications'}>
                  {count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <Mutate
          path="/auth/logout"
          success=""
          onDone={() => {
            setSession(null);
            navigate('/login');
          }}
        >
          {startup && <LogOut size={18} aria-hidden="true" />} Log Out
        </Mutate>
      </aside>
      <div className="workspace-main">
        {!user.emailVerified && (
          <div className="notice">
            <p>Verify your email to publish, apply, or connect.</p>
            <div className="actions">
              <Mutate path="/auth/resend-verification" success="Check your email.">
                Resend Email
              </Mutate>
              <Button
                variant="outline"
                onClick={() =>
                  renew().catch(() => toast.error('Sign in again to refresh verification.'))
                }
              >
                Refresh Status
              </Button>
            </div>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}
const text = (name, label, extra = {}) => ({ name, label, ...extra });
const area = (name, label, extra) => text(name, label, { type: 'textarea', ...extra });
const list = (name, label) =>
  text(name, label, { parse: split, hint: 'Separate entries with commas.' });
const link = (name, label, upload = false) => text(name, label, { type: 'url', upload });
const select = (name, label, options) => text(name, label, { options });
const yes = (name, label) => text(name, label, { type: 'checkbox' });
const modes = [
  ['remote', 'Remote'],
  ['onsite', 'Onsite'],
  ['hybrid', 'Hybrid'],
];
const graduateFields = [
  text('fullName', 'Full name', { required: true }),
  link('avatar', 'Profile photo URL', true),
  text('headline', 'Professional headline'),
  area('bio', 'About you'),
  text('location', 'Location'),
  list('education', 'Education'),
  list('skills', 'Skills'),
  { ...list('certificates', 'Private certificates'), upload: 'certificate' },
  list('interests', 'Career interests'),
  list('preferredIndustries', 'Preferred industries'),
  text('availability', 'Availability'),
  select('workMode', 'Work preference', [['', 'No preference'], ...modes]),
  link('github', 'GitHub URL'),
  link('linkedin', 'LinkedIn URL'),
  yes('visibility', 'Show my profile to startup accounts'),
];
const portfolioFields = [
  text('title', 'Project title', { required: true }),
  area('description', 'Description', { required: true }),
  list('technologies', 'Technologies'),
  list('screenshots', 'Screenshot URLs'),
  link('repositoryUrl', 'Repository URL'),
  link('demoUrl', 'Demo URL'),
];
const startupFields = [
  text('name', 'Company name', { required: true }),
  area('description', 'Description', { required: true }),
  text('industry', 'Industry', { required: true }),
  text('location', 'Location', { required: true }),
  text('startupStage', 'Startup stage'),
  link('website', 'Company website'),
  link('logo', 'Logo URL', true),
  link('banner', 'Banner URL', true),
  list('founders', 'Founders and team'),
  list('requiredSkills', 'Skills needed'),
  list('preferredSkills', 'Related skills'),
  { ...yes('visibility', 'Make profile public after verification'), defaultValue: true },
];
const initialize = (item, fields) =>
  Object.fromEntries(
    fields.map(({ name }) => [
      name,
      Array.isArray(item[name]) ? item[name].join(', ') : item[name],
    ]),
  );
function Portfolio({ profile }) {
  const action = useAction();
  const [editing, setEditing] = useState('');
  return (
    <section className="card">
      <h2>Portfolio Projects</h2>
      {profile.portfolioProjects?.map((project) => (
        <article className="list-row" key={project._id}>
          <div>
            <h3>{project.title}</h3>
            <p>{project.description}</p>
            <Tags items={project.technologies} />
          </div>
          <div className="actions">
            <Button variant="outline" onClick={() => setEditing(project._id)}>
              Edit
            </Button>
            <Mutate
              path={'/graduates/me/projects/' + project._id}
              method="delete"
              confirm="Remove this portfolio project?"
            >
              Remove
            </Mutate>
          </div>
        </article>
      ))}
      {editing ? (
        <>
          <Form
            key={editing}
            fields={portfolioFields}
            initial={initialize(
              profile.portfolioProjects?.find((project) => project._id === editing) || {},
              portfolioFields,
            )}
            onSubmit={async (data) => {
              await action.mutateAsync({
                path: '/graduates/me/projects' + (editing === 'new' ? '' : '/' + editing),
                method: editing === 'new' ? 'post' : 'patch',
                data,
              });
              setEditing('');
              toast.success('Portfolio updated.');
            }}
          />
          <Button variant="outline" onClick={() => setEditing('')}>
            Cancel
          </Button>
        </>
      ) : (
        <Button onClick={() => setEditing('new')} disabled={!profile._id}>
          Add Portfolio Project
        </Button>
      )}
    </section>
  );
}
export function GraduateProfile({ user, edit }) {
  const profile = useData('/graduates/me');
  const action = useAction();
  return (
    <>
      <Title title={edit ? 'Edit My Profile' : 'My Profile'}>
        You control whether startups can find your profile.
      </Title>
      <Result query={profile}>
        {(item) => (
          <div className="stack">
            <article className="card">
              {edit ? (
                <Form
                  fields={graduateFields}
                  initial={initialize({ ...item, ...user }, graduateFields)}
                  onSubmit={async (data) => {
                    await action.mutateAsync({ path: '/graduates/me', method: 'patch', data });
                    await renew();
                    toast.success('Profile updated.');
                  }}
                />
              ) : (
                <>
                  <h2>{user.fullName}</h2>
                  <p>{item.headline || 'Add a professional headline.'}</p>
                  <p>{item.bio}</p>
                  <Tags items={item.skills} />
                  <p>{item.education?.join(' · ')}</p>
                  {item.certificates?.filter(Boolean).map((value) => (
                    <Attachment key={value} value={value} />
                  ))}
                  <p>{item.visibility ? 'Visible to startup accounts' : 'Private profile'}</p>
                  <Button to="/graduate/profile?view=edit">Edit Profile</Button>
                </>
              )}
            </article>
            {user.emailVerified && <VideoManager kind="graduate" subject={user._id} />}
            <Portfolio profile={item} />
          </div>
        )}
      </Result>
    </>
  );
}
export function StartupProfile({ edit, user }) {
  const profile = useData('/startups/mine');
  const [selected, setSelected] = useState(null);
  const action = useAction();
  if (profile.isPending || profile.isError) return <Result query={profile}>{() => null}</Result>;
  const item =
    selected === 'new' ? null : profile.data.find((row) => row._id === selected) || profile.data[0];
  return (
    <>
      <Title title={edit ? 'Edit Startup Profile' : 'Startup Profile'}>
        Create a company profile for administrator review.
      </Title>
      {profile.data.length > 0 && (
        <label className="field">
          Company
          <select
            value={selected || item?._id || 'new'}
            onChange={(event) => setSelected(event.target.value)}
          >
            {profile.data.map((row) => (
              <option key={row._id} value={row._id}>
                {row.name}
              </option>
            ))}
            {edit && <option value="new">Add a startup</option>}
          </select>
        </label>
      )}
      <article className="card">
        {edit ? (
          <Form
            key={item?._id || 'new'}
            fields={startupFields}
            initial={initialize(item || {}, startupFields)}
            onSubmit={async (data) => {
              const row = await action.mutateAsync({
                path: '/startups' + (item ? '/' + item._id : ''),
                method: item ? 'patch' : 'post',
                data,
              });
              setSelected(row._id);
              toast.success(
                item ? 'Startup profile updated.' : 'Startup submitted for verification.',
              );
            }}
          />
        ) : (
          <>
            <h2>{item?.name || 'Create your startup profile'}</h2>
            {item && (
              <>
                <p>{item.description}</p>
                <p>Verification · {label(item.verificationStatus)}</p>
                <Tags items={item.requiredSkills} />
              </>
            )}
            <Button to="/startup/profile/edit">{item ? 'Edit Profile' : 'Create Profile'}</Button>
          </>
        )}
      </article>
      {item && user.emailVerified && (
        <VideoManager key={item._id} kind="startup" subject={item._id} />
      )}
    </>
  );
}
export function SavedStartups() {
  const query = useData('/startups/saved');
  return (
    <>
      <Title title="Saved Startups" />
      <Result query={query} empty="Follow a startup to save it here.">
        {(items) => (
          <div className="grid three">
            {items.map((item) => (
              <StartupCard
                key={item._id}
                item={item}
                action={<Follow item={item} saved={items} />}
              />
            ))}
          </div>
        )}
      </Result>
    </>
  );
}
export function Matches({ user }) {
  const graduate = user.role === 'graduate';
  const [kind, setKind] = useState(graduate ? 'opportunities' : 'graduates');
  const query = useData('/matches/' + kind);
  const Card = { opportunities: OpportunityCard, startups: StartupCard, graduates: TalentCard }[
    kind
  ];
  return (
    <>
      <Title title="Smart Matching">
        Compare skills, preferences, and portfolio evidence. Missing information is excluded from
        the score.
      </Title>
      {graduate && (
        <div className="segments">
          <button aria-pressed={kind === 'opportunities'} onClick={() => setKind('opportunities')}>
            Opportunities
          </button>
          <button aria-pressed={kind === 'startups'} onClick={() => setKind('startups')}>
            Startups
          </button>
        </div>
      )}
      <Result
        query={query}
        empty="No matches are available yet. Complete your profile or check back as more people join."
      >
        {(items) => (
          <div className="grid two">
            {items.map(({ item, score, reasons }) => (
              <div className="match-result" key={item._id}>
                <Card item={item} />
                <div>
                  <strong>
                    {score === null ? 'More information needed' : score + '% alignment'}
                  </strong>
                  <ul>
                    {reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </Result>
    </>
  );
}
const opportunityFields = [
  text('title', 'Title', { required: true }),
  area('description', 'Description', { required: true }),
  text('category', 'Category'),
  list('requiredSkills', 'Required skills'),
  list('mandatorySkills', 'Mandatory skills for eligibility'),
  list('preferredSkills', 'Related skills'),
  list('deliverables', 'Expected deliverables'),
  select('workMode', 'Work mode', modes),
  text('location', 'Location'),
  text('duration', 'Duration'),
  text('availability', 'Availability expectation'),
  text('compensation', 'Compensation or reward'),
  text('deadline', 'Application deadline', {
    type: 'datetime-local',
    required: true,
    parse: (value) => new Date(value).toISOString(),
  }),
  text('capacity', 'Contributors or participants', {
    type: 'number',
    min: 1,
    max: 500,
    parse: (value) => (value ? Number(value) : undefined),
  }),
  area('terms', 'Ownership, compensation and confidentiality', {
    required: true,
    hint: 'For challenges, describe a short evaluation exercise. Use a paid project for substantial commercial work.',
  }),
  select('status', 'Status', [
    ['draft', 'Draft'],
    ['published', 'Published'],
    ['closed', 'Closed'],
  ]),
];
const challengeFields = [
  area('instructions', 'Challenge instructions'),
  list('evaluationCriteria', 'Evaluation criteria'),
];
const localDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function OpportunityEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [type, setType] = useState(
    new URLSearchParams(location.search).get('type') === 'challenge' ? 'challenge' : 'project',
  );
  const companies = useData('/startups/mine');
  const record = useData('/opportunities/manage/' + id, !!id);
  const action = useAction();
  if (companies.isPending || companies.isError)
    return <Result query={companies}>{() => null}</Result>;
  if (id && (record.isPending || record.isError))
    return <Result query={record}>{() => null}</Result>;
  const item = record.data || {};
  const kind = item.type || type;
  const fields = [
    ...(!id
      ? [
          select(
            'startupId',
            'Startup',
            companies.data.map((row) => [
              row._id,
              row.name + ' (' + label(row.verificationStatus) + ')',
            ]),
          ),
        ]
      : []),
    ...opportunityFields,
    ...(kind === 'challenge' ? challengeFields : []),
  ];
  const initial = {
    ...initialize(item, fields),
    deadline: localDate(item.deadline),
    startupId: companies.data[0]?._id,
    workMode: item.workMode || 'remote',
    status: item.status || 'draft',
  };
  return (
    <>
      <Title title={id ? 'Edit ' + label(kind) : 'Publish an Opportunity'}>
        {kind === 'challenge'
          ? 'Describe a short evaluation exercise with clear terms.'
          : 'Tell graduates what they’ll build and what support they’ll receive.'}
      </Title>
      {!companies.data.length ? (
        <div className="notice">
          Create a startup profile to continue.{' '}
          <Link to="/startup/profile/edit">Create Profile</Link>
        </div>
      ) : (
        <article className="card">
          {!id && (
            <div className="segments">
              <button aria-pressed={type === 'project'} onClick={() => setType('project')}>
                Project
              </button>
              <button aria-pressed={type === 'challenge'} onClick={() => setType('challenge')}>
                Challenge
              </button>
            </div>
          )}
          {item.status === 'hidden' ? (
            <p className="notice">This opportunity has been hidden by moderation.</p>
          ) : (
            <Form
              fields={fields}
              initial={initial}
              onSubmit={async (data) => {
                await action.mutateAsync({
                  path: '/opportunities' + (id ? '/' + id : ''),
                  method: id ? 'patch' : 'post',
                  data: id ? data : { ...data, type: kind },
                });
                toast.success('Opportunity saved.');
                navigate('/startup/opportunities');
              }}
            />
          )}
        </article>
      )}
    </>
  );
}
export function ManageOpportunities() {
  const [page, setPage] = useState(1);
  const query = useData(search('/opportunities/mine', { page }));
  return (
    <>
      <Title title="Projects & Challenges" />
      <Button to="/startup/opportunities/new">Create Opportunity</Button>
      <Result query={query} empty="Your startup has no opportunities yet.">
        {(data) => (
          <>
            <div className="grid two">
              {data.items.map((item) => (
                <OpportunityCard
                  key={item._id}
                  item={item}
                  action={
                    <div className="stack">
                      <p className="meta">{label(item.status)}</p>
                      <div className="actions">
                        <Button
                          variant="outline"
                          to={'/startup/opportunities/' + item._id + '/edit'}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          to={'/startup/opportunities/' + item._id + '/review'}
                        >
                          Review {item.type === 'project' ? 'Applications' : 'Submissions'}
                        </Button>
                        {['draft', 'published'].includes(item.status) && (
                          <Mutate
                            method="delete"
                            path={'/opportunities/' + item._id}
                            confirm="Close this opportunity?"
                          >
                            Close
                          </Mutate>
                        )}
                      </div>
                    </div>
                  }
                />
              ))}
            </div>
            <Pager data={data} page={page} onPage={setPage} />
          </>
        )}
      </Result>
    </>
  );
}
function ApplicationRow({ row, startup }) {
  const action = useAction();
  const open = ['submitted', 'under_review', 'shortlisted'].includes(row.status);
  return (
    <article className="card">
      <h3>
        {startup ? row.applicant || 'Applicant' : row.opportunityId?.title || 'Project application'}
      </h3>
      <p className="meta">
        {startup && row.opportunityId?.title && row.opportunityId.title + ' · '}
        {label(row.status)} · {date(row.createdAt)}
      </p>
      <p className="preserve">{row.motivation}</p>
      <Tags items={row.skills} />
      <p>{row.availability}</p>
      {row.portfolioReferences?.map((url) => (
        <p key={url}>
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
      ))}
      {startup && row.status === 'accepted' && (
        <Mutate
          path={'/applications/' + row._id + '/status'}
          method="patch"
          data={{ status: 'completed' }}
          confirm="Mark this collaboration complete?"
        >
          Mark Complete
        </Mutate>
      )}
      {open &&
        (startup ? (
          <Form
            key={row.status}
            fields={[
              select('status', 'Application status', [
                ['under_review', 'Under review'],
                ['shortlisted', 'Shortlisted'],
                ['accepted', 'Accepted'],
                ['rejected', 'Rejected'],
              ]),
            ]}
            initial={{ status: row.status === 'submitted' ? 'under_review' : row.status }}
            onSubmit={async (data) => {
              await action.mutateAsync({
                path: '/applications/' + row._id + '/status',
                method: 'patch',
                data,
              });
              toast.success('Application updated.');
            }}
          />
        ) : (
          <Mutate
            path={'/applications/' + row._id + '/status'}
            method="patch"
            data={{ status: 'withdrawn' }}
            confirm="Withdraw this application?"
          >
            Withdraw
          </Mutate>
        ))}
    </article>
  );
}
export function Applications({ startup = false }) {
  const [page, setPage] = useState(1);
  const query = useData(search('/applications', { page }));
  const submissions = useData('/submissions', !startup);
  return (
    <>
      <Title title={startup ? 'Applications Received' : 'My Applications'} />
      <Result query={query} empty="No project applications yet.">
        {(data) => (
          <>
            <div className="grid two">
              {data.items.map((row) => (
                <ApplicationRow key={row._id} row={row} startup={startup} />
              ))}
            </div>
            <Pager data={data} page={page} onPage={setPage} />
          </>
        )}
      </Result>
      {!startup && (
        <>
          <h2 className="subheading">Challenge Submissions</h2>
          <Result query={submissions} empty="No challenge submissions yet.">
            {(data) => (
              <div className="grid two">
                {data.items.map((row) => (
                  <Submission key={row._id} row={row} />
                ))}
              </div>
            )}
          </Result>
        </>
      )}
    </>
  );
}
function Submission({ row, review }) {
  const action = useAction();
  return (
    <article className="card">
      <h3>{review ? row.applicant : row.challengeId?.title}</h3>
      <p>
        {label(row.reviewStatus)} {row.score !== undefined && ' · ' + row.score + '/100'}
      </p>
      <p className="preserve">{row.content}</p>
      {[row.repositoryUrl, row.demoUrl, ...(row.attachments || [])].filter(Boolean).map((url) => (
        <p key={url}>
          <Attachment value={url} />
        </p>
      ))}
      {row.feedback && <p>{row.feedback}</p>}
      {review && (
        <Form
          fields={[
            text('score', 'Score out of 100', {
              type: 'number',
              min: 0,
              max: 100,
              required: true,
              parse: Number,
            }),
            area('feedback', 'Feedback', { required: true }),
            select('reviewStatus', 'Status', ['reviewed', 'selected', 'declined']),
          ]}
          initial={{
            score: row.score,
            feedback: row.feedback,
            reviewStatus: row.reviewStatus === 'submitted' ? 'reviewed' : row.reviewStatus,
          }}
          onSubmit={async (data) => {
            await action.mutateAsync({
              path: '/submissions/' + row._id + '/review',
              method: 'patch',
              data,
            });
            toast.success('Review saved.');
          }}
        />
      )}
    </article>
  );
}
export function ReviewOpportunity() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const record = useData('/opportunities/manage/' + id);
  const challenge = record.data?.type === 'challenge';
  const query = useData(
    search('/opportunities/' + id + '/' + (challenge ? 'submissions' : 'applications'), { page }),
    !!record.data,
  );
  return (
    <Result query={record}>
      {(item) => (
        <>
          <Title label={label(item.type)} title={item.title}>
            Review work submitted by graduates.
          </Title>
          <Result query={query}>
            {(data) => (
              <>
                <div className="grid two">
                  {data.items.map((row) =>
                    challenge ? (
                      <Submission key={row._id} row={row} review />
                    ) : (
                      <ApplicationRow key={row._id} row={row} startup />
                    ),
                  )}
                </div>
                <Pager data={data} page={page} onPage={setPage} />
              </>
            )}
          </Result>
        </>
      )}
    </Result>
  );
}
export function AccountSettings() {
  const navigate = useNavigate();
  return (
    <>
      <Title title="Account Settings" />
      <article className="card">
        <h2>Change Password</h2>
        <Form
          fields={[
            text('currentPassword', 'Current password', {
              type: 'password',
              autoComplete: 'current-password',
              required: true,
            }),
            text('password', 'New password', {
              type: 'password',
              autoComplete: 'new-password',
              required: true,
              hint: 'Use 12 or more characters.',
            }),
          ]}
          onSubmit={async (data) => {
            await request('/auth/change-password', 'post', data);
            setSession(null);
            toast.success('Password changed.');
            navigate('/login');
          }}
        />
      </article>
    </>
  );
}
