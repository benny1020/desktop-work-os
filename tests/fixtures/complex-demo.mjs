import { expect } from '@playwright/test';

export async function openComplexReview(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Introduce durable payment recovery' })
    .getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Introduce durable payment recovery' })).toBeVisible();
}

export async function chooseComplexFlow(page, label) {
  await page.getByLabel('Choose review flow', { exact: true }).click();
  await page.getByRole('button', { name: `Review flow ${label}`, exact: true }).click();
}
