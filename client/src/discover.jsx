import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { search, useAction, useData } from './api';
import { Form, Mutate, ReportForm, split } from './forms';
import {
  Button,
  External,
  label,
  date,
  OpportunityCard,
  Pager,
  Result,
  StartupCard,
  Tags,
  TalentCard,
  Title,
} from './ui';

const configs = {
  startups: {
    title: 'Discover Startups',
    description: 'Explore verified startup teams and the skills they’re looking for.',
    filters: [
      ['industry', 'Industry'],
      ['stage', 'Startup stage'],
      ['skills', 'Skill'],
      [
        'active',
        'Availability',
        [
          ['', 'All startups'],
          ['true', 'Open opportunities'],
        ],
      ],
    ],
    Card: StartupCard,
  },
  graduates: {
    title: 'Talent Showcase',
    description: 'Discover graduates who have opted in to share their skills and work.',
    filters: [
      ['skills', 'Skill'],
      ['study', 'Field of study'],
      ['availability', 'Availability'],
      ['location', 'Location'],
    ],
    Card: TalentCard,
  },
  opportunities: {
    title: 'Build With Us',
    description: 'Join startup projects and take on practical startup challenges.',
    filters: [
      ['skill', 'Skill'],
      [
        'workMode',
        'Work mode',
        [
          ['', 'Any'],
          ['remote', 'Remote'],
          ['onsite', 'Onsite'],
          ['hybrid', 'Hybrid'],
        ],
      ],
    ],
    Card: OpportunityCard,
  },
};
export function Directory({ kind, user }) {
  const { title, description, filters, Card } = configs[kind];
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [input, setInput] = useState({});
  const type = params.get('type') || '';
  const query = useData(
    search('/' + kind, { ...input, page, type: kind === 'opportunities' ? type : undefined }),
    kind !== 'graduates' || ['admin', 'startup'].includes(user?.role),
  );
  const saved = useData('/startups/saved', kind === 'startups' && user?.role === 'graduate');
  if (kind === 'graduates' && !['admin', 'startup'].includes(user?.role))
    return (
      <section className="shell section">
        <Title title={title}>{description}</Title>
        <div className="card">
          <h2>Showcase your skills</h2>
          <p>
            Startup accounts can browse the talent directory. Graduates control whether their
            profile appears there.
          </p>
          <Button to={user ? '/graduate/profile/edit' : '/register/graduate'}>
            {user ? 'Edit Profile' : 'Join as Graduate'}
          </Button>{' '}
          {!user && (
            <Button to="/login" variant="outline">
              Log In
            </Button>
          )}
        </div>
      </section>
    );
  return (
    <section className="shell section">
      <Title title={title}>{description}</Title>
      {kind === 'opportunities' && (
        <div className="segments" aria-label="Opportunity type">
          {[
            ['', 'All Opportunities'],
            ['project', 'Join Projects'],
            ['challenge', 'Startup Challenges'],
          ].map(([value, text]) => (
            <button
              key={value}
              aria-pressed={type === value}
              onClick={() => {
                setParams(value ? { type: value } : {});
                setPage(1);
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setInput(Object.fromEntries(new FormData(event.currentTarget)));
        }}
      >
        <label>
          Search
          <input name="q" placeholder="Search keywords" />
        </label>
        {filters.map(([name, text, options]) => (
          <label key={name}>
            {text}
            {options ? (
              <select name={name}>
                {options.map(([value, option]) => (
                  <option key={value} value={value}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input name={name} />
            )}
          </label>
        ))}
        <label>
          Sort
          <select name="sort">
            <option value="recent">Most recent</option>
            <option value="name">Name</option>
          </select>
        </label>
        <Button type="submit">Apply Filters</Button>
        <Button
          variant="outline"
          onClick={(event) => {
            event.currentTarget.form.reset();
            setInput({});
            setPage(1);
          }}
        >
          Clear
        </Button>
      </form>
      <Result query={query} empty="No results match these filters.">
        {(data) => (
          <>
            <div className="grid three">
              {data.items.map((item) => (
                <Card
                  key={item._id}
                  item={item}
                  action={
                    kind === 'startups' && user?.role === 'graduate' ? (
                      <Follow item={item} saved={saved.data} />
                    ) : undefined
                  }
                />
              ))}
            </div>
            <Pager data={data} page={page} onPage={setPage} />
          </>
        )}
      </Result>
    </section>
  );
}
export function Follow({ item, saved }) {
  const followed = saved?.some((row) => row._id === item._id);
  return (
    <Mutate
      path={'/startups/' + item._id + '/follow'}
      disabled={!saved}
      method={followed ? 'delete' : 'post'}
      success={followed ? 'Startup unfollowed.' : 'Startup followed.'}
    >
      {followed ? 'Unfollow Startup' : 'Follow Startup'}
    </Mutate>
  );
}
function ConnectForm({ startupId, graduateId }) {
  const [open, setOpen] = useState(false);
  const action = useAction();
  return (
    <div>
      <Button aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Cancel request' : graduateId ? 'Send Invitation' : 'Request Connection'}
      </Button>
      {open && (
        <Form
          submit="Send Request"
          fields={[{ name: 'message', label: 'Introduction', type: 'textarea' }]}
          onSubmit={async ({ message }) => {
            await action.mutateAsync({
              path: '/connections',
              data: { startupId, graduateId, message },
            });
            setOpen(false);
            toast.success('Connection request sent.');
          }}
        />
      )}
    </div>
  );
}
function StartupDetailContent({ item, user }) {
  const opportunities = useData('/startups/' + item._id + '/opportunities');
  const saved = useData('/startups/saved', user?.role === 'graduate');
  return (
    <>
      <div className="card detail">
        {item.banner && <img className="banner" src={item.banner} alt="" />}
        <div className="tile">{item.logo ? <img alt="" src={item.logo} /> : item.name[0]}</div>
        <Title label={item.sample ? 'Demo profile' : item.industry} title={item.name}>
          {item.location} · {label(item.startupStage)}
        </Title>
        <p>{item.description}</p>
        <Tags items={item.requiredSkills} />
        {item.founders?.length > 0 && (
          <p>
            <strong>Founders and team</strong>
            <br />
            {item.founders.join(', ')}
          </p>
        )}
        {item.website && (
          <a className="text-link" href={item.website} target="_blank" rel="noreferrer">
            Company Website <External />
          </a>
        )}
        <div className="actions">
          {user?.role === 'graduate' && (
            <>
              <Follow item={item} saved={saved.data} />
              <ConnectForm startupId={item._id} />
            </>
          )}
          {user && <ReportForm id={item._id} type="startup" />}
        </div>
      </div>
      <h2 className="subheading">Projects and Challenges</h2>
      <Result query={opportunities} empty="This startup has no active opportunities.">
        {(data) => (
          <div className="grid three">
            {data.items.map((item) => (
              <OpportunityCard key={item._id} item={item} />
            ))}
          </div>
        )}
      </Result>
    </>
  );
}
export function StartupDetail({ user }) {
  const { slug } = useParams();
  const query = useData('/startups/' + encodeURIComponent(slug));
  return (
    <section className="shell section">
      <Link className="text-link" to="/discover-startups">
        ← Discover Startups
      </Link>
      <Result query={query}>{(item) => <StartupDetailContent item={item} user={user} />}</Result>
    </section>
  );
}
export function TalentDetail({ user }) {
  const { id } = useParams();
  const query = useData('/graduates/' + id, ['startup', 'admin'].includes(user?.role));
  const companies = useData('/startups/mine', user?.role === 'startup');
  const [company, setCompany] = useState('');
  if (!['startup', 'admin'].includes(user?.role))
    return (
      <section className="shell section">
        <Title title="Talent Showcase">
          Log in with a startup account to view opted-in graduate profiles.
        </Title>
        <Button to="/login">Log In</Button>
      </section>
    );
  return (
    <section className="shell section">
      <Result query={query}>
        {(item) => (
          <article className="card detail">
            <div className="tile">
              {item.userId.avatar ? (
                <img src={item.userId.avatar} alt="" />
              ) : (
                item.userId.fullName[0]
              )}
            </div>
            <Title title={item.userId.fullName}>{item.headline}</Title>
            <p>{item.bio}</p>
            <p>{[item.location, item.availability, item.workMode].filter(Boolean).join(' · ')}</p>
            <Tags items={item.skills} />
            <p>{item.education?.join(' · ')}</p>
            <Tags items={item.interests} />
            <div className="actions">
              {item.github && (
                <a href={item.github} target="_blank" rel="noreferrer">
                  GitHub <External />
                </a>
              )}
              {item.linkedin && (
                <a href={item.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn <External />
                </a>
              )}
            </div>
            {item.portfolioProjects?.length > 0 && (
              <>
                <h2>Portfolio</h2>
                <div className="grid two">
                  {item.portfolioProjects.map((project) => (
                    <article className="card" key={project._id}>
                      <h3>{project.title}</h3>
                      <p>{project.description}</p>
                      <Tags items={project.technologies} />
                      {project.screenshots?.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt={project.title + ' screenshot'}
                          loading="lazy"
                        />
                      ))}
                      <div className="actions">
                        {project.repositoryUrl && (
                          <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
                            Repository
                          </a>
                        )}
                        {project.demoUrl && (
                          <a href={project.demoUrl} target="_blank" rel="noreferrer">
                            Demo
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
            {user.role === 'startup' && (
              <div className="field">
                <label htmlFor="invite-company">Invite from startup</label>
                <select
                  id="invite-company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                >
                  <option value="">Select a verified startup</option>
                  {companies.data
                    ?.filter((item) => item.verificationStatus === 'verified' && item.visibility)
                    .map((item) => (
                      <option value={item._id} key={item._id}>
                        {item.name}
                      </option>
                    ))}
                </select>
                {company && <ConnectForm startupId={company} graduateId={id} />}
              </div>
            )}
          </article>
        )}
      </Result>
    </section>
  );
}
export function OpportunityDetail({ user }) {
  const { id } = useParams();
  const query = useData('/opportunities/' + id);
  const action = useAction();
  const [submitted, setSubmitted] = useState(false);
  return (
    <section className="shell section">
      <Link className="text-link" to="/opportunities">
        ← Build With Us
      </Link>
      <Result query={query}>
        {(item) => {
          const project = item.type === 'project';
          const fields = project
            ? [
                {
                  name: 'motivation',
                  label: 'Why are you interested?',
                  type: 'textarea',
                  required: true,
                },
                { name: 'skills', label: 'Relevant skills', parse: split },
                { name: 'portfolioReferences', label: 'Portfolio links', parse: split },
                { name: 'availability', label: 'Availability', required: true },
              ]
            : [
                {
                  name: 'content',
                  label: 'Solution and explanation',
                  type: 'textarea',
                  required: true,
                },
                { name: 'repositoryUrl', label: 'Repository URL', type: 'url' },
                { name: 'demoUrl', label: 'Demo URL', type: 'url' },
                {
                  name: 'attachments',
                  label: 'Attachments',
                  parse: split,
                  upload: 'submission',
                  hint: 'Upload a private file or enter a link.',
                },
              ];
          return (
            <div className="detail-grid">
              <article className="card detail">
                <Title label={label(item.type)} title={item.title}>
                  {item.startupId?.name} · {label(item.workMode)} · Due {date(item.deadline)}
                </Title>
                <p className="preserve">{item.description}</p>
                <Tags items={item.requiredSkills} />
                {item.mandatorySkills?.length > 0 && (
                  <p>
                    <strong>Mandatory skills</strong>
                    <br />
                    {item.mandatorySkills.join(', ')}
                  </p>
                )}
                {item.compensation && (
                  <p>
                    <strong>Compensation</strong>
                    <br />
                    {item.compensation}
                  </p>
                )}
                {item.duration && (
                  <p>
                    <strong>Duration</strong>
                    <br />
                    {item.duration}
                  </p>
                )}
                {item.location && (
                  <p>
                    <strong>Location</strong>
                    <br />
                    {item.location}
                  </p>
                )}
                {item.instructions && (
                  <p className="preserve">
                    <strong>Instructions</strong>
                    <br />
                    {item.instructions}
                  </p>
                )}
                {[
                  [item.deliverables, 'Deliverables'],
                  [item.evaluationCriteria, 'Evaluation criteria'],
                ].map(
                  ([entries, title]) =>
                    entries?.length > 0 && (
                      <div key={title}>
                        <h3>{title}</h3>
                        <ul>
                          {entries.map((entry) => (
                            <li key={entry}>{entry}</li>
                          ))}
                        </ul>
                      </div>
                    ),
                )}
                <h3>Ownership, compensation and confidentiality</h3>
                <p className="preserve">{item.terms}</p>
                {user && <ReportForm type="opportunity" id={id} />}
              </article>
              <aside className="card detail">
                <h2>{project ? 'Apply to Join' : 'Submit Your Solution'}</h2>
                {user?.role === 'graduate' && user.emailVerified && !submitted ? (
                  <Form
                    fields={fields}
                    submit={project ? 'Send Application' : 'Submit Solution'}
                    onSubmit={async (data) => {
                      await action.mutateAsync({
                        path: '/opportunities/' + id + (project ? '/apply' : '/submissions'),
                        data,
                      });
                      setSubmitted(true);
                    }}
                  />
                ) : submitted ? (
                  <p role="status">
                    Submitted. Track the status in{' '}
                    <Link to="/graduate/applications">My Applications</Link>.
                  </p>
                ) : user?.role === 'graduate' ? (
                  <p>Verify your email to submit.</p>
                ) : user ? (
                  <p>Applications are open to graduate accounts.</p>
                ) : (
                  <Button to="/login">Log In to Continue</Button>
                )}
              </aside>
            </div>
          );
        }}
      </Result>
    </section>
  );
}
