import { expect } from '@playwright/test';
export async function openApiReview(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Separate capture and refund request paths' }).getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByLabel('Current API flow')).toContainText('POST /payments/capture');
  await expect(page.getByRole('button', { name: 'Source', exact: true })).toHaveClass(/active/);
}
export async function chooseApi(page, title) {
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await page.getByRole('button', { name: `Review flow ${title}`, exact: true }).click();
}
