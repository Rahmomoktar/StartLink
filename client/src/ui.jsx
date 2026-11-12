import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  Bell,
  ChevronDown,
  Eye,
  GraduationCap,
  MapPin,
  Leaf,
  ChartNoAxesColumnIncreasing,
  CodeXml,
  HeartPulse,
  UsersRound,
} from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { errorText, useData } from './api';
import startlinkLogo from './assets/startlink-logo.png';

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="STARTLINK home">
      <img src={startlinkLogo} alt="" width={679} height={454} />
    </Link>
  );
}
export function Button({ to, children, variant = 'navy', className = '', ...props }) {
  const classes = 'button ' + variant + ' ' + className;
  return to ? (
    <Link to={to} className={classes} {...props}>
      {children}
    </Link>
  ) : (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
export const Forward = () => <ArrowRight size={16} aria-hidden="true" />;
export const External = () => <ArrowUpRight size={16} aria-hidden="true" />;
export function Header({ user, startupInbox }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const startup = user?.role === 'startup' && /^\/startup(?:\/|$)/.test(pathname);
  const admin = user?.role === 'admin' && /^\/admin(?:\/|$)/.test(pathname);
  const companies = useData('/startups/mine', startup);
  const company = companies.data?.[0];
  const companyName = company?.name || user?.fullName;
  const close = () => setOpen(false);
  const dashboard = user?.role === 'admin' ? '/admin' : '/' + user?.role + '/dashboard';
  return (
    <header
      className={
        'site-header' +
        (startup
          ? ' startup-header'
          : admin
            ? ' admin-header'
            : pathname === '/how-it-works'
              ? ' how-header'
              : '')
      }
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell header-row">
        <div className="header-brand">
          <Logo />
          <div className="header-wordmark" aria-hidden="true">
            <div>
              START<span>LINK</span>
            </div>
            {startup && <small>Where Talent Meets Startups</small>}
          </div>
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <div
          id="navigation"
          className={'navigation ' + (open ? 'open' : '')}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              close();
              document.querySelector('.menu-toggle')?.focus();
            }
          }}
        >
          <nav aria-label="Main navigation">
            <NavLink end to="/" onClick={close}>
              Home
            </NavLink>
            <NavLink to="/discover-startups" onClick={close}>
              Discover Startups
            </NavLink>
            <NavLink to="/talent" onClick={close}>
              Talent Showcase
            </NavLink>
            <NavLink to="/opportunities" onClick={close}>
              Build With Us
            </NavLink>
            <NavLink to="/how-it-works" onClick={close}>
              How It Works
            </NavLink>
          </nav>
          {!startup && (
            <div className="header-actions">
              {user ? (
                <>
                  {user.role !== 'admin' && (
                    <Link
                      aria-label="Notifications"
                      onClick={close}
                      to={'/' + user.role + '/notifications'}
                    >
                      <Bell size={21} />
                    </Link>
                  )}
                  <Button to={dashboard} onClick={close} variant="gold">
                    Dashboard <External />
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={close}>
                    Log in
                  </Link>
                  <Button to="/register" onClick={close} variant="gold">
                    Join Now <External />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        {startup && (
          <div className="header-actions startup-header-actions">
            {startupInbox}
            <details className="startup-account" key={'account:' + pathname}>
              <summary aria-label={companyName + ' account'}>
                <span className="startup-avatar">
                  {company?.logo ? <img src={company.logo} alt="" /> : companyName?.[0]}
                </span>
                <span className="startup-account-name">{companyName}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              <div className="startup-account-links">
                <Link to={dashboard} onClick={close}>
                  Overview
                </Link>
              </div>
            </details>
          </div>
        )}
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-main">
        <div>
          <Logo />
          <p>Connecting emerging talent with the teams building what’s next.</p>
        </div>
        <nav aria-label="Footer">
          <Link to="/discover-startups">Discover Startups</Link>
          <Link to="/opportunities">Build With Us</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </div>
      <div className="shell copyright">© {new Date().getFullYear()} STARTLINK</div>
    </footer>
  );
}
export function Result({ query, children, empty = 'Nothing to show yet.' }) {
  if (query.isPending)
    return (
      <div className="skeleton" role="status">
        <span className="sr-only">Loading…</span>
      </div>
    );
  if (query.isError)
    return (
      <div className="notice error" role="alert">
        {errorText(query.error)} <button onClick={() => query.refetch()}>Retry</button>
      </div>
    );
  if (
    !query.data ||
    (Array.isArray(query.data) && !query.data.length) ||
    (Array.isArray(query.data.items) && !query.data.items.length)
  )
    return <p className="notice">{empty}</p>;
  return children(query.data);
}
export const Tags = ({ items = [] }) =>
  items.length ? (
    <div className="tags">
      {items.map((item, index) => (
        <span key={index}>{item}</span>
      ))}
    </div>
  ) : null;
export const Title = ({ label, title, children, heading: _Heading = 'h1' }) => (
  <div className="page-title">
    {label && <p className="eyebrow">{label}</p>}
    <_Heading>{title}</_Heading>
    {children && <p>{children}</p>}
  </div>
);
export const label = (value) =>
  (value || '').replaceAll('_', ' ').replace(/^./, (text) => text.toUpperCase());
export const date = (value) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '';
export function Pager({ data, page, onPage }) {
  return (
    data.pages > 1 && (
      <div className="pager">
        <Button disabled={page === 1} variant="outline" onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span>
          Page {page} of {data.pages}
        </span>
        <Button disabled={page >= data.pages} variant="outline" onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    )
  );
}
const demoStartupStyles = {
  'demo-greenspark': ['green', Leaf],
  'demo-innovatehub': ['design', ChartNoAxesColumnIncreasing],
  'demo-techconnect-labs': ['tech', CodeXml],
  'demo-greensphere': ['energy', Leaf],
  'demo-campuslink': ['campus', UsersRound],
  'demo-eduspark': ['learning', GraduationCap],
  'demo-healthnova': ['health', HeartPulse],
};

export function StartupCover({ item }) {
  const theme = item.sample && demoStartupStyles[item.slug]?.[0];
  return (
    <span className={'startup-cover' + (theme ? ' startup-cover-' + theme : '')} aria-hidden="true">
      {item.banner && <img src={item.banner} alt="" />}
    </span>
  );
}

export function StartupMark({ item, branded = true }) {
  const Icon = branded && item.sample && demoStartupStyles[item.slug]?.[1];
  return (
    <span className="tile startup-mark" aria-hidden="true">
      {item.logo ? (
        <img src={item.logo} alt="" loading="lazy" />
      ) : Icon ? (
        <Icon size={27} />
      ) : (
        item.name[0]
      )}
    </span>
  );
}

export function StartupCard({ item, action, directory = false }) {
  const location = [item.location, item.startupStage].filter(Boolean).join(' · ');
  return (
    <article className={'card startup-card' + (directory ? ' startup-directory-card' : '')}>
      <div className="card-top">
        {directory && <StartupCover item={item} />}
        <StartupMark item={item} branded={directory} />
        <span className="tag">{item.industry}</span>
      </div>
      <h3>{item.name}</h3>
      {location && (
        <p className="meta startup-card-location">
          {directory && <MapPin size={15} aria-hidden="true" />} {location}
        </p>
      )}
      <p>{item.description}</p>
      <Tags items={item.requiredSkills} />
      <p className="meta">
        {item.sample
          ? 'Demo profile'
          : item.verificationStatus === 'verified'
            ? 'Verified startup'
            : label(item.verificationStatus)}
        {item.activeOpportunities !== undefined && ' · ' + item.activeOpportunities + ' open'}
      </p>
      <Button to={'/startups/' + item.slug} variant="outline">
        View Profile <External />
      </Button>
      {action}
    </article>
  );
}
export function OpportunityCard({ item, action }) {
  return (
    <article className="card">
      <p className="eyebrow">
        {label(item.type)}
        {item.startupId?.name && ' · ' + item.startupId.name}
      </p>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <Tags items={item.requiredSkills} />
      <p className="meta">
        {label(item.workMode)} · Due {date(item.deadline)}
      </p>
      {action ?? (
        <Button to={'/opportunities/' + item._id} variant="outline">
          View Opportunity <External />
        </Button>
      )}
    </article>
  );
}
export function TalentPortrait({ user }) {
  const demo = user?.avatar?.match(/\/demo\/talent-portraits\.png#([0-5])$/);
  return (
    <span
      className={'tile talent-portrait' + (demo ? ' demo-portrait portrait-' + demo[1] : '')}
      aria-hidden="true"
    >
      {!demo &&
        (user?.avatar ? <img alt="" src={user.avatar} loading="lazy" /> : user?.fullName?.[0])}
    </span>
  );
}

export function TalentCard({ item, action, showcase = false }) {
  if (showcase) {
    return (
      <article className="card showcase-card">
        <div className="showcase-card-person">
          <TalentPortrait user={item.userId} />
          <div>
            <h3>
              {item.userId?.fullName} {item.userId?.sample && <span className="tag">Demo</span>}
            </h3>
            {item.education?.[0] && (
              <p>
                <GraduationCap size={15} aria-hidden="true" /> {item.education[0]}
              </p>
            )}
            {item.location && (
              <p>
                <MapPin size={15} aria-hidden="true" /> {item.location}
              </p>
            )}
            <Tags items={item.skills} />
          </div>
        </div>
        <p className="showcase-card-bio">{item.bio || item.headline}</p>
        <div className="actions">
          <Button to={'/talent/' + item.userId?._id}>
            <Eye size={16} aria-hidden="true" /> View Profile
          </Button>
          {action}
        </div>
      </article>
    );
  }
  return (
    <article className="card">
      <TalentPortrait user={item.userId} />
      <h3>{item.userId?.fullName}</h3>
      <p>{item.headline}</p>
      <Tags items={item.skills} />
      <p className="meta">{[item.location, item.availability].filter(Boolean).join(' · ')}</p>
      <Button variant="outline" to={'/talent/' + item.userId?._id}>
        View Profile <External />
      </Button>
      {action}
    </article>
  );
}
