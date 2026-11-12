import { useState } from 'react';
import { ProfileVideo } from './videos';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import {
  ChartNoAxesColumnIncreasing,
  Building2,
  Layers,
  Play,
  Rocket,
  Search,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { search, useData } from './api';
import { Follow } from './discover';
import { Button, External, Forward, OpportunityCard, Result, StartupCard, Title } from './ui';

const benefits = [
  [
    Building2,
    'Discover Startups',
    'Explore startups, founders, industries, and business activities.',
    'Explore Startups',
    '/discover-startups',
  ],
  [
    UsersRound,
    'Talent Showcase',
    'Present your skills, education, certificates, and completed projects.',
    'Showcase Your Talent',
    '/graduate/profile/edit',
  ],
  [
    Rocket,
    'Build With Us',
    'Join startup projects and participate in practical challenges.',
    'Explore Opportunities',
    '/opportunities',
  ],
  [
    Layers,
    'Smart Matching',
    'Connect with startups and graduates based on relevant skills and interests.',
    'See Your Matches',
    '/graduate/matches',
  ],
];
const steps = {
  graduate: [
    [
      'Create Your Profile',
      'Add your skills, interests, and projects to show how you like to work.',
    ],
    [
      'Discover & Get Matched',
      'Explore startups, projects, and challenges. See why an opportunity matches your profile.',
    ],
    [
      'Connect & Collaborate',
      'Send connection requests, join projects, and grow your professional network.',
    ],
  ],
  startup: [
    [
      'Register Your Startup',
      'Create a company profile, tell us what you’re building, and submit it for verification.',
    ],
    [
      'Publish Projects & Challenges',
      'Share clear deliverables, timelines, terms, and the skills you need.',
    ],
    [
      'Find & Connect With Talent',
      'Review applications, discover graduates, and invite the right people to connect.',
    ],
  ],
};
function Preview() {
  const reduce = useReducedMotion();
  return (
    <Motion.div
      className="preview-wrap"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      aria-label="Illustrative opportunities dashboard"
    >
      <div className="preview">
        <div className="preview-head">
          <div>
            <p className="eyebrow">Dashboard preview</p>
            <h2>Your Opportunities</h2>
          </div>
          <span className="preview-search">
            <Search size={17} />
          </span>
        </div>
        {[
          [
            'TC',
            'TechConnect Labs',
            'Software & Technology',
            ['React.js', 'UI/UX Design', 'Web Development'],
          ],
          [
            'IH',
            'InnovateHub',
            'Digital Solutions',
            ['Digital Marketing', 'Branding', 'Content Creation'],
          ],
        ].map(([initial, name, industry, skills]) => (
          <div className="preview-card" key={name}>
            <div className="preview-company">
              <span className="tile">{initial}</span>
              <div>
                <strong>{name}</strong>
                <small>{industry}</small>
              </div>
              <span className="matching">Matching</span>
            </div>
            <div className="tags">
              {skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="preview-note">
        <small>Your next connection</small>
        <strong>
          Starts here <External />
        </strong>
      </div>
      <div className="preview-alert">
        <span>
          <UsersRound size={22} aria-hidden="true" />
        </span>
        <div>
          <strong>Graduates &amp; startups</strong>
          <small>Find people to build with</small>
        </div>
      </div>
      <span className="preview-chart" aria-hidden="true">
        <ChartNoAxesColumnIncreasing size={30} />
      </span>
    </Motion.div>
  );
}
function Steps() {
  const [audience, setAudience] = useState('graduate');
  return (
    <section className="section shell steps" id="how-it-works">
      <div>
        <p className="eyebrow">How it works</p>
        <h2>
          Your Next Opportunity Is <em>Three Steps Away.</em>
        </h2>
        <p>Find the people and projects you want to work with.</p>
        <Button to={'/register/' + audience}>
          Get Started Today <Forward />
        </Button>
      </div>
      <div>
        <div className="segments" aria-label="How it works for">
          <button aria-pressed={audience === 'graduate'} onClick={() => setAudience('graduate')}>
            Graduates
          </button>
          <button aria-pressed={audience === 'startup'} onClick={() => setAudience('startup')}>
            Startups
          </button>
        </div>
        <ol>
          {steps[audience].map(([title, text], index) => (
            <li key={title}>
              <span className="step-index">{index + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
export const How = () => <Steps />;
export function Home({ user }) {
  const startups = useData('/startups');
  const saved = useData('/startups/saved', user?.role === 'graduate');
  const [type, setType] = useState('project');
  const opportunities = useData(search('/opportunities', { type }));
  return (
    <>
      <section className="hero dark">
        <div className="shell hero-grid">
          <div>
            <p className="hero-kicker">
              <span /> The future of startup connections
            </p>
            <h1>
              Where Talent Meets <em>Opportunity.</em>
            </h1>
            <p className="hero-description">
              Discover emerging startups, showcase your skills, and connect with teams building
              innovative solutions. Your next opportunity starts here.
            </p>
            <div className="actions">
              <Button variant="gold" to="/opportunities">
                Find Opportunities <External />
              </Button>
              <Button variant="ghost" to="/discover-startups">
                <Play size={16} aria-hidden="true" /> Explore Startups
              </Button>
            </div>
            <div className="hero-community">
              <Link to="/register/graduate">
                <UsersRound size={20} aria-hidden="true" /> For Graduates
              </Link>
              <Link to="/register/startup">
                <Rocket size={20} aria-hidden="true" /> For Startups
              </Link>
              <Link to="/graduate/matches">
                <Sparkles size={20} aria-hidden="true" /> Smart Matching
              </Link>
            </div>
          </div>
          <Preview />
        </div>
      </section>
      <ProfileVideo kind="promo" subject="official" user={user} />
      <section className="home-features" aria-label="What STARTLINK offers">
        <div className="shell">
          <div className="grid four">
            {benefits.map(([_Icon, title, description, cta, to]) => (
              <article className="card feature" key={title}>
                <span className="feature-icon">
                  <_Icon size={27} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <Link className="text-link" to={to}>
                  {cta} <External />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section soft home-featured">
        <div className="shell">
          <div className="section-heading home-featured-heading">
            <div>
              <p className="eyebrow">Featured Startups</p>
              <h2>Meet Promising Startups</h2>
            </div>
            <Button className="view-all-startups" variant="outline" to="/discover-startups">
              View All Startups <External />
            </Button>
          </div>
          <Result
            query={startups}
            empty="Verified startups will appear here as they join STARTLINK."
          >
            {(data) => (
              <div className="grid three">
                {data.items.slice(0, 3).map((item) => (
                  <StartupCard
                    key={item._id}
                    item={item}
                    action={
                      user?.role === 'graduate' ? (
                        <Follow item={item} saved={saved.data} />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </Result>
        </div>
      </section>
      <Steps />
      <section className="section shell build-section">
        <div className="build-panel">
          <p className="eyebrow">Build with us</p>
          <h2>Your skills deserve a real opportunity.</h2>
          <p>
            Get involved in startup projects, take on practical challenges, and meet founders who
            value your skills.
          </p>
          <div className="segments" aria-label="Opportunity type">
            <button aria-pressed={type === 'project'} onClick={() => setType('project')}>
              Join Projects
            </button>
            <button aria-pressed={type === 'challenge'} onClick={() => setType('challenge')}>
              Startup Challenges
            </button>
          </div>
          <Result
            query={opportunities}
            empty={'No active ' + (type === 'project' ? 'projects' : 'challenges') + ' right now.'}
          >
            {(data) => (
              <div className="grid three">
                {data.items.slice(0, 3).map((item) => (
                  <OpportunityCard key={item._id} item={item} />
                ))}
              </div>
            )}
          </Result>
          <Button to={'/opportunities?type=' + type}>
            Explore Opportunities <External />
          </Button>
        </div>
      </section>
      <section className="section dark center">
        <div className="shell">
          <p className="eyebrow">Your future starts here</p>
          <h2>
            Big Ideas Need the <em>Right People.</em>
          </h2>
          <p>Join a community of graduates, founders, and innovators.</p>
          <div className="actions">
            <Button variant="gold" to="/register/graduate">
              Join as Graduate <External />
            </Button>
            <Button variant="ghost" to="/register/startup">
              Register Your Startup <External />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
export function Information({ kind }) {
  const content = {
    privacy: [
      'Privacy Policy',
      'Your email and account details are used to operate your account. Graduate profiles appear in Talent Showcase only after you opt in. Certificates and submitted work are restricted to authorized viewers.',
    ],
    terms: [
      'Terms of Service',
      'Use STARTLINK respectfully and report abusive content. Opportunity owners must describe compensation, ownership, and confidentiality before publication. Submitting work does not transfer its ownership.',
    ],
    contact: [
      'Contact',
      'For an issue with a startup, opportunity, or message, use its report action. For account access, use the password reset form.',
    ],
  }[kind];
  return (
    <section className="shell section">
      <Title title={content[0]}>{content[1]}</Title>
      {kind === 'contact' && <Button to="/forgot-password">Reset Password</Button>}
    </section>
  );
}
