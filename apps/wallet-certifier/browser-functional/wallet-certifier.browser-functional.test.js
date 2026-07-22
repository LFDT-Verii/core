import { expect, test } from '@playwright/test';

const begin = async (page, capability) => {
  await page.goto('/');
  await page.getByLabel('Find your wallet').fill('velocity');
  await page.getByRole('button', { name: 'Search registry' }).click();
  await page
    .getByRole('button', { name: 'Select Velocity Test Wallet' })
    .click();
  await page.getByLabel('Your name').fill('Alex Example');
  await page.getByLabel('Work email').fill('alex@example.com');
  await page.getByLabel(new RegExp(`^Certify ${capability}`, 'i')).check();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Begin certification' }).click();
  const wallet = await popupPromise;
  await wallet.waitForLoadState();
  return wallet;
};

test('certifies issuing and renders inline evidence', async ({ page }) => {
  const wallet = await begin(page, 'issuing');
  await wallet.getByRole('button', { name: 'Accept credential' }).click();

  await expect(page.getByText('Credential issued')).toBeVisible();
  await expect(
    page.locator('pre').filter({ hasText: 'OpenBadgeCredential' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Credential JSON' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'JWT' })).toBeVisible();
});

test('shows a rejected issuance without restarting the run', async ({
  page,
}) => {
  const wallet = await begin(page, 'issuing');
  await wallet.getByRole('button', { name: 'Reject credential' }).click();

  await expect(
    page.getByRole('heading', { name: 'Certification not completed.' }),
  ).toBeVisible();
  await expect(page.getByText(/rejected by the wallet user/i)).toBeVisible();
});

test('certifies verification with the exact setup badge', async ({ page }) => {
  const issueWallet = await begin(page, 'verification');
  await issueWallet.getByRole('button', { name: 'Accept credential' }).click();

  const disclosurePopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continue to verification' }).click();
  const disclosureWallet = await disclosurePopup;
  await disclosureWallet
    .getByRole('button', { name: 'Share credentials' })
    .click();

  await expect(page.getByText('Presentation verified')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Verification certified.' }),
  ).toBeVisible();
  await expect(page.getByText('Credential verified')).toHaveCount(2);
});

test('fails verification when the setup badge is missing', async ({ page }) => {
  const issueWallet = await begin(page, 'verification');
  await issueWallet.getByRole('button', { name: 'Accept credential' }).click();

  const disclosurePopup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continue to verification' }).click();
  const disclosureWallet = await disclosurePopup;
  await disclosureWallet
    .getByRole('button', { name: 'Share without setup badge' })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Verification failed.' }),
  ).toBeVisible();
  await expect(
    page.getByText(/does not contain this run’s setup badge/i),
  ).toBeVisible();
});
