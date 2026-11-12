import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import { toast } from 'sonner';
import { base, errorText, request, useAction, useData } from './api';
import { Form } from './forms';
import { Button, Result } from './ui';

const endpoint = (kind, subject) => '/videos/' + kind + '/' + subject;
const duration = { promo: '5 minutes', startup: '3 minutes', graduate: '2 minutes' };
const heading = {
  promo: 'Meet STARTLINK',
  startup: 'Founder introduction',
  graduate: 'Video introduction',
};

export function VideoPlayer({ video, title }) {
  return (
    <video
      key={video.version}
      className="profile-video"
      controls
      playsInline
      preload="metadata"
      aria-label={title}
      poster={base + '/api/v1' + video.thumbnail}
      src={base + '/api/v1' + video.url}
    />
  );
}

export function ProfileVideo({ kind, subject, user }) {
  const path = endpoint(kind, subject);
  const query = useData(path);
  const [report, setReport] = useState(false);
  if (!query.data && kind !== 'promo') return null;
  return (
    <section className={kind === 'promo' ? 'shell promo-video-section' : 'profile-video-section'}>
      <h2>{heading[kind]}</h2>
      {kind === 'promo' && (
        <p>
          See how STARTLINK connects graduates with startups, projects, and practical challenges.
        </p>
      )}
      {query.data ? (
        <>
          <VideoPlayer video={query.data} title={heading[kind]} />
          {user?.emailVerified && kind !== 'promo' && (
            <>
              <Button variant="outline" aria-expanded={report} onClick={() => setReport(!report)}>
                {report ? 'Cancel report' : 'Report video'}
              </Button>
              {report && (
                <Form
                  fields={[{ name: 'reason', label: 'Reason', required: true }]}
                  submit="Send Report"
                  onSubmit={async ({ reason }) => {
                    await request(path + '/report', 'post', {
                      reason,
                      version: query.data.version,
                    });
                    setReport(false);
                    toast.success('Video report submitted.');
                  }}
                />
              )}
            </>
          )}
        </>
      ) : (
        <p className="notice">
          {query.isPending ? 'Loading video…' : 'The promotional video is coming soon.'}
        </p>
      )}
    </section>
  );
}

function VideoUpload({ kind, subject, data }) {
  const path = endpoint(kind, subject);
  const { video, available } = data;
  const cache = useQueryClient();
  const action = useAction();
  const [visibility, setVisibility] = useState(
    video?.visibility || (kind === 'promo' ? 'public' : 'restricted'),
  );
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const busy = progress !== null || action.isPending;

  async function upload(event) {
    event.preventDefault();
    if (!file || busy) return;
    if (file.size > 32 * 1024 * 1024) {
      setError('Choose a file up to 32 MB.');
      return;
    }
    const form = new FormData();
    form.append('visibility', visibility);
    form.append('file', file);
    setError('');
    setProgress(0);
    try {
      await request(path, 'put', form, {
        onUploadProgress: ({ loaded, total }) => {
          if (total) setProgress(Math.round((loaded / total) * 100));
        },
      });
      await cache.invalidateQueries();
      toast.success(video ? 'Video replaced.' : 'Video uploaded.');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setProgress(null);
    }
  }

  return (
    <form className="stack video-upload" onSubmit={upload}>
      {video?.hidden && <p className="notice">This video was hidden by a moderator.</p>}
      {video && !video.hidden && <VideoPlayer video={video} title={heading[kind]} />}
      {kind !== 'promo' && (
        <label className="field">
          Video visibility
          <select
            value={visibility}
            disabled={busy}
            onChange={(event) => setVisibility(event.target.value)}
          >
            <option value="restricted">Restricted</option>
            <option value="public">Public</option>
          </select>
          <small>
            {kind === 'graduate'
              ? 'Public videos are visible to startup accounts when your talent profile is visible.'
              : 'Public videos appear on verified, visible startup profiles.'}
          </small>
        </label>
      )}
      {available ? (
        <label className="field">
          {video ? 'Replacement video' : 'Upload video'}
          <input
            type="file"
            accept=".mp4,.webm,video/mp4,video/webm"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files[0]);
              setError('');
            }}
          />
          <small>
            MP4 or WebM · Up to 32 MB and {duration[kind]}. Recorded and AI-generated videos are
            supported.
          </small>
        </label>
      ) : (
        <p className="notice">Video storage is unavailable.</p>
      )}
      {progress !== null && (
        <div className="stack" role="status">
          <progress aria-label="Video upload progress" max={100} value={progress} />
          <span>{progress === 100 ? 'Processing video…' : 'Uploading ' + progress + '%'}</span>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        {available && (
          <Button type="submit" disabled={busy || !file}>
            {video ? 'Replace Video' : 'Upload Video'}
          </Button>
        )}
        {video && kind !== 'promo' && (
          <Button
            variant="outline"
            disabled={busy || visibility === video.visibility}
            onClick={() =>
              action.mutate(
                { path, method: 'patch', data: { visibility } },
                {
                  onSuccess: () => toast.success('Video visibility updated.'),
                },
              )
            }
          >
            Save Visibility
          </Button>
        )}
        {video && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Remove this video?'))
                action.mutate(
                  { path, method: 'delete' },
                  {
                    onSuccess: () => toast.success('Video removed.'),
                  },
                );
            }}
          >
            Remove Video
          </Button>
        )}
      </div>
    </form>
  );
}

export function VideoManager({ kind, subject }) {
  const query = useData(endpoint(kind, subject) + '/manage');
  return (
    <section className="card video-manager">
      <h2>
        <Film size={20} aria-hidden="true" />{' '}
        {kind === 'promo' ? 'Homepage promotional video' : heading[kind]}
      </h2>
      <Result query={query}>
        {(data) => (
          <VideoUpload
            key={data.video?.version || 'new'}
            kind={kind}
            subject={subject}
            data={data}
          />
        )}
      </Result>
    </section>
  );
}
