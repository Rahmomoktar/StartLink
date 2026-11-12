import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { downloadPrivate, errorText, request, setSession, useAction } from './api';
import { Button, External, Title } from './ui';

export const split = (value) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
export function Attachment({ value }) {
  return value.startsWith('asset:') ? (
    <Button
      variant="outline"
      onClick={() =>
        downloadPrivate(value).catch(() => toast.error('Unable to download this file.'))
      }
    >
      Download Attachment
    </Button>
  ) : (
    <a href={value} target="_blank" rel="noreferrer">
      {value}
    </a>
  );
}
export function Form({ fields, initial = {}, onSubmit, submit = 'Save Changes', busy = false }) {
  const id = useId();
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm({
    defaultValues: Object.fromEntries(
      fields.map((field) => [
        field.name,
        initial[field.name] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : ''),
      ]),
    ),
  });
  async function upload(field, file) {
    if (!file) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      if (typeof field.upload === 'string') {
        const { reference } = await request('/files/' + field.upload, 'post', form);
        const current = getValues(field.name);
        setValue(field.name, [current, reference].filter(Boolean).join(', '));
      } else setValue(field.name, (await request('/uploads/image', 'post', form)).url);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setUploading(false);
    }
  }
  return (
    <form
      className="form"
      onSubmit={handleSubmit(async (values) => {
        setError('');
        try {
          const payload = Object.fromEntries(
            fields
              .map((field) => [
                field.name,
                field.parse ? field.parse(values[field.name]) : values[field.name],
              ])
              .filter(([, value]) => value !== undefined),
          );
          await onSubmit(payload);
        } catch (failure) {
          setError(errorText(failure));
        }
      })}
    >
      {fields.map((field) => {
        const key = id + '-' + field.name;
        const props = {
          ...register(field.name),
          id: key,
          required: field.required,
          autoComplete: field.autoComplete,
          'aria-describedby': field.hint ? key + '-hint' : undefined,
        };
        return (
          <div className={'field ' + (field.type === 'checkbox' ? 'check' : '')} key={field.name}>
            {field.type === 'checkbox' && <input type="checkbox" {...props} />}
            <label htmlFor={key}>{field.label}</label>
            {field.options ? (
              <select {...props}>
                {field.options.map((option) =>
                  typeof option === 'string' ? (
                    <option key={option}>{option}</option>
                  ) : (
                    <option key={option[0]} value={option[0]}>
                      {option[1]}
                    </option>
                  ),
                )}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea rows={4} {...props} />
            ) : (
              field.type !== 'checkbox' && (
                <input type={field.type || 'text'} min={field.min} max={field.max} {...props} />
              )
            )}
            {field.upload && (
              <input
                type="file"
                accept={
                  typeof field.upload === 'string'
                    ? 'application/pdf,image/jpeg,image/png,image/webp'
                    : 'image/jpeg,image/png,image/webp'
                }
                aria-label={'Upload ' + field.label.toLowerCase()}
                disabled={uploading}
                onChange={(event) => upload(field, event.target.files[0])}
              />
            )}
            {field.hint && <small id={key + '-hint'}>{field.hint}</small>}
          </div>
        );
      })}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || isSubmitting || uploading}>
        {isSubmitting ? 'Saving…' : submit}
      </Button>
    </form>
  );
}
export function Mutate({
  children,
  path,
  data,
  method = 'post',
  variant = 'outline',
  confirm,
  success = 'Saved',
  onDone,
  ...props
}) {
  const mutation = useAction();
  return (
    <Button
      {...props}
      variant={variant}
      disabled={mutation.isPending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        mutation.mutate(
          { path, method, data },
          {
            onSuccess: (result) => {
              if (success) toast.success(success);
              onDone?.(result);
            },
          },
        );
      }}
    >
      {children}
    </Button>
  );
}
export function ReportForm({ id, type }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Cancel report' : 'Report'}
      </Button>
      {open && (
        <Form
          submit="Send Report"
          fields={[
            { name: 'reason', label: 'Reason', required: true },
            { name: 'description', label: 'Details', type: 'textarea' },
          ]}
          onSubmit={async (data) => {
            await request('/reports', 'post', {
              ...data,
              reportedEntityId: id,
              reportedEntityType: type,
            });
            setOpen(false);
            toast.success('Report submitted.');
          }}
        />
      )}
    </div>
  );
}
export function RegisterChoice() {
  return (
    <section className="section shell">
      <Title label="Join STARTLINK" title="How will you use STARTLINK?">
        Choose an account to get started.
      </Title>
      <div className="grid two">
        <article className="card">
          <h2>Graduate</h2>
          <p>Share your work, find projects, and connect with startup teams.</p>
          <Button to="/register/graduate">
            Join as Graduate <External />
          </Button>
        </article>
        <article className="card">
          <h2>Startup</h2>
          <p>Publish opportunities and connect with emerging talent.</p>
          <Button to="/register/startup">
            Register Your Startup <External />
          </Button>
        </article>
      </div>
    </section>
  );
}
const pass = z.string().min(12, 'Use at least 12 characters.').max(128);
export function AuthForm({ mode, role }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const isRegister = mode === 'register';
  const fields = {
    login: [
      ['email', 'Email', 'email', 'email'],
      ['password', 'Password', 'password', 'current-password'],
    ],
    register: [
      ['fullName', 'Full name', 'text', 'name'],
      ['email', role === 'startup' ? 'Work email' : 'Email', 'email', 'email'],
      ['password', 'Password', 'password', 'new-password'],
      ['confirmPassword', 'Confirm password', 'password', 'new-password'],
    ],
    'forgot-password': [['email', 'Email', 'email', 'email']],
    'reset-password': [
      ['password', 'New password', 'password', 'new-password'],
      ['confirmPassword', 'Confirm password', 'password', 'new-password'],
    ],
    'verify-email': [],
  }[mode];
  const schema = z
    .object(
      Object.fromEntries(
        fields.map(([name]) => [
          name,
          name === 'email'
            ? z.email('Enter a valid email.')
            : name === 'fullName'
              ? z.string().trim().min(1, 'Enter your full name.').max(100)
              : mode === 'login'
                ? z.string().min(1, 'Enter your password.')
                : pass,
        ]),
      ),
    )
    .refine((data) => !('confirmPassword' in data) || data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords must match.',
    });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });
  const token = params.get('token');
  const title = {
    login: 'Welcome back',
    register: role === 'startup' ? 'Register your startup account' : 'Join as a graduate',
    'forgot-password': 'Reset your password',
    'reset-password': 'Choose a new password',
    'verify-email': 'Verify your email',
  }[mode];
  async function submit(values) {
    setStatus(null);
    try {
      const payload = isRegister
        ? { ...values, role }
        : mode === 'reset-password'
          ? { token, password: values.password }
          : mode === 'verify-email'
            ? { token }
            : values;
      const result = await request('/auth/' + mode, 'post', payload);
      if (mode === 'login') {
        setSession(result);
        const target = params.get('returnTo');
        const safeTarget =
          target?.startsWith('/') &&
          !target.startsWith('//') &&
          !target.includes(String.fromCharCode(92));
        navigate(
          safeTarget
            ? target
            : result.user.role === 'admin'
              ? '/admin'
              : '/' + result.user.role + '/dashboard',
          { replace: true },
        );
      } else setStatus({ text: result.message });
    } catch (error) {
      setStatus({ text: errorText(error), error: true });
    }
  }
  const tokenMissing = ['verify-email', 'reset-password'].includes(mode) && !token;
  return (
    <section className="shell section auth-wrap">
      <div className="card auth-card">
        <Title label="STARTLINK account" title={title} />
        {tokenMissing ? (
          <p className="notice error">Open the link sent to your email.</p>
        ) : (
          <form className="form" onSubmit={handleSubmit(submit)}>
            {fields.map(([name, label, type, autoComplete]) => (
              <div className="field" key={name}>
                <label htmlFor={name}>{label}</label>
                <input
                  id={name}
                  type={type}
                  autoComplete={autoComplete}
                  required
                  aria-invalid={!!errors[name]}
                  aria-describedby={errors[name] ? name + '-error' : undefined}
                  {...register(name)}
                />
                {errors[name] && (
                  <small className="invalid" id={name + '-error'}>
                    {errors[name].message}
                  </small>
                )}
              </div>
            ))}
            {isRegister && (
              <p className="meta">
                Use 12 or more characters. By creating an account you agree to the{' '}
                <Link to="/terms">Terms of Service</Link>.
              </p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Please wait…'
                : {
                    login: 'Log In',
                    register: 'Create Account',
                    'forgot-password': 'Send Reset Link',
                    'reset-password': 'Set New Password',
                    'verify-email': 'Verify Email',
                  }[mode]}
            </Button>
          </form>
        )}
        {status && (
          <p
            role={status.error ? 'alert' : 'status'}
            className={'notice ' + (status.error ? 'error' : '')}
          >
            {status.text}
          </p>
        )}
        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <Link to="/forgot-password">Forgot password?</Link>
              <Link to="/register">Create an account</Link>
            </>
          ) : (
            <Link to="/login">Back to login</Link>
          )}
        </div>
      </div>
    </section>
  );
}
