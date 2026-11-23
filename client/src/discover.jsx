import { featuredStartups } from './demo-startups';
import { demoTalent } from './demo-talent';
import { useRef, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  GraduationCap,
  Layers,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  UsersRound,
  UserRoundPlus,
  X,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { search, useAction, useData } from './api';
import { Form, Mutate, ReportForm, split } from './forms';
import { ProfileVideo } from './videos';
import {
  Button,
  External,
  label,
  date,
  OpportunityCard,
  Pager,
  Result,
  StartupCard,
  StartupCover,
  StartupMark,
  Tags,
  TalentCard,
  TalentPortrait,
  Title,
} from './ui';

const startupFilters = [
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
];
export function TalentShowcase({ user, heading }) {
  const canBrowse = true;
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const normalized = (value) => value.toLowerCase();
  const items = demoTalent.filter((item) => {
    const all = [
      item.userId.fullName,
      item.headline,
      item.bio,
      item.location,
      ...item.skills,
      ...item.education,
    ].join(' ');
    return (
      (!filters.q || normalized(all).includes(normalized(filters.q))) &&
      (!filters.skills || item.skills.includes(filters.skills)) &&
      (!filters.study || item.education.some((entry) => entry.includes(filters.study))) &&
      (!filters.location || item.location === filters.location)
    );
  });
  if (filters.sort === 'name')
    items.sort((a, b) => a.userId.fullName.localeCompare(b.userId.fullName));
  const query = {
    isSuccess: true,
    isPending: false,
    isError: false,
    data: { items, total: items.length, pages: 1, page: 1 },
  };
  const sorted = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  const options = {
    data: {
      skills: sorted(demoTalent.flatMap((item) => item.skills)),
      locations: sorted(demoTalent.map((item) => item.location)),
      universities: sorted(demoTalent.map((item) => item.education[0].split(' · ')[1])),
    },
  };
  const changeFilter = ({ target: { name, value } }) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };
  return (
    <section className="shell talent-showcase">
      <header className="showcase-heading">
        <span className="feature-icon">
          <GraduationCap size={28} aria-hidden="true" />
        </span>
        <Title title="Talent Showcase" heading={heading}>
          Discover talented graduates, explore their skills and projects, and connect with future
          team members.
        </Title>
        {(!user || user.role === 'graduate') && (
          <Button variant="gold" to={user ? '/graduate/profile?view=edit' : '/register/graduate'}>
            <Plus size={17} aria-hidden="true" /> Create My Profile
          </Button>
        )}
      </header>
      {canBrowse ? (
        <>
          <div className="showcase-filters" role="search" aria-label="Find graduates">
            <label className="showcase-search">
              <span className="sr-only">Search by name, skill, or university</span>
              <Search size={16} aria-hidden="true" />
              <input
                name="q"
                type="search"
                placeholder="Search by name, skill, or university…"
                value={filters.q ?? ''}
                onChange={changeFilter}
                maxLength={100}
              />
            </label>
            {[
              ['skills', 'Skills', options.data?.skills],
              ['study', 'Universities', options.data?.universities],
              ['location', 'Locations', options.data?.locations],
            ].map(([name, labelText, values]) => (
              <select
                key={name}
                aria-label={labelText}
                name={name}
                value={filters[name] ?? ''}
                onChange={changeFilter}
              >
                <option value="">All {labelText}</option>
                {values?.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            ))}
            <select
              aria-label="Sort graduates"
              name="sort"
              value={filters.sort ?? 'recent'}
              onChange={changeFilter}
            >
              <option value="recent">Sort: Recent</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
          <Result query={query} empty="No graduates match these filters.">
            {(data) => (
              <>
                <div className="grid three showcase-grid">
                  {data.items.map((item) => (
                    <TalentCard
                      key={item._id}
                      item={item}
                      showcase
                      action={
                        !item.userId.sample && user?.role === 'startup' ? (
                          <TalentInvite graduateId={item.userId._id} name={item.userId.fullName} />
                        ) : undefined
                      }
                    />
                  ))}
                </div>
                <Pager data={data} page={page} onPage={setPage} />
              </>
            )}
          </Result>
        </>
      ) : (
        <article className="card showcase-gate">
          <h2>Find talent for your startup</h2>
          <p>
            Startup accounts can browse graduate profiles whose owners have chosen to share them.
          </p>
          <Button to={user ? '/discover-startups' : '/login?returnTo=%2Ftalent'}>
            {user ? 'Discover Startups' : 'Log In as a Startup'}
          </Button>
        </article>
      )}
    </section>
  );
}

export function Directory({ kind, user }) {
  return kind === 'graduates' ? <TalentShowcase user={user} /> : <StartupDirectory user={user} />;
}

function StartupDirectory({ user }) {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState({});
  const [draft, setDraft] = useState({});
  const filterDialog = useRef(null);
  const changeFilter = ({ target: { name, value } }) => {
    setDraft((current) => ({ ...current, [name]: value }));
  };
  const query = useData(search('/startups', { ...input, page }));
  const saved = useData('/startups/saved', user?.role === 'graduate');
  const filterForm = (
    <form
      className="filters"
      onSubmit={(event) => {
        event.preventDefault();
        setPage(1);
        setInput(draft);
        filterDialog.current.close();
      }}
    >
      <div className="filter-dialog-heading">
        <h2 id="directory-filter-title">Filters</h2>
        <Button
          variant="outline"
          aria-label="Close filters"
          onClick={() => filterDialog.current.close()}
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
      {startupFilters.map(([name, text, options]) => (
        <label key={name}>
          {text}
          {options ? (
            <select name={name} value={draft[name] ?? ''} onChange={changeFilter}>
              {options.map(([value, option]) => (
                <option key={value} value={value}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input name={name} value={draft[name] ?? ''} onChange={changeFilter} />
          )}
        </label>
      ))}
      <label>
        Sort
        <select name="sort" value={draft.sort ?? 'recent'} onChange={changeFilter}>
          <option value="recent">Most recent</option>
          <option value="name">Name</option>
        </select>
      </label>
      <div className="filter-actions">
        <Button type="submit">Apply Filters</Button>
        <Button
          variant="outline"
          onClick={() => {
            setDraft({});
            setInput({});
            setPage(1);
          }}
        >
          Clear
        </Button>
      </div>
    </form>
  );
  const results = (
    <Result query={query} empty="No startups found. Try changing or clearing your filters.">
      {(data) => (
        <>
          <div className="grid directory-grid">
            {data.items.map((item) => (
              <StartupCard
                key={item._id}
                item={item}
                directory
                action={
                  user?.role === 'graduate' ? <Follow item={item} saved={saved.data} /> : undefined
                }
              />
            ))}
          </div>
          <Pager data={data} page={page} onPage={setPage} />
        </>
      )}
    </Result>
  );
  const total = query.data?.total;
  return (
    <section className="directory startup-directory">
      <div className="shell directory-layout">
        <dialog
          className="filter-dialog"
          ref={filterDialog}
          aria-labelledby="directory-filter-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              filterDialog.current.close();
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) filterDialog.current.close();
          }}
        >
          {filterForm}
        </dialog>
        <section aria-labelledby="directory-results-heading">
          <div className="directory-results-heading">
            <h1 id="directory-results-heading">Startup Directory</h1>
            <span role="status">
              {total !== undefined && total + (total === 1 ? ' startup' : ' startups')}
            </span>
            <label className="startup-directory-search showcase-search">
              <span className="sr-only">Search startups</span>
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                maxLength={100}
                placeholder="Search startups…"
                value={input.q ?? ''}
                onChange={(event) => {
                  setInput((current) => ({ ...current, q: event.target.value }));
                  setPage(1);
                }}
              />
            </label>
            <Button
              variant="outline"
              aria-haspopup="dialog"
              onClick={() => {
                setDraft(input);
                filterDialog.current.showModal();
              }}
            >
              <SlidersHorizontal size={17} aria-hidden="true" /> Filters
            </Button>
          </div>
          {results}
        </section>
      </div>
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
function TalentInvite({ graduateId, name }) {
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const companies = useData('/startups/mine', open);
  const action = useAction();
  const titleId = 'invite-' + graduateId;
  return (
    <>
      <Button
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
          dialog.current.showModal();
        }}
      >
        <UserRoundPlus size={16} aria-hidden="true" /> Connect
      </Button>
      <dialog
        className="showcase-invite"
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
      >
        <div className="filter-dialog-heading">
          <h2 id={titleId}>Connect with {name}</h2>
          <Button
            variant="outline"
            aria-label="Close invitation"
            onClick={() => dialog.current.close()}
          >
            <X size={17} aria-hidden="true" />
          </Button>
        </div>
        {open && (
          <Result
            query={companies}
            empty="Create and verify a startup profile before sending invitations."
          >
            {(items) => {
              const eligible = items.filter(
                (item) => item.verificationStatus === 'verified' && item.visibility,
              );
              if (!eligible.length)
                return (
                  <p className="notice">
                    A public, verified startup is required to send invitations.
                  </p>
                );
              return (
                <Form
                  fields={[
                    {
                      name: 'startupId',
                      label: 'Send from',
                      options: eligible.map((item) => [item._id, item.name]),
                      defaultValue: eligible[0]._id,
                    },
                    { name: 'message', label: 'Introduction', type: 'textarea' },
                  ]}
                  submit="Send Invitation"
                  onSubmit={async ({ startupId, message }) => {
                    await action.mutateAsync({
                      path: '/connections',
                      data: { startupId, graduateId, message },
                    });
                    dialog.current.close();
                    toast.success('Connection request sent.');
                  }}
                />
              );
            }}
          </Result>
        )}
      </dialog>
    </>
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
  const liveOpportunities = useData(
    '/startups/' + item._id + '/opportunities',
    !item.staticProfile,
  );
  const opportunities = item.staticProfile
    ? { isSuccess: true, data: { items: [] } }
    : liveOpportunities;
  const saved = useData('/startups/saved', !item.staticProfile && user?.role === 'graduate');
  return (
    <>
      <header className="startup-profile-hero">
        <StartupCover item={item} />
        <StartupMark item={item} />
        <div>
          <div className="startup-profile-badges">
            <span>{item.industry}</span>
            {item.sample ? (
              <span>Demo profile</span>
            ) : (
              item.verificationStatus === 'verified' && (
                <span>
                  <BadgeCheck size={16} aria-hidden="true" /> Verified startup
                </span>
              )
            )}
          </div>
          <h1>{item.name}</h1>
          <p>{[item.location, label(item.startupStage)].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      <div className="startup-profile-details">
        <article className="card">
          <h2>About the startup</h2>
          <p>{item.description}</p>
          {item.requiredSkills?.length > 0 && (
            <div>
              <h3>Skills we look for</h3>
              <Tags items={item.requiredSkills} />
            </div>
          )}
          {!item.staticProfile && <ProfileVideo kind="startup" subject={item._id} user={user} />}
        </article>
        <aside className="card startup-company-details">
          <h2>
            <Building2 size={22} aria-hidden="true" /> Company details
          </h2>
          {item.location && (
            <p>
              <MapPin size={17} aria-hidden="true" /> {item.location}
            </p>
          )}
          {item.founders?.length > 0 && (
            <div>
              <h3>
                <UsersRound size={18} aria-hidden="true" /> Founders and team
              </h3>
              <p>{item.founders.join(', ')}</p>
            </div>
          )}
          {item.website && (
            <a className="text-link" href={item.website} target="_blank" rel="noreferrer">
              Company Website <External />
            </a>
          )}
          {user && !item.staticProfile && (
            <div className="actions">
              {user.role === 'graduate' && (
                <>
                  <Follow item={item} saved={saved.data} />
                  <ConnectForm startupId={item._id} />
                </>
              )}
              <ReportForm id={item._id} type="startup" />
            </div>
          )}
        </aside>
      </div>
      <section
        className="startup-profile-opportunities"
        aria-labelledby="startup-opportunities-title"
      >
        <h2 id="startup-opportunities-title">
          <Layers size={24} aria-hidden="true" /> Projects and Challenges
        </h2>
        {opportunities.isSuccess && !opportunities.data.items.length ? (
          <div className="startup-opportunities-empty">
            <span className="feature-icon">
              <BriefcaseBusiness size={24} aria-hidden="true" />
            </span>
            <div>
              <h3>No open opportunities</h3>
              <p>This startup has no active opportunities.</p>
            </div>
            <Button to="/opportunities" variant="outline">
              Browse Opportunities <External />
            </Button>
          </div>
        ) : (
          <Result query={opportunities} empty="This startup has no active opportunities.">
            {(data) => (
              <div className="grid three">
                {data.items.map((item) => (
                  <OpportunityCard key={item._id} item={item} />
                ))}
              </div>
            )}
          </Result>
        )}
      </section>
    </>
  );
}
export function StartupDetail({ user }) {
  const { slug } = useParams();
  const demo = featuredStartups.find((item) => item.slug === slug);
  const live = useData('/startups/' + encodeURIComponent(slug), !demo);
  const query = demo ? { isSuccess: true, isPending: false, isError: false, data: demo } : live;
  return (
    <section className="shell startup-profile-page">
      <Link className="startup-directory-back" to="/discover-startups">
        <ArrowLeft size={17} aria-hidden="true" /> Discover Startups
      </Link>
      <Result query={query}>{(item) => <StartupDetailContent item={item} user={user} />}</Result>
    </section>
  );
}
export function TalentDetail({ user }) {
  const { id } = useParams();
  const demo = demoTalent.find((item) => item.userId._id === id);
  const live = useData('/graduates/' + id, !demo && ['startup', 'admin'].includes(user?.role));
  const query = demo ? { isSuccess: true, isPending: false, isError: false, data: demo } : live;
  const companies = useData('/startups/mine', user?.role === 'startup');
  const [company, setCompany] = useState('');
  if (!demo && !['startup', 'admin'].includes(user?.role))
    return (
      <section className="shell section">
        <Title title="Talent Showcase">
          Log in with a startup account to view opted-in graduate profiles.
        </Title>
        <Button to="/login">Log In</Button>
      </section>
    );
  return (
    <section className="shell section talent-detail-page">
      <Result query={query}>
        {(item) => (
          <article className="talent-profile-page">
            <header className="talent-profile-header">
              <TalentPortrait user={item.userId} />
              <div className="talent-profile-copy">
                <h1>{item.userId.fullName}</h1>
                <p className="talent-profile-headline">{item.headline}</p>
                <p className="talent-profile-bio">{item.bio}</p>
                <p className="talent-profile-meta">
                  {[item.location, item.availability, item.workMode].filter(Boolean).join(' · ')}
                </p>
                <div className="talent-profile-tags">
                  <Tags items={item.skills} />
                </div>
                <p className="talent-profile-education">{item.education?.join(' · ')}</p>
                <div className="talent-profile-interests">
                  <Tags items={item.interests} />
                </div>
                <div className="actions talent-profile-links">
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
              </div>
            </header>
            {!demo && <ProfileVideo kind="graduate" subject={id} user={user} />}
            {item.portfolioProjects?.length > 0 && (
              <section className="talent-profile-portfolio" aria-labelledby="graduate-portfolio">
                <h2 id="graduate-portfolio">Portfolio</h2>
                <div className="grid two">
                  {item.portfolioProjects.map((project) => (
                    <article className="talent-profile-project" key={project._id}>
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
              </section>
            )}
            {!demo && user?.role === 'startup' && (
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
        ← Browse Opportunities
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
