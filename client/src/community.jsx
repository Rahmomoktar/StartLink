import { useEffect, useRef, useState } from 'react';
import { Bell, MessageCircle, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { request, search, useAction, useData } from './api';
import { Form, Mutate, ReportForm, split } from './forms';
import { Button, date, label, Result, Title } from './ui';

export function Connections({ user }) {
  const query = useData('/connections');
  return (
    <>
      <Title title="Connections">Manage invitations and the people you collaborate with.</Title>
      <Result
        query={query}
        empty="No connections yet. Discover startups or talent to send a request."
      >
        {(rows) => (
          <div className="stack">
            {rows.map((row) => {
              const path = '/connections/' + row._id;
              const pending = row.status === 'pending';
              const incoming = row.recipientUserId === user._id;
              const status = (value, text, confirm) => (
                <Mutate path={path} method="patch" data={{ status: value }} confirm={confirm}>
                  {text}
                </Mutate>
              );
              return (
                <article className="card" key={row._id}>
                  <h3>{row.otherName || 'STARTLINK member'}</h3>
                  <p className="meta">
                    {label(row.status)} · {date(row.createdAt)}
                  </p>
                  <p className="preserve">{row.message}</p>
                  <div className="actions">
                    {pending && incoming && (
                      <>
                        {status('accepted', 'Accept')}
                        {status('declined', 'Decline')}
                      </>
                    )}
                    {pending && !incoming && status('cancelled', 'Cancel Request')}
                    {row.status === 'accepted' && (
                      <>
                        <Button to={'/' + user.role + '/messages'}>Open Messages</Button>
                        <Mutate path={path} method="delete" confirm="Remove this connection?">
                          Remove
                        </Mutate>
                      </>
                    )}
                    {row.status !== 'blocked' &&
                      status('blocked', 'Block', 'Block this connection?')}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Result>
    </>
  );
}
export function Notifications({ user, popup = false }) {
  const [page, setPage] = useState(1);
  const query = useData(search('/notifications', { page }));
  const action = useAction();
  return (
    <>
      {popup ? (
        <p>{query.data?.unread ?? 0} unread</p>
      ) : (
        <Title title="Notifications">{query.data?.unread ?? 0} unread</Title>
      )}
      <Mutate path="/notifications/read-all" method="patch" disabled={!query.data?.unread}>
        Mark All as Read
      </Mutate>
      <Result query={query} empty="You’re all caught up.">
        {(data) => (
          <div className="stack">
            {data.items.map((item) => (
              <article className="card list-row" key={item._id}>
                <div>
                  <h3>
                    {item.title}
                    {!item.readAt && <span className="tag">Unread</span>}
                  </h3>
                  <p>{item.body}</p>
                  <small>{date(item.createdAt)}</small>
                </div>
                {!item.readAt && (
                  <Mutate path={'/notifications/' + item._id + '/read'} method="patch">
                    Mark Read
                  </Mutate>
                )}
              </article>
            ))}
          </div>
        )}
      </Result>
      {query.data?.pages > 1 && (
        <div className="pager">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {query.data.pages}
          </span>
          <Button
            variant="outline"
            disabled={page >= query.data.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <article className="card">
        <h2>Notification Preferences</h2>
        <Form
          fields={[
            {
              name: 'mutedNotifications',
              label: 'Muted notification types',
              parse: split,
              hint: 'Options: connection, application, submission, message, verification, opportunity.',
            },
          ]}
          initial={{ mutedNotifications: user.mutedNotifications?.join(', ') }}
          onSubmit={async (data) => {
            await action.mutateAsync({ path: '/notifications/preferences', method: 'patch', data });
            toast.success('Preferences updated.');
          }}
        />
      </article>
    </>
  );
}
function Chat({ item, user }) {
  const endpoint = '/conversations/' + item._id;
  const query = useData(endpoint + '/messages');
  const client = useQueryClient();
  const [history, setHistory] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const latest = query.data?.items.at(-1)?._id;
  useEffect(() => {
    if (latest)
      request(endpoint + '/read', 'patch', { through: latest })
        .then(() => {
          client.invalidateQueries({
            predicate: ({ queryKey }) =>
              queryKey[0] === '/conversations' || queryKey[0].startsWith('/conversations?'),
          });
        })
        .catch(() => {});
  }, [client, endpoint, latest]);
  const next = cursor === null ? query.data?.next : cursor;
  async function older() {
    setLoading(true);
    try {
      const data = await request(search(endpoint + '/messages', { before: next }));
      setHistory((previous) => [...data.items, ...previous]);
      setCursor(data.next || '');
    } catch {
      toast.error('Could not load earlier messages.');
    } finally {
      setLoading(false);
    }
  }
  async function send(event) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const message = await request(endpoint + '/messages', 'post', { body: draft });
      client.setQueryData(
        [endpoint + '/messages'],
        (old) =>
          old && {
            ...old,
            items: old.items.some((row) => row._id === message._id)
              ? old.items
              : [...old.items, message],
          },
      );
      client.invalidateQueries({ queryKey: [endpoint + '/messages'] });
      setDraft('');
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Could not send your message.');
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="chat-main">
      <h2>{item.other.fullName}</h2>
      <Result query={query} empty="No messages yet.">
        {(data) => (
          <div className="message-history" role="log" aria-label="Message history">
            {next && (
              <Button variant="outline" disabled={loading} onClick={older}>
                Load Earlier Messages
              </Button>
            )}
            {!data.items.length && <p className="notice">Start the conversation with a message.</p>}
            {[...history, ...data.items].map((message) => (
              <div
                className={'bubble ' + (message.senderId === user._id ? 'mine' : '')}
                key={message._id}
              >
                <p className="preserve">{message.body}</p>
                <small>
                  {new Date(message.createdAt).toLocaleString()}
                  {message.senderId === user._id &&
                    message.readBy.includes(item.other._id) &&
                    ' · Read'}
                </small>
                {message.senderId !== user._id && <ReportForm id={message._id} type="message" />}
              </div>
            ))}
          </div>
        )}
      </Result>
      <form className="chat-compose" onSubmit={send}>
        <label htmlFor="message-draft" className="sr-only">
          Message
        </label>
        <textarea
          id="message-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message…"
          rows={2}
          maxLength={2000}
          required
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
export function Messages({ user, popup = false }) {
  const [params, setParams] = useSearchParams();
  const [popupConversation, setPopupConversation] = useState(null);
  const [q, setQuery] = useState('');
  const query = useData(search('/conversations', { q }));
  const active = popup ? popupConversation : params.get('conversation');
  const selectConversation = (id) => {
    if (popup) setPopupConversation(id);
    else setParams(id ? { conversation: id } : {});
  };
  const selected = query.data?.find((item) => item._id === active);
  return (
    <>
      {!popup && <Title title="Messages" />}
      <div className={'chat ' + (selected ? 'chat-active' : '')}>
        <aside className="chat-list">
          <label className="field">
            Find a conversation
            <input type="search" value={q} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <Result query={query} empty="Accept a connection to start messaging.">
            {(items) => (
              <div className="stack">
                {items.map((item) => (
                  <button
                    className="conversation"
                    type="button"
                    aria-pressed={active === item._id}
                    key={item._id}
                    onClick={() => selectConversation(item._id)}
                  >
                    {item.other.fullName}
                    {item.unread > 0 && <span className="tag">{item.unread} unread</span>}
                  </button>
                ))}
              </div>
            )}
          </Result>
        </aside>
        <div className="chat-content">
          {selected ? (
            <>
              <Button
                className="mobile-back"
                variant="outline"
                onClick={() => selectConversation(null)}
              >
                Back to Conversations
              </Button>
              <Chat key={selected._id} item={selected} user={user} />
            </>
          ) : (
            <p className="notice">Select a conversation.</p>
          )}
        </div>
      </div>
    </>
  );
}

export function StartupInbox({ user }) {
  const dialog = useRef(null);
  const [panel, setPanel] = useState(null);
  const alerts = useData('/notifications');
  const conversations = useData('/conversations');
  const unreadMessages = conversations.data?.reduce((total, row) => total + row.unread, 0) || 0;
  const unreadAlerts = alerts.data?.unread || 0;
  function open(name) {
    setPanel(name);
    dialog.current.showModal();
  }
  return (
    <>
      <button
        className="startup-inbox-trigger"
        type="button"
        aria-label="Messages"
        aria-haspopup="dialog"
        onClick={() => open('Messages')}
      >
        <MessageCircle size={22} aria-hidden="true" />
        {unreadMessages > 0 && <span className="startup-inbox-count">{unreadMessages}</span>}
      </button>
      <button
        className="startup-inbox-trigger"
        type="button"
        aria-label="Notifications"
        aria-haspopup="dialog"
        onClick={() => open('Notifications')}
      >
        <Bell size={22} aria-hidden="true" />
        {unreadAlerts > 0 && <span className="startup-inbox-count">{unreadAlerts}</span>}
      </button>
      <dialog
        className="startup-inbox"
        aria-labelledby="startup-inbox-title"
        ref={dialog}
        onClose={() => setPanel(null)}
      >
        <div className="startup-inbox-heading">
          <h2 id="startup-inbox-title">{panel}</h2>
          <button type="button" aria-label="Close popup" onClick={() => dialog.current.close()}>
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <div className="startup-inbox-body">
          {panel === 'Messages' && <Messages user={user} popup />}
          {panel === 'Notifications' && <Notifications user={user} popup />}
        </div>
      </dialog>
    </>
  );
}
