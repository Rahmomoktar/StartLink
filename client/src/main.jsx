import { Component, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { io } from 'socket.io-client';
import { base, renew, setListener } from './api';
import { Home, How, Information } from './home';
import { AuthForm, RegisterChoice } from './forms';
import { Directory, OpportunityDetail, StartupDetail, TalentDetail } from './discover';
import {
  AccountSettings,
  Applications,
  GraduateProfile,
  ManageOpportunities,
  Matches,
  OpportunityEditor,
  ReviewOpportunity,
  SavedStartups,
  StartupProfile,
  Workspace,
} from './workspace';
import { Connections, Messages, Notifications, StartupInbox } from './community';
import { AdminOverview, AdminSection } from './admin';
import { Overview } from './dashboard';
import { Button, Footer, Header, Title } from './ui';
import './styles.css';

function GraduateViews({ views }) {
  const [params] = useSearchParams();
  const current = views.find(([key]) => key === params.get('view')) || views[0];
  return (
    <>
      <nav className="graduate-views" aria-label="Page sections">
        {views.map(([key, title]) => (
          <Link
            key={key}
            to={key ? '?view=' + key : '.'}
            aria-current={key === current[0] ? 'page' : undefined}
          >
            {title}
          </Link>
        ))}
      </nav>
      {current[2]}
    </>
  );
}

class ErrorBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <section className="shell section">
        <Title title="Something went wrong">Reload STARTLINK to continue.</Title>
        <Button onClick={() => location.reload()}>Reload</Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
const landing = (user) => (user.role === 'admin' ? '/admin' : '/' + user.role + '/dashboard');
function Protected({ session, role, children }) {
  const { pathname, search } = useLocation();
  if (session === undefined)
    return (
      <div className="shell skeleton" role="status">
        <span className="sr-only">Checking your session…</span>
      </div>
    );
  if (!session)
    return <Navigate to={'/login?returnTo=' + encodeURIComponent(pathname + search)} replace />;
  if (session.user.role !== role) return <Navigate to={landing(session.user)} replace />;
  return children;
}
function App() {
  const [session, setSession] = useState(undefined);
  const user = session?.user;
  const cache = useQueryClient();
  const { pathname } = useLocation();
  const graduateWorkspace = user?.role === 'graduate' && /^\/graduate(?:\/|$)/.test(pathname);
  const startupWorkspace = user?.role === 'startup' && /^\/startup(?:\/|$)/.test(pathname);
  useEffect(() => {
    let previous;
    setListener((next) => {
      if (previous?._id !== next?.user?._id) cache.clear();
      previous = next?.user;
      setSession(next);
    });
    renew().catch(() => {});
    return () => setListener(() => {});
  }, [cache]);
  useEffect(() => {
    if (!session?.accessToken) return;
    const socket = io(base || undefined, {
      auth: { token: session.accessToken },
      transports: ['websocket', 'polling'],
    });
    const updates = ({ conversationId } = {}) =>
      cache.invalidateQueries({
        predicate: ({ queryKey }) => {
          const [path] = queryKey;
          return (
            path.startsWith('/notifications') ||
            path === '/conversations' ||
            path.startsWith('/conversations?') ||
            path === '/conversations/' + conversationId + '/messages'
          );
        },
      });
    socket.on('connect', updates);
    socket.on('notification', updates);
    socket.on('message', updates);
    const refresh = setTimeout(() => renew().catch(() => {}), 8 * 60 * 1000);
    return () => {
      clearTimeout(refresh);
      socket.disconnect();
    };
  }, [cache, session?.accessToken]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      {graduateWorkspace ? (
        <a className="skip" href="#main">
          Skip to content
        </a>
      ) : (
        <Header
          user={user}
          startupInbox={startupWorkspace ? <StartupInbox key={'inbox:' + pathname} user={user} /> : undefined}
        />
      )}
      <main id="main" className={pathname === '/' ? 'home-page' : 'platform-page'}>
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/how-it-works" element={<How />} />
            {['privacy', 'terms', 'contact'].map((kind) => (
              <Route path={'/' + kind} key={kind} element={<Information kind={kind} />} />
            ))}
            <Route
              path="/discover-startups"
              element={<Directory key="startups" kind="startups" user={user} />}
            />
            <Route path="/startups/:slug" element={<StartupDetail user={user} />} />
            <Route
              path="/talent"
              element={<Directory key="graduates" kind="graduates" user={user} />}
            />
            <Route path="/talent/:id" element={<TalentDetail user={user} />} />
            <Route
              path="/opportunities"
              element={<Directory key="opportunities" kind="opportunities" user={user} />}
            />
            <Route path="/opportunities/:id" element={<OpportunityDetail user={user} />} />
            <Route path="/register" element={<RegisterChoice />} />
            {['graduate', 'startup'].map((role) => (
              <Route
                key={role}
                path={'/register/' + role}
                element={<AuthForm key={role} mode="register" role={role} />}
              />
            ))}
            {['login', 'forgot-password', 'reset-password', 'verify-email'].map((mode) => (
              <Route path={'/' + mode} key={mode} element={<AuthForm key={mode} mode={mode} />} />
            ))}
            {['graduate', 'startup'].map((role) => (
              <Route
                key={role}
                path={'/' + role}
                element={
                  <Protected session={session} role={role}>
                    <Workspace user={user} />
                  </Protected>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Overview user={user} />} />
                <Route
                  path="profile"
                  element={
                    role === 'graduate' ? (
                      <GraduateViews
                        views={[
                          ['', 'Profile', <GraduateProfile key="profile" user={user} />],
                          ['edit', 'Edit Profile', <GraduateProfile key="edit" user={user} edit />],
                          ['settings', 'Account Settings', <AccountSettings />],
                        ]}
                      />
                    ) : (
                      <StartupProfile user={user} />
                    )
                  }
                />
                <Route
                  path="profile/edit"
                  element={
                    role === 'graduate' ? (
                      <Navigate to="/graduate/profile?view=edit" replace />
                    ) : (
                      <StartupProfile user={user} edit />
                    )
                  }
                />
                <Route
                  path="applications"
                  element={<Applications startup={role === 'startup'} />}
                />
                <Route
                  path="matches"
                  element={
                    role === 'graduate' ? (
                      <GraduateViews
                        views={[
                          ['', 'Recommendations', <Matches user={user} />],
                          ['saved', 'Saved Startups', <SavedStartups />],
                        ]}
                      />
                    ) : (
                      <Matches user={user} />
                    )
                  }
                />
                <Route
                  path="connections"
                  element={
                    role === 'graduate' ? (
                      <Navigate to="/graduate/messages?view=connections" replace />
                    ) : (
                      <Connections user={user} />
                    )
                  }
                />
                <Route
                  path="messages"
                  element={
                    role === 'graduate' ? (
                      <GraduateViews
                        views={[
                          ['', 'Conversations', <Messages user={user} />],
                          ['connections', 'Connections', <Connections user={user} />],
                          ['notifications', 'Notifications', <Notifications user={user} />],
                        ]}
                      />
                    ) : (
                      <Messages user={user} />
                    )
                  }
                />
                <Route
                  path="notifications"
                  element={
                    role === 'graduate' ? (
                      <Navigate to="/graduate/messages?view=notifications" replace />
                    ) : (
                      <Notifications user={user} />
                    )
                  }
                />
                <Route
                  path="settings"
                  element={
                    role === 'graduate' ? (
                      <Navigate to="/graduate/profile?view=settings" replace />
                    ) : (
                      <AccountSettings />
                    )
                  }
                />
                {role === 'graduate' ? (
                  <Route
                    path="saved-startups"
                    element={<Navigate to="/graduate/matches?view=saved" replace />}
                  />
                ) : (
                  <>
                    <Route path="talent" element={<Directory kind="graduates" user={user} />} />
                    <Route path="opportunities" element={<ManageOpportunities />} />
                    <Route path="opportunities/new" element={<OpportunityEditor />} />
                    <Route path="opportunities/:id/edit" element={<OpportunityEditor />} />
                    <Route path="opportunities/:id/review" element={<ReviewOpportunity />} />
                  </>
                )}
              </Route>
            ))}
            <Route
              path="/admin"
              element={
                <Protected session={session} role="admin">
                  <Workspace user={user} />
                </Protected>
              }
            >
              <Route index element={<AdminOverview />} />
              {[
                'users',
                'startups',
                'verifications',
                'opportunities',
                'reports',
                'categories',
                'audit-logs',
              ].map((section) => (
                <Route
                  path={section}
                  key={section}
                  element={<AdminSection key={section} section={section} />}
                />
              ))}
              <Route path="settings" element={<AccountSettings />} />
            </Route>
            <Route
              path="*"
              element={
                <section className="shell section">
                  <Title title="Page Not Found" />
                  <Button to="/">Back to Home</Button>
                </section>
              }
            />
          </Routes>
        </ErrorBoundary>
      </main>
      {!graduateWorkspace && !startupWorkspace && <Footer />}
      <Toaster richColors position="top-center" />
    </>
  );
}
const queryClient = new QueryClient();
createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);
