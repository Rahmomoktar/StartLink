import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  Code2,
  Gift,
  Laptop,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Wifi,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { search, useData } from './api';
import { Button, date, label, Pager, Result, Tags } from './ui';
import './opportunities.css';

const types = [
  ['', 'All Opportunities'],
  ['project', 'Join Projects'],
  ['challenge', 'Startup Challenges'],
];
const modes = ['remote', 'hybrid', 'onsite'];
const deadlines = [
  { _id: '7', text: 'Next 7 days' },
  { _id: '30', text: 'Next 30 days' },
];

function FilterSelect({ title, icon, options, value, onChange }) {
  const Icon = icon;
  return (
    <label className="opportunity-select">
      <Icon size={16} aria-hidden="true" />
      <span>{title}</span>
      <select aria-label={title} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map(({ _id, text }) => (
          <option key={_id} value={_id}>
            {text || _id}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterGroup({ title, options, value, onChange }) {
  if (!options.length) return null;
  return (
    <fieldset>
      <legend>{title}</legend>
      {options.map(({ _id, text, count }) => (
        <label key={_id}>
          <input
            type="checkbox"
            checked={value === _id}
            onChange={(event) => onChange(event.target.checked ? _id : '')}
          />
          {text || _id}
          {count !== undefined && ' (' + count + ')'}
        </label>
      ))}
    </fieldset>
  );
}

function OpportunityListing({ item }) {
  const project = item.type === 'project';
  const startup = item.startupId;
  const initials = startup?.name
    ?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
  const ModeIcon = item.workMode === 'remote' ? Wifi : Laptop;
  return (
    <article className="opportunity-listing">
      <header>
        <span className="opportunity-logo" aria-hidden="true">
          {startup?.logo ? <img src={startup.logo} alt="" loading="lazy" /> : initials}
        </span>
        <div className="opportunity-company">
          <strong>{startup?.name}</strong>
          <span>{startup?.industry}</span>
        </div>
        {Number.isFinite(item.matchScore) && (
          <span className="opportunity-match">Matched {item.matchScore}%</span>
        )}
      </header>
      <div className="opportunity-listing-title">
        <h2>{item.title}</h2>
        <span className={'opportunity-type ' + item.type}>{label(item.type)}</span>
      </div>
      <p className="opportunity-description">{item.description}</p>
      <Tags items={item.requiredSkills} />
      <footer>
        <div className="opportunity-meta">
          <div>
            <span>
              <ModeIcon size={14} aria-hidden="true" /> {label(item.workMode)}
            </span>
            {item.location && (
              <span>
                <MapPin size={14} aria-hidden="true" /> {item.location}
              </span>
            )}
          </div>
          <div>
            <span>
              <CalendarDays size={14} aria-hidden="true" /> {project ? 'Apply by' : 'Due'}{' '}
              {date(item.deadline)}
            </span>
            {item.duration && (
              <span>
                <Clock size={14} aria-hidden="true" /> {item.duration}
              </span>
            )}
            {!project && item.compensation && (
              <span>
                <Gift size={14} aria-hidden="true" /> {item.compensation}
              </span>
            )}
          </div>
        </div>
        <Button to={'/opportunities/' + item._id} variant={project ? 'gold' : 'navy'}>
          {project ? (
            <>
              Apply Now <ArrowUpRight size={14} aria-hidden="true" />
            </>
          ) : (
            'View Details'
          )}
        </Button>
      </footer>
    </article>
  );
}

export function Opportunities({ user }) {
  const [params, setParams] = useSearchParams();
  const [q, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const dialog = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  const typeParam = params.get('type');
  const type = types.some(([value]) => value === typeParam) ? typeParam : '';
  const {
    workMode = '',
    requiredSkill = '',
    location = '',
    category = '',
    deadline = '',
    sort = '',
  } = Object.fromEntries(params);
  const page = Math.min(5000, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  const update = (name, value) => {
    const next = new URLSearchParams(params);
    if (name !== 'page') next.delete('page');
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  };
  const query = useData(
    search('/opportunities', {
      q: debouncedQuery,
      type,
      workMode,
      requiredSkill,
      location,
      category,
      deadline,
      sort,
      page,
      personalized: user?.role === 'graduate' ? 'true' : undefined,
    }),
  );
  const facets = useData('/opportunities/filters').data;
  const counted = (key, values) =>
    values.map((_id) => ({
      _id,
      text: _id === 'onsite' ? 'Onsite' : label(_id),
      count: facets ? (facets[key]?.find((option) => option._id === _id)?.count ?? 0) : undefined,
    }));
  const modeOptions = counted('workMode', modes);
  const selectFilters = [
    ['requiredSkill', 'Skill', Code2, facets?.skill || [], requiredSkill],
    ['location', 'Location', MapPin, facets?.location || [], location],
    ['workMode', 'Work Mode', Laptop, modeOptions, workMode],
    ['deadline', 'Deadline', CalendarDays, deadlines, deadline],
  ];
  const selects = selectFilters.map(([name, title, icon, options, value]) => (
    <FilterSelect
      key={name}
      title={title}
      icon={icon}
      options={options}
      value={value}
      onChange={(next) => update(name, next)}
    />
  ));
  const refinements = (
    <>
      <FilterGroup
        title="Opportunity Type"
        options={counted('type', ['project', 'challenge'])}
        value={type}
        onChange={(value) => update('type', value)}
      />
      <FilterGroup
        title="Work Mode"
        options={modeOptions}
        value={workMode}
        onChange={(value) => update('workMode', value)}
      />
      <FilterGroup
        title="Skill Areas"
        options={facets?.category || []}
        value={category}
        onChange={(value) => update('category', value)}
      />
      <button
        className="opportunity-clear"
        type="button"
        onClick={() => {
          setQuery('');
          setDebouncedQuery('');
          setParams({});
        }}
      >
        <RotateCcw size={15} aria-hidden="true" /> Clear Filters
      </button>
    </>
  );
  const total = query.data?.total;
  return (
    <section className="opportunity-browser" aria-labelledby="opportunities-title">
      <div className="shell">
        <header className="opportunity-heading">
          <div>
            <h1 id="opportunities-title">Browse Opportunities</h1>
            <p>Find startup projects and challenges that match your skills.</p>
          </div>
          <div className="opportunity-count" role="status">
            {total !== undefined && (
              <>
                <Layers size={19} aria-hidden="true" />
                <span>
                  <strong>{total}</strong> {total === 1 ? 'opportunity' : 'opportunities'}
                </span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            aria-haspopup="dialog"
            onClick={() => dialog.current.showModal()}
          >
            <SlidersHorizontal size={17} aria-hidden="true" /> Filters
          </Button>
        </header>
        <div className="opportunity-tabs" aria-label="Opportunity type">
          {types.map(([value, text]) => (
            <Button
              key={value}
              variant={type === value ? 'navy' : 'outline'}
              aria-pressed={type === value}
              onClick={() => update('type', value)}
            >
              {text}
            </Button>
          ))}
        </div>
        <div className="opportunity-toolbar">
          <label className="opportunity-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search opportunities"
              maxLength={100}
              value={q}
              placeholder="Search opportunities, startups, or skills..."
              onChange={(event) => {
                setQuery(event.target.value);
                if (page !== 1) update('page', '');
              }}
            />
          </label>
          <div className="opportunity-selects">{selects}</div>
        </div>
        <dialog
          ref={dialog}
          className="filter-dialog opportunity-dialog"
          aria-labelledby="opportunity-filter-title"
        >
          <div className="filter-dialog-heading">
            <h2 id="opportunity-filter-title">Filters</h2>
            <Button
              variant="outline"
              aria-label="Close filters"
              onClick={() => dialog.current.close()}
            >
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
          <div className="opportunity-dialog-selects">
            {selects}
            <FilterSelect
              title="Sort"
              icon={Layers}
              value={sort}
              onChange={(value) => update('sort', value)}
              options={[
                { _id: 'recent', text: 'Most recent' },
                { _id: 'name', text: 'Name' },
              ]}
            />
          </div>
          {refinements}
        </dialog>
        <div className="opportunity-layout">
          <aside className="opportunity-refinements" aria-label="Refine results">
            <h2>
              <SlidersHorizontal size={16} aria-hidden="true" /> Refine Results
            </h2>
            {refinements}
          </aside>
          <div>
            <Result
              query={query}
              empty={
                page > 1
                  ? 'No opportunities on this page.'
                  : 'No opportunities found. Try changing or clearing your filters.'
              }
            >
              {(data) => (
                <div className="opportunity-grid">
                  {data.items.map((item) => (
                    <OpportunityListing key={item._id} item={item} />
                  ))}
                </div>
              )}
            </Result>
            {query.data?.items.length > 0 && (
              <Pager data={query.data} page={page} onPage={(value) => update('page', value)} />
            )}
            {query.isSuccess && page > 1 && !query.data.items.length && (
              <Button variant="outline" onClick={() => update('page', '')}>
                First Page
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
