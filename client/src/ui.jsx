import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Menu, X, Bell } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { errorText } from './api';
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
export function Header({ user }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const dashboard = user?.role === 'admin' ? '/admin' : '/' + user?.role + '/dashboard';
  return (
    <header className="site-header">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="shell header-row">
        <div className="header-brand">
          <Logo />
          <div className="header-wordmark" aria-hidden="true">
            START<span>LINK</span>
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
          <div className="header-actions">
            {user ? (
              <>
                {user.role !== 'admin' && (
                  <Link
                    aria-label="Notifications"
                    onClick={close}
                    to={'/' + user.role + '/notifications'}
                  >
                    <Bell size={19} />
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
        </div>
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
export const Title = ({ label, title, children }) => (
  <div className="page-title">
    {label && <p className="eyebrow">{label}</p>}
    <h1>{title}</h1>
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
export function StartupCard({ item, action }) {
  return (
    <article className="card startup-card">
      <div className="card-top">
        <span className="tile">
          {item.logo ? <img src={item.logo} alt="" loading="lazy" /> : item.name[0]}
        </span>
        <span className="tag">{item.industry}</span>
      </div>
      <h3>{item.name}</h3>
      <p className="meta">{[item.location, item.startupStage].filter(Boolean).join(' · ')}</p>
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
export function TalentCard({ item, action }) {
  return (
    <article className="card">
      <div className="tile">
        {item.userId?.avatar ? <img alt="" src={item.userId.avatar} /> : item.userId?.fullName?.[0]}
      </div>
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
