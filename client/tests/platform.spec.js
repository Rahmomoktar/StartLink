import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const password = 'playwright-test-passphrase';
async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).toHaveURL(/\/(dashboard|admin)$/);
}
async function register(page, role, name, email) {
  await page.goto('/register/' + role);
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel(role === 'startup' ? 'Work email' : 'Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('status')).toContainText('verification link');
  const token = createHash('sha256').update(email).digest('hex');
  await page.goto('/verify-email?token=' + token);
  await expect
    .poll(async () => {
      const [response] = await Promise.all([
        page.waitForResponse(
          (entry) =>
            entry.url().endsWith('/api/v1/auth/verify-email') &&
            entry.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Verify Email' }).click(),
      ]);
      return response.status();
    })
    .toBe(200);
  await expect(page.getByText('Email verified.')).toBeVisible();
  await login(page, email);
}
test('homepage contrast, mobile navigation, and account validation', async ({ page }) => {
  await page.goto('/');
  const hero = page.getByRole('heading', { level: 1 });
  await expect(hero).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(hero.locator('em')).toHaveCSS('color', 'rgb(230, 180, 94)');
  await expect(page.getByRole('heading', { name: 'Big Ideas Need the Right People.' })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  const axe = async () =>
    expect(
      (
        await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      ).violations.map((item) => item.id),
    ).toEqual([]);
  await axe();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Discover Startups' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Discover Startups' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await axe();
  await page.goto('/graduate/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/register/graduate');
  await page.getByLabel('Full name').fill('Browser Graduate');
  await page.getByLabel('Email', { exact: true }).fill('different@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill('different-passphrase');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Passwords must match.')).toBeVisible();
  await axe();
});
test('publishes, applies, reviews, matches, and exchanges messages in real time', async ({
  browser,
}) => {
  const graduateContext = await browser.newContext();
  const startupContext = await browser.newContext();
  const adminContext = await browser.newContext();
  try {
    const graduate = await graduateContext.newPage();
    const startup = await startupContext.newPage();
    const admin = await adminContext.newPage();
    await register(startup, 'startup', 'Browser Founder', 'browser-founder@example.test');
    await expect(
      startup.getByRole('heading', { name: 'Startup Overview', exact: true }),
    ).toBeVisible();
    await expect(startup.getByRole('link', { name: /Active Projects/ })).toBeVisible();
    await expect(startup.getByRole('heading', { name: 'Company Profile' })).toBeVisible();
    await expect(
      startup.getByRole('navigation', { name: 'Workspace' }).getByRole('link'),
    ).toHaveText(['Overview', 'Projects & Challenges', 'Applications', 'Smart Matching']);
    await startup.goto('/startup/profile/edit');
    await startup.getByLabel('Company name').fill('Browser Labs');
    await startup.getByLabel('Description', { exact: true }).fill('Makes browser-based tools.');
    await startup.getByLabel('Industry', { exact: true }).fill('Technology');
    await startup.getByLabel('Location', { exact: true }).fill('Nairobi');
    await startup.getByLabel('Skills needed').fill('React');
    await startup.getByRole('button', { name: 'Save Changes' }).click();
    await expect(startup.getByText('Startup submitted for verification.')).toBeVisible();

    await login(admin, 'admin@example.test');
    await admin.goto('/admin/verifications');
    admin.once('dialog', (dialog) => dialog.accept());
    await admin.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(admin.getByText('No records in this section.')).toBeVisible();

    await startup.goto('/startup/opportunities/new');
    await startup.getByLabel('Title', { exact: true }).fill('Build a browser test');
    await startup
      .getByLabel('Description', { exact: true })
      .fill('Create a browser regression test.');
    await startup.getByLabel('Required skills').fill('React');
    await startup.getByLabel('Application deadline').fill('2090-01-01T12:00');
    await startup
      .getByLabel('Ownership, compensation and confidentiality')
      .fill('Paid project. Author retains ownership.');
    await startup.getByLabel('Status', { exact: true }).selectOption('published');
    await startup.getByRole('button', { name: 'Save Changes' }).click();
    await expect(startup.getByRole('heading', { name: 'Build a browser test' })).toBeVisible();

    await register(graduate, 'graduate', 'Browser Graduate', 'browser-graduate@example.test');
    await expect(graduate.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
    await expect(graduate.getByRole('contentinfo')).toHaveCount(0);
    const sidebar = await graduate
      .getByRole('navigation', { name: 'Workspace' })
      .locator('..')
      .boundingBox();
    expect(sidebar).toMatchObject({ x: 0, y: 0 });
    await expect(
      graduate.getByRole('navigation', { name: 'Workspace' }).getByRole('link'),
    ).toHaveText(['Overview', 'My Profile', 'My Applications', 'Smart Matching', 'Messages']);
    await graduate.goto('/graduate/profile/edit');
    await expect(graduate).toHaveURL(/\/graduate\/profile\?view=edit$/);
    await graduate.getByLabel('Skills', { exact: true }).fill('JavaScript');
    await graduate.getByRole('button', { name: 'Save Changes' }).click();
    await expect(graduate.getByText('Profile updated.')).toBeVisible();
    await graduate.goto('/graduate/matches');
    await expect(graduate.getByText('Skills to develop: React.')).toBeVisible();
    await graduate.goto('/graduate/profile/edit');
    await graduate.getByLabel('Skills', { exact: true }).fill('React');
    await graduate.getByRole('button', { name: 'Save Changes' }).click();
    await expect(graduate.getByText('Profile updated.')).toBeVisible();
    await graduate.goto('/graduate/matches');
    await expect(graduate.getByText('Shared required skills: React.')).toBeVisible();

    await graduate.goto('/opportunities');
    await graduate.getByRole('link', { name: 'View Opportunity' }).click();
    await graduate.getByLabel('Why are you interested?').fill('I write browser tests.');
    await graduate.getByLabel('Availability', { exact: true }).fill('Part time');
    await graduate.getByRole('button', { name: 'Send Application' }).click();
    await expect(graduate.getByText('Submitted. Track the status')).toBeVisible();
    await startup.goto('/startup/applications');
    await startup.getByRole('button', { name: 'Notifications', exact: true }).click();
    const alerts = startup.getByRole('dialog', { name: 'Notifications' });
    await expect(alerts.getByRole('button', { name: 'Mark All as Read' })).toBeEnabled();
    await alerts.getByRole('button', { name: 'Mark All as Read' }).click();
    await expect(alerts.getByText('0 unread', { exact: true })).toBeVisible();
    await startup.keyboard.press('Escape');
    await expect(alerts).not.toBeVisible();
    await startup.getByLabel('Application status').selectOption('accepted');
    await startup.getByRole('button', { name: 'Save Changes' }).click();
    await expect(startup.getByText(/Accepted ·/)).toBeVisible();

    await graduate.goto('/discover-startups');
    await graduate.getByRole('link', { name: 'View Profile' }).click();
    await graduate.getByRole('button', { name: 'Request Connection' }).click();
    await graduate.getByRole('button', { name: 'Send Request' }).click();
    await expect(graduate.getByText('Connection request sent.')).toBeVisible();
    await startup.goto('/startup/connections');
    await startup.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(startup.getByText(/Accepted ·/)).toBeVisible();
    await startup.getByRole('button', { name: 'Messages', exact: true }).click();
    await expect(startup.getByRole('dialog', { name: 'Messages' })).toBeVisible();
    await graduate.goto('/graduate/messages');
    await startup.getByRole('button', { name: 'Browser Graduate' }).click();
    await graduate.getByRole('button', { name: 'Browser Founder' }).click();
    await graduate
      .getByLabel('Message', { exact: true })
      .fill('Hello from the graduate dashboard.');
    await graduate.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(startup.getByText('Hello from the graduate dashboard.')).toBeVisible();
    await expect(graduate.getByText(/· Read$/)).toBeVisible();
  } finally {
    await Promise.all([graduateContext.close(), startupContext.close(), adminContext.close()]);
  }
});
